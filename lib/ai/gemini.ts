import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Gemini API 클라이언트 싱글톤
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;
let embeddingModel: GenerativeModel | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export function getModel(): GenerativeModel {
  if (!model) {
    model = getGenAI().getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });
  }
  return model;
}

export function getEmbeddingModel(): GenerativeModel {
  if (!embeddingModel) {
    embeddingModel = getGenAI().getGenerativeModel({
      model: 'text-embedding-004',
    });
  }
  return embeddingModel;
}

// 텍스트 생성 (일반)
export async function generateText(prompt: string): Promise<string> {
  const model = getModel();
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

// 텍스트 생성 (스트리밍)
export async function* generateTextStream(prompt: string): AsyncGenerator<string> {
  const model = getModel();
  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

// JSON 응답 생성 (파싱 포함)
export async function generateJSON<T>(prompt: string): Promise<T> {
  const model = getModel();

  // JSON 응답을 강제하는 프롬프트 추가
  const jsonPrompt = `${prompt}

중요: 반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

  const result = await model.generateContent(jsonPrompt);
  const response = result.response;
  const text = response.text();

  // JSON 블록 추출 (```json ... ``` 형식 처리)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/```\s*([\s\S]*?)\s*```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;

  try {
    return JSON.parse(jsonText.trim()) as T;
  } catch (error) {
    console.error('JSON 파싱 실패:', jsonText);
    throw new Error('AI 응답을 JSON으로 파싱하는데 실패했습니다.');
  }
}

// 임베딩 생성
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getEmbeddingModel();
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// 배치 임베딩 생성
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Gemini API는 배치 임베딩을 직접 지원하지 않으므로 순차 처리
  // 레이트 리밋을 고려하여 약간의 딜레이 추가
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);

    // 레이트 리밋 방지를 위한 딜레이 (100ms)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return embeddings;
}
