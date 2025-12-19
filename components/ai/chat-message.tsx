'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { User, Bot } from 'lucide-react';

interface Source {
  manualId: number;
  title: string;
  relevance?: string;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
}

export function ChatMessage({
  role,
  content,
  sources,
  isStreaming,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg',
        isUser ? 'bg-blue-50' : 'bg-gray-50'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="prose prose-sm max-w-none">
          {content.split('\n').map((line, i) => (
            <p key={i} className="mb-1">
              {line || '\u00A0'}
            </p>
          ))}
          {isStreaming && (
            <span className="inline-block h-4 w-1 animate-pulse bg-gray-400" />
          )}
        </div>

        {sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">참조한 매뉴얼:</p>
            <div className="flex flex-wrap gap-1">
              {sources.map(source => (
                <Badge
                  key={source.manualId}
                  variant="secondary"
                  className="cursor-pointer hover:bg-gray-200"
                  onClick={() => window.open(`/manuals/${source.manualId}`, '_blank')}
                >
                  {source.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
