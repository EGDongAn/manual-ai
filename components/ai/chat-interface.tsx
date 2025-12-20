'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ChatMessage } from './chat-message';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Send, Trash2, PenSquare, FileText } from 'lucide-react';
import type { ManualCreationContext } from '@/lib/ai/prompts';

type ChatMode = 'qa' | 'writing' | 'creating' | 'generating';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    manualId: number;
    title: string;
    relevance?: string;
  }[];
  noResults?: boolean;
}

interface ManualDraft {
  title: string;
  suggestedCategoryId: number | null;
  suggestedCategoryName: string;
  summary: string;
  content: string;
  tags: string[];
}

interface ChatInterfaceProps {
  sessionId?: number;
  mode?: ChatMode;
  manualContext?: {
    title?: string;
    content?: string;
  };
  onManualUpdate?: (content: string) => void;
  onManualDraftReady?: (draft: ManualDraft) => void;
}

export function ChatInterface({
  sessionId: initialSessionId,
  mode: initialMode = 'qa',
  manualContext,
  onManualUpdate,
  onManualDraftReady,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | undefined>(initialSessionId);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 매뉴얼 작성 관련 상태
  const [currentMode, setCurrentMode] = useState<ChatMode>(initialMode);
  const [creationContext, setCreationContext] = useState<ManualCreationContext | null>(null);
  const [showCreateSuggestion, setShowCreateSuggestion] = useState(false);
  const [pendingTopic, setPendingTopic] = useState<string>('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 세션 로드
  useEffect(() => {
    if (initialSessionId) {
      loadSession(initialSessionId);
    }
  }, [initialSessionId]);

  const loadSession = async (id: number) => {
    try {
      const res = await fetch(`/api/ai/chat?sessionId=${id}`);
      if (res.ok) {
        const session = await res.json();
        setMessages(session.messages || []);
        setSessionId(id);
      }
    } catch (error) {
      console.error('세션 로드 실패:', error);
    }
  };

  // 매뉴얼 작성 모드 시작
  const startManualCreation = useCallback((topic: string) => {
    const newContext: ManualCreationContext = {
      topic,
      collectedInfo: {},
      currentStep: 1,
    };
    setCreationContext(newContext);
    setCurrentMode('creating');
    setShowCreateSuggestion(false);
    setPendingTopic('');

    // 작성 모드 시작 메시지 추가
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `좋습니다! **"${topic}"**에 대한 매뉴얼 작성을 시작하겠습니다.\n\n대화를 통해 필요한 정보를 수집한 후, 구조화된 매뉴얼 초안을 생성해드리겠습니다.`,
      },
    ]);
  }, []);

  // 초안 생성 요청
  const requestDraftGeneration = useCallback(async () => {
    if (!creationContext) return;

    setCurrentMode('generating');
    setIsLoading(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '수집된 정보를 바탕으로 매뉴얼 초안을 생성해주세요.',
          sessionId,
          mode: 'generating',
          creationContext,
        }),
      });

      if (!response.ok) throw new Error('초안 생성 요청 실패');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              }
              if (data.done) {
                setSessionId(data.sessionId);
              }
            } catch {
              // JSON 파싱 오류 무시
            }
          }
        }
      }

      // JSON 응답 파싱 시도
      try {
        const draft: ManualDraft = JSON.parse(fullContent);
        if (onManualDraftReady) {
          onManualDraftReady(draft);
        }
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `매뉴얼 초안이 생성되었습니다!\n\n**제목:** ${draft.title}\n**카테고리:** ${draft.suggestedCategoryName}\n\n미리보기를 확인하고 저장해주세요.`,
          },
        ]);
      } catch {
        // JSON 파싱 실패 시 일반 텍스트로 표시
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: fullContent },
        ]);
      }

      setStreamingContent('');
      setCurrentMode('qa');
      setCreationContext(null);
    } catch (error) {
      console.error('초안 생성 오류:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '초안 생성 중 오류가 발생했습니다.' },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  }, [creationContext, sessionId, onManualDraftReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // 사용자 메시지 추가
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // 매뉴얼 작성 제안에 동의한 경우
    if (showCreateSuggestion) {
      const positiveResponses = ['네', '예', '응', '좋아', '작성해줘', '만들어줘', '부탁해'];
      if (positiveResponses.some(r => userMessage.includes(r))) {
        startManualCreation(pendingTopic);
        setIsLoading(false);
        return;
      } else {
        setShowCreateSuggestion(false);
        setPendingTopic('');
      }
    }

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          mode: currentMode,
          manualContext,
          creationContext: currentMode === 'creating' ? creationContext : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('채팅 요청 실패');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let sources: Message['sources'] = [];
      let noResults = false;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              }

              if (data.done) {
                setSessionId(data.sessionId);
                sources = data.sources || [];
                noResults = data.noResults || false;
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch {
              // JSON 파싱 오류 무시 (불완전한 청크)
            }
          }
        }
      }

      // 스트리밍 완료 후 메시지 추가
      setStreamingContent('');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: fullContent, sources, noResults },
      ]);

      // 검색 결과 없음 처리 - 매뉴얼 작성 제안 표시
      if (noResults && currentMode === 'qa') {
        setShowCreateSuggestion(true);
        setPendingTopic(userMessage);
      }

      // 매뉴얼 작성 모드에서 정보 수집 진행
      if (currentMode === 'creating' && creationContext) {
        // 사용자 응답을 컨텍스트에 반영 (단계별 정보 수집)
        const step = creationContext.currentStep;
        const updatedInfo = { ...creationContext.collectedInfo };

        // 단계별 정보 저장 (간단한 파싱)
        switch (step) {
          case 1:
            updatedInfo.purpose = userMessage;
            break;
          case 2:
            updatedInfo.targetAudience = userMessage;
            break;
          case 3:
            updatedInfo.procedures = userMessage.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
            break;
          case 4:
            updatedInfo.warnings = userMessage.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
            break;
          case 5:
            updatedInfo.additionalNotes = userMessage;
            break;
        }

        // 다음 단계로 진행 또는 완료
        if (step < 5) {
          setCreationContext({
            ...creationContext,
            collectedInfo: updatedInfo,
            currentStep: step + 1,
          });
        } else {
          // 모든 정보 수집 완료 - 초안 생성 준비
          setCreationContext({
            ...creationContext,
            collectedInfo: updatedInfo,
            currentStep: 5,
          });
        }
      }

      // 매뉴얼 작성 모드에서 콜백 호출
      if (currentMode === 'writing' && onManualUpdate) {
        onManualUpdate(fullContent);
      }
    } catch (error) {
      console.error('채팅 오류:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  const clearChat = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/ai/chat?sessionId=${sessionId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('세션 삭제 실패:', error);
      }
    }
    setMessages([]);
    setSessionId(undefined);
    setCurrentMode(initialMode);
    setCreationContext(null);
    setShowCreateSuggestion(false);
    setPendingTopic('');
  };

  // 작성 모드 취소
  const cancelCreation = () => {
    setCurrentMode('qa');
    setCreationContext(null);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '매뉴얼 작성을 취소했습니다. 다른 질문이 있으시면 말씀해주세요.' },
    ]);
  };

  // 모드별 상태 표시 가져오기
  const getModeDisplay = () => {
    switch (currentMode) {
      case 'creating':
        return {
          label: '매뉴얼 작성 중',
          color: 'bg-blue-100 text-blue-800',
          step: creationContext?.currentStep || 1,
        };
      case 'generating':
        return {
          label: '초안 생성 중',
          color: 'bg-purple-100 text-purple-800',
          step: 0,
        };
      case 'writing':
        return {
          label: '수정 모드',
          color: 'bg-green-100 text-green-800',
          step: 0,
        };
      default:
        return null;
    }
  };

  const modeDisplay = getModeDisplay();

  return (
    <Card className="flex flex-col h-[600px]">
      {/* 모드 상태 표시 */}
      {modeDisplay && (
        <div className={`px-4 py-2 ${modeDisplay.color} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <PenSquare className="h-4 w-4" />
            <span className="font-medium">{modeDisplay.label}</span>
            {modeDisplay.step > 0 && (
              <span className="text-sm opacity-75">
                ({modeDisplay.step}/5 단계)
              </span>
            )}
            {creationContext && (
              <span className="text-sm opacity-75">
                - {creationContext.topic}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentMode === 'creating' && creationContext && creationContext.currentStep >= 3 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={requestDraftGeneration}
                className="flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                초안 생성
              </Button>
            )}
            {currentMode === 'creating' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelCreation}
              >
                취소
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg font-medium">
              {currentMode === 'writing'
                ? '매뉴얼 작성을 도와드릴게요'
                : '무엇이든 물어보세요'}
            </p>
            <p className="text-sm mt-2">
              {currentMode === 'writing'
                ? '작성하고 싶은 내용을 말씀해주세요'
                : '매뉴얼에 관한 질문에 답변해드립니다'}
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage
            key={idx}
            role={msg.role}
            content={msg.content}
            sources={msg.sources}
          />
        ))}

        {streamingContent && (
          <ChatMessage
            role="assistant"
            content={streamingContent}
            isStreaming
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              currentMode === 'creating'
                ? '정보를 입력해주세요...'
                : currentMode === 'writing'
                  ? '매뉴얼 내용을 입력하거나 작성 요청을 해주세요...'
                  : showCreateSuggestion
                    ? '"네" 또는 "작성해줘"라고 입력하시면 매뉴얼 작성을 시작합니다...'
                    : '질문을 입력하세요...'
            }
            className="min-h-[60px] resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={clearChat}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}
