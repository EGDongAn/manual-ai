# RAG Phase 2 구현 체크리스트

## ✅ 완료된 작업

### 1. 코드 파일 생성
- ✅ `lib/ai/chunking.ts` - 문서 청킹 시스템
- ✅ `lib/ai/chunk-indexer.ts` - 청크 인덱싱 및 임베딩 생성
- ✅ `lib/ai/hybrid-search.ts` - RRF 기반 하이브리드 검색
- ✅ `lib/ai/index.ts` - 통합 export 업데이트

### 2. 데이터베이스 스키마
- ✅ `prisma/schema.prisma` - manual_chunks 모델 업데이트
  - manual_id, chunk_index, content
  - section_title, start_offset, end_offset
  - token_count, content_hash
  - embedding (Bytes), embedding_vector (pgvector)
  - created_at, updated_at
- ✅ manuals 모델에 chunks 관계 추가

### 3. 마이그레이션
- ✅ `prisma/migrations/add_chunking_fields.sql` - 마이그레이션 SQL 작성

### 4. 문서화
- ✅ `lib/ai/USAGE_GUIDE.md` - 상세 사용 가이드
- ✅ `lib/ai/README.md` - AI 라이브러리 개요
- ✅ `RAG_PHASE2_SUMMARY.md` - 프로젝트 요약

## 🔄 다음 단계 (수동 작업 필요)

### 1. 데이터베이스 마이그레이션 실행

```bash
# 옵션 1: Prisma 스키마 푸시
npx prisma db push

# 옵션 2: 수동 마이그레이션
psql -U your_user -d your_database -f prisma/migrations/add_chunking_fields.sql
```

### 2. pgvector 확장 확인

```sql
-- PostgreSQL에 연결 후
CREATE EXTENSION IF NOT EXISTS vector;

-- 확장 확인
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 3. 기존 매뉴얼 인덱싱

```typescript
// 스크립트 실행 또는 API 엔드포인트 생성
import { reindexAllChunks } from '@/lib/ai';

const result = await reindexAllChunks();
console.log(`성공: ${result.successCount}/${result.totalManuals}`);
```

### 4. API 라우트 추가 (선택사항)

#### 검색 API
```typescript
// app/api/search/route.ts
import { hybridSearch } from '@/lib/ai';

export async function POST(request: Request) {
  const { query, limit = 5 } = await request.json();
  const results = await hybridSearch(query, limit);
  return Response.json({ results });
}
```

#### 인덱싱 API
```typescript
// app/api/manuals/[id]/index/route.ts
import { reindexManual } from '@/lib/ai';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await reindexManual(parseInt(params.id));
  return Response.json({ result });
}
```

### 5. 테스트

#### 청킹 테스트
```typescript
import { chunkDocument, calculateChunkingStats } from '@/lib/ai';

const testContent = `
# 제목
섹션 1 내용...

## 소제목
섹션 2 내용...
`;

const chunks = chunkDocument(testContent, "테스트 매뉴얼");
const stats = calculateChunkingStats(chunks);

console.log('청킹 결과:', {
  totalChunks: stats.totalChunks,
  avgTokens: stats.avgTokensPerChunk
});
```

#### 검색 테스트
```typescript
import { hybridSearch } from '@/lib/ai';

// 1. 매뉴얼 인덱싱
await indexManualChunks(1, "테스트", "내용...");

// 2. 검색
const results = await hybridSearch("테스트 쿼리", 5);
console.log(`검색 결과: ${results.length}개`);
```

### 6. 모니터링 설정

```typescript
import { getChunkIndexStats } from '@/lib/ai';

// 정기적으로 실행
const stats = await getChunkIndexStats();

