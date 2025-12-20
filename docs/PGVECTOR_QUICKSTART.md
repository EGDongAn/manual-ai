# pgvector Quick Start Guide

이 가이드는 pgvector 기반 RAG 시스템을 빠르게 시작하는 방법을 설명합니다.

## 1. 데이터베이스 마이그레이션

### Step 1: Prisma 마이그레이션 실행

```bash
# 개발 환경
npx prisma migrate dev --name add_pgvector_support

# 프로덕션 환경
npx prisma migrate deploy
```

### Step 2: Prisma Client 재생성

```bash
npx prisma generate
```

## 2. 기존 데이터 마이그레이션

### Step 1: Dry Run으로 테스트

```bash
npx tsx scripts/migrate-to-pgvector.ts --dry-run
```

출력 예시:
```
🚀 pgvector 마이그레이션 시작
   배치 크기: 100
   인덱스 생성: 예
   Dry Run: 예

1️⃣  pgvector 확장 확인 중...
   ✅ pgvector 확장 활성화됨

2️⃣  마이그레이션 대상 확인 중...
   총 50개의 임베딩을 마이그레이션해야 합니다.

3️⃣  임베딩 마이그레이션 중...
   진행률: 100% (50/50) - 성공: 50, 실패: 0
```

### Step 2: 실제 마이그레이션 실행

```bash
npx tsx scripts/migrate-to-pgvector.ts
```

### Step 3: 마이그레이션 결과 확인

```bash
# Prisma Studio에서 확인
npx prisma studio

# 또는 SQL로 확인
psql $DATABASE_URL -c "
  SELECT
    COUNT(*) as total,
    COUNT(embedding_vector) as with_pgvector
  FROM manual_embeddings;
"
```

## 3. 새 매뉴얼에 임베딩 생성

### 방법 1: API 라우트에서 자동 생성

```typescript
// app/api/manuals/route.ts
import { createManualEmbeddingPgvector } from '@/lib/ai/embeddings';

export async function POST(request: Request) {
  const body = await request.json();

  // 매뉴얼 생성
  const manual = await prisma.manuals.create({
    data: {
      title: body.title,
      content: body.content,
      summary: body.summary,
      category_id: body.categoryId,
    },
  });

  // 임베딩 생성 (비동기)
  createManualEmbeddingPgvector(
    manual.id,
    manual.title,
    manual.content,
    manual.summary
  ).catch(error => {
    console.error('임베딩 생성 실패:', error);
  });

  return Response.json(manual);
}
```

### 방법 2: 긴 문서는 청크로 분할

```typescript
import {
  createManualEmbeddingPgvector,
  createChunkedEmbeddings
} from '@/lib/ai/embeddings';

// 전체 문서 임베딩
await createManualEmbeddingPgvector(
  manual.id,
  manual.title,
  manual.content,
  manual.summary
);

// 긴 문서는 청크로 분할
if (manual.content.length > 2000) {
  await createChunkedEmbeddings(
    manual.id,
    manual.content,
    1000,  // 청크 크기
    200    // 중복 크기
  );
}
```

## 4. 벡터 검색 수행

### 방법 1: 기본 검색

```typescript
import { generateEmbedding } from '@/lib/ai/gemini';
import { searchSimilarManualsPgvector } from '@/lib/ai/pgvector-search';

// 검색 쿼리의 임베딩 생성
const query = "재고 관리 방법";
const queryEmbedding = await generateEmbedding(query);

// 벡터 검색
const results = await searchSimilarManualsPgvector(
  new Float32Array(queryEmbedding),
  5,    // 상위 5개
  0.5   // 최소 유사도 0.5
);

// 결과 출력
results.forEach(result => {
  console.log(`${result.title}`);
  console.log(`유사도: ${(result.similarity * 100).toFixed(1)}%`);
  console.log(`내용: ${result.content.slice(0, 100)}...`);
  console.log('---');
});
```

### 방법 2: 하이브리드 검색 (전체 문서 + 청크)

```typescript
import { hybridSearchPgvector } from '@/lib/ai/pgvector-search';

const { manuals, chunks } = await hybridSearchPgvector(
  new Float32Array(queryEmbedding),
  {
    manualLimit: 3,
    chunkLimit: 10,
    threshold: 0.6,
    useChunks: true
  }
);

console.log(`매뉴얼 ${manuals.length}개 찾음`);
console.log(`청크 ${chunks.length}개 찾음`);

// 매뉴얼 결과
manuals.forEach(m => {
  console.log(`📄 ${m.title} (${(m.similarity * 100).toFixed(1)}%)`);
});

// 청크 결과
chunks.forEach(c => {
  console.log(`📝 ${c.title} - 청크 ${c.chunk_index} (${(c.similarity * 100).toFixed(1)}%)`);
  console.log(`   ${c.content.slice(0, 100)}...`);
});
```

