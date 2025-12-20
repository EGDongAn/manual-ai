/**
 * 비즈니스 인텔리전스 시스템 타입 정의
 */

import { CostType, InfluencerTier, SupportStatus } from '@prisma/client';

// ============================================
// 시술 관련 타입
// ============================================

export interface ProcedureInput {
  name: string;
  name_en?: string;
  category: string;
  subcategory?: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes?: number;
  base_cost: number;
  is_active?: boolean;
  requires_doctor?: boolean;
}

export interface ProcedureCostInput {
  cost_type: CostType;
  name: string;
  amount: number;
  unit?: string;
  calculation?: string;
}

export interface ProcedureItemInput {
  item_id: number;
  quantity: number;
  unit: string;
  is_optional?: boolean;
}

export interface ProcedureEquipmentInput {
  equipment_name: string;
  usage_minutes?: number;
}

export interface CostBreakdown {
  labor: number;
  rent: number;
  material: number;
  equipment: number;
  other: number;
  total: number;
}

export interface ProcedureCostDetail {
  procedure_id: number;
  name: string;
  duration_minutes: number;
  costs: CostBreakdown;
  total_cost: number;
  recommended_price: number;
  margin_rate: number;
}

// ============================================
// 인플루언서 관련 타입
// ============================================

export interface InfluencerInput {
  name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  instagram_handle?: string;
  youtube_channel?: string;
  tiktok_handle?: string;
  blog_url?: string;
  notes?: string;
}

export interface SNSMetrics {
  instagram?: {
    followers: number;
    engagement_rate: number;
    avg_likes?: number;
    avg_comments?: number;
  };
  youtube?: {
    subscribers: number;
    avg_views: number;
  };
  tiktok?: {
    followers: number;
    engagement_rate: number;
  };
}

export interface InfluencerAnalysisResult {
  influencer_id: number;
  tier: InfluencerTier;
  score: number;
  metrics: SNSMetrics;
  breakdown: {
    followers: number;
    engagement: number;
    relevance: number;
    target_match: number;
  };
  analysis_summary: string;
  strengths: string[];
  concerns: string[];
  recommended_procedures: string[];
  suggested_support_range: {
    min: number;
    max: number;
  };
}

export interface TierPolicy {
  tier: InfluencerTier;
  max_support_per_visit: number;
  max_support_per_month: number;
  max_visits_per_month: number;
  support_rate_percent: number;
  allowed_categories?: string[];
  excluded_procedures?: number[];
}

// ============================================
// 지원 및 방문 관련 타입
// ============================================

export interface SupportInput {
  influencer_id: number;
  procedure_id: number;
  visit_id?: number;
  procedure_cost: number;
  supported_amount: number;
  client_payment: number;
  scheduled_at?: Date;
  notes?: string;
}

export interface VisitInput {
  influencer_id: number;
  visit_date: Date;
  purpose?: string;
  notes?: string;
}

// ============================================
// 스케줄링 관련 타입
// ============================================

export interface TimeSlot {
  start: string; // HH:mm format
  end: string;
}

export interface SchedulingCalculationInput {
  procedures: number[]; // procedure IDs
  date: string; // YYYY-MM-DD format
}

export interface SchedulingCalculationResult {
  procedures: Array<{
    id: number;
    name: string;
    duration: number;
    buffer: number;
  }>;
  total_duration: number;
  total_cost: number;
  available_slots: TimeSlot[];
}

// ============================================
// API 응답 타입
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