if (stats.manualsWithoutChunks > 0) {
  console.warn(`${stats.manualsWithoutChunks}개 매뉴얼이 인덱싱되지 않았습니다.`);
}
```

## 📝 설정 조정 가이드

### 청킹 파라미터 조정

기본값이 적합하지 않은 경우:

```typescript
// lib/ai/chunking.ts
export const CHUNK_SIZE = 500;      // 500 → 300-800 범위로 조정
export const CHUNK_OVERLAP = 50;    // 50 → 30-100 범위로 조정
```

조정 기준:
- 문서가 짧으면: CHUNK_SIZE 감소 (300-400)
- 문서가 길면: CHUNK_SIZE 증가 (600-800)
- 컨텍스트 연속성 중요: OVERLAP 증가 (80-100)

### 검색 가중치 조정

검색 품질에 따라:

```typescript
// lib/ai/hybrid-search.ts
const VECTOR_WEIGHT = 0.7;    // 의미적 유사성 중시
const KEYWORD_WEIGHT = 0.3;   // 키워드 정확성 중시
const RRF_K = 60;             // 순위 보정 (작을수록 상위 순위 강조)
```

조정 시나리오:
- 의미적 검색 개선: VECTOR_WEIGHT 증가 (0.8-0.9)
- 정확한 키워드 매칭: KEYWORD_WEIGHT 증가 (0.4-0.5)
- 상위 결과 강조: RRF_K 감소 (40-50)

### 레이트 리밋 조정

API 할당량에 따라:

```typescript
// lib/ai/chunk-indexer.ts

// 청크 간 딜레이 (기본 100ms)
await new Promise(resolve => setTimeout(resolve, 100)); // → 50-200ms

// 매뉴얼 간 딜레이 (기본 200ms)
await new Promise(resolve => setTimeout(resolve, 200)); // → 100-500ms
```

## ⚠️ 주의사항

1. **pgvector 확장 필수**: 벡터 검색을 위해 PostgreSQL에 pgvector 확장 설치 필요

2. **임베딩 비용**: Gemini API 사용량에 따른 비용 발생 가능

3. **인덱싱 시간**: 대량의 매뉴얼 인덱싱 시 시간 소요
   - 예상: 매뉴얼당 1-3초
   - 100개 매뉴얼: 약 2-5분

4. **디스크 공간**: 임베딩 데이터로 인한 DB 크기 증가
   - 청크당 약 3KB
   - 매뉴얼당 평균 10개 청크: ~30KB/매뉴얼

5. **메모리 사용**: 대량 검색 시 메모리 사용 증가 가능

## 🔍 검증 체크리스트

### 데이터베이스
- [ ] pgvector 확장 설치 확인
- [ ] manual_chunks 테이블 생성 확인
- [ ] 인덱스 생성 확인 (content_hash, embedding_vector)

### 기능
- [ ] 청킹: 문서가 올바르게 분할되는지 확인
- [ ] 인덱싱: 임베딩이 생성되고 저장되는지 확인
- [ ] 벡터 검색: 유사한 청크를 찾는지 확인
- [ ] 키워드 검색: 정확한 키워드 매칭 확인
- [ ] 하이브리드 검색: 두 방식이 적절히 결합되는지 확인

### 성능
- [ ] 인덱싱 속도 측정
- [ ] 검색 응답 시간 측정
- [ ] 메모리 사용량 모니터링
- [ ] API 레이트 리밋 준수 확인

## 📚 참고 문서

- [상세 사용 가이드](./lib/ai/USAGE_GUIDE.md)
- [AI 라이브러리 README](./lib/ai/README.md)
- [Phase 2 요약](./RAG_PHASE2_SUMMARY.md)
- [Prisma 스키마](./prisma/schema.prisma)

## 🆘 문제 발생 시

1. 로그 확인
2. [USAGE_GUIDE.md](./lib/ai/USAGE_GUIDE.md)의 문제 해결 섹션 참조
3. 인덱스 상태 확인: `getChunkIndexStats()`
4. 청크 데이터 확인: `getManualChunks(manualId)`

## ✨ 완료 후 확인사항

- [ ] 기존 매뉴얼이 정상적으로 검색됨
- [ ] 새 매뉴얼 생성 시 자동 인덱싱됨
- [ ] 검색 품질이 개선됨
- [ ] 응답 시간이 허용 범위 내임
- [ ] 에러가 발생하지 않음
