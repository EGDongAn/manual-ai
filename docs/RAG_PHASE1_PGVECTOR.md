# RAG System Phase 1: pgvector 마이그레이션 및 DB 레벨 벡터 검색

## 개요

이 문서는 RAG(Retrieval-Augmented Generation) 시스템의 Phase 1 구현을 설명합니다. 기존 메모리 기반 벡터 검색을 Supabase의 pgvector 확장을 사용한 DB 레벨 네이티브 벡터 검색으로 전환합니다.

## 주요 변경 사항

### 1. Prisma 스키마 업데이트

**파일**: `prisma/schema.prisma`

```prisma
// 매뉴얼 임베딩 (벡터 검색용)
model manual_embeddings {
  id               Int                        @id @default(autoincrement())
  manual_id        Int                        @unique
  manual           manuals                    @relation(fields: [manual_id], references: [id], onDelete: Cascade)
  embedding        Bytes                      // Float32 배열 직렬화 (레거시)
  embedding_vector Unsupported("vector(768)") // pgvector 네이티브 벡터 타입
  content_hash     String                     // 변경 감지용
  created_at       DateTime                   @default(now())
  updated_at       DateTime                   @updatedAt
}

// 매뉴얼 청크 (긴 문서 분할)
model manual_chunks {
  id               Int                        @id @default(autoincrement())
  manual_id        Int
  chunk_index      Int                        // 청크 순서
  content          String                     @db.Text
  embedding_vector Unsupported("vector(768)") // pgvector 네이티브 벡터 타입
  token_count      Int?                       // 청크 토큰 수
  created_at       DateTime                   @default(now())

  @@index([manual_id])
  @@unique([manual_id, chunk_index])
}
```

**주요 추가 사항**:
- `manual_embeddings.embedding_vector`: pgvector 네이티브 벡터 타입 (768차원)
- `manual_chunks`: 긴 문서를 분할하여 청크 단위로 임베딩 저장

### 2. pgvector 검색 함수 (`lib/ai/pgvector-search.ts`)

#### 핵심 함수

##### `toPgVector(embedding: Float32Array): string`
Float32Array를 pgvector 형식 문자열로 변환합니다.

```typescript
// 예: [0.1, 0.2, 0.3] → '[0.1,0.2,0.3]'
const pgVectorString = toPgVector(embedding);
```

##### `searchSimilarManualsPgvector(queryEmbedding, limit, threshold)`
전체 문서 기반 코사인 유사도 검색을 수행합니다.

```typescript
const results = await searchSimilarManualsPgvector(
  queryEmbedding,
  5,     // 상위 5개 결과
  0.5    // 최소 유사도 0.5
);
```

**반환값**:
```typescript
{
  id: number;
  manual_id: number;
  similarity: number;  // 0~1
  title: string;
  content: string;
  summary: string | null;
  category_id: number | null;
  status: string;
}[]
```

##### `findSimilarChunksPgvector(queryEmbedding, limit, threshold)`
청크 기반 검색으로 긴 문서에서 더 정확한 검색을 제공합니다.

```typescript
const chunks = await findSimilarChunksPgvector(
  queryEmbedding,
  10,    // 상위 10개 청크
  0.5
);
```

##### `hybridSearchPgvector(queryEmbedding, options)`
전체 문서 검색과 청크 검색을 병렬로 실행하여 통합 결과를 반환합니다.

```typescript
const { manuals, chunks } = await hybridSearchPgvector(queryEmbedding, {
  manualLimit: 5,
  chunkLimit: 10,
  threshold: 0.5,
  useChunks: true
});
```

##### `searchByCategoryPgvector(queryEmbedding, categoryId, limit, threshold)`
특정 카테고리 내에서 벡터 검색을 수행합니다.

```typescript
const results = await searchByCategoryPgvector(
  queryEmbedding,
  categoryId,
  5,
  0.5
);
```

##### `createVectorIndexes()`
성능 최적화를 위한 HNSW 인덱스를 생성합니다.

```typescript
await createVectorIndexes();
// manual_embeddings와 manual_chunks 테이블에 HNSW 인덱스 생성
```

### 3. 임베딩 생성 함수 업데이트 (`lib/ai/embeddings.ts`)

#### 새로운 함수

##### `createManualEmbeddingPgvector(manualId, title, content, summary)`
pgvector 형식으로 매뉴얼 임베딩을 생성하고 저장합니다.

```typescript
await createManualEmbeddingPgvector(
  manualId,
  'Manual Title',
  'Manual content...',
  'Summary...'
);
```

