import { useState, useCallback } from 'react';
import { HolidayMatcher } from '@/lib/holiday/matcher';
import { WikipediaScraper } from '@/lib/scraper/wikipedia';
import { Holiday, PlexMedia, HolidayMatch, PlaylistPreview } from '@/types';
import { PLAYLIST_PREFIX } from '@/lib/holiday/config';

export function useHolidayPlaylists() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScrapingWiki, setIsScrapingWiki] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapedTitles, setScrapedTitles] = useState<Map<Holiday, string[]>>(new Map());

  const scrapeWikipediaTitles = useCallback(async (skipScrape = false, selectedHolidays?: Set<Holiday>) => {
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
      const titles = await scraper.scrapeTitles(false, selectedHolidays);
      
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

  const analyzeMedia = useCallback(async (
    media: PlexMedia[],
    useWikipedia = true,
    confidenceThreshold = 8,
    selectedHolidays?: Set<Holiday>
  ): Promise<HolidayMatch[]> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      console.log(`🔍 useHolidayPlaylists: Starting analysis of ${media.length} media items`);
      console.log(`🌐 Wikipedia scraping: ${useWikipedia ? 'Enabled' : 'Disabled'}`);
      console.log(`🎯 Selected holidays: ${selectedHolidays ? Array.from(selectedHolidays).join(', ') : 'All holidays'}`);
      
      // Get Wikipedia titles if requested
      const wikiTitles = useWikipedia ? await scrapeWikipediaTitles(false, selectedHolidays) : new Map();
      
      if (useWikipedia) {
        if (wikiTitles.size > 0) {
          console.log('📝 Wikipedia titles successfully loaded:');
          wikiTitles.forEach((titles, holiday) => {
            console.log(`  ${holiday}: ${titles.length} titles`);
            
            // Show breakdown of content types for better debugging
            const movieIndicators = titles.filter((title: string) => 
              // Look for movie-specific patterns or check if it came from movie-specific URLs
              !title.includes('Episode') && !title.includes('Special') && !title.includes('Series')
            );
            const tvIndicators = titles.filter((title: string) => 
              title.includes('Episode') || title.includes('Special') || title.includes('Series')
            );
            
            if (movieIndicators.length > 0) {
              console.log(`    🎬 Movie content: ${movieIndicators.length} titles`);
              console.log(`    🎬 Sample movies: ${movieIndicators.slice(0, 3).join(', ')}${movieIndicators.length > 3 ? '...' : ''}`);
            }
            if (tvIndicators.length > 0) {
              console.log(`    📺 TV content: ${tvIndicators.length} titles`);
            }
          });
        } else {
          console.warn('⚠️ Wikipedia scraping enabled but no titles were loaded');
          console.warn('💡 This is likely due to network restrictions blocking en.wikipedia.org');
          console.warn('💡 The system will fall back to curated keyword matching only');
        }
      } else {
        console.log('⏭️ Wikipedia scraping disabled - using curated keywords only');
      }
      
      // Create matcher with scraped titles
      console.log('🎯 Creating HolidayMatcher with scraped titles');
      const matcher = new HolidayMatcher(wikiTitles);
      
      // Find matches with confidence threshold
      console.log(`🔍 Starting pattern matching on media (threshold: ${confidenceThreshold})...`);
      const matches = matcher.findMatchesWithThreshold(media, confidenceThreshold, selectedHolidays);
      
      console.log('✅ Pattern matching complete! Results:');
      matches.forEach(match => {
        const totalItems = match.episodes.length + match.movies.length;
        console.log(`🎭 ${match.holiday}: ${totalItems} items matched (${match.episodes.length} episodes, ${match.movies.length} movies)`);
        if (match.episodes.length > 0) {
          console.log('  Episodes found:');
          match.episodes.forEach(ep => {
            console.log(`    📺 ${ep.grandparentTitle} - S${ep.seasonNumber}E${ep.index}: ${ep.title}`);
          });
        }
        if (match.movies.length > 0) {
          console.log('  Movies found:');
          match.movies.forEach(movie => {
            console.log(`    🎬 ${movie.title} (${movie.year || 'N/A'})`);
          });
        }
      });
      
      return matches;
    } catch (err) {
      console.error('❌ useHolidayPlaylists: Analysis failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze media';
      setError(errorMessage);
      return [];
    } finally {
      setIsAnalyzing(false);
    }
  }, [scrapeWikipediaTitles]);

  const generatePlaylistPreviews = useCallback(async (
    media: PlexMedia[],
    existingPlaylists: Map<string, PlexMedia[]>,
    useWikipedia = true,
    selectedHolidays?: Set<Holiday>,
    confidenceThreshold = 8
  ): Promise<PlaylistPreview[]> => {
    const matches = await analyzeMedia(media, useWikipedia, confidenceThreshold, selectedHolidays);
    
    const previews: PlaylistPreview[] = [];
    
    // Create separate playlists for TV shows and movies
    for (const match of matches) {
      // Create TV playlist if there are episodes
      if (match.episodes.length > 0) {
        const tvPlaylistName = `${PLAYLIST_PREFIX}${match.holiday} TV`;
        const existingTvMedia = existingPlaylists.get(tvPlaylistName) || [];
        const existingTvGuids = new Set(existingTvMedia.map(item => item.guid));
        const newTvMedia = match.episodes.filter(ep => !existingTvGuids.has(ep.guid));

        previews.push({
          holiday: match.holiday,
          name: tvPlaylistName,
          episodes: match.episodes,
          movies: [], // TV playlist only contains episodes
          existingCount: existingTvMedia.length,
          newCount: newTvMedia.length,
        });
      }

      // Create Movie playlist if there are movies
      if (match.movies.length > 0) {
        const moviePlaylistName = `${PLAYLIST_PREFIX}${match.holiday} Movies`;
        const existingMovieMedia = existingPlaylists.get(moviePlaylistName) || [];
        const existingMovieGuids = new Set(existingMovieMedia.map(item => item.guid));
        const newMovieMedia = match.movies.filter(movie => !existingMovieGuids.has(movie.guid));

        previews.push({
          holiday: match.holiday,
          name: moviePlaylistName,
          episodes: [], // Movie playlist only contains movies
          movies: match.movies,
          existingCount: existingMovieMedia.length,
          newCount: newMovieMedia.length,
        });
      }
    }
    
    return previews;
  }, [analyzeMedia]);

  const getMatchSummary = useCallback((media: PlexMedia[]): Record<Holiday, number> => {
    const matcher = new HolidayMatcher(scrapedTitles);
    return matcher.getMatchSummary(media);
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
    analyzeMedia,
    generatePlaylistPreviews,
    getMatchSummary,
    clearWikiCache,
  };
}