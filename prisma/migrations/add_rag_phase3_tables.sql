-- RAG Phase 3: Metrics and Cache Tables
-- 검색 메트릭 및 캐시 시스템을 위한 테이블 생성

-- 1. 검색 메트릭 테이블
CREATE TABLE IF NOT EXISTS search_metrics (
  query_id VARCHAR(36) PRIMARY KEY,
  query TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vector_search_time REAL NOT NULL,
  rerank_time REAL NOT NULL,
  llm_time REAL NOT NULL,
  total_time REAL NOT NULL,
  chunks_retrieved INTEGER NOT NULL,
  chunks_after_rerank INTEGER NOT NULL,
  confidence REAL NOT NULL,
  user_feedback VARCHAR(20) CHECK (user_feedback IN ('helpful', 'not_helpful', NULL)),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 검색 메트릭 인덱스
CREATE INDEX IF NOT EXISTS idx_search_metrics_timestamp ON search_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_metrics_query ON search_metrics(query);
CREATE INDEX IF NOT EXISTS idx_search_metrics_feedback ON search_metrics(user_feedback) WHERE user_feedback IS NOT NULL;

-- 2. 검색 캐시 테이블
CREATE TABLE IF NOT EXISTS search_cache (
  query_hash VARCHAR(64) PRIMARY KEY,
  query TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_accessed_at TIMESTAMP NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0
);

-- 검색 캐시 인덱스
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_hit_count ON search_cache(hit_count DESC);
CREATE INDEX IF NOT EXISTS idx_search_cache_last_accessed ON search_cache(last_accessed_at DESC);

-- 3. 메트릭 통계를 위한 뷰 (선택적)
CREATE OR REPLACE VIEW search_metrics_summary AS
SELECT
  DATE(timestamp) as date,
  COUNT(*) as total_searches,
  AVG(vector_search_time) as avg_vector_time,
  AVG(rerank_time) as avg_rerank_time,
  AVG(llm_time) as avg_llm_time,
  AVG(total_time) as avg_total_time,
  AVG(chunks_retrieved) as avg_chunks_retrieved,
  AVG(chunks_after_rerank) as avg_chunks_after_rerank,
  AVG(confidence) as avg_confidence,
  COUNT(CASE WHEN user_feedback = 'helpful' THEN 1 END)::float /
    NULLIF(COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END), 0) as helpful_rate
FROM search_metrics
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- 주석 추가
COMMENT ON TABLE search_metrics IS 'RAG 파이프라인 검색 성능 메트릭';
COMMENT ON TABLE search_cache IS 'RAG 파이프라인 검색 결과 캐시';
COMMENT ON COLUMN search_metrics.query_id IS '검색 쿼리 고유 ID (UUID)';
COMMENT ON COLUMN search_metrics.vector_search_time IS '벡터 검색 소요 시간 (ms)';
COMMENT ON COLUMN search_metrics.rerank_time IS '재순위화 소요 시간 (ms)';
COMMENT ON COLUMN search_metrics.llm_time IS 'LLM 생성 소요 시간 (ms)';
COMMENT ON COLUMN search_metrics.total_time IS '전체 파이프라인 소요 시간 (ms)';
COMMENT ON COLUMN search_metrics.user_feedback IS '사용자 피드백 (helpful/not_helpful)';
COMMENT ON COLUMN search_cache.query_hash IS '쿼리 SHA256 해시';
COMMENT ON COLUMN search_cache.result IS 'RAG 검색 결과 (JSON)';
COMMENT ON COLUMN search_cache.hit_count IS '캐시 히트 횟수';
