import { generateEmbedding } from './gemini';
import { bytesToFloat32Array } from './embeddings';
import { prisma } from '@/lib/prisma';
import type { RelatedManual } from './types';

// 코사인 유사도 계산
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('벡터 차원이 일치하지 않습니다.');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// 텍스트로 유사한 매뉴얼 검색
export async function searchSimilarManuals(
  query: string,
  limit: number = 5,
  excludeIds: number[] = []
): Promise<RelatedManual[]> {
  // 쿼리 임베딩 생성
  const queryEmbedding = await generateEmbedding(query);

  // 모든 매뉴얼 임베딩 조회
  const embeddings = await prisma.manual_embeddings.findMany({
    where: {
      manual_id: {
        notIn: excludeIds
      }
    },
    include: {
      manual: {
        select: {
          id: true,
          title: true,
          summary: true,
          category: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  // 유사도 계산 및 정렬
  const results = embeddings
    .map(e => {
      const manualEmbedding = bytesToFloat32Array(e.embedding);
      const similarity = cosineSimilarity(queryEmbedding, manualEmbedding);

      return {
        id: e.manual.id,
        title: e.manual.title,
        summary: e.manual.summary,
        categoryName: e.manual.category?.name || null,
        similarity
      };
    })
    .filter(r => r.similarity > 0.3) // 최소 유사도 필터
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

// 매뉴얼 ID로 유사한 매뉴얼 검색
export async function findSimilarManualsByManualId(
  manualId: number,
  limit: number = 5
): Promise<RelatedManual[]> {
  // 해당 매뉴얼의 임베딩 조회
  const targetEmbedding = await prisma.manual_embeddings.findUnique({
    where: { manual_id: manualId }
  });

  if (!targetEmbedding) {
    return [];
  }

  const targetVector = bytesToFloat32Array(targetEmbedding.embedding);

  // 다른 매뉴얼 임베딩 조회
  const embeddings = await prisma.manual_embeddings.findMany({
    where: {
      manual_id: {
        not: manualId
      }
    },
    include: {
      manual: {
        select: {
          id: true,
          title: true,
          summary: true,
          category: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  // 유사도 계산 및 정렬
  const results = embeddings
    .map(e => {
      const manualEmbedding = bytesToFloat32Array(e.embedding);
      const similarity = cosineSimilarity(targetVector, manualEmbedding);

      return {
        id: e.manual.id,
        title: e.manual.title,
        summary: e.manual.summary,
        categoryName: e.manual.category?.name || null,
        similarity
      };
    })
    .filter(r => r.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

// 중복 여부 판단을 위한 고유사도 매뉴얼 검색
export async function findPotentialDuplicates(
  title: string,
  content: string,
  threshold: number = 0.85
): Promise<RelatedManual[]> {
  // 새 콘텐츠의 임베딩 생성
  const textForEmbedding = `${title}\n\n${content.slice(0, 2000)}`;
  const queryEmbedding = await generateEmbedding(textForEmbedding);

  // 모든 매뉴얼 임베딩 조회
  const embeddings = await prisma.manual_embeddings.findMany({
    include: {
      manual: {
        select: {
          id: true,
          title: true,
          summary: true,
          category: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  // 유사도 계산 및 임계값 이상만 필터
  const duplicates = embeddings
    .map(e => {
      const manualEmbedding = bytesToFloat32Array(e.embedding);
      const similarity = cosineSimilarity(queryEmbedding, manualEmbedding);

      return {
        id: e.manual.id,
        title: e.manual.title,
        summary: e.manual.summary,
        categoryName: e.manual.category?.name || null,
        similarity
      };
    })
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

  return duplicates;
}

// 검색용 매뉴얼 조회 (임베딩 기반 + 전문 포함)
export async function searchManualsForQA(
  query: string,
  limit: number = 5
): Promise<{
  id: number;
  title: string;
  content: string;
  summary: string | null;
  categoryName: string | null;
  similarity: number;
}[]> {
  const similar = await searchSimilarManuals(query, limit);

  if (similar.length === 0) {
    return [];
  }

  // 전문 조회
  const manuals = await prisma.manuals.findMany({
    where: {
      id: {
        in: similar.map(s => s.id)
      }
    },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      category: {
        select: {
          name: true
        }
      }
    }
  });

  // 유사도 순서 유지하며 병합
  return similar.map(s => {
    const manual = manuals.find(m => m.id === s.id)!;
    return {
      id: manual.id,
      title: manual.title,
      content: manual.content,
      summary: manual.summary,
      categoryName: manual.category?.name || null,
      similarity: s.similarity
    };
  });
}
