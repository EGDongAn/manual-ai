/**
 * 문서 청킹 시스템
 *
 * 매뉴얼을 의미적 경계에 따라 작은 청크로 분할하여
 * 더 정확한 검색과 컨텍스트 제공을 가능하게 합니다.
 */

export interface Chunk {
  content: string;
  metadata: {
    sectionTitle?: string;
    startOffset: number;
    endOffset: number;
  };
  tokenCount: number;
}

// 청킹 설정
export const CHUNK_SIZE = 500; // 토큰
export const CHUNK_OVERLAP = 50; // 토큰

/**
 * 토큰 추정 함수
 *
 * 정확한 토큰화가 아닌 근사값 사용
 * - 한글: 약 1.5자/토큰
 * - 영어: 약 4자/토큰
 * - 공백/기호: 별도 카운트
 */
export function estimateTokens(text: string): number {
  // 한글, 영어, 숫자, 기타 문자 분리
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const otherChars = text.length - koreanChars - englishChars;

  // 토큰 추정
  const koreanTokens = koreanChars / 1.5;
  const englishTokens = englishChars / 4;
  const otherTokens = otherChars / 2;

  return Math.ceil(koreanTokens + englishTokens + otherTokens);
}

/**
 * 섹션 헤더 감지
 *
 * 마크다운 형식의 헤더나 번호 매김 형식 감지
 */
function detectSectionHeaders(text: string): { title: string; position: number }[] {
  const headers: { title: string; position: number }[] = [];
  const lines = text.split('\n');

  let currentPos = 0;
  for (const line of lines) {
    const trimmed = line.trim();

    // 마크다운 헤더 (# ## ### 등)
    const mdHeaderMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (mdHeaderMatch) {
      headers.push({
        title: mdHeaderMatch[2],
        position: currentPos
      });
    }

    // 번호 매김 헤더 (1. 1.1. 등)
    const numberedHeaderMatch = trimmed.match(/^(\d+\.)+\s+(.+)$/);
    if (numberedHeaderMatch) {
      headers.push({
        title: trimmed,
        position: currentPos
      });
    }

    // 대문자로만 구성된 짧은 줄 (섹션 제목일 가능성)
    if (trimmed.length > 0 && trimmed.length < 100 &&
        trimmed === trimmed.toUpperCase() &&
        /^[A-Z\s\d가-힣]+$/.test(trimmed)) {
      headers.push({
        title: trimmed,
        position: currentPos
      });
    }

    currentPos += line.length + 1; // +1 for newline
  }

  return headers;
}

/**
 * 문단 경계 감지
 *
 * 빈 줄이나 특정 패턴으로 문단 구분
 */
function detectParagraphBoundaries(text: string): number[] {
  const boundaries: number[] = [0];
  const lines = text.split('\n');

  let currentPos = 0;
  let previousLineEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isEmptyLine = line.trim().length === 0;

    // 빈 줄 다음에 내용이 시작되는 지점
    if (previousLineEmpty && !isEmptyLine && currentPos > 0) {
      boundaries.push(currentPos);
    }

    previousLineEmpty = isEmptyLine;
    currentPos += line.length + 1; // +1 for newline
  }

  boundaries.push(text.length);
  return boundaries;
}

/**
 * 텍스트를 청크로 분할
 *
 * 의미적 경계(헤더, 단락)를 고려하여 CHUNK_SIZE 토큰 단위로 분할
 */
