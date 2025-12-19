import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createManualEmbedding } from '@/lib/ai/embeddings';

// GET /api/manuals - 매뉴얼 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // 필터 조건 구성
    const where: Record<string, unknown> = {};

    if (categoryId) {
      where.category_id = parseInt(categoryId);
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 총 개수 조회
    const total = await prisma.manuals.count({ where });

    // 매뉴얼 목록 조회
    const manuals = await prisma.manuals.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
      skip,
      take: limit,
    });

    return NextResponse.json({
      manuals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('매뉴얼 목록 조회 실패:', error);
    return NextResponse.json(
      { error: '매뉴얼 목록을 조회하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/manuals - 매뉴얼 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, summary, categoryId, tagIds, status } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 매뉴얼 생성
    const manual = await prisma.manuals.create({
      data: {
        title,
        content,
        summary: summary || null,
        category_id: categoryId ? parseInt(categoryId) : null,
        status: status || 'DRAFT',
        tags: tagIds
          ? {
              connect: tagIds.map((id: number) => ({ id })),
            }
          : undefined,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 임베딩 생성 (백그라운드)
    createManualEmbedding(manual.id, manual.title, manual.content, manual.summary)
      .catch(err => console.error('임베딩 생성 실패:', err));

    return NextResponse.json(manual, { status: 201 });
  } catch (error) {
    console.error('매뉴얼 생성 실패:', error);
    return NextResponse.json(
      { error: '매뉴얼을 생성하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
