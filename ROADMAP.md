# Engram Community Edition - Roadmap

**Last Updated**: January 11, 2026

This document tracks current status, immediate priorities, and future enhancements for Engram.

---

## 🎯 Current Status (Phase 4: Testing & Deployment)

### ✅ Completed (Last 7 Days)
- **Security**: Fixed critical plaintext storage vulnerability (Jan 5)
- **Premium API**: Deployed locally via Docker on Mac Mini M4 Pro (Jan 10)
- **API Testing**: 15/41 tests passing (37% coverage)
- **CORS**: Chrome extension support enabled
- **Authentication**: License-based JWT authentication working
- **Infrastructure**: PostgreSQL + Redis + LM Studio integration

### 🟢 Resolved Blocker
**Premium API Client Initialization** (Jan 10)
- **Issue**: Extension doesn't load JWT tokens from storage on startup
- **Root Cause**: Background service never called `client.initialize()` to restore session
- **Fix**: Applied to [background/index.ts:343-398](packages/community/src/background/index.ts#L343-L398) (Verified in PR #1)
- **Next Step**: Rebuild extension, verify in service worker console

### 📋 Immediate Priorities (This Week)
1. **Verify Fix**: Check service worker console for `[PremiumAPI] Session restored successfully`
2. **Test E2E**: Complete end-to-end memory enrichment with Premium API
3. **Complete Testing**: Finish remaining 26/41 test cases (Suite 4-8)
4. **Production Decision**: Local-only ($0/month) vs Cloud deployment ($160/month)

### 📊 Progress Metrics
- **Phase 4 Progress**: 25% complete
- **API Test Coverage**: 37% (15/41 tests)
- **Known Critical Bugs**: 1 (initialization blocker - fix applied)
- **Days to Target Launch**: 31 days (Feb 10, 2026)

---

## Phase 5: Post-Launch Improvements (Future)

### UI/UX Enhancements 🎨

**Priority**: Medium
**Status**: Backlog
**Target**: Post-launch iteration

#### Memories Page Redesign

**Problem**: Current memories page UI/UX is confusing and overwhelming
- Too much information density on memory cards
- Multiple competing elements (platform badges, evolution badges, related memories, timeline)
- Unclear visual hierarchy
- Not obvious what actions are available
- Hard to scan and find specific memories quickly

**Proposed Improvements**:

1. **Simplified Card Design**
   - Cleaner, more minimal memory card layout
   - Better use of whitespace
   - Clearer typography hierarchy
   - Focus on content over metadata

2. **Progressive Disclosure**
   - Show only essential info by default (content, timestamp, platform)
   - Advanced features (evolution, links) hidden behind actions/dropdowns
   - "Show more" pattern for detailed metadata

3. **Better Visual Hierarchy**
   - Primary: Memory content
   - Secondary: Timestamp, platform
   - Tertiary: Evolution, links, metadata
   - Use size, color, and spacing to create clear hierarchy

4. **Improved Navigation & Actions**
   - Clear action buttons (Edit, Delete, Share, etc.)
   - Better sorting options (Date, Relevance, Platform)
   - Filter by platform, tags, date range
   - Bulk actions (select multiple, delete, export)

5. **Enhanced Search & Discovery**
   - Advanced search filters
   - Saved searches
   - Quick filters (Today, This Week, ChatGPT only, etc.)
   - Search history

6. **Memory Details View**
   - Dedicated detail view for expanded memory
   - Tabbed interface (Content, Related, Evolution, Metadata)
   - Better presentation of evolution timeline
   - Related memories graph/network view

7. **Empty States & Onboarding**
   - Helpful empty state with getting started guide
   - Tooltips for first-time users
   - Interactive tutorial for new features
   - Sample memories to demonstrate features

8. **View Modes**
   - List view (default)
   - Compact view (more memories per screen)
   - Timeline view (chronological with date headers)
   - Graph view (visualize memory connections)

9. **Keyboard Shortcuts**
   - Arrow keys to navigate memories
   - Enter to expand/collapse
   - / to focus search
   - Esc to clear search/close details

10. **Performance Optimizations**
    - Virtualized scrolling for large memory lists
    - Lazy loading of memory content
    - Skeleton loading states
    - Optimistic UI updates

**Design References**:
- Notion's database views
- Linear's issue list
- Obsidian's note list
- Apple Notes interface

**Acceptance Criteria**:
- [ ] New users can understand the interface without documentation
- [ ] Power users can navigate quickly with keyboard shortcuts
- [ ] Memory cards are scannable and easy to distinguish
- [ ] Actions are discoverable and intuitive
- [ ] Performance remains smooth with 100+ memories
- [ ] Mobile-friendly (if extension adds mobile support)

---

### Additional Features (Backlog)

#### Memory Management
- [ ] Tags and categories for organizing memories
- [ ] Folders or collections
- [ ] Star/favorite memories
- [ ] Archive memories (hide without deleting)
- [ ] Bulk export to Markdown/JSON
- [ ] Import from other sources

#### Search Enhancements
- [ ] Semantic search improvements (when HNSW works)
- [ ] Search within a specific conversation thread
- [ ] Search by date range
- [ ] Search by platform
- [ ] Regex search for power users

#### Collaboration Features
- [ ] Share memory with link (encrypted)
- [ ] Public memory collections
- [ ] Collaborative memory boards
- [ ] Comments on memories

#### Analytics & Insights
- [ ] Memory statistics dashboard
- [ ] Most-used tags
- [ ] Conversation patterns
- [ ] Knowledge graph visualization
- [ ] AI-powered insights ("You often ask about X")

#### Integration Enhancements
- [ ] Support for more AI platforms (Gemini, Copilot, etc.)
- [ ] Browser-wide memory capture (any webpage)
- [ ] Desktop app with system-wide shortcuts
- [ ] Mobile companion app
- [ ] API for third-party integrations

#### Advanced Enrichment
- [ ] Multi-language support
- [ ] Named entity recognition
- [ ] Sentiment analysis
- [ ] Topic modeling
- [ ] Auto-categorization

---

## Phase 6: Enterprise Features (Future)

**Target Audience**: Teams and organizations

### Features
- [ ] Team workspaces
- [ ] Role-based access control
- [ ] Shared memory libraries
- [ ] Admin dashboard
- [ ] SSO integration
- [ ] Audit logs
- [ ] Compliance features (GDPR, HIPAA)
- [ ] On-premise deployment option

---

## Community Requests

**Add user-requested features here as they come in**

### Requested Features
- (None yet - will be populated after launch)

### Top Voted Features
- (Will track with GitHub issues voting)

---

## Technical Debt

### High Priority
- [ ] Fix HNSW vector index WASM loading in service worker
- [ ] Improve bundle size (currently 1.6MB background, can optimize)
- [ ] Add comprehensive error boundaries
- [ ] Implement retry logic for failed enrichments
- [ ] Add telemetry for error tracking (opt-in)

### Medium Priority
- [ ] Migrate from Dexie to native IndexedDB for better control
- [ ] Implement background sync for offline support
- [ ] Add comprehensive unit tests (current coverage: minimal)
- [ ] Add E2E tests with Playwright
- [ ] Set up CI/CD pipeline

### Low Priority
- [ ] Refactor sidepanel.tsx (currently 2000+ lines)
- [ ] Split into smaller components
- [ ] Add Storybook for component development
- [ ] Improve TypeScript strictness
- [ ] Add JSDoc comments

---

## Performance Targets

### Current Performance
- Extension load: <500ms
- Memory save: <200ms
- Search (100 memories): <500ms
- Enrichment: 2-5 seconds (depends on LLM)

### Target Performance (Future)
- Extension load: <300ms
- Memory save: <100ms
- Search (1000 memories): <500ms
- Enrichment: <2 seconds (with Premium API)

---

## Release Schedule (Tentative)

### v0.1.0 (Current)
- Core functionality
- Local + cloud enrichment
- Basic UI

### v0.2.0 (Post-launch, +1 month)
- UI/UX improvements based on user feedback
- Bug fixes from initial launch
- Performance optimizations

### v0.3.0 (+2 months)
- Advanced search features
- Memory organization (tags, folders)
- Bulk actions

### v0.4.0 (+3 months)
- Knowledge graph visualization
- Analytics dashboard
- Additional platform support

### v1.0.0 (+6 months)
- Feature-complete for individual users
- Stable API
- Comprehensive documentation
- Ready for enterprise pilot

---

## Decision Log

### Deferred Decisions
- **UI/UX Redesign**: Deferred to post-launch (Jan 4, 2026)
  - Reason: Focus on core functionality and launch first
  - Will gather user feedback before major UI changes
  - Target: v0.2.0 release

---

_This roadmap is subject to change based on user feedback, technical constraints, and strategic priorities._
