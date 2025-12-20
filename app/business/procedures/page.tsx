'use client';

/**
 * 시술 관리 페이지
 *
 * 시술 목록 조회, 등록, 수정, 삭제 기능
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
}

interface PaginatedResponse {
  success: boolean;
  data: {
    items: Procedure[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export default function ProceduresPage() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // 시술 목록 조회
  const fetchProcedures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (category) params.set('category', category);
      if (!showInactive) params.set('active', 'true');

      const res = await fetch(`/api/business/procedures?${params}`);
      const data: PaginatedResponse = await res.json();

      if (data.success) {
        setProcedures(data.data.items);
        setTotalPages(data.data.totalPages);
        setTotal(data.data.total);

        // 카테고리 목록 추출
        const uniqueCategories = [
          ...new Set(data.data.items.map((p) => p.category)),
        ];
        setCategories((prev) => {
          const combined = [...new Set([...prev, ...uniqueCategories])];
          return combined.sort();
        });
      } else {
        setError('시술 목록을 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, category, showInactive]);

  useEffect(() => {
    fetchProcedures();
  }, [fetchProcedures]);

  // 시술 삭제
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 시술을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/business/procedures/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        fetchProcedures();
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    }
  };

  // 활성화/비활성화 토글
  const handleToggleActive = async (procedure: Procedure) => {
    try {
      const res = await fetch(`/api/business/procedures/${procedure.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !procedure.is_active }),
      });
      const data = await res.json();

      if (data.success) {
        fetchProcedures();
      } else {
        alert(data.error || '상태 변경에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    }
  };

  // 금액 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  // 시간 포맷
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">시술 관리</h1>
          <p className="text-gray-600 mt-1">
            총 {total}개의 시술이 등록되어 있습니다.
          </p>
        </div>
        <Link
          href="/business/procedures/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 새 시술 등록
        </Link>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="border rounded-lg px-3 py-2 min-w-[150px]"
            >
              <option value="">전체</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showInactive"
              checked={showInactive}
              onChange={(e) => {
                setShowInactive(e.target.checked);
                setPage(1);
              }}
              className="rounded"
            />
            <label htmlFor="showInactive" className="text-sm text-gray-700">
              비활성 시술 포함
            </label>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : procedures.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          등록된 시술이 없습니다.
        </div>
      ) : (
        <>
          {/* 시술 목록 테이블 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    시술명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    카테고리
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    소요시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기본원가
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {procedures.map((procedure) => (
                  <tr
                    key={procedure.id}
                    className={!procedure.is_active ? 'bg-gray-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">
                          {procedure.name}
                        </div>
                        {procedure.name_en && (
                          <div className="text-sm text-gray-500">
                            {procedure.name_en}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {procedure.category}
                      </span>
                      {procedure.subcategory && (
                        <span className="ml-1 text-sm text-gray-500">
                          / {procedure.subcategory}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(procedure.duration_minutes)}
                      <span className="text-gray-400 text-xs ml-1">
                        (+{procedure.buffer_minutes}분 버퍼)
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(procedure.base_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(procedure)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          procedure.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {procedure.is_active ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Link
                        href={`/business/procedures/${procedure.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        상세
                      </Link>
                      <Link
                        href={`/business/procedures/${procedure.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        수정
                      </Link>
                      <button
                        onClick={() => handleDelete(procedure.id, procedure.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                이전
              </button>
              <span className="text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {/* 네비게이션 */}
      <div className="mt-8 flex gap-4">
        <Link href="/business" className="text-gray-600 hover:text-gray-900">
          ← 비즈니스 대시보드
        </Link>
        <Link
          href="/business/influencers"
          className="text-blue-600 hover:text-blue-900"
        >
          인플루언서 관리 →
        </Link>
      </div>
    </div>
  );
}
