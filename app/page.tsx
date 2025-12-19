'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, FolderTree, Tag, FileText, Plus } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">대시보드</h1>
          <p className="text-gray-600 mt-1">병원 매뉴얼 관리 시스템</p>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              게시됨 0 / 초안 0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">카테고리</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              등록된 카테고리
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">태그</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              사용 중인 태그
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">최근 업데이트</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              최근 수정된 매뉴얼 없음
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 빠른 시작 가이드 */}
      <Card>
        <CardHeader>
          <CardTitle>시작하기</CardTitle>
          <CardDescription>매뉴얼 관리 시스템 사용법</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <h3 className="font-medium">카테고리 설정</h3>
              </div>
              <p className="text-sm text-gray-600">
                매뉴얼을 분류할 카테고리를 먼저 생성하세요.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <h3 className="font-medium">매뉴얼 작성</h3>
              </div>
              <p className="text-sm text-gray-600">
                새 매뉴얼을 작성하고 카테고리에 배치하세요.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <h3 className="font-medium">게시 및 공유</h3>
              </div>
              <p className="text-sm text-gray-600">
                완성된 매뉴얼을 게시하여 직원들과 공유하세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
