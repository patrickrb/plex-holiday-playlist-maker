import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { parse } from 'node-html-parser';
import { WIKI_SOURCES } from '@/lib/holiday/config';

const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const cache: { [key: string]: string[] | number } = {};

async function scrapeTitlesFromUrl(url: string): Promise<Set<string>> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'plex-holiday-playlister/1.0'
      },
      timeout: 20000
    });

    const root = parse(response.data);
    const titles = new Set<string>();

    // Method 1: Link titles (common on category pages)
    const links = root.querySelectorAll('#mw-content-text a[title]');
    for (const link of links) {
      const title = link.getAttribute('title')?.trim();
      if (title && !title.includes(':')) { // Filter namespaces/files
        titles.add(title);
      }
    }

    // Method 2: Quoted titles in text (common on list pages)
    const contentText = root.querySelector('#mw-content-text');
    if (contentText) {
      const text = contentText.text;
      const quotedMatches = text.matchAll(/[""]([^""]+)[""]|"([^"]+)"/g);
      
      for (const match of quotedMatches) {
        const quoted = (match[1] || match[2])?.trim();
        if (quoted && quoted.length >= 2 && quoted.length <= 120) {
          titles.add(quoted);
        }
      }
    }

    // Normalize titles (remove suffixes like "(TV special)", "(film)", years, etc.)
    const normalized = new Set<string>();
    for (const title of titles) {
      const normalized_title = title
        .replace(/\s*\((?:TV|television|film|movie)[^)]*\)/g, '')
        .replace(/\s*\(\d{4}\)$/g, '')
        .trim();
      
      if (normalized_title) {
        normalized.add(normalized_title);
      }
    }

    return normalized;
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    return new Set();
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skipScrape = searchParams.get('skip') === 'true';

  if (skipScrape) {
    console.log('⏭️ Wikipedia scraping skipped by request');
    return NextResponse.json({});
  }

  try {
    const results: { [key: string]: string[] } = {};
    const metadata: { [key: string]: { timestamp: number; totalUrlsAttempted: number; totalUrlsSucceeded: number; totalTitlesFound: number; successRate: number; cacheUsed: boolean; errorOccurred?: boolean } } = {};
    const timestamp = Date.now();
    let totalUrlsAttempted = 0;
    let totalUrlsSucceeded = 0;
    let totalTitlesFound = 0;

    console.log('🌐 Starting Wikipedia scraping for all holidays...');

    for (const [holiday, urls] of Object.entries(WIKI_SOURCES)) {
      const cacheKey = `wiki_titles::${holiday}`;
      
      // Check cache
      if (cache[cacheKey] && typeof cache._timestamp === 'number' && (timestamp - cache._timestamp < CACHE_DURATION)) {
        const cachedTitles = cache[cacheKey] as string[];
        results[holiday] = cachedTitles;
        console.log(`📄 Using cached data for ${holiday}: ${cachedTitles.length} titles`);
        continue;
      }

      const allTitles = new Set<string>();
      let holidayUrlsAttempted = 0;
      let holidayUrlsSucceeded = 0;
      
      console.log(`🎭 Scraping ${holiday} from ${urls.length} Wikipedia URLs...`);
      
      for (const url of urls) {
        holidayUrlsAttempted++;
        totalUrlsAttempted++;
        
        const titles = await scrapeTitlesFromUrl(url);
        if (titles.size > 0) {
          holidayUrlsSucceeded++;
          totalUrlsSucceeded++;
          console.log(`  ✅ ${url}: ${titles.size} titles found`);
        } else {
          console.log(`  ❌ ${url}: 0 titles found (likely failed)`);
        }
        
        for (const title of titles) {
          allTitles.add(title);
        }
        
        // Be gentle with Wikipedia
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const titleArray = Array.from(allTitles).sort();
      cache[cacheKey] = titleArray;
      results[holiday] = titleArray;
      totalTitlesFound += titleArray.length;
      
      console.log(`🎭 ${holiday} scraping complete: ${titleArray.length} unique titles from ${holidayUrlsSucceeded}/${holidayUrlsAttempted} URLs`);
      
      // Show sample titles for debugging
      if (titleArray.length > 0) {
        const movieTitles = titleArray.filter(title => 
          urls.some(url => url.includes('film') || url.includes('movie')) && 
          !title.includes('Episode') && !title.includes('Special')
        );
        const tvTitles = titleArray.filter(title => 
          title.includes('Episode') || title.includes('Special') || urls.some(url => url.includes('television'))
        );
        
        console.log(`    📺 TV content: ${tvTitles.length} titles`);
        console.log(`    🎬 Movie content: ${movieTitles.length} titles`);
        
        if (movieTitles.length > 0) {
          console.log(`    🎬 Sample movies: ${movieTitles.slice(0, 3).join(', ')}${movieTitles.length > 3 ? '...' : ''}`);
        }
      }
    }

    // Update cache timestamp
    cache._timestamp = timestamp;

    // Prepare response with metadata
    const successRate = totalUrlsAttempted > 0 ? Math.round((totalUrlsSucceeded / totalUrlsAttempted) * 100) : 0;
    
    console.log(`🌐 Wikipedia scraping complete! ${totalUrlsSucceeded}/${totalUrlsAttempted} URLs succeeded (${successRate}%), ${totalTitlesFound} total titles found`);
    
    metadata._scraping_stats = {
      timestamp,
      totalUrlsAttempted,
      totalUrlsSucceeded,
      totalTitlesFound,
      successRate,
      cacheUsed: false
    };

    return NextResponse.json({ ...results, _metadata: metadata });
  } catch (error) {
    console.error('❌ Wikipedia scraping failed completely:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape Wikipedia titles', 
        details: error instanceof Error ? error.message : 'Unknown error',
        _metadata: { 
          timestamp: Date.now(), 
          totalUrlsAttempted: 0, 
          totalUrlsSucceeded: 0, 
          totalTitlesFound: 0,
          successRate: 0,
          errorOccurred: true 
        }
      },
      { status: 500 }
    );
  }
}