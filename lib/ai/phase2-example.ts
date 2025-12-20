/**
 * RAG Phase 2 사용 예제
 *
 * 이 파일은 청킹 시스템과 하이브리드 검색의 사용 방법을 보여줍니다.
 */

import {
  // 청킹
  chunkDocument,
  estimateTokens,
  calculateChunkingStats,
  CHUNK_SIZE,
  CHUNK_OVERLAP,

  // 인덱싱
  indexManualChunks,
  reindexManual,
  reindexAllChunks,
  getChunkIndexStats,
  getManualChunks,

  // 검색
  hybridSearch,
  searchWithinManual,
  formatSearchResultsAsContext,
  getSearchMetadata,
} from './index';

// =============================================================================
// 예제 1: 문서 청킹
// =============================================================================

export async function example1_chunking() {
  console.log('=== 예제 1: 문서 청킹 ===\n');

  const sampleContent = `
# 냉장고 사용 설명서

## 1. 제품 특징
이 냉장고는 최신 인버터 기술을 적용하여 에너지 효율이 뛰어납니다.
소음이 적고 온도 제어가 정확합니다.

## 2. 온도 설정 방법

### 2.1 냉장실 온도 설정
냉장실 온도는 2-8도 사이에서 설정할 수 있습니다.
1. 온도 조절 버튼을 누릅니다.
2. 원하는 온도가 나올 때까지 버튼을 반복해서 누릅니다.
3. 3초 후 설정이 완료됩니다.

### 2.2 냉동실 온도 설정
냉동실 온도는 -15도에서 -23도 사이에서 설정 가능합니다.
냉동실 버튼을 사용하여 동일한 방식으로 설정합니다.

## 3. 청소 및 관리

### 3.1 일상적인 청소
부드러운 천으로 정기적으로 닦아주세요.
화학 세제는 사용하지 마세요.

### 3.2 정기 점검
6개월마다 전문가의 점검을 받으시기 바랍니다.
  `.trim();

  // 1. 토큰 수 추정
  const totalTokens = estimateTokens(sampleContent);
  console.log(`전체 토큰 수: ${totalTokens}`);
  console.log(`예상 청크 수: ${Math.ceil(totalTokens / CHUNK_SIZE)}\n`);

  // 2. 문서 청킹
  const chunks = chunkDocument(sampleContent, '냉장고 사용 설명서');
  console.log(`실제 생성된 청크 수: ${chunks.length}\n`);

  // 3. 각 청크 정보 출력
  chunks.forEach((chunk, index) => {
    console.log(`[청크 ${index + 1}]`);
    console.log(`섹션: ${chunk.metadata.sectionTitle || '제목 없음'}`);
    console.log(`토큰 수: ${chunk.tokenCount}`);
    console.log(`위치: ${chunk.metadata.startOffset} - ${chunk.metadata.endOffset}`);
    console.log(`내용 미리보기: ${chunk.content.substring(0, 50)}...`);
    console.log('');
  });

  // 4. 청킹 통계
  const stats = calculateChunkingStats(chunks);
  console.log('청킹 통계:');
  console.log(`- 총 청크 수: ${stats.totalChunks}`);
  console.log(`- 평균 토큰: ${stats.avgTokensPerChunk}`);
  console.log(`- 최소 토큰: ${stats.minTokens}`);
  console.log(`- 최대 토큰: ${stats.maxTokens}`);
  console.log(`- 총 토큰: ${stats.totalTokens}\n`);
}

// =============================================================================
// 예제 2: 매뉴얼 인덱싱
// =============================================================================

