# Engram Architecture Documentation

## System Overview

Engram uses a **local-first, privacy-preserving** architecture with optional server-side premium features.

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
│  │  memA Services (Dual Mode)                       │   │
│  │  ───────────────────────────────────────────────  │   │
│  │                                                   │   │
│  │  Premium Available?                              │   │
│  │  ├─ YES → Use Premium API                        │   │
│  │  │         (Our servers, our API keys)           │   │
│  │  │                                               │   │
│  │  └─ NO  → Use User's API Key                     │   │
│  │           (OpenAI/Anthropic, user's key)        │   │
│  │                                                   │   │
│  │  - Enrichment Service                            │   │
│  │  - Link Detection Service                        │   │
│  │  - Evolution Service                             │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ (If Premium Active)
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Premium API Server (Private)                           │
│  ────────────────────────────────────────────────────   │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │     Auth     │  │   Rate       │  │   Usage      │  │
│  │              │  │   Limiting   │  │   Tracking   │  │
│  │ - JWT Tokens │  │ - Redis      │  │ - PostgreSQL │  │
│  │ - Licenses   │  │ - Per Tier   │  │ - Billing    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  LLM Services                                     │   │
│  │  ───────────────────────────────────────────────  │   │
│  │                                                   │   │
│  │  LM Studio (Local) or OpenAI/Anthropic (Cloud)  │   │
│  │                                                   │   │
│  │  - Enrichment (keywords, tags, context)          │   │
│  │  - Link Detection (relationships)                │   │
│  │  - Evolution Checking (updates)                  │   │
│  └──────────────────────────────────────────────────┘   │
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
│   │   │   │   └── memory.ts       # Memory, Link, Evolution types
│   │   │   └── interfaces/         # API contracts
│   │   │       └── api-client.interface.ts
│   │   └── package.json
│   │
│   └── community/                   # AGPL-3.0 License
│       ├── src/
│       │   ├── background/         # Service worker
│       │   ├── content/            # Content scripts
│       │   ├── lib/                # Core services
│       │   │   ├── api-client.ts   # Premium API client
│       │   │   ├── storage.ts      # Local storage
│       │   │   └── *-service.ts    # Dual-mode services
│       │   ├── components/         # React UI
│       │   └── popup/              # Extension popup
│       └── package.json
│
└── public/                          # Landing page


engram-premium-api/                  # Private Repository (LOCAL ONLY)
├── src/
│   ├── routes/                      # API endpoints
│   │   ├── auth.ts                 # /auth/* endpoints
│   │   ├── enrich.ts               # /enrich endpoint
│   │   ├── links.ts                # /links/* endpoints
│   │   └── evolve.ts               # /evolve/* endpoints
│   │
│   ├── services/                    # Business logic
│   │   ├── enrichment.ts           # LLM enrichment
│   │   ├── link-detection.ts       # Link detection
│   │   └── evolution.ts            # Evolution checking
│   │
│   ├── middleware/                  # Express middleware
│   │   ├── auth.ts                 # JWT validation
│   │   ├── rate-limit.ts           # Rate limiting
│   │   └── admin-auth.ts           # Admin endpoints
│   │
│   └── db/                          # Database
│       ├── client.ts               # Prisma client
│       └── redis.ts                # Redis client
│
└── prisma/
    └── schema.prisma               # Database schema
```

---

## What's Open Source vs Proprietary

### Open Source (engram-community)

**Everything except the AI logic implementation:**

✅ **Local Features:**
- Platform adapters (ChatGPT, Claude, Perplexity)
- Storage layer (encryption, IndexedDB)
- Embedding generation (BGE-Small, HNSW)
- Memory injection system
- UI components
- Authentication to premium API

✅ **Premium API Client:**
- Interface definitions (what the API contract looks like)
- HTTP client (how to call the API)
- Error handling
- Token management

✅ **Dual-Mode Services:**
- Services can use EITHER premium API OR user's API key
- Logic to choose which mode
- Fallback behavior

### Proprietary (engram-premium-api)

**The AI implementation details:**

❌ **Server-Side Only:**
- LLM prompts and prompt engineering
- Enrichment logic (how to extract metadata)
- Link detection algorithm (how to validate links)
- Evolution criteria (when to update memories)
- Rate limiting strategy
- Usage tracking and billing
- License validation

---

## Communication Flow

### Premium Feature Activation

```
1. User enters license key in extension
   ↓
2. Extension calls: POST /auth/login
   ↓
3. Premium API:
   - Validates license key
   - Checks status (ACTIVE, not expired)
   - Generates JWT token (7-day expiry)
   ↓
4. Extension receives:
   {
     "token": "eyJhbGci...",
     "tier": "PRO",
     "expiresAt": "2026-02-01"
   }
   ↓
5. Extension stores token (encrypted)
   ↓
6. Premium features now available
```

### Memory Enrichment (Premium Mode)

```
1. User creates new memory
   ↓
2. Extension checks: Premium active? → YES
   ↓
3. Extension calls: POST /enrich
   Headers: { Authorization: Bearer <token> }
   Body: {
     "memory": {
       "id": "uuid",
       "content": "Conversation text...",
       "platform": "chatgpt"
     }
   }
   ↓
4. Premium API:
   - Validates JWT token
   - Checks tier (PRO or higher)
   - Applies rate limit
   - Calls LM Studio with memory content
   - Extracts keywords, tags, context
   - Tracks usage for billing
   ↓
5. Premium API responds:
   {
     "keywords": ["react", "hooks", ...],
     "tags": ["programming", "tutorial"],
     "context": "Discussion about React hooks...",
     "cost": 0,
     "processingTime": 1247
   }
   ↓
6. Extension stores enriched memory locally
```

### Memory Enrichment (User API Key Mode)

```
1. User creates new memory
   ↓
2. Extension checks: Premium active? → NO
   ↓
3. Extension checks: User API key configured? → YES
   ↓
4. Extension calls OpenAI/Anthropic directly
   - Uses user's API key
   - Same enrichment logic
   - User pays for API usage
   ↓
5. Extension stores enriched memory locally
```

---

## Security Model

### Extension Security

1. **No Secrets in Code:**
   - Premium API URL is public (api.engram.io)
   - No API keys embedded
   - User's API keys encrypted locally

2. **End-to-End Encryption:**
   - All memories encrypted with user's password
   - Encryption happens client-side
   - Server never sees plaintext

3. **Token Security:**
   - JWT tokens expire after 7 days
   - Tokens encrypted in local storage
   - Automatic refresh on expiry

### API Security

1. **Authentication:**
   - All endpoints require JWT (except /health, /auth/login)
   - JWT signed with server secret
   - Token includes userId, tier, expiry

2. **Authorization:**
   - Tier-based access control (FREE, PRO, ENTERPRISE)
   - Rate limiting per tier
   - Feature gating by tier

3. **Rate Limiting:**
   - Redis-based sliding window
   - Per-user, per-tier limits
   - Returns 429 with retry-after header

4. **Input Validation:**
   - All inputs validated
   - SQL injection prevention (Prisma)
   - XSS prevention (helmet)

---

## Database Schema

### PostgreSQL (via Prisma)

```prisma
model User {
  id          String    @id @default(cuid())
  email       String    @unique
  passwordHash String?
  licenses    License[]
  usageLogs   UsageLog[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model License {
  id         String        @id @default(cuid())
  key        String        @unique  // engram_pro_abc123...
  userId     String
  user       User          @relation(fields: [userId], references: [id])
  tier       Tier          // FREE, PRO, ENTERPRISE
  status     LicenseStatus // ACTIVE, SUSPENDED, EXPIRED
  expiresAt  DateTime?
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
}

model UsageLog {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  endpoint     String   // /enrich, /links/detect, etc.
  responseTime Int      // milliseconds
  cost         Float    // estimated cost in USD
  timestamp    DateTime @default(now())
}

enum Tier {
  FREE
  PRO
  ENTERPRISE
}

enum LicenseStatus {
  ACTIVE
  SUSPENDED
  EXPIRED
}
```

---

## API Endpoints Reference

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/login` | POST | None | Activate license key |
| `/auth/verify` | POST | JWT | Verify token validity |
| `/auth/admin/generate-license` | POST | Admin | Generate new license (admin only) |

### Premium Features

| Endpoint | Method | Auth | Tier | Description |
|----------|--------|------|------|-------------|
| `/enrich` | POST | JWT | PRO+ | Enrich memory with LLM |
| `/links/detect` | POST | JWT | PRO+ | Detect links between memories |
| `/evolve/check` | POST | JWT | PRO+ | Check if memory should evolve |

### Utility

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check |

---

## Development vs Production

### Development

- Extension: `npm run dev` (hot reload)
- API: `npm run dev` (tsx watch)
- Database: Local PostgreSQL
- LLM: LM Studio (local)

### Production

- Extension: Built and packaged
- API: Deployed to Railway
- Database: Railway PostgreSQL
- LLM: LM Studio or OpenAI/Anthropic

---

## Deployment Architecture

```
User's Browser
    ↓
┌───────────────┐
│   Engram      │  Installed from Chrome Web Store
│   Extension   │  or manually loaded
└───────┬───────┘
        │
        │ HTTPS (if premium)
        ↓
┌───────────────┐
│   Railway     │  Hosted API
│   (or VPS)    │  - Node.js server
│               │  - PostgreSQL
│               │  - Redis
└───────┬───────┘
        │
        │ HTTP (internal)
        ↓
┌───────────────┐
│  LM Studio    │  Local or cloud-hosted
│  (or OpenAI)  │  - LLM inference
└───────────────┘
```

---

## Why This Architecture?

### 1. **Privacy First**
- Memories never leave user's device (unless cloud sync enabled)
- Server only sees enrichment requests, not full memory database
- User can choose: use our API or their own keys

### 2. **Open Source Benefits**
- Community can audit security
- Platform adapters can be improved by anyone
- Core features always free

### 3. **Sustainable Business**
- Premium API provides value (convenience, cost savings)
- Server costs covered by subscriptions
- No ads, no tracking, no data mining

### 4. **Flexible Deployment**
- Extension works offline (local features)
- Premium API is optional
- Can self-host API (for enterprises)

---

## Future Enhancements

### Planned Features

1. **Self-Hosted Premium API**
   - Docker image for enterprises
   - Use your own LLM
   - Full control over data

2. **Federated Premium**
   - Share API costs with team
   - Team licenses
   - Shared knowledge base

3. **Offline AI**
   - Run LLM in browser (WebGPU)
   - Smaller models for mobile
   - Fully offline enrichment

4. **Advanced Analytics**
   - Memory usage patterns
   - Search quality metrics
   - Cost optimization

---

**For questions about architecture:** artha360.live@gmail.com
