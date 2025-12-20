'use client';

/**
 * 인플루언서 관리 페이지
 *
 * 인플루언서 목록 조회, 등록, AI 분석, 지원 기록 관리
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type InfluencerTier = 'SS' | 'S' | 'A' | 'B' | 'C';

interface Influencer {
  id: number;
  name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  instagram_handle: string | null;
  youtube_channel: string | null;
  tiktok_handle: string | null;
  blog_url: string | null;
  current_tier: InfluencerTier;
  tier_score: number | null;
  last_analyzed_at: string | null;
  total_visits: number;
  total_supported: number;
  notes: string | null;
  is_active: boolean;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  success: boolean;
  data: {
    items: Influencer[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

const TIER_COLORS: Record<InfluencerTier, string> = {
  SS: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
  S: 'bg-purple-500 text-white',
  A: 'bg-blue-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-gray-400 text-white',
};

const TIER_LABELS: Record<InfluencerTier, string> = {
  SS: 'SS (최상위)',
  S: 'S (상위)',
  A: 'A (중상위)',
  B: 'B (중위)',
  C: 'C (마이크로)',
};

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [tier, setTier] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 인플루언서 목록 조회
  const fetchInfluencers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (tier) params.set('tier', tier);
      if (!showInactive) params.set('active', 'true');
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/business/influencers?${params}`);
      const data: PaginatedResponse = await res.json();

      if (data.success) {
        setInfluencers(data.data.items);
        setTotalPages(data.data.totalPages);
        setTotal(data.data.total);
      } else {
        setError('인플루언서 목록을 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, tier, showInactive, searchQuery]);

  useEffect(() => {
    fetchInfluencers();
  }, [fetchInfluencers]);

  // 인플루언서 삭제
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 인플루언서를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/business/influencers/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        fetchInfluencers();
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    }
  };

  // AI 분석 요청
  const handleAnalyze = async (influencer: Influencer) => {
    if (
      !confirm(
        `"${influencer.name}" 인플루언서의 AI 분석을 요청하시겠습니까?\n\nSNS 정보를 기반으로 등급이 재산정됩니다.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/business/influencers/${influencer.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_url: influencer.instagram_handle
            ? `https://instagram.com/${influencer.instagram_handle}`
            : undefined,
          youtube_url: influencer.youtube_channel || undefined,
          tiktok_url: influencer.tiktok_handle
            ? `https://tiktok.com/@${influencer.tiktok_handle}`
            : undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        alert(
          `분석 완료!\n\n등급: ${data.data.tier}\n점수: ${data.data.score}점\n\n${data.data.summary || ''}`
        );
        fetchInfluencers();
      } else {
        alert(data.error || 'AI 분석에 실패했습니다.');
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">인플루언서 관리</h1>
          <p className="text-gray-600 mt-1">
            총 {total}명의 인플루언서가 등록되어 있습니다.
          </p>
        </div>
        <Link
          href="/business/influencers/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 새 인플루언서 등록
        </Link>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              검색
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="이름, 닉네임, SNS 핸들..."
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              등급
            </label>
            <select
              value={tier}
              onChange={(e) => {
                setTier(e.target.value);
                setPage(1);
              }}
              className="border rounded-lg px-3 py-2 min-w-[150px]"
            >
              <option value="">전체</option>
              {Object.entries(TIER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-6">
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
              비활성/블랙리스트 포함
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
      ) : influencers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          등록된 인플루언서가 없습니다.
        </div>
      ) : (
        <>
          {/* 인플루언서 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {influencers.map((influencer) => (
              <div
                key={influencer.id}
                className={`bg-white rounded-lg shadow overflow-hidden ${
                  influencer.is_blacklisted
                    ? 'ring-2 ring-red-500'
                    : !influencer.is_active
                      ? 'opacity-60'
                      : ''
                }`}
              >
                {/* 헤더 */}
                <div className="p-4 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {influencer.name}
                      </h3>
                      {influencer.nickname && (
                        <p className="text-gray-500 text-sm">
                          @{influencer.nickname}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${TIER_COLORS[influencer.current_tier]}`}
                    >
                      {influencer.current_tier}
                    </span>
                  </div>

                  {/* 블랙리스트 경고 */}
                  {influencer.is_blacklisted && (
                    <div className="mt-2 text-red-600 text-sm">
                      ⚠️ 블랙리스트: {influencer.blacklist_reason || '사유 없음'}
                    </div>
                  )}
                </div>

                {/* SNS 링크 */}
                <div className="px-4 py-3 bg-gray-50 flex flex-wrap gap-2">
                  {influencer.instagram_handle && (
                    <a
                      href={`https://instagram.com/${influencer.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-600 hover:text-pink-800 text-sm"
                    >
                      📸 Instagram
                    </a>
                  )}
                  {influencer.youtube_channel && (
                    <a
                      href={influencer.youtube_channel}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      ▶️ YouTube
                    </a>
                  )}
                  {influencer.tiktok_handle && (
                    <a
                      href={`https://tiktok.com/@${influencer.tiktok_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 hover:text-gray-700 text-sm"
                    >
                      🎵 TikTok
                    </a>
                  )}
                  {influencer.blog_url && (
                    <a
                      href={influencer.blog_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-800 text-sm"
                    >
                      📝 Blog
                    </a>
                  )}
                </div>

                {/* 통계 */}
                <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-gray-500">점수</div>
                    <div className="font-semibold">
                      {influencer.tier_score?.toFixed(1) || '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">방문</div>
                    <div className="font-semibold">{influencer.total_visits}회</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">총 지원</div>
                    <div className="font-semibold text-blue-600">
                      {formatCurrency(influencer.total_supported)}
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="px-4 py-3 border-t flex justify-between items-center">
                  <div className="flex gap-2">
                    <Link
                      href={`/business/influencers/${influencer.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      상세
                    </Link>
                    <button
                      onClick={() => handleAnalyze(influencer)}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      AI 분석
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(influencer.id, influencer.name)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    삭제
                  </button>
                </div>

                {/* 마지막 분석 */}
                {influencer.last_analyzed_at && (
                  <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500">
                    마지막 분석:{' '}
                    {new Date(influencer.last_analyzed_at).toLocaleDateString(
                      'ko-KR'
                    )}
                  </div>
                )}
              </div>
            ))}
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
          href="/business/procedures"
          className="text-blue-600 hover:text-blue-900"
        >
          시술 관리 →
        </Link>
      </div>
    </div>
  );
}
