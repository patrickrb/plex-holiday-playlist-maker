import { useState, useCallback } from 'react';
import { HolidayMatcher } from '@/lib/holiday/matcher';
import { WikipediaScraper } from '@/lib/scraper/wikipedia';
import { Holiday, PlexEpisode, HolidayMatch, PlaylistPreview } from '@/types';
import { PLAYLIST_PREFIX } from '@/lib/holiday/config';

export function useHolidayPlaylists() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScrapingWiki, setIsScrapingWiki] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapedTitles, setScrapedTitles] = useState<Map<Holiday, string[]>>(new Map());

  const scrapeWikipediaTitles = useCallback(async (skipScrape = false) => {
    if (skipScrape) {
      console.log('⏭️ Skipping Wikipedia scraping');
      setScrapedTitles(new Map());
      return new Map<Holiday, string[]>();
    }

    setIsScrapingWiki(true);
    setError(null);

    try {
      console.log('🌐 Starting Wikipedia scraping...');
      const scraper = new WikipediaScraper();
      const titles = await scraper.scrapeTitles();
      
      console.log('📝 Wikipedia scraping complete! Results:');
      titles.forEach((titleList, holiday) => {
        console.log(`  ${holiday}: ${titleList.length} titles scraped`);
        if (titleList.length > 0) {
          console.log(`    Sample titles: ${titleList.slice(0, 3).join(', ')}${titleList.length > 3 ? '...' : ''}`);
        }
      });
      
      setScrapedTitles(titles);
      return titles;
    } catch (err) {
      console.error('❌ Wikipedia scraping failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to scrape Wikipedia titles';
      setError(errorMessage);
      return new Map<Holiday, string[]>();
    } finally {
      setIsScrapingWiki(false);
    }
  }, []);

  const analyzeEpisodes = useCallback(async (
    episodes: PlexEpisode[],
    useWikipedia = true,
    confidenceThreshold = 8
  ): Promise<HolidayMatch[]> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      console.log(`🔍 useHolidayPlaylists: Starting analysis of ${episodes.length} episodes`);
      console.log(`🌐 Wikipedia scraping: ${useWikipedia ? 'Enabled' : 'Disabled'}`);
      
      // Get Wikipedia titles if requested
      const wikiTitles = useWikipedia ? await scrapeWikipediaTitles() : new Map();
      
      if (useWikipedia && wikiTitles.size > 0) {
        console.log('📝 Wikipedia titles found:');
        wikiTitles.forEach((titles, holiday) => {
          console.log(`  ${holiday}: ${titles.length} titles`);
        });
      }
      
      // Create matcher with scraped titles
      console.log('🎯 Creating HolidayMatcher with scraped titles');
      const matcher = new HolidayMatcher(wikiTitles);
      
      // Find matches with confidence threshold
      console.log(`🔍 Starting pattern matching on episodes (threshold: ${confidenceThreshold})...`);
      const matches = matcher.findMatchesWithThreshold(episodes, confidenceThreshold);
      
      console.log('✅ Pattern matching complete! Results:');
      matches.forEach(match => {
        console.log(`🎭 ${match.holiday}: ${match.episodes.length} episodes matched`);
        if (match.episodes.length > 0) {
          console.log('  Episodes found:');
          match.episodes.forEach(ep => {
            console.log(`    📺 ${ep.grandparentTitle} - S${ep.seasonNumber}E${ep.index}: ${ep.title}`);
          });
        }
      });
      
      return matches;
    } catch (err) {
      console.error('❌ useHolidayPlaylists: Analysis failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze episodes';
      setError(errorMessage);
      return [];
    } finally {
      setIsAnalyzing(false);
    }
  }, [scrapeWikipediaTitles]);

  const generatePlaylistPreviews = useCallback(async (
    episodes: PlexEpisode[],
    existingPlaylists: Map<string, PlexEpisode[]>,
    useWikipedia = true,
    selectedHolidays?: Set<Holiday>,
    confidenceThreshold = 8
  ): Promise<PlaylistPreview[]> => {
    const matches = await analyzeEpisodes(episodes, useWikipedia, confidenceThreshold);
    
    // Filter matches to only include selected holidays
    const filteredMatches = selectedHolidays 
      ? matches.filter(match => selectedHolidays.has(match.holiday))
      : matches;
    
    return filteredMatches.map(match => {
      const playlistName = `${PLAYLIST_PREFIX}${match.holiday}`;
      const existingEpisodes = existingPlaylists.get(playlistName) || [];
      const existingGuids = new Set(existingEpisodes.map(ep => ep.guid));
      const newEpisodes = match.episodes.filter(ep => !existingGuids.has(ep.guid));

      return {
        holiday: match.holiday,
        name: playlistName,
        episodes: match.episodes,
        existingCount: existingEpisodes.length,
        newCount: newEpisodes.length,
      };
    });
  }, [analyzeEpisodes]);

  const getMatchSummary = useCallback((episodes: PlexEpisode[]): Record<Holiday, number> => {
    const matcher = new HolidayMatcher(scrapedTitles);
    return matcher.getMatchSummary(episodes);
  }, [scrapedTitles]);

  const clearWikiCache = useCallback(() => {
    try {
      const scraper = new WikipediaScraper();
      scraper.clearCache();
      setScrapedTitles(new Map());
    } catch (err) {
      console.warn('Failed to clear Wikipedia cache:', err);
    }
  }, []);

  return {
    isAnalyzing,
    isScrapingWiki,
    error,
    scrapedTitles,
    scrapeWikipediaTitles,
    analyzeEpisodes,
    generatePlaylistPreviews,
    getMatchSummary,
    clearWikiCache,
  };
}