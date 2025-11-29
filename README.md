# Plex Holiday Playlist Maker

A modern web application that automatically creates holiday-themed playlists from your Plex TV library. Built with Next.js, TypeScript, and shadcn/ui components.

## Features

🎃 **Smart Holiday Detection** - Automatically identifies Halloween, Thanksgiving, Christmas, and Valentine's Day episodes using advanced pattern matching

📚 **Wikipedia Integration** - Optionally scrapes Wikipedia for comprehensive lists of holiday TV specials and episodes

🤖 **AI-Powered Classification** - Uses Azure OpenAI to intelligently classify media that isn't found in curated lists or Wikipedia

💾 **PostgreSQL Database** - Stores classification results and caches AI responses to avoid redundant API calls

✅ **Episode Confirmation** - Review and confirm which episodes to include before creating playlists

🔄 **Smart Updates** - Updates existing playlists without duplicates and creates new ones as needed

## Prerequisites

- Node.js 18+
- A running Plex Media Server
- Plex authentication token
- Docker and Docker Compose (for local database)
- Azure OpenAI account (optional, for AI-powered classification)

## Getting Started

### Option 1: Deploy to Vercel (Recommended)

Deploy your own instance to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/patrickrb/plex-holiday-playlist-maker)

After deployment, your app will be available at your custom Vercel URL and ready to use with your Plex server.

### Option 2: Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd plex-holiday-playlist-maker
   npm install
   ```

2. **Set up environment variables:**
   Copy the `.env` file and update with your credentials:
   ```bash
   # Azure OpenAI Configuration (optional)
   AZURE_OPENAI_KEY=your-key-here
   AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/openai/deployments/gpt-4o-mini-instruct

   # PostgreSQL Configuration
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/plex_holidays
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=plex_holidays
   ```

3. **Start the PostgreSQL database:**
   ```bash
   docker-compose up -d
   ```

   This will start a PostgreSQL container with the database schema automatically initialized.

4. **Verify the database is running:**
   ```bash
   docker-compose ps
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## How to Use

### Step 1: Sign in with Plex

1. Click "Sign in with Plex" on the main page
2. Complete the OAuth authentication in the popup window
3. Select a Plex server from your available servers

### Step 2: Create Holiday Playlists

1. Select your TV Shows library to scan
2. Choose whether to use Wikipedia scraping for better detection
3. Click "Analyze Library" to scan for holiday episodes
4. Review the found episodes and confirm which ones to include  
5. Click "Create Playlists" to add them to your Plex server

## Technology Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Database:** PostgreSQL
- **AI:** Azure OpenAI (GPT-4o-mini)
- **HTTP Client:** Axios (for server-side requests)
- **Web Scraping:** node-html-parser

## API Routes

The application includes several API routes to handle server-side operations:

- `/api/plex/test-connection` - Tests Plex server connectivity
- `/api/plex/proxy` - Proxies requests to Plex to avoid CORS issues
- `/api/scrape-wikipedia` - Scrapes Wikipedia for holiday episode titles

## Project Structure

```
src/
├── app/                    # Next.js app router pages and API routes
├── components/            # React components
│   ├── plex/             # Plex connection components
│   ├── playlist/         # Playlist creation components
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── ai/               # AI classification service
│   ├── db/               # Database client utilities
│   ├── holiday/          # Holiday detection logic
│   ├── plex/             # Plex API client
│   └── scraper/          # Wikipedia scraping
└── types/                # TypeScript type definitions
```

## Configuration

### Holiday Detection

The holiday detection uses a three-tier approach:

1. **Curated Patterns** - Keyword patterns defined in `src/lib/holiday/config.ts`
2. **Wikipedia Data** - Comprehensive lists scraped from Wikipedia
3. **AI Classification** - Azure OpenAI for items not matched by the above

Holiday types supported: Halloween, Thanksgiving, Christmas, Valentine's Day

### AI Classification

To enable AI-powered classification:

1. Get an Azure OpenAI API key from the Azure Portal
2. Add your credentials to the `.env` file
3. Pass `useAI: true` when initializing the `HolidayMatcher`

The AI classifier:
- Only classifies items that don't match curated patterns or Wikipedia data
- Caches results in PostgreSQL to avoid redundant API calls
- Requires 70% confidence or higher to include a match
- Stores detailed reasoning for each classification

### Database Schema

The PostgreSQL database includes tables for:
- `media_items` - Stores Plex media metadata
- `ai_classifications` - Stores AI classification results with confidence scores
- `ai_response_cache` - Caches AI responses to minimize API costs

## Development

**Build for production:**
```bash
npm run build
```

**Start production server:**
```bash
npm start
```

**Lint code:**
```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable  
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Inspired by the original Python script for Plex holiday playlist creation
- Built with [shadcn/ui](https://ui.shadcn.com/) component library
- Uses the [Plex Media Server API](https://www.plex.tv/)