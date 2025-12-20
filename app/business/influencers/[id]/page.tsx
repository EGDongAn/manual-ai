'use client';

/**
 * 인플루언서 상세 페이지
 */

import { useState, useEffect, use } from 'react';
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

interface Analysis {
  id: number;
  calculated_tier: InfluencerTier;
  tier_score: number;
  instagram_followers: number | null;
  instagram_engagement: number | null;
  youtube_subscribers: number | null;
  youtube_avg_views: number | null;
  tiktok_followers: number | null;
  tiktok_engagement: number | null;
  analysis_summary: string | null;
  recommended_support_min: number | null;
  recommended_support_max: number | null;
  analyzed_at: string;
}

interface Visit {
  id: number;
  visit_date: string;
  purpose: string | null;
  content_posted: boolean;
  notes: string | null;
}

interface Support {
  id: number;
  procedure: { id: number; name: string } | null;
  procedure_cost: number;
  supported_amount: number;
  client_payment: number;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
}

interface HistoryData {
  summary: {
    total_visits: number;
    total_supports: number;
    total_supported_amount: number;
    total_procedure_cost: number;
  };
  recent_visits: Visit[];
  recent_supports: Support[];
  recent_analyses: Analysis[];
}

const TIER_COLORS: Record<InfluencerTier, string> = {
  SS: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
  S: 'bg-purple-500 text-white',
  A: 'bg-blue-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-gray-400 text-white',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: '예정', color: 'bg-yellow-100 text-yellow-800' },
  COMPLETED: { label: '완료', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '취소', color: 'bg-gray-100 text-gray-800' },
  NO_SHOW: { label: '노쇼', color: 'bg-red-100 text-red-800' },
};

