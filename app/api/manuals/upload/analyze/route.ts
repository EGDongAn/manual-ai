import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getModel } from '@/lib/ai/gemini';
import { getUploadAnalysisPrompt } from '@/lib/ai/prompts';

// POST /api/manuals/upload/analyze - 업로드된 콘텐츠 AI 분석
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, filename } = body as {
      content: string;
      filename?: string;
    };

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: '분석할 콘텐츠가 필요합니다.' },
        { status: 400 }
      );
    }

    // 카테고리 목록 조회
    const categories = await prisma.manual_categories.findMany({
      include: {
        parent: {
          select: { name: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    const mappedCategories = categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      parentName: c.parent?.name || null,
    }));

    // AI 분석 수행
    const model = getModel();
    const prompt = getUploadAnalysisPrompt(content, filename, mappedCategories);

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // JSON 파싱 시도
    try {
      // JSON 블록 추출 (마크다운 코드 블록 처리)
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const analysisResult = JSON.parse(jsonText);

      return NextResponse.json({
        success: true,
        data: {
          title: analysisResult.title || '제목 없음',
          summary: analysisResult.summary || '',
          content: analysisResult.structuredContent || content,
          categoryRecommendations: analysisResult.categoryRecommendations || [],
          tags: analysisResult.tags || [],
          qualityScore: analysisResult.qualityScore || null,
          suggestions: analysisResult.suggestions || [],
        },
      });
    } catch {
      // JSON 파싱 실패 시 기본 응답
      console.error('AI 응답 파싱 실패, 기본 처리');
      return NextResponse.json({
        success: true,
        data: {
          title: filename?.replace(/\.[^/.]+$/, '') || '업로드된 매뉴얼',
          summary: content.slice(0, 200) + '...',
          content: content,
          categoryRecommendations: [],
          tags: [],
          qualityScore: null,
          suggestions: ['AI 분석을 완료하지 못했습니다. 수동으로 분류해 주세요.'],
        },
      });
    }
  } catch (error) {
    console.error('업로드 분석 실패:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: '콘텐츠 분석에 실패했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}
