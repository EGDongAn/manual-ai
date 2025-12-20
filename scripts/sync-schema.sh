#!/bin/bash
# sync-schema.sh - DB에서 스키마를 가져와 multiSchema 설정 적용
# 사용법: ./scripts/sync-schema.sh

set -e

echo "🔄 Prisma 스키마 동기화 시작..."

# 1. DB에서 스키마 가져오기
echo "📥 DB에서 스키마 pull..."
npx prisma db pull

# 2. multiSchema 설정이 있는지 확인하고 없으면 추가
SCHEMA_FILE="prisma/schema.prisma"

# previewFeatures 확인
if ! grep -q 'previewFeatures.*multiSchema' "$SCHEMA_FILE"; then
  echo "⚙️ multiSchema 프리뷰 기능 추가..."
  sed -i 's/provider = "prisma-client-js"/provider        = "prisma-client-js"\n  previewFeatures = ["multiSchema"]/' "$SCHEMA_FILE"
fi

# schemas 배열 확인 (이 프로젝트에서 사용하는 스키마)
if ! grep -q 'schemas.*=' "$SCHEMA_FILE"; then
  echo "⚙️ schemas 배열 추가..."
  # 이 프로젝트에서 사용하는 스키마 목록
  SCHEMAS='["common", "manual", "business", "influencer", "inventory"]'
  sed -i "s|url.*=.*env(\"DATABASE_URL\")|url      = env(\"DATABASE_URL\")\n  schemas  = $SCHEMAS|" "$SCHEMA_FILE"
fi

# 3. Prisma Client 재생성
echo "🔨 Prisma Client 생성..."
npx prisma generate

# 4. 타입 체크
echo "✅ TypeScript 타입 체크..."
npx tsc --noEmit || echo "⚠️ 타입 오류 있음 - 확인 필요"

echo ""
echo "✨ 스키마 동기화 완료!"
echo ""
echo "다음 단계:"
echo "  1. prisma/schema.prisma 확인"
echo "  2. 필요시 @@schema() 데코레이터 추가"
echo "  3. npm run build 테스트"
