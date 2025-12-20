/**
 * 시술 API - 목록 조회 및 등록
 *
 * GET /api/business/procedures - 시술 목록 조회
 * POST /api/business/procedures - 시술 등록
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProcedureInput, ProcedureCostInput } from '@/lib/business/types';

// GET: 시술 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('is_active');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (isActive !== null) {
      where.is_active = isActive === 'true';
    }

    const [procedures, total] = await Promise.all([
      prisma.procedures.findMany({
        where,
        include: {
          cost_components: true,
          _count: {
            select: {
              required_items: true,
              required_equipment: true,
              manual_links: true,
            },
          },
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.procedures.count({ where }),
    ]);

    // 총 원가 계산 추가
    const proceduresWithCost = procedures.map((proc) => {
      const totalCost =
        proc.base_cost.toNumber() +
        proc.cost_components.reduce((sum, c) => sum + c.amount.toNumber(), 0);

      return {
        ...proc,
        base_cost: proc.base_cost.toNumber(),
        total_cost: totalCost,
        cost_components: proc.cost_components.map((c) => ({
          ...c,
          amount: c.amount.toNumber(),
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items: proceduresWithCost,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('시술 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '시술 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 시술 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      procedure,
      costs,
    }: {
      procedure: ProcedureInput;
      costs?: ProcedureCostInput[];
    } = body;

    // 필수 필드 검증
    if (!procedure.name || !procedure.category || !procedure.duration_minutes) {
      return NextResponse.json(
        {
          success: false,
          error: '시술명, 카테고리, 소요시간은 필수입니다.',
        },
        { status: 400 }
      );
    }

    // 트랜잭션으로 시술 및 원가 구성요소 생성
    const result = await prisma.$transaction(async (tx) => {
      // 시술 생성
      const newProcedure = await tx.procedures.create({
        data: {
          name: procedure.name,
          name_en: procedure.name_en,
          category: procedure.category,
          subcategory: procedure.subcategory,
          description: procedure.description,
          duration_minutes: procedure.duration_minutes,
          buffer_minutes: procedure.buffer_minutes ?? 10,
          base_cost: procedure.base_cost ?? 0,
          is_active: procedure.is_active ?? true,
          requires_doctor: procedure.requires_doctor ?? true,
        },
      });

      // 원가 구성요소 생성
      if (costs && costs.length > 0) {
        await tx.procedure_costs.createMany({
          data: costs.map((cost) => ({
            procedure_id: newProcedure.id,
            cost_type: cost.cost_type,
            name: cost.name,
            amount: cost.amount,
            unit: cost.unit,
            calculation: cost.calculation,
          })),
        });
      }

      // 생성된 시술 조회 (원가 구성요소 포함)
      return tx.procedures.findUnique({
        where: { id: newProcedure.id },
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
      message: '시술이 등록되었습니다.',
    });
  } catch (error) {
    console.error('시술 등록 오류:', error);
    return NextResponse.json(
      { success: false, error: '시술 등록에 실패했습니다.' },
      { status: 500 }
    );
  }
}
