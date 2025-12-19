'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Search, FileText, Lightbulb, HelpCircle, Phone, ExternalLink, Sparkles } from 'lucide-react';

interface AISuggestion {
  relatedServices: string[];
  contactRecommended: boolean;
  clinicPhone: string;
  clinicWebsite: string;
}

interface SearchSource {
  manualId: number;
  title: string;
  categoryName: string | null;
  relevance: string;
  excerpt: string;
}

interface SearchResult {
  answer: string;
  sources: SearchSource[];
  confidence: number;
  followUpQuestions: string[];
  aiSuggestion?: AISuggestion;
  noManualFound?: boolean;
}

export default function AISearchPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const errData = await res.json();
        setError(errData.error || '검색에 실패했습니다.');
      }
    } catch (err) {
      setError('검색 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = (question: string) => {
    setQuery(question);
    // 자동 검색
    setTimeout(() => {
      const form = document.getElementById('search-form') as HTMLFormElement;
      form?.requestSubmit();
    }, 100);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
          <Search className="h-8 w-8" />
          AI 매뉴얼 검색
        </h1>
        <p className="text-gray-600">
          질문을 입력하면 관련 매뉴얼을 찾아 답변해드립니다
        </p>
      </div>

      {/* 검색창 */}
      <form id="search-form" onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="예: 신규 직원 첫 출근날 해야 할 일이 뭐야?"
            className="flex-1 h-12 text-lg"
          />
          <Button type="submit" disabled={loading} className="h-12 px-6">
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                검색
              </>
            )}
          </Button>
        </div>
      </form>

      {/* 오류 */}
      {error && (
        <Card className="bg-red-50 border-red-200 mb-6">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 검색 결과 */}
      {result && (
        <div className="space-y-6">
          {/* 답변 */}
          <Card className={result.noManualFound ? 'border-amber-200 bg-amber-50' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.noManualFound ? (
                  <Sparkles className="h-5 w-5 text-amber-500" />
                ) : (
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                )}
                {result.noManualFound ? 'AI 제안' : 'AI 답변'}
                {!result.noManualFound && (
                  <Badge
                    variant={
                      result.confidence >= 0.8
                        ? 'default'
                        : result.confidence >= 0.5
                        ? 'secondary'
                        : 'outline'
                    }
                    className="ml-2"
                  >
                    신뢰도 {Math.round(result.confidence * 100)}%
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                {result.answer.split('\n').map((line, i) => (
                  <p key={i}>{line || '\u00A0'}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI 제안 - 매뉴얼 없을 때 */}
          {result.noManualFound && result.aiSuggestion && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Phone className="h-5 w-5" />
                  문의 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.aiSuggestion.relatedServices.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-2">관련 서비스:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.aiSuggestion.relatedServices.map((service, idx) => (
                        <Badge key={idx} variant="secondary">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {result.aiSuggestion.contactRecommended && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    <a href={`tel:${result.aiSuggestion.clinicPhone}`}>
                      <Button variant="default" size="sm">
                        <Phone className="h-4 w-4 mr-2" />
                        {result.aiSuggestion.clinicPhone}
                      </Button>
                    </a>
                    <a href={result.aiSuggestion.clinicWebsite} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        홈페이지 방문
                      </Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 참조 매뉴얼 */}
          {result.sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  참조한 매뉴얼
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.sources.map(source => (
                    <div
                      key={source.manualId}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <Link
                            href={`/manuals/${source.manualId}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {source.title}
                          </Link>
                          {source.categoryName && (
                            <Badge variant="outline" className="ml-2">
                              {source.categoryName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{source.relevance}</p>
                      <p className="text-sm text-gray-500 mt-2 italic">
                        &ldquo;{source.excerpt}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 후속 질문 */}
          {result.followUpQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  관련 질문
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.followUpQuestions.map((question, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleFollowUp(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 검색 전 안내 */}
      {!result && !loading && !error && (
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <h3 className="font-medium mb-4">검색 예시:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                '신규 직원 첫 출근날 해야 할 일이 뭐야?',
                '환자 접수 절차 알려줘',
                '재고 실사 방법',
                '휴가 신청은 어떻게 해?',
              ].map((example, idx) => (
                <Button
                  key={idx}
                  variant="ghost"
                  className="justify-start text-left h-auto py-2"
                  onClick={() => {
                    setQuery(example);
                  }}
                >
                  <Search className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{example}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
