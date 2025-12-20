/**
 * 시술 API - 상세 조회, 수정, 삭제
 *
 * GET /api/business/procedures/[id] - 시술 상세 조회
 * PUT /api/business/procedures/[id] - 시술 수정
 * DELETE /api/business/procedures/[id] - 시술 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProcedureInput, ProcedureCostInput } from '@/lib/business/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 시술 상세 조회
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

    const procedure = await prisma.procedures.findUnique({
      where: { id: procedureId },
      include: {
        cost_components: true,
        required_items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                unit: true,
                category: true,
              },
            },
          },
        },
        required_equipment: true,
        manual_links: {
          include: {
            manual: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!procedure) {
      return NextResponse.json(
        { success: false, error: '시술을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 총 원가 계산
    const totalCost =
      procedure.base_cost.toNumber() +
      procedure.cost_components.reduce((sum, c) => sum + c.amount.toNumber(), 0);

    return NextResponse.json({
      success: true,
      data: {
        ...procedure,
        base_cost: procedure.base_cost.toNumber(),
        total_cost: totalCost,
        cost_components: procedure.cost_components.map((c) => ({
          ...c,
          amount: c.amount.toNumber(),
        })),
        required_items: procedure.required_items.map((i) => ({
          ...i,
          quantity: i.quantity.toNumber(),
        })),
      },
    });
  } catch (error) {
    console.error('시술 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '시술 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 시술 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const procedureId = parseInt(id);

    if (isNaN(procedureId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 시술 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      procedure,
      costs,
    }: {
      procedure: Partial<ProcedureInput>;
      costs?: ProcedureCostInput[];
    } = body;

    // 시술 존재 확인
    const existing = await prisma.procedures.findUnique({
      where: { id: procedureId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '시술을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 트랜잭션으로 시술 및 원가 구성요소 수정
    const result = await prisma.$transaction(async (tx) => {
      // 시술 정보 수정
      const updated = await tx.procedures.update({
        where: { id: procedureId },
        data: {
          name: procedure.name,
          name_en: procedure.name_en,
          category: procedure.category,
          subcategory: procedure.subcategory,
          description: procedure.description,
          duration_minutes: procedure.duration_minutes,
          buffer_minutes: procedure.buffer_minutes,
          base_cost: procedure.base_cost,
          is_active: procedure.is_active,
          requires_doctor: procedure.requires_doctor,
        },
      });

      // 원가 구성요소 수정 (기존 삭제 후 새로 생성)
      if (costs !== undefined) {
        await tx.procedure_costs.deleteMany({
          where: { procedure_id: procedureId },
        });

        if (costs.length > 0) {
          await tx.procedure_costs.createMany({
            data: costs.map((cost) => ({
              procedure_id: procedureId,
              cost_type: cost.cost_type,
              name: cost.name,
              amount: cost.amount,
              unit: cost.unit,
              calculation: cost.calculation,
            })),
          });
        }
      }

      // 수정된 시술 조회
      return tx.procedures.findUnique({
        where: { id: procedureId },
        include: {
          cost_components: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        base_cost: result?.base_cost.toNumber(),
        cost_components: result?.cost_components.map((c) => ({
          ...c,
          amount: c.amount.toNumber(),
        })),
      },
      message: '시술이 수정되었습니다.',
    });
  } catch (error) {
    console.error('시술 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: '시술 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 시술 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const procedureId = parseInt(id);

    if (isNaN(procedureId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 시술 ID입니다.' },
        { status: 400 }
      );
    }

    // 시술 존재 확인
    const existing = await prisma.procedures.findUnique({
      where: { id: procedureId },
      include: {
        influencer_supports: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '시술을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 인플루언서 지원 기록이 있는 경우 비활성화만 허용
    if (existing.influencer_supports.length > 0) {
      await prisma.procedures.update({
        where: { id: procedureId },
        data: { is_active: false },
      });

      return NextResponse.json({
        success: true,
        message: '지원 기록이 있어 비활성화 처리되었습니다.',
      });
    }

    // 시술 삭제 (관련 데이터도 cascade 삭제)
    await prisma.procedures.delete({
      where: { id: procedureId },
    });

    return NextResponse.json({
      success: true,
      message: '시술이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('시술 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '시술 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
