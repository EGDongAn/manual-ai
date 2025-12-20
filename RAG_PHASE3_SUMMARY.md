# RAG System Phase 3 구현 완료

## 구현 내용

### 1. 새로 생성된 파일

#### 핵심 파일
- **`lib/ai/reranker.ts`**: Gemini 기반 검색 결과 재순위화
- **`lib/ai/metrics.ts`**: 검색 성능 메트릭 수집 및 분석
- **`lib/ai/cache.ts`**: SHA256 해시 기반 쿼리 결과 캐싱
- **`lib/ai/rag-pipeline.ts`**: 통합 RAG 파이프라인
- **`lib/ai/prompts.ts`** (수정): Chain-of-Thought 및 할루시네이션 방지 프롬프트 추가

#### 데이터베이스
- **`prisma/migrations/add_rag_phase3_tables.sql`**: 메트릭 및 캐시 테이블 생성 SQL

#### 문서 및 예시
- **`lib/ai/README_PHASE3.md`**: Phase 3 기능 상세 문서
- **`lib/ai/examples/rag-phase3-example.ts`**: 사용 예시 7가지
- **`scripts/migrate-phase3.ts`**: 마이그레이션 스크립트

### 2. 설치된 패키지
- `uuid`: 검색 쿼리 고유 ID 생성
- `@types/uuid`: TypeScript 타입 정의

---

## 주요 기능

### 🎯 Reranking (재순위화)

벡터 검색 결과를 Gemini LLM으로 재평가하여 의미적 관련성이 높은 청크를 상위에 배치합니다.

**특징:**
- 4가지 평가 기준: 의미적 관련성(40%), 정보 완전성(30%), 정확성(20%), 실용성(10%)
- 0.0~1.0 사이 점수로 정량화
- 폴백 메커니즘: 실패 시 원본 순서 유지

**사용법:**
```typescript
import { rerankChunks } from '@/lib/ai/reranker';

const reranked = await rerankChunks(query, chunks, topK);
// => [{ chunkId, relevanceScore, reasoning }, ...]
```

---

### 📊 Metrics (메트릭)

RAG 파이프라인의 각 단계별 성능을 추적하고 분석합니다.

**수집 데이터:**
- 단계별 소요 시간 (벡터 검색, 재순위화, LLM 생성)
- 청크 개수 (검색 전후)
- 답변 신뢰도
- 사용자 피드백

**사용법:**
```typescript
import { getMetricsSummary, recordUserFeedback } from '@/lib/ai/metrics';

// 최근 7일 통계
const summary = await getMetricsSummary(7);
console.log(summary.avgTotalTime); // 평균 응답 시간

// 사용자 피드백
await recordUserFeedback(queryId, 'helpful');
```

---

### 💾 Cache (캐싱)

동일한 쿼리에 대한 즉시 응답으로 성능을 향상시킵니다.

**특징:**
- SHA256 해시 기반 키 생성
- 1시간 기본 TTL (설정 가능)
- 히트 카운트 추적으로 인기 검색어 파악
- 자동 만료 처리

**사용법:**
```typescript
import { getCachedResult, setCachedResult, getCacheStats } from '@/lib/ai/cache';

// 캐시 조회
const cached = await getCachedResult<SearchResult>(query);

// 캐시 저장
await setCachedResult(query, result, 3600);

// 캐시 통계
const stats = await getCacheStats();
```

---

### 🧠 Enhanced Prompts (강화된 프롬프트)

**Chain-of-Thought (CoT):**
- 4단계 사고 과정: 질문 이해 → 매뉴얼 분석 → 정보 종합 → 답변 구성
- 추론 과정 명시적 출력

**할루시네이션 방지:**
- 매뉴얼 기반 답변 강제
- 외부 지식 사용 금지
- 불확실한 경우 명시적 표시
- 검증 체크리스트 제공

