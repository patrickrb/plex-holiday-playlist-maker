import 'server-only';
import { Holiday, PlexEpisode, PlexMovie, PlexMedia, HolidayMatch, isPlexEpisode } from '@/types';
import { HolidayMatcher } from './matcher';
import { HolidayAIClassifier } from '../ai/classifier';

/**
 * Server-side only matcher that includes AI classification capabilities
 */
export class HolidayMatcherWithAI extends HolidayMatcher {
  private aiClassifier: HolidayAIClassifier;

  constructor(additionalTitles: Map<Holiday, string[]> = new Map()) {
    super(additionalTitles);
    this.aiClassifier = new HolidayAIClassifier();
    console.log('🤖 AI classification enabled (server-side)');
  }

  /**
   * Find matches using curated patterns, Wikipedia data, and AI classification
   */
  async findMatchesWithAI(
    media: PlexMedia[],
    selectedHolidays?: Set<Holiday>
  ): Promise<HolidayMatch[]> {
    // Use selected holidays if provided, otherwise use all holidays
    const holidaysToCheck = selectedHolidays
      ? Array.from(selectedHolidays)
      : (['Halloween', 'Thanksgiving', 'Christmas', "Valentine's"] as Holiday[]);

    console.log(`🔍 HolidayMatcherWithAI: Analyzing ${media.length} media items for ${holidaysToCheck.length} holidays`);

    // Track items that need AI classification
    const itemsNeedingAI: PlexMedia[] = [];
    const matchesByHoliday = new Map<Holiday, { episodes: PlexEpisode[], movies: PlexMovie[] }>();

    // Initialize maps for each holiday
    for (const holiday of holidaysToCheck) {
      matchesByHoliday.set(holiday, { episodes: [], movies: [] });
    }

    // First pass: check with curated patterns
    for (const item of media) {
      let foundMatch = false;

      for (const holiday of holidaysToCheck) {
        if (this.isMatch(item, holiday)) {
          const title = isPlexEpisode(item)
            ? `${item.grandparentTitle} - ${item.title}`
            : item.title;

          console.log(`✅ ${holiday} match (pattern-based): ${title}`);

          const matches = matchesByHoliday.get(holiday)!;
          if (isPlexEpisode(item)) {
            matches.episodes.push(item);
          } else {
            matches.movies.push(item);
          }
          foundMatch = true;
        }
      }

      // If no match found, queue for AI classification
      if (!foundMatch) {
        itemsNeedingAI.push(item);
      }
    }

    // Second pass: use AI for items without matches
    if (itemsNeedingAI.length > 0) {
      console.log(`🤖 Sending ${itemsNeedingAI.length} items to AI for classification...`);

      for (const item of itemsNeedingAI) {
        try {
          const aiResult = await this.aiClassifier.classify(item);

          for (const classification of aiResult.holidays) {
            // Only use AI results with high confidence (>= 70)
            if (classification.confidence >= 70 && holidaysToCheck.includes(classification.holiday)) {
              const title = isPlexEpisode(item)
                ? `${item.grandparentTitle} - ${item.title}`
                : item.title;

              console.log(`🤖 ${classification.holiday} AI match (${classification.confidence}%): ${title} - ${classification.reason}`);

              const matches = matchesByHoliday.get(classification.holiday)!;
              if (isPlexEpisode(item)) {
                matches.episodes.push(item);
              } else {
                matches.movies.push(item);
              }
            }
          }
        } catch (error) {
          console.error(`Failed to classify ${item.title} with AI:`, error);
        }
      }
    }

    // Convert map to results array
    const results: HolidayMatch[] = [];
    for (const [holiday, matches] of matchesByHoliday.entries()) {
      if (matches.episodes.length > 0 || matches.movies.length > 0) {
        results.push({
          holiday,
          episodes: matches.episodes,
          movies: matches.movies
        });
      }
    }

    return results;
  }
}
