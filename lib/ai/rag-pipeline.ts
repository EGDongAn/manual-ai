/**
 * RAG (Retrieval-Augmented Generation) 통합 파이프라인
 *
 * Phase 3: Reranking, Metrics, Caching, Enhanced Prompts
 *
 * 전체 플로우:
 * 1. 캐시 확인
 * 2. Hybrid Search (Vector + Keyword)
 * 3. Reranking (Gemini)
 * 4. LLM 생성
 * 5. 메트릭 기록
 * 6. 캐시 저장
 */

import { v4 as uuidv4 } from 'uuid';
import { hybridSearch } from './hybrid-search';
import type { HybridChunkResult } from './types';
import { rerankChunks, RerankResult } from './reranker';
import { generateJSON } from './gemini';
import { getEnhancedSearchQAPrompt } from './prompts';
import { recordSearchMetrics, SearchMetrics } from './metrics';
import { getCachedResult, setCachedResult } from './cache';

export interface RAGConfig {
  hybridSearchLimit: number;
  rerankTopK: number;
  enableCache: boolean;
  enableRerank: boolean;
  enableMetrics: boolean;
  cacheTTL?: number; // seconds
}

export interface RAGResponse {
  reasoning?: {
    questionAnalysis: string;
    relevantManuals: string[];
    synthesisApproach: string;
  };
  answer: string;
  sources: Array<{
    manualId: number;
    title: string;
    relevance: string;
  }>;
  confidence: number;
  limitations?: string;
  followUpQuestions: string[];
}

export interface SearchResult {
  response: RAGResponse;
  chunks: HybridChunkResult[];
  rerankedChunks?: RerankResult[];
  metrics: {
    vectorSearchTime: number;
    rerankTime: number;
    llmTime: number;
    totalTime: number;
    chunksRetrieved: number;
    chunksAfterRerank: number;
    cacheHit: boolean;
  };
}

const DEFAULT_CONFIG: RAGConfig = {
  hybridSearchLimit: 15,
  rerankTopK: 5,
  enableCache: true,
  enableRerank: true,
  enableMetrics: true,
  cacheTTL: 3600
};

/**
 * RAG 파이프라인 실행
 *
 * @param query - 사용자 검색 쿼리
 * @param config - 파이프라인 설정 (선택적)
 * @returns 검색 결과 및 메트릭
 */
