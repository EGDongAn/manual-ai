import { generateJSON } from './gemini';

export interface RerankResult {
  chunkId: number;
  relevanceScore: number;
  reasoning: string;
}

interface RerankResponse {
  rankings: Array<{
    chunkId: number;
    relevanceScore: number;
    reasoning: string;
  }>;
}

/**
 * Gemini를 활용한 검색 결과 재순위화
 *
 * 벡터 검색 결과를 사용자 쿼리에 대해 더 정확하게 재평가하여
 * 의미적 관련성이 높은 청크를 상위에 배치합니다.
 *
 * @param query - 사용자 검색 쿼리
 * @param chunks - 재순위화할 청크 배열
 * @param topK - 반환할 상위 결과 개수 (기본값: 5)
 * @returns 재순위화된 청크 배열 (관련도 높은 순)
 */
export async function rerankChunks(
  query: string,
  chunks: Array<{ id: number; content: string; title: string }>,
  topK: number = 5
): Promise<RerankResult[]> {
  if (chunks.length === 0) {
    return [];
  }

  // 청크가 topK보다 적으면 모든 청크를 순위화
  const actualTopK = Math.min(topK, chunks.length);

  const prompt = `당신은 병원 매뉴얼 검색 결과를 재평가하는 AI입니다.

[사용자 검색 쿼리]
${query}

[검색된 매뉴얼 청크들]
${chunks.map((chunk, idx) => `
청크 ${chunk.id}:
제목: ${chunk.title}
내용: ${chunk.content}
---`).join('\n')}

위 검색 결과들을 사용자 쿼리와의 관련도에 따라 재평가하고 순위를 매겨주세요.
각 청크마다 다음을 평가하세요:

1. **의미적 관련성** (40%): 청크 내용이 쿼리의 의도와 얼마나 일치하는가?
2. **정보 완전성** (30%): 쿼리에 답하기에 충분한 정보를 담고 있는가?
3. **정확성** (20%): 정보가 정확하고 신뢰할 수 있는가?
4. **실용성** (10%): 실제 업무에 바로 적용 가능한 내용인가?

각 청크의 관련도를 0.0~1.0 사이 점수로 평가하고, 상위 ${actualTopK}개만 선택하여 JSON으로 응답하세요.

응답 형식:
{
  "rankings": [
    {
      "chunkId": 청크ID,
      "relevanceScore": 0.95,
      "reasoning": "이 청크를 선택한 이유와 관련도 점수 설명"
    }
  ]
}

주의사항:
- 정확히 상위 ${actualTopK}개만 선택하세요
- relevanceScore는 반드시 0.0~1.0 사이의 소수점 값이어야 합니다
- 점수가 높은 순서대로 정렬하세요
- reasoning은 간결하지만 명확하게 작성하세요`;

  try {
    const response = await generateJSON<RerankResponse>(prompt);

    // 응답 검증
    if (!response.rankings || !Array.isArray(response.rankings)) {
      console.error('Invalid rerank response:', response);
      // 폴백: 원본 순서 유지하되 점수는 감소
      return chunks.slice(0, actualTopK).map((chunk, idx) => ({
        chunkId: chunk.id,
        relevanceScore: 1.0 - (idx * 0.1),
        reasoning: '재순위화 실패로 원본 순서 유지'
      }));
    }

    // 점수 검증 및 정규화
    const validatedRankings = response.rankings.map(ranking => ({
      ...ranking,
      relevanceScore: Math.max(0, Math.min(1, ranking.relevanceScore))
    }));

    // 점수 내림차순 정렬
    validatedRankings.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return validatedRankings.slice(0, actualTopK);
  } catch (error) {
    console.error('Reranking failed:', error);

    // 폴백: 원본 순서 유지하되 점수는 감소
    return chunks.slice(0, actualTopK).map((chunk, idx) => ({
      chunkId: chunk.id,
      relevanceScore: 1.0 - (idx * 0.1),
      reasoning: '재순위화 실패로 원본 순서 유지'
    }));
  }
}

/**
 * 간단한 재순위화 (빠른 실행용)
 *
 * LLM을 사용하지 않고 간단한 휴리스틱으로 재순위화
 *
 * @param query - 사용자 검색 쿼리
 * @param chunks - 재순위화할 청크 배열
 * @param topK - 반환할 상위 결과 개수
 * @returns 재순위화된 청크 배열
 */
export function simpleRerank(
  query: string,
  chunks: Array<{ id: number; content: string; title: string }>,
  topK: number = 5
): RerankResult[] {
  const queryTerms = query.toLowerCase().split(/\s+/);

  const scored = chunks.map(chunk => {
    const titleLower = chunk.title.toLowerCase();
    const contentLower = chunk.content.toLowerCase();

    let score = 0;

    // 제목에서 쿼리 용어 매칭 (가중치 높음)
    queryTerms.forEach(term => {
      if (titleLower.includes(term)) {
        score += 0.3;
      }
    });

    // 내용에서 쿼리 용어 매칭
    queryTerms.forEach(term => {
      const contentMatches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += Math.min(contentMatches * 0.1, 0.5);
    });

    // 청크 길이 고려 (너무 짧거나 너무 긴 것은 감점)
    const idealLength = 500;
    const lengthPenalty = Math.abs(chunk.content.length - idealLength) / idealLength;
    score *= (1 - Math.min(lengthPenalty * 0.2, 0.3));

    return {
      chunkId: chunk.id,
      relevanceScore: Math.min(score, 1.0),
      reasoning: `쿼리 용어 매칭 기반 점수: ${score.toFixed(2)}`
    };
  });

  // 점수 내림차순 정렬
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scored.slice(0, topK);
}
