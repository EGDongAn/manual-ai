/**
 * 인플루언서 API - 목록 조회 및 등록
 *
 * GET /api/business/influencers - 인플루언서 목록 조회
 * POST /api/business/influencers - 인플루언서 등록
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InfluencerTier } from '@prisma/client';
import { InfluencerInput } from '@/lib/business/types';

// GET: 인플루언서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier') as InfluencerTier | null;
    const isActive = searchParams.get('is_active');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const where: Record<string, unknown> = {};

    if (tier) {
      where.current_tier = tier;
    }

    if (isActive !== null) {
      where.is_active = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
        { instagram_handle: { contains: search, mode: 'insensitive' } },
        { youtube_channel: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [influencers, total] = await Promise.all([
      prisma.influencers.findMany({
        where,
        include: {
          _count: {
            select: {
              analyses: true,
              supports: true,
              visits: true,
            },
          },
        },
        orderBy: [
          { current_tier: 'asc' },
          { tier_score: 'desc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.influencers.count({ where }),
    ]);

    // Decimal 변환
    const influencersFormatted = influencers.map((inf) => ({
      ...inf,
      tier_score: inf.tier_score?.toNumber() ?? null,
      total_supported: inf.total_supported.toNumber(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: influencersFormatted,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('인플루언서 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '인플루언서 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 인플루언서 등록
export async function POST(request: NextRequest) {
  try {
    const body: InfluencerInput = await request.json();

    // 필수 필드 검증
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: '이름은 필수입니다.' },
        { status: 400 }
      );
    }

    const influencer = await prisma.influencers.create({
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
        current_tier: 'C', // 기본 등급
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...influencer,
        tier_score: influencer.tier_score?.toNumber() ?? null,
        total_supported: influencer.total_supported.toNumber(),
      },
      message: '인플루언서가 등록되었습니다.',
    });
  } catch (error) {
    console.error('인플루언서 등록 오류:', error);
    return NextResponse.json(
      { success: false, error: '인플루언서 등록에 실패했습니다.' },
      { status: 500 }
    );
  }
}
