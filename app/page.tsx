'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, FolderTree, MessageSquare, Search, Plus, FileText, Bot } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalManuals: number
  publishedManuals: number
  draftManuals: number
  totalCategories: number
  totalTags: number
  recentManuals: {
    id: number
    title: string
    status: string
    updated_at: string
  }[]
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    totalManuals: 0,
    publishedManuals: 0,
    draftManuals: 0,
    totalCategories: 0,
    totalTags: 0,
    recentManuals: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // 매뉴얼 통계
        const manualsRes = await fetch('/api/manuals?limit=5')
        if (manualsRes.ok) {
          const manualsData = await manualsRes.json()
          const allManuals = await fetch('/api/manuals?limit=1000')
          const allData = allManuals.ok ? await allManuals.json() : { manuals: [] }

          const published = allData.manuals.filter((m: { status: string }) => m.status === 'PUBLISHED').length
          const draft = allData.manuals.filter((m: { status: string }) => m.status === 'DRAFT').length

          // 카테고리 수
          const categoriesRes = await fetch('/api/categories')
          const categoriesData = categoriesRes.ok ? await categoriesRes.json() : []

          // 태그 수
          const tagsRes = await fetch('/api/tags')
          const tagsData = tagsRes.ok ? await tagsRes.json() : []

          setStats({
            totalManuals: manualsData.pagination.total,
            publishedManuals: published,
            draftManuals: draft,
            totalCategories: categoriesData.length,
            totalTags: tagsData.length,
            recentManuals: manualsData.manuals.slice(0, 5),
          })
        }
      } catch (error) {
        console.error('통계 로드 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">대시보드</h1>
          <p className="text-gray-600 mt-1">AI 기반 병원 매뉴얼 관리 시스템</p>
        </div>
        <Link href="/manuals/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            새 매뉴얼
          </Button>
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 매뉴얼</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.totalManuals}</div>
            <p className="text-xs text-muted-foreground">
              게시됨 {stats.publishedManuals} / 초안 {stats.draftManuals}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">카테고리</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.totalCategories}</div>
            <p className="text-xs text-muted-foreground">
              등록된 카테고리
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">AI 채팅</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <Link href="/ai/chat">
              <Button variant="outline" size="sm" className="w-full">
                <Bot className="h-4 w-4 mr-2" />
                AI와 대화하기
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">AI 검색</CardTitle>
            <Search className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <Link href="/ai/search">
              <Button variant="outline" size="sm" className="w-full">
                <Search className="h-4 w-4 mr-2" />
                매뉴얼 검색하기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 매뉴얼 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              최근 매뉴얼
            </CardTitle>
            <CardDescription>최근 수정된 매뉴얼</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">로딩 중...</p>
            ) : stats.recentManuals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">매뉴얼이 없습니다</p>
                <Link href="/manuals/new">
                  <Button variant="link" size="sm">첫 매뉴얼 작성하기</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentManuals.map(manual => (
                  <Link
                    key={manual.id}
                    href={`/manuals/${manual.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{manual.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(manual.updated_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <Badge
                      variant={manual.status === 'PUBLISHED' ? 'default' : 'secondary'}
                    >
                      {manual.status === 'PUBLISHED' ? '게시됨' : '초안'}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 빠른 시작 가이드 */}
        <Card>
          <CardHeader>
            <CardTitle>시작하기</CardTitle>
            <CardDescription>AI 매뉴얼 관리 시스템 사용법</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
                  <h3 className="font-medium">카테고리 설정</h3>
                </div>
                <p className="text-sm text-gray-600">
                  매뉴얼을 분류할 카테고리를 먼저 생성하세요.
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                  <h3 className="font-medium text-blue-900">AI와 매뉴얼 작성</h3>
                </div>
                <p className="text-sm text-blue-800">
                  자연어로 내용을 말하면 AI가 자동으로 분류하고 구조화합니다.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
                  <h3 className="font-medium">검색 및 질의응답</h3>
                </div>
                <p className="text-sm text-gray-600">
                  AI 검색으로 필요한 정보를 빠르게 찾으세요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
