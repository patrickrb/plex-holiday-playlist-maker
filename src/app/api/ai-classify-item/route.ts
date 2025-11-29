import { NextRequest, NextResponse } from 'next/server';
import { HolidayAIClassifier } from '@/lib/ai/classifier';
import { PlexMedia, Holiday } from '@/types';

export const maxDuration = 60; // 1 minute per item

interface AIClassifyRequest {
  item: PlexMedia;
  selectedHolidays: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: AIClassifyRequest = await request.json();
    const { item, selectedHolidays } = body;

    if (!item) {
      return NextResponse.json(
        { error: 'No media item provided' },
        { status: 400 }
      );
    }

    console.log(`🤖 Classifying: ${item.title}`);

    // Initialize AI classifier
    const classifier = new HolidayAIClassifier();

    try {
      // Classify with AI (will check cache first internally)
      const classification = await classifier.classify(item);

      // Filter matches based on confidence and selected holidays
      const matches: Array<{ holiday: Holiday; confidence: number }> = [];

      for (const holidayMatch of classification.holidays) {
        if (
          holidayMatch.confidence >= 70 &&
          selectedHolidays.includes(holidayMatch.holiday)
        ) {
          matches.push({
            holiday: holidayMatch.holiday as Holiday,
            confidence: holidayMatch.confidence,
          });
        }
      }

      console.log(`✅ Classified "${item.title}": ${matches.length} matches`);

      return NextResponse.json({
        success: true,
        item,
        matches,
      });
    } catch (error) {
      console.error(`❌ Failed to classify ${item.title}:`, error);

      // Return empty matches on error instead of failing
      return NextResponse.json({
        success: true,
        item,
        matches: [],
        error: error instanceof Error ? error.message : 'Classification failed',
      });
    }
  } catch (error) {
    console.error('❌ AI classify item failed:', error);
    return NextResponse.json(
      {
        error: 'AI classification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
