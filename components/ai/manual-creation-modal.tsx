'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, Edit2, Eye, Tag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ManualDraft {
  title: string;
  suggestedCategoryId: number | null;
  suggestedCategoryName: string;
  summary: string;
  content: string;
  tags: string[];
}

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
}

interface ManualCreationModalProps {
  draft: ManualDraft;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    content: string;
    summary: string;
    category_id: number | null;
    tags: string[];
  }) => Promise<void>;
}

export function ManualCreationModal({
  draft,
  isOpen,
  onClose,
  onSave,
}: ManualCreationModalProps) {
  const [title, setTitle] = useState(draft.title);
  const [content, setContent] = useState(draft.content);
  const [summary, setSummary] = useState(draft.summary);
  const [categoryId, setCategoryId] = useState<number | null>(draft.suggestedCategoryId);
  const [tags, setTags] = useState<string[]>(draft.tags);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPreview, setIsPreview] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 카테고리 목록 로드
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setCategories(data.data);
          }
        }
      } catch (error) {
        console.error('카테고리 로드 실패:', error);
      }
    };

    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // 드래프트 변경 시 상태 업데이트
  useEffect(() => {
    setTitle(draft.title);
    setContent(draft.content);
    setSummary(draft.summary);
    setCategoryId(draft.suggestedCategoryId);
    setTags(draft.tags);
  }, [draft]);

  // 태그 추가
  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  // 태그 삭제
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // 저장 처리
  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용은 필수입니다.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title,
        content,
        summary,
        category_id: categoryId,
        tags,
      });
      onClose();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('매뉴얼 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">매뉴얼 초안 미리보기</h2>
          <div className="flex items-center gap-2">
            <Button
              variant={isPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsPreview(true)}
            >
              <Eye className="h-4 w-4 mr-1" />
              미리보기
            </Button>
            <Button
              variant={!isPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsPreview(false)}
            >
              <Edit2 className="h-4 w-4 mr-1" />
              수정
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isPreview ? (
            // 미리보기 모드
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold">{title}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {categories.find(c => c.id === categoryId)?.name || draft.suggestedCategoryName || '미분류'}
                  </span>
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {summary && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">요약</h3>
                  <p className="text-gray-700">{summary}</p>
                </div>
              )}

              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            // 수정 모드
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="매뉴얼 제목"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리
                </label>
                <select
                  value={categoryId || ''}
                  onChange={e => setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">선택하세요</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  요약
                </label>
                <Textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  placeholder="매뉴얼 요약 (2-3문장)"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내용 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="매뉴얼 내용 (마크다운 지원)"
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  태그
                </label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    placeholder="태그 입력"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    추가
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                저장 중...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                저장
              </span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
