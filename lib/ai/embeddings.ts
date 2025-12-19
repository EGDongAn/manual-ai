import { generateEmbedding } from './gemini';
import { prisma } from '@/lib/prisma';
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

  // 저장 또는 업데이트
  await prisma.manual_embeddings.upsert({
    where: { manual_id: manualId },
    create: {
      manual_id: manualId,
      embedding: embeddingBytes,
      content_hash: contentHash,
    },
    update: {
      embedding: embeddingBytes,
      content_hash: contentHash,
    },
  });
}

// 매뉴얼 임베딩 삭제
export async function deleteManualEmbedding(manualId: number): Promise<void> {
  await prisma.manual_embeddings.deleteMany({
    where: { manual_id: manualId }
  });
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
