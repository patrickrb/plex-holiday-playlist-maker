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
      console.log('⏭️ WikipediaScraper: Skipping scrape by request');
      return new Map();
    }

    // Check cache first
    if (this.cache) {
      const results = new Map<Holiday, string[]>();
      let cacheHitCount = 0;
      
      for (const [key, value] of Object.entries(this.cache)) {
        if (key.startsWith('wiki_titles::') && Array.isArray(value)) {
          const holiday = key.replace('wiki_titles::', '') as Holiday;
          // Only include if not filtering by selected holidays, or if this holiday is selected
          if (!selectedHolidays || selectedHolidays.has(holiday)) {
            results.set(holiday, value);
            cacheHitCount++;
          }
        }
      }
      
      if (results.size > 0) {
        console.log(`📄 WikipediaScraper: Using cached data for ${cacheHitCount} holidays`);
        results.forEach((titles, holiday) => {
          console.log(`  📄 ${holiday}: ${titles.length} cached titles`);
        });
        return results;
      }
    }

    try {
      console.log('🌐 WikipediaScraper: Fetching fresh data from API...');
      
      // Call our API route for scraping
      const response = await fetch('/api/scrape-wikipedia', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        console.error('❌ WikipediaScraper: API returned error:', data.error);
        console.error('❌ Details:', data.details);
        
        // Check if this looks like a network connectivity issue
        if (data.details && (data.details.includes('ENOTFOUND') || data.details.includes('getaddrinfo'))) {
          console.warn('🚫 Network connectivity issue detected - Wikipedia may be blocked in this environment');
          console.warn('💡 Users should disable Wikipedia scraping or ensure network access to en.wikipedia.org');
        }
        
        throw new Error(`${data.error}: ${data.details || 'Unknown error'}`);
      }

      // Log scraping metadata if available
      if (data._metadata) {
        const meta = data._metadata;
        console.log(`🌐 Wikipedia scraping results: ${meta.totalUrlsSucceeded || 0}/${meta.totalUrlsAttempted || 0} URLs succeeded (${meta.successRate || 0}%), ${meta.totalTitlesFound || 0} total titles`);
        
        if (meta.successRate === 0) {
          console.warn('⚠️ Wikipedia scraping failed completely - likely due to network restrictions');
          console.warn('💡 Recommendation: Users should disable Wikipedia scraping for better performance');
        }
      }

      // Convert to Map and cache
      const results = new Map<Holiday, string[]>();
      const cacheData: CacheData = { _timestamp: Date.now() };
      let totalTitlesReceived = 0;

      for (const [holiday, titles] of Object.entries(data)) {
        if (holiday === '_metadata') continue; // Skip metadata
        
        if (Array.isArray(titles)) {
          // Always cache all holidays, but only return selected ones
          cacheData[`wiki_titles::${holiday}`] = titles;
          totalTitlesReceived += titles.length;
          
          // Only include if not filtering by selected holidays, or if this holiday is selected
          if (!selectedHolidays || selectedHolidays.has(holiday as Holiday)) {
            results.set(holiday as Holiday, titles);
            console.log(`📝 ${holiday}: ${titles.length} Wikipedia titles loaded`);
            
            // Show sample titles for debugging
            if (titles.length > 0) {
              const sampleTitles = titles.slice(0, 3).join(', ');
              console.log(`    Sample: ${sampleTitles}${titles.length > 3 ? '...' : ''}`);
            }
          }
        }
      }

      // Save to cache
      this.saveCache(cacheData);
      this.cache = cacheData;

      console.log(`✅ WikipediaScraper: ${totalTitlesReceived} total titles received and cached`);
      return results;
    } catch (error) {
      console.error('❌ WikipediaScraper: Failed to scrape Wikipedia titles:', error);
      console.warn('💡 Falling back to curated keyword matching only');
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