#!/usr/bin/env tsx
/**
 * 모든 매뉴얼 재인덱싱 스크립트
 *
 * 기존 매뉴얼에 대해 임베딩과 청크를 생성합니다.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 동적 임포트 사용 (ESM 모듈)
async function main() {
  try {
    console.log('🚀 Starting manual reindexing...');

    // 모듈 동적 로드
    const { createManualEmbeddingPgvector, reindexAllManualsPgvector } = await import('../lib/ai/embeddings');
    const { indexManualChunks } = await import('../lib/ai/chunk-indexer');

    // 모든 매뉴얼 조회
    const manuals = await prisma.manuals.findMany({
      select: {
        id: true,
        title: true,
        content: true,
        summary: true,
      },
    });

    console.log(`📚 Found ${manuals.length} manuals to index`);

    let successCount = 0;
    let errorCount = 0;

    for (const manual of manuals) {
      console.log(`\n📄 Processing: ${manual.title} (ID: ${manual.id})`);

      try {
        // 임베딩 생성
        console.log('  → Creating embedding...');
        await createManualEmbeddingPgvector(
          manual.id,
          manual.title,
          manual.content,
          manual.summary
        );

        // 청크 인덱싱
        console.log('  → Indexing chunks...');
        const chunkResult = await indexManualChunks(
          manual.id,
          manual.title,
          manual.content
        );
        console.log(`  ✅ Created ${chunkResult.chunksCreated} chunks (skipped: ${chunkResult.chunksSkipped})`);

        successCount++;
      } catch (error) {
        console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
        errorCount++;
      }

      // API 레이트 리밋 방지
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log('\n📊 Summary:');
    console.log(`  - Total manuals: ${manuals.length}`);
    console.log(`  - Successfully indexed: ${successCount}`);
    console.log(`  - Errors: ${errorCount}`);

    // 최종 통계 확인
    const embCount = await prisma.manual_embeddings.count();
    const chunkCount = await prisma.manual_chunks.count();
    console.log(`\n📈 Database stats:`);
    console.log(`  - Embeddings: ${embCount}`);
    console.log(`  - Chunks: ${chunkCount}`);

    console.log('\n🎉 Reindexing complete!');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
