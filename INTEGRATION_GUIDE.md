# RAG Phase 3 통합 가이드

기존 애플리케이션에 RAG Phase 3를 통합하는 방법을 단계별로 안내합니다.

## 1. 데이터베이스 마이그레이션

### 방법 A: 마이그레이션 스크립트 사용 (권장)

```bash
npx tsx scripts/migrate-phase3.ts
```

### 방법 B: SQL 파일 직접 실행

```bash
psql $POSTGRES_URL -f prisma/migrations/add_rag_phase3_tables.sql
```

### 확인

마이그레이션 성공 후 다음 테이블이 생성됩니다:
- `search_metrics`: 검색 성능 메트릭
- `search_cache`: 쿼리 결과 캐시

## 2. 기존 검색 API 업그레이드

### Before: 기존 하이브리드 검색

```typescript
// app/api/search/route.ts (기존)
import { hybridSearch } from '@/lib/ai/hybrid-search';

export async function POST(request: Request) {
  const { query } = await request.json();

  const results = await hybridSearch(query, 10);

  return Response.json({ results });
}
```

### After: RAG 파이프라인 사용

```typescript
// app/api/search/route.ts (업그레이드)
import { executeRAGPipeline } from '@/lib/ai/rag-pipeline';
import { recordUserFeedback } from '@/lib/ai/metrics';

export async function POST(request: Request) {
  const { query } = await request.json();

  // RAG 파이프라인 실행
  const result = await executeRAGPipeline(query, {
    enableCache: true,
    enableRerank: true,
    enableMetrics: true
  });

  return Response.json({
    queryId: result.queryId,
    answer: result.response.answer,
    sources: result.response.sources,
    confidence: result.response.confidence,
    followUpQuestions: result.response.followUpQuestions,
    metrics: {
      totalTime: result.metrics.totalTime,
      cacheHit: result.metrics.cacheHit
    }
  });
}

// 사용자 피드백 엔드포인트 추가
export async function PUT(request: Request) {
  const { queryId, feedback } = await request.json();

  await recordUserFeedback(queryId, feedback);

  return Response.json({ success: true });
}
```

## 3. 프론트엔드 통합

### 검색 결과 표시

