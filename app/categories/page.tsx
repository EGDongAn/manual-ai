'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import {
  FolderTree,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  description: string | null;
  order: number;
  _count?: {
    manuals: number;
  };
  children?: Category[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?tree=true');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateDialog = (parent?: number) => {
    setEditing(null);
    setParentId(parent || null);
    setFormData({ name: '', description: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditing(category);
    setParentId(null);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('카테고리 이름을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const url = editing
        ? `/api/categories/${editing.id}`
        : '/api/categories';
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          parentId: editing ? undefined : parentId,
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        fetchCategories();
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

  const handleDelete = async (id: number) => {
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchCategories();
      } else {
        const error = await res.json();
        alert(error.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedIds.has(category.id);

    return (
      <div key={category.id}>
        <div
          className={`flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 ${
            level > 0 ? 'ml-6' : ''
          }`}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(category.id)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <FolderTree className="h-4 w-4 text-gray-400" />

          <div className="flex-1">
            <span className="font-medium">{category.name}</span>
            {category.description && (
              <span className="text-sm text-gray-500 ml-2">
                - {category.description}
              </span>
            )}
          </div>

          {category._count && (
            <Badge variant="secondary">
              {category._count.manuals}개 매뉴얼
            </Badge>
          )}

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openCreateDialog(category.id)}
              title="하위 카테고리 추가"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditDialog(category)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(category.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {category.children!.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderTree className="h-6 w-6" />
          카테고리 관리
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openCreateDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              카테고리 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? '카테고리 수정' : '카테고리 추가'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="카테고리 이름"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="카테고리 설명 (선택사항)"
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  취소
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : null}
                  저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">카테고리 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>카테고리가 없습니다.</p>
              <Button
                variant="link"
                onClick={() => openCreateDialog()}
              >
                첫 카테고리 만들기
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {categories.map(category => renderCategory(category))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
