/**
 * pgvector 기반 DB 레벨 벡터 검색
 *
 * Supabase의 pgvector 확장을 사용하여 네이티브 벡터 연산 수행
 */

import { prisma } from '@/lib/prisma';

/**
 * Float32Array를 pgvector 형식 문자열로 변환
 * @param embedding Float32Array 벡터
 * @returns pgvector 형식 문자열 (예: '[0.1, 0.2, 0.3]')
 */
export function toPgVector(embedding: Float32Array): string {
  return '[' + Array.from(embedding).join(',') + ']';
}

/**
 * pgvector 형식 문자열을 Float32Array로 변환
 * @param pgVector pgvector 형식 문자열
 * @returns Float32Array 벡터
 */
export function fromPgVector(pgVector: string): Float32Array {
  const values = pgVector
    .slice(1, -1) // '[' 와 ']' 제거
    .split(',')
    .map(v => parseFloat(v.trim()));
  return new Float32Array(values);
}

/**
 * DB 레벨에서 코사인 유사도 기반 매뉴얼 검색 (pgvector 사용)
 *
 * @param queryEmbedding 쿼리 벡터
 * @param limit 반환할 최대 결과 수
 * @param threshold 최소 유사도 임계값 (0~1)
 * @returns 유사한 매뉴얼 목록 (유사도 포함)
 */
export async function searchSimilarManualsPgvector(
  queryEmbedding: Float32Array,
  limit: number = 5,
  threshold: number = 0.5
) {
  const pgVector = toPgVector(queryEmbedding);

  // pgvector의 코사인 유사도 연산자 (<=>)를 사용한 Raw SQL 쿼리
  // 1 - (cosine distance) = cosine similarity
  const results = await prisma.$queryRaw<
    Array<{
      id: number;
      manual_id: number;
      similarity: number;
      title: string;
      content: string;
      summary: string | null;
      category_id: number | null;
      status: string;
    }>
  >`
    SELECT
      me.id,
      me.manual_id,
      1 - (me.embedding_vector <=> ${pgVector}::vector) as similarity,
      m.title,
      m.content,
      m.summary,
      m.category_id,
      m.status
    FROM manual_embeddings me
    INNER JOIN manuals m ON me.manual_id = m.id
    WHERE me.embedding_vector IS NOT NULL
      AND 1 - (me.embedding_vector <=> ${pgVector}::vector) >= ${threshold}
    ORDER BY me.embedding_vector <=> ${pgVector}::vector
    LIMIT ${limit}
  `;

  return results;
}

/**
 * 청크 기반 검색 (긴 문서의 경우 더 정확한 검색)
 *
 * @param queryEmbedding 쿼리 벡터
 * @param limit 반환할 최대 결과 수
 * @param threshold 최소 유사도 임계값
 * @returns 유사한 청크 목록 (유사도 및 매뉴얼 정보 포함)
 */
export async function findSimilarChunksPgvector(
  queryEmbedding: Float32Array,
  limit: number = 10,
  threshold: number = 0.5
) {
  const pgVector = toPgVector(queryEmbedding);

  const results = await prisma.$queryRaw<
    Array<{
      id: number;
      manual_id: number;
      chunk_index: number;
      content: string;
      similarity: number;
      title: string;
      manual_summary: string | null;
      category_id: number | null;
    }>
  >`
    SELECT
      mc.id,
      mc.manual_id,
      mc.chunk_index,
      mc.content,
      1 - (mc.embedding_vector <=> ${pgVector}::vector) as similarity,
      m.title,
      m.summary as manual_summary,
      m.category_id
    FROM manual_chunks mc
    INNER JOIN manuals m ON mc.manual_id = m.id
    WHERE mc.embedding_vector IS NOT NULL
      AND 1 - (mc.embedding_vector <=> ${pgVector}::vector) >= ${threshold}
    ORDER BY mc.embedding_vector <=> ${pgVector}::vector
    LIMIT ${limit}
  `;

  return results;
}

/**
 * 하이브리드 검색: 전체 문서 + 청크 검색 결합
 *
 * @param queryEmbedding 쿼리 벡터
 * @param options 검색 옵션
 * @returns 통합된 검색 결과
 */
export async function hybridSearchPgvector(
  queryEmbedding: Float32Array,
  options: {
    manualLimit?: number;
    chunkLimit?: number;
    threshold?: number;
    useChunks?: boolean;
  } = {}
) {
  const {
    manualLimit = 5,
    chunkLimit = 10,
    threshold = 0.5,
    useChunks = true,
  } = options;

  // 병렬 검색 실행
  const [manualResults, chunkResults] = await Promise.all([
    searchSimilarManualsPgvector(queryEmbedding, manualLimit, threshold),
    useChunks
      ? findSimilarChunksPgvector(queryEmbedding, chunkLimit, threshold)
      : Promise.resolve([]),
  ]);

  return {
    manuals: manualResults,
    chunks: chunkResults,
  };
}

/**
 * 카테고리별 필터링 검색
 *
 * @param queryEmbedding 쿼리 벡터
 * @param categoryId 카테고리 ID
 * @param limit 결과 수
 * @param threshold 임계값
 */
export async function searchByCategoryPgvector(
  queryEmbedding: Float32Array,
  categoryId: number,
  limit: number = 5,
  threshold: number = 0.5
) {
  const pgVector = toPgVector(queryEmbedding);

  const results = await prisma.$queryRaw<
    Array<{
      id: number;
      manual_id: number;
      similarity: number;
      title: string;
      content: string;
      summary: string | null;
    }>
  >`
    SELECT
      me.id,
      me.manual_id,
      1 - (me.embedding_vector <=> ${pgVector}::vector) as similarity,
      m.title,
      m.content,
      m.summary
    FROM manual_embeddings me
    INNER JOIN manuals m ON me.manual_id = m.id
    WHERE me.embedding_vector IS NOT NULL
      AND m.category_id = ${categoryId}
      AND 1 - (me.embedding_vector <=> ${pgVector}::vector) >= ${threshold}
    ORDER BY me.embedding_vector <=> ${pgVector}::vector
    LIMIT ${limit}
  `;

  return results;
}

/**
 * pgvector 인덱스 생성 (마이그레이션 후 실행)
 *
 * 성능 최적화를 위해 HNSW 또는 IVFFlat 인덱스 생성
 */
export async function createVectorIndexes() {
  try {
    // HNSW 인덱스 생성 (높은 정확도, 더 많은 메모리 사용)
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS manual_embeddings_vector_idx
      ON manual_embeddings
      USING hnsw (embedding_vector vector_cosine_ops)
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS manual_chunks_vector_idx
      ON manual_chunks
      USING hnsw (embedding_vector vector_cosine_ops)
    `;

    console.log('✅ Vector indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating vector indexes:', error);
    throw error;
  }
}

/**
 * 벡터 통계 조회
 */
export async function getVectorStats() {
  const [embeddingStats, chunkStats] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint; with_vector: bigint }>>`
      SELECT
        COUNT(*) as total,
        COUNT(embedding_vector) as with_vector
      FROM manual_embeddings
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) as total
      FROM manual_chunks
    `,
  ]);

  return {
    totalEmbeddings: Number(embeddingStats[0]?.total || 0),
    embeddingsWithVector: Number(embeddingStats[0]?.with_vector || 0),
    totalChunks: Number(chunkStats[0]?.total || 0),
  };
}
