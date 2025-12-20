/**
 * 예약 시간 계산 API
 *
 * POST /api/business/scheduling - 시술 조합 시간 계산 및 가용 슬롯 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface SchedulingRequest {
  procedure_ids: number[];
  date?: string; // YYYY-MM-DD
  start_time?: string; // HH:mm
  end_time?: string; // HH:mm
}

interface TimeSlot {
  start: string;
  end: string;
}

// POST: 시술 조합 시간 계산
export async function POST(request: NextRequest) {
  try {
    const body: SchedulingRequest = await request.json();
    const { procedure_ids, date, start_time = '09:00', end_time = '18:00' } = body;

    if (!procedure_ids || procedure_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '시술 ID를 지정해주세요.' },
        { status: 400 }
      );
    }

    // 시술 정보 조회
    const procedures = await prisma.procedures.findMany({
      where: {
        id: { in: procedure_ids },
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        duration_minutes: true,
        buffer_minutes: true,
        base_cost: true,
        requires_doctor: true,
      },
    });

    if (procedures.length === 0) {
      return NextResponse.json(
        { success: false, error: '유효한 시술을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 누락된 시술 ID 확인
    const foundIds = procedures.map((p) => p.id);
    const missingIds = procedure_ids.filter((id) => !foundIds.includes(id));

    // 시술 순서를 요청 순서대로 정렬
    const orderedProcedures = procedure_ids
      .map((id) => procedures.find((p) => p.id === id))
      .filter(Boolean);

    // 총 소요시간 계산 (시술시간 + 버퍼시간)
    let totalDuration = 0;
    let totalCost = 0;
    let requiresDoctor = false;

    const procedureDetails = orderedProcedures.map((p) => {
      const duration = p!.duration_minutes;
      const buffer = p!.buffer_minutes;
      const cost = Number(p!.base_cost);

      totalDuration += duration + buffer;
      totalCost += cost;

      if (p!.requires_doctor) {
        requiresDoctor = true;
      }

      return {
        id: p!.id,
        name: p!.name,
        duration: duration,
        buffer: buffer,
        cost: cost,
        requires_doctor: p!.requires_doctor,
      };
    });

    // 마지막 시술 후에는 버퍼 시간 제외
    if (orderedProcedures.length > 0) {
      const lastProcedure = orderedProcedures[orderedProcedures.length - 1];
      totalDuration -= lastProcedure!.buffer_minutes;
    }

    // 가용 슬롯 계산
    const availableSlots: TimeSlot[] = [];

    if (date) {
      // 영업 시간을 분으로 변환
      const [startHour, startMin] = start_time.split(':').map(Number);
      const [endHour, endMin] = end_time.split(':').map(Number);

      const dayStartMinutes = startHour * 60 + startMin;
      const dayEndMinutes = endHour * 60 + endMin;

      // TODO: 기존 예약 조회 및 제외 (현재는 단순 계산)
      // const existingBookings = await prisma.bookings.findMany({...});

      // 간단한 슬롯 계산 (30분 간격)
      const slotInterval = 30; // 분
      let currentStart = dayStartMinutes;

      while (currentStart + totalDuration <= dayEndMinutes) {
        const slotEnd = currentStart + totalDuration;

        // 점심시간 체크 (12:00-13:00)
        const lunchStart = 12 * 60;
        const lunchEnd = 13 * 60;

        const overlapWithLunch =
          (currentStart < lunchEnd && slotEnd > lunchStart);

        if (!overlapWithLunch) {
          availableSlots.push({
            start: minutesToTime(currentStart),
            end: minutesToTime(slotEnd),
          });
        }

        currentStart += slotInterval;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        procedures: procedureDetails,
        summary: {
          total_duration: totalDuration,
          total_duration_formatted: formatDuration(totalDuration),
          total_cost: totalCost,
          requires_doctor: requiresDoctor,
          procedure_count: procedureDetails.length,
        },
        available_slots: date ? availableSlots : null,
        missing_procedure_ids: missingIds.length > 0 ? missingIds : undefined,
        request: {
          date,
          operating_hours: {
            start: start_time,
            end: end_time,
          },
        },
      },
    });
  } catch (error) {
    console.error('예약 시간 계산 오류:', error);
    return NextResponse.json(
      { success: false, error: '예약 시간 계산에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 분을 시간 문자열로 변환
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// 분을 포맷팅된 시간으로 변환
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

// GET: 시술별 기본 정보 조회 (간단한 조회용)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    if (!ids) {
      return NextResponse.json(
        { success: false, error: '시술 ID를 지정해주세요.' },
        { status: 400 }
      );
    }

    const procedureIds = ids.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));

    const procedures = await prisma.procedures.findMany({
      where: {
        id: { in: procedureIds },
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        duration_minutes: true,
        buffer_minutes: true,
        base_cost: true,
        requires_doctor: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: procedures.map((p) => ({
        ...p,
        base_cost: Number(p.base_cost),
        total_time: p.duration_minutes + p.buffer_minutes,
      })),
    });
  } catch (error) {
    console.error('시술 정보 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '시술 정보 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
