import { Holiday } from '@/types';
import { SCRAPE_CACHE_TTL } from '../holiday/config';

interface CacheData {
  [key: string]: string[] | number;
  _timestamp: number;
}

export class WikipediaScraper {
  private cache: CacheData | null = null;

  constructor() {
    this.loadCache();
  }

  private loadCache() {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('wiki-holiday-titles');
        if (cached) {
          const data = JSON.parse(cached) as CacheData;
          if (Date.now() - data._timestamp < SCRAPE_CACHE_TTL) {
            this.cache = data;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache:', error);
    }
  }

  private saveCache(data: CacheData) {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('wiki-holiday-titles', JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  async scrapeTitles(skipScrape = false, selectedHolidays?: Set<Holiday>): Promise<Map<Holiday, string[]>> {
    if (skipScrape) {
      return new Map();
    }

    // Check cache first
    if (this.cache) {
      const results = new Map<Holiday, string[]>();
      for (const [key, value] of Object.entries(this.cache)) {
        if (key.startsWith('wiki_titles::') && Array.isArray(value)) {
          const holiday = key.replace('wiki_titles::', '') as Holiday;
          // Only include if not filtering by selected holidays, or if this holiday is selected
          if (!selectedHolidays || selectedHolidays.has(holiday)) {
            results.set(holiday, value);
          }
        }
      }
      if (results.size > 0) {
        return results;
      }
    }

    try {
      // Call our API route for scraping
      const response = await fetch('/api/scrape-wikipedia', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Wikipedia titles from API');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Convert to Map and cache
      const results = new Map<Holiday, string[]>();
      const cacheData: CacheData = { _timestamp: Date.now() };

      for (const [holiday, titles] of Object.entries(data)) {
        if (Array.isArray(titles)) {
          // Always cache all holidays, but only return selected ones
          cacheData[`wiki_titles::${holiday}`] = titles;
          
          // Only include if not filtering by selected holidays, or if this holiday is selected
          if (!selectedHolidays || selectedHolidays.has(holiday as Holiday)) {
            results.set(holiday as Holiday, titles);
          }
        }
      }

      // Save to cache
      this.saveCache(cacheData);
      this.cache = cacheData;

      return results;
    } catch (error) {
      console.error('Failed to scrape Wikipedia titles:', error);
      return new Map();
    }
  }

  clearCache() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wiki-holiday-titles');
      }
      this.cache = null;
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}

// Utility function for client-side scraping
export async function scrapeWikipediaTitles(skipScrape = false): Promise<Map<Holiday, string[]>> {
  const scraper = new WikipediaScraper();
  return scraper.scrapeTitles(skipScrape);
}