### 방법 3: 카테고리별 검색

```typescript
import { searchByCategoryPgvector } from '@/lib/ai/pgvector-search';

const results = await searchByCategoryPgvector(
  new Float32Array(queryEmbedding),
  categoryId,
  5,
  0.5
);
```

## 5. RAG 시스템에 통합

### AI 답변 생성 예시

```typescript
import { generateEmbedding } from '@/lib/ai/gemini';
import { hybridSearchPgvector } from '@/lib/ai/pgvector-search';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateAnswer(question: string) {
  // 1. 질문을 벡터로 변환
  const queryEmbedding = await generateEmbedding(question);

  // 2. 관련 매뉴얼 검색
  const { manuals, chunks } = await hybridSearchPgvector(
    new Float32Array(queryEmbedding),
    {
      manualLimit: 3,
      chunkLimit: 5,
      threshold: 0.6,
      useChunks: true
    }
  );

  // 3. 컨텍스트 구성
  const context = [
    ...manuals.map(m => `[매뉴얼: ${m.title}]\n${m.content}`),
    ...chunks.map(c => `[${c.title} - 일부]\n${c.content}`)
  ].join('\n\n---\n\n');

  // 4. AI 답변 생성
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
다음 매뉴얼 내용을 참고하여 질문에 답변해주세요.

매뉴얼 내용:
${context}

질문: ${question}

답변:
  `.trim();

  const result = await model.generateContent(prompt);
  const answer = result.response.text();

  return {
    answer,
    sources: [
      ...manuals.map(m => ({
        manualId: m.manual_id,
        title: m.title,
        similarity: m.similarity,
      })),
      ...chunks.map(c => ({
        manualId: c.manual_id,
        title: c.title,
        chunkIndex: c.chunk_index,
        similarity: c.similarity,
      }))
    ],
  };
}
```

## 6. 성능 모니터링

### 벡터 통계 확인

```typescript
import { getVectorStats } from '@/lib/ai/pgvector-search';

const stats = await getVectorStats();
console.log('총 임베딩:', stats.totalEmbeddings);
console.log('pgvector 형식:', stats.embeddingsWithVector);
console.log('총 청크:', stats.totalChunks);
```

### 검색 성능 측정

```typescript
const start = performance.now();

const results = await searchSimilarManualsPgvector(
  new Float32Array(queryEmbedding),
  5,
  0.5
);

const duration = performance.now() - start;
console.log(`검색 시간: ${duration.toFixed(2)}ms`);
console.log(`결과 수: ${results.length}`);
```

## 7. 문제 해결

### pgvector 확장 오류

```bash
# Supabase SQL Editor에서 실행
CREATE EXTENSION IF NOT EXISTS vector;
```

### 인덱스 수동 생성

```typescript
import { createVectorIndexes } from '@/lib/ai/pgvector-search';

await createVectorIndexes();
```

### 전체 재색인

```typescript
import { reindexAllManualsPgvector } from '@/lib/ai/embeddings';

const result = await reindexAllManualsPgvector({
  useChunks: true,
  chunkSize: 1000,
  overlap: 200
});

console.log(`총 ${result.indexed}개 매뉴얼 재색인 완료`);
console.log(`${result.totalChunks}개 청크 생성`);
console.log(`실패: ${result.errors.length}개`);
```

## 8. API 라우트 예제

### 검색 API

```typescript
// app/api/search/route.ts
import { NextRequest } from 'next/server';
import { generateEmbedding } from '@/lib/ai/gemini';
import { hybridSearchPgvector } from '@/lib/ai/pgvector-search';

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5, threshold = 0.5 } = await request.json();

    // 쿼리 임베딩 생성
    const embedding = await generateEmbedding(query);

    // 벡터 검색
    const { manuals, chunks } = await hybridSearchPgvector(
      new Float32Array(embedding),
      {
        manualLimit: limit,
        chunkLimit: limit * 2,
        threshold,
        useChunks: true
      }
    );

    return Response.json({
      success: true,
      manuals,
      chunks,
      total: manuals.length + chunks.length
    });
  } catch (error) {
    console.error('검색 오류:', error);
    return Response.json(
      { success: false, error: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

## 다음 단계

- [ ] 캐싱 레이어 추가 (Redis)
- [ ] 검색 결과 Reranking
- [ ] 메타데이터 필터링
- [ ] A/B 테스트 설정
- [ ] 성능 모니터링 대시보드

## 참고 자료

- [전체 문서](./RAG_PHASE1_PGVECTOR.md)
- [pgvector 공식 문서](https://github.com/pgvector/pgvector)
- [Supabase Vector](https://supabase.com/docs/guides/ai/vector-columns)
