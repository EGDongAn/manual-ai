import { prisma } from '@/lib/prisma';

export interface SearchMetrics {
  queryId: string;
  query: string;
  timestamp: Date;
  vectorSearchTime: number;
  rerankTime: number;
  llmTime: number;
  totalTime: number;
  chunksRetrieved: number;
  chunksAfterRerank: number;
  confidence: number;
  userFeedback?: 'helpful' | 'not_helpful' | null;
}

interface MetricsSummary {
  totalSearches: number;
  avgVectorSearchTime: number;
  avgRerankTime: number;
  avgLlmTime: number;
  avgTotalTime: number;
  avgChunksRetrieved: number;
  avgChunksAfterRerank: number;
  avgConfidence: number;
  helpfulRate: number;
  topQueries: Array<{ query: string; count: number }>;
  slowestQueries: Array<{ query: string; totalTime: number; timestamp: Date }>;
}

/**
 * 검색 메트릭 기록
 *
 * RAG 파이프라인의 각 단계별 성능 지표를 데이터베이스에 기록합니다.
 * 이 데이터는 시스템 성능 분석 및 최적화에 활용됩니다.
 *
 * @param metrics - 기록할 메트릭 객체
 */
export async function recordSearchMetrics(metrics: SearchMetrics): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO search_metrics (
        query_id,
        query,
        timestamp,
        vector_search_time,
        rerank_time,
        llm_time,
        total_time,
        chunks_retrieved,
        chunks_after_rerank,
        confidence,
        user_feedback
      ) VALUES (
        ${metrics.queryId},
        ${metrics.query},
        ${metrics.timestamp},
        ${metrics.vectorSearchTime},
        ${metrics.rerankTime},
        ${metrics.llmTime},
        ${metrics.totalTime},
        ${metrics.chunksRetrieved},
        ${metrics.chunksAfterRerank},
        ${metrics.confidence},
        ${metrics.userFeedback || null}
      )
    `;
  } catch (error) {
    console.error('Failed to record search metrics:', error);
    // 메트릭 기록 실패는 메인 플로우를 방해하지 않음
  }
}

/**
 * 사용자 피드백 기록
 *
 * 검색 결과에 대한 사용자 피드백을 기록합니다.
 *
 * @param queryId - 검색 쿼리 ID
 * @param feedback - 사용자 피드백 ('helpful' 또는 'not_helpful')
 */
export async function recordUserFeedback(
  queryId: string,
  feedback: 'helpful' | 'not_helpful'
): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE search_metrics
      SET user_feedback = ${feedback}
      WHERE query_id = ${queryId}
    `;
  } catch (error) {
    console.error('Failed to record user feedback:', error);
    throw new Error('피드백 기록에 실패했습니다.');
  }
}

/**
 * 메트릭 요약 조회
 *
 * 지정된 기간 동안의 검색 성능 통계를 집계합니다.
 *
 * @param days - 조회 기간 (일 단위, 기본값: 7일)
 * @returns 메트릭 요약 객체
 */
