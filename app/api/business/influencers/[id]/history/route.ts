/**
 * 인플루언서 히스토리 API
 *
 * GET /api/business/influencers/[id]/history - 방문/지원 히스토리 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 방문/지원 히스토리 조회
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'visits', 'supports', 'analyses'
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 인플루언서 존재 확인
    const influencer = await prisma.influencers.findUnique({
      where: { id: influencerId },
    });

    if (!influencer) {
      return NextResponse.json(
        { success: false, error: '인플루언서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const skip = (page - 1) * pageSize;

    // 타입별 조회
    if (type === 'visits') {
      const [visits, total] = await Promise.all([
        prisma.influencer_visits.findMany({
          where: { influencer_id: influencerId },
          include: {
            supports: {
              include: {
                procedure: {
                  select: { id: true, name: true, category: true },
                },
              },
            },
          },
          orderBy: { visit_date: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.influencer_visits.count({
          where: { influencer_id: influencerId },
        }),
      ]);

      const visitsFormatted = visits.map((v) => ({
        ...v,
        supports: v.supports.map((s) => ({
          ...s,
          procedure_cost: s.procedure_cost.toNumber(),
          supported_amount: s.supported_amount.toNumber(),
          client_payment: s.client_payment.toNumber(),
        })),
      }));

      return NextResponse.json({
        success: true,
        data: {
          items: visitsFormatted,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    }

    if (type === 'supports') {
      const [supports, total] = await Promise.all([
        prisma.influencer_procedure_supports.findMany({
          where: { influencer_id: influencerId },
          include: {
            procedure: {
              select: { id: true, name: true, category: true },
            },
            visit: {
              select: { id: true, visit_date: true, purpose: true },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.influencer_procedure_supports.count({
          where: { influencer_id: influencerId },
        }),
      ]);

      const supportsFormatted = supports.map((s) => ({
        ...s,
        procedure_cost: s.procedure_cost.toNumber(),
        supported_amount: s.supported_amount.toNumber(),
        client_payment: s.client_payment.toNumber(),
      }));

      return NextResponse.json({
        success: true,
        data: {
          items: supportsFormatted,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    }

    if (type === 'analyses') {
      const [analyses, total] = await Promise.all([
        prisma.influencer_analyses.findMany({
          where: { influencer_id: influencerId },
          orderBy: { analyzed_at: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.influencer_analyses.count({
          where: { influencer_id: influencerId },
        }),
      ]);

      const analysesFormatted = analyses.map((a) => ({
        ...a,
        tier_score: a.tier_score.toNumber(),
        instagram_engagement: a.instagram_engagement?.toNumber() ?? null,
        tiktok_engagement: a.tiktok_engagement?.toNumber() ?? null,
        recommended_support_min: a.recommended_support_min?.toNumber() ?? null,
        recommended_support_max: a.recommended_support_max?.toNumber() ?? null,
      }));

      return NextResponse.json({
        success: true,
        data: {
          items: analysesFormatted,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    }

    // 전체 히스토리 요약
    const [visits, supports, analyses, stats] = await Promise.all([
      prisma.influencer_visits.findMany({
        where: { influencer_id: influencerId },
        orderBy: { visit_date: 'desc' },
        take: 5,
      }),
      prisma.influencer_procedure_supports.findMany({
        where: { influencer_id: influencerId },
        include: {
          procedure: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 5,
      }),
      prisma.influencer_analyses.findMany({
        where: { influencer_id: influencerId },
        orderBy: { analyzed_at: 'desc' },
        take: 3,
      }),
      prisma.influencer_procedure_supports.aggregate({
        where: { influencer_id: influencerId },
        _sum: {
          supported_amount: true,
          procedure_cost: true,
        },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_visits: await prisma.influencer_visits.count({
            where: { influencer_id: influencerId },
          }),
          total_supports: stats._count,
          total_supported_amount: stats._sum.supported_amount?.toNumber() ?? 0,
          total_procedure_cost: stats._sum.procedure_cost?.toNumber() ?? 0,
        },
        recent_visits: visits,
        recent_supports: supports.map((s) => ({
          ...s,
          procedure_cost: s.procedure_cost.toNumber(),
          supported_amount: s.supported_amount.toNumber(),
          client_payment: s.client_payment.toNumber(),
        })),
        recent_analyses: analyses.map((a) => ({
          ...a,
          tier_score: a.tier_score.toNumber(),
        })),
      },
    });
  } catch (error) {
    console.error('인플루언서 히스토리 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '히스토리 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
