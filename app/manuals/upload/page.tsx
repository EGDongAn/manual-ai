'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import {
  Upload,
  FileText,
  ClipboardPaste,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Sparkles,
  FolderOpen,
} from 'lucide-react';

interface CategorySuggestion {
  categoryId: number;
  name: string;
  score: number;
  reason: string;
}

interface AnalysisResult {
  title: string;
  summary: string;
  content: string;
  categoryRecommendations: CategorySuggestion[];
  tags: string[];
  qualityScore?: number | null;
  suggestions?: string[];
}

type UploadStep = 'input' | 'analyzing' | 'review' | 'saving' | 'complete';

export default function ManualUploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<UploadStep>('input');
  const [inputMethod, setInputMethod] = useState<'file' | 'paste'>('paste');
  const [rawContent, setRawContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 분석 결과 상태
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // 편집 가능한 필드
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 파일 업로드 핸들러
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    // 파일 타입 확인
    const validTypes = ['text/plain', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.txt', '.md', '.docx', '.pdf'];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      setError('지원하지 않는 파일 형식입니다. TXT, MD, DOCX 파일을 업로드해주세요. (PDF는 붙여넣기 사용)');
      return;
    }

    try {
      if (file.type === 'text/plain' || extension === '.txt' || extension === '.md') {
        const text = await file.text();
        setRawContent(text);
      } else if (extension === '.docx') {
        // DOCX 파일은 서버에서 처리
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/manuals/upload/parse', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error('파일 파싱 실패');
        }

        const data = await res.json();
        setRawContent(data.content);
      } else if (file.type === 'application/pdf' || extension === '.pdf') {
        // PDF 파일은 텍스트 추출이 어려우므로 안내
        setError('PDF 파일은 직접 텍스트를 복사하여 붙여넣기 해주세요. PDF를 열어 텍스트를 선택(Ctrl+A) 후 복사(Ctrl+C)하여 "복사/붙여넣기" 탭에 붙여넣기 해주세요.');
        setInputMethod('paste');
        return;
      }
    } catch (err) {
      console.error('파일 처리 오류:', err);
      setError('파일을 읽는 중 오류가 발생했습니다.');
    }
  }, []);

  // AI 분석 시작
  const startAnalysis = useCallback(async () => {
    if (!rawContent.trim()) {
      setError('분석할 내용을 입력해주세요.');
      return;
    }

    setStep('analyzing');
    setError(null);

    try {
      const res = await fetch('/api/manuals/upload/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: rawContent }),
      });

      if (!res.ok) {
        throw new Error('AI 분석 실패');
      }

      const apiResponse = await res.json();
      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'AI 분석 실패');
      }

      const result: AnalysisResult = apiResponse.data;
      setAnalysisResult(result);

      // 편집 필드 초기화
      setEditedTitle(result.title);
      setEditedContent(result.content);
      setEditedSummary(result.summary);
      setSelectedCategoryId(result.categoryRecommendations[0]?.categoryId || null);
      setSelectedTags(result.tags);

      setStep('review');
    } catch (err) {
      console.error('분석 오류:', err);
      setError('AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      setStep('input');
    }
  }, [rawContent]);

  // 매뉴얼 저장
  const saveManual = useCallback(async () => {
    if (!editedTitle.trim() || !editedContent.trim()) {
      setError('제목과 내용은 필수입니다.');
      return;
    }

    setStep('saving');
    setError(null);

    try {
      const res = await fetch('/api/manuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedTitle,
          content: editedContent,
          summary: editedSummary,
          category_id: selectedCategoryId,
          tags: selectedTags,
        }),
      });

      if (!res.ok) {
        throw new Error('매뉴얼 저장 실패');
      }

      const result = await res.json();
      if (result.success) {
        setStep('complete');
        // 2초 후 상세 페이지로 이동
        setTimeout(() => {
          router.push(`/manuals/${result.data.id}`);
        }, 2000);
      } else {
        throw new Error(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('저장 오류:', err);
      setError('매뉴얼 저장 중 오류가 발생했습니다.');
      setStep('review');
    }
  }, [editedTitle, editedContent, editedSummary, selectedCategoryId, selectedTags, router]);

  // 태그 추가/제거
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/manuals"
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          매뉴얼 목록으로
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6" />
          매뉴얼 업로드
        </h1>
        <p className="text-gray-600 mt-1">
          기존 매뉴얼을 업로드하면 AI가 분석하여 카테고리를 자동 분류합니다
        </p>
      </div>

      {/* 진행 상태 표시 */}
      <div className="flex items-center gap-2 mb-8">
        {['input', 'analyzing', 'review', 'saving', 'complete'].map((s, idx) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : ['input', 'analyzing', 'review', 'saving', 'complete'].indexOf(step) > idx
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}
            >
              {['input', 'analyzing', 'review', 'saving', 'complete'].indexOf(step) > idx ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                idx + 1
              )}
            </div>
            {idx < 4 && (
              <div
                className={`w-12 h-1 ${
                  ['input', 'analyzing', 'review', 'saving', 'complete'].indexOf(step) > idx
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Step 1: 입력 */}
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle>매뉴얼 내용 입력</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 입력 방법 선택 */}
            <div className="flex gap-4">
              <Button
                variant={inputMethod === 'paste' ? 'default' : 'outline'}
                onClick={() => setInputMethod('paste')}
                className="flex-1"
              >
                <ClipboardPaste className="h-4 w-4 mr-2" />
                복사/붙여넣기
              </Button>
              <Button
                variant={inputMethod === 'file' ? 'default' : 'outline'}
                onClick={() => setInputMethod('file')}
                className="flex-1"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                파일 업로드
              </Button>
            </div>

            {inputMethod === 'file' ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".txt,.md,.docx,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <FileText className="h-12 w-12 text-gray-400" />
                    <span className="text-gray-600">
                      클릭하여 파일 선택 또는 드래그 앤 드롭
                    </span>
                    <span className="text-sm text-gray-400">
                      TXT, MD, DOCX 지원 (PDF는 붙여넣기 사용)
                    </span>
                  </label>
                </div>
                {fileName && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    {fileName} 로드됨
                  </p>
                )}
              </div>
            ) : (
              <Textarea
                value={rawContent}
                onChange={e => setRawContent(e.target.value)}
                placeholder="매뉴얼 내용을 붙여넣으세요..."
                className="min-h-[300px] font-mono text-sm"
              />
            )}

            {rawContent && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  {rawContent.length.toLocaleString()}자 입력됨
                </p>
              </div>
            )}

            <Button
              onClick={startAnalysis}
              disabled={!rawContent.trim()}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI 분석 시작
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 분석 중 */}
      {step === 'analyzing' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-lg font-medium">AI가 매뉴얼을 분석하고 있습니다...</p>
              <p className="text-gray-500">내용 파악, 카테고리 추천, 구조화 진행 중</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: 검토 */}
      {step === 'review' && analysisResult && (
        <div className="space-y-6">
          {/* 카테고리 추천 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI 카테고리 추천
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analysisResult.categoryRecommendations.map((rec, idx) => (
                  <div
                    key={rec.categoryId}
                    onClick={() => setSelectedCategoryId(rec.categoryId)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedCategoryId === rec.categoryId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{rec.name}</span>
                      <span
                        className={`text-sm px-2 py-1 rounded ${
                          idx === 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {rec.score}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{rec.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 제목 및 요약 편집 */}
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={editedTitle}
                  onChange={e => setEditedTitle(e.target.value)}
                  placeholder="매뉴얼 제목"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  요약
                </label>
                <Textarea
                  value={editedSummary}
                  onChange={e => setEditedSummary(e.target.value)}
                  placeholder="매뉴얼 요약 (2-3문장)"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  태그
                </label>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.tags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 내용 편집 */}
          <Card>
            <CardHeader>
              <CardTitle>내용</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="매뉴얼 내용 (마크다운 지원)"
              />
            </CardContent>
          </Card>

          {/* 액션 버튼 */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setStep('input')}>
              다시 입력
            </Button>
            <Button onClick={saveManual}>매뉴얼 저장</Button>
          </div>
        </div>
      )}

      {/* Step 4: 저장 중 */}
      {step === 'saving' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-lg font-medium">매뉴얼을 저장하고 있습니다...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: 완료 */}
      {step === 'complete' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-lg font-medium">매뉴얼이 성공적으로 저장되었습니다!</p>
              <p className="text-gray-500">잠시 후 상세 페이지로 이동합니다...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
