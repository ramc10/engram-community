# Engram Extension

Browser extension for capturing and syncing AI conversations.

## Setup

### Prerequisites
1. Node.js 18+ installed
2. Supabase account and project
3. Google Cloud Console account (for Google OAuth)

### Configuration

1. **Copy environment variables**:
   ```bash
   cp .env.example .env
   ```

2. **Add Supabase credentials** to `.env`:
   - Get from: https://app.supabase.com/project/_/settings/api
   - Add `SUPABASE_URL` and `SUPABASE_ANON_KEY`

3. **Set up Google OAuth** (for "Sign in with Google"):
   - See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for detailed instructions
   - Required to enable Google Sign-In functionality

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
npm test
npm run test:watch
```

## Building
```bash
npm run build      # Production build
npm run package    # Create distributable
```

## Structure
```
src/
├── background/    # Service worker
├── content/       # Platform adapters
├── popup/         # Extension popup UI
├── components/    # React components
└── lib/          # Utilities and types
```