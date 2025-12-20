import { generateEmbedding } from './gemini';
import { prisma } from '@/lib/prisma';
import { toPgVector } from './pgvector-search';
import crypto from 'crypto';

// 콘텐츠 해시 생성 (변경 감지용)
export function generateContentHash(title: string, content: string): string {
  const text = `${title}|||${content}`;
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Float32 배열을 Bytes로 변환
export function float32ArrayToBytes(arr: number[]): Buffer {
  const float32Array = new Float32Array(arr);
  return Buffer.from(float32Array.buffer);
}

// Bytes를 Float32 배열로 변환
export function bytesToFloat32Array(buffer: Buffer): number[] {
  const float32Array = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.length / 4
  );
  return Array.from(float32Array);
}

// 매뉴얼 임베딩 생성 및 저장
export async function createManualEmbedding(
  manualId: number,
  title: string,
  content: string,
  summary?: string | null
): Promise<void> {
  // 임베딩에 사용할 텍스트 조합 (제목 + 요약 + 본문 앞부분)
  const textForEmbedding = [
    title,
    summary || '',
    content.slice(0, 2000) // 본문 앞 2000자
  ].filter(Boolean).join('\n\n');

  // 콘텐츠 해시 생성
  const contentHash = generateContentHash(title, content);

  // 기존 임베딩 확인
  const existing = await prisma.manual_embeddings.findUnique({
    where: { manual_id: manualId }
  });

  // 콘텐츠가 변경되지 않았으면 스킵
  if (existing && existing.content_hash === contentHash) {
    return;
  }

  // 임베딩 생성
  const embedding = await generateEmbedding(textForEmbedding);
  const embeddingBytes = float32ArrayToBytes(embedding);

  // Raw SQL로 저장 또는 업데이트 (Unsupported 타입 때문에 Prisma upsert 사용 불가)
  if (existing) {
    await prisma.$executeRaw`
      UPDATE manual_embeddings
      SET embedding = ${embeddingBytes},
          content_hash = ${contentHash},
          updated_at = NOW()
      WHERE manual_id = ${manualId}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO manual_embeddings (manual_id, embedding, content_hash, created_at, updated_at)
      VALUES (${manualId}, ${embeddingBytes}, ${contentHash}, NOW(), NOW())
    `;
  }
}

// 매뉴얼 임베딩 삭제
export async function deleteManualEmbedding(manualId: number): Promise<void> {
  await prisma.manual_embeddings.deleteMany({
    where: { manual_id: manualId }
  });
}

/**
 * pgvector 형식으로 매뉴얼 임베딩 생성 및 저장
 */
export async function createManualEmbeddingPgvector(
  manualId: number,
  title: string,
  content: string,
  summary?: string | null
): Promise<void> {
  // 임베딩에 사용할 텍스트 조합
  const textForEmbedding = [
    title,
    summary || '',
    content.slice(0, 2000)
  ].filter(Boolean).join('\n\n');

  const contentHash = generateContentHash(title, content);

  // 기존 임베딩 확인
  const existing = await prisma.manual_embeddings.findUnique({
    where: { manual_id: manualId }
  });

  // 콘텐츠가 변경되지 않았으면 스킵
  if (existing && existing.content_hash === contentHash) {
    return;
  }

  // 임베딩 생성
  const embedding = await generateEmbedding(textForEmbedding);
  const embeddingBytes = float32ArrayToBytes(embedding);
  const embeddingFloat32 = new Float32Array(embedding);
  const pgVectorString = toPgVector(embeddingFloat32);

  // Raw SQL로 pgvector 형식 저장
  if (existing) {
    await prisma.$executeRaw`
      UPDATE manual_embeddings
      SET
        embedding = ${embeddingBytes},
        embedding_vector = ${pgVectorString}::vector,
        content_hash = ${contentHash},
        updated_at = NOW()
      WHERE manual_id = ${manualId}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO manual_embeddings (manual_id, embedding, embedding_vector, content_hash, created_at, updated_at)
      VALUES (${manualId}, ${embeddingBytes}, ${pgVectorString}::vector, ${contentHash}, NOW(), NOW())
    `;
  }
}

/**
 * 청크 임베딩 생성 및 저장
 */
