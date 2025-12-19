'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner, PageLoader } from '@/components/common/loading-spinner';
import {
  ArrowLeft,
  Edit,
  Trash2,
  FileText,
  Clock,
  Eye,
  Tag,
  FolderTree,
  History,
} from 'lucide-react';

interface Manual {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  status: string;
  version: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  category: {
    id: number;
    name: string;
    parent?: {
      id: number;
      name: string;
    } | null;
  } | null;
  tags: {
    id: number;
    name: string;
  }[];
  versions: {
    id: number;
    version: number;
    title: string;
    change_note: string | null;
    created_at: string;
  }[];
}

export default function ManualDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [manual, setManual] = useState<Manual | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchManual() {
      try {
        const res = await fetch(`/api/manuals/${id}`);
        if (res.ok) {
          const data = await res.json();
          setManual(data);
        } else if (res.status === 404) {
          router.push('/manuals');
        }
      } catch (error) {
        console.error('매뉴얼 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchManual();
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm('정말 이 매뉴얼을 삭제하시겠습니까?')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/manuals/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/manuals');
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
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

  if (loading) {
    return <PageLoader />;
  }

  if (!manual) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <p>매뉴얼을 찾을 수 없습니다.</p>
          <Link href="/manuals">
            <Button variant="link">목록으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로
          </Button>
        </div>
        <div className="flex gap-2">
          <Link href={`/manuals/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              수정
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            삭제
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메인 콘텐츠 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{manual.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(manual.status)}
                    <Badge variant="outline">v{manual.version}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {manual.summary && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">{manual.summary}</p>
                </div>
              )}
              <div className="prose max-w-none">
                {manual.content.split('\n').map((line, i) => (
                  <p key={i}>{line || '\u00A0'}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 사이드바 */}
        <div className="space-y-4">
          {/* 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <FolderTree className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">카테고리:</span>
                <span>
                  {manual.category ? (
                    <>
                      {manual.category.parent && (
                        <>{manual.category.parent.name} &gt; </>
                      )}
                      {manual.category.name}
                    </>
                  ) : (
                    '미분류'
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">조회수:</span>
                <span>{manual.view_count}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">수정일:</span>
                <span>
                  {new Date(manual.updated_at).toLocaleDateString('ko-KR')}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">생성일:</span>
                <span>
                  {new Date(manual.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 태그 */}
          {manual.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  태그
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {manual.tags.map(tag => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 버전 히스토리 */}
          {manual.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  버전 히스토리
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {manual.versions.map(version => (
                    <div
                      key={version.id}
                      className="p-2 rounded-lg bg-gray-50 text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">v{version.version}</span>
                        <span className="text-gray-500">
                          {new Date(version.created_at).toLocaleDateString(
                            'ko-KR'
                          )}
                        </span>
                      </div>
                      {version.change_note && (
                        <p className="text-gray-600 mt-1">
                          {version.change_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
