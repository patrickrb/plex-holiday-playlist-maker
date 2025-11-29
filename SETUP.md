# Setup Guide

This guide will help you set up the Plex Holiday Playlist Maker with AI-powered classification.

## Database Setup

### 1. Start PostgreSQL with Docker

```bash
# Start the database in the background
docker-compose up -d

# Check that it's running
docker-compose ps

# View logs if needed
docker-compose logs postgres
```

### 2. Verify Database Connection

The database will be automatically initialized with the schema defined in `init.sql`. You can connect to it using:

```bash
# Using psql
docker exec -it plex-holidays-db psql -U postgres -d plex_holidays

# List tables
\dt

# Exit
\q
```

### 3. Stop the Database

```bash
# Stop the container
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v
```

## Azure OpenAI Setup

### 1. Create Azure OpenAI Resource

1. Go to the [Azure Portal](https://portal.azure.com)
2. Create a new "Azure OpenAI" resource
3. Once created, go to "Keys and Endpoint"
4. Copy your API key and endpoint

### 2. Deploy a Model

1. In your Azure OpenAI resource, go to "Model deployments"
2. Deploy the `gpt-4o-mini` model
3. Name your deployment (e.g., `gpt-4o-mini-instruct`)

### 3. Update Environment Variables

Update your `.env` file with your credentials:

```bash
AZURE_OPENAI_KEY=your-actual-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/openai/deployments/gpt-4o-mini-instruct
```

## Using AI Classification

### In Your Code

To enable AI classification in the HolidayMatcher:

```typescript
import { HolidayMatcher } from '@/lib/holiday/matcher';

// Enable AI classification by passing useAI: true
const matcher = new HolidayMatcher(wikipediaTitles, true);

// The matcher will now automatically use AI for items that don't match
// curated patterns or Wikipedia data
const matches = await matcher.findMatches(plexMedia);
```

### Using the AI Classifier Directly

You can also use the AI classifier directly:

```typescript
import { HolidayAIClassifier } from '@/lib/ai/classifier';

const classifier = new HolidayAIClassifier();

// Classify a single item
const result = await classifier.classify(plexMediaItem);
console.log(result.holidays);

// Classify multiple items
const results = await classifier.classifyBatch(plexMediaItems);

// Get stored classifications
const stored = await classifier.getStoredClassifications('plex-item-key');
```

## Database Queries

### View All Classifications

```sql
SELECT
  mi.title,
  mi.media_type,
  ac.holiday,
  ac.confidence,
  ac.reason,
  ac.classified_at
FROM ai_classifications ac
JOIN media_items mi ON mi.id = ac.media_item_id
ORDER BY ac.classified_at DESC;
```

### Check Cache Hit Rate

```sql
SELECT
  COUNT(*) as total_items,
  (SELECT COUNT(*) FROM ai_response_cache) as cached_items,
  ROUND((SELECT COUNT(*)::decimal FROM ai_response_cache) / COUNT(*) * 100, 2) as cache_hit_rate
FROM media_items;
```

### View High Confidence Classifications

```sql
SELECT
  mi.title,
  ac.holiday,
  ac.confidence,
  ac.reason
FROM ai_classifications ac
JOIN media_items mi ON mi.id = ac.media_item_id
WHERE ac.confidence >= 90
ORDER BY ac.confidence DESC;
```

## Troubleshooting

### Database Connection Issues

If you can't connect to the database:

1. Check that Docker is running: `docker ps`
2. Verify the container is up: `docker-compose ps`
3. Check the logs: `docker-compose logs postgres`
4. Verify your DATABASE_URL in `.env`

### Azure OpenAI Errors

If you get Azure OpenAI errors:

1. Verify your API key is correct
2. Check that your endpoint URL includes the deployment name
3. Ensure your Azure subscription has quota available
4. Check the Azure Portal for any service issues

### AI Classification Not Working

If AI classification isn't working:

1. Verify environment variables are set correctly
2. Check that the database is running
3. Look for errors in the console logs
4. Ensure you passed `useAI: true` to the HolidayMatcher constructor

## Production Deployment

For production, you'll want to use a managed PostgreSQL service instead of Docker:

### Options:
- **Vercel Postgres** - Integrated with Vercel deployments
- **Supabase** - Free tier available with PostgreSQL
- **AWS RDS** - Scalable managed PostgreSQL
- **Azure Database for PostgreSQL** - Pairs well with Azure OpenAI

Update your `DATABASE_URL` environment variable to point to your production database and run the `init.sql` script to set up the schema.
