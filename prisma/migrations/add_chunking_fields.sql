-- Migration: Add chunking fields to manual_chunks table
-- This migration adds the necessary fields for the RAG Phase 2 chunking system

-- Add missing columns to manual_chunks if they don't exist
ALTER TABLE manual_chunks
ADD COLUMN IF NOT EXISTS section_title TEXT,
ADD COLUMN IF NOT EXISTS start_offset INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS end_offset INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding BYTEA,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update default values for existing rows
UPDATE manual_chunks
SET
  start_offset = 0,
  end_offset = LENGTH(content),
  content_hash = md5(content),
  updated_at = NOW()
WHERE start_offset IS NULL OR end_offset IS NULL OR content_hash IS NULL;

-- Make token_count NOT NULL if it isn't already
ALTER TABLE manual_chunks
ALTER COLUMN token_count SET NOT NULL,
ALTER COLUMN token_count SET DEFAULT 0;

-- Add index on content_hash for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_manual_chunks_content_hash ON manual_chunks(content_hash);

-- Ensure embedding_vector index exists for faster vector search
CREATE INDEX IF NOT EXISTS idx_manual_chunks_embedding_vector
ON manual_chunks USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);
