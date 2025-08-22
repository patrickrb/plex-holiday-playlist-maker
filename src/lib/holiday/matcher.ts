import { Holiday, PlexEpisode, PlexMovie, PlexMedia, HolidayMatch, isPlexEpisode } from '@/types';
import { CURATED_KEYWORDS, EXCLUDE_PATTERNS } from './config';

export class HolidayMatcher {
  private includePatterns: Map<Holiday, RegExp[]> = new Map();
  private excludePatterns: RegExp[] = [];

  constructor(additionalTitles: Map<Holiday, string[]> = new Map()) {
    this.compilePatterns(additionalTitles);
  }

  private compilePatterns(additionalTitles: Map<Holiday, string[]>) {
    // Compile exclude patterns
    this.excludePatterns = EXCLUDE_PATTERNS.map(
      pattern => new RegExp(pattern, 'i')
    );

    // Compile include patterns for each holiday
    for (const [holiday, keywords] of Object.entries(CURATED_KEYWORDS)) {
      const allPatterns = [...keywords];
      
      // Add additional scraped titles if available
      const scrapedTitles = additionalTitles.get(holiday as Holiday) || [];
      for (const title of scrapedTitles) {
        const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
        allPatterns.push(`\\b${escaped}\\b`);
      }

      const compiled = allPatterns.map(pattern => new RegExp(pattern, 'i'));
      this.includePatterns.set(holiday as Holiday, compiled);
    }
  }

  getMatchScore(media: PlexMedia, holiday: Holiday): number {
    const title = media.title || '';
    const summary = media.summary || '';
    
    // Check exclude patterns first - if any match, confidence is 0
    for (const pattern of this.excludePatterns) {
      if (pattern.test(title) || pattern.test(summary)) {
        return 0;
      }
    }

    // Prevent cross-holiday matching by checking for other holiday keywords
    const otherHolidays = (Object.keys(CURATED_KEYWORDS) as Holiday[]).filter(h => h !== holiday);
    for (const otherHoliday of otherHolidays) {
      const strongIndicators = this.getStrongIndicators(otherHoliday);
      for (const indicator of strongIndicators) {
        if (new RegExp(indicator, 'i').test(title)) {
          // If title contains strong indicators of another holiday, exclude it
          return 0;
        }
      }
    }

    let score = 0;
    const patterns = this.includePatterns.get(holiday) || [];
    
    // Higher weight for title matches
    for (const pattern of patterns) {
      if (pattern.test(title)) {
        score += 10; // Title matches are worth more
      } else if (pattern.test(summary)) {
        score += 3; // Summary matches are worth less
      }
    }

    // Strong indicators get bonus points
    const strongIndicators = this.getStrongIndicators(holiday);
    for (const indicator of strongIndicators) {
      if (new RegExp(indicator, 'i').test(title)) {
        score += 15; // Strong title matches get big bonus
      } else if (new RegExp(indicator, 'i').test(summary)) {
        score += 5; // Strong summary matches get smaller bonus
      }
    }

    return score;
  }

  private getStrongIndicators(holiday: Holiday): string[] {
    const strongPatterns: Record<Holiday, string[]> = {
      Halloween: ['\\bHallowe?en\\b', 'Treehouse of Horror', 'October 31', 'All Hallows'],
      Thanksgiving: ['\\bThanksgiving\\b', '\\bFriendsgiving\\b', 'Turkey Day'],
      Christmas: ['\\bChristmas\\b', '\\bX[- ]?mas\\b', 'December 25', 'Santa', 'Ho Ho Ho'],
      "Valentine's": ["\\bValentine'?s?\\b", 'February 14', 'Cupid']
    };
    return strongPatterns[holiday] || [];
  }

  isMatch(media: PlexMedia, holiday: Holiday): boolean {
    const score = this.getMatchScore(media, holiday);
    
    // Require a minimum confidence score
    const threshold = 8; // Adjust this to be more/less strict
    
    return score >= threshold;
  }

  findMatches(media: PlexMedia[]): HolidayMatch[] {
    return this.findMatchesWithThreshold(media, 8);
  }

  findMatchesWithThreshold(media: PlexMedia[], threshold: number, selectedHolidays?: Set<Holiday>): HolidayMatch[] {
    const results: HolidayMatch[] = [];
    
    // Use selected holidays if provided, otherwise use all holidays
    const holidaysToCheck = selectedHolidays 
      ? Array.from(selectedHolidays)
      : Object.keys(CURATED_KEYWORDS) as Holiday[];
    
    console.log(`🔍 HolidayMatcher: Analyzing ${media.length} media items for ${holidaysToCheck.length} holidays: ${holidaysToCheck.join(', ')}`);
    
    for (const holiday of holidaysToCheck) {
      const matchedEpisodes: PlexEpisode[] = [];
      const matchedMovies: PlexMovie[] = [];
      
      for (const item of media) {
        const score = this.getMatchScore(item, holiday);
        if (score >= threshold) {
          const title = isPlexEpisode(item) 
            ? `${item.grandparentTitle} - ${item.title}`
            : item.title;
          console.log(`✅ ${holiday} match (score: ${score}): ${title}`);
          
          if (isPlexEpisode(item)) {
            matchedEpisodes.push(item);
          } else {
            matchedMovies.push(item);
          }
        } else if (score > 0) {
          const title = isPlexEpisode(item) 
            ? `${item.grandparentTitle} - ${item.title}`
            : item.title;
          console.log(`⚠️ ${holiday} weak match (score: ${score}): ${title}`);
        }
      }
      
      if (matchedEpisodes.length > 0 || matchedMovies.length > 0) {
        results.push({
          holiday,
          episodes: matchedEpisodes,
          movies: matchedMovies
        });
      }
    }

    return results;
  }

  getMatchSummary(media: PlexMedia[]): Record<Holiday, number> {
    const summary: Record<Holiday, number> = {
      Halloween: 0,
      Thanksgiving: 0,
      Christmas: 0,
      "Valentine's": 0
    };

    for (const holiday of Object.keys(CURATED_KEYWORDS) as Holiday[]) {
      summary[holiday] = media.filter(item => this.isMatch(item, holiday)).length;
    }

    return summary;
  }
}