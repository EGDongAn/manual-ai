import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getModel } from '@/lib/ai/gemini';
import { getChatSystemPrompt, getWritingAssistPrompt } from '@/lib/ai/prompts';
import { searchManualsForQA } from '@/lib/ai/vector-search';
import type { ChatMessage } from '@/lib/ai/types';

// POST /api/ai/chat - AI 채팅 (스트리밍)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, mode, manualContext } = body;

    if (!message) {
      return NextResponse.json(
        { error: '메시지가 필요합니다.' },
        { status: 400 }
      );
    }

    // 세션 조회 또는 생성
    let session;
    if (sessionId) {
      session = await prisma.ai_chat_sessions.findUnique({
        where: { id: sessionId },
      });
    }

    if (!session) {
      session = await prisma.ai_chat_sessions.create({
        data: {
          messages: [],
        },
      });
    }

    // 기존 메시지 히스토리
    const messages = (session.messages as unknown as ChatMessage[]) || [];

    // 관련 매뉴얼 검색
    let relevantManuals: {
      id: number;
      title: string;
      content: string;
      summary: string | null;
      categoryName: string | null;
    }[] = [];

    if (mode === 'writing' && manualContext) {
      // 매뉴얼 작성 모드: 컨텍스트 사용
      relevantManuals = [];
    } else {
      // Q&A 모드: 관련 매뉴얼 검색
      const searchResults = await searchManualsForQA(message, 5);
      relevantManuals = searchResults;
    }

    // 시스템 프롬프트 생성
    let systemPrompt: string;
    if (mode === 'writing') {
      systemPrompt = getWritingAssistPrompt(
        manualContext?.title || null,
        manualContext?.content || null,
        message
      );
    } else {
      systemPrompt = getChatSystemPrompt(
        relevantManuals.map(m => ({
          id: m.id,
          title: m.title,
          content: m.content,
          summary: m.summary,
          categoryName: m.categoryName,
        }))
      );
    }

    // 대화 히스토리 구성
    const conversationHistory = messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.content }],
    }));

    // 스트리밍 응답 생성
    const model = getModel();
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: '네, 이해했습니다. 병원 업무 매뉴얼 기반으로 도움을 드리겠습니다.' }] },
        ...conversationHistory.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'model' as const,
          parts: m.parts,
        })),
      ],
    });

    const result = await chat.sendMessageStream(message);

    // 스트리밍 응답
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';

        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }

          // 세션 업데이트
          const newMessages: ChatMessage[] = [
            ...messages,
            {
              role: 'user',
              content: message,
              timestamp: new Date().toISOString(),
            },
            {
              role: 'assistant',
              content: fullResponse,
              timestamp: new Date().toISOString(),
              sources: relevantManuals.map(m => ({
                manualId: m.id,
                title: m.title,
                relevance: '관련 매뉴얼',
              })),
            },
          ];

          await prisma.ai_chat_sessions.update({
            where: { id: session.id },
            data: {
              messages: newMessages as unknown as object,
              context: relevantManuals.map(m => m.id),
              title: session.title || message.slice(0, 50),
            },
          });

          // 완료 신호
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                sessionId: session.id,
                sources: relevantManuals.map(m => ({
                  id: m.id,
                  title: m.title,
                  categoryName: m.categoryName,
                })),
              })}\n\n`
            )
          );
        } catch (error) {
          console.error('스트리밍 오류:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: '응답 생성 중 오류가 발생했습니다.' })}\n\n`)
          );
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('채팅 실패:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'AI 채팅에 실패했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}

// GET /api/ai/chat - 채팅 세션 목록 또는 상세 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // 특정 세션 조회
      const session = await prisma.ai_chat_sessions.findUnique({
        where: { id: parseInt(sessionId) },
      });

      if (!session) {
        return NextResponse.json(
          { error: '세션을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      return NextResponse.json(session);
    }

    // 세션 목록 조회
    const sessions = await prisma.ai_chat_sessions.findMany({
      select: {
        id: true,
        title: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { updated_at: 'desc' },
      take: 50,
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('세션 조회 실패:', error);
    return NextResponse.json(
      { error: '세션 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/chat - 채팅 세션 삭제
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    await prisma.ai_chat_sessions.delete({
      where: { id: parseInt(sessionId) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('세션 삭제 실패:', error);
    return NextResponse.json(
      { error: '세션 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
