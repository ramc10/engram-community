# Engram Extension

Browser extension for capturing and syncing AI conversations with end-to-end encryption. Works with ChatGPT, Claude, Perplexity, and Gemini.

## Setup

### Prerequisites
1. Node.js 20+ installed
2. npm 10+ installed
3. Supabase account and project (optional, for cloud sync)
4. Google Cloud Console account (optional, for Google OAuth)

### Configuration

1. **Copy environment variables**:
   ```bash
   cp .env.example .env
   ```

2. **Add Supabase credentials** to `.env` (optional):
   - Get from: https://app.supabase.com/project/_/settings/api
   - Add `PLASMO_PUBLIC_SUPABASE_URL` and `PLASMO_PUBLIC_SUPABASE_ANON_KEY`

3. **Set up Google OAuth** (optional, for "Sign in with Google"):
   - Create a project in Google Cloud Console
   - Set up OAuth 2.0 credentials
   - Add your Client ID to `PLASMO_PUBLIC_GOOGLE_CLIENT_ID` in `.env`

## Development
```bash
npm install
npm run dev
```

Load unpacked extension in Chrome:
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `build/chrome-mv3-dev`

## Testing
```bash
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests (Playwright)
npm run test:api            # API contract tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

See [tests/README.md](tests/README.md) for detailed testing documentation.

## Building
```bash
npm run build      # Production build
npm run package    # Create distributable .zip
```

## Structure
```
src/
├── background/    # Service worker (message handling, initialization)
├── content/       # Platform adapters (ChatGPT, Claude, Perplexity, Gemini)
├── contents/      # Main world interceptor scripts
├── lib/           # Core services (storage, encryption, embedding, enrichment, sync)
├── sync/          # Synchronization engine (WebSocket, state machine, CRDT)
├── components/    # React UI components (modular, with error boundaries)
├── popup/         # Extension popup UI
├── assets/        # Static assets
└── sidepanel.tsx  # Side panel entry point
```
