/**
 * AI 인플루언서 등급 분석 서비스
 *
 * Gemini API를 사용하여 인플루언서의 SNS 데이터를 분석하고
 * 병원 협찬 적합도를 평가합니다.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { InfluencerTier } from '@prisma/client';
import { SNSMetrics, InfluencerAnalysisResult } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 분석 프롬프트
const ANALYSIS_PROMPT = `당신은 마케팅 전문가입니다. 다음 인플루언서의 SNS 데이터를 분석하여 병원 협찬 적합도를 평가하세요.

## 평가 기준

### 팔로워/구독자 수 (40점)
- 100만+ : 40점
- 50만-100만 : 35점
- 10만-50만 : 25점
- 1만-10만 : 15점
- 1만 미만 : 5점

### 참여율 (30점)
- 5%+ : 30점
- 3-5% : 25점
- 1-3% : 15점
- 1% 미만 : 5점

### 콘텐츠 적합성 (20점)
- 뷰티/의료 전문 : 20점
- 라이프스타일 (뷰티 포함) : 15점
- 일반 라이프스타일 : 10점
- 관련성 낮음 : 5점

### 타겟 일치도 (10점)
- 25-45세 여성 메인 : 10점
- 부분 일치 : 5점
- 불일치 : 2점

## 등급 기준
- SS: 90점 이상
- S: 75-89점
- A: 60-74점
- B: 40-59점
- C: 40점 미만

## 인플루언서 데이터
{influencer_data}

## 응답 형식 (JSON만 출력, 마크다운 코드블록 없이)
{
  "tier": "A",
  "score": 72,
  "breakdown": {
    "followers": 25,
    "engagement": 22,
    "relevance": 15,
    "target_match": 10
  },
  "summary": "분석 요약 (2-3문장)",
  "strengths": ["강점1", "강점2"],
  "concerns": ["우려사항1"],
  "recommended_procedures": ["시술1", "시술2"],
  "suggested_support_range": {
    "min": 300000,
    "max": 500000
  }
}`;

/**
 * SNS 메트릭을 기반으로 인플루언서 등급 분석
 */
export async function analyzeInfluencer(
  influencerId: number,
  metrics: SNSMetrics
): Promise<InfluencerAnalysisResult | null> {
  // 인플루언서 정보 조회
  const influencer = await prisma.influencers.findUnique({
    where: { id: influencerId },
  });

  if (!influencer) {
    return null;
  }

  // 인플루언서 데이터 구성
  const influencerData = {
    name: influencer.name,
    nickname: influencer.nickname,
    instagram_handle: influencer.instagram_handle,
    youtube_channel: influencer.youtube_channel,
    tiktok_handle: influencer.tiktok_handle,
    blog_url: influencer.blog_url,
    metrics,
  };

  try {
    // Gemini API 호출
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = ANALYSIS_PROMPT.replace(
      '{influencer_data}',
      JSON.stringify(influencerData, null, 2)
    );

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON 파싱 (마크다운 코드블록 제거)
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    const analysis = JSON.parse(jsonStr);

    // 분석 결과 저장
    const savedAnalysis = await prisma.influencer_analyses.create({
      data: {
        influencer_id: influencerId,
        instagram_followers: metrics.instagram?.followers,
        instagram_engagement: metrics.instagram?.engagement_rate,
        youtube_subscribers: metrics.youtube?.subscribers,
        youtube_avg_views: metrics.youtube?.avg_views,
        tiktok_followers: metrics.tiktok?.followers,
        tiktok_engagement: metrics.tiktok?.engagement_rate,
        calculated_tier: analysis.tier as InfluencerTier,
        tier_score: analysis.score,
        analysis_summary: analysis.summary,
        analysis_raw: analysis,
        recommended_support_min: analysis.suggested_support_range?.min,
        recommended_support_max: analysis.suggested_support_range?.max,
      },
    });

    // 인플루언서 정보 업데이트
    await prisma.influencers.update({
      where: { id: influencerId },
      data: {
        current_tier: analysis.tier as InfluencerTier,
        tier_score: analysis.score,
        last_analyzed_at: new Date(),
      },
    });

    return {
      influencer_id: influencerId,
      tier: analysis.tier,
      score: analysis.score,
      metrics,
      breakdown: analysis.breakdown,
      analysis_summary: analysis.summary,
      strengths: analysis.strengths,
      concerns: analysis.concerns,
      recommended_procedures: analysis.recommended_procedures,
      suggested_support_range: analysis.suggested_support_range,
    };
  } catch (error) {
    console.error('인플루언서 분석 오류:', error);
    throw error;
  }
}

/**
 * 팔로워 수를 기반으로 간단한 등급 계산 (AI 없이)
 */
export function calculateTierFromFollowers(totalFollowers: number): {
  tier: InfluencerTier;
  score: number;
} {
  if (totalFollowers >= 1000000) {
    return { tier: 'SS', score: 95 };
  } else if (totalFollowers >= 500000) {
    return { tier: 'S', score: 82 };
  } else if (totalFollowers >= 100000) {
    return { tier: 'A', score: 67 };
  } else if (totalFollowers >= 10000) {
    return { tier: 'B', score: 50 };
  } else {
    return { tier: 'C', score: 25 };
  }
}

/**
 * 등급별 지원 정책 조회
 */
export async function getTierPolicy(tier: InfluencerTier) {
  const policy = await prisma.tier_support_policies.findUnique({
    where: { tier },
  });

  if (!policy) {
    return null;
  }

  return {
    tier: policy.tier,
    max_support_per_visit: policy.max_support_per_visit.toNumber(),
    max_support_per_month: policy.max_support_per_month.toNumber(),
    max_visits_per_month: policy.max_visits_per_month,
    support_rate_percent: policy.support_rate_percent,
    allowed_categories: policy.allowed_categories as string[] | null,
    excluded_procedures: policy.excluded_procedures as number[] | null,
  };
}

/**
 * 인플루언서에게 추천할 시술 목록 조회
 */
export async function getRecommendedProcedures(
  tier: InfluencerTier,
  limit: number = 10
) {
  const policy = await getTierPolicy(tier);

  const where: Record<string, unknown> = {
    is_active: true,
  };

  // 허용 카테고리 필터
  if (policy?.allowed_categories && policy.allowed_categories.length > 0) {
    where.category = { in: policy.allowed_categories };
  }

  // 제외 시술 필터
  if (policy?.excluded_procedures && policy.excluded_procedures.length > 0) {
    where.id = { notIn: policy.excluded_procedures };
  }

  const procedures = await prisma.procedures.findMany({
    where,
    include: {
      cost_components: true,
    },
    orderBy: [{ category: 'asc' }, { base_cost: 'asc' }],
    take: limit,
  });

  return procedures.map((proc) => ({
    id: proc.id,
    name: proc.name,
    category: proc.category,
    duration_minutes: proc.duration_minutes,
    base_cost: proc.base_cost.toNumber(),
    total_cost:
      proc.base_cost.toNumber() +
      proc.cost_components.reduce((sum, c) => sum + c.amount.toNumber(), 0),
  }));
}
