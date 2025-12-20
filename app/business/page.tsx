'use client';

/**
 * 비즈니스 대시보드 페이지
 *
 * 시술 및 인플루언서 관리 시스템 메인 페이지
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  procedures: {
    total: number;
    active: number;
    avgCost: number;
  };
  influencers: {
    total: number;
    active: number;
    byTier: Record<string, number>;
    totalSupported: number;
  };
}

const TIER_COLORS: Record<string, string> = {
  SS: 'bg-gradient-to-r from-yellow-400 to-orange-500',
  S: 'bg-purple-500',
  A: 'bg-blue-500',
  B: 'bg-green-500',
  C: 'bg-gray-400',
};

export default function BusinessDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // 시술 통계
      const proceduresRes = await fetch('/api/business/procedures?pageSize=1');
      const proceduresData = await proceduresRes.json();

      // 인플루언서 통계
      const influencersRes = await fetch('/api/business/influencers?pageSize=100');
      const influencersData = await influencersRes.json();

      if (proceduresData.success && influencersData.success) {
        const influencers = influencersData.data.items;
        const tierCounts: Record<string, number> = { SS: 0, S: 0, A: 0, B: 0, C: 0 };
        let totalSupported = 0;
        let activeCount = 0;

        influencers.forEach((inf: { current_tier: string; total_supported: number; is_active: boolean }) => {
          if (inf.current_tier in tierCounts) {
            tierCounts[inf.current_tier]++;
          }
          totalSupported += inf.total_supported || 0;
          if (inf.is_active) activeCount++;
        });

        setStats({
          procedures: {
            total: proceduresData.data.total,
            active: proceduresData.data.total, // 간단히 처리
            avgCost: 0,
          },
          influencers: {
            total: influencersData.data.total,
            active: activeCount,
            byTier: tierCounts,
            totalSupported,
          },
        });
      }
    } catch (error) {
      console.error('통계 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">비즈니스 관리</h1>
        <p className="text-gray-600 mt-1">
          시술 원가 관리 및 인플루언서 협업 시스템
        </p>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          href="/business/procedures"
          className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-blue-500"
        >
          <div className="text-blue-500 text-2xl mb-2">💉</div>
          <h3 className="font-semibold text-gray-900">시술 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            시술 목록 및 원가 관리
          </p>
        </Link>

        <Link
          href="/business/procedures/new"
          className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-green-500"
        >
          <div className="text-green-500 text-2xl mb-2">➕</div>
          <h3 className="font-semibold text-gray-900">시술 등록</h3>
          <p className="text-sm text-gray-500 mt-1">새 시술 추가</p>
        </Link>

        <Link
          href="/business/influencers"
          className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-purple-500"
        >
          <div className="text-purple-500 text-2xl mb-2">⭐</div>
          <h3 className="font-semibold text-gray-900">인플루언서 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            인플루언서 목록 및 등급 관리
          </p>
        </Link>

        <Link
          href="/business/influencers/new"
          className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-orange-500"
        >
          <div className="text-orange-500 text-2xl mb-2">👤</div>
          <h3 className="font-semibold text-gray-900">인플루언서 등록</h3>
          <p className="text-sm text-gray-500 mt-1">새 인플루언서 추가</p>
        </Link>
      </div>

      {/* 통계 */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 시술 통계 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              시술 현황
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-600">
                  {stats.procedures.total}
                </div>
                <div className="text-sm text-gray-600">등록된 시술</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-600">
                  {stats.procedures.active}
                </div>
                <div className="text-sm text-gray-600">활성 시술</div>
              </div>
            </div>

            <Link
              href="/business/procedures"
              className="block mt-4 text-center text-blue-600 hover:text-blue-800 text-sm"
            >
              시술 목록 보기 →
            </Link>
          </div>

          {/* 인플루언서 통계 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              인플루언서 현황
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-3xl font-bold text-purple-600">
                  {stats.influencers.total}
                </div>
                <div className="text-sm text-gray-600">등록된 인플루언서</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-3xl font-bold text-orange-600">
                  {formatCurrency(stats.influencers.totalSupported)}
                </div>
                <div className="text-sm text-gray-600">총 지원금</div>
              </div>
            </div>

            {/* 등급별 분포 */}
            <div className="flex gap-2 mt-4">
              {Object.entries(stats.influencers.byTier).map(([tier, count]) => (
                <div
                  key={tier}
                  className={`flex-1 text-center p-2 rounded text-white ${TIER_COLORS[tier]}`}
                >
                  <div className="font-bold">{tier}</div>
                  <div className="text-sm opacity-90">{count}명</div>
                </div>
              ))}
            </div>

            <Link
              href="/business/influencers"
              className="block mt-4 text-center text-purple-600 hover:text-purple-800 text-sm"
            >
              인플루언서 목록 보기 →
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          통계를 불러오는데 실패했습니다.
        </div>
      )}

      {/* 기능 안내 */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🚀 주요 기능
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">💰 시술 원가 관리</h3>
            <p className="text-sm text-gray-600">
              인건비, 재료비, 임대비 등 세부 원가 항목을 관리하고 마진율 기반
              권장 가격을 자동 계산합니다.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">🤖 AI 등급 분석</h3>
            <p className="text-sm text-gray-600">
              인플루언서의 SNS 정보를 AI가 분석하여 팔로워, 참여율, 콘텐츠
              적합성 등을 기반으로 등급을 산정합니다.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">📊 지원 정책 관리</h3>
            <p className="text-sm text-gray-600">
              등급별 지원 한도, 지원율, 허용 시술 카테고리 등 세부 정책을
              설정하고 관리할 수 있습니다.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">📅 예약 시간 계산</h3>
            <p className="text-sm text-gray-600">
              시술별 소요시간과 버퍼시간을 고려하여 예약 슬롯을 자동으로
              계산합니다. (곧 지원 예정)
            </p>
          </div>

          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">🔗 API 연동</h3>
            <p className="text-sm text-gray-600">
              외부 예약 시스템, CRM 등과 REST API를 통해 데이터를 연동할 수
              있습니다.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">📈 협업 히스토리</h3>
            <p className="text-sm text-gray-600">
              인플루언서별 방문 기록, 시술 지원 내역, 콘텐츠 게시 현황을
              추적합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="mt-8">
        <Link href="/" className="text-gray-600 hover:text-gray-900">
          ← 메인으로
        </Link>
      </div>
    </div>
  );
}
