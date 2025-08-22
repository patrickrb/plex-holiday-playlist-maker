# Plex Holiday Playlist Maker

A modern Next.js web application that automatically creates holiday-themed playlists from your Plex TV library using OAuth authentication, TypeScript, and shadcn/ui components.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites
- Node.js 18+ (tested with Node.js 20.19.4, npm 10.8.2)
- A running Plex Media Server (for full functionality)

### Bootstrap, Build, and Test
1. **Install dependencies:**
   ```bash
   npm install
   ```
   - Takes 21 seconds. NEVER CANCEL. Set timeout to 60+ seconds.

2. **Lint the code:**
   ```bash
   npm run lint
   ```
   - Takes 2.4 seconds. Always passes with current codebase.

3. **Build for production:**
   ```bash
   # Option 1: With turbopack (may fail in sandboxed environments due to Google Fonts)
   npm run build
   
   # Option 2: Without turbopack (recommended for CI/sandboxed environments)
   npx next build
   ```
   - Turbopack build: 18.9 seconds when fonts accessible, fails with network restrictions
   - Standard build: 25.2 seconds. NEVER CANCEL. Set timeout to 60+ minutes.
   - Build failure due to Google Fonts connectivity is common in sandboxed environments - use standard build

4. **Start development server:**
   ```bash
   npm run dev
   ```
   - Starts in 1 second, runs on http://localhost:3000
   - Uses turbopack for fast development

5. **Start production server:**
   ```bash
   npm start
   ```
   - Requires successful build first
   - Starts in 0.6 seconds, runs on http://localhost:3000

## Validation

### Manual Testing Scenarios
After making changes, ALWAYS test these core user workflows:

1. **Application Startup Validation:**
   - Navigate to http://localhost:3000
   - Verify homepage loads with "Plex Holiday Playlist Maker" title
   - Verify "Sign in with Plex" button is visible
   - Verify feature cards display correctly (Holiday Detection, Wikipedia Integration, etc.)

2. **Authentication Flow (will fail in sandboxed environments):**
   - Click "Sign in with Plex" button
   - In sandboxed environments, expect "Failed to initiate Plex authentication" error
   - This failure is NORMAL and expected - the UI should handle it gracefully

3. **Build Validation:**
   - ALWAYS run both `npm run lint` and `npx next build` before committing
   - Build output should show successful compilation
   - Production build should generate static pages for /, /auth/callback, and API routes

4. **Code Quality Checks:**
   - Always run `npm run lint` before committing - CI will fail otherwise
   - No ESLint errors should be present
   - TypeScript compilation should succeed

## Common Tasks

### Development Workflow
1. **Making Changes:**
   - Start development server: `npm run dev`
   - Make your changes
   - Verify in browser at http://localhost:3000
   - Run linting: `npm run lint`
   - Test build: `npx next build`

2. **Font Issues in Sandboxed Environments:**
   - If build fails with Google Fonts errors, temporarily modify `src/app/layout.tsx`:
   ```typescript
   // Comment out Google Font imports:
   // import { Geist, Geist_Mono } from "next/font/google";
   
   // Comment out font configurations:
   // const geistSans = Geist({ ... });
   // const geistMono = Geist_Mono({ ... });
   
   // Change body className from:
   // className={`${geistSans.variable} ${geistMono.variable} antialiased`}
   // to:
   // className="font-sans antialiased"
   ```
   - Remember to revert changes before committing

### Key Architecture Components

**Frontend (Next.js 15 with App Router):**
- `src/app/page.tsx` - Main homepage component
- `src/app/layout.tsx` - Root layout with Plex context provider
- `src/components/plex/` - Plex OAuth and connection components
- `src/components/playlist/` - Playlist creation and episode confirmation
- `src/components/ui/` - shadcn/ui reusable components

**Backend (API Routes):**
- `src/app/api/plex/test-connection/route.ts` - Tests Plex server connectivity
- `src/app/api/plex/proxy/route.ts` - Proxies requests to Plex (CORS workaround)
- `src/app/api/scrape-wikipedia/route.ts` - Scrapes Wikipedia for holiday episodes

**Core Logic:**
- `src/lib/plex/client.ts` - Plex API client and playlist management
- `src/lib/holiday/config.ts` - Holiday detection patterns and Wikipedia sources
- `src/lib/scraper/` - Wikipedia scraping functionality
- `src/types/index.ts` - TypeScript type definitions

**State Management:**
- `src/contexts/PlexContext.tsx` - Global Plex connection state
- `src/hooks/` - Custom React hooks for Plex operations

## Important File Locations

### Configuration Files
- `package.json` - Dependencies and npm scripts
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint configuration
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration (in project root)

### Core Application Logic
- `src/lib/holiday/config.ts` - Holiday detection patterns and keywords
- `src/types/index.ts` - Main TypeScript interfaces for Plex, holidays, playlists
- `src/components/playlist/PlaylistCreator.tsx` - Main playlist creation workflow

### Frequently Modified Areas
- When changing holiday detection: Always check `src/lib/holiday/config.ts`
- When modifying Plex API calls: Check `src/lib/plex/client.ts`
- When updating UI: Most components are in `src/components/`
- When adding API endpoints: Add to `src/app/api/`

## Technology Stack Details

- **Framework:** Next.js 15 with App Router and Turbopack
- **Language:** TypeScript with strict mode enabled
- **Styling:** Tailwind CSS v4 with shadcn/ui components
- **Authentication:** Plex OAuth 2.0 via plex-oauth library
- **HTTP Client:** Axios for server-side requests
- **Web Scraping:** node-html-parser for Wikipedia integration
- **State Management:** React Context API
- **Build Tool:** Next.js with optional Turbopack

## Known Issues and Workarounds

1. **Google Fonts in Sandboxed Environments:**
   - Build fails with font connectivity errors
   - Workaround: Use `npx next build` instead of `npm run build`
   - For persistent issues, temporarily modify font imports in layout.tsx

2. **Plex Authentication in Development:**
   - OAuth flow requires external network access to plex.tv
   - Will fail in sandboxed environments with network restrictions
   - This is expected behavior - UI handles authentication failures gracefully

3. **Production Server with Turbopack:**
   - `npm start` may fail after turbopack build
   - Always use standard build (`npx next build`) for production

## Repository Structure Overview

```
├── .github/                    # GitHub configuration
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes for Plex and Wikipedia
│   │   ├── auth/              # OAuth callback page
│   │   ├── layout.tsx         # Root layout component
│   │   └── page.tsx           # Homepage component
│   ├── components/            # React components
│   │   ├── plex/             # Plex connection and OAuth
│   │   ├── playlist/         # Playlist creation workflow
│   │   └── ui/               # shadcn/ui components
│   ├── contexts/             # React context providers
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Core application logic
│   │   ├── holiday/          # Holiday detection algorithms
│   │   ├── plex/             # Plex API client
│   │   └── scraper/          # Wikipedia scraping
│   └── types/                # TypeScript definitions
├── public/                   # Static assets
├── package.json             # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint configuration
└── next.config.ts          # Next.js configuration
```

This application creates holiday playlists by analyzing Plex TV episode titles and metadata, optionally enhanced with Wikipedia scraping for comprehensive holiday episode detection.