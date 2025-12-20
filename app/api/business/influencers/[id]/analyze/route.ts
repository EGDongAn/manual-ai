/**
 * 인플루언서 AI 분석 API
 *
 * POST /api/business/influencers/[id]/analyze - AI 등급 분석 실행
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeInfluencer } from '@/lib/business/tier-analyzer';
import { SNSMetrics } from '@/lib/business/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: AI 등급 분석 실행
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const influencerId = parseInt(id);

    if (isNaN(influencerId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 인플루언서 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const metrics: SNSMetrics = body.metrics || body;

    // 최소 하나의 SNS 메트릭 필요
    if (!metrics.instagram && !metrics.youtube && !metrics.tiktok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instagram, YouTube, TikTok 중 최소 하나의 메트릭이 필요합니다.',
        },
        { status: 400 }
      );
    }

    const result = await analyzeInfluencer(influencerId, metrics);

    if (!result) {
      return NextResponse.json(
        { success: false, error: '인플루언서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'AI 분석이 완료되었습니다.',
    });
  } catch (error) {
    console.error('인플루언서 분석 오류:', error);
    return NextResponse.json(
      { success: false, error: 'AI 분석에 실패했습니다.' },
      { status: 500 }
    );
  }
}
