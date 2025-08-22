# Plex Holiday Playlist Maker

A modern web application that automatically creates holiday-themed playlists from your Plex TV library. Built with Next.js, TypeScript, and shadcn/ui components.

## Features

🎃 **Smart Holiday Detection** - Automatically identifies Halloween, Thanksgiving, Christmas, and Valentine's Day episodes using advanced pattern matching

📚 **Wikipedia Integration** - Optionally scrapes Wikipedia for comprehensive lists of holiday TV specials and episodes

✅ **Episode Confirmation** - Review and confirm which episodes to include before creating playlists

🔄 **Smart Updates** - Updates existing playlists without duplicates and creates new ones as needed

## Prerequisites

- Node.js 18+ 
- A running Plex Media Server
- Plex authentication token

## Getting Started

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd plex-holiday-playlist-maker
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
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
│   ├── holiday/          # Holiday detection logic
│   ├── plex/             # Plex API client
│   └── scraper/          # Wikipedia scraping
└── types/                # TypeScript type definitions
```

## Configuration

The holiday detection uses configurable patterns and Wikipedia sources defined in:

- `src/lib/holiday/config.ts` - Keyword patterns and Wikipedia URLs
- Holiday types: Halloween, Thanksgiving, Christmas, Valentine's Day

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