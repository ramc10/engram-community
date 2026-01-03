# Engram Community Edition

> **Privacy-First AI Conversation Memory - Open Source**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](packages/core/LICENSE)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](packages/community/LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue.svg)](https://www.typescriptlang.org)

**Save, search, and reuse AI chat conversations with end-to-end encryption.**

Engram is a browser extension that captures AI conversations from ChatGPT, Claude, and Perplexity, stores them with end-to-end encryption, and intelligently surfaces relevant context from past conversations.

**🌐 Website:** [theengram.tech](https://theengram.tech)
**📧 Contact:** artha360.live@gmail.com

---

## 📋 What's New in Community Edition

This is the **open source** version of Engram, restructured with:

- ✅ **Dual Licensing:** MIT (core) + AGPL-3.0 (community)
- ✅ **Modular Architecture:** Workspace-based monorepo
- ✅ **Premium API Integration:** Optional server-side AI features
- ✅ **Full Local Functionality:** Works completely offline

### Open Source vs Premium

| Feature | Community (Free) | Premium ($10/mo) |
|---------|------------------|------------------|
| **Multi-platform capture** | ✅ ChatGPT, Claude, Perplexity | ✅ Same |
| **End-to-end encryption** | ✅ XChaCha20-Poly1305 | ✅ Same |
| **Local semantic search** | ✅ BGE-Small embeddings | ✅ Enhanced |
| **Memory injection** | ✅ Automatic context | ✅ Same |
| **Cloud sync** | ✅ Optional | ✅ Same |
| **AI-powered enrichment** | ⚠️ Bring your own API key | ✅ Included |
| **Smart memory linking** | ⚠️ Bring your own API key | ✅ Included |
| **Memory evolution** | ⚠️ Bring your own API key | ✅ Included |
| **Cost** | Free (pay for your own API) | $10/month (we handle API) |

---

## 🏗️ Architecture

This repository is structured as a **monorepo** with multiple packages:

```
engram-community/
├── packages/
│   ├── core/         # @engram/core (MIT License)
│   │   └── Type definitions and interfaces
│   │
│   └── community/    # Main extension (AGPL-3.0)
│       ├── Storage & encryption
│       ├── Platform adapters
│       ├── Memory injection
│       └── UI components
│
└── public/          # Landing page & legal docs
```

### Package Boundaries

**@engram/core** (MIT):
- Pure TypeScript types
- API client interfaces
- No business logic
- Can be used in any project

**community** (AGPL-3.0):
- Browser extension code
- Local-first features
- Premium API client
- Copyleft (modifications must be open source)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥20.0.0
- **npm** ≥10.0.0
- **Chrome** or **Edge** browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ramc10/Engram.git
   cd engram-community
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm run setup
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

   This opens a Chrome instance with the extension loaded.

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Load extension manually** (alternative)
   - Build: `npm run build`
   - Open Chrome → `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `packages/community/build/chrome-mv3-dev`

---

## 💻 Development

### Workspace Commands

```bash
# Development
npm run dev              # Run extension with hot reload

# Building
npm run build            # Build extension
npm run build:all        # Build all packages
npm run package          # Create .zip for distribution

# Quality
npm run lint             # Lint all code
npm run format           # Format with Prettier
npm run typecheck        # TypeScript checking
npm run test             # Run tests
```

### Project Structure

```
packages/community/src/
├── background/           # Service worker
│   ├── index.ts
│   └── message-handler.ts
│
├── content/              # Content scripts
│   ├── platforms/        # ChatGPT, Claude, Perplexity
│   └── shared/           # Prompt interceptor, UI injector
│
├── lib/                  # Core services
│   ├── storage.ts        # IndexedDB + encryption
│   ├── embedding-service.ts
│   ├── enrichment-service.ts  # Can use premium API
│   ├── link-detection-service.ts
│   └── evolution-service.ts
│
├── components/           # React UI
│   └── ui/               # Reusable components
│
└── popup/                # Extension popup
    └── pages/            # Settings, Login, etc.
```

---

## 🔐 Premium Features

Engram offers **optional premium features** that use AI to enhance your memories:

### 1. AI-Powered Enrichment
Automatically extract keywords, tags, and context summaries from conversations.

**Community (Free):** Provide your own OpenAI/Anthropic API key
**Premium:** Uses our servers, no API key needed

### 2. Smart Memory Linking
Discovers semantic relationships between memories automatically.

**Community (Free):** Provide your own API key
**Premium:** Included, no setup required

### 3. Memory Evolution
Updates historical memories based on new information.

**Community (Free):** Provide your own API key
**Premium:** Included, automatic

### How to Activate Premium

1. Go to Settings in the extension
2. Click "Upgrade to Premium"
3. Enter your license key
4. Premium features activate automatically

**Get a license:** [theengram.tech/pricing](https://theengram.tech/pricing)

---

## 🔧 Configuration

### Using Your Own API Keys (Free Tier)

If you prefer not to subscribe to premium, you can use your own API keys:

1. **Get an API key**
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Anthropic: [console.anthropic.com/keys](https://console.anthropic.com/keys)

2. **Configure in settings**
   - Extension → Settings → memA Configuration
   - Select provider (OpenAI or Anthropic)
   - Enter API key
   - Enable desired features

3. **Costs (approximate)**
   - Enrichment: ~$0.0003 per memory
   - Link detection: ~$0.001 per memory
   - Evolution: ~$0.0005 per check

### Environment Variables

For local development:

```env
# packages/community/.env

# Supabase (optional cloud sync)
PLASMO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=xxx

# Premium API (if using premium)
PLASMO_PUBLIC_PREMIUM_API_URL=https://api.engram.io
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm run test`
5. Commit: `git commit -m "feat: add feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

### Code Style

- **TypeScript:** Strict mode
- **ESLint:** Standard config
- **Prettier:** 2 spaces, single quotes
- **Commits:** Conventional commits format

---

## 📄 License

This project is **dual-licensed**:

- **packages/core:** MIT License (permissive)
- **packages/community:** AGPL-3.0 (copyleft)

See [LICENSE](LICENSE) for details.

**Summary:**
- ✅ Use freely for personal use
- ✅ Modify and distribute (under AGPL-3.0)
- ✅ Use in commercial projects (with AGPL compliance)
- ❌ Cannot make closed-source derivatives of community edition

For commercial licensing inquiries: artha360.live@gmail.com

---

## 🗺️ Roadmap

### Current (v0.1.0)
- ✅ Multi-platform capture
- ✅ E2E encryption
- ✅ Semantic search
- ✅ Memory injection
- ✅ Premium API integration

### Coming Soon
- 🔜 Firefox support
- 🔜 Safari support
- 🔜 Mobile companion app
- 🔜 Team workspaces
- 🔜 API for third-party integrations

See [ROADMAP.md](ROADMAP.md) for full roadmap.

---

## 📞 Support

- **Email:** artha360.live@gmail.com
- **Website:** [theengram.tech](https://theengram.tech)
- **Issues:** [GitHub Issues](https://github.com/ramc10/Engram/issues)
- **Docs:** [/docs](./docs)

---

## 🙏 Acknowledgments

- [Plasmo](https://plasmo.com) - Extension framework
- [Supabase](https://supabase.com) - Backend infrastructure
- [Transformers.js](https://huggingface.co/docs/transformers.js) - Local ML
- [EdgeVec](https://github.com/tantaraio/edgevec) - Vector index

---

**Made with ❤️ for AI power users who value privacy.**

**Star ⭐ this repo if Engram helps you!**