**사용법:**
```typescript
import {
  getEnhancedSearchQAPrompt,
  getGroundedChatSystemPrompt
} from '@/lib/ai/prompts';

// CoT 프롬프트
const prompt = getEnhancedSearchQAPrompt(query, manuals);

// 할루시네이션 방지 시스템 프롬프트
const systemPrompt = getGroundedChatSystemPrompt(manuals, categories);
```

---

### 🔄 Unified Pipeline (통합 파이프라인)

모든 기능을 하나의 파이프라인으로 통합하여 간편하게 사용할 수 있습니다.

**실행 흐름:**
1. 캐시 확인
2. Hybrid Search (Vector + Keyword)
3. Reranking (Gemini)
4. LLM 생성
5. 메트릭 기록
6. 캐시 저장

**사용법:**
```typescript
import {
  executeRAGPipeline,
  quickRAGSearch,
  premiumRAGSearch
} from '@/lib/ai/rag-pipeline';

// 기본 검색 (모든 기능 활성화)
const result = await executeRAGPipeline(query);

// 빠른 검색 (재순위화 비활성화)
const quick = await quickRAGSearch(query);

// 고품질 검색 (더 많은 청크 검색)
const premium = await premiumRAGSearch(query);
```

**설정 옵션:**
```typescript
const result = await executeRAGPipeline(query, {
  hybridSearchLimit: 20,      // 하이브리드 검색 결과 수
  rerankTopK: 8,              // 재순위화 후 선택할 상위 결과 수
  enableCache: true,          // 캐시 활성화
  enableRerank: true,         // 재순위화 활성화
  enableMetrics: true,        // 메트릭 기록 활성화
  cacheTTL: 7200              // 캐시 TTL (초)
});
```

---

## 데이터베이스 설정

### 마이그레이션 실행

**방법 1: SQL 파일 직접 실행**
```bash
psql $DATABASE_URL -f prisma/migrations/add_rag_phase3_tables.sql
```

**방법 2: 마이그레이션 스크립트**
```bash
npx tsx scripts/migrate-phase3.ts
```

### 생성된 테이블

**search_metrics**
```sql
CREATE TABLE search_metrics (
  query_id VARCHAR(36) PRIMARY KEY,
  query TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  vector_search_time REAL NOT NULL,
  rerank_time REAL NOT NULL,
  llm_time REAL NOT NULL,
  total_time REAL NOT NULL,
  chunks_retrieved INTEGER NOT NULL,
  chunks_after_rerank INTEGER NOT NULL,
  confidence REAL NOT NULL,
  user_feedback VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**search_cache**
```sql
CREATE TABLE search_cache (
  query_hash VARCHAR(64) PRIMARY KEY,
  query TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_accessed_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0
);
```

---

## 사용 예시

### 예시 1: 기본 검색
```typescript
import { executeRAGPipeline } from '@/lib/ai/rag-pipeline';

const result = await executeRAGPipeline('환자 접수 절차는 어떻게 되나요?');

console.log(result.response.answer);        // LLM 생성 답변
console.log(result.response.confidence);    // 신뢰도 (0-1)
console.log(result.metrics.totalTime);      // 전체 소요 시간 (ms)
console.log(result.metrics.cacheHit);       // 캐시 히트 여부
```

### 예시 2: 메트릭 분석
```typescript
import { getMetricsSummary } from '@/lib/ai/metrics';

const summary = await getMetricsSummary(7); // 최근 7일

console.log('총 검색 수:', summary.totalSearches);
console.log('평균 응답 시간:', summary.avgTotalTime, 'ms');
console.log('유용 비율:', summary.helpfulRate * 100, '%');
console.log('상위 검색어:', summary.topQueries);
```

### 예시 3: 캐시 관리
```typescript
import { getCacheStats, cleanupExpiredCache } from '@/lib/ai/cache';

// 캐시 통계
const stats = await getCacheStats();
console.log('캐시 히트 수:', stats.totalHits);
console.log('캐시 크기:', stats.cacheSize / 1024, 'KB');

