#!/usr/bin/env tsx
/**
 * RAG Phase 3 마이그레이션 스크립트
 *
 * search_metrics와 search_cache 테이블을 생성합니다.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🚀 Starting RAG Phase 3 migration...');

    // 마이그레이션 파일 읽기
    const migrationPath = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      'add_rag_phase3_tables.sql'
    );

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Running migration SQL...');

    // SQL 실행 (각 문장을 개별 실행)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (err) {
        // 이미 존재하는 테이블/인덱스는 무시
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('already exists')) {
          console.warn(`Warning: ${message}`);
        }
      }
    }

    console.log('✅ Migration completed successfully!');

    // 테이블 확인
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('search_metrics', 'search_cache')
      ORDER BY table_name;
    `;

    console.log('\n📊 Created tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    // 인덱스 확인
    const indexes = await prisma.$queryRaw<Array<{ tablename: string; indexname: string }>>`
      SELECT
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('search_metrics', 'search_cache')
      ORDER BY tablename, indexname;
    `;

    console.log('\n🔍 Created indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.tablename}.${idx.indexname}`);
    });

    console.log('\n🎉 RAG Phase 3 setup complete!');
    console.log('\nNext steps:');
    console.log('1. Import and use the RAG pipeline:');
    console.log('   import { executeRAGPipeline } from "@/lib/ai/rag-pipeline"');
    console.log('2. Test with a search query');
    console.log('3. Check metrics: import { getMetricsSummary } from "@/lib/ai/metrics"');

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
