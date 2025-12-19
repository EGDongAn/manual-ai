'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import {
  Lightbulb,
  FolderTree,
  AlertTriangle,
  FileText,
  RefreshCw,
} from 'lucide-react';

interface CategoryRecommendation {
  categoryId: number | null;
  name: string;
  score: number;
  reason: string;
}

interface RelatedManual {
  id: number;
  title: string;
  similarity: number;
  categoryName: string | null;
}

interface AISuggestionProps {
  title: string;
  content: string;
  onCategorySelect?: (categoryId: number) => void;
  onViewManual?: (manualId: number) => void;
}

export function AISuggestion({
  title,
  content,
  onCategorySelect,
  onViewManual,
}: AISuggestionProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [categories, setCategories] = useState<CategoryRecommendation[]>([]);
  const [analysis, setAnalysis] = useState<{
    isDuplicate: boolean;
    duplicateReason: string | null;
    recommendation: string;
    details: string;
    relatedManuals: RelatedManual[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!title && !content) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // 카테고리 분류 요청
      const classifyRes = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (classifyRes.ok) {
        const classifyData = await classifyRes.json();
        setCategories(classifyData.recommendations || []);
      }

      // 중복/연관성 분석 요청
      const analyzeRes = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (analyzeRes.ok) {
        const analyzeData = await analyzeRes.json();
        setAnalysis(analyzeData);
      }
    } catch (err) {
      setError('AI 분석 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 디바운스된 자동 분석
  useEffect(() => {
    if (!title && !content) return;

    const timeoutId = setTimeout(() => {
      analyze();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [title, content]);

  if (!title && !content) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500 text-center">
            제목이나 내용을 입력하면 AI가 분석해드립니다
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 로딩 상태 */}
      {isAnalyzing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <LoadingSpinner size="sm" />
              AI가 분석 중입니다...
            </div>
          </CardContent>
        </Card>
      )}

      {/* 오류 */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 카테고리 추천 */}
      {!isAnalyzing && categories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              추천 카테고리
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categories.map((cat, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer"
                onClick={() => cat.categoryId && onCategorySelect?.(cat.categoryId)}
              >
                <div>
                  <div className="font-medium text-sm">{cat.name}</div>
                  <div className="text-xs text-gray-500">{cat.reason}</div>
                </div>
                <Badge variant={idx === 0 ? 'default' : 'secondary'}>
                  {cat.score}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 중복 경고 */}
      {!isAnalyzing && analysis?.isDuplicate && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">중복 가능성 발견</div>
            <div className="text-sm mt-1">{analysis.duplicateReason}</div>
          </AlertDescription>
        </Alert>
      )}

      {/* AI 분석 결과 */}
      {!isAnalyzing && analysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              AI 분석
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Badge
                variant={
                  analysis.recommendation === 'CREATE_NEW'
                    ? 'default'
                    : analysis.recommendation === 'UPDATE_EXISTING'
                    ? 'secondary'
                    : 'outline'
                }
              >
                {analysis.recommendation === 'CREATE_NEW'
                  ? '새 매뉴얼 작성'
                  : analysis.recommendation === 'UPDATE_EXISTING'
                  ? '기존 매뉴얼 업데이트 권장'
                  : '기존 매뉴얼과 병합 권장'}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">{analysis.details}</p>
          </CardContent>
        </Card>
      )}

      {/* 연관 매뉴얼 */}
      {!isAnalyzing && analysis?.relatedManuals && analysis.relatedManuals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              연관 매뉴얼
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysis.relatedManuals.map(manual => (
              <div
                key={manual.id}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer"
                onClick={() => onViewManual?.(manual.id)}
              >
                <div>
                  <div className="font-medium text-sm">{manual.title}</div>
                  <div className="text-xs text-gray-500">
                    {manual.categoryName || '미분류'}
                  </div>
                </div>
                <Badge variant="outline">
                  {Math.round(manual.similarity * 100)}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 재분석 버튼 */}
      {!isAnalyzing && (categories.length > 0 || analysis) && (
        <Button
          variant="outline"
          size="sm"
          onClick={analyze}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          다시 분석
        </Button>
      )}
    </div>
  );
}
