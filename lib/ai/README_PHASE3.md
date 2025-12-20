# RAG System Phase 3: Advanced Features

RAG 시스템 Phase 3 구현 완료 - Reranking, Metrics, Caching, Enhanced Prompts

## 새로운 기능

### 1. Reranking (`lib/ai/reranker.ts`)
- **Gemini 기반 재순위화**: 벡터 검색 결과를 LLM을 통해 재평가
- **의미적 관련성 평가**: 쿼리 의도와의 정확한 매칭
- **폴백 메커니즘**: 재순위화 실패 시 원본 순서 유지

```typescript
import { rerankChunks } from './reranker';

const reranked = await rerankChunks(query, chunks, topK);
// => [{ chunkId, relevanceScore, reasoning }, ...]
```

### 2. Metrics (`lib/ai/metrics.ts`)
- **성능 메트릭 추적**: 각 단계별 소요 시간 기록
- **사용자 피드백**: 검색 결과 유용성 평가
- **통계 분석**: 일별/주별 성능 트렌드 분석

```typescript
import { recordSearchMetrics, getMetricsSummary } from './metrics';

// 메트릭 기록
await recordSearchMetrics({
  queryId,
  query,
  vectorSearchTime,
  rerankTime,
  llmTime,
  // ...
});

// 통계 조회 (최근 7일)
const summary = await getMetricsSummary(7);
console.log(summary.avgTotalTime); // 평균 응답 시간
```

### 3. Cache (`lib/ai/cache.ts`)
- **SHA256 해시 기반**: 쿼리 문자열을 해시하여 저장
- **TTL 관리**: 1시간 기본 TTL, 자동 만료 처리
- **히트 카운트**: 인기 검색어 추적

```typescript
import { getCachedResult, setCachedResult } from './cache';

// 캐시 조회
const cached = await getCachedResult<SearchResult>(query);

// 캐시 저장 (3600초 TTL)
await setCachedResult(query, result, 3600);
```

### 4. Enhanced Prompts (`lib/ai/prompts.ts`)
- **Chain-of-Thought**: 단계별 사고 과정 명시
- **할루시네이션 방지**: 매뉴얼 기반 답변 강제
- **검증 체크리스트**: 답변 품질 자동 검증

```typescript
import { getEnhancedSearchQAPrompt, getGroundedChatSystemPrompt } from './prompts';

// CoT 프롬프트
const prompt = getEnhancedSearchQAPrompt(query, manuals);

// 할루시네이션 방지 프롬프트
const systemPrompt = getGroundedChatSystemPrompt(manuals, categories);
```

### 5. Unified Pipeline (`lib/ai/rag-pipeline.ts`)
- **통합 파이프라인**: 모든 단계를 하나로 통합
- **설정 가능**: 각 기능 활성화/비활성화 가능
- **성능 최적화**: 빠른 검색과 고품질 검색 모드

```typescript
import { executeRAGPipeline, quickRAGSearch, premiumRAGSearch } from './rag-pipeline';

// 기본 검색 (모든 기능 활성화)
const result = await executeRAGPipeline(query);

// 빠른 검색 (재순위화 비활성화)
const quick = await quickRAGSearch(query);

// 고품질 검색 (더 많은 청크 검색)
const premium = await premiumRAGSearch(query);
```

## 설정

### RAGConfig 옵션

```typescript
interface RAGConfig {
  hybridSearchLimit: number;      // 하이브리드 검색 결과 수 (기본: 15)
  rerankTopK: number;             // 재순위화 후 선택할 상위 결과 수 (기본: 5)
  enableCache: boolean;           // 캐시 활성화 (기본: true)
  enableRerank: boolean;          // 재순위화 활성화 (기본: true)
  enableMetrics: boolean;         // 메트릭 기록 활성화 (기본: true)
  cacheTTL?: number;              // 캐시 TTL 초 (기본: 3600)
}
```

### 사용 예시

```typescript
// 커스텀 설정
const result = await executeRAGPipeline(query, {
  hybridSearchLimit: 20,
  rerankTopK: 8,
  enableRerank: true,
  enableCache: true,
  cacheTTL: 7200
});

console.log(result.response.answer);        // LLM 생성 답변
console.log(result.metrics.totalTime);      // 전체 소요 시간
console.log(result.rerankedChunks);         // 재순위화된 청크
```

## 데이터베이스 마이그레이션

테이블 생성:

```bash
psql $DATABASE_URL -f prisma/migrations/add_rag_phase3_tables.sql
```

또는 Node.js에서:

```typescript
import { sql } from '@vercel/postgres';
import fs from 'fs';

const migration = fs.readFileSync('prisma/migrations/add_rag_phase3_tables.sql', 'utf-8');
await sql.query(migration);
```

## 생성된 테이블

### search_metrics
- `query_id`: UUID (Primary Key)
- `query`: 검색 쿼리
- `timestamp`: 검색 시간
- `vector_search_time`: 벡터 검색 시간 (ms)
- `rerank_time`: 재순위화 시간 (ms)
- `llm_time`: LLM 생성 시간 (ms)
- `total_time`: 전체 시간 (ms)
- `chunks_retrieved`: 검색된 청크 수
- `chunks_after_rerank`: 재순위화 후 청크 수
- `confidence`: 답변 신뢰도 (0-1)
- `user_feedback`: 사용자 피드백 ('helpful' | 'not_helpful')

### search_cache
- `query_hash`: SHA256 해시 (Primary Key)
- `query`: 원본 쿼리
- `result`: 검색 결과 (JSONB)
- `created_at`: 생성 시간
- `expires_at`: 만료 시간
- `last_accessed_at`: 마지막 접근 시간
- `hit_count`: 히트 횟수

## 성능 최적화

### 캐시 전략
1. **1시간 TTL**: 빈번한 검색어는 캐시에서 즉시 반환
2. **히트 카운트**: 인기 검색어 추적 및 최적화
3. **자동 정리**: 만료된 캐시 자동 삭제

### 재순위화 전략
1. **선택적 활성화**: 빠른 응답이 필요한 경우 비활성화
2. **배치 크기 조정**: hybridSearchLimit와 rerankTopK 조정
3. **폴백 메커니즘**: 실패 시 원본 순서 유지

### 메트릭 활용
1. **병목 지점 파악**: 각 단계별 시간 분석
2. **품질 개선**: 신뢰도와 피드백 기반 최적화
3. **A/B 테스트**: 다양한 설정의 성능 비교

## 다음 단계 (Phase 4 제안)

1. **실시간 스트리밍**: LLM 응답 스트리밍
2. **멀티모달**: 이미지/PDF 검색 지원
3. **개인화**: 사용자별 검색 최적화
4. **A/B 테스트**: 자동화된 성능 비교
5. **모니터링 대시보드**: 실시간 메트릭 시각화

## 참고사항

- **Gemini API 레이트 리밋**: 재순위화는 LLM 호출이므로 비용 고려
- **캐시 저장 공간**: JSONB 컬럼 크기 모니터링 필요
- **메트릭 정리**: 주기적으로 오래된 메트릭 삭제 권장 (cleanupOldMetrics 함수 사용)
