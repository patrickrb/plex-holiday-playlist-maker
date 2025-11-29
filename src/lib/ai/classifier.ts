import 'server-only';
import OpenAI from "openai";
import { PlexMedia, Holiday, isPlexEpisode } from '@/types';
import { getDbPool } from '../db/client';

export interface HolidayClassification {
  holiday: Holiday;
  confidence: number;
  reason?: string;
}

export interface AIClassificationResult {
  holidays: HolidayClassification[];
}

export class HolidayAIClassifier {
  private client: OpenAI;
  private model: string = "gpt-4o";
  private apiVersion: string = "2025-01-01-preview";

  // Map AI's lowercase holiday names to TypeScript Holiday type format
  private holidayNameMap: Record<string, Holiday> = {
    'christmas': 'Christmas',
    'thanksgiving': 'Thanksgiving',
    'halloween': 'Halloween',
    'new_years': 'New Years',
    'hanukkah': 'Hanukkah',
    'kwanzaa': 'Kwanzaa',
    'easter': 'Easter',
    'valentine': "Valentine's Day",
    'independence_day': 'Independence Day',
    'st_patricks': "St. Patrick's Day",
    'april_fools': 'April Fools',
    'mothers_day': "Mother's Day",
    'fathers_day': "Father's Day",
    'labor_day': 'Labor Day',
    'memorial_day': 'Memorial Day',
    'veterans_day': 'Veterans Day',
    'mardi_gras': 'Mardi Gras',
    'dia_de_los_muertos': 'Dia de los Muertos',
    'chinese_new_year': 'Chinese New Year',
    'diwali': 'Diwali',
    'ramadan': 'Ramadan',
    'generic_winter_holiday': 'Winter Holiday',
    'generic_holiday': 'Generic Holiday'
  };

