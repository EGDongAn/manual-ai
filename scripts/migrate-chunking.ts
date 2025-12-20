#!/usr/bin/env tsx
/**
 * RAG Phase 2 청킹 마이그레이션 스크립트
 *
 * manual_chunks 테이블에 필요한 필드를 추가합니다.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🚀 Starting Chunking migration...');

    // 마이그레이션 파일 읽기
    const migrationPath = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      'add_chunking_fields.sql'
    );

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Running migration SQL...');

    // SQL 실행 (각 문장을 개별 실행)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log('  ✓ Executed statement');
      } catch (err) {
        // 이미 존재하는 컬럼/인덱스는 무시
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('already exists') || message.includes('does not exist')) {
          console.log(`  ⚠ Skipped: ${message.substring(0, 80)}...`);
        } else {
          console.warn(`  ⚠ Warning: ${message.substring(0, 100)}`);
        }
      }
    }

    console.log('✅ Chunking migration completed!');

    // manual_chunks 테이블 컬럼 확인
    const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'manual_chunks'
      ORDER BY ordinal_position;
    `;

    console.log('\n📊 manual_chunks columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// 실행
runMigration();
