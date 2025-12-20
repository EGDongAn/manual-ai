# RAG System Phase 2 - 사용 가이드

## 개요

RAG (Retrieval-Augmented Generation) System Phase 2는 청킹(chunking) 시스템과 하이브리드 검색을 통해 더 정확하고 효율적인 매뉴얼 검색을 제공합니다.

### 주요 기능

1. **문서 청킹 (Chunking)**: 긴 매뉴얼을 의미적 경계에 따라 작은 청크로 분할
2. **임베딩 생성**: 각 청크에 대한 벡터 임베딩 생성
3. **하이브리드 검색**: 벡터 검색과 키워드 검색을 RRF로 결합

## 설치 및 설정

### 1. 데이터베이스 마이그레이션

```bash
# Prisma 스키마 푸시
npx prisma db push

# 또는 마이그레이션 SQL 실행
psql -U your_user -d your_database -f prisma/migrations/add_chunking_fields.sql
```

### 2. pgvector 확장 설치 (필요한 경우)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 사용 예제

### 1. 매뉴얼 청킹 및 인덱싱

```typescript
import { indexManualChunks, reindexManual } from '@/lib/ai/chunk-indexer';

// 새 매뉴얼 인덱싱
const result = await indexManualChunks(
  manualId,
  "매뉴얼 제목",
  "매뉴얼 내용..."
);

console.log(`생성된 청크: ${result.chunksCreated}개`);
console.log(`평균 토큰 수: ${result.stats.avgTokensPerChunk}`);

// 기존 매뉴얼 재인덱싱
const reindexResult = await reindexManual(manualId);
console.log(`삭제된 청크: ${reindexResult.deletedChunks}개`);
console.log(`새로 생성된 청크: ${reindexResult.chunksCreated}개`);
```

### 2. 하이브리드 검색

```typescript
import {
  hybridSearch,
  searchWithinManual,
  formatSearchResultsAsContext,
  getSearchMetadata
} from '@/lib/ai/hybrid-search';

// 전체 매뉴얼 검색
const results = await hybridSearch("냉장고 온도 설정 방법", 5);

results.forEach(result => {
  console.log(`[${result.manualTitle}] ${result.sectionTitle || ''}`);
  console.log(`통합 점수: ${result.combinedScore.toFixed(3)}`);
  console.log(`내용: ${result.content.substring(0, 100)}...`);
});

// 특정 매뉴얼 내 검색
const manualResults = await searchWithinManual(
  "온도 설정",
  123, // manualId
  3
);

// AI 컨텍스트로 포맷팅
const context = formatSearchResultsAsContext(results, 5);
console.log(context);

// 검색 메타데이터
const metadata = getSearchMetadata(results);
console.log(`총 결과: ${metadata.totalResults}`);
console.log(`관련 매뉴얼 수: ${metadata.uniqueManuals}`);
console.log(`주요 매뉴얼: ${metadata.topManual?.title}`);
```

### 3. 전체 재인덱싱

```typescript
import { reindexAllChunks, getChunkIndexStats } from '@/lib/ai/chunk-indexer';

// 모든 PUBLISHED 매뉴얼 재인덱싱
const result = await reindexAllChunks();

console.log(`전체 매뉴얼: ${result.totalManuals}개`);
console.log(`성공: ${result.successCount}개`);
console.log(`실패: ${result.errorCount}개`);
console.log(`총 청크: ${result.totalChunksCreated}개`);

if (result.errors.length > 0) {
  console.log("에러 목록:");
  result.errors.forEach(error => {
    console.log(`- 매뉴얼 ${error.manualId}: ${error.error}`);
  });
}

// 인덱스 통계
const stats = await getChunkIndexStats();
console.log(`인덱싱된 매뉴얼: ${stats.manualsWithChunks}/${stats.totalManuals}`);
console.log(`평균 청크 수: ${stats.avgChunksPerManual}`);
```

### 4. 청크 목록 조회

```typescript
import { getManualChunks } from '@/lib/ai/chunk-indexer';

const chunks = await getManualChunks(manualId);

chunks.forEach(chunk => {
  console.log(`청크 ${chunk.chunkIndex}: ${chunk.sectionTitle || '제목 없음'}`);
  console.log(`토큰 수: ${chunk.tokenCount}`);
  console.log(`위치: ${chunk.startOffset} - ${chunk.endOffset}`);
});
```

### 5. API 라우트 통합 예제

