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