export async function example2_indexing(manualId: number) {
  console.log('=== 예제 2: 매뉴얼 인덱싱 ===\n');

  const title = '냉장고 사용 설명서';
  const content = `
# 냉장고 사용 설명서

## 온도 설정
냉장실은 2-8도, 냉동실은 -15도에서 -23도 사이에서 설정 가능합니다.

## 청소 방법
부드러운 천으로 정기적으로 닦아주세요.
  `.trim();

  try {
    // 1. 매뉴얼 인덱싱
    console.log('매뉴얼 인덱싱 시작...');
    const result = await indexManualChunks(manualId, title, content);

    console.log(`\n인덱싱 완료:`);
    console.log(`- 생성된 청크: ${result.chunksCreated}개`);
    console.log(`- 스킵된 청크: ${result.chunksSkipped}개`);
    console.log(`- 평균 토큰: ${result.stats.avgTokensPerChunk}`);

    // 2. 생성된 청크 조회
    const chunks = await getManualChunks(manualId);
    console.log(`\n생성된 청크 목록 (${chunks.length}개):`);
    chunks.forEach((chunk) => {
      console.log(`- 청크 ${chunk.chunkIndex}: ${chunk.sectionTitle || '제목 없음'} (${chunk.tokenCount} 토큰)`);
    });
  } catch (error) {
    console.error('인덱싱 실패:', error);
  }
}

// =============================================================================
// 예제 3: 하이브리드 검색
// =============================================================================

export async function example3_search() {
  console.log('=== 예제 3: 하이브리드 검색 ===\n');

  const query = '냉장고 온도 설정 방법';

  try {
    // 1. 하이브리드 검색 수행
    console.log(`검색어: "${query}"\n`);
    const results = await hybridSearch(query, 5);

    if (results.length === 0) {
      console.log('검색 결과가 없습니다.');
      return;
    }

    // 2. 검색 결과 출력
    console.log(`검색 결과 (${results.length}개):\n`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.manualTitle}`);
      if (result.sectionTitle) {
        console.log(`    섹션: ${result.sectionTitle}`);
      }
      console.log(`    통합 점수: ${result.combinedScore.toFixed(4)}`);
      console.log(`    - 벡터: ${result.vectorScore.toFixed(4)}`);
      console.log(`    - 키워드: ${result.keywordScore.toFixed(4)}`);
      console.log(`    내용: ${result.content.substring(0, 100)}...`);
      console.log('');
    });

    // 3. 검색 메타데이터
    const metadata = getSearchMetadata(results);
    console.log('검색 메타데이터:');
    console.log(`- 총 결과: ${metadata.totalResults}`);
    console.log(`- 관련 매뉴얼 수: ${metadata.uniqueManuals}`);
    console.log(`- 평균 점수: ${metadata.avgCombinedScore.toFixed(4)}`);
    if (metadata.topManual) {
      console.log(`- 주요 매뉴얼: ${metadata.topManual.title} (${metadata.topManual.count}개 청크)`);
    }
    console.log('');

    // 4. AI 컨텍스트 포맷팅
    const context = formatSearchResultsAsContext(results, 3);
    console.log('AI 컨텍스트 (상위 3개):\n');
    console.log(context);
  } catch (error) {
    console.error('검색 실패:', error);
  }
}

// =============================================================================
// 예제 4: 특정 매뉴얼 내 검색
// =============================================================================

export async function example4_searchWithinManual(manualId: number) {
  console.log('=== 예제 4: 특정 매뉴얼 내 검색 ===\n');

  const query = '온도 설정';

  try {
    console.log(`매뉴얼 ID: ${manualId}`);
    console.log(`검색어: "${query}"\n`);

    const results = await searchWithinManual(query, manualId, 3);

    if (results.length === 0) {
      console.log('검색 결과가 없습니다.');
      return;
    }

    console.log(`검색 결과 (${results.length}개):\n`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.sectionTitle || '제목 없음'}`);
      console.log(`    점수: ${result.combinedScore.toFixed(4)}`);
      console.log(`    내용: ${result.content.substring(0, 80)}...`);
      console.log('');
    });
  } catch (error) {
    console.error('검색 실패:', error);
  }
}

// =============================================================================
// 예제 5: 전체 재인덱싱
// =============================================================================

