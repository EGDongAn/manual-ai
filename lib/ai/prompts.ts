// AI 프롬프트 템플릿

interface Category {
  id: number;
  name: string;
  description: string | null;
  parentName?: string | null;
}

interface Manual {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  categoryName: string | null;
}

interface SimilarManual {
  id: number;
  title: string;
  summary: string | null;
  categoryName: string | null;
  similarity: number;
}

// 카테고리 자동 분류 프롬프트
export function getClassifyPrompt(
  title: string,
  content: string,
  categories: Category[]
): string {
  const categoryList = categories
    .map(c => {
      const parent = c.parentName ? `(상위: ${c.parentName})` : '';
      return `- ID: ${c.id}, 이름: ${c.name} ${parent}${c.description ? ` - ${c.description}` : ''}`;
    })
    .join('\n');

  return `당신은 병원 업무 매뉴얼 분류 전문가입니다.

[기존 카테고리 목록]
${categoryList || '(카테고리가 없습니다)'}

[분류할 매뉴얼]
제목: ${title}
내용 요약: ${content.slice(0, 1000)}

위 매뉴얼에 가장 적합한 카테고리를 3개 추천하고 각각의 적합도(0-100)를 JSON으로 응답하세요.
만약 적합한 카테고리가 없다면 새 카테고리를 제안하세요.

응답 형식:
{
  "recommendations": [
    {"categoryId": 1, "name": "카테고리명", "score": 95, "reason": "추천 이유"},
    {"categoryId": 2, "name": "카테고리명", "score": 80, "reason": "추천 이유"}
  ],
  "newCategorySuggestion": null
}

또는 새 카테고리가 필요한 경우:
{
  "recommendations": [],
  "newCategorySuggestion": {"name": "새 카테고리명", "parentId": 1, "reason": "제안 이유"}
}`;
}

// 중복/연관성 분석 프롬프트
export function getAnalyzePrompt(
  title: string,
  content: string,
  similarManuals: SimilarManual[]
): string {
  const manualsContext = similarManuals
    .map((m, i) => `
### 매뉴얼 ${i + 1} (유사도: ${Math.round(m.similarity * 100)}%)
- ID: ${m.id}
- 제목: ${m.title}
- 카테고리: ${m.categoryName || '미분류'}
- 요약: ${m.summary || '(요약 없음)'}
`)
    .join('\n');

  return `당신은 병원 매뉴얼 분석 전문가입니다.

[새로 작성 중인 매뉴얼]
제목: ${title}
내용: ${content.slice(0, 1500)}

[유사한 기존 매뉴얼들]
${manualsContext || '(유사한 매뉴얼이 없습니다)'}

분석 요청:
1. 새 매뉴얼이 기존 매뉴얼과 중복되는지 판단
2. 기존 매뉴얼을 수정/보완하는 것이 나은지 평가
3. 별도 매뉴얼로 작성해야 하는지 결정

JSON 형식으로 응답:
{
  "isDuplicate": false,
  "duplicateOf": null,
  "duplicateReason": null,
  "recommendation": "CREATE_NEW",
  "targetManualId": null,
  "details": "분석 결과 상세 설명..."
}

recommendation 값:
- CREATE_NEW: 새 매뉴얼로 작성
- UPDATE_EXISTING: 기존 매뉴얼 업데이트 권장 (targetManualId에 해당 ID 명시)
- MERGE: 기존 매뉴얼과 병합 권장`;
}

