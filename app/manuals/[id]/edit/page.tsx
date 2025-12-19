'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CategorySelect } from '@/components/category/category-select';
import { AISuggestion } from '@/components/ai/ai-suggestion';
import { ChatInterface } from '@/components/ai/chat-interface';
import { LoadingSpinner, PageLoader } from '@/components/common/loading-spinner';
import { Save, ArrowLeft, Bot, FileText } from 'lucide-react';

interface Manual {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  status: string;
  category_id: number | null;
}

export default function EditManualPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [status, setStatus] = useState('DRAFT');
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);

  useEffect(() => {
    async function fetchManual() {
      try {
        const res = await fetch(`/api/manuals/${id}`);
        if (res.ok) {
          const data = await res.json();
          setTitle(data.title);
          setContent(data.content);
          setSummary(data.summary || '');
          setCategoryId(data.category?.id || null);
          setStatus(data.status);
        } else {
          router.push('/manuals');
        }
      } catch (error) {
        console.error('매뉴얼 로드 실패:', error);
        router.push('/manuals');
      } finally {
        setLoading(false);
      }
    }

    fetchManual();
  }, [id, router]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/manuals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          summary: summary || null,
          categoryId,
          status,
          changeNote: changeNote || null,
        }),
      });

      if (res.ok) {
        router.push(`/manuals/${id}`);
      } else {
        const error = await res.json();
        alert(error.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleAIUpdate = (aiContent: string) => {
    setContent(prev => {
      if (prev) {
        return prev + '\n\n' + aiContent;
      }
      return aiContent;
    });
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로
        </Button>
        <h1 className="text-2xl font-bold">매뉴얼 수정</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메인 편집 영역 */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                매뉴얼 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">제목 *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="매뉴얼 제목을 입력하세요"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>카테고리</Label>
                  <div className="mt-1">
                    <CategorySelect
                      value={categoryId}
                      onChange={setCategoryId}
                    />
                  </div>
                </div>
                <div>
                  <Label>상태</Label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="DRAFT">초안</option>
                    <option value="PUBLISHED">게시</option>
                    <option value="ARCHIVED">보관</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="summary">요약</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  placeholder="매뉴얼 요약 (선택사항)"
                  className="mt-1 min-h-[80px]"
                />
              </div>

              <div>
                <Label htmlFor="content">내용 *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="매뉴얼 내용을 입력하세요 (마크다운 지원)"
                  className="mt-1 min-h-[400px] font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="changeNote">변경 사유 (선택)</Label>
                <Input
                  id="changeNote"
                  value={changeNote}
                  onChange={e => setChangeNote(e.target.value)}
                  placeholder="이번 수정의 주요 변경 사항"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAIAssist(!showAIAssist)}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  {showAIAssist ? 'AI 도우미 닫기' : 'AI 도우미 열기'}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  저장
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI 작성 도우미 */}
          {showAIAssist && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI 작성 도우미
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChatInterface
                  mode="writing"
                  manualContext={{ title, content }}
                  onManualUpdate={handleAIUpdate}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* 사이드바 - AI 제안 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AISuggestion
                title={title}
                content={content}
                onCategorySelect={setCategoryId}
                onViewManual={manualId => window.open(`/manuals/${manualId}`, '_blank')}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
