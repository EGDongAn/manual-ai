import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/categories - 카테고리 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tree = searchParams.get('tree') === 'true';

    if (tree) {
      // 트리 구조로 반환
      const categories = await prisma.manual_categories.findMany({
        where: { parent_id: null },
        include: {
          children: {
            include: {
              children: {
                include: {
                  children: true, // 3단계까지
                },
              },
            },
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { manuals: true },
          },
        },
        orderBy: { order: 'asc' },
      });

      return NextResponse.json(categories);
    }

    // 플랫 목록으로 반환
    const categories = await prisma.manual_categories.findMany({
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { manuals: true },
        },
      },
      orderBy: [{ parent_id: 'asc' }, { order: 'asc' }],
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('카테고리 목록 조회 실패:', error);
    return NextResponse.json(
      { error: '카테고리 목록을 조회하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/categories - 카테고리 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, parentId, order } = body;

    if (!name) {
      return NextResponse.json(
        { error: '카테고리 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    // 동일 부모 아래 같은 이름 확인
    const existing = await prisma.manual_categories.findFirst({
      where: {
        name,
        parent_id: parentId ? parseInt(parentId) : null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: '같은 위치에 동일한 이름의 카테고리가 있습니다.' },
        { status: 400 }
      );
    }

    // 순서 계산 (미지정시 마지막)
    let categoryOrder = order;
    if (categoryOrder === undefined) {
      const lastCategory = await prisma.manual_categories.findFirst({
        where: { parent_id: parentId ? parseInt(parentId) : null },
        orderBy: { order: 'desc' },
      });
      categoryOrder = lastCategory ? lastCategory.order + 1 : 0;
    }

    const category = await prisma.manual_categories.create({
      data: {
        name,
        description: description || null,
        parent_id: parentId ? parseInt(parentId) : null,
        order: categoryOrder,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('카테고리 생성 실패:', error);
    return NextResponse.json(
      { error: '카테고리를 생성하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
