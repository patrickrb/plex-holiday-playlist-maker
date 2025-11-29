import { NextRequest, NextResponse } from 'next/server';
import { HolidayAIClassifier } from '@/lib/ai/classifier';
import { PlexMedia, Holiday } from '@/types';

export const maxDuration = 300; // 5 minutes max execution time

interface AIScanRequest {
  media: PlexMedia[];
  selectedHolidays: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: AIScanRequest = await request.json();
    const { media, selectedHolidays } = body;

    if (!media || !Array.isArray(media) || media.length === 0) {
      return NextResponse.json(
        { error: 'No media items provided' },
        { status: 400 }
      );
    }

    console.log(`🤖 Starting AI scan for ${media.length} media items`);
    console.log(`🎯 Selected holidays: ${selectedHolidays.join(', ')}`);

    // Initialize AI classifier
    const classifier = new HolidayAIClassifier();

    // Track results by holiday
    const resultsByHoliday = new Map<Holiday, PlexMedia[]>();
    selectedHolidays.forEach((holiday) => {
      resultsByHoliday.set(holiday as Holiday, []);
    });

    let processed = 0;
    const total = media.length;
    let rateLimitHits = 0;

    // Process each media item
    for (const item of media) {
      processed++;

      try {
        // Classify with AI (will check cache first internally)
        const classification = await classifier.classify(item);

        // Add to appropriate holiday lists based on confidence
        for (const holidayMatch of classification.holidays) {
          if (
            holidayMatch.confidence >= 70 &&
            selectedHolidays.includes(holidayMatch.holiday)
          ) {
            const items = resultsByHoliday.get(holidayMatch.holiday as Holiday) || [];
            items.push(item);
            resultsByHoliday.set(holidayMatch.holiday as Holiday, items);
          }
        }

        // Log progress
        if (processed % 10 === 0 || processed === total) {
          console.log(`📊 Progress: ${processed}/${total} (${Math.round((processed / total) * 100)}%)`);
        }
      } catch (error) {
        // Track rate limit errors
        const isRateLimitError = error && typeof error === 'object' && 'status' in error && error.status === 429;
        if (isRateLimitError) {
          rateLimitHits++;
          console.error(`⚠️ Rate limit hit for ${item.title} (total hits: ${rateLimitHits})`);
        } else {
          console.error(`❌ Failed to classify ${item.title}:`, error);
        }
        // Continue with next item
      }
    }

    // Convert map to results format
    const results: Array<{
      holiday: Holiday;
      items: PlexMedia[];
    }> = [];

    for (const [holiday, items] of resultsByHoliday.entries()) {
      if (items.length > 0) {
        results.push({ holiday, items });
        console.log(`✅ ${holiday}: ${items.length} items classified`);
      }
    }

    console.log(`🎉 AI scan complete! Processed ${processed}/${total} items`);
    if (rateLimitHits > 0) {
      console.log(`⚠️ Rate limit hits: ${rateLimitHits} (these items may have been skipped or retried)`);
    }

    return NextResponse.json({
      success: true,
      processed,
      total,
      rateLimitHits,
      results,
    });
  } catch (error) {
    console.error('❌ AI scan failed:', error);
    return NextResponse.json(
      {
        error: 'AI scan failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