##### `createChunkEmbedding(manualId, chunkIndex, content, tokenCount)`
개별 청크의 임베딩을 생성하고 저장합니다.

```typescript
await createChunkEmbedding(
  manualId,
  0,           // 첫 번째 청크
  'Chunk content...',
  500          // 토큰 수
);
```

##### `createChunkedEmbeddings(manualId, content, chunkSize, overlap)`
긴 문서를 청크로 분할하고 각 청크의 임베딩을 생성합니다.

```typescript
const chunkCount = await createChunkedEmbeddings(
  manualId,
  longContent,
  1000,  // 청크 크기
  200    // 중복 크기
);
```

##### `reindexAllManualsPgvector(options)`
모든 매뉴얼을 pgvector 형식으로 재색인합니다.

```typescript
const result = await reindexAllManualsPgvector({
  useChunks: true,
  chunkSize: 1000,
  overlap: 200
});

console.log(`총 ${result.indexed}개 매뉴얼, ${result.totalChunks}개 청크 생성`);
```

### 4. 마이그레이션 스크립트 (`scripts/migrate-to-pgvector.ts`)

기존 Bytes 형식 임베딩을 pgvector 형식으로 변환하는 스크립트입니다.

#### 실행 방법

```bash
# 일반 실행
npx tsx scripts/migrate-to-pgvector.ts

# Dry run (테스트)
npx tsx scripts/migrate-to-pgvector.ts --dry-run

# 배치 크기 지정
npx tsx scripts/migrate-to-pgvector.ts --batch-size=50

# 인덱스 생성 건너뛰기
npx tsx scripts/migrate-to-pgvector.ts --no-indexes
```

#### 마이그레이션 프로세스

1. **pgvector 확장 확인**: `CREATE EXTENSION IF NOT EXISTS vector`
2. **대상 확인**: `embedding_vector IS NULL`인 임베딩 개수 확인
3. **배치 변환**: 지정된 배치 크기로 Bytes → pgvector 변환
4. **인덱스 생성**: HNSW 인덱스 자동 생성 (옵션)
5. **결과 확인**: 마이그레이션 통계 출력

### 5. 타입 정의 업데이트 (`lib/ai/types.ts`)

새로운 타입 정의가 추가되었습니다:

```typescript
export interface PgVectorSearchResult {
  id: number;
  manual_id: number;
  similarity: number;
  title: string;
  content: string;
  summary: string | null;
  category_id: number | null;
  status: string;
}

export interface ChunkSearchResult {
  id: number;
  manual_id: number;
  chunk_index: number;
  content: string;
  similarity: number;
  title: string;
  manual_summary: string | null;
  category_id: number | null;
}

export interface HybridSearchResult {
  manuals: PgVectorSearchResult[];
  chunks: ChunkSearchResult[];
}

export interface VectorStats {
  totalEmbeddings: number;
  embeddingsWithVector: number;
  totalChunks: number;
}

export interface SearchOptions {
  manualLimit?: number;
  chunkLimit?: number;
  threshold?: number;
  useChunks?: boolean;
  categoryId?: number;
}

export interface ChunkingOptions {
  useChunks?: boolean;
  chunkSize?: number;
  overlap?: number;
}
```

## 사용 예제

### 1. 새 매뉴얼 생성 시 임베딩 생성

```typescript
import { createManualEmbeddingPgvector } from '@/lib/ai/embeddings';

// 매뉴얼 생성 후
await createManualEmbeddingPgvector(
  manual.id,
  manual.title,
  manual.content,
  manual.summary
);
```

### 2. 벡터 검색 수행

```typescript
import { generateEmbedding } from '@/lib/ai/gemini';
import { searchSimilarManualsPgvector } from '@/lib/ai/pgvector-search';

// 검색 쿼리의 임베딩 생성
const queryEmbedding = await generateEmbedding(userQuery);

// DB 레벨 벡터 검색
const results = await searchSimilarManualsPgvector(
  new Float32Array(queryEmbedding),
  5,
  0.5
);

results.forEach(result => {
  console.log(`${result.title} (유사도: ${result.similarity.toFixed(2)})`);
});
```

### 3. 하이브리드 검색

```typescript
import { hybridSearchPgvector } from '@/lib/ai/pgvector-search';

const { manuals, chunks } = await hybridSearchPgvector(
  new Float32Array(queryEmbedding),
  {
    manualLimit: 5,
    chunkLimit: 10,
    threshold: 0.6,
    useChunks: true
  }
);

console.log('전체 문서 결과:', manuals.length);
console.log('청크 결과:', chunks.length);
```

