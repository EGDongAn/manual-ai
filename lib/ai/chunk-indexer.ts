/**
 * 청크 인덱싱 시스템
 *
 * 매뉴얼을 청크로 분할하고 각 청크에 대한 임베딩을 생성하여
 * 데이터베이스에 저장합니다.
 */

import { prisma } from '@/lib/prisma';
import { generateEmbedding } from './gemini';
import { float32ArrayToBytes } from './embeddings';
import { toPgVector } from './pgvector-search';
import { chunkDocument, validateChunk, calculateChunkingStats, type Chunk } from './chunking';
import crypto from 'crypto';

/**
 * 청크 콘텐츠 해시 생성
 */
function generateChunkHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * 매뉴얼을 청크로 분할하고 임베딩 생성
 *
 * @param manualId - 매뉴얼 ID
 * @param title - 매뉴얼 제목
 * @param content - 매뉴얼 내용
 * @returns 생성된 청크 수
 */
export async function indexManualChunks(
  manualId: number,
  title: string,
  content: string
): Promise<{
  chunksCreated: number;
  chunksSkipped: number;
  stats: ReturnType<typeof calculateChunkingStats>;
}> {
  // 1. 문서 청킹
  const chunks = chunkDocument(content, title);
  const validChunks = chunks.filter(validateChunk);

  // 통계 정보
  const stats = calculateChunkingStats(validChunks);

  // 2. 기존 청크 조회 (중복 확인용)
  const existingChunks = await prisma.$queryRaw<Array<{ content_hash: string }>>`
    SELECT content_hash
    FROM manual_chunks
    WHERE manual_id = ${manualId}
  `;

  const existingHashes = new Set(existingChunks.map(c => c.content_hash));

  // 3. 각 청크에 대해 임베딩 생성 및 저장
  let chunksCreated = 0;
  let chunksSkipped = 0;

  for (let i = 0; i < validChunks.length; i++) {
    const chunk = validChunks[i];
    const contentHash = generateChunkHash(chunk.content);

    // 이미 존재하는 청크는 스킵
    if (existingHashes.has(contentHash)) {
      chunksSkipped++;
      continue;
    }

    try {
      // 임베딩 생성
      // 청크 콘텐츠에 섹션 제목을 포함하여 컨텍스트 강화
      const textForEmbedding = chunk.metadata.sectionTitle
        ? `${chunk.metadata.sectionTitle}\n\n${chunk.content}`
        : chunk.content;

      const embedding = await generateEmbedding(textForEmbedding);
      const embeddingBytes = float32ArrayToBytes(embedding);
      const embeddingFloat32 = new Float32Array(embedding);
      const pgVectorString = toPgVector(embeddingFloat32);

      // 데이터베이스에 저장
      await prisma.$executeRaw`
        INSERT INTO manual_chunks (
          manual_id,
          chunk_index,
          content,
          section_title,
          start_offset,
          end_offset,
          token_count,
          content_hash,
          embedding,
          embedding_vector,
          created_at,
          updated_at
        ) VALUES (
          ${manualId},
          ${i},
          ${chunk.content},
          ${chunk.metadata.sectionTitle || null},
          ${chunk.metadata.startOffset},
          ${chunk.metadata.endOffset},
          ${chunk.tokenCount},
          ${contentHash},
          ${embeddingBytes},
          ${pgVectorString}::vector,
          NOW(),
          NOW()
        )
      `;

      chunksCreated++;

      // 레이트 리밋 방지 (100ms 딜레이)
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`청크 ${i} 인덱싱 실패:`, error);
      // 에러가 발생해도 계속 진행
    }
  }

  return {
    chunksCreated,
    chunksSkipped,
    stats
  };
}

/**
 * 매뉴얼의 기존 청크 삭제
 *
 * @param manualId - 매뉴얼 ID
 */
