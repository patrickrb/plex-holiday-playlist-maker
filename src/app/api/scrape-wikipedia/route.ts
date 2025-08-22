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

    // Normalize titles (remove suffixes like "(TV special)", years, etc.)
    const normalized = new Set<string>();
    for (const title of titles) {
      const normalized_title = title
        .replace(/\s*\((?:TV|television)[^)]*\)/g, '')
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
    return NextResponse.json({});
  }

  try {
    const results: { [key: string]: string[] } = {};
    const timestamp = Date.now();

    for (const [holiday, urls] of Object.entries(WIKI_SOURCES)) {
      const cacheKey = `wiki_titles::${holiday}`;
      
      // Check cache
      if (cache[cacheKey] && typeof cache._timestamp === 'number' && (timestamp - cache._timestamp < CACHE_DURATION)) {
        results[holiday] = cache[cacheKey] as string[];
        continue;
      }

      const allTitles = new Set<string>();
      
      for (const url of urls) {
        const titles = await scrapeTitlesFromUrl(url);
        for (const title of titles) {
          allTitles.add(title);
        }
        
        // Be gentle with Wikipedia
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const titleArray = Array.from(allTitles).sort();
      cache[cacheKey] = titleArray;
      results[holiday] = titleArray;
    }

    // Update cache timestamp
    cache._timestamp = timestamp;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Wikipedia scraping failed:', error);
    return NextResponse.json(
      { error: 'Failed to scrape Wikipedia titles' },
      { status: 500 }
    );
  }
}