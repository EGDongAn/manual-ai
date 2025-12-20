'use client';

/**
 * 새 인플루언서 등록 페이지
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type InfluencerTier = 'SS' | 'S' | 'A' | 'B' | 'C';

const TIERS: { value: InfluencerTier; label: string; description: string }[] = [
  { value: 'SS', label: 'SS (최상위)', description: '100만+ 팔로워' },
  { value: 'S', label: 'S (상위)', description: '50만-100만 팔로워' },
  { value: 'A', label: 'A (중상위)', description: '10만-50만 팔로워' },
  { value: 'B', label: 'B (중위)', description: '1만-10만 팔로워' },
  { value: 'C', label: 'C (마이크로)', description: '1만 미만 팔로워' },
];

export default function NewInfluencerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기본 정보
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // SNS 정보
  const [instagramHandle, setInstagramHandle] = useState('');
  const [youtubeChannel, setYoutubeChannel] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [blogUrl, setBlogUrl] = useState('');

  // 등급 정보
  const [currentTier, setCurrentTier] = useState<InfluencerTier>('C');

  // 기타
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/business/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nickname: nickname || undefined,
          email: email || undefined,
          phone: phone || undefined,
          instagram_handle: instagramHandle || undefined,
          youtube_channel: youtubeChannel || undefined,
          tiktok_handle: tiktokHandle || undefined,
          blog_url: blogUrl || undefined,
          current_tier: currentTier,
          notes: notes || undefined,
          is_active: isActive,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/business/influencers/${data.data.id}`);
      } else {
        setError(data.error || '인플루언서 등록에 실패했습니다.');
      }
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/business/influencers"
          className="text-gray-600 hover:text-gray-900"
        >
          ← 인플루언서 목록
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          새 인플루언서 등록
        </h1>
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
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="홍길동"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                활동명 (닉네임)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="뷰티크리에이터홍"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="example@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연락처
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="010-1234-5678"
              />
            </div>
          </div>
        </div>

        {/* SNS 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">SNS 정보</h2>
          <p className="text-sm text-gray-500 mb-4">
            AI 분석을 위해 최소 하나의 SNS 정보를 입력해주세요.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📸 Instagram 핸들
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 bg-gray-50 text-gray-500 text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  className="flex-1 border rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ▶️ YouTube 채널 URL
              </label>
              <input
                type="url"
                value={youtubeChannel}
                onChange={(e) => setYoutubeChannel(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://youtube.com/@channel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🎵 TikTok 핸들
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 bg-gray-50 text-gray-500 text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={tiktokHandle}
                  onChange={(e) => setTiktokHandle(e.target.value)}
                  className="flex-1 border rounded-r-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 블로그 URL
              </label>
              <input
                type="url"
                value={blogUrl}
                onChange={(e) => setBlogUrl(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://blog.naver.com/username"
              />
            </div>
          </div>
        </div>

        {/* 등급 설정 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            초기 등급 설정
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            등록 후 AI 분석을 통해 정확한 등급을 산정할 수 있습니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {TIERS.map((tier) => (
              <label
                key={tier.value}
                className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-colors ${
                  currentTier === tier.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  value={tier.value}
                  checked={currentTier === tier.value}
                  onChange={(e) =>
                    setCurrentTier(e.target.value as InfluencerTier)
                  }
                  className="sr-only"
                />
                <span className="font-bold text-lg">{tier.value}</span>
                <span className="text-sm text-gray-600">{tier.label}</span>
                <span className="text-xs text-gray-400 mt-1">
                  {tier.description}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">추가 정보</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                메모
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="협업 내용, 특이사항 등"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">활성 상태로 등록</span>
            </label>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-4">
          <Link
            href="/business/influencers"
            className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={loading || !name}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '등록 중...' : '인플루언서 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
