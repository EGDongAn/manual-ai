// AI 관련 타입 정의

export interface CategoryRecommendation {
  categoryId: number | null;
  name: string;
  score: number;
  reason: string;
}

export interface ClassifyResult {
  recommendations: CategoryRecommendation[];
  newCategorySuggestion: {
    name: string;
    parentId?: number;
    reason: string;
  } | null;
}

export interface RelatedManual {
  id: number;
  title: string;
  summary: string | null;
  categoryName: string | null;
  similarity: number;
}

export interface AnalyzeResult {
  isDuplicate: boolean;
  duplicateOf: number | null;
  duplicateReason: string | null;
  recommendation: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'MERGE';
  targetManualId: number | null;
  details: string;
  relatedManuals: RelatedManual[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: {
    manualId: number;
    title: string;
    relevance: string;
  }[];
}

export interface ChatSession {
  id: number;
  title: string | null;
  messages: ChatMessage[];
  context: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  answer: string;
  sources: {
    manualId: number;
    title: string;
    categoryName: string | null;
    relevance: string;
    excerpt: string;
  }[];
  confidence: number;
  followUpQuestions: string[];
}

export interface ManualWithCategory {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  category: {
    id: number;
    name: string;
  } | null;
  tags: {
    id: number;
    name: string;
  }[];
}

export interface EmbeddingData {
  manualId: number;
  embedding: number[];
  contentHash: string;
}

// pgvector 관련 타입

export interface PgVectorSearchResult {
  id: number;
  manual_id: number;
  similarity: number;
  title: string;
  content: string;
  summary: string | null;
  category_id: number | null;
  status: string;
}

export interface ChunkSearchResult {
  id: number;
  manual_id: number;
  chunk_index: number;
  content: string;
  similarity: number;
  title: string;
  manual_summary: string | null;
  category_id: number | null;
}

export interface HybridSearchResult {
  manuals: PgVectorSearchResult[];
  chunks: ChunkSearchResult[];
}

// Hybrid 검색에서 반환되는 개별 청크 결과 (RRF 통합 점수 포함)
export interface HybridChunkResult {
  chunkId: number;
  manualId: number;
  content: string;
  manualTitle: string;
  sectionTitle: string | null;
  chunkIndex: number;
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
}

export interface VectorStats {
  totalEmbeddings: number;
  embeddingsWithVector: number;
  totalChunks: number;
}

export interface MigrationResult {
  total: number;
  indexed: number;
  totalChunks?: number;
  errors: string[];
}

export interface SearchOptions {
  manualLimit?: number;
  chunkLimit?: number;
  threshold?: number;
  useChunks?: boolean;
  categoryId?: number;
}

export interface ChunkingOptions {
  useChunks?: boolean;
  chunkSize?: number;
  overlap?: number;
}

export interface ManualChunk {
  id: number;
  manual_id: number;
  chunk_index: number;
  content: string;
  token_count: number | null;
  created_at: Date;
}
