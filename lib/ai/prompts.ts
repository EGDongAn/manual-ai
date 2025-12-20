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

// Chain-of-Thought 강화 검색 Q&A 프롬프트
export function getEnhancedSearchQAPrompt(question: string, manuals: Manual[]): string {
  const manualsContext = manuals
    .map((m, i) => `
### 매뉴얼 ${i + 1}: ${m.title}
카테고리: ${m.categoryName || '미분류'}
내용:
${m.content}
---`)
    .join('\n');

  return `당신은 병원 업무 매뉴얼에 기반한 전문 Q&A 어시스턴트입니다.

[관련 매뉴얼]
${manualsContext || '(관련 매뉴얼이 없습니다)'}

[사용자 질문]
${question}

다음 단계별 사고 과정을 거쳐 답변하세요:

**1단계: 질문 이해**
- 사용자가 무엇을 알고 싶어하는지 명확히 파악
- 질문의 핵심 키워드와 의도 파악

**2단계: 매뉴얼 분석**
- 제공된 각 매뉴얼의 관련성 평가
- 질문에 대한 답변을 제공할 수 있는 부분 식별

**3단계: 정보 종합**
- 여러 매뉴얼의 정보를 논리적으로 결합
- 모순되는 정보가 있다면 명확히 지적

**4단계: 답변 구성**
- 근거 있는 명확한 답변 작성
- 매뉴얼에 없는 내용은 절대 추측하지 않음

**중요: 할루시네이션 방지 규칙**
- 제공된 매뉴얼에 명시된 내용만 사용
- 추측이나 외부 지식 사용 금지
- 불확실한 경우 "매뉴얼에 관련 정보가 없습니다"라고 명시
- 매뉴얼의 원문을 왜곡하지 않음

JSON 형식으로 응답:
{
  "reasoning": {
    "questionAnalysis": "질문 분석 결과",
    "relevantManuals": ["관련 있는 매뉴얼 번호 및 이유"],
    "synthesisApproach": "정보 종합 방법"
  },
  "answer": "답변 내용 (마크다운 형식)",
  "sources": [
    {"manualId": 1, "title": "매뉴얼 제목", "relevance": "이 매뉴얼의 어느 부분을 참조했는지"}
  ],
  "confidence": 0.95,
  "limitations": "답변의 한계나 주의사항 (있는 경우)",
  "followUpQuestions": ["관련 후속 질문 1", "관련 후속 질문 2"]
}`;
}

