// 이지동안의원 기본 정보

export const clinicInfo = {
  name: '이지동안의원 강남본점',
  representative: '도재운 원장 (대한필러학회 회장)',
  address: '서울특별시 강남구 압구정로 168, 2층 (신사동, 제림빌딩)',
  phone: '1544-7533',
  location: '3호선 압구정역 5번 출구 바로 앞',
  parking: '발렛 파킹 서비스 운영',
  website: 'https://egsns.com',
  blog: 'https://blog.naver.com/odasam9011',

  hours: {
    weekday: {
      time: '10:00 ~ 19:00',
      lastReservation: '18:30',
    },
    saturday: {
      time: '10:00 ~ 17:00',
      lastReservation: '16:30',
    },
    holiday: '일요일/공휴일 휴진',
  },

  busRoutes: ['143', '147', '148', '240', '345', '463', '472', '3011', '4211', '4312', '4318'],

  signatureTreatments: [
    {
      name: '이지동안주사',
      description: '콜라겐 부스터, 피부 재생 효과 극대화',
    },
    {
      name: '커스텀리프팅',
      description: '개인 맞춤형 플랜으로 차원 다른 리프팅 결과',
    },
    {
      name: '도도코',
      description: '비수술 코 성형',
    },
    {
      name: 'SSRT',
      description: '여드름 흉터, 자국, 모공 개선',
    },
    {
      name: '다크서클치료',
      description: '원인별 맞춤 치료',
    },
  ],

  departments: [
    {
      name: '안티에이징',
      treatments: ['울쎄라', '써마지', '트루스컬프 ID'],
    },
    {
      name: '쁘띠성형',
      treatments: ['보톡스', '필러', '입술', '이마', '코 시술'],
    },
    {
      name: '피부질환',
      treatments: ['기미', '주근깨', '문신제거'],
    },
    {
      name: '여드름/흉터',
      treatments: ['여드름 치료', '흉터 치료', 'SSRT'],
    },
    {
      name: '스킨부스터',
      treatments: ['스킨바이브', '리쥬란', '물광주사'],
    },
    {
      name: '바디센터',
      treatments: ['지방흡입', '레이저제모', '위고비'],
    },
    {
      name: '성형센터',
      treatments: ['눈성형', '코성형', '가슴성형'],
    },
  ],

  keyFeatures: [
    '대표원장 1:1 책임 진료',
    '대한필러학회 회장 직접 시술',
    'Galderma, Sinclair, MERZ 선정 Key Doctor',
    '안전하고 정직한 진료',
    '철저한 소독·위생 관리',
  ],
};

// AI 제안 생성을 위한 프롬프트
export function getClinicContextPrompt(): string {
  return `당신은 이지동안의원의 AI 어시스턴트입니다.

[병원 정보]
- 병원명: ${clinicInfo.name}
- 대표원장: ${clinicInfo.representative}
- 주소: ${clinicInfo.address}
- 전화: ${clinicInfo.phone}
- 위치: ${clinicInfo.location}

[진료시간]
- 평일: ${clinicInfo.hours.weekday.time} (예약 마감: ${clinicInfo.hours.weekday.lastReservation})
- 토요일: ${clinicInfo.hours.saturday.time} (예약 마감: ${clinicInfo.hours.saturday.lastReservation})
- ${clinicInfo.hours.holiday}

[시그니처 시술]
${clinicInfo.signatureTreatments.map(t => `- ${t.name}: ${t.description}`).join('\n')}

[진료 분야]
${clinicInfo.departments.map(d => `- ${d.name}: ${d.treatments.join(', ')}`).join('\n')}

[특징]
${clinicInfo.keyFeatures.map(f => `- ${f}`).join('\n')}

위 정보를 바탕으로 친절하고 전문적으로 답변해주세요.`;
}

// 검색 실패 시 AI 제안 생성
export function getNoResultSuggestionPrompt(query: string): string {
  return `${getClinicContextPrompt()}

사용자가 "${query}"에 대해 검색했지만 관련 매뉴얼을 찾지 못했습니다.

다음을 수행해주세요:
1. 검색어와 관련된 병원 정보가 있다면 안내
2. 관련될 수 있는 시술이나 서비스 제안
3. 더 나은 검색어 제안
4. 필요시 전화 문의(${clinicInfo.phone}) 안내

JSON 형식으로 응답:
{
  "suggestion": "사용자에게 보여줄 제안 메시지 (마크다운)",
  "relatedServices": ["관련 서비스1", "관련 서비스2"],
  "alternativeQueries": ["대안 검색어1", "대안 검색어2"],
  "contactRecommended": true/false
}`;
}
