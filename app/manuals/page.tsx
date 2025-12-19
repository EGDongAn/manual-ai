'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { CategorySelect } from '@/components/category/category-select';
import { Plus, Search, Eye, Edit, FileText } from 'lucide-react';

interface Manual {
  id: number;
  title: string;
  summary: string | null;
  status: string;
  version: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  category: {
    id: number;
    name: string;
  } | null;
  tags: {
    id: number;
    name: string;
  }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ManualsPage() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('');

  const fetchManuals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      if (search) params.append('search', search);
      if (categoryId) params.append('categoryId', categoryId.toString());
      if (status) params.append('status', status);

      const res = await fetch(`/api/manuals?${params}`);
      if (res.ok) {
        const data = await res.json();
        setManuals(data.manuals);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('매뉴얼 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManuals();
  }, [pagination.page, categoryId, status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchManuals();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="default">게시됨</Badge>;
      case 'DRAFT':
        return <Badge variant="secondary">초안</Badge>;
      case 'ARCHIVED':
        return <Badge variant="outline">보관됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">매뉴얼 관리</h1>
        <Link href="/manuals/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            새 매뉴얼
          </Button>
        </Link>
      </div>

      {/* 필터 영역 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="매뉴얼 검색..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <CategorySelect
                value={categoryId}
                onChange={setCategoryId}
                placeholder="카테고리"
              />
            </div>
            <div className="w-36">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">전체 상태</option>
                <option value="PUBLISHED">게시됨</option>
                <option value="DRAFT">초안</option>
                <option value="ARCHIVED">보관됨</option>
              </select>
            </div>
            <Button type="submit">검색</Button>
          </form>
        </CardContent>
      </Card>

      {/* 매뉴얼 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            매뉴얼 목록
            <Badge variant="secondary" className="ml-2">
              {pagination.total}개
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : manuals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>매뉴얼이 없습니다.</p>
              <Link href="/manuals/new">
                <Button variant="link">첫 매뉴얼 작성하기</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제목</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>버전</TableHead>
                  <TableHead>조회수</TableHead>
                  <TableHead>수정일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manuals.map(manual => (
                  <TableRow key={manual.id}>
                    <TableCell>
                      <Link
                        href={`/manuals/${manual.id}`}
                        className="font-medium hover:text-blue-600"
                      >
                        {manual.title}
                      </Link>
                      {manual.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {manual.tags.slice(0, 3).map(tag => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {manual.category?.name || (
                        <span className="text-gray-400">미분류</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(manual.status)}</TableCell>
                    <TableCell>v{manual.version}</TableCell>
                    <TableCell>{manual.view_count}</TableCell>
                    <TableCell>
                      {new Date(manual.updated_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/manuals/${manual.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/manuals/${manual.id}/edit`}>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() =>
                  setPagination(prev => ({ ...prev, page: prev.page - 1 }))
                }
                disabled={pagination.page === 1}
              >
                이전
              </Button>
              <span className="flex items-center px-4">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setPagination(prev => ({ ...prev, page: prev.page + 1 }))
                }
                disabled={pagination.page === pagination.totalPages}
              >
                다음
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
