/**
 * 시술 원가 상세 계산 API
 *
 * GET /api/business/procedures/[id]/cost - 시술 원가 상세 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateProcedureCost } from '@/lib/business/cost-calculator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 시술 원가 상세 계산
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const procedureId = parseInt(id);

    if (isNaN(procedureId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 시술 ID입니다.' },
        { status: 400 }
      );
    }

    // 마진율 파라미터 (기본: 33%)
    const { searchParams } = new URL(request.url);
    const marginRate = parseFloat(searchParams.get('margin_rate') || '33');

    const costDetail = await calculateProcedureCost(procedureId, marginRate);

    if (!costDetail) {
      return NextResponse.json(
        { success: false, error: '시술을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: costDetail,
    });
  } catch (error) {
    console.error('시술 원가 계산 오류:', error);
    return NextResponse.json(
      { success: false, error: '시술 원가 계산에 실패했습니다.' },
      { status: 500 }
    );
  }
}
