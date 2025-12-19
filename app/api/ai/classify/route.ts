import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateJSON } from '@/lib/ai/gemini';
import { getClassifyPrompt } from '@/lib/ai/prompts';
import type { ClassifyResult } from '@/lib/ai/types';

// POST /api/ai/classify - 자연어 입력을 카테고리로 분류
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content } = body;

    if (!title && !content) {
      return NextResponse.json(
        { error: '제목 또는 내용이 필요합니다.' },
        { status: 400 }
      );
    }

    // 모든 카테고리 조회 (부모 정보 포함)
    const categories = await prisma.manual_categories.findMany({
      include: {
        parent: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ parent_id: 'asc' }, { order: 'asc' }],
    });

    // 카테고리 정보 변환
    const categoryData = categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      parentName: c.parent?.name || null,
    }));

    // AI에게 분류 요청
    const prompt = getClassifyPrompt(title || '', content || '', categoryData);
    const result = await generateJSON<ClassifyResult>(prompt);

    // 결과 검증 및 보정
    const validatedRecommendations = result.recommendations
      .filter(r => {
        // categoryId가 null이면 새 카테고리 제안
        if (r.categoryId === null) return true;
        // 존재하는 카테고리인지 확인
        return categories.some(c => c.id === r.categoryId);
      })
      .slice(0, 3); // 최대 3개

    return NextResponse.json({
      recommendations: validatedRecommendations,
      newCategorySuggestion: result.newCategorySuggestion,
    });
  } catch (error) {
    console.error('카테고리 분류 실패:', error);
    return NextResponse.json(
      { error: '카테고리 분류에 실패했습니다.' },
      { status: 500 }
    );
  }
}
