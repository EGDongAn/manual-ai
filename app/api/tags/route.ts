import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/tags - 태그 목록 조회
export async function GET() {
  try {
    const tags = await prisma.manual_tags.findMany({
      include: {
        _count: {
          select: { manuals: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error('태그 목록 조회 실패:', error);
    return NextResponse.json(
      { error: '태그 목록을 조회하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/tags - 태그 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: '태그 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    // 중복 확인
    const existing = await prisma.manual_tags.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 태그입니다.' },
        { status: 400 }
      );
    }

    const tag = await prisma.manual_tags.create({
      data: { name },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('태그 생성 실패:', error);
    return NextResponse.json(
      { error: '태그를 생성하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/tags - 태그 삭제 (쿼리 파라미터로 ID 전달)
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '태그 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const tagId = parseInt(id);

    // 태그 존재 확인
    const existing = await prisma.manual_tags.findUnique({
      where: { id: tagId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '태그를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await prisma.manual_tags.delete({
      where: { id: tagId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('태그 삭제 실패:', error);
    return NextResponse.json(
      { error: '태그를 삭제하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
