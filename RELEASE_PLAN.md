# Engram Extension Release Plan

This document outlines the steps to prepare and publish a new version of the Engram Chrome Extension.

## 1. Preparation

### 1.1 Update Version
Modify `packages/community/package.json` to bump the version number.
- Current version: `1.0.0`
- Target version: `1.1.0` (Minor release for new features)

### 1.2 Documentation
- Update `CHANGELOG.md` to document the changes (new features, improvements, bug fixes).

## 2. Verification

Ensure the codebase is stable before packaging.

```bash
# Run Linting
npm run lint

# Run Tests
npm run test
```

## 3. Building and Packaging

### 3.1 Build All Packages

For the monorepo structure, build all packages first:

```bash
# From repository root
npm run build --workspaces
```

### 3.2 Package the Extension

Generate the production-ready zip file for the Chrome Web Store.

```bash
# Navigate to community package
cd packages/community

# Build and Package
npm run package
```

This command runs `plasmo package`, which builds the extension and creates a zip file in the `build/` directory (e.g., `build/chrome-mv3-prod.zip`).

## 4. Validation

**IMPORTANT:** Always validate the package before submitting to Chrome Web Store.

```bash
# From repository root
./scripts/validate-chrome-release.sh
```

The validation script performs 12 comprehensive checks:
- ✅ Package configuration and version consistency
- ✅ Manifest V3 compliance
- ✅ Required icons (16x16, 32x32, 48x48, 64x64, 128x128)
- ✅ Background service worker
- ✅ Content scripts
- ✅ Package size (must be < 128 MB)
- ✅ No suspicious or unnecessary files

**Expected Output:**
```
✓ All critical checks passed!
Package is ready for Chrome Web Store submission
```

For detailed validation documentation, see: [docs/CHROME_RELEASE_VALIDATION.md](docs/CHROME_RELEASE_VALIDATION.md)

## 5. Publishing to Chrome Web Store

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

## 6. Post-Release
- Create a Git tag for the release:
  ```bash
  git tag v1.1.0
  git push origin v1.1.0
  ```
- Create a GitHub Release with the changelog.
- Update documentation to reference the new version.

---

## Action Items for Next Release

- [ ] Bump version in `packages/community/package.json` to `1.1.0`
- [ ] Update `CHANGELOG.md` with new changes
- [ ] Run tests: `npm run test` and `npm run lint`
- [ ] Build all packages: `npm run build --workspaces`
- [ ] Build and package extension: `cd packages/community && npm run package`
- [ ] **Validate package: `./scripts/validate-chrome-release.sh`**
- [ ] Test the packaged extension manually before publishing
- [ ] Submit to Chrome Web Store Developer Dashboard
