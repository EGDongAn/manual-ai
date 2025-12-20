'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatInterface } from '@/components/ai/chat-interface';
import { ManualCreationModal } from '@/components/ai/manual-creation-modal';
import { MessageSquare, Plus, Trash2, Clock } from 'lucide-react';

interface ChatSession {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ManualDraft {
  title: string;
  suggestedCategoryId: number | null;
  suggestedCategoryName: string;
  summary: string;
  content: string;
  tags: string[];
}

export default function AIChatPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);

  // 매뉴얼 생성 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [draftManual, setDraftManual] = useState<ManualDraft | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/ai/chat');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('세션 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setSelectedSessionId(undefined);
  };

  const handleDeleteSession = async (id: number) => {
    if (!confirm('이 대화를 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/ai/chat?sessionId=${id}`, {
        method: 'DELETE',
      });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSessionId === id) {
        setSelectedSessionId(undefined);
      }
    } catch (error) {
      console.error('세션 삭제 실패:', error);
    }
  };

  // 매뉴얼 초안 생성 완료 핸들러
  const handleManualDraftReady = useCallback((draft: ManualDraft) => {
    setDraftManual(draft);
    setShowModal(true);
  }, []);

  // 매뉴얼 저장 핸들러
  const handleSaveManual = useCallback(async (data: {
    title: string;
    content: string;
    summary: string;
    category_id: number | null;
    tags: string[];
  }) => {
    const res = await fetch('/api/manuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error('매뉴얼 저장 실패');
    }

    const result = await res.json();
    if (result.success) {
      // 저장 성공 시 매뉴얼 상세 페이지로 이동
      router.push(`/manuals/${result.data.id}`);
    } else {
      throw new Error(result.error || '매뉴얼 저장 실패');
    }
  }, [router]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          AI 어시스턴트
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 사이드바 - 대화 목록 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                대화 목록
                <Button size="sm" onClick={handleNewChat}>
                  <Plus className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-gray-500">로딩 중...</p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-gray-500">대화가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedSessionId === session.id
                          ? 'bg-blue-100'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.title || '새 대화'}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(session.updated_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 메인 채팅 영역 */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedSessionId ? '대화 계속하기' : '새 대화'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChatInterface
                key={selectedSessionId || 'new'}
                sessionId={selectedSessionId}
                mode="qa"
                onManualDraftReady={handleManualDraftReady}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 안내 */}
      <div className="mt-8">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-medium text-blue-900 mb-2">AI 어시스턴트 사용 안내</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>- 매뉴얼에 관한 질문에 답변해드립니다</li>
              <li>- 기존 매뉴얼을 참조하여 정확한 정보를 제공합니다</li>
              <li>- 관련 매뉴얼을 자동으로 연결해드립니다</li>
              <li>- 매뉴얼이 없는 경우, 대화형으로 새 매뉴얼 작성을 도와드립니다</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 매뉴얼 작성 모달 */}
      {draftManual && (
        <ManualCreationModal
          draft={draftManual}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setDraftManual(null);
          }}
          onSave={handleSaveManual}
        />
      )}
    </div>
  );
}
