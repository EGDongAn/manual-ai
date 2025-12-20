import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

const CACHE_TTL_SECONDS = 3600; // 1시간

/**
 * 쿼리 문자열을 SHA256 해시로 변환
 *
 * @param query - 검색 쿼리
 * @returns SHA256 해시 문자열
 */
function hashQuery(query: string): string {
  return createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
}

/**
 * 캐시된 검색 결과 조회
 *
 * @param query - 검색 쿼리
 * @returns 캐시된 결과 또는 null
 */
export async function getCachedResult<T>(query: string): Promise<T | null> {
  try {
    const queryHash = hashQuery(query);
    const now = new Date();

    const rows = await prisma.$queryRaw<Array<{
      result: object;
      expires_at: Date;
    }>>`
      SELECT result, expires_at
      FROM search_cache
      WHERE query_hash = ${queryHash}
        AND expires_at > ${now}
    `;

    if (rows.length === 0) {
      return null;
    }

    const cached = rows[0];

    // 만료 확인 (이중 체크)
    if (new Date(cached.expires_at) <= now) {
      // 만료된 캐시 삭제
      await prisma.$executeRaw`
        DELETE FROM search_cache
        WHERE query_hash = ${queryHash}
      `;
      return null;
    }

    // 히트 카운트 증가 및 마지막 사용 시간 업데이트
    await prisma.$executeRaw`
      UPDATE search_cache
      SET
        hit_count = hit_count + 1,
        last_accessed_at = ${now}
      WHERE query_hash = ${queryHash}
    `;

    return cached.result as T;
  } catch (error) {
    console.error('Failed to get cached result:', error);
    return null;
  }
}

/**
 * 검색 결과를 캐시에 저장
 *
 * @param query - 검색 쿼리
 * @param result - 캐시할 결과 객체
 * @param ttlSeconds - TTL (초 단위, 기본값: 3600초 = 1시간)
 */
export async function setCachedResult<T>(
  query: string,
  result: T,
  ttlSeconds: number = CACHE_TTL_SECONDS
): Promise<void> {
  try {
    const queryHash = hashQuery(query);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const resultJson = JSON.stringify(result);

    // UPSERT: 기존 캐시가 있으면 업데이트, 없으면 삽입
    await prisma.$executeRaw`
      INSERT INTO search_cache (
        query_hash,
        query,
        result,
        created_at,
        expires_at,
        last_accessed_at,
        hit_count
      ) VALUES (
        ${queryHash},
        ${query},
        ${resultJson}::jsonb,
        ${now},
        ${expiresAt},
        ${now},
        0
      )
      ON CONFLICT (query_hash)
      DO UPDATE SET
        result = ${resultJson}::jsonb,
        expires_at = ${expiresAt},
        last_accessed_at = ${now}
    `;
  } catch (error) {
    console.error('Failed to set cached result:', error);
    // 캐시 저장 실패는 메인 플로우를 방해하지 않음
  }
}

/**
 * 캐시 무효화
 *
 * 특정 매뉴얼 ID와 관련된 캐시를 삭제하거나 전체 캐시를 삭제합니다.
 *
 * @param manualId - 매뉴얼 ID (선택적, 없으면 전체 캐시 삭제)
 */
export async function invalidateCache(manualId?: number): Promise<void> {
  try {
    // 현재는 전체 삭제 (향후 개선 가능: 매뉴얼 ID를 캐시 키에 포함)
    await prisma.$executeRaw`DELETE FROM search_cache`;
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
  }
}

/**
 * 만료된 캐시 정리
 *
 * TTL이 지난 캐시 항목을 삭제합니다.
 *
 * @returns 삭제된 캐시 항목 수
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const now = new Date();

    const result = await prisma.$executeRaw`
      DELETE FROM search_cache
      WHERE expires_at <= ${now}
    `;

    return Number(result) || 0;
  } catch (error) {
    console.error('Failed to cleanup expired cache:', error);
    return 0;
  }
}

/**
 * 캐시 통계 조회
 *
 * @returns 캐시 사용 통계
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalHits: number;
  avgHitCount: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  cacheSize: number;
}> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      total_entries: bigint;
      total_hits: bigint;
      avg_hit_count: number;
      oldest_entry: Date | null;
      newest_entry: Date | null;
      cache_size: bigint;
    }>>`
      SELECT
        COUNT(*) as total_entries,
        COALESCE(SUM(hit_count), 0) as total_hits,
        COALESCE(AVG(hit_count), 0) as avg_hit_count,
        MIN(created_at) as oldest_entry,
        MAX(created_at) as newest_entry,
        COALESCE(SUM(LENGTH(result::text)), 0) as cache_size
      FROM search_cache
    `;

    const stats = rows[0];

    return {
      totalEntries: Number(stats.total_entries) || 0,
      totalHits: Number(stats.total_hits) || 0,
      avgHitCount: Number(stats.avg_hit_count) || 0,
      oldestEntry: stats.oldest_entry,
      newestEntry: stats.newest_entry,
      cacheSize: Number(stats.cache_size) || 0
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      totalEntries: 0,
      totalHits: 0,
      avgHitCount: 0,
      oldestEntry: null,
      newestEntry: null,
      cacheSize: 0
    };
  }
}

/**
 * 인기 검색어 조회 (캐시 기반)
 *
 * @param limit - 조회할 검색어 수 (기본값: 10)
 * @returns 인기 검색어 배열
 */
export async function getPopularQueries(limit: number = 10): Promise<Array<{
  query: string;
  hitCount: number;
  lastAccessed: Date;
}>> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      query: string;
      hit_count: number;
      last_accessed_at: Date;
    }>>`
      SELECT query, hit_count, last_accessed_at
      FROM search_cache
      ORDER BY hit_count DESC
      LIMIT ${limit}
    `;

    return rows.map(row => ({
      query: row.query,
      hitCount: Number(row.hit_count),
      lastAccessed: new Date(row.last_accessed_at)
    }));
  } catch (error) {
    console.error('Failed to get popular queries:', error);
    return [];
  }
}