// AI 채팅 시스템 프롬프트
export function getChatSystemPrompt(
  manuals: Manual[],
  categories?: Category[],
  clinicContext?: {
    name: string;
    departments: { name: string; treatments: string[] }[];
  }
): string {
  const manualsContext = manuals
    .map((m, i) => `
### 매뉴얼 ${i + 1}: ${m.title}
카테고리: ${m.categoryName || '미분류'}
내용:
${m.content.slice(0, 2000)}
---`)
    .join('\n');

  const categoryContext = categories && categories.length > 0
    ? categories.map(c => {
        const parent = c.parentName ? ` (상위: ${c.parentName})` : '';
        return `- ${c.name}${parent}${c.description ? `: ${c.description}` : ''}`;
      }).join('\n')
    : '';

  const clinicDepartments = clinicContext?.departments
    ? clinicContext.departments.map(d => `- ${d.name}: ${d.treatments.join(', ')}`).join('\n')
    : '';

  return `당신은 ${clinicContext?.name || '병원'} 업무 매뉴얼에 기반한 AI 어시스턴트입니다.

역할:
1. 사용자의 질문에 정확하게 답변
2. 매뉴얼 작성 보조 (구조화, 교정, 개선 제안)
3. 관련 매뉴얼 연결 및 참조
4. 새 매뉴얼 작성 시 적절한 카테고리 추천

${categoryContext ? `[현재 설정된 업무 카테고리]
${categoryContext}
` : ''}
${clinicDepartments ? `[진료 분야]
${clinicDepartments}
` : ''}
[참고 매뉴얼]
${manualsContext || '(참고할 매뉴얼이 없습니다)'}

지시사항:
- 위 매뉴얼들을 참고하여 정확하게 답변하세요
- 매뉴얼에 없는 내용은 추측하지 말고 솔직히 알려주세요
- 답변의 근거가 되는 매뉴얼이 있다면 참조를 명시하세요
- 병원 업무에 맞는 전문적이고 명확한 문체를 사용하세요
- 사용자가 "카테고리" 또는 "파트"에 대해 물으면 위 카테고리 목록을 안내하세요
- 사용자가 매뉴얼 작성을 요청하면 위 카테고리 중 적절한 것을 선택하여 구조화된 매뉴얼을 작성하세요
- 마크다운 형식으로 응답하세요`;
}

// 매뉴얼 작성 보조 프롬프트
export function getWritingAssistPrompt(
  currentTitle: string | null,
  currentContent: string | null,
  userRequest: string
): string {
  return `당신은 병원 업무 매뉴얼 작성을 돕는 AI 어시스턴트입니다.

[현재 매뉴얼 상태]
제목: ${currentTitle || '(미정)'}
현재 내용:
${currentContent || '(작성 시작 전)'}

[사용자 요청]
${userRequest}

[지시사항]
- 병원 업무에 맞는 전문적이고 명확한 문체를 사용하세요
- 단계별 절차는 번호를 매겨 정리하세요
- 주의사항이나 중요 사항은 명확히 강조하세요
- 가능하면 실제 예시를 포함하세요

마크다운 형식으로 응답하세요.`;
}

// 검색 결과 기반 Q&A 프롬프트
export function getSearchQAPrompt(question: string, manuals: Manual[]): string {
  const manualsContext = manuals
    .map((m, i) => `
### 매뉴얼 ${i + 1}: ${m.title}
카테고리: ${m.categoryName || '미분류'}
내용:
${m.content}
---`)
    .join('\n');

  return `당신은 병원 업무 매뉴얼에 기반한 Q&A 어시스턴트입니다.

[관련 매뉴얼]
${manualsContext || '(관련 매뉴얼이 없습니다)'}

[사용자 질문]
${question}

[지시사항]
1. 위 매뉴얼들을 참고하여 정확하게 답변하세요
2. 답변의 근거가 되는 매뉴얼을 명시하세요
3. 매뉴얼에 없는 내용은 "관련 매뉴얼을 찾을 수 없습니다"라고 답변하세요
4. 여러 매뉴얼의 정보를 종합해야 하는 경우 명확히 구분하세요

JSON 형식으로 응답:
{
  "answer": "답변 내용 (마크다운 형식)",
  "sources": [
    {"manualId": 1, "title": "매뉴얼 제목", "relevance": "이 매뉴얼의 어느 부분을 참조했는지"}
  ],
  "confidence": 0.95,
  "followUpQuestions": ["관련 후속 질문 1", "관련 후속 질문 2"]
}`;
}

// 매뉴얼 구조화 프롬프트
export function getStructurePrompt(rawContent: string): string {
  return `다음 매뉴얼 내용을 분석하고 구조화된 형태로 재구성해주세요.

[원본 내용]
${rawContent}

[요구사항]
1. 적절한 제목 제안
2. 목차 생성
3. 섹션별로 분리
4. 단계별 절차 정리 (있는 경우)
5. 주의사항 별도 정리 (있는 경우)
6. 요약문 생성

마크다운 형식으로 응답하세요.`;
}

// 매뉴얼 요약 프롬프트
export function getSummaryPrompt(title: string, content: string): string {
  return `다음 매뉴얼의 핵심 내용을 2-3문장으로 요약해주세요.

제목: ${title}
내용:
${content}

요약만 응답하세요. 다른 설명은 필요 없습니다.`;
}
