# Engram Architecture Documentation

## System Overview

Engram Community Edition uses a **local-first, privacy-preserving** architecture tailored for open source usage.

```
┌─────────────────────────────────────────────────────────┐
│  Browser Extension (Community Edition)                  │
│  ────────────────────────────────────────────────────   │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Platform    │  │   Storage    │  │  Embedding   │  │
│  │  Adapters    │  │   Manager    │  │   Service    │  │
│  │              │  │              │  │              │  │
│  │ - ChatGPT    │  │ - E2E Crypto │  │ - BGE-Small  │  │
│  │ - Claude     │  │ - IndexedDB  │  │ - HNSW Index │  │
│  │ - Perplexity │  │ - Sync       │  │ - Local ML   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  AI Services (User Configured)                   │   │
│  │  ───────────────────────────────────────────────  │   │
│  │                                                   │   │
│  │  User's API Key Mode                             │   │
│  │                                                   │   │
│  │  - Enrichment Service                            │   │
│  │  - Link Detection Service                        │   │
│  │  - Evolution Service                             │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ (External API Calls)
                        ↓
┌─────────────────────────────────────────────────────────┐
│  External LLM Provider                                  │
│  ────────────────────────────────────────────────────   │
│                                                           │
│  OpenAI / Anthropic / LM Studio (Local)                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Package Architecture

### Workspace Structure

```
engram-community/                    # Public Repository (GitHub)
├── packages/
│   ├── core/                        # MIT License
│   │   ├── src/
│   │   │   ├── types/              # Type definitions
│   │   │   └── interfaces/         # API contracts
│   │   └── package.json
│   │
│   └── community/                   # AGPL-3.0 License
│       ├── src/
│       │   ├── background/         # Service worker
│       │   ├── content/            # Content scripts
│       │   ├── lib/                # Core services
│       │   │   ├── storage.ts      # Local storage
│       │   │   └── *-service.ts    # Service implementations
│       │   ├── components/         # React UI
│       │   └── popup/              # Extension popup
│       └── package.json
│
└── public/                          # Landing page
```

---

## Communication Flow

### Memory Enrichment

```
1. User creates new memory
   ↓
2. Extension checks: User API key configured?
   ↓
3. Extension calls OpenAI/Anthropic/Local LLM directly
   - Uses user's provided API key
   - Enrichment logic runs using prompts defined in extension
   - User pays for API usage (if cloud)
   ↓
4. Extension stores enriched memory locally (Encrypted)
```

---

## Security Model

### Extension Security

1. **No Secrets in Code:**
   - No API keys embedded
   - User's API keys encrypted locally using OS-level storage where possible or encrypted IndexedDB

2. **End-to-End Encryption:**
   - All memories encrypted with user's specific keys
   - Encryption happens client-side
   - Server (if syncing) never sees plaintext

---

## Development vs Production

### Development

- Extension: `npm run dev` (hot reload)
- LLM: LM Studio (local) or OpenAI API

### Production

- Extension: Built and packaged (`npm run build`)
- LLM: User's choice (OpenAI, Anthropic, or Local)

---

## Why This Architecture?

### 1. **Privacy First**
- Memories never leave user's device (unless cloud sync enabled)
- No central server processing your data
- User has full control: use cloud APIs or local models

### 2. **Open Source Benefits**
- Community can audit security
- Platform adapters can be improved by anyone
- Core features always free

### 3. **Flexible Deployment**
- Extension works offline (local features)
- Can self-host Sync server (Supabase compatible)

---

## Future Enhancements

### Planned Features

1. **Offline AI**
   - Run LLM in browser (WebGPU)
   - Smaller models for mobile
   - Fully offline enrichment

2. **Advanced Analytics**
   - Memory usage patterns
   - Search quality metrics

---

**For questions about architecture:** artha360.live@gmail.com