export function chunkDocument(content: string, title: string): Chunk[] {
  const chunks: Chunk[] = [];

  // 섹션 헤더 감지
  const headers = detectSectionHeaders(content);

  // 문단 경계 감지
  const paragraphBoundaries = detectParagraphBoundaries(content);

  let currentChunk = '';
  let currentTokens = 0;
  let chunkStartOffset = 0;
  let currentSectionTitle: string | undefined = title;

  // 헤더를 기준으로 섹션 분할
  const sections: { title: string; start: number; end: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].position;
    const end = i < headers.length - 1 ? headers[i + 1].position : content.length;
    sections.push({
      title: headers[i].title,
      start,
      end
    });
  }

  // 섹션이 없으면 전체를 하나의 섹션으로
  if (sections.length === 0) {
    sections.push({
      title: title,
      start: 0,
      end: content.length
    });
  }

  // 각 섹션을 청크로 분할
  for (const section of sections) {
    currentSectionTitle = section.title;
    const sectionContent = content.slice(section.start, section.end);
    const sectionParagraphs = detectParagraphBoundaries(sectionContent);

    let sectionOffset = section.start;
    currentChunk = '';
    currentTokens = 0;
    chunkStartOffset = sectionOffset;

    // 문단 단위로 청크 구성
    for (let i = 0; i < sectionParagraphs.length - 1; i++) {
      const paragraphStart = sectionParagraphs[i];
      const paragraphEnd = sectionParagraphs[i + 1];
      const paragraph = sectionContent.slice(paragraphStart, paragraphEnd).trim();

      if (!paragraph) continue;

      const paragraphTokens = estimateTokens(paragraph);

      // 현재 청크에 추가했을 때 크기 초과 시
      if (currentTokens + paragraphTokens > CHUNK_SIZE && currentChunk) {
        // 현재 청크 저장
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            sectionTitle: currentSectionTitle,
            startOffset: chunkStartOffset,
            endOffset: sectionOffset + paragraphStart
          },
          tokenCount: currentTokens
        });

        // 오버랩을 위해 마지막 몇 문장 유지
        const sentences = currentChunk.split(/[.!?]\s+/);
        const overlapSentences = sentences.slice(-2).join('. ');
        const overlapTokens = estimateTokens(overlapSentences);

        if (overlapTokens <= CHUNK_OVERLAP) {
          currentChunk = overlapSentences + '\n\n';
          currentTokens = overlapTokens;
        } else {
          currentChunk = '';
          currentTokens = 0;
        }

        chunkStartOffset = sectionOffset + paragraphStart;
      }

      // 문단 추가
      currentChunk += paragraph + '\n\n';
      currentTokens += paragraphTokens;
    }

    // 섹션의 마지막 청크 저장
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          sectionTitle: currentSectionTitle,
          startOffset: chunkStartOffset,
          endOffset: section.end
        },
        tokenCount: currentTokens
      });
    }
  }

  // 청크가 하나도 없으면 전체를 하나의 청크로
  if (chunks.length === 0 && content.trim()) {
    chunks.push({
      content: content.trim(),
      metadata: {
        sectionTitle: title,
        startOffset: 0,
        endOffset: content.length
      },
      tokenCount: estimateTokens(content)
    });
  }

  return chunks;
}

/**
 * 청크의 품질 검증
 *
 * 너무 짧거나 긴 청크, 의미 없는 청크 필터링
 */
export function validateChunk(chunk: Chunk): boolean {
  const MIN_TOKENS = 10;  // 짧은 청크도 허용 (검색 정확도 향상)
  const MAX_TOKENS = 1000;
  const MIN_CONTENT_LENGTH = 15;

  // 토큰 수 검증
  if (chunk.tokenCount < MIN_TOKENS || chunk.tokenCount > MAX_TOKENS) {
    return false;
  }

  // 내용 길이 검증
  if (chunk.content.length < MIN_CONTENT_LENGTH) {
    return false;
  }

  // 의미 있는 내용이 있는지 검증 (공백이나 특수문자만 있는 경우 제외)
  const meaningfulContent = chunk.content.replace(/[\s\n\r\t]/g, '');
  if (meaningfulContent.length < MIN_CONTENT_LENGTH / 2) {
    return false;
  }

  return true;
}

/**
 * 청킹 통계 정보
 */
export interface ChunkingStats {
  totalChunks: number;
  avgTokensPerChunk: number;
  minTokens: number;
  maxTokens: number;
  totalTokens: number;
}

/**
 * 청킹 통계 계산
 */
export function calculateChunkingStats(chunks: Chunk[]): ChunkingStats {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgTokensPerChunk: 0,
      minTokens: 0,
      maxTokens: 0,
      totalTokens: 0
    };
  }

  const tokenCounts = chunks.map(c => c.tokenCount);
  const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

  return {
    totalChunks: chunks.length,
    avgTokensPerChunk: Math.round(totalTokens / chunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    totalTokens
  };
}