```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { hybridSearch, formatSearchResultsAsContext } from '@/lib/ai/hybrid-search';

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5, manualIds } = await request.json();

    // 하이브리드 검색 수행
    const results = await hybridSearch(query, limit, manualIds);

    // AI 컨텍스트 생성
    const context = formatSearchResultsAsContext(results, limit);

    return NextResponse.json({
      success: true,
      results,
      context,
      metadata: {
        count: results.length,
        query
      }
    });
  } catch (error) {
    console.error('검색 오류:', error);
    return NextResponse.json(
      { success: false, error: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/manuals/[id]/index/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { reindexManual } from '@/lib/ai/chunk-indexer';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const manualId = parseInt(params.id);

    // 매뉴얼 재인덱싱
    const result = await reindexManual(manualId);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('인덱싱 오류:', error);
    return NextResponse.json(
      { success: false, error: '인덱싱 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

## 설정 값

### 청킹 설정 (`lib/ai/chunking.ts`)

```typescript
export const CHUNK_SIZE = 500;     // 청크당 토큰 수
export const CHUNK_OVERLAP = 50;   // 청크 간 오버랩 토큰 수
```

### 검색 가중치 설정 (`lib/ai/hybrid-search.ts`)

```typescript
const VECTOR_WEIGHT = 0.7;    // 벡터 검색 가중치
const KEYWORD_WEIGHT = 0.3;   // 키워드 검색 가중치
const RRF_K = 60;             // RRF 순위 보정 상수
```

## 성능 최적화

### 1. 레이트 리밋 설정

```typescript
// chunk-indexer.ts 에서 딜레이 조정
await new Promise(resolve => setTimeout(resolve, 100)); // 청크 간 100ms
await new Promise(resolve => setTimeout(resolve, 200)); // 매뉴얼 간 200ms
```

### 2. 벡터 인덱스 최적화

```sql
-- IVFFlat 인덱스의 lists 파라미터 조정
-- lists = 총 청크 수 / 1000 (권장)
CREATE INDEX idx_manual_chunks_embedding_vector
ON manual_chunks USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);
```

### 3. 배치 인덱싱

대량의 매뉴얼을 인덱싱할 때는 배치 단위로 처리:

```typescript
const manualIds = [1, 2, 3, 4, 5, ...];
const batchSize = 10;

for (let i = 0; i < manualIds.length; i += batchSize) {
  const batch = manualIds.slice(i, i + batchSize);

  await Promise.all(
    batch.map(id => reindexManual(id).catch(err => {
      console.error(`매뉴얼 ${id} 실패:`, err);
    }))
  );

  // 배치 간 휴식
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## 문제 해결

### 1. 토큰 수 추정이 부정확한 경우

`estimateTokens` 함수의 비율 조정:

```typescript
const koreanTokens = koreanChars / 1.5;  // 한글 비율 조정
const englishTokens = englishChars / 4;  // 영어 비율 조정
```

### 2. 검색 결과가 부족한 경우

검색 가중치와 RRF 파라미터 조정:

```typescript
const VECTOR_WEIGHT = 0.8;   // 벡터 검색 비중 증가
const KEYWORD_WEIGHT = 0.2;
const RRF_K = 40;            // K 값 감소로 상위 순위 강조
```

### 3. 청킹이 의미적 경계를 놓치는 경우

`detectSectionHeaders` 함수에 추가 패턴 등록:

```typescript
// 사용자 정의 헤더 패턴 추가
if (trimmed.startsWith('【') && trimmed.endsWith('】')) {
  headers.push({ title: trimmed, position: currentPos });
}
```

## 모니터링

### 인덱스 상태 확인

```typescript
import { getChunkIndexStats } from '@/lib/ai/chunk-indexer';

const stats = await getChunkIndexStats();
console.log('인덱스 상태:', stats);

// 인덱싱되지 않은 매뉴얼 확인
if (stats.manualsWithoutChunks > 0) {
  console.warn(`${stats.manualsWithoutChunks}개 매뉴얼이 인덱싱되지 않았습니다.`);
}
```

### 청킹 품질 확인

```typescript
import { chunkDocument, calculateChunkingStats } from '@/lib/ai/chunking';

const chunks = chunkDocument(content, title);
const stats = calculateChunkingStats(chunks);

console.log('청킹 통계:', {
  totalChunks: stats.totalChunks,
  avgTokens: stats.avgTokensPerChunk,
  minTokens: stats.minTokens,
  maxTokens: stats.maxTokens
});
```

## 다음 단계

Phase 3에서는 다음 기능들이 추가될 예정입니다:

1. **RAG 파이프라인 통합**: 검색 결과를 AI 모델과 통합
2. **스트리밍 응답**: 실시간 응답 생성
3. **컨텍스트 윈도우 최적화**: 청크 선택 알고리즘 개선
4. **캐싱 시스템**: 자주 검색되는 쿼리 캐싱
5. **피드백 루프**: 검색 품질 개선을 위한 사용자 피드백 수집
