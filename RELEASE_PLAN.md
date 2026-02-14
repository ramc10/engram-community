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

Publishing is handled automatically by the GitHub Actions workflow in `.github/workflows/release.yml`.
Just push a version tag and the workflow will package, upload, and publish the extension.

```bash
git tag v1.1.0
git push origin v1.1.0
```

The workflow will:
1. Run linter and unit tests
2. Run `plasmo package` to produce the production zip
3. Upload the zip to the Chrome Web Store and auto-publish
4. Create a GitHub Release with notes from `CHANGELOG.md`
5. Attach the zip as a release asset

### One-time Setup: GitHub Secrets

Before the workflow can publish, add these four secrets to your GitHub repository
(**Settings → Secrets and variables → Actions → New repository secret**):

| Secret name | Where to get it |
|---|---|
| `CHROME_EXTENSION_ID` | Chrome Web Store Developer Dashboard → your extension's URL (the `…/detail/<ID>` part) |
| `CHROME_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials (see below) |
| `CHROME_CLIENT_SECRET` | Same OAuth 2.0 credential as above |
| `CHROME_REFRESH_TOKEN` | Generated via the OAuth flow (see below) |

#### Getting Chrome Web Store API credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create (or select) a project.
2. Enable the **Chrome Web Store API** for the project.
3. Create an **OAuth 2.0 Client ID** (Application type: **Desktop app**) and note the `client_id` and `client_secret`.
4. Run the following to obtain a `refresh_token`:
   ```bash
   npx chrome-webstore-upload-cli@3 get-token \
     --client-id YOUR_CLIENT_ID \
     --client-secret YOUR_CLIENT_SECRET
   ```
   A browser window will open — sign in with the account that owns the developer dashboard.
   Copy the printed `refresh_token` and save it as `CHROME_REFRESH_TOKEN`.
5. Grant your Google account access: in the Cloud Console, add your Google account as a **test user** under the OAuth consent screen.

#### Manual fallback (no automation)

If you need to publish without the workflow:
1. Login to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
2. Select the Engram extension item (or click "New Item" if first time).
3. Click **Package → Upload new package** and select the zip from step 3.
4. Update description or screenshots if necessary, then click **Submit for Review**.

## 5. Post-Release
- The GitHub Release is created automatically by the workflow.
- Update documentation to reference the new version if needed.
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
