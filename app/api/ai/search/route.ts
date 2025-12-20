import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/ai/gemini';
import { executeRAGPipeline, quickRAGSearch, premiumRAGSearch } from '@/lib/ai/rag-pipeline';
import { getNoResultSuggestionPrompt, clinicInfo } from '@/lib/clinic-info';
import { recordUserFeedback } from '@/lib/ai/metrics';
import type { SearchResult } from '@/lib/ai/types';

// POST /api/ai/search - 시맨틱 검색 + Q&A (RAG 파이프라인)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 5, mode = 'standard' } = body;

    if (!query) {
      return NextResponse.json(
        { error: '검색어가 필요합니다.' },
        { status: 400 }
      );
    }

    // RAG 파이프라인 실행 (모드에 따라 선택)
    let ragResult;
    switch (mode) {
      case 'quick':
        ragResult = await quickRAGSearch(query);
        break;
      case 'premium':
        ragResult = await premiumRAGSearch(query);
        break;
      default:
        ragResult = await executeRAGPipeline(query, {
          hybridSearchLimit: limit * 3,
          rerankTopK: limit,
          enableCache: true,
          enableRerank: true,
          enableMetrics: true,
        });
    }

    // 검색 결과 없음 처리
    if (ragResult.chunks.length === 0) {
      try {
        const suggestionPrompt = getNoResultSuggestionPrompt(query);
        const suggestion = await generateJSON<{
          suggestion: string;
          relatedServices: string[];
          alternativeQueries: string[];
          contactRecommended: boolean;
        }>(suggestionPrompt);

        return NextResponse.json({
          answer: suggestion.suggestion,
          sources: [],
          confidence: 0,
          followUpQuestions: suggestion.alternativeQueries,
          aiSuggestion: {
            relatedServices: suggestion.relatedServices,
            contactRecommended: suggestion.contactRecommended,
            clinicPhone: clinicInfo.phone,
            clinicWebsite: clinicInfo.website,
          },
          noManualFound: true,
          queryId: ragResult.queryId,
          metrics: ragResult.metrics,
        });
      } catch {
        return NextResponse.json({
          answer: `관련된 매뉴얼을 찾을 수 없습니다.\n\n**이지동안의원 문의**\n- 전화: ${clinicInfo.phone}\n- 홈페이지: ${clinicInfo.website}`,
          sources: [],
          confidence: 0,
          followUpQuestions: ['진료시간', '시그니처 시술', '예약 방법'],
          noManualFound: true,
          queryId: ragResult.queryId,
        });
      }
    }

    // RAG 결과를 기존 API 형식으로 변환
    const result: SearchResult & {
      queryId: string;
      reasoning?: object;
      metrics?: object;
      limitations?: string;
    } = {
      answer: ragResult.response.answer,
      sources: ragResult.response.sources.map(s => {
        const chunk = ragResult.chunks.find(c => c.manualId === s.manualId);
        return {
          manualId: s.manualId,
          title: s.title,
          categoryName: null,
          relevance: s.relevance,
          excerpt: chunk?.content.slice(0, 200) + '...' || '',
        };
      }),
      confidence: ragResult.response.confidence,
      followUpQuestions: ragResult.response.followUpQuestions,
      queryId: ragResult.queryId,
      reasoning: ragResult.response.reasoning,
      limitations: ragResult.response.limitations,
      metrics: ragResult.metrics,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('검색 실패:', error);
    return NextResponse.json(
      { error: '검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT /api/ai/search - 검색 피드백 제출
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { queryId, feedback } = body;

    if (!queryId || !feedback) {
      return NextResponse.json(
        { error: 'queryId와 feedback이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!['helpful', 'not_helpful'].includes(feedback)) {
      return NextResponse.json(
        { error: 'feedback은 helpful 또는 not_helpful이어야 합니다.' },
        { status: 400 }
      );
    }

    await recordUserFeedback(queryId, feedback);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('피드백 저장 실패:', error);
    return NextResponse.json(
      { error: '피드백 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// GET /api/ai/search - 간단한 시맨틱 검색 (Q&A 없이)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json(
        { error: '검색어가 필요합니다.' },
        { status: 400 }
      );
    }

    // Hybrid 검색 사용 (RAG 파이프라인의 간소화 버전)
    const ragResult = await quickRAGSearch(query);

    // 결과를 간단한 형식으로 변환
    const uniqueManuals = new Map<number, {
      id: number;
      title: string;
      summary: string | null;
      categoryName: string | null;
      combinedScore: number;
      excerpt: string;
    }>();

    for (const chunk of ragResult.chunks.slice(0, limit)) {
      if (!uniqueManuals.has(chunk.manualId)) {
        uniqueManuals.set(chunk.manualId, {
          id: chunk.manualId,
          title: chunk.manualTitle,
          summary: null,
          categoryName: null,
          combinedScore: chunk.combinedScore,
          excerpt: chunk.content.slice(0, 200) + '...',
        });
      }
    }

    return NextResponse.json({
      query,
      results: Array.from(uniqueManuals.values()),
    });
  } catch (error) {
    console.error('검색 실패:', error);
    return NextResponse.json(
      { error: '검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}
