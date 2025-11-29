import { NextRequest, NextResponse } from 'next/server';
import { HolidayAIClassifier } from '@/lib/ai/classifier';
import { getBulkCachedClassifications } from '@/lib/db/classification-cache';
import { PlexMedia, Holiday } from '@/types';

export const maxDuration = 300; // 5 minutes max execution time

interface BulkClassifyRequest {
  media: PlexMedia[];
  selectedHolidays: string[];
  useAI?: boolean; // Whether to classify items not in cache
}

interface BulkClassifyResponse {
  success: boolean;
  cached: number;
  classified: number;
  total: number;
  results: Map<string, Array<{ holiday: Holiday; confidence: number }>>;
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkClassifyRequest = await request.json();
    const { media, selectedHolidays, useAI = false } = body;

    if (!media || !Array.isArray(media) || media.length === 0) {
      return NextResponse.json(
        { error: 'No media items provided' },
        { status: 400 }
      );
    }

    console.log(`🔍 Bulk classify: ${media.length} items, AI mode: ${useAI}`);

    // Step 1: Check database for all items
    const plexKeys = media.map((item) => item.key);
    const cachedResults = await getBulkCachedClassifications(plexKeys);

    // Build results map from cache
    const resultsMap = new Map<string, Array<{ holiday: Holiday; confidence: number }>>();
    const itemsNeedingClassification: PlexMedia[] = [];

    for (const item of media) {
      const cached = cachedResults.get(item.key);
      if (cached) {
        // Filter by selected holidays and confidence threshold
        const filteredHolidays = cached.holidays.filter(
          (h) => h.confidence >= 70 && selectedHolidays.includes(h.holiday)
        );

        if (filteredHolidays.length > 0) {
          resultsMap.set(item.key, filteredHolidays);
        }
      } else {
        itemsNeedingClassification.push(item);
      }
    }

    console.log(`📊 Cache stats: ${cachedResults.size} cached, ${itemsNeedingClassification.length} need classification`);

    // Debug: Show sample of matched vs unmatched keys
    if (media.length > 0) {
      console.log(`🔍 Sample Plex keys from current scan: ${media.slice(0, 3).map(m => m.key).join(', ')}`);
      if (cachedResults.size > 0) {
        const cachedKeys = Array.from(cachedResults.keys());
        console.log(`🔍 Sample cached DB keys: ${cachedKeys.slice(0, 3).join(', ')}`);
        const matchCount = media.filter(m => cachedResults.has(m.key)).length;
        console.log(`🔍 Key match rate: ${matchCount}/${media.length} (${((matchCount / media.length) * 100).toFixed(1)}%)`);
      }
    }

    let classifiedCount = 0;

    // Step 2: Classify remaining items if AI mode is enabled
    if (useAI && itemsNeedingClassification.length > 0) {
      console.log(`🤖 Classifying ${itemsNeedingClassification.length} items with AI...`);

      const classifier = new HolidayAIClassifier();

      for (const item of itemsNeedingClassification) {
        try {
          const classification = await classifier.classify(item);

          // Filter by confidence and selected holidays
          const filteredHolidays = classification.holidays.filter(
            (h) => h.confidence >= 70 && selectedHolidays.includes(h.holiday)
          );

          if (filteredHolidays.length > 0) {
            resultsMap.set(item.key, filteredHolidays);
          }

          classifiedCount++;

          // Log progress periodically
          if (classifiedCount % 10 === 0 || classifiedCount === itemsNeedingClassification.length) {
            console.log(`📊 AI Progress: ${classifiedCount}/${itemsNeedingClassification.length}`);
          }

          // Small delay to avoid rate limiting
          if (classifiedCount < itemsNeedingClassification.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Failed to classify ${item.title}:`, error);
          // Continue with next item
        }
      }
    }

    console.log(`✅ Bulk classify complete: ${cachedResults.size} from cache, ${classifiedCount} newly classified`);

    // Convert Map to object for JSON serialization
    const resultsObject: Record<string, Array<{ holiday: Holiday; confidence: number }>> = {};
    for (const [key, value] of resultsMap.entries()) {
      resultsObject[key] = value;
    }

    return NextResponse.json({
      success: true,
      cached: cachedResults.size,
      classified: classifiedCount,
      total: media.length,
      results: resultsObject,
    });
  } catch (error) {
    console.error('❌ Bulk classify failed:', error);
    return NextResponse.json(
      {
        error: 'Bulk classification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
