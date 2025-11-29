import 'server-only';
import { getDbPool } from './client';
import { Holiday, PlexMedia } from '@/types';

export interface CachedClassification {
  plexKey: string;
  holidays: Array<{
    holiday: Holiday;
    confidence: number;
    reason?: string;
  }>;
}

/**
 * Bulk check for cached AI classifications
 * Returns a map of plex_key -> classification results
 */
export async function getBulkCachedClassifications(
  plexKeys: string[]
): Promise<Map<string, CachedClassification>> {
  if (plexKeys.length === 0) {
    return new Map();
  }

  const pool = getDbPool();
  const results = new Map<string, CachedClassification>();

  try {
    // Query all cached classifications for the provided plex keys
    const query = `
      SELECT
        mi.plex_key,
        ac.response_payload
      FROM ai_response_cache ac
      JOIN media_items mi ON mi.id = ac.media_item_id
      WHERE mi.plex_key = ANY($1)
    `;

    const result = await pool.query(query, [plexKeys]);

    for (const row of result.rows) {
      const plexKey = row.plex_key as string;
      const responsePayload = row.response_payload as { holidays: Array<{ holiday: Holiday; confidence: number; reason?: string }> };

      results.set(plexKey, {
        plexKey,
        holidays: responsePayload.holidays || [],
      });
    }

    console.log(`✅ Found ${results.size} cached classifications out of ${plexKeys.length} items`);
    return results;
  } catch (error) {
    console.error('Error fetching bulk cached classifications:', error);
    return new Map();
  }
}

/**
 * Get cached classification for a single media item
 */
export async function getCachedClassification(
  plexKey: string
): Promise<CachedClassification | null> {
  const results = await getBulkCachedClassifications([plexKey]);
  return results.get(plexKey) || null;
}

/**
 * Filter media items by those that need AI classification
 * Returns two arrays: [itemsWithCache, itemsNeedingClassification]
 */
export async function partitionMediaByCache(
  mediaItems: PlexMedia[]
): Promise<{
  cached: Array<{ media: PlexMedia; classification: CachedClassification }>;
  needsClassification: PlexMedia[];
}> {
  const plexKeys = mediaItems.map((item) => item.key);
  const cachedResults = await getBulkCachedClassifications(plexKeys);

  const cached: Array<{ media: PlexMedia; classification: CachedClassification }> = [];
  const needsClassification: PlexMedia[] = [];

  for (const media of mediaItems) {
    const cachedResult = cachedResults.get(media.key);
    if (cachedResult) {
      cached.push({ media, classification: cachedResult });
    } else {
      needsClassification.push(media);
    }
  }

  console.log(`📊 Cache partition: ${cached.length} cached, ${needsClassification.length} need classification`);

  return { cached, needsClassification };
}
