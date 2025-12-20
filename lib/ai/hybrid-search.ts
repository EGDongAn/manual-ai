/**
 * 하이브리드 검색 시스템
 *
 * 벡터 검색과 키워드 검색을 결합하여
 * RRF(Reciprocal Rank Fusion) 알고리즘으로 결과를 통합합니다.
 */

import { prisma } from '@/lib/prisma';
import { generateEmbedding } from './gemini';
import { toPgVector } from './pgvector-search';
import type { HybridChunkResult } from './types';

// 검색 가중치 설정
const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

// RRF 파라미터 (순위 보정 상수)
const RRF_K = 60;

// HybridChunkResult는 types.ts에서 가져옴 (개별 청크 결과 타입)

/**
 * RRF (Reciprocal Rank Fusion) 점수 계산
 *
 * RRF는 여러 랭킹 결과를 통합하는 알고리즘으로,
 * 각 항목의 순위에 대한 역수를 합산합니다.
 *
 * @param rank - 순위 (1부터 시작)
 * @param k - 보정 상수 (기본값 60)
 * @returns RRF 점수
 */
function calculateRRFScore(rank: number, k: number = RRF_K): number {
  return 1 / (k + rank);
}

/**
 * 벡터 검색 수행
 *
 * @param queryEmbedding - 쿼리 임베딩 벡터
 * @param limit - 반환할 최대 결과 수
 * @param manualIds - 검색 대상 매뉴얼 ID 목록 (선택사항)
 */
async function vectorSearch(
  queryEmbedding: number[],
  limit: number,
  manualIds?: number[]
): Promise<Array<{
  chunk_id: number;
  manual_id: number;
  similarity: number;
}>> {
  // pgvector 문자열 형식으로 변환
  const embeddingFloat32 = new Float32Array(queryEmbedding);
  const pgVectorString = toPgVector(embeddingFloat32);

  // PostgreSQL의 벡터 유사도 검색
  // cosine similarity = 1 - cosine distance
  if (manualIds && manualIds.length > 0) {
    const results = await prisma.$queryRaw<Array<{
      chunk_id: number;
      manual_id: number;
      similarity: number;
    }>>`
      SELECT
        mc.id as chunk_id,
        mc.manual_id,
        1 - (mc.embedding_vector <=> ${pgVectorString}::vector) as similarity
      FROM manual_chunks mc
      WHERE mc.manual_id = ANY(${manualIds}::int[])
      ORDER BY mc.embedding_vector <=> ${pgVectorString}::vector
      LIMIT ${limit}
    `;
    return results;
  }

  const results = await prisma.$queryRaw<Array<{
    chunk_id: number;
    manual_id: number;
    similarity: number;
  }>>`
    SELECT
      mc.id as chunk_id,
      mc.manual_id,
      1 - (mc.embedding_vector <=> ${pgVectorString}::vector) as similarity
    FROM manual_chunks mc
    ORDER BY mc.embedding_vector <=> ${pgVectorString}::vector
    LIMIT ${limit}
  `;

  return results;
}

/**
 * 키워드 검색 수행
 *
 * PostgreSQL의 전문 검색(Full-Text Search) 기능 사용
 *
 * @param query - 검색 쿼리
 * @param limit - 반환할 최대 결과 수
 * @param manualIds - 검색 대상 매뉴얼 ID 목록 (선택사항)
 */
