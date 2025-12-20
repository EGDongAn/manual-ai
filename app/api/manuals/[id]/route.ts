import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createManualEmbedding, deleteManualEmbedding } from '@/lib/ai/embeddings';
import { reindexManual, deleteManualChunks } from '@/lib/ai/chunk-indexer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/manuals/[id] - 매뉴얼 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const manualId = parseInt(id);

    const manual = await prisma.manuals.findUnique({
      where: { id: manualId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parent: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
        versions: {
          orderBy: {
            version: 'desc',
          },
          take: 10,
        },
        attachments: true,
      },
    });

    if (!manual) {
      return NextResponse.json(
        { error: '매뉴얼을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 조회수 증가 (비동기)
    prisma.manuals.update({
      where: { id: manualId },
      data: { view_count: { increment: 1 } },
    }).catch(() => {});

    return NextResponse.json(manual);
  } catch (error) {
    console.error('매뉴얼 조회 실패:', error);
    return NextResponse.json(
      { error: '매뉴얼을 조회하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT /api/manuals/[id] - 매뉴얼 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const manualId = parseInt(id);
    const body = await request.json();
    const { title, content, summary, categoryId, tagIds, status, changeNote } = body;

    // 기존 매뉴얼 조회
    const existing = await prisma.manuals.findUnique({
      where: { id: manualId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '매뉴얼을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 버전 히스토리 저장 (내용이 변경된 경우)
    if (content && content !== existing.content) {
      await prisma.manual_versions.create({
        data: {
          manual_id: manualId,
          title: existing.title,
          content: existing.content,
          version: existing.version,
          change_note: changeNote || null,
        },
      });
    }

    // 매뉴얼 업데이트
    const manual = await prisma.manuals.update({
      where: { id: manualId },
      data: {
        title: title || existing.title,
        content: content || existing.content,
        summary: summary !== undefined ? summary : existing.summary,
        category_id: categoryId !== undefined ? (categoryId ? parseInt(categoryId) : null) : existing.category_id,
        status: status || existing.status,
        version: content && content !== existing.content ? existing.version + 1 : existing.version,
        tags: tagIds
          ? {
              set: tagIds.map((id: number) => ({ id })),
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

    // 임베딩 및 청킹 업데이트 (백그라운드)
    if (title !== existing.title || content !== existing.content) {
      Promise.all([
        createManualEmbedding(manual.id, manual.title, manual.content, manual.summary),
        reindexManual(manual.id),
      ]).catch(err => console.error('임베딩/청킹 업데이트 실패:', err));
    }

    return NextResponse.json(manual);
  } catch (error) {
    console.error('매뉴얼 수정 실패:', error);
    return NextResponse.json(
      { error: '매뉴얼을 수정하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/manuals/[id] - 매뉴얼 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const manualId = parseInt(id);

    // 매뉴얼 존재 확인
    const existing = await prisma.manuals.findUnique({
      where: { id: manualId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '매뉴얼을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 임베딩 및 청크 삭제
    await Promise.all([
      deleteManualEmbedding(manualId),
      deleteManualChunks(manualId),
    ]);

    // 매뉴얼 삭제 (관련 버전, 첨부파일도 CASCADE로 삭제됨)
    await prisma.manuals.delete({
      where: { id: manualId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('매뉴얼 삭제 실패:', error);
    return NextResponse.json(
      { error: '매뉴얼을 삭제하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
