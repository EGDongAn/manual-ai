import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/ai/gemini';
import { getSearchQAPrompt } from '@/lib/ai/prompts';
import { searchManualsForQA } from '@/lib/ai/vector-search';
import { getNoResultSuggestionPrompt, clinicInfo } from '@/lib/clinic-info';
import type { SearchResult } from '@/lib/ai/types';

// POST /api/ai/search - 시맨틱 검색 + Q&A
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 5 } = body;

    if (!query) {
      return NextResponse.json(
        { error: '검색어가 필요합니다.' },
        { status: 400 }
      );
    }

    // 1. 관련 매뉴얼 검색
    const relevantManuals = await searchManualsForQA(query, limit);

    if (relevantManuals.length === 0) {
      // AI 제안 생성
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
        });
      } catch {
        // AI 제안 실패 시 기본 응답
        return NextResponse.json({
          answer: `관련된 매뉴얼을 찾을 수 없습니다.\n\n**이지동안의원 문의**\n- 전화: ${clinicInfo.phone}\n- 홈페이지: ${clinicInfo.website}`,
          sources: [],
          confidence: 0,
          followUpQuestions: ['진료시간', '시그니처 시술', '예약 방법'],
          noManualFound: true,
        });
      }
    }

    // 2. AI에게 Q&A 요청
    const prompt = getSearchQAPrompt(
      query,
      relevantManuals.map(m => ({
        id: m.id,
        title: m.title,
        content: m.content,
        summary: m.summary,
        categoryName: m.categoryName,
      }))
    );

    const aiResult = await generateJSON<{
      answer: string;
      sources: {
        manualId: number;
        title: string;
        relevance: string;
      }[];
      confidence: number;
      followUpQuestions: string[];
    }>(prompt);

    // 3. 결과 조합
    const result: SearchResult = {
      answer: aiResult.answer,
      sources: aiResult.sources.map(s => {
        const manual = relevantManuals.find(m => m.id === s.manualId);
        return {
          manualId: s.manualId,
          title: s.title,
          categoryName: manual?.categoryName || null,
          relevance: s.relevance,
          excerpt: manual?.content.slice(0, 200) + '...' || '',
        };
      }),
      confidence: aiResult.confidence,
      followUpQuestions: aiResult.followUpQuestions,
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

    // 관련 매뉴얼 검색
    const results = await searchManualsForQA(query, limit);

    return NextResponse.json({
      query,
      results: results.map(m => ({
        id: m.id,
        title: m.title,
        summary: m.summary,
        categoryName: m.categoryName,
        similarity: m.similarity,
        excerpt: m.content.slice(0, 200) + '...',
      })),
    });
  } catch (error) {
    console.error('검색 실패:', error);
    return NextResponse.json(
      { error: '검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}