```typescript
// components/SearchResults.tsx
'use client';

import { useState } from 'react';

interface SearchResult {
  queryId: string;
  answer: string;
  sources: Array<{
    manualId: number;
    title: string;
    relevance: string;
  }>;
  confidence: number;
  followUpQuestions: string[];
  metrics: {
    totalTime: number;
    cacheHit: boolean;
  };
}

export function SearchResults({ result }: { result: SearchResult }) {
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);

  const handleFeedback = async (type: 'helpful' | 'not_helpful') => {
    await fetch('/api/search', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queryId: result.queryId,
        feedback: type
      })
    });
    setFeedback(type);
  };

  return (
    <div className="space-y-4">
      {/* 답변 */}
      <div className="prose">
        <h3>답변</h3>
        <div dangerouslySetInnerHTML={{ __html: result.answer }} />
      </div>

      {/* 신뢰도 */}
      <div className="flex items-center gap-2">
        <span>신뢰도:</span>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${result.confidence * 100}%` }}
          />
        </div>
        <span>{(result.confidence * 100).toFixed(0)}%</span>
      </div>

      {/* 출처 */}
      <div>
        <h4>출처</h4>
        <ul>
          {result.sources.map((source, i) => (
            <li key={i}>
              <a href={`/manuals/${source.manualId}`}>
                {source.title}
              </a>
              <p className="text-sm text-gray-600">{source.relevance}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* 후속 질문 */}
      {result.followUpQuestions.length > 0 && (
        <div>
          <h4>관련 질문</h4>
          <ul>
            {result.followUpQuestions.map((q, i) => (
              <li key={i}>
                <button onClick={() => window.location.search = `?q=${q}`}>
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 메트릭 (개발 모드에서만) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-sm text-gray-500">
          <p>응답 시간: {result.metrics.totalTime}ms</p>
          <p>캐시 사용: {result.metrics.cacheHit ? '예' : '아니오'}</p>
        </div>
      )}

      {/* 피드백 */}
      <div className="flex gap-2">
        <span>이 답변이 도움이 되었나요?</span>
        <button
          onClick={() => handleFeedback('helpful')}
          disabled={feedback !== null}
          className={feedback === 'helpful' ? 'text-green-600' : ''}
        >
          👍 도움됨
        </button>
        <button
          onClick={() => handleFeedback('not_helpful')}
          disabled={feedback !== null}
          className={feedback === 'not_helpful' ? 'text-red-600' : ''}
        >
          👎 도움안됨
        </button>
      </div>
    </div>
  );
}
```

## 4. 관리자 대시보드 (선택사항)

### 메트릭 대시보드

```typescript
// app/admin/metrics/page.tsx
import { getMetricsSummary } from '@/lib/ai/metrics';
import { getCacheStats } from '@/lib/ai/cache';

export default async function MetricsPage() {
  const [metrics, cacheStats] = await Promise.all([
    getMetricsSummary(7),
    getCacheStats()
  ]);

  return (
    <div className="space-y-8">
      <h1>검색 성능 대시보드</h1>

      {/* 전체 통계 */}
      <section>
        <h2>전체 통계 (최근 7일)</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="stat-card">
            <h3>총 검색 수</h3>
            <p className="text-3xl">{metrics.totalSearches}</p>
          </div>
          <div className="stat-card">
            <h3>평균 응답 시간</h3>
            <p className="text-3xl">{metrics.avgTotalTime.toFixed(0)}ms</p>
          </div>
          <div className="stat-card">
            <h3>평균 신뢰도</h3>
            <p className="text-3xl">{(metrics.avgConfidence * 100).toFixed(0)}%</p>
          </div>
          <div className="stat-card">
            <h3>유용 비율</h3>
            <p className="text-3xl">{(metrics.helpfulRate * 100).toFixed(0)}%</p>
          </div>
        </div>
      </section>

      {/* 캐시 통계 */}
      <section>
        <h2>캐시 통계</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <h3>총 캐시 항목</h3>
            <p className="text-3xl">{cacheStats.totalEntries}</p>
          </div>
          <div className="stat-card">
            <h3>총 히트 수</h3>
            <p className="text-3xl">{cacheStats.totalHits}</p>
          </div>
          <div className="stat-card">
            <h3>평균 히트 수</h3>
            <p className="text-3xl">{cacheStats.avgHitCount.toFixed(1)}</p>
          </div>
        </div>
      </section>

      {/* 상위 검색어 */}
      <section>
        <h2>상위 검색어</h2>
        <table>
          <thead>
            <tr>
              <th>순위</th>
              <th>검색어</th>
              <th>검색 횟수</th>
            </tr>
          </thead>
          <tbody>
            {metrics.topQueries.map((q, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{q.query}</td>
                <td>{q.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 느린 검색어 */}
      <section>
        <h2>느린 검색어</h2>
        <table>
          <thead>
            <tr>
              <th>검색어</th>
              <th>소요 시간</th>
              <th>시간</th>
            </tr>
          </thead>
          <tbody>
            {metrics.slowestQueries.map((q, i) => (
              <tr key={i}>
                <td>{q.query}</td>
                <td>{q.totalTime.toFixed(0)}ms</td>
                <td>{q.timestamp.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

## 5. 정기 유지보수

### Cron Job 설정

```typescript
// app/api/cron/cleanup/route.ts
import { cleanupExpiredCache } from '@/lib/ai/cache';
import { cleanupOldMetrics } from '@/lib/ai/metrics';

export async function GET() {
  try {
    // 만료된 캐시 정리
    const deletedCache = await cleanupExpiredCache();

    // 90일 이상 된 메트릭 정리
    const deletedMetrics = await cleanupOldMetrics(90);

    return Response.json({
      success: true,
      deletedCache,
      deletedMetrics
    });
  } catch (error) {
    console.error('Cleanup failed:', error);
    return Response.json({ success: false }, { status: 500 });
  }
}
```

### Vercel Cron 설정

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## 6. 환경 변수 확인

기존 환경 변수가 설정되어 있는지 확인:

```bash
# .env.local
GEMINI_API_KEY=your_gemini_api_key
POSTGRES_URL=your_postgres_connection_string
```

## 7. 테스트

### 기본 테스트

```bash
# 마이그레이션 확인
npx tsx scripts/migrate-phase3.ts

# 예시 실행
npx tsx lib/ai/examples/rag-phase3-example.ts
```

### API 테스트

```bash
# 검색 테스트
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"환자 접수 절차"}'

# 피드백 테스트
curl -X PUT http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"queryId":"uuid-here","feedback":"helpful"}'
```

## 8. 모니터링

### 주요 지표

- **평균 응답 시간**: < 2000ms
- **캐시 히트율**: > 30%
- **신뢰도**: > 0.8
- **유용 비율**: > 70%

### 알림 설정

```typescript
// lib/monitoring/alerts.ts
import { getMetricsSummary } from '@/lib/ai/metrics';

export async function checkPerformance() {
  const metrics = await getMetricsSummary(1); // 최근 1일

  const alerts = [];

  if (metrics.avgTotalTime > 2000) {
    alerts.push('⚠️ 평균 응답 시간이 2초를 초과했습니다.');
  }

  if (metrics.avgConfidence < 0.7) {
    alerts.push('⚠️ 평균 신뢰도가 낮습니다.');
  }

  if (metrics.helpfulRate < 0.6) {
    alerts.push('⚠️ 사용자 만족도가 낮습니다.');
  }

  return alerts;
}
```

## 9. 문제 해결

### 캐시가 작동하지 않음

```typescript
// 캐시 테이블 확인
import { sql } from '@vercel/postgres';

const { rows } = await sql`SELECT COUNT(*) FROM search_cache`;
console.log('캐시 항목 수:', rows[0].count);
```

### 메트릭이 기록되지 않음

```typescript
// 메트릭 테이블 확인
import { sql } from '@vercel/postgres';

const { rows } = await sql`SELECT COUNT(*) FROM search_metrics`;
console.log('메트릭 항목 수:', rows[0].count);
```

### 재순위화 속도 느림

```typescript
// 재순위화 비활성화
const result = await executeRAGPipeline(query, {
  enableRerank: false  // 빠른 응답 필요 시
});
```

## 10. 추가 리소스

- **Phase 3 상세 문서**: `lib/ai/README_PHASE3.md`
- **사용 예시**: `lib/ai/examples/rag-phase3-example.ts`
- **전체 요약**: `RAG_PHASE3_SUMMARY.md`

---

**통합 완료 체크리스트**

- [ ] 데이터베이스 마이그레이션 실행
- [ ] 검색 API 업그레이드
- [ ] 프론트엔드 통합
- [ ] 관리자 대시보드 구축 (선택)
- [ ] Cron Job 설정
- [ ] 환경 변수 확인
- [ ] 테스트 실행
- [ ] 모니터링 설정
- [ ] 문제 해결 가이드 숙지