async function keywordSearch(
  query: string,
  limit: number,
  manualIds?: number[]
): Promise<Array<{
  chunk_id: number;
  manual_id: number;
  rank: number;
}>> {
  // 한글 검색을 위한 쿼리 전처리
  // PostgreSQL의 to_tsquery는 공백으로 구분된 단어를 OR 조건으로 처리
  const searchQuery = query
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .join(' | '); // OR 조건

  // manualIds 필터링이 있는 경우와 없는 경우 분리
  if (manualIds && manualIds.length > 0) {
    const results = await prisma.$queryRaw<Array<{
      chunk_id: number;
      manual_id: number;
      rank: number;
    }>>`
      SELECT
        mc.id as chunk_id,
        mc.manual_id,
        ts_rank(
          to_tsvector('simple', mc.content || ' ' || COALESCE(mc.section_title, '')),
          to_tsquery('simple', ${searchQuery})
        ) as rank
      FROM manual_chunks mc
      WHERE to_tsvector('simple', mc.content || ' ' || COALESCE(mc.section_title, ''))
            @@ to_tsquery('simple', ${searchQuery})
        AND mc.manual_id = ANY(${manualIds}::int[])
      ORDER BY rank DESC
      LIMIT ${limit}
    `;
    return results;
  }

  const results = await prisma.$queryRaw<Array<{
    chunk_id: number;
    manual_id: number;
    rank: number;
  }>>`
    SELECT
      mc.id as chunk_id,
      mc.manual_id,
      ts_rank(
        to_tsvector('simple', mc.content || ' ' || COALESCE(mc.section_title, '')),
        to_tsquery('simple', ${searchQuery})
      ) as rank
    FROM manual_chunks mc
    WHERE to_tsvector('simple', mc.content || ' ' || COALESCE(mc.section_title, ''))
          @@ to_tsquery('simple', ${searchQuery})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return results;
}

/**
 * 하이브리드 검색 수행
 *
 * 벡터 검색과 키워드 검색 결과를 RRF로 통합
 *
 * @param query - 검색 쿼리
 * @param limit - 반환할 최대 결과 수
 * @param manualIds - 검색 대상 매뉴얼 ID 목록 (선택사항)
 * @returns 통합 검색 결과
 */
export async function hybridSearch(
  query: string,
  limit: number = 10,
  manualIds?: number[]
): Promise<HybridChunkResult[]> {
  // 1. 쿼리 임베딩 생성
  const queryEmbedding = await generateEmbedding(query);

  // 2. 벡터 검색과 키워드 검색 병렬 수행
  // 더 많은 후보를 가져와서 RRF로 재정렬
  const searchLimit = limit * 3;

  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(queryEmbedding, searchLimit, manualIds),
    keywordSearch(query, searchLimit, manualIds)
  ]);

  // 3. RRF 점수 계산을 위한 순위 매핑
  const vectorScores = new Map<number, number>();
  vectorResults.forEach((result, index) => {
    const rrfScore = calculateRRFScore(index + 1);
    vectorScores.set(result.chunk_id, rrfScore * VECTOR_WEIGHT);
  });

  const keywordScores = new Map<number, number>();
  keywordResults.forEach((result, index) => {
    const rrfScore = calculateRRFScore(index + 1);
    keywordScores.set(result.chunk_id, rrfScore * KEYWORD_WEIGHT);
  });

  // 4. 통합 점수 계산
  const combinedScores = new Map<number, {
    chunkId: number;
    manualId: number;
    vectorScore: number;
    keywordScore: number;
    combinedScore: number;
  }>();

  // 벡터 검색 결과 추가
  for (const result of vectorResults) {
    const vectorScore = vectorScores.get(result.chunk_id) || 0;
    const keywordScore = keywordScores.get(result.chunk_id) || 0;
    const combinedScore = vectorScore + keywordScore;

    combinedScores.set(result.chunk_id, {
      chunkId: result.chunk_id,
      manualId: result.manual_id,
      vectorScore,
      keywordScore,
      combinedScore
    });
  }

  // 키워드 검색 결과 추가 (벡터 검색에 없는 것만)
  for (const result of keywordResults) {
    if (!combinedScores.has(result.chunk_id)) {
      const vectorScore = vectorScores.get(result.chunk_id) || 0;
      const keywordScore = keywordScores.get(result.chunk_id) || 0;
      const combinedScore = vectorScore + keywordScore;

      combinedScores.set(result.chunk_id, {
        chunkId: result.chunk_id,
        manualId: result.manual_id,
        vectorScore,
        keywordScore,
        combinedScore
      });
    }
  }

  // 5. 통합 점수로 정렬하여 상위 결과 선택
  const topChunks = Array.from(combinedScores.values())
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);

  if (topChunks.length === 0) {
    return [];
  }

  // 6. 청크 상세 정보 조회
  const chunkIds = topChunks.map(c => c.chunkId);
  const chunks = await prisma.$queryRaw<Array<{
    id: number;
    manual_id: number;
    chunk_index: number;
    content: string;
    section_title: string | null;
    manual_title: string;
  }>>`
    SELECT
      mc.id,
      mc.manual_id,
      mc.chunk_index,
      mc.content,
      mc.section_title,
      m.title as manual_title
    FROM manual_chunks mc
    JOIN manuals m ON m.id = mc.manual_id
    WHERE mc.id = ANY(${chunkIds}::int[])
  `;

  // 7. 청크 정보와 점수 결합
  const results: HybridChunkResult[] = topChunks
    .map(score => {
      const chunk = chunks.find(c => c.id === score.chunkId);
      if (!chunk) return null;

      return {
        chunkId: chunk.id,
        manualId: chunk.manual_id,
        content: chunk.content,
        manualTitle: chunk.manual_title,
        sectionTitle: chunk.section_title,
        chunkIndex: chunk.chunk_index,
        vectorScore: score.vectorScore,
        keywordScore: score.keywordScore,
        combinedScore: score.combinedScore
      };
    })
    .filter((r): r is HybridChunkResult => r !== null);

  return results;
}

/**
 * 특정 매뉴얼 내에서 하이브리드 검색
 *
 * @param query - 검색 쿼리
 * @param manualId - 대상 매뉴얼 ID
 * @param limit - 반환할 최대 결과 수
 */
export async function searchWithinManual(
  query: string,
  manualId: number,
  limit: number = 5
): Promise<HybridChunkResult[]> {
  return hybridSearch(query, limit, [manualId]);
}

/**
 * 검색 결과를 컨텍스트 문자열로 변환
 *
 * AI에게 전달하기 위한 형식으로 변환
 *
 * @param results - 검색 결과
 * @param maxChunks - 포함할 최대 청크 수
 */
export function formatSearchResultsAsContext(
  results: HybridChunkResult[],
  maxChunks: number = 5
): string {
  const selectedResults = results.slice(0, maxChunks);

  if (selectedResults.length === 0) {
    return '관련 정보를 찾을 수 없습니다.';
  }

  const contextParts = selectedResults.map((result, index) => {
    const header = `[출처 ${index + 1}] ${result.manualTitle}`;
    const section = result.sectionTitle ? ` - ${result.sectionTitle}` : '';
    const content = result.content.trim();

    return `${header}${section}\n\n${content}`;
  });

  return contextParts.join('\n\n---\n\n');
}

/**
 * 검색 결과 메타데이터 생성
 *
 * @param results - 검색 결과
 */
export function getSearchMetadata(results: HybridChunkResult[]): {
  totalResults: number;
  uniqueManuals: number;
  avgCombinedScore: number;
  topManual: { id: number; title: string; count: number } | null;
} {
  if (results.length === 0) {
    return {
      totalResults: 0,
      uniqueManuals: 0,
      avgCombinedScore: 0,
      topManual: null
    };
  }

  // 매뉴얼별 청크 수 집계
  const manualCounts = new Map<number, { title: string; count: number }>();
  let totalScore = 0;

  for (const result of results) {
    const existing = manualCounts.get(result.manualId);
    if (existing) {
      existing.count++;
    } else {
      manualCounts.set(result.manualId, {
        title: result.manualTitle,
        count: 1
      });
    }
    totalScore += result.combinedScore;
  }

  // 가장 많이 매칭된 매뉴얼 찾기
  let topManual: { id: number; title: string; count: number } | null = null;
  let maxCount = 0;

  for (const [manualId, info] of manualCounts.entries()) {
    if (info.count > maxCount) {
      maxCount = info.count;
      topManual = {
        id: manualId,
        title: info.title,
        count: info.count
      };
    }
  }

  return {
    totalResults: results.length,
    uniqueManuals: manualCounts.size,
    avgCombinedScore: totalScore / results.length,
    topManual
  };
}
