# Branch Cleanup Documentation

Generated: 2026-01-20

## Summary

This document lists all feature branches in the repository and identifies which ones can be safely deleted.

## Fully Merged Branches (Safe to Delete)

These branches have been fully merged into `main` and contain no additional commits:

1. **claude/fix-google-signin-redirect-oj2nc**
   - Status: Merged (PR #89)
   - Safe to delete: ✓

2. **claude/fix-hnsw-index-ready-state-EhWKK**
   - Status: Merged
   - Safe to delete: ✓

3. **feat/atomic-persistence-issue-73**
   - Status: Merged (PR #83)
   - Safe to delete: ✓

4. **fix/secure-plaintext-encrypted-embeddings-issue-75**
   - Status: Merged
   - Safe to delete: ✓

5. **claude/fix-failing-tests-EhWKK**
   - Status: Work superseded by PR #92
   - Local branch: DELETED ✓
   - Remote branch: Needs manual deletion (403 permission error)

## Branches with Unmerged Commits (Requires Review)

These branches contain commits not present in `main`. Review before deleting:

### 1. claude/add-premium-upgrade-widget-rpWZi (2 commits ahead)
```
e5c1f40 fix: replace dismissible banner with fixed premium upgrade widget
1b0fa0e feat: add premium upgrade widget in settings tab
```
**Action needed:** Review if this feature is still wanted

### 2. claude/complete-test-fixes-EhWKK (1 commit ahead)
```
9582b91 fix: embedding mocks now generate embeddings from enriched metadata
```
**Action needed:** Check if this was incorporated into main via another PR

### 3. claude/fix-embedding-mock-enriched-text-EhWKK (1 commit ahead)
```
fdad642 fix: update embedding mock to generate embeddings from enriched metadata
```
**Action needed:** Similar to #2, check if superseded

### 4. claude/fix-failing-tests-esN0W (2 commits ahead)
```
a79dc35 fix: use plaintext content for embedding generation in encrypted mode
ae74a44 fix: resolve test failures in encrypted embeddings implementation
```
**Action needed:** Review if this was incorporated elsewhere

## Cleanup Commands

### To delete fully merged remote branches:

```bash
# Delete merged branches
git push origin --delete claude/fix-google-signin-redirect-oj2nc
git push origin --delete claude/fix-hnsw-index-ready-state-EhWKK
git push origin --delete feat/atomic-persistence-issue-73
git push origin --delete fix/secure-plaintext-encrypted-embeddings-issue-75
git push origin --delete claude/fix-failing-tests-EhWKK
```

### To delete unmerged branches (after review):

```bash
# Only run these after confirming the work is not needed!
git push origin --delete claude/add-premium-upgrade-widget-rpWZi
git push origin --delete claude/complete-test-fixes-EhWKK
git push origin --delete claude/fix-embedding-mock-enriched-text-EhWKK
git push origin --delete claude/fix-failing-tests-esN0W
```

### To delete local tracking branches:

```bash
# After remote deletion, clean up local references
git fetch --prune
```

## Notes

- Branch deletion via git proxy returned 403 errors during automated cleanup
- This may require manual deletion through GitHub web UI or with proper credentials
- Some branches may be restricted based on session ID patterns
- Current working branch (claude/delete-unwanted-branches-9UAgX) should be deleted after this PR is merged

## Recommendation

1. **Immediate deletion:** All 5 fully merged branches
2. **After review:** Determine if the 4 unmerged branches contain work that needs to be preserved
3. **Check GitHub PRs:** Verify if any of the unmerged branches have open PRs
