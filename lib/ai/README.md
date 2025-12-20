# AI Library - RAG System

매뉴얼 관리 시스템을 위한 AI 기능 라이브러리입니다.

## 주요 기능

### Phase 1: 기본 임베딩 및 벡터 검색
- ✅ Gemini API 통합 (`gemini.ts`)
- ✅ 매뉴얼 임베딩 생성 (`embeddings.ts`)
- ✅ 벡터 유사도 검색 (`vector-search.ts`)
- ✅ AI 프롬프트 템플릿 (`prompts.ts`)

### Phase 2: 청킹 및 하이브리드 검색
- ✅ 문서 청킹 시스템 (`chunking.ts`)
- ✅ 청크 인덱싱 (`chunk-indexer.ts`)
- ✅ 하이브리드 검색 (벡터 + 키워드) (`hybrid-search.ts`)

### Phase 3: RAG 파이프라인 (예정)
- ⏳ 검색 결과 기반 AI 응답 생성
- ⏳ 스트리밍 응답
- ⏳ 컨텍스트 윈도우 최적화
- ⏳ 검색 품질 피드백

## 파일 구조

```
lib/ai/
├── types.ts              # TypeScript 타입 정의
├── gemini.ts             # Gemini API 클라이언트
├── embeddings.ts         # 임베딩 생성 및 저장
├── vector-search.ts      # 벡터 유사도 검색
├── prompts.ts            # AI 프롬프트 템플릿
├── chunking.ts           # 문서 청킹 로직
├── chunk-indexer.ts      # 청크 인덱싱 시스템
├── hybrid-search.ts      # 하이브리드 검색
├── index.ts              # 통합 export
├── README.md             # 이 파일
└── USAGE_GUIDE.md        # 상세 사용 가이드
```

## 빠른 시작

### 1. 환경 설정

```bash
# 환경 변수 설정 (.env.local)
GEMINI_API_KEY=your_api_key_here
DATABASE_URL=postgresql://...
```

### 2. 데이터베이스 마이그레이션

```bash
npx prisma db push
```

### 3. 매뉴얼 인덱싱

```typescript
import { indexManualChunks } from '@/lib/ai';

// 새 매뉴얼 인덱싱
await indexManualChunks(manualId, title, content);
```

### 4. 검색

```typescript
import { hybridSearch } from '@/lib/ai';

// 하이브리드 검색
const results = await hybridSearch("검색어", 5);
```

## 주요 함수

### 청킹 (`chunking.ts`)

```typescript
// 문서를 청크로 분할
const chunks = chunkDocument(content, title);

// 토큰 수 추정
const tokens = estimateTokens(text);

// 청킹 통계
const stats = calculateChunkingStats(chunks);
```

### 인덱싱 (`chunk-indexer.ts`)

```typescript
// 매뉴얼 인덱싱
await indexManualChunks(manualId, title, content);

// 재인덱싱
await reindexManual(manualId);

// 전체 재인덱싱
await reindexAllChunks();

// 인덱스 통계
const stats = await getChunkIndexStats();
```

### 검색 (`hybrid-search.ts`)

```typescript
// 하이브리드 검색
const results = await hybridSearch(query, limit, manualIds);

// 특정 매뉴얼 내 검색
const results = await searchWithinManual(query, manualId, limit);

// AI 컨텍스트 포맷팅
const context = formatSearchResultsAsContext(results, maxChunks);

// 검색 메타데이터
const metadata = getSearchMetadata(results);
```

### 임베딩 (`embeddings.ts`)

```typescript
// 매뉴얼 임베딩 생성
await createManualEmbedding(manualId, title, content, summary);

// 전체 재인덱싱
await reindexAllManuals();
```

### 벡터 검색 (`vector-search.ts`)

```typescript
// 유사 매뉴얼 검색
const similar = await searchSimilarManuals(query, limit);

// 매뉴얼 기반 유사 검색
const similar = await findSimilarManualsByManualId(manualId, limit);

// 중복 감지
const duplicates = await findPotentialDuplicates(title, content, threshold);
```

## 설정

### 청킹 설정 (`chunking.ts`)

```typescript
export const CHUNK_SIZE = 500;      // 청크당 토큰 수
export const CHUNK_OVERLAP = 50;    // 청크 간 오버랩
```

### 검색 가중치 (`hybrid-search.ts`)

```typescript
const VECTOR_WEIGHT = 0.7;    // 벡터 검색 가중치
const KEYWORD_WEIGHT = 0.3;   // 키워드 검색 가중치
const RRF_K = 60;             // RRF 순위 보정 상수
```

## 성능 고려사항

### 레이트 리밋
- Gemini API: 60 requests/min (기본)
- 청크 인덱싱: 100ms/청크 딜레이
- 매뉴얼 인덱싱: 200ms/매뉴얼 딜레이

### 메모리
- 청크당 임베딩: ~3KB (768차원 Float32)
- 평균 청크 수: 매뉴얼당 5-20개

### 응답 시간
- 임베딩 생성: ~200-500ms
- 벡터 검색: ~10-50ms
- 키워드 검색: ~5-20ms
- 하이브리드 검색: ~20-100ms

## 트러블슈팅

### 검색 결과가 없는 경우

```typescript
// 인덱스 상태 확인
const stats = await getChunkIndexStats();
console.log(stats);

// 청크 목록 확인
const chunks = await getManualChunks(manualId);
console.log(chunks);
```

### 청킹 품질 확인

```typescript
const chunks = chunkDocument(content, title);
const stats = calculateChunkingStats(chunks);

console.log({
  totalChunks: stats.totalChunks,
  avgTokens: stats.avgTokensPerChunk,
  minTokens: stats.minTokens,
  maxTokens: stats.maxTokens
});
```

### 인덱싱 오류

```typescript
const result = await reindexAllChunks();

if (result.errors.length > 0) {
  result.errors.forEach(error => {
    console.log(`매뉴얼 ${error.manualId}: ${error.error}`);
  });
}
```

## 더 알아보기

- [상세 사용 가이드](./USAGE_GUIDE.md)
- [프로젝트 요약](../../RAG_PHASE2_SUMMARY.md)
- [Prisma 스키마](../../prisma/schema.prisma)

## 라이선스

이 프로젝트는 내부 사용을 위한 것입니다.
