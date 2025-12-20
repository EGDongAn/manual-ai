/**
 * pgvector 마이그레이션 스크립트
 *
 * 기존 Bytes 형식 임베딩을 pgvector 네이티브 형식으로 변환
 *
 * 실행 방법:
 * npx tsx scripts/migrate-to-pgvector.ts
 */

import { prisma } from '@/lib/prisma';
import { bytesToFloat32Array } from '@/lib/ai/embeddings';
import { toPgVector, createVectorIndexes, getVectorStats } from '@/lib/ai/pgvector-search';

interface MigrationOptions {
  batchSize?: number;
  enableIndexes?: boolean;
  dryRun?: boolean;
}

/**
 * 단일 임베딩을 pgvector 형식으로 변환
 */
async function migrateEmbedding(id: number, embeddingBytes: Buffer): Promise<boolean> {
  try {
    // Bytes를 Float32Array로 변환
    const float32Array = bytesToFloat32Array(embeddingBytes);

    // Float32Array를 pgvector 형식으로 변환
    const pgVectorString = toPgVector(new Float32Array(float32Array));

    // Raw SQL로 업데이트
    await prisma.$executeRaw`
      UPDATE manual_embeddings
      SET embedding_vector = ${pgVectorString}::vector
      WHERE id = ${id}
    `;

    return true;
  } catch (error) {
    console.error(`❌ 임베딩 ID ${id} 마이그레이션 실패:`, error);
    return false;
  }
}

/**
 * 배치 단위로 임베딩 마이그레이션 실행
 */
async function migrateBatch(
  offset: number,
  batchSize: number,
  dryRun: boolean
): Promise<{
  processed: number;
  success: number;
  failed: number;
}> {
  // 마이그레이션이 필요한 임베딩 조회 (embedding_vector가 NULL인 것)
  const embeddings = await prisma.$queryRaw<
    Array<{ id: number; embedding: Buffer }>
  >`
    SELECT id, embedding
    FROM manual_embeddings
    WHERE embedding_vector IS NULL
    LIMIT ${batchSize}
    OFFSET ${offset}
  `;

  let success = 0;
  let failed = 0;

  for (const embedding of embeddings) {
    if (dryRun) {
      console.log(`[DRY RUN] 임베딩 ID ${embedding.id} 마이그레이션 예정`);
      success++;
    } else {
      const result = await migrateEmbedding(embedding.id, embedding.embedding);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
  }

  return {
    processed: embeddings.length,
    success,
    failed,
  };
}

/**
 * 전체 마이그레이션 실행
 */
export async function runMigration(options: MigrationOptions = {}) {
  const {
    batchSize = 100,
    enableIndexes = true,
    dryRun = false,
  } = options;

  console.log('🚀 pgvector 마이그레이션 시작');
  console.log(`   배치 크기: ${batchSize}`);
  console.log(`   인덱스 생성: ${enableIndexes ? '예' : '아니오'}`);
  console.log(`   Dry Run: ${dryRun ? '예' : '아니오'}\n`);

  try {
    // 1. pgvector 확장 활성화 확인
    console.log('1️⃣  pgvector 확장 확인 중...');
    try {
      await prisma.$queryRaw`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log('   ✅ pgvector 확장 활성화됨\n');
    } catch (error) {
      console.error('   ❌ pgvector 확장 활성화 실패. Supabase에서 pgvector가 지원되는지 확인하세요.');
      throw error;
    }

    // 2. 마이그레이션 대상 확인
    console.log('2️⃣  마이그레이션 대상 확인 중...');
    const [totalCount] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM manual_embeddings
      WHERE embedding_vector IS NULL
    `;
    const total = Number(totalCount.count);
    console.log(`   총 ${total}개의 임베딩을 마이그레이션해야 합니다.\n`);

    if (total === 0) {
      console.log('✅ 마이그레이션이 필요한 임베딩이 없습니다.');
      return;
    }

    // 3. 배치 단위로 마이그레이션 실행
    console.log('3️⃣  임베딩 마이그레이션 중...');
    let offset = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    while (offset < total) {
      const result = await migrateBatch(offset, batchSize, dryRun);

      totalSuccess += result.success;
      totalFailed += result.failed;
      offset += result.processed;

      const progress = Math.min(100, Math.round((offset / total) * 100));
      console.log(`   진행률: ${progress}% (${offset}/${total}) - 성공: ${totalSuccess}, 실패: ${totalFailed}`);

      if (result.processed === 0) {
        break; // 더 이상 처리할 데이터가 없음
      }
    }

    console.log(`\n   ✅ 마이그레이션 완료: 성공 ${totalSuccess}, 실패 ${totalFailed}\n`);

    // 4. 벡터 인덱스 생성
    if (enableIndexes && !dryRun) {
      console.log('4️⃣  벡터 인덱스 생성 중...');
      await createVectorIndexes();
      console.log('   ✅ 벡터 인덱스 생성 완료\n');
    }

    // 5. 마이그레이션 결과 확인
    console.log('5️⃣  마이그레이션 결과 확인 중...');
    const stats = await getVectorStats();
    console.log(`   총 임베딩: ${stats.totalEmbeddings}`);
    console.log(`   pgvector 형식: ${stats.embeddingsWithVector}`);
    console.log(`   총 청크: ${stats.totalChunks}\n`);

    console.log('✅ 마이그레이션이 성공적으로 완료되었습니다!');
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noIndexes = args.includes('--no-indexes');
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

  runMigration({
    batchSize,
    enableIndexes: !noIndexes,
    dryRun,
  }).catch(error => {
    console.error('마이그레이션 실패:', error);
    process.exit(1);
  });
}
