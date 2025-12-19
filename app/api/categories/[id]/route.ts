import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/categories/[id] - 카테고리 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    const category = await prisma.manual_categories.findUnique({
      where: { id: categoryId },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          orderBy: { order: 'asc' },
        },
        manuals: {
          select: {
            id: true,
            title: true,
            status: true,
            updated_at: true,
          },
          orderBy: { updated_at: 'desc' },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('카테고리 조회 실패:', error);
    return NextResponse.json(
      { error: '카테고리를 조회하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT /api/categories/[id] - 카테고리 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);
    const body = await request.json();
    const { name, description, parentId, order } = body;

    // 기존 카테고리 확인
    const existing = await prisma.manual_categories.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 자기 자신을 부모로 설정하는 것 방지
    if (parentId && parseInt(parentId) === categoryId) {
      return NextResponse.json(
        { error: '카테고리를 자기 자신의 하위로 이동할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 동일 부모 아래 같은 이름 확인 (자기 자신 제외)
    if (name) {
      const duplicate = await prisma.manual_categories.findFirst({
        where: {
          name,
          parent_id: parentId !== undefined ? (parentId ? parseInt(parentId) : null) : existing.parent_id,
          id: { not: categoryId },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: '같은 위치에 동일한 이름의 카테고리가 있습니다.' },
          { status: 400 }
        );
      }
    }

    const category = await prisma.manual_categories.update({
      where: { id: categoryId },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        parent_id: parentId !== undefined ? (parentId ? parseInt(parentId) : null) : existing.parent_id,
        order: order !== undefined ? order : existing.order,
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

    return NextResponse.json(category);
  } catch (error) {
    console.error('카테고리 수정 실패:', error);
    return NextResponse.json(
      { error: '카테고리를 수정하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id] - 카테고리 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    // 카테고리 확인
    const existing = await prisma.manual_categories.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            children: true,
            manuals: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 하위 카테고리가 있는 경우
    if (existing._count.children > 0) {
      return NextResponse.json(
        { error: '하위 카테고리가 있어 삭제할 수 없습니다. 하위 카테고리를 먼저 삭제하세요.' },
        { status: 400 }
      );
    }

    // 매뉴얼이 있는 경우
    if (existing._count.manuals > 0) {
      return NextResponse.json(
        { error: '이 카테고리에 속한 매뉴얼이 있어 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    await prisma.manual_categories.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('카테고리 삭제 실패:', error);
    return NextResponse.json(
      { error: '카테고리를 삭제하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
