# Engram Extension Release Plan

This document outlines the steps to prepare and publish a new version of the Engram Chrome Extension.

## 1. Preparation

### 1.1 Update Version
Modify `packages/community/package.json` to bump the version number.
- Current version: `0.1.0`
- Target version: `0.1.1` (Patch release for recent fixes)

### 1.2 Documentation
- Create/Update `CHANGELOG.md` to document the changes (Code cleanup, bug fixes).

## 2. Verification

Ensure the codebase is stable before packaging.

```bash
# Run Linting
npm run lint

# Run Tests
npm run test
```

## 3. Packaging

Generate the production-ready zip file for the Chrome Web Store.

```bash
# Build and Package
npm run package
```
This command runs `plasmo package`, which builds the extension and creates a zip file in the `build/` directory (e.g., `build/chrome-mv3-prod.zip`).

## 4. Publishing to Chrome Web Store

1.  **Login**: Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
2.  **Select Item**: Click on the existing Engram extension item (or "New Item" if first time).
3.  **Upload Package**:
    -   Click "Package" on the left menu.
    -   Click "Upload new package".
    -   Select the `.zip` file generated in Step 3.
4.  **Update Listings**:
    -   Update description or screenshots if necessary (optional for this release).
5.  **Submit**:
    -   Click "Submit for Review".

## 5. Post-Release
- Create a Git tag for the release:
  ```bash
  git tag v0.1.1
  git push origin v0.1.1
  ```
- Create a GitHub Release with the changelog.

---

## Action Items for Assistant

- [ ] Bump version in `packages/community/package.json` to `0.1.1`
- [ ] Create `CHANGELOG.md`
- [ ] Run `npm run package` and verify output
