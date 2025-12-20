/**
 * RAG Phase 3 사용 예시
 *
 * 이 파일은 새로운 RAG 파이프라인의 사용법을 보여줍니다.
 */

import {
  executeRAGPipeline,
  quickRAGSearch,
  premiumRAGSearch
} from '../rag-pipeline';
import { recordUserFeedback, getMetricsSummary } from '../metrics';
import { getCacheStats, getPopularQueries, cleanupExpiredCache } from '../cache';

/**
 * 예시 1: 기본 RAG 검색
 */
export async function example1_basicSearch() {
  const query = '환자 접수 절차는 어떻게 되나요?';

  console.log('검색 시작:', query);

  const result = await executeRAGPipeline(query);

  console.log('\n=== 검색 결과 ===');
  console.log('답변:', result.response.answer);
  console.log('신뢰도:', result.response.confidence);
  console.log('출처:', result.response.sources);
  console.log('후속 질문:', result.response.followUpQuestions);

  console.log('\n=== 메트릭 ===');
  console.log('전체 소요 시간:', result.metrics.totalTime, 'ms');
  console.log('벡터 검색:', result.metrics.vectorSearchTime, 'ms');
  console.log('재순위화:', result.metrics.rerankTime, 'ms');
  console.log('LLM 생성:', result.metrics.llmTime, 'ms');
  console.log('캐시 히트:', result.metrics.cacheHit);

  console.log('\n=== 청크 정보 ===');
  console.log('검색된 청크:', result.metrics.chunksRetrieved);
  console.log('재순위화 후 청크:', result.metrics.chunksAfterRerank);

  // 사용자 피드백 기록 (선택적)
  if (result.response.confidence > 0.8) {
    await recordUserFeedback(result.queryId, 'helpful');
    console.log('\n✅ 유용한 답변으로 피드백 기록됨');
  }

  return result;
}

/**
 * 예시 2: 빠른 검색 (재순위화 비활성화)
 */
export async function example2_quickSearch() {
  const query = '진료 예약 취소 방법';

  console.log('빠른 검색 시작:', query);

  const result = await quickRAGSearch(query);

  console.log('답변:', result.response.answer);
  console.log('소요 시간:', result.metrics.totalTime, 'ms');
  console.log('재순위화 시간:', result.metrics.rerankTime, 'ms'); // 0이어야 함

  return result;
}

/**
 * 예시 3: 고품질 검색 (모든 기능 활성화, 더 많은 청크)
 */
export async function example3_premiumSearch() {
  const query = '응급실 운영 규정';

  console.log('고품질 검색 시작:', query);

  const result = await premiumRAGSearch(query);

  console.log('답변:', result.response.answer);
  console.log('검색된 청크:', result.metrics.chunksRetrieved);
  console.log('재순위화 후 청크:', result.metrics.chunksAfterRerank);

  // Chain-of-Thought 추론 과정 출력
  if (result.response.reasoning) {
    console.log('\n=== 추론 과정 ===');
    console.log('질문 분석:', result.response.reasoning.questionAnalysis);
    console.log('관련 매뉴얼:', result.response.reasoning.relevantManuals);
    console.log('종합 방법:', result.response.reasoning.synthesisApproach);
  }

  return result;
}

/**
 * 예시 4: 커스텀 설정
 */
export async function example4_customConfig() {
  const query = '의료기기 관리 절차';

  const result = await executeRAGPipeline(query, {
    hybridSearchLimit: 20,      // 더 많은 후보 검색
    rerankTopK: 8,              // 재순위화 후 8개 선택
    enableRerank: true,         // 재순위화 활성화
    enableCache: true,          // 캐시 활성화
    enableMetrics: true,        // 메트릭 기록 활성화
    cacheTTL: 7200              // 2시간 TTL
  });

  console.log('커스텀 검색 완료');
  console.log('청크:', result.metrics.chunksAfterRerank);
  console.log('답변:', result.response.answer);

  return result;
}

/**
 * 예시 5: 메트릭 분석
 */