export async function createChunkEmbedding(
  manualId: number,
  chunkIndex: number,
  content: string,
  options: {
    tokenCount?: number;
    sectionTitle?: string;
    startOffset?: number;
    endOffset?: number;
  } = {}
): Promise<void> {
  const { tokenCount, sectionTitle, startOffset, endOffset } = options;

  // 임베딩 생성
  const embedding = await generateEmbedding(content);
  const embeddingBytes = float32ArrayToBytes(embedding);
  const embeddingFloat32 = new Float32Array(embedding);
  const pgVectorString = toPgVector(embeddingFloat32);

  // 콘텐츠 해시 생성
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');

  // Raw SQL로 저장 (upsert)
  await prisma.$executeRaw`
    INSERT INTO manual_chunks (
      manual_id, chunk_index, content, section_title,
      start_offset, end_offset, token_count, content_hash,
      embedding, embedding_vector, created_at, updated_at
    )
    VALUES (
      ${manualId}, ${chunkIndex}, ${content}, ${sectionTitle || null},
      ${startOffset || 0}, ${endOffset || content.length}, ${tokenCount || null}, ${contentHash},
      ${embeddingBytes}, ${pgVectorString}::vector, NOW(), NOW()
    )
    ON CONFLICT (manual_id, chunk_index)
    DO UPDATE SET
      content = EXCLUDED.content,
      section_title = EXCLUDED.section_title,
      start_offset = EXCLUDED.start_offset,
      end_offset = EXCLUDED.end_offset,
      token_count = EXCLUDED.token_count,
      content_hash = EXCLUDED.content_hash,
      embedding = EXCLUDED.embedding,
      embedding_vector = EXCLUDED.embedding_vector,
      updated_at = NOW()
  `;
}

/**
 * 긴 문서를 청크로 분할하여 임베딩 생성
 */
export async function createChunkedEmbeddings(
  manualId: number,
  content: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Promise<number> {
  const chunks: Array<{
    content: string;
    startOffset: number;
    endOffset: number;
  }> = [];
  let start = 0;

  // 간단한 청크 분할 로직 (문단 단위로 분할하는 것이 더 좋지만 일단 문자 단위)
  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    chunks.push({
      content: content.slice(start, end),
      startOffset: start,
      endOffset: end,
    });
    start += chunkSize - overlap;
  }

  // 각 청크에 대해 임베딩 생성
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    await createChunkEmbedding(manualId, i, chunk.content, {
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      tokenCount: Math.ceil(chunk.content.length / 4), // 대략적인 토큰 수
    });
    // 레이트 리밋 방지
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return chunks.length;
}

// 모든 매뉴얼 임베딩 재생성
export async function reindexAllManuals(): Promise<{
  total: number;
  indexed: number;
  errors: string[];
}> {
  const manuals = await prisma.manuals.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
    }
  });

  const errors: string[] = [];
  let indexed = 0;

  for (const manual of manuals) {
    try {
      await createManualEmbedding(
        manual.id,
        manual.title,
        manual.content,
        manual.summary
      );
      indexed++;

      // 레이트 리밋 방지
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`매뉴얼 ID ${manual.id}: ${message}`);
    }
  }

  return {
    total: manuals.length,
    indexed,
    errors,
  };
}

/**
 * 모든 매뉴얼 임베딩을 pgvector 형식으로 재생성
 */
export async function reindexAllManualsPgvector(
  options: {
    useChunks?: boolean;
    chunkSize?: number;
    overlap?: number;
  } = {}
): Promise<{
  total: number;
  indexed: number;
  totalChunks: number;
  errors: string[];
}> {
  const { useChunks = false, chunkSize = 1000, overlap = 200 } = options;

  const manuals = await prisma.manuals.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
    }
  });

  const errors: string[] = [];
  let indexed = 0;
  let totalChunks = 0;

  for (const manual of manuals) {
    try {
      // 전체 문서 임베딩 생성
      await createManualEmbeddingPgvector(
        manual.id,
        manual.title,
        manual.content,
        manual.summary
      );

      // 청크 임베딩 생성 (옵션)
      if (useChunks && manual.content.length > chunkSize) {
        const chunkCount = await createChunkedEmbeddings(
          manual.id,
          manual.content,
          chunkSize,
          overlap
        );
        totalChunks += chunkCount;
      }

      indexed++;

      // 레이트 리밋 방지
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`매뉴얼 ID ${manual.id}: ${message}`);
    }
  }

  return {
    total: manuals.length,
    indexed,
    totalChunks,
    errors,
  };
}
