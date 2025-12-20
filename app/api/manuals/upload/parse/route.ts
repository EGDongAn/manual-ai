import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

// POST /api/manuals/upload/parse - 파일 파싱 (DOCX, TXT, MD)
// PDF는 복잡한 의존성으로 인해 클라이언트에서 텍스트 붙여넣기 권장
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    const filename = file.name;
    const extension = filename.split('.').pop()?.toLowerCase();

    // 파일을 ArrayBuffer로 읽기
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let content = '';
    let metadata: Record<string, unknown> = {};

    switch (extension) {
      case 'txt':
      case 'md':
        // 텍스트 파일은 그대로 디코딩
        content = buffer.toString('utf-8');
        break;

      case 'docx':
        // DOCX 파싱
        try {
          const result = await mammoth.extractRawText({ buffer });
          content = result.value;
          if (result.messages.length > 0) {
            metadata.warnings = result.messages.map(m => m.message);
          }
        } catch (docxError) {
          console.error('DOCX 파싱 오류:', docxError);
          return NextResponse.json(
            { error: 'DOCX 파일을 파싱할 수 없습니다.' },
            { status: 400 }
          );
        }
        break;

      case 'pdf':
        // PDF는 서버에서 파싱하기 어려움 - 텍스트 붙여넣기 안내
        return NextResponse.json(
          {
            error: 'PDF 파일은 직접 텍스트를 복사하여 붙여넣기 해주세요.',
            suggestion: 'PDF 파일을 열어 텍스트를 선택 후 복사(Ctrl+C)하여 붙여넣기 입력란에 붙여넣기(Ctrl+V)하세요.'
          },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식입니다: ${extension}` },
          { status: 400 }
        );
    }

    // 빈 콘텐츠 체크
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: '파일에서 텍스트를 추출할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 텍스트 정리: 연속된 공백/줄바꿈 정리
    content = content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return NextResponse.json({
      success: true,
      data: {
        filename,
        extension,
        content,
        charCount: content.length,
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
        metadata,
      },
    });
  } catch (error) {
    console.error('파일 파싱 실패:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: '파일 파싱에 실패했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}
