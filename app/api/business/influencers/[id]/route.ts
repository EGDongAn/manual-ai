/**
 * 인플루언서 API - 상세 조회, 수정, 삭제
 *
 * GET /api/business/influencers/[id] - 인플루언서 상세 조회
 * PUT /api/business/influencers/[id] - 인플루언서 수정
 * DELETE /api/business/influencers/[id] - 인플루언서 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InfluencerInput } from '@/lib/business/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 인플루언서 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const influencerId = parseInt(id);

    if (isNaN(influencerId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 인플루언서 ID입니다.' },
        { status: 400 }
      );
    }

    const influencer = await prisma.influencers.findUnique({
      where: { id: influencerId },
      include: {
        analyses: {
          orderBy: { analyzed_at: 'desc' },
          take: 5,
        },
        supports: {
          orderBy: { created_at: 'desc' },
          take: 10,
          include: {
            procedure: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
        },
        visits: {
          orderBy: { visit_date: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            analyses: true,
            supports: true,
            visits: true,
          },
        },
      },
    });

    if (!influencer) {
      return NextResponse.json(
        { success: false, error: '인플루언서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Decimal 변환
    const formatted = {
      ...influencer,
      tier_score: influencer.tier_score?.toNumber() ?? null,
      total_supported: influencer.total_supported.toNumber(),
      analyses: influencer.analyses.map((a) => ({
        ...a,
        tier_score: a.tier_score.toNumber(),
        instagram_engagement: a.instagram_engagement?.toNumber() ?? null,
        tiktok_engagement: a.tiktok_engagement?.toNumber() ?? null,
        recommended_support_min: a.recommended_support_min?.toNumber() ?? null,
        recommended_support_max: a.recommended_support_max?.toNumber() ?? null,
      })),
      supports: influencer.supports.map((s) => ({
        ...s,
        procedure_cost: s.procedure_cost.toNumber(),
        supported_amount: s.supported_amount.toNumber(),
        client_payment: s.client_payment.toNumber(),
      })),
    };

    return NextResponse.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('인플루언서 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '인플루언서 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 인플루언서 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const influencerId = parseInt(id);

    if (isNaN(influencerId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 인플루언서 ID입니다.' },
        { status: 400 }
      );
    }

    const body: Partial<InfluencerInput> & {
      is_active?: boolean;
      is_blacklisted?: boolean;
      blacklist_reason?: string;
    } = await request.json();

    // 인플루언서 존재 확인
    const existing = await prisma.influencers.findUnique({
      where: { id: influencerId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '인플루언서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updated = await prisma.influencers.update({
      where: { id: influencerId },
      data: {
        name: body.name,
        nickname: body.nickname,
        email: body.email,
        phone: body.phone,
        instagram_handle: body.instagram_handle,
        youtube_channel: body.youtube_channel,
        tiktok_handle: body.tiktok_handle,
        blog_url: body.blog_url,
        notes: body.notes,
        is_active: body.is_active,
        is_blacklisted: body.is_blacklisted,
        blacklist_reason: body.blacklist_reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        tier_score: updated.tier_score?.toNumber() ?? null,
        total_supported: updated.total_supported.toNumber(),
      },
      message: '인플루언서 정보가 수정되었습니다.',
    });
  } catch (error) {
    console.error('인플루언서 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: '인플루언서 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 인플루언서 삭제 (비활성화)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const influencerId = parseInt(id);

    if (isNaN(influencerId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 인플루언서 ID입니다.' },
        { status: 400 }
      );
    }

    // 인플루언서 존재 확인
    const existing = await prisma.influencers.findUnique({
      where: { id: influencerId },
      include: {
        supports: true,
        visits: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '인플루언서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 지원/방문 기록이 있으면 비활성화만 처리
    if (existing.supports.length > 0 || existing.visits.length > 0) {
      await prisma.influencers.update({
        where: { id: influencerId },
        data: { is_active: false },
      });

      return NextResponse.json({
        success: true,
        message: '기록이 있어 비활성화 처리되었습니다.',
      });
    }

    // 기록이 없으면 완전 삭제
    await prisma.influencers.delete({
      where: { id: influencerId },
    });

    return NextResponse.json({
      success: true,
      message: '인플루언서가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('인플루언서 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '인플루언서 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
