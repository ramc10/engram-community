# Engram Browser Extension

Privacy-first browser extension for capturing, encrypting, and syncing AI conversations from ChatGPT, Claude, Perplexity, and Gemini.

**Current Version**: 1.0.0
**License**: AGPL-3.0

## Features

- 🔒 End-to-end encryption (XChaCha20-Poly1305)
- 🔍 Local semantic search (BGE-Small + HNSW)
- 🤖 Multi-platform support (ChatGPT, Claude, Perplexity, Gemini)
- 💾 Local-first storage with optional cloud sync
- 🎨 Modular component architecture
- 🛡️ Error boundaries and crash recovery

## Setup

### Prerequisites
1. Node.js ≥20.0.0 installed
2. Supabase account and project (optional, for cloud sync)
3. Google Cloud Console account (optional, for Google OAuth)

### Configuration

1. **Copy environment variables**:
   ```bash
   cp .env.example .env
   ```

2. **Add Supabase credentials** to `.env`:
   - Get from: https://app.supabase.com/project/_/settings/api
   - Add `SUPABASE_URL` and `SUPABASE_ANON_KEY`

3. **Set up Google OAuth** (for "Sign in with Google"):
   - Create a project in Google Cloud Console
   - Set up OAuth 2.0 credentials
   - Add your Client ID to `PLASMO_PUBLIC_GOOGLE_CLIENT_ID` in `.env`
   - **⚠️ Important**: Configure OAuth redirect URLs for Chrome extension
   - **See [SUPABASE_SETUP.md](../../SUPABASE_SETUP.md) for detailed setup instructions**

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

## Project Structure
```
src/
├── background/           # Service worker and message handlers
│   ├── index.ts         # Main service worker
│   └── message-handler.ts  # Chrome runtime message handling
├── content/             # Content scripts and platform adapters
│   ├── platforms/       # ChatGPT, Claude, Perplexity, Gemini adapters
│   └── shared/          # Shared utilities (prompt interceptor, context matcher)
├── popup/               # Extension popup UI
│   └── pages/           # Settings, Login, etc.
├── sidepanel/           # Side panel interface
├── components/          # Reusable React components
│   └── ui/              # UI component library
└── lib/                 # Core services and utilities
    ├── storage.ts       # IndexedDB storage with encryption
    ├── crypto-service.ts # Encryption/decryption
    ├── embedding-service.ts  # ML embeddings (BGE-Small)
    ├── hnsw-index-service.ts # Vector similarity search
    ├── enrichment-service.ts # AI memory enrichment
    └── cloud-sync.ts    # Optional cloud synchronization
```

## Key Technologies

- **Framework**: [Plasmo](https://plasmo.com) - Modern browser extension framework
- **UI**: React 18 + TypeScript
- **Storage**: Dexie (IndexedDB wrapper)
- **Encryption**: XChaCha20-Poly1305 via @noble/ciphers
- **ML**: Transformers.js for local embeddings
- **Vector Search**: EdgeVec HNSW index
- **Backend** (optional): Supabase for cloud sync

## Contributing

See the main repository [README.md](../../README.md) and [ARCHITECTURE.md](../../ARCHITECTURE.md) for contribution guidelines.

## Issues

For bug reports or feature requests, please use the [GitHub Issues](https://github.com/ramc10/engram-community/issues) tracker.