export async function executeRAGPipeline(
  query: string,
  config?: Partial<RAGConfig>
): Promise<SearchResult & { queryId: string }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const queryId = uuidv4();
  const startTime = Date.now();

  let vectorSearchTime = 0;
  let rerankTime = 0;
  let llmTime = 0;
  let cacheHit = false;

  try {
    // 1. 캐시 확인
    if (finalConfig.enableCache) {
      const cached = await getCachedResult<SearchResult>(query);
      if (cached) {
        console.log('Cache hit for query:', query);
        return {
          ...cached,
          queryId,
          metrics: {
            ...cached.metrics,
            cacheHit: true
          }
        };
      }
    }

    // 2. Hybrid Search (Vector + Keyword)
    const searchStart = Date.now();
    const searchResults = await hybridSearch(
      query,
      finalConfig.hybridSearchLimit
    );
    vectorSearchTime = Date.now() - searchStart;

    if (searchResults.length === 0) {
      // 검색 결과 없음
      const emptyResult: SearchResult = {
        response: {
          answer: '관련된 매뉴얼을 찾을 수 없습니다. 다른 검색어로 시도해보세요.',
          sources: [],
          confidence: 0,
          followUpQuestions: []
        },
        chunks: [],
        metrics: {
          vectorSearchTime,
          rerankTime: 0,
          llmTime: 0,
          totalTime: Date.now() - startTime,
          chunksRetrieved: 0,
          chunksAfterRerank: 0,
          cacheHit: false
        }
      };

      return {
        ...emptyResult,
        queryId
      };
    }

    // 3. Reranking (선택적)
    let finalChunks = searchResults;
    let rerankedResults: RerankResult[] | undefined;

    if (finalConfig.enableRerank && searchResults.length > 0) {
      const rerankStart = Date.now();

      const chunksToRerank = searchResults.map(r => ({
        id: r.chunkId,
        content: r.content,
        title: r.manualTitle + (r.sectionTitle ? ` - ${r.sectionTitle}` : '')
      }));

      rerankedResults = await rerankChunks(
        query,
        chunksToRerank,
        finalConfig.rerankTopK
      );

      rerankTime = Date.now() - rerankStart;

      // 재순위화된 청크 순서대로 정렬
      const rerankedMap = new Map(
        rerankedResults.map(r => [r.chunkId, r.relevanceScore])
      );

      finalChunks = searchResults
        .filter(chunk => rerankedMap.has(chunk.chunkId))
        .sort((a, b) => {
          const scoreA = rerankedMap.get(a.chunkId) || 0;
          const scoreB = rerankedMap.get(b.chunkId) || 0;
          return scoreB - scoreA;
        })
        .slice(0, finalConfig.rerankTopK);
    }

    // 4. LLM 생성
    const llmStart = Date.now();

    // 매뉴얼 형식으로 변환
    const manuals = finalChunks.map(chunk => ({
      id: chunk.manualId,
      title: chunk.manualTitle,
      content: chunk.content,
      summary: null,
      categoryName: null
    }));

    const prompt = getEnhancedSearchQAPrompt(query, manuals);
    const response = await generateJSON<RAGResponse>(prompt);

    llmTime = Date.now() - llmStart;

    // 5. 결과 구성
    const totalTime = Date.now() - startTime;

    const result: SearchResult = {
      response,
      chunks: searchResults,
      rerankedChunks: rerankedResults,
      metrics: {
        vectorSearchTime,
        rerankTime,
        llmTime,
        totalTime,
        chunksRetrieved: searchResults.length,
        chunksAfterRerank: finalChunks.length,
        cacheHit
      }
    };

    // 6. 메트릭 기록
    if (finalConfig.enableMetrics) {
      const metrics: SearchMetrics = {
        queryId,
        query,
        timestamp: new Date(startTime),
        vectorSearchTime,
        rerankTime,
        llmTime,
        totalTime,
        chunksRetrieved: searchResults.length,
        chunksAfterRerank: finalChunks.length,
        confidence: response.confidence
      };

      // 비동기로 기록 (메인 플로우 차단 방지)
      recordSearchMetrics(metrics).catch(err => {
        console.error('Failed to record metrics:', err);
      });
    }

    // 7. 캐시 저장
    if (finalConfig.enableCache) {
      setCachedResult(
        query,
        result,
        finalConfig.cacheTTL
      ).catch(err => {
        console.error('Failed to cache result:', err);
      });
    }

    return {
      ...result,
      queryId
    };
  } catch (error) {
    console.error('RAG Pipeline error:', error);

    // 에러 응답
    const totalTime = Date.now() - startTime;
    const errorResult: SearchResult = {
      response: {
        answer: '검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        sources: [],
        confidence: 0,
        followUpQuestions: []
      },
      chunks: [],
      metrics: {
        vectorSearchTime,
        rerankTime,
        llmTime,
        totalTime,
        chunksRetrieved: 0,
        chunksAfterRerank: 0,
        cacheHit: false
      }
    };

    return {
      ...errorResult,
      queryId
    };
  }
}

/**
 * 특정 매뉴얼 내 RAG 검색
 *
 * @param query - 검색 쿼리
 * @param manualId - 대상 매뉴얼 ID
 * @param config - 파이프라인 설정
 */
export async function executeRAGWithinManual(
  query: string,
  manualId: number,
  config?: Partial<RAGConfig>
): Promise<SearchResult & { queryId: string }> {
  // TODO: hybridSearch에 manualIds 필터 전달
  // 현재는 전체 검색 후 필터링
  const result = await executeRAGPipeline(query, config);

  // 특정 매뉴얼의 청크만 필터링
  const filteredChunks = result.chunks.filter(c => c.manualId === manualId);

  return {
    ...result,
    chunks: filteredChunks
  };
}

/**
 * 빠른 RAG 검색 (캐시 + 간단한 재순위화)
 *
 * 성능 최적화 버전:
 * - 캐시 우선
 * - LLM 재순위화 비활성화
 * - 메트릭 비활성화
 *
 * @param query - 검색 쿼리
 */
export async function quickRAGSearch(
  query: string
): Promise<SearchResult & { queryId: string }> {
  return executeRAGPipeline(query, {
    enableRerank: false,
    enableMetrics: false,
    enableCache: true,
    hybridSearchLimit: 10,
    rerankTopK: 5
  });
}

/**
 * 고품질 RAG 검색 (모든 기능 활성화)
 *
 * 최고 품질 버전:
 * - 모든 기능 활성화
 * - 더 많은 청크 검색
 * - 철저한 재순위화
 *
 * @param query - 검색 쿼리
 */
export async function premiumRAGSearch(
  query: string
): Promise<SearchResult & { queryId: string }> {
  return executeRAGPipeline(query, {
    enableRerank: true,
    enableMetrics: true,
    enableCache: true,
    hybridSearchLimit: 20,
    rerankTopK: 8
  });
}
