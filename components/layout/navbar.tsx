'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

const navItems = [
  { href: '/', label: '대시보드' },
  { href: '/manuals', label: '매뉴얼' },
  { href: '/categories', label: '카테고리' },
  { href: '/ai/chat', label: 'AI 채팅' },
  { href: '/ai/search', label: 'AI 검색' },
]

export function Navbar() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* 좌측: 햄버거 + 로고 + 메뉴 */}
          <div className="flex items-center space-x-4 lg:space-x-8">
            {/* 모바일: 햄버거 버튼 */}
            <button
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-gray-100"
              onClick={() => setIsMenuOpen(true)}
              aria-label="메뉴 열기"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* 로고 */}
            <Link href="/" className="text-xl font-bold text-blue-600">
              EG Manual
            </Link>

            {/* 데스크톱: 수평 메뉴 */}
            <div className="hidden lg:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* 우측: 관리자, 로그아웃 */}
          <div className="flex items-center space-x-4">
            <span className="hidden sm:inline text-sm text-gray-600">관리자</span>
            <Button variant="outline" size="sm">
              로그아웃
            </Button>
          </div>
        </div>
      </div>

      {/* 모바일: 오버레이 */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMenu}
        />
      )}

      {/* 모바일: 좌측 슬라이드 사이드바 */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <span className="text-lg font-bold text-blue-600">메뉴</span>
          <button
            className="p-2 rounded-md hover:bg-gray-100"
            onClick={closeMenu}
            aria-label="메뉴 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 사이드바 메뉴 */}
        <div className="py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className={`block px-4 py-3 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