export async function example5_reindexAll() {
  console.log('=== 예제 5: 전체 재인덱싱 ===\n');

  try {
    // 1. 인덱싱 전 통계
    console.log('인덱싱 전 상태:');
    const beforeStats = await getChunkIndexStats();
    console.log(`- 전체 매뉴얼: ${beforeStats.totalManuals}`);
    console.log(`- 인덱싱된 매뉴얼: ${beforeStats.manualsWithChunks}`);
    console.log(`- 총 청크: ${beforeStats.totalChunks}`);
    console.log(`- 평균 청크/매뉴얼: ${beforeStats.avgChunksPerManual}\n`);

    // 2. 전체 재인덱싱
    console.log('전체 재인덱싱 시작...');
    console.log('(이 작업은 시간이 걸릴 수 있습니다)\n');

    const result = await reindexAllChunks();

    console.log('재인덱싱 완료:');
    console.log(`- 전체 매뉴얼: ${result.totalManuals}`);
    console.log(`- 성공: ${result.successCount}`);
    console.log(`- 실패: ${result.errorCount}`);
    console.log(`- 총 생성된 청크: ${result.totalChunksCreated}`);

    if (result.errors.length > 0) {
      console.log('\n에러 목록:');
      result.errors.forEach((error) => {
        console.log(`- 매뉴얼 ${error.manualId}: ${error.error}`);
      });
    }

    // 3. 인덱싱 후 통계
    console.log('\n인덱싱 후 상태:');
    const afterStats = await getChunkIndexStats();
    console.log(`- 인덱싱된 매뉴얼: ${afterStats.manualsWithChunks}`);
    console.log(`- 총 청크: ${afterStats.totalChunks}`);
    console.log(`- 평균 청크/매뉴얼: ${afterStats.avgChunksPerManual}`);
  } catch (error) {
    console.error('재인덱싱 실패:', error);
  }
}

// =============================================================================
// 예제 6: 매뉴얼 재인덱싱
// =============================================================================

export async function example6_reindexManual(manualId: number) {
  console.log('=== 예제 6: 매뉴얼 재인덱싱 ===\n');

  try {
    console.log(`매뉴얼 ID ${manualId} 재인덱싱 시작...\n`);

    const result = await reindexManual(manualId);

    console.log('재인덱싱 완료:');
    console.log(`- 삭제된 청크: ${result.deletedChunks}`);
    console.log(`- 생성된 청크: ${result.chunksCreated}`);
    console.log(`- 스킵된 청크: ${result.chunksSkipped}`);
    console.log('\n통계:');
    console.log(`- 총 청크: ${result.stats.totalChunks}`);
    console.log(`- 평균 토큰: ${result.stats.avgTokensPerChunk}`);
    console.log(`- 최소 토큰: ${result.stats.minTokens}`);
    console.log(`- 최대 토큰: ${result.stats.maxTokens}`);
  } catch (error) {
    console.error('재인덱싱 실패:', error);
  }
}

// =============================================================================
// 메인 함수 (모든 예제 실행)
// =============================================================================

export async function runAllExamples() {
  try {
    // 예제 1: 청킹 (DB 필요 없음)
    await example1_chunking();
    console.log('\n' + '='.repeat(80) + '\n');

    // 다음 예제들은 실제 DB와 매뉴얼 ID가 필요합니다
    // 주석을 해제하고 실제 ID를 사용하세요

    // const manualId = 1; // 실제 매뉴얼 ID로 변경

    // await example2_indexing(manualId);
    // console.log('\n' + '='.repeat(80) + '\n');

    // await example3_search();
    // console.log('\n' + '='.repeat(80) + '\n');

    // await example4_searchWithinManual(manualId);
    // console.log('\n' + '='.repeat(80) + '\n');

    // await example5_reindexAll();
    // console.log('\n' + '='.repeat(80) + '\n');

    // await example6_reindexManual(manualId);

    console.log('모든 예제 완료!');
  } catch (error) {
    console.error('예제 실행 중 오류:', error);
  }
}

// 개별 예제를 직접 실행하려면:
// npx tsx lib/ai/phase2-example.ts

if (require.main === module) {
  runAllExamples();
}