export async function example5_analyzeMetrics() {
  console.log('=== 최근 7일 메트릭 요약 ===');

  const summary = await getMetricsSummary(7);

  console.log('총 검색 수:', summary.totalSearches);
  console.log('평균 벡터 검색 시간:', summary.avgVectorSearchTime.toFixed(2), 'ms');
  console.log('평균 재순위화 시간:', summary.avgRerankTime.toFixed(2), 'ms');
  console.log('평균 LLM 시간:', summary.avgLlmTime.toFixed(2), 'ms');
  console.log('평균 전체 시간:', summary.avgTotalTime.toFixed(2), 'ms');
  console.log('평균 신뢰도:', summary.avgConfidence.toFixed(2));
  console.log('유용 비율:', (summary.helpfulRate * 100).toFixed(1), '%');

  console.log('\n=== 상위 검색어 ===');
  summary.topQueries.slice(0, 5).forEach((q, i) => {
    console.log(`${i + 1}. "${q.query}" (${q.count}회)`);
  });

  console.log('\n=== 느린 검색어 ===');
  summary.slowestQueries.slice(0, 3).forEach((q, i) => {
    console.log(`${i + 1}. "${q.query}" (${q.totalTime.toFixed(0)}ms)`);
  });

  return summary;
}

/**
 * 예시 6: 캐시 관리
 */
export async function example6_cacheManagement() {
  console.log('=== 캐시 통계 ===');

  const stats = await getCacheStats();

  console.log('총 캐시 항목:', stats.totalEntries);
  console.log('총 히트 수:', stats.totalHits);
  console.log('평균 히트 수:', stats.avgHitCount.toFixed(1));
  console.log('캐시 크기:', (stats.cacheSize / 1024).toFixed(2), 'KB');

  if (stats.oldestEntry) {
    console.log('가장 오래된 항목:', stats.oldestEntry.toLocaleString());
  }
  if (stats.newestEntry) {
    console.log('가장 최근 항목:', stats.newestEntry.toLocaleString());
  }

  console.log('\n=== 인기 검색어 (캐시 기반) ===');
  const popularQueries = await getPopularQueries(5);
  popularQueries.forEach((q, i) => {
    console.log(`${i + 1}. "${q.query}" (${q.hitCount}회 히트)`);
  });

  // 만료된 캐시 정리
  console.log('\n=== 만료된 캐시 정리 ===');
  const deletedCount = await cleanupExpiredCache();
  console.log('삭제된 캐시 항목:', deletedCount);

  return { stats, popularQueries, deletedCount };
}

/**
 * 예시 7: 병렬 검색
 */
export async function example7_parallelSearch() {
  const queries = [
    '환자 접수 절차',
    '진료 예약 방법',
    '의료비 계산 방법'
  ];

  console.log('병렬 검색 시작:', queries);

  const results = await Promise.all(
    queries.map(query => quickRAGSearch(query))
  );

  console.log('\n=== 병렬 검색 결과 ===');
  results.forEach((result, i) => {
    console.log(`\n쿼리 ${i + 1}: ${queries[i]}`);
    console.log('답변:', result.response.answer.slice(0, 100) + '...');
    console.log('소요 시간:', result.metrics.totalTime, 'ms');
    console.log('캐시 히트:', result.metrics.cacheHit);
  });

  return results;
}

/**
 * 모든 예시 실행
 */
export async function runAllExamples() {
  try {
    console.log('🚀 RAG Phase 3 예시 시작\n');

    await example1_basicSearch();
    console.log('\n' + '='.repeat(50) + '\n');

    await example2_quickSearch();
    console.log('\n' + '='.repeat(50) + '\n');

    await example3_premiumSearch();
    console.log('\n' + '='.repeat(50) + '\n');

    await example4_customConfig();
    console.log('\n' + '='.repeat(50) + '\n');

    await example5_analyzeMetrics();
    console.log('\n' + '='.repeat(50) + '\n');

    await example6_cacheManagement();
    console.log('\n' + '='.repeat(50) + '\n');

    await example7_parallelSearch();

    console.log('\n✅ 모든 예시 완료!');
  } catch (error) {
    console.error('❌ 예시 실행 중 오류:', error);
  }
}

// 직접 실행 시
if (require.main === module) {
  runAllExamples();
}
