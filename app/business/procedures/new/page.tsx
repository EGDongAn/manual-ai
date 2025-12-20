'use client';

/**
 * 새 시술 등록 페이지
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CostComponent {
  cost_type: 'LABOR' | 'RENT' | 'MATERIAL' | 'EQUIPMENT' | 'OTHER';
  name: string;
  amount: number;
  unit: string;
  calculation: string;
}

const COST_TYPES = [
  { value: 'LABOR', label: '인건비' },
  { value: 'RENT', label: '임대비' },
  { value: 'MATERIAL', label: '재료비' },
  { value: 'EQUIPMENT', label: '장비비' },
  { value: 'OTHER', label: '기타' },
];

const CATEGORIES = [
  '안티에이징',
  '스킨부스터',
  '리프팅',
  '보톡스/필러',
  '레이저',
  '피부관리',
  '체형관리',
  '기타',
];

export default function NewProcedurePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기본 정보
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [baseCost, setBaseCost] = useState(0);
  const [requiresDoctor, setRequiresDoctor] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // 원가 구성요소
  const [costComponents, setCostComponents] = useState<CostComponent[]>([]);

  // 원가 구성요소 추가
  const addCostComponent = () => {
    setCostComponents([
      ...costComponents,
      {
        cost_type: 'LABOR',
        name: '',
        amount: 0,
        unit: '회당',
        calculation: '',
      },
    ]);
  };

  // 원가 구성요소 삭제
  const removeCostComponent = (index: number) => {
    setCostComponents(costComponents.filter((_, i) => i !== index));
  };

  // 원가 구성요소 수정
  const updateCostComponent = (
    index: number,
    field: keyof CostComponent,
    value: string | number
  ) => {
    const updated = [...costComponents];
    updated[index] = { ...updated[index], [field]: value };
    setCostComponents(updated);
  };

  // 총 원가 계산
  const totalCost =
    baseCost + costComponents.reduce((sum, c) => sum + c.amount, 0);

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const finalCategory =
        category === '기타' && customCategory ? customCategory : category;

      const res = await fetch('/api/business/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          name_en: nameEn || undefined,
          category: finalCategory,
          subcategory: subcategory || undefined,
          description: description || undefined,
          duration_minutes: durationMinutes,
          buffer_minutes: bufferMinutes,
          base_cost: baseCost,
          requires_doctor: requiresDoctor,
          is_active: isActive,
          cost_components: costComponents.filter((c) => c.name && c.amount > 0),
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/business/procedures/${data.data.id}`);
      } else {
        setError(data.error || '시술 등록에 실패했습니다.');
      }
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 금액 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/business/procedures"
          className="text-gray-600 hover:text-gray-900"
        >
          ← 시술 목록
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">새 시술 등록</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시술명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: 울쎄라"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                영문명
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: Ulthera"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리 <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">선택하세요</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {category === '기타' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mt-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="카테고리 직접 입력"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                세부 카테고리
              </label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: 눈가"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="시술에 대한 간략한 설명"
              />
            </div>
          </div>
        </div>

        {/* 시간 및 설정 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            시간 및 설정
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                소요시간 (분) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                required
                min={1}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                버퍼 시간 (분)
              </label>
              <input
                type="number"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(parseInt(e.target.value))}
                min={0}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                시술 후 정리/준비 시간
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requiresDoctor}
                  onChange={(e) => setRequiresDoctor(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">의사 시술 필수</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">활성화</span>
              </label>
            </div>
          </div>
        </div>

        {/* 원가 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">원가 구성</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              기본 원가 (₩)
            </label>
            <input
              type="number"
              value={baseCost}
              onChange={(e) => setBaseCost(parseInt(e.target.value) || 0)}
              min={0}
              className="w-full md:w-1/2 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 원가 구성요소 목록 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-700">
                세부 원가 항목
              </h3>
              <button
                type="button"
                onClick={addCostComponent}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + 항목 추가
              </button>
            </div>

            {costComponents.map((component, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 bg-gray-50 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        유형
                      </label>
                      <select
                        value={component.cost_type}
                        onChange={(e) =>
                          updateCostComponent(
                            index,
                            'cost_type',
                            e.target.value as CostComponent['cost_type']
                          )
                        }
                        className="w-full border rounded px-2 py-1 text-sm"
                      >
                        {COST_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        항목명
                      </label>
                      <input
                        type="text"
                        value={component.name}
                        onChange={(e) =>
                          updateCostComponent(index, 'name', e.target.value)
                        }
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="예: 의사 인건비"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        금액 (₩)
                      </label>
                      <input
                        type="number"
                        value={component.amount}
                        onChange={(e) =>
                          updateCostComponent(
                            index,
                            'amount',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full border rounded px-2 py-1 text-sm"
                        min={0}
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        단위
                      </label>
                      <input
                        type="text"
                        value={component.unit}
                        onChange={(e) =>
                          updateCostComponent(index, 'unit', e.target.value)
                        }
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="회당, 시간당"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeCostComponent(index)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    계산 방식 (메모)
                  </label>
                  <input
                    type="text"
                    value={component.calculation}
                    onChange={(e) =>
                      updateCostComponent(index, 'calculation', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1 text-sm"
                    placeholder="예: 시급 × 소요시간"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 총 원가 */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>총 원가</span>
              <span className="text-blue-600">₩{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-4">
          <Link
            href="/business/procedures"
            className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={loading || !name || !category}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '등록 중...' : '시술 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
