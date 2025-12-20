/**
 * 시술 원가 계산 서비스
 *
 * 시술별 원가를 구성요소별로 계산하고 권장 가격을 산출합니다.
 */

import { prisma } from '@/lib/prisma';
import { CostType } from '@prisma/client';
import { CostBreakdown, ProcedureCostDetail } from './types';

// 기본 마진율 (33%)
const DEFAULT_MARGIN_RATE = 33;

/**
 * 시술 원가 구성요소를 타입별로 집계
 */
export function aggregateCostsByType(
  costs: Array<{ cost_type: CostType; amount: number | { toNumber(): number } }>
): CostBreakdown {
  const breakdown: CostBreakdown = {
    labor: 0,
    rent: 0,
    material: 0,
    equipment: 0,
    other: 0,
    total: 0,
  };

  for (const cost of costs) {
    const amount = typeof cost.amount === 'number'
      ? cost.amount
      : cost.amount.toNumber();

    switch (cost.cost_type) {
      case 'LABOR':
        breakdown.labor += amount;
        break;
      case 'RENT':
        breakdown.rent += amount;
        break;
      case 'MATERIAL':
        breakdown.material += amount;
        break;
      case 'EQUIPMENT':
        breakdown.equipment += amount;
        break;
      case 'OTHER':
        breakdown.other += amount;
        break;
    }
  }

  breakdown.total =
    breakdown.labor +
    breakdown.rent +
    breakdown.material +
    breakdown.equipment +
    breakdown.other;

  return breakdown;
}

/**
 * 시술 원가 상세 계산
 */
export async function calculateProcedureCost(
  procedureId: number,
  marginRate: number = DEFAULT_MARGIN_RATE
): Promise<ProcedureCostDetail | null> {
  const procedure = await prisma.procedures.findUnique({
    where: { id: procedureId },
    include: {
      cost_components: true,
      required_items: {
        include: {
          item: true,
        },
      },
    },
  });

  if (!procedure) {
    return null;
  }

  // 원가 구성요소 집계
  const costs = aggregateCostsByType(procedure.cost_components);

  // base_cost를 total에 추가 (기본 원가)
  const baseCost = procedure.base_cost.toNumber();
  costs.total += baseCost;

  // 권장 가격 계산 (원가 / (1 - 마진율))
  const recommendedPrice = Math.round(costs.total / (1 - marginRate / 100));

  return {
    procedure_id: procedure.id,
    name: procedure.name,
    duration_minutes: procedure.duration_minutes,
    costs,
    total_cost: costs.total,
    recommended_price: recommendedPrice,
    margin_rate: marginRate,
  };
}

/**
 * 여러 시술의 총 원가 계산
 */
export async function calculateTotalCost(
  procedureIds: number[]
): Promise<{
  procedures: ProcedureCostDetail[];
  total_cost: number;
  total_duration: number;
}> {
  const procedures: ProcedureCostDetail[] = [];
  let totalCost = 0;
  let totalDuration = 0;

  for (const id of procedureIds) {
    const cost = await calculateProcedureCost(id);
    if (cost) {
      procedures.push(cost);
      totalCost += cost.total_cost;
      totalDuration += cost.duration_minutes;
    }
  }

  return {
    procedures,
    total_cost: totalCost,
    total_duration: totalDuration,
  };
}

/**
 * 시술 카테고리별 평균 원가 조회
 */
export async function getAverageCostByCategory(): Promise<
  Array<{
    category: string;
    count: number;
    avg_cost: number;
    avg_duration: number;
  }>
> {
  const procedures = await prisma.procedures.findMany({
    where: { is_active: true },
    include: {
      cost_components: true,
    },
  });

  const categoryMap = new Map<
    string,
    { totalCost: number; totalDuration: number; count: number }
  >();

  for (const procedure of procedures) {
    const costs = aggregateCostsByType(procedure.cost_components);
    const totalCost = costs.total + procedure.base_cost.toNumber();

    const existing = categoryMap.get(procedure.category) || {
      totalCost: 0,
      totalDuration: 0,
      count: 0,
    };

    categoryMap.set(procedure.category, {
      totalCost: existing.totalCost + totalCost,
      totalDuration: existing.totalDuration + procedure.duration_minutes,
      count: existing.count + 1,
    });
  }

  return Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    avg_cost: Math.round(data.totalCost / data.count),
    avg_duration: Math.round(data.totalDuration / data.count),
  }));
}

/**
 * 인플루언서 지원금 계산
 */
export async function calculateInfluencerSupport(
  procedureId: number,
  tier: string,
  supportRateOverride?: number
): Promise<{
  procedure_cost: number;
  support_rate: number;
  supported_amount: number;
  client_payment: number;
} | null> {
  // 시술 원가 계산
  const costDetail = await calculateProcedureCost(procedureId);
  if (!costDetail) {
    return null;
  }

  // 등급별 정책 조회
  const policy = await prisma.tier_support_policies.findUnique({
    where: { tier: tier as 'SS' | 'S' | 'A' | 'B' | 'C' },
  });

  // 지원율 결정 (오버라이드 또는 정책 기준)
  const supportRate = supportRateOverride ?? policy?.support_rate_percent ?? 0;

  // 지원금 계산
  const supportedAmount = Math.round(costDetail.total_cost * (supportRate / 100));
  const clientPayment = costDetail.total_cost - supportedAmount;

  // 최대 지원금 제한 적용
  const maxSupport = policy?.max_support_per_visit.toNumber() ?? Infinity;
  const finalSupportedAmount = Math.min(supportedAmount, maxSupport);
  const finalClientPayment = costDetail.total_cost - finalSupportedAmount;

  return {
    procedure_cost: costDetail.total_cost,
    support_rate: supportRate,
    supported_amount: finalSupportedAmount,
    client_payment: finalClientPayment,
  };
}
