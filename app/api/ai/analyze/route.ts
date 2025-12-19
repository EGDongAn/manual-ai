import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateJSON } from '@/lib/ai/gemini';
import { getAnalyzePrompt } from '@/lib/ai/prompts';
import { searchSimilarManuals, findPotentialDuplicates } from '@/lib/ai/vector-search';
import type { AnalyzeResult } from '@/lib/ai/types';

// POST /api/ai/analyze - 중복/연관성 분석
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, manualId } = body;

    if (!title && !content) {
      return NextResponse.json(
        { error: '제목 또는 내용이 필요합니다.' },
        { status: 400 }
      );
    }

    const searchText = `${title || ''}\n\n${content || ''}`;

    // 1. 고유사도 매뉴얼 검색 (중복 가능성)
    const potentialDuplicates = await findPotentialDuplicates(
      title || '',
      content || '',
      0.85
    );

    // 2. 유사한 매뉴얼 검색 (연관성)
    const similarManuals = await searchSimilarManuals(
      searchText,
      10,
      manualId ? [manualId] : []
    );

    // 매뉴얼이 없으면 빈 결과 반환
    if (similarManuals.length === 0 && potentialDuplicates.length === 0) {
      return NextResponse.json({
        isDuplicate: false,
        duplicateOf: null,
        duplicateReason: null,
        recommendation: 'CREATE_NEW',
        targetManualId: null,
        details: '유사한 기존 매뉴얼이 없습니다. 새로운 매뉴얼로 작성해주세요.',
        relatedManuals: [],
      });
    }

    // 3. AI에게 상세 분석 요청
    const prompt = getAnalyzePrompt(
      title || '',
      content || '',
      similarManuals.slice(0, 5) // 상위 5개만 전달
    );

    const aiResult = await generateJSON<{
      isDuplicate: boolean;
      duplicateOf: number | null;
      duplicateReason: string | null;
      recommendation: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'MERGE';
      targetManualId: number | null;
      details: string;
    }>(prompt);

    // 4. 결과 조합
    const result: AnalyzeResult = {
      isDuplicate: potentialDuplicates.length > 0 || aiResult.isDuplicate,
      duplicateOf: potentialDuplicates[0]?.id || aiResult.duplicateOf,
      duplicateReason:
        potentialDuplicates.length > 0
          ? `"${potentialDuplicates[0].title}" 매뉴얼과 ${Math.round(potentialDuplicates[0].similarity * 100)}% 유사합니다.`
          : aiResult.duplicateReason,
      recommendation: aiResult.recommendation,
      targetManualId: aiResult.targetManualId,
      details: aiResult.details,
      relatedManuals: similarManuals.filter(m => m.similarity >= 0.5),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('분석 실패:', error);
    return NextResponse.json(
      { error: '매뉴얼 분석에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// GET /api/ai/analyze - 기존 매뉴얼의 연관 매뉴얼 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const manualId = searchParams.get('manualId');

    if (!manualId) {
      return NextResponse.json(
        { error: '매뉴얼 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 매뉴얼 조회
    const manual = await prisma.manuals.findUnique({
      where: { id: parseInt(manualId) },
      select: {
        id: true,
        title: true,
        content: true,
      },
    });

    if (!manual) {
      return NextResponse.json(
        { error: '매뉴얼을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 유사 매뉴얼 검색
    const relatedManuals = await searchSimilarManuals(
      `${manual.title}\n\n${manual.content}`,
      5,
      [manual.id]
    );

    return NextResponse.json({ relatedManuals });
  } catch (error) {
    console.error('연관 매뉴얼 조회 실패:', error);
    return NextResponse.json(
      { error: '연관 매뉴얼 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