export async function getMetricsSummary(days: number = 7): Promise<MetricsSummary> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 기본 통계
    const basicStats = await prisma.$queryRaw<Array<{
      total_searches: bigint;
      avg_vector_search_time: number;
      avg_rerank_time: number;
      avg_llm_time: number;
      avg_total_time: number;
      avg_chunks_retrieved: number;
      avg_chunks_after_rerank: number;
      avg_confidence: number;
      helpful_rate: number;
    }>>`
      SELECT
        COUNT(*) as total_searches,
        COALESCE(AVG(vector_search_time), 0) as avg_vector_search_time,
        COALESCE(AVG(rerank_time), 0) as avg_rerank_time,
        COALESCE(AVG(llm_time), 0) as avg_llm_time,
        COALESCE(AVG(total_time), 0) as avg_total_time,
        COALESCE(AVG(chunks_retrieved), 0) as avg_chunks_retrieved,
        COALESCE(AVG(chunks_after_rerank), 0) as avg_chunks_after_rerank,
        COALESCE(AVG(confidence), 0) as avg_confidence,
        COALESCE(
          COUNT(CASE WHEN user_feedback = 'helpful' THEN 1 END)::float /
          NULLIF(COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END), 0),
          0
        ) as helpful_rate
      FROM search_metrics
      WHERE timestamp >= ${cutoffDate}
    `;

    // 상위 검색어
    const topQueries = await prisma.$queryRaw<Array<{
      query: string;
      count: bigint;
    }>>`
      SELECT query, COUNT(*) as count
      FROM search_metrics
      WHERE timestamp >= ${cutoffDate}
      GROUP BY query
      ORDER BY count DESC
      LIMIT 10
    `;

    // 느린 검색어
    const slowestQueries = await prisma.$queryRaw<Array<{
      query: string;
      total_time: number;
      timestamp: Date;
    }>>`
      SELECT query, total_time, timestamp
      FROM search_metrics
      WHERE timestamp >= ${cutoffDate}
      ORDER BY total_time DESC
      LIMIT 10
    `;

    const stats = basicStats[0];

    return {
      totalSearches: Number(stats.total_searches) || 0,
      avgVectorSearchTime: Number(stats.avg_vector_search_time) || 0,
      avgRerankTime: Number(stats.avg_rerank_time) || 0,
      avgLlmTime: Number(stats.avg_llm_time) || 0,
      avgTotalTime: Number(stats.avg_total_time) || 0,
      avgChunksRetrieved: Number(stats.avg_chunks_retrieved) || 0,
      avgChunksAfterRerank: Number(stats.avg_chunks_after_rerank) || 0,
      avgConfidence: Number(stats.avg_confidence) || 0,
      helpfulRate: Number(stats.helpful_rate) || 0,
      topQueries: topQueries.map(q => ({
        query: q.query,
        count: Number(q.count)
      })),
      slowestQueries: slowestQueries.map(q => ({
        query: q.query,
        totalTime: Number(q.total_time),
        timestamp: new Date(q.timestamp)
      }))
    };
  } catch (error) {
    console.error('Failed to get metrics summary:', error);
    // 에러 시 빈 통계 반환
    return {
      totalSearches: 0,
      avgVectorSearchTime: 0,
      avgRerankTime: 0,
      avgLlmTime: 0,
      avgTotalTime: 0,
      avgChunksRetrieved: 0,
      avgChunksAfterRerank: 0,
      avgConfidence: 0,
      helpfulRate: 0,
      topQueries: [],
      slowestQueries: []
    };
  }
}

/**
 * 메트릭 정리
 *
 * 오래된 메트릭 데이터를 정리합니다 (선택적).
 *
 * @param retentionDays - 보관 기간 (기본값: 90일)
 */
export async function cleanupOldMetrics(retentionDays: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.$executeRaw`
      DELETE FROM search_metrics
      WHERE timestamp < ${cutoffDate}
    `;

    return Number(result) || 0;
  } catch (error) {
    console.error('Failed to cleanup old metrics:', error);
    return 0;
  }
}

/**
 * 특정 쿼리의 메트릭 조회
 *
 * @param queryId - 검색 쿼리 ID
 * @returns 메트릭 객체 또는 null
 */
export async function getMetricsByQueryId(queryId: string): Promise<SearchMetrics | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      query_id: string;
      query: string;
      timestamp: Date;
      vector_search_time: number;
      rerank_time: number;
      llm_time: number;
      total_time: number;
      chunks_retrieved: number;
      chunks_after_rerank: number;
      confidence: number;
      user_feedback: 'helpful' | 'not_helpful' | null;
    }>>`
      SELECT
        query_id,
        query,
        timestamp,
        vector_search_time,
        rerank_time,
        llm_time,
        total_time,
        chunks_retrieved,
        chunks_after_rerank,
        confidence,
        user_feedback
      FROM search_metrics
      WHERE query_id = ${queryId}
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      queryId: row.query_id,
      query: row.query,
      timestamp: new Date(row.timestamp),
      vectorSearchTime: Number(row.vector_search_time),
      rerankTime: Number(row.rerank_time),
      llmTime: Number(row.llm_time),
      totalTime: Number(row.total_time),
      chunksRetrieved: Number(row.chunks_retrieved),
      chunksAfterRerank: Number(row.chunks_after_rerank),
      confidence: Number(row.confidence),
      userFeedback: row.user_feedback
    };
  } catch (error) {
    console.error('Failed to get metrics by query ID:', error);
    return null;
  }
}