  constructor() {
    if (!process.env.AZURE_OPENAI_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
      throw new Error("Azure OpenAI credentials not configured");
    }

    this.client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_KEY,
      baseURL: process.env.AZURE_OPENAI_ENDPOINT,
      defaultQuery: { "api-version": this.apiVersion },
      defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY }
    });
  }

  /**
   * Check if we have a cached classification result for this media item
   */
  private async getCachedResult(plexKey: string): Promise<AIClassificationResult | null> {
    const pool = getDbPool();

    try {
      const result = await pool.query(
        `SELECT ac.response_payload
         FROM ai_response_cache ac
         JOIN media_items mi ON mi.id = ac.media_item_id
         WHERE mi.plex_key = $1`,
        [plexKey]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Using cached AI classification for ${plexKey}`);
        return result.rows[0].response_payload as AIClassificationResult;
      }

      return null;
    } catch (error) {
      console.error('Error checking cache:', error);
      return null;
    }
  }

  /**
   * Store the media item in the database and return its ID
   */
  private async storeMediaItem(media: PlexMedia): Promise<number> {
    const pool = getDbPool();
    const isEpisode = isPlexEpisode(media);

    const result = await pool.query(
      `INSERT INTO media_items (
        plex_key, media_type, title, year, season, episode,
        grandparent_title, summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (plex_key) DO NOTHING
      RETURNING id`,
      [
        media.key,
        isEpisode ? 'episode' : 'movie',
        media.title,
        media.year || null,
        isEpisode ? media.seasonNumber : null,
        isEpisode ? media.index : null,
        isEpisode ? media.grandparentTitle : null,
        media.summary || null
      ]
    );

    // If conflict, get existing ID
    if (result.rows.length === 0) {
      const existing = await pool.query(
        'SELECT id FROM media_items WHERE plex_key = $1',
        [media.key]
      );
      return existing.rows[0].id;
    }

    return result.rows[0].id;
  }

  /**
   * Store classification results in the database
   */
  private async storeClassifications(
    mediaItemId: number,
    classifications: HolidayClassification[]
  ): Promise<void> {
    const pool = getDbPool();

    for (const classification of classifications) {
      await pool.query(
        `INSERT INTO ai_classifications (
          media_item_id, holiday, confidence, reason
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (media_item_id, holiday) DO NOTHING`,
        [
          mediaItemId,
          classification.holiday,
          classification.confidence,
          classification.reason || null
        ]
      );
    }
  }

  /**
   * Store the AI response in cache
   */
  private async cacheResponse(
    mediaItemId: number,
    requestPayload: Record<string, unknown>,
    responsePayload: AIClassificationResult
  ): Promise<void> {
    const pool = getDbPool();

    await pool.query(
      `INSERT INTO ai_response_cache (
        media_item_id, request_payload, response_payload, model
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (media_item_id) DO NOTHING`,
      [
        mediaItemId,
        JSON.stringify(requestPayload),
        JSON.stringify(responsePayload),
        this.model
      ]
    );
  }

  /**
   * Classify a single media item using Azure OpenAI
   */
  async classify(media: PlexMedia): Promise<AIClassificationResult> {
    // Check cache first
    const cached = await this.getCachedResult(media.key);
    if (cached) {
      return cached;
    }

    const isEpisode = isPlexEpisode(media);

    const requestPayload = isEpisode ? {
      title: media.title,
      show: media.grandparentTitle,
      season: media.seasonNumber,
      episode: media.index,
      description: media.summary || ""
    } : {
      title: media.title,
      year: media.year,
      description: media.summary || ""
    };

    console.log(`🤖 Classifying with AI: ${isEpisode ? `${media.grandparentTitle} - ${media.title}` : media.title}`);
    console.log('📤 AI Request Details:', {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      model: this.model,
      apiVersion: this.apiVersion,
      payload: requestPayload
    });

    // Retry logic for rate limiting
    let retries = 0;
    const maxRetries = 5; // Increased retries
    const baseDelay = 2; // Base delay in seconds

    while (retries <= maxRetries) {
      try {
        const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a holiday classification model for movies and TV episodes.

Your task:
Given metadata about a piece of media (such as title, episode number, season number, description, and synopsis), identify any holidays that are explicitly or implicitly referenced. You must analyze the text carefully for themes, events, characters, symbols, settings, or phrases associated with real-world holidays.

Your output:
Return ONLY a JSON object with a single key: "holidays".
The value must be a JSON array of objects, where each object has:
- "holiday": string (lowercase holiday name)
- "confidence": number (1-100, how confident you are)
- "reason": string (brief explanation of why)

Example:
{
  "holidays": [
    {
      "holiday": "christmas",
      "confidence": 95,
      "reason": "Santa Claus, presents, and Christmas tree mentioned"
    },
    {
      "holiday": "thanksgiving",
      "confidence": 80,
      "reason": "Family gathering and turkey dinner scene"
    }
  ]
}

Rules:
1. Do NOT include explanations, reasoning, or any text outside the JSON object.
2. Output must always be valid JSON.
3. If no holiday is present, return an empty array: {"holidays": []}
4. Holidays must be REAL and commonly recognized.
5. Classify even indirect or thematic references (e.g., "a mysterious man in a red suit delivering presents" → christmas).
6. Multiple holidays may apply simultaneously.
7. Confidence should be 70+ for strong matches, 50-70 for moderate, below 50 for weak (don't include weak matches).
8. Only include holidays with confidence >= 70.

Recognized Holidays:
- christmas
- thanksgiving
- halloween
- new_years
- hanukkah
- kwanzaa
- easter
- valentine
- independence_day
- st_patricks
- april_fools
- mothers_day
- fathers_day
- labor_day
- memorial_day
- veterans_day
- mardi_gras
- dia_de_los_muertos
- chinese_new_year
- diwali
- ramadan
- generic_winter_holiday (snowy specials without explicit holiday naming)
- generic_holiday (if holiday theme is present but unspecified)

Important:
• Do NOT invent unknown holidays.
• Do NOT guess; only classify when the description contains meaningful signals.
• If the content is a "holiday special," even without the holiday named, classify based on context.
• Always provide confidence and reason for each holiday match.
`
          },
          {
            role: "user",
            content: JSON.stringify(requestPayload)
          }
        ],
        response_format: { type: "json_object" }
      });

      console.log('📥 AI Response:', {
        id: response.id,
        model: response.model,
        usage: response.usage,
        finishReason: response.choices[0].finish_reason
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from AI");
      }

      console.log('📥 AI Response Content:', content);

      const rawResult = JSON.parse(content) as { holidays?: Array<{ holiday: string; confidence: number; reason: string }> };

      // Map AI's lowercase holiday names to correct TypeScript Holiday type
      // Only include holidays that are in our recognized map
      const mappedHolidays = (rawResult.holidays || [])
        .filter((h) => {
          const isRecognized = h.holiday in this.holidayNameMap;
          if (!isRecognized) {
            console.warn(`⚠️ AI returned unrecognized holiday: "${h.holiday}" - skipping`);
          }
          return isRecognized;
        })
        .map((h) => ({
          holiday: this.holidayNameMap[h.holiday],
          confidence: h.confidence,
          reason: h.reason
        }))

      const result: AIClassificationResult = {
        holidays: mappedHolidays as HolidayClassification[]
      };

      console.log('📥 Mapped holidays:', result.holidays);

      // Store in database
      const mediaItemId = await this.storeMediaItem(media);
      await this.storeClassifications(mediaItemId, result.holidays);
      await this.cacheResponse(mediaItemId, requestPayload, result);

        console.log(`✅ AI Classification complete: Found ${result.holidays.length} holiday matches`);
        result.holidays.forEach(h => {
          console.log(`   - ${h.holiday}: ${h.confidence}% (${h.reason})`);
        });

        return result;
      } catch (error) {
        // Check if it's a content filter error (400 with code 'content_filter')
        const isContentFilterError = error && typeof error === 'object' &&
          'status' in error && (error as { status: number }).status === 400 &&
          'code' in error && (error as { code: string }).code === 'content_filter';

        if (isContentFilterError) {
          console.warn(`⚠️ Content filtered by Azure OpenAI policy: ${isEpisode ? `${media.grandparentTitle} - ${media.title}` : media.title}`);
          console.warn(`⚠️ Skipping this item due to content filtering. This is usually triggered by violent, horror, or adult content in the description.`);

          // Return empty result for filtered content
          const emptyResult: AIClassificationResult = { holidays: [] };

          // Still store the media item and empty result in DB to avoid retrying
          const mediaItemId = await this.storeMediaItem(media);
          await this.cacheResponse(mediaItemId, requestPayload, emptyResult);

          return emptyResult;
        }

        // Check if it's a rate limit error (429)
        const isRateLimitError = error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 429;
        if (isRateLimitError && retries < maxRetries) {
          retries++;

          // Try to get retry-after from headers, with fallback to exponential backoff
          let retryDelay = baseDelay * Math.pow(2, retries - 1);

          try {
            const errorWithHeaders = error as { headers?: { get?: (key: string) => string | undefined; [key: string]: unknown }; response?: { headers?: Record<string, unknown> } };
            const retryAfterHeader = errorWithHeaders?.headers?.get?.('retry-after') ||
                                    (typeof errorWithHeaders?.headers === 'object' && errorWithHeaders.headers ? errorWithHeaders.headers['retry-after'] : undefined) ||
                                    (errorWithHeaders?.response?.headers ? errorWithHeaders.response.headers['retry-after'] : undefined);

            if (typeof retryAfterHeader === 'string') {
              retryDelay = parseInt(retryAfterHeader, 10);
            }
          } catch {
            console.warn('Could not parse retry-after header, using exponential backoff');
          }

          console.warn(`⚠️ Rate limit hit (429), retrying after ${retryDelay}s (attempt ${retries}/${maxRetries})`);
          const errorWithHeaders = error as { headers?: { get?: (key: string) => string | undefined } };
          console.warn(`Rate limit info:`, {
            remainingRequests: errorWithHeaders?.headers?.get?.('x-ratelimit-remaining-requests') || 'unknown',
            limitRequests: errorWithHeaders?.headers?.get?.('x-ratelimit-limit-requests') || 'unknown',
            resetTokens: errorWithHeaders?.headers?.get?.('x-ratelimit-reset-tokens') || 'unknown'
          });

          // Wait for retry delay
          await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
          continue;
        }

        console.error('❌ Error classifying with AI:', error);
        if (error instanceof Error) {
          const errorWithStatus = error as Error & { status?: number };
          console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            status: errorWithStatus.status
          });
        }
        throw error;
      }
    }

    throw new Error('Failed to classify after retries');
  }

  /**
   * Classify multiple media items in batch
   */
  async classifyBatch(mediaItems: PlexMedia[]): Promise<Map<string, AIClassificationResult>> {
    const results = new Map<string, AIClassificationResult>();
    const delayBetweenRequests = 1000; // 1 second delay between requests

    for (const media of mediaItems) {
      try {
        const result = await this.classify(media);
        results.set(media.key, result);

        // Add delay to avoid rate limiting (skip for last item)
        if (mediaItems.indexOf(media) < mediaItems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
      } catch (error) {
        console.error(`Failed to classify ${media.title}:`, error);
        // Continue with next item instead of failing entire batch
      }
    }

    return results;
  }

  /**
   * Get classifications from database for a media item
   */
  async getStoredClassifications(plexKey: string): Promise<HolidayClassification[]> {
    const pool = getDbPool();

    try {
      const result = await pool.query(
        `SELECT ac.holiday, ac.confidence, ac.reason
         FROM ai_classifications ac
         JOIN media_items mi ON mi.id = ac.media_item_id
         WHERE mi.plex_key = $1`,
        [plexKey]
      );

      return result.rows.map((row: { holiday: string; confidence: string; reason: string }) => ({
        holiday: row.holiday as Holiday,
        confidence: parseFloat(row.confidence),
        reason: row.reason
      }));
    } catch (error) {
      console.error('Error getting stored classifications:', error);
      return [];
    }
  }
}
