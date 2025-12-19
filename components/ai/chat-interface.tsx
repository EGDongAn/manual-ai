'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ChatMessage } from './chat-message';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Send, Trash2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    manualId: number;
    title: string;
    relevance?: string;
  }[];
}

interface ChatInterfaceProps {
  sessionId?: number;
  mode?: 'qa' | 'writing';
  manualContext?: {
    title?: string;
    content?: string;
  };
  onManualUpdate?: (content: string) => void;
}

export function ChatInterface({
  sessionId: initialSessionId,
  mode = 'qa',
  manualContext,
  onManualUpdate,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | undefined>(initialSessionId);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // 사용자 메시지 추가
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          mode,
          manualContext,
        }),
      });

      if (!response.ok) {
        throw new Error('채팅 요청 실패');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let sources: Message['sources'] = [];

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
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              // JSON 파싱 오류 무시 (불완전한 청크)
            }
          }
        }
      }

      // 스트리밍 완료 후 메시지 추가
      setStreamingContent('');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: fullContent, sources },
      ]);

      // 매뉴얼 작성 모드에서 콜백 호출
      if (mode === 'writing' && onManualUpdate) {
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
  };

  return (
    <Card className="flex flex-col h-[600px]">
      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg font-medium">
              {mode === 'writing'
                ? '매뉴얼 작성을 도와드릴게요'
                : '무엇이든 물어보세요'}
            </p>
            <p className="text-sm mt-2">
              {mode === 'writing'
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
              mode === 'writing'
                ? '매뉴얼 내용을 입력하거나 작성 요청을 해주세요...'
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