export default function InfluencerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInfluencer();
    fetchHistory();
  }, [id]);

  const fetchInfluencer = async () => {
    try {
      const res = await fetch(`/api/business/influencers/${id}`);
      const data = await res.json();

      if (data.success) {
        setInfluencer(data.data);
      } else {
        setError(data.error || '인플루언서 정보를 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/business/influencers/${id}/history`);
      const data = await res.json();

      if (data.success) {
        setHistory(data.data);
      }
    } catch {
      // 히스토리 조회 실패는 무시
    }
  };

  const handleAnalyze = async () => {
    if (!influencer) return;

    if (
      !confirm(
        'AI 분석을 요청하시겠습니까?\n\nSNS 정보를 기반으로 등급이 재산정됩니다.'
      )
    )
      return;

    setAnalyzing(true);
    try {
      const res = await fetch(`/api/business/influencers/${id}/analyze`, {
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
        alert(`분석 완료!\n\n등급: ${data.data.tier}\n점수: ${data.data.score}점`);
        fetchInfluencer();
        fetchHistory();
      } else {
        alert(data.error || 'AI 분석에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleBlacklist = async () => {
    if (!influencer) return;

    const action = influencer.is_blacklisted ? '해제' : '등록';
    let reason = '';

    if (!influencer.is_blacklisted) {
      reason = prompt('블랙리스트 등록 사유를 입력하세요:') || '';
      if (!reason) return;
    }

    try {
      const res = await fetch(`/api/business/influencers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_blacklisted: !influencer.is_blacklisted,
          blacklist_reason: influencer.is_blacklisted ? null : reason,
        }),
      });
      const data = await res.json();

      if (data.success) {
        alert(`블랙리스트 ${action} 완료`);
        fetchInfluencer();
      } else {
        alert(data.error || `블랙리스트 ${action}에 실패했습니다.`);
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !influencer) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || '인플루언서를 찾을 수 없습니다.'}
        </div>
        <Link
          href="/business/influencers"
          className="inline-block mt-4 text-blue-600 hover:text-blue-800"
        >
          ← 인플루언서 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <Link
          href="/business/influencers"
          className="text-gray-600 hover:text-gray-900"
        >
          ← 인플루언서 목록
        </Link>

        <div className="flex justify-between items-start mt-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {influencer.name}
              </h1>
              {influencer.nickname && (
                <p className="text-gray-500 mt-1">@{influencer.nickname}</p>
              )}
            </div>
            <span
              className={`px-4 py-2 rounded-full text-lg font-bold ${TIER_COLORS[influencer.current_tier]}`}
            >
              {influencer.current_tier}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {analyzing ? '분석 중...' : '🔄 AI 재분석'}
            </button>
            <button
              onClick={handleToggleBlacklist}
              className={`px-4 py-2 rounded-lg ${
                influencer.is_blacklisted
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {influencer.is_blacklisted ? '블랙리스트 해제' : '블랙리스트 등록'}
            </button>
          </div>
        </div>

        {/* 블랙리스트 경고 */}
        {influencer.is_blacklisted && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            ⚠️ 블랙리스트 등록됨: {influencer.blacklist_reason || '사유 없음'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 기본 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 기본 정보 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              기본 정보
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">이메일</dt>
                <dd className="mt-1">{influencer.email || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">연락처</dt>
                <dd className="mt-1">{influencer.phone || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">상태</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                      influencer.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {influencer.is_active ? '활성' : '비활성'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">등급 점수</dt>
                <dd className="mt-1 font-semibold">
                  {influencer.tier_score?.toFixed(1) || '-'} / 100
                </dd>
              </div>
            </div>

            {influencer.notes && (
              <div className="mt-4 pt-4 border-t">
                <dt className="text-sm text-gray-500">메모</dt>
                <dd className="mt-1 text-gray-700">{influencer.notes}</dd>
              </div>
            )}
          </div>

          {/* SNS 정보 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              SNS 채널
            </h2>

            <div className="space-y-3">
              {influencer.instagram_handle && (
                <a
                  href={`https://instagram.com/${influencer.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90"
                >
                  <span className="text-xl">📸</span>
                  <div>
                    <div className="font-medium">Instagram</div>
                    <div className="text-sm opacity-90">
                      @{influencer.instagram_handle}
                    </div>
                  </div>
                </a>
              )}

              {influencer.youtube_channel && (
                <a
                  href={influencer.youtube_channel}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-red-600 text-white rounded-lg hover:opacity-90"
                >
                  <span className="text-xl">▶️</span>
                  <div>
                    <div className="font-medium">YouTube</div>
                    <div className="text-sm opacity-90 truncate max-w-xs">
                      {influencer.youtube_channel}
                    </div>
                  </div>
                </a>
              )}

              {influencer.tiktok_handle && (
                <a
                  href={`https://tiktok.com/@${influencer.tiktok_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gray-900 text-white rounded-lg hover:opacity-90"
                >
                  <span className="text-xl">🎵</span>
                  <div>
                    <div className="font-medium">TikTok</div>
                    <div className="text-sm opacity-90">
                      @{influencer.tiktok_handle}
                    </div>
                  </div>
                </a>
              )}

              {influencer.blog_url && (
                <a
                  href={influencer.blog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-green-600 text-white rounded-lg hover:opacity-90"
                >
                  <span className="text-xl">📝</span>
                  <div>
                    <div className="font-medium">Blog</div>
                    <div className="text-sm opacity-90 truncate max-w-xs">
                      {influencer.blog_url}
                    </div>
                  </div>
                </a>
              )}

              {!influencer.instagram_handle &&
                !influencer.youtube_channel &&
                !influencer.tiktok_handle &&
                !influencer.blog_url && (
                  <p className="text-gray-500">등록된 SNS 채널이 없습니다.</p>
                )}
            </div>
          </div>

          {/* 최근 분석 결과 */}
          {history?.recent_analyses && history.recent_analyses.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                최근 AI 분석 결과
              </h2>

              <div className="space-y-4">
                {history.recent_analyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="border rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${TIER_COLORS[analysis.calculated_tier]}`}
                      >
                        {analysis.calculated_tier} ({analysis.tier_score}점)
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(analysis.analyzed_at).toLocaleDateString(
                          'ko-KR'
                        )}
                      </span>
                    </div>

                    {analysis.analysis_summary && (
                      <p className="text-gray-700 text-sm mb-3">
                        {analysis.analysis_summary}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {analysis.instagram_followers && (
                        <div className="bg-white p-2 rounded">
                          <div className="text-gray-500">인스타 팔로워</div>
                          <div className="font-medium">
                            {analysis.instagram_followers.toLocaleString()}
                          </div>
                        </div>
                      )}
                      {analysis.youtube_subscribers && (
                        <div className="bg-white p-2 rounded">
                          <div className="text-gray-500">유튜브 구독자</div>
                          <div className="font-medium">
                            {analysis.youtube_subscribers.toLocaleString()}
                          </div>
                        </div>
                      )}
                      {analysis.recommended_support_min && (
                        <div className="bg-white p-2 rounded">
                          <div className="text-gray-500">권장 지원</div>
                          <div className="font-medium text-blue-600">
                            {formatCurrency(analysis.recommended_support_min)} ~{' '}
                            {formatCurrency(analysis.recommended_support_max || 0)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 통계 및 히스토리 */}
        <div className="space-y-6">
          {/* 통계 요약 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              협업 통계
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">총 방문</span>
                <span className="font-bold text-lg">
                  {history?.summary.total_visits || influencer.total_visits}회
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">총 시술</span>
                <span className="font-bold text-lg">
                  {history?.summary.total_supports || 0}건
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">총 지원금</span>
                <span className="font-bold text-lg text-blue-600">
                  {formatCurrency(
                    history?.summary.total_supported_amount ||
                      influencer.total_supported
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">총 시술비</span>
                <span className="font-bold text-lg">
                  {formatCurrency(history?.summary.total_procedure_cost || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 최근 방문 */}
          {history?.recent_visits && history.recent_visits.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                최근 방문
              </h2>

              <div className="space-y-3">
                {history.recent_visits.map((visit) => (
                  <div key={visit.id} className="border-l-4 border-blue-500 pl-3">
                    <div className="text-sm font-medium">
                      {new Date(visit.visit_date).toLocaleDateString('ko-KR')}
                    </div>
                    {visit.purpose && (
                      <div className="text-sm text-gray-600">{visit.purpose}</div>
                    )}
                    {visit.content_posted && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                        콘텐츠 게시됨
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 최근 지원 */}
          {history?.recent_supports && history.recent_supports.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                최근 시술 지원
              </h2>

              <div className="space-y-3">
                {history.recent_supports.map((support) => (
                  <div key={support.id} className="border rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">
                        {support.procedure?.name || '시술 정보 없음'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          STATUS_LABELS[support.status]?.color ||
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {STATUS_LABELS[support.status]?.label || support.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      지원: {formatCurrency(support.supported_amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 메타 정보 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              등록 정보
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">등록일</span>
                <span>
                  {new Date(influencer.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">마지막 분석</span>
                <span>
                  {influencer.last_analyzed_at
                    ? new Date(influencer.last_analyzed_at).toLocaleDateString(
                        'ko-KR'
                      )
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/business/influencers"
          className="text-gray-600 hover:text-gray-900"
        >
          ← 인플루언서 목록
        </Link>
      </div>
    </div>
  );
}