export async function deleteManualChunks(manualId: number): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM manual_chunks
    WHERE manual_id = ${manualId}
  `;

  return Number(result);
}

/**
 * 매뉴얼 재인덱싱
 *
 * 기존 청크를 삭제하고 새로 생성
 *
 * @param manualId - 매뉴얼 ID
 */
export async function reindexManual(manualId: number): Promise<{
  deletedChunks: number;
  chunksCreated: number;
  chunksSkipped: number;
  stats: ReturnType<typeof calculateChunkingStats>;
}> {
  // 매뉴얼 정보 조회
  const manual = await prisma.manuals.findUnique({
    where: { id: manualId },
    select: {
      id: true,
      title: true,
      content: true
    }
  });

  if (!manual) {
    throw new Error(`매뉴얼 ID ${manualId}를 찾을 수 없습니다.`);
  }

  // 기존 청크 삭제
  const deletedChunks = await deleteManualChunks(manualId);

  // 새 청크 생성
  const result = await indexManualChunks(manual.id, manual.title, manual.content);

  return {
    deletedChunks,
    ...result
  };
}

/**
 * 전체 매뉴얼 재인덱싱
 *
 * 모든 PUBLISHED 상태의 매뉴얼을 재인덱싱
 */
export async function reindexAllChunks(): Promise<{
  totalManuals: number;
  successCount: number;
  errorCount: number;
  totalChunksCreated: number;
  errors: Array<{ manualId: number; error: string }>;
}> {
  // PUBLISHED 상태의 모든 매뉴얼 조회
  const manuals = await prisma.manuals.findMany({
    where: {
      status: 'PUBLISHED'
    },
    select: {
      id: true,
      title: true,
      content: true
    }
  });

  let successCount = 0;
  let errorCount = 0;
  let totalChunksCreated = 0;
  const errors: Array<{ manualId: number; error: string }> = [];

  for (const manual of manuals) {
    try {
      // 기존 청크 삭제
      await deleteManualChunks(manual.id);

      // 새 청크 생성
      const result = await indexManualChunks(manual.id, manual.title, manual.content);
      totalChunksCreated += result.chunksCreated;
      successCount++;

      console.log(
        `매뉴얼 ${manual.id} "${manual.title}" 인덱싱 완료: ` +
        `${result.chunksCreated}개 청크 생성`
      );

      // 레이트 리밋 방지 (매뉴얼 간 200ms 딜레이)
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        manualId: manual.id,
        error: errorMessage
      });

      console.error(`매뉴얼 ${manual.id} 인덱싱 실패:`, errorMessage);
    }
  }

  return {
    totalManuals: manuals.length,
    successCount,
    errorCount,
    totalChunksCreated,
    errors
  };
}

/**
 * 청크 인덱스 통계 조회
 */
export async function getChunkIndexStats(): Promise<{
  totalManuals: number;
  totalChunks: number;
  avgChunksPerManual: number;
  manualsWithChunks: number;
  manualsWithoutChunks: number;
}> {
  const [manualCount, chunkStats] = await Promise.all([
    prisma.manuals.count({
      where: { status: 'PUBLISHED' }
    }),
    prisma.$queryRaw<Array<{
      total_chunks: bigint;
      manuals_with_chunks: bigint;
    }>>`
      SELECT
        COUNT(*) as total_chunks,
        COUNT(DISTINCT manual_id) as manuals_with_chunks
      FROM manual_chunks
    `
  ]);

  const totalChunks = Number(chunkStats[0]?.total_chunks || 0);
  const manualsWithChunks = Number(chunkStats[0]?.manuals_with_chunks || 0);
  const manualsWithoutChunks = manualCount - manualsWithChunks;
  const avgChunksPerManual = manualsWithChunks > 0
    ? Math.round(totalChunks / manualsWithChunks)
    : 0;

  return {
    totalManuals: manualCount,
    totalChunks,
    avgChunksPerManual,
    manualsWithChunks,
    manualsWithoutChunks
  };
}

/**
 * 특정 매뉴얼의 청크 목록 조회
 */
export async function getManualChunks(manualId: number): Promise<Array<{
  id: number;
  chunkIndex: number;
  content: string;
  sectionTitle: string | null;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}>> {
  const chunks = await prisma.$queryRaw<Array<{
    id: number;
    chunk_index: number;
    content: string;
    section_title: string | null;
    token_count: number;
    start_offset: number;
    end_offset: number;
  }>>`
    SELECT
      id,
      chunk_index,
      content,
      section_title,
      token_count,
      start_offset,
      end_offset
    FROM manual_chunks
    WHERE manual_id = ${manualId}
    ORDER BY chunk_index ASC
  `;

  return chunks.map(chunk => ({
    id: chunk.id,
    chunkIndex: chunk.chunk_index,
    content: chunk.content,
    sectionTitle: chunk.section_title,
    tokenCount: chunk.token_count,
    startOffset: chunk.start_offset,
    endOffset: chunk.end_offset
  }));
}
