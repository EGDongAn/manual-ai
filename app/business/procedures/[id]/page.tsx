'use client';

/**
 * 시술 상세 페이지
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface CostComponent {
  id: number;
  cost_type: string;
  name: string;
  amount: number;
  unit: string | null;
  calculation: string | null;
}

interface Procedure {
  id: number;
  name: string;
  name_en: string | null;
  category: string;
  subcategory: string | null;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  base_cost: number;
  is_active: boolean;
  requires_doctor: boolean;
  created_at: string;
  updated_at: string;
  cost_components: CostComponent[];
}

interface CostDetail {
  procedure_id: number;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
  base_cost: number;
  costs: {
    labor: number;
    rent: number;
    material: number;
    equipment: number;
    other: number;
  };
  total_cost: number;
  margin_rate: number;
  recommended_price: number;
}

const COST_TYPE_LABELS: Record<string, string> = {
  LABOR: '인건비',
  RENT: '임대비',
  MATERIAL: '재료비',
  EQUIPMENT: '장비비',
  OTHER: '기타',
};

const COST_TYPE_COLORS: Record<string, string> = {
  LABOR: 'bg-blue-100 text-blue-800',
  RENT: 'bg-green-100 text-green-800',
  MATERIAL: 'bg-yellow-100 text-yellow-800',
  EQUIPMENT: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export default function ProcedureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [costDetail, setCostDetail] = useState<CostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marginRate, setMarginRate] = useState(33);

  useEffect(() => {
    fetchProcedure();
  }, [id]);

  useEffect(() => {
    if (procedure) {
      fetchCostDetail();
    }
  }, [procedure, marginRate]);

  const fetchProcedure = async () => {
    try {
      const res = await fetch(`/api/business/procedures/${id}`);
      const data = await res.json();

      if (data.success) {
        setProcedure(data.data);
      } else {
        setError(data.error || '시술 정보를 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCostDetail = async () => {
    try {
      const res = await fetch(
        `/api/business/procedures/${id}/cost?marginRate=${marginRate}`
      );
      const data = await res.json();

      if (data.success) {
        setCostDetail(data.data);
      }
    } catch {
      // 원가 상세 조회 실패는 무시
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !procedure) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || '시술을 찾을 수 없습니다.'}
        </div>
        <Link
          href="/business/procedures"
          className="inline-block mt-4 text-blue-600 hover:text-blue-800"
        >
          ← 시술 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <Link
          href="/business/procedures"
          className="text-gray-600 hover:text-gray-900"
        >
          ← 시술 목록
        </Link>

        <div className="flex justify-between items-start mt-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{procedure.name}</h1>
            {procedure.name_en && (
              <p className="text-gray-500 mt-1">{procedure.name_en}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/business/procedures/${id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              수정
            </Link>
          </div>
        </div>
      </div>

      {/* 기본 정보 카드 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <dt className="text-sm text-gray-500">카테고리</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {procedure.category}
              </span>
              {procedure.subcategory && (
                <span className="ml-2 text-gray-600">
                  / {procedure.subcategory}
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">소요시간</dt>
            <dd className="mt-1 font-medium">
              {formatDuration(procedure.duration_minutes)}
              <span className="text-gray-400 text-sm ml-1">
                (+{procedure.buffer_minutes}분)
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">상태</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                  procedure.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {procedure.is_active ? '활성' : '비활성'}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">의사 필수</dt>
            <dd className="mt-1 font-medium">
              {procedure.requires_doctor ? '예' : '아니오'}
            </dd>
          </div>
        </div>

        {procedure.description && (
          <div className="mt-6 pt-4 border-t">
            <dt className="text-sm text-gray-500 mb-2">설명</dt>
            <dd className="text-gray-700">{procedure.description}</dd>
          </div>
        )}
      </div>

      {/* 원가 분석 카드 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">원가 분석</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">마진율:</label>
            <input
              type="number"
              value={marginRate}
              onChange={(e) => setMarginRate(parseInt(e.target.value) || 0)}
              className="w-20 border rounded px-2 py-1 text-sm"
              min={0}
              max={100}
            />
            <span className="text-sm text-gray-600">%</span>
          </div>
        </div>

        {/* 원가 구성요소 */}
        {procedure.cost_components.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              세부 원가 항목
            </h3>
            <div className="space-y-2">
              {procedure.cost_components.map((component) => (
                <div
                  key={component.id}
                  className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        COST_TYPE_COLORS[component.cost_type] ||
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {COST_TYPE_LABELS[component.cost_type] ||
                        component.cost_type}
                    </span>
                    <span className="text-gray-900">{component.name}</span>
                    {component.unit && (
                      <span className="text-gray-400 text-sm">
                        ({component.unit})
                      </span>
                    )}
                  </div>
                  <span className="font-medium">
                    {formatCurrency(component.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 원가 요약 */}
        {costDetail && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="bg-blue-50 rounded p-3">
                <dt className="text-xs text-blue-600">인건비</dt>
                <dd className="text-lg font-semibold text-blue-900">
                  {formatCurrency(costDetail.costs.labor)}
                </dd>
              </div>
              <div className="bg-green-50 rounded p-3">
                <dt className="text-xs text-green-600">임대비</dt>
                <dd className="text-lg font-semibold text-green-900">
                  {formatCurrency(costDetail.costs.rent)}
                </dd>
              </div>
              <div className="bg-yellow-50 rounded p-3">
                <dt className="text-xs text-yellow-600">재료비</dt>
                <dd className="text-lg font-semibold text-yellow-900">
                  {formatCurrency(costDetail.costs.material)}
                </dd>
              </div>
              <div className="bg-purple-50 rounded p-3">
                <dt className="text-xs text-purple-600">장비비</dt>
                <dd className="text-lg font-semibold text-purple-900">
                  {formatCurrency(costDetail.costs.equipment)}
                </dd>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <dt className="text-xs text-gray-600">기타</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {formatCurrency(costDetail.costs.other)}
                </dd>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-100 rounded-lg p-4">
              <div>
                <dt className="text-sm text-gray-600">총 원가</dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {formatCurrency(costDetail.total_cost)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">마진율</dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {costDetail.margin_rate}%
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">권장 가격</dt>
                <dd className="text-2xl font-bold text-blue-600">
                  {formatCurrency(costDetail.recommended_price)}
                </dd>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 메타 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">등록 정보</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">등록일</dt>
            <dd className="text-gray-900">
              {new Date(procedure.created_at).toLocaleString('ko-KR')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">수정일</dt>
            <dd className="text-gray-900">
              {new Date(procedure.updated_at).toLocaleString('ko-KR')}
            </dd>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/business/procedures"
          className="text-gray-600 hover:text-gray-900"
        >
          ← 시술 목록
        </Link>
      </div>
    </div>
  );
}