### 4. 카테고리별 검색

```typescript
import { searchByCategoryPgvector } from '@/lib/ai/pgvector-search';

const categoryResults = await searchByCategoryPgvector(
  new Float32Array(queryEmbedding),
  categoryId,
  5,
  0.5
);
```

## 성능 최적화

### HNSW 인덱스

pgvector는 HNSW (Hierarchical Navigable Small World) 알고리즘을 사용한 인덱스를 지원합니다.

```sql
CREATE INDEX manual_embeddings_vector_idx
ON manual_embeddings
USING hnsw (embedding_vector vector_cosine_ops);
```

**장점**:
- 빠른 근사 최근접 이웃 검색
- 높은 정확도
- 대규모 데이터셋에 적합

**단점**:
- 메모리 사용량이 높음
- 인덱스 생성 시간이 김

### 성능 비교

| 방식 | 검색 시간 | 정확도 | 확장성 |
|------|----------|--------|--------|
| 메모리 기반 (Phase 0) | 빠름 | 100% | 낮음 (메모리 제한) |
| pgvector + HNSW | 매우 빠름 | ~99% | 높음 (DB 확장성) |
| pgvector (인덱스 없음) | 느림 | 100% | 중간 |

## 마이그레이션 가이드

### 1. 사전 준비

```bash
# Prisma 스키마 업데이트 후 마이그레이션 생성
npx prisma migrate dev --name add_pgvector_support
```

### 2. pgvector 확장 활성화 (Supabase)

Supabase에서는 pgvector가 기본적으로 사용 가능합니다. 수동으로 활성화하려면:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. 기존 임베딩 마이그레이션

```bash
# Dry run으로 먼저 테스트
npx tsx scripts/migrate-to-pgvector.ts --dry-run

# 실제 마이그레이션 실행
npx tsx scripts/migrate-to-pgvector.ts

# 배치 크기 조정 (메모리 제약이 있는 경우)
npx tsx scripts/migrate-to-pgvector.ts --batch-size=50
```

### 4. 인덱스 생성

```bash
# 마이그레이션 스크립트가 자동으로 인덱스를 생성
# 또는 수동으로 생성
npx tsx -e "import { createVectorIndexes } from './lib/ai/pgvector-search'; createVectorIndexes();"
```

### 5. 새 매뉴얼 재색인 (선택사항)

```bash
# 청크 임베딩 포함하여 전체 재색인
npx tsx -e "
import { reindexAllManualsPgvector } from './lib/ai/embeddings';
reindexAllManualsPgvector({ useChunks: true, chunkSize: 1000, overlap: 200 })
  .then(result => console.log(result));
"
```

## 레거시 호환성

기존 `vector-search.ts` 파일은 폴백용으로 유지됩니다:

```typescript
// 레거시 방식 (메모리 기반)
import { searchSimilarManuals } from '@/lib/ai/vector-search';

// 새로운 방식 (DB 기반)
import { searchSimilarManualsPgvector } from '@/lib/ai/pgvector-search';

// 하이브리드 접근
try {
  const results = await searchSimilarManualsPgvector(embedding, limit, threshold);
} catch (error) {
  console.warn('pgvector 검색 실패, 폴백 사용:', error);
  const results = await searchSimilarManuals(embedding, limit, threshold);
}
```

## 트러블슈팅

### 1. pgvector 확장이 없는 경우

**증상**: `type "vector" does not exist` 오류

**해결**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Prisma 타입 오류

**증상**: `Unsupported("vector(768)")` 타입 오류

**해결**: Raw SQL 쿼리 사용
```typescript
await prisma.$executeRaw`...`;
await prisma.$queryRaw`...`;
```

### 3. 마이그레이션 실패

**증상**: 배치 변환 중 메모리 부족

**해결**: 배치 크기 줄이기
```bash
npx tsx scripts/migrate-to-pgvector.ts --batch-size=20
```

## 다음 단계 (Phase 2)

- [ ] 메타데이터 필터링 추가
- [ ] 하이브리드 검색 (키워드 + 벡터)
- [ ] Reranking 알고리즘 적용
- [ ] 캐싱 레이어 추가
- [ ] 검색 성능 모니터링

## 참고 자료

- [pgvector 공식 문서](https://github.com/pgvector/pgvector)
- [Supabase Vector 가이드](https://supabase.com/docs/guides/ai/vector-columns)
- [Prisma Raw SQL](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)