// 만료된 캐시 정리
const deletedCount = await cleanupExpiredCache();
console.log('삭제된 캐시:', deletedCount);
```

### 예시 4: 사용자 피드백
```typescript
import { recordUserFeedback } from '@/lib/ai/metrics';

const result = await executeRAGPipeline(query);

// 답변이 유용했다면
if (userSatisfied) {
  await recordUserFeedback(result.queryId, 'helpful');
}
```

---

## 성능 최적화 전략

### 1. 캐시 전략
- **히트율 목표**: 30% 이상
- **TTL 조정**: 빈번한 검색어는 긴 TTL (2시간~)
- **정기 정리**: 만료된 캐시 자동 삭제 (cron job)

### 2. 재순위화 전략
- **빠른 응답 필요 시**: `enableRerank: false`
- **고품질 필요 시**: `rerankTopK` 증가
- **비용 절감**: 재순위화는 LLM 호출이므로 선택적 사용

### 3. 메트릭 활용
- **병목 지점 파악**: 각 단계 시간 분석
- **품질 개선**: 낮은 confidence 패턴 분석
- **A/B 테스트**: 다양한 설정 비교

---

## 향후 개선 방향 (Phase 4 제안)

1. **실시간 스트리밍**
   - LLM 응답을 스트리밍으로 제공
   - 사용자 경험 개선

2. **멀티모달 지원**
   - 이미지, PDF 검색
   - 테이블 데이터 추출

3. **개인화**
   - 사용자별 검색 패턴 학습
   - 맞춤형 결과 제공

4. **자동 A/B 테스트**
   - 다양한 설정 자동 비교
   - 최적 설정 자동 선택

5. **모니터링 대시보드**
   - 실시간 메트릭 시각화
   - 알림 및 경고

---

## 참고사항

### 비용 고려사항
- **Gemini API 비용**: 재순위화는 LLM 호출이므로 비용 발생
- **캐시 활용**: 캐시 히트율을 높여 API 호출 최소화
- **선택적 재순위화**: 필요한 경우에만 활성화

### 성능 모니터링
- **평균 응답 시간**: 목표 < 2000ms
- **캐시 히트율**: 목표 > 30%
- **신뢰도**: 목표 > 0.8
- **유용 비율**: 목표 > 70%

### 유지보수
- **메트릭 정리**: 90일 이상 된 메트릭 삭제 권장
- **캐시 모니터링**: 캐시 크기 및 히트율 주기적 확인
- **인덱스 최적화**: 쿼리 성능 모니터링 및 인덱스 조정

---

## 완료 체크리스트

- [x] Reranker 구현 (`lib/ai/reranker.ts`)
- [x] Metrics 시스템 구현 (`lib/ai/metrics.ts`)
- [x] Cache 시스템 구현 (`lib/ai/cache.ts`)
- [x] Enhanced Prompts 추가 (`lib/ai/prompts.ts`)
- [x] Unified Pipeline 구현 (`lib/ai/rag-pipeline.ts`)
- [x] 데이터베이스 마이그레이션 파일 생성
- [x] 마이그레이션 스크립트 생성
- [x] 문서 작성 (README_PHASE3.md)
- [x] 사용 예시 작성 (7가지)
- [x] uuid 패키지 설치

---

## 다음 단계

1. **마이그레이션 실행**
   ```bash
   npx tsx scripts/migrate-phase3.ts
   ```

2. **테스트**
   - 기본 검색 테스트
   - 캐시 동작 확인
   - 메트릭 수집 확인

3. **통합**
   - API 라우트에 RAG 파이프라인 적용
   - 기존 검색 엔드포인트 업그레이드

4. **모니터링**
   - 메트릭 대시보드 구축
   - 성능 지표 추적
   - 사용자 피드백 수집

---

**구현 완료일**: 2025-12-20
**구현자**: Claude Code
**버전**: Phase 3