// 할루시네이션 방지 채팅 시스템 프롬프트
export function getGroundedChatSystemPrompt(
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

**핵심 원칙: 사실 기반 답변 (Grounded Responses)**

역할:
1. 사용자의 질문에 정확하게 답변
2. 매뉴얼 작성 보조 (구조화, 교정, 개선 제안)
3. 관련 매뉴얼 연결 및 참조
4. 새 매뉴얼 작성 시 적절한 카테고리 추천

**할루시네이션 방지 규칙:**
1. ✅ 제공된 매뉴얼에 명시된 정보만 사용
2. ✅ 불확실한 경우 솔직히 "매뉴얼에 관련 정보가 없습니다" 표시
3. ✅ 답변의 근거가 되는 매뉴얼을 명확히 인용
4. ❌ 매뉴얼에 없는 내용을 추측하거나 지어내지 않음
5. ❌ 외부 지식이나 일반 상식으로 답변하지 않음
6. ❌ 매뉴얼 내용을 왜곡하거나 과장하지 않음

**답변 검증 체크리스트:**
- [ ] 답변의 모든 주장이 매뉴얼에 근거하는가?
- [ ] 출처를 명확히 밝혔는가?
- [ ] 추측이나 가정을 사실처럼 말하지 않았는가?
- [ ] 불확실한 부분을 솔직히 인정했는가?

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
- 답변의 근거가 되는 매뉴얼이 있다면 반드시 참조를 명시하세요 (예: "매뉴얼 X에 따르면...")
- 병원 업무에 맞는 전문적이고 명확한 문체를 사용하세요
- 사용자가 "카테고리" 또는 "파트"에 대해 물으면 위 카테고리 목록을 안내하세요
- 사용자가 매뉴얼 작성을 요청하면 위 카테고리 중 적절한 것을 선택하여 구조화된 매뉴얼을 작성하세요
- 마크다운 형식으로 응답하세요`;
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

// 대화형 매뉴얼 작성 가이드 프롬프트
export interface ManualCreationContext {
  topic: string;
  collectedInfo: {
    purpose?: string;
    targetAudience?: string;
    procedures?: string[];
    warnings?: string[];
    examples?: string[];
    relatedManuals?: string[];
    additionalNotes?: string;
  };
  currentStep: number;
  categories?: Category[];
}

export function getManualCreationGuidePrompt(context: ManualCreationContext): string {
  const { topic, collectedInfo, currentStep, categories } = context;

  const categoryList = categories
    ? categories.map(c => {
        const parent = c.parentName ? ` (상위: ${c.parentName})` : '';
        return `- ${c.name}${parent}`;
      }).join('\n')
    : '';

  const collectedSummary = Object.entries(collectedInfo)
    .filter(([, value]) => value && (Array.isArray(value) ? value.length > 0 : true))
    .map(([key, value]) => {
      const keyNames: Record<string, string> = {
        purpose: '목적',
        targetAudience: '대상',
        procedures: '절차',
        warnings: '주의사항',
        examples: '예시',
        relatedManuals: '연관 매뉴얼',
        additionalNotes: '추가 정보'
      };
      const displayValue = Array.isArray(value) ? value.join(', ') : value;
      return `- ${keyNames[key] || key}: ${displayValue}`;
    })
    .join('\n');

  return `당신은 병원 업무 매뉴얼 작성을 도와주는 AI 어시스턴트입니다.

**현재 작성 중인 매뉴얼 주제:** ${topic}
**진행 단계:** ${currentStep}/5

${collectedSummary ? `**지금까지 수집된 정보:**
${collectedSummary}
` : ''}
${categoryList ? `**사용 가능한 카테고리:**
${categoryList}
` : ''}
**대화형 매뉴얼 작성 가이드:**

당신의 역할은 사용자와 대화하면서 매뉴얼 작성에 필요한 정보를 단계별로 수집하는 것입니다.

**정보 수집 순서:**
1. **목적 파악** (현재 단계: ${currentStep === 1 ? '진행 중' : currentStep > 1 ? '완료' : '대기'}): 이 매뉴얼이 왜 필요한지, 어떤 문제를 해결하는지
2. **대상 확인** (현재 단계: ${currentStep === 2 ? '진행 중' : currentStep > 2 ? '완료' : '대기'}): 누가 이 매뉴얼을 사용하는지 (신입, 전 직원, 특정 부서 등)
3. **절차 정리** (현재 단계: ${currentStep === 3 ? '진행 중' : currentStep > 3 ? '완료' : '대기'}): 구체적인 업무 절차나 단계
4. **주의사항** (현재 단계: ${currentStep === 4 ? '진행 중' : currentStep > 4 ? '완료' : '대기'}): 주의할 점, 자주 하는 실수, 예외 상황
5. **추가 정보** (현재 단계: ${currentStep === 5 ? '진행 중' : '대기'}): 예시, 관련 문서, 참고 사항

**응답 규칙:**
- 한 번에 하나의 질문만 하세요
- 사용자의 답변을 바탕으로 자연스럽게 다음 질문으로 이어가세요
- 충분한 정보가 수집되면 다음 단계로 넘어가세요
- 사용자가 "다음" 또는 "넘어가자"라고 하면 다음 단계로 진행하세요
- 모든 단계가 완료되면 초안 작성 준비가 되었음을 알리세요

**응답 형식:**
마크다운으로 친근하고 전문적인 어조로 응답하세요.
현재 단계와 관련된 질문을 하고, 필요시 예시를 들어 설명하세요.`;
}

// 수집된 정보로 매뉴얼 초안 생성 프롬프트
export function getManualDraftPrompt(context: ManualCreationContext): string {
  const { topic, collectedInfo, categories } = context;

  const categoryList = categories
    ? categories.map(c => {
        const parent = c.parentName ? ` (상위: ${c.parentName})` : '';
        return `- ID: ${c.id}, ${c.name}${parent}`;
      }).join('\n')
    : '';

  return `당신은 병원 업무 매뉴얼 작성 전문가입니다.

다음 정보를 바탕으로 구조화된 매뉴얼 초안을 작성해주세요.

**주제:** ${topic}

**수집된 정보:**
- 목적: ${collectedInfo.purpose || '(미정)'}
- 대상: ${collectedInfo.targetAudience || '전 직원'}
- 절차: ${collectedInfo.procedures?.join('\n  ') || '(미정)'}
- 주의사항: ${collectedInfo.warnings?.join('\n  ') || '(없음)'}
- 예시: ${collectedInfo.examples?.join('\n  ') || '(없음)'}
- 연관 매뉴얼: ${collectedInfo.relatedManuals?.join(', ') || '(없음)'}
- 추가 정보: ${collectedInfo.additionalNotes || '(없음)'}

${categoryList ? `**카테고리 목록:**
${categoryList}
` : ''}

**매뉴얼 작성 요구사항:**
1. 명확하고 전문적인 제목
2. 목적 및 적용 범위
3. 대상자 명시
4. 단계별 절차 (번호 매기기)
5. 주의사항 및 참고사항
6. 필요시 예시 포함

**응답 형식 (JSON):**
{
  "title": "매뉴얼 제목",
  "suggestedCategoryId": 카테고리ID숫자 또는 null,
  "suggestedCategoryName": "카테고리명",
  "summary": "2-3문장의 요약",
  "content": "마크다운 형식의 전체 매뉴얼 내용",
  "tags": ["태그1", "태그2"]
}`;
}

// 검색 결과 없음 응답 프롬프트 (매뉴얼 작성 제안 포함)
export function getNoResultsResponsePrompt(question: string): string {
  return `사용자가 "${question}"에 대해 질문했지만, 관련 매뉴얼을 찾을 수 없습니다.

**응답 요구사항:**
1. 해당 내용의 매뉴얼이 없다는 것을 알림
2. 사용자에게 새 매뉴얼 작성을 제안
3. 친근하고 도움이 되는 어조 유지

**응답 형식:**
마크다운으로 응답하되, 마지막에 매뉴얼 작성 제안을 포함하세요.
예: "이 내용에 대한 매뉴얼을 새로 작성해 드릴까요? '네' 또는 '작성해줘'라고 답변해 주시면 대화형으로 매뉴얼 작성을 도와드리겠습니다."`;
}

// 업로드 콘텐츠 분석 프롬프트
export function getUploadAnalysisPrompt(
  content: string,
  filename: string | undefined,
  categories: Category[]
): string {
  const categoryList = categories
    .map(c => {
      const parent = c.parentName ? ` (상위: ${c.parentName})` : '';
      return `- ID: ${c.id}, 이름: ${c.name}${parent}${c.description ? ` - ${c.description}` : ''}`;
    })
    .join('\n');

  return `당신은 병원 업무 매뉴얼 분석 전문가입니다.

다음 업로드된 문서를 분석하여 매뉴얼로 정리해주세요.

${filename ? `**파일명:** ${filename}` : ''}

**문서 내용:**
${content.slice(0, 5000)}
${content.length > 5000 ? '\n...(이하 생략)' : ''}

**기존 카테고리 목록:**
${categoryList || '(카테고리가 없습니다)'}

**분석 및 정리 요구사항:**
1. 적절한 제목 추출 또는 생성
2. 2-3문장의 요약문 작성
3. 내용을 구조화된 마크다운으로 재정리 (제목, 목적, 절차, 주의사항 등)
4. 가장 적합한 카테고리 3개 추천 (기존 카테고리 중에서)
5. 관련 태그 5개 이내 추천
6. 문서 품질 점수 (0-100)
7. 개선이 필요한 부분 제안

**응답 형식 (JSON):**
{
  "title": "추출/생성된 제목",
  "summary": "2-3문장 요약",
  "structuredContent": "마크다운으로 구조화된 전체 내용",
  "categoryRecommendations": [
    {"categoryId": 1, "name": "카테고리명", "score": 95, "reason": "추천 이유"},
    {"categoryId": 2, "name": "카테고리명", "score": 80, "reason": "추천 이유"}
  ],
  "tags": ["태그1", "태그2", "태그3"],
  "qualityScore": 75,
  "suggestions": ["개선 제안 1", "개선 제안 2"]
}

JSON만 응답하세요. 다른 텍스트는 포함하지 마세요.`;
}
