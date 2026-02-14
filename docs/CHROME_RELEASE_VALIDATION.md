# Chrome Web Store Release Validation Guide

## Overview

This document describes the validation process for releasing the Engram extension to the Chrome Web Store. The automated validation script ensures that all packages meet Chrome Web Store requirements before submission.

## Quick Start

To validate a Chrome Web Store release package:

```bash
# From the repository root
./scripts/validate-chrome-release.sh
```

## Build Process

### Prerequisites

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build All Packages** (Required for monorepo)
   ```bash
   npm run build --workspaces
   ```

### Creating the Release Package

1. **Navigate to Community Package**
   ```bash
   cd packages/community
   ```

2. **Build the Extension**
   ```bash
   npm run build
   ```

   This creates the production build in `build/chrome-mv3-prod/`

3. **Package the Extension**
   ```bash
   npm run package
   ```

   This creates `build/chrome-mv3-prod.zip` ready for Chrome Web Store submission.

## Validation Checks

The validation script (`scripts/validate-chrome-release.sh`) performs 12 comprehensive checks:

### 1. Package Configuration
- ✅ Verifies `package.json` exists and has a valid version number

### 2. Build Directory
- ✅ Confirms `build/chrome-mv3-prod/` directory exists
- ✅ Ensures production build was successful

### 3. Package File
- ✅ Verifies `build/chrome-mv3-prod.zip` exists
- ✅ Reports package size

### 4. Manifest Presence
- ✅ Confirms `manifest.json` is included in the zip package

### 5. Manifest Structure
- ✅ Validates manifest_version is 3 (Chrome Web Store requirement)
- ✅ Checks extension name is present
- ✅ Verifies extension version is set
- ✅ Confirms description exists and has appropriate length

### 6. Permissions
- ✅ Validates required permissions are declared (e.g., storage)
- ✅ Ensures permissions match extension functionality

### 7. Extension Icons
- ✅ Verifies all required icon sizes exist:
  - 16x16 pixels
  - 32x32 pixels
  - 48x48 pixels
  - 64x64 pixels
  - 128x128 pixels
- ✅ Confirms icon files referenced in manifest are included in package

### 8. Background Service Worker
- ✅ Validates background service worker is defined
- ✅ Confirms service worker file exists in package

### 9. Content Scripts
- ✅ Checks content scripts are properly configured
- ✅ Verifies all referenced JavaScript files are included in package

### 10. Package Size
- ✅ Ensures package size is under Chrome Web Store limit (128 MB)
- ✅ Reports actual package size in MB

### 11. Version Consistency
- ✅ Validates version numbers match between:
  - `package.json`
  - `manifest.json`
- ⚠️ Warns if versions are inconsistent

### 12. Clean Package
- ✅ Scans for suspicious or unnecessary files:
  - `node_modules/`
  - `.git/`
  - `.env` files
  - `.DS_Store`
  - Source maps (`*.map`)
  - Log files

## Validation Output

### Success Example

```
==================================
VALIDATION SUMMARY
==================================
Total checks: 12
Passed: 18
Failed: 0

✓ All critical checks passed!

Package is ready for Chrome Web Store submission:
  Location: build/chrome-mv3-prod.zip
  Version: 1.0.0
  Size: 1.8M

Next steps:
  1. Go to Chrome Web Store Developer Dashboard
     https://chrome.google.com/webstore/developer/dashboard
  2. Click on 'Engram' extension
  3. Click 'Package' → 'Upload new package'
  4. Select: build/chrome-mv3-prod.zip
  5. Click 'Submit for Review'
```

### Failure Example

If validation fails, the script will:
- Display specific errors with ✗ FAILED markers
- Show warnings with ⚠ WARNING markers
- Exit with code 1
- Prevent accidental submission of invalid packages

## Common Issues and Solutions

### Issue: "Production build directory not found"

**Solution:**
```bash
cd packages/community
npm run build
```

### Issue: "Package zip not found"

**Solution:**
```bash
cd packages/community
npm run package
```

### Issue: "Failed to resolve '@engram/core'"

**Solution:** Build all workspace packages first:
```bash
# From repository root
npm run build --workspaces
```

### Issue: "Version mismatch"

**Solution:** Ensure version numbers match in:
- `packages/community/package.json`
- Built manifest at `packages/community/build/chrome-mv3-prod/manifest.json`

### Issue: Network errors during build

**Note:** Errors like "Error fetching package information for plasmo" are non-critical. As long as the build completes with "🟢 DONE" or "Zip Package size: X MB", the package is valid.

## Chrome Web Store Requirements

### Manifest Version 3
Chrome Web Store now requires all extensions to use Manifest V3 (MV3). The validation script ensures:
- `manifest_version: 3` is set
- Service worker is used instead of background pages
- Permissions are properly declared

### File Size Limit
- Maximum package size: **128 MB**
- Current Engram package: **~1.8 MB** ✅

### Required Fields
The following fields are mandatory in `manifest.json`:
- `name` - Extension name
- `version` - Version number (must follow semantic versioning)
- `description` - Clear description of functionality
- `icons` - At least 128x128 icon required

## Manual Upload Process

After validation passes:

1. **Access Developer Dashboard**
   - URL: https://chrome.google.com/webstore/developer/dashboard
   - Sign in with the account that owns the Engram extension

2. **Select Extension**
   - Click on "Engram" from your items list

3. **Upload New Package**
   - Navigate to "Package" section
   - Click "Upload new package"
   - Select `packages/community/build/chrome-mv3-prod.zip`
   - Wait for upload to complete

4. **Update Store Listing** (Optional)
   - Update screenshots if UI changed
   - Revise description if features added
   - Update promotional images if needed

5. **Submit for Review**
   - Click "Submit for Review"
   - Provide explanation of changes (if prompted)
   - Wait for Chrome Web Store team to review (typically 1-3 business days)

## Automation Considerations

### Current State
- Build and packaging are automated via npm scripts
- Validation is automated via shell script
- **Upload to Chrome Web Store is manual**

### Future Enhancements
To implement automated Chrome Web Store uploads:

1. **Chrome Web Store Publish API**
   - Requires: Google Cloud Project with Chrome Web Store API enabled
   - Authentication: OAuth 2.0 credentials
   - Permissions: Developer account access

2. **Required Environment Variables**
   ```bash
   CHROME_EXTENSION_ID=<your-extension-id>
   CHROME_CLIENT_ID=<oauth-client-id>
   CHROME_CLIENT_SECRET=<oauth-client-secret>
   CHROME_REFRESH_TOKEN=<oauth-refresh-token>
   ```

3. **Implementation Options**
   - GitHub Actions workflow for automated publishing
   - npm package: `chrome-webstore-upload-cli`
   - Custom script using Chrome Web Store API

**Note:** Automated uploads are not implemented to maintain manual review and control over production releases.

## Testing Before Release

### Pre-Release Checklist

- [ ] All unit tests passing: `npm run test`
- [ ] All E2E tests passing: `npm run test:e2e`
- [ ] Linting clean: `npm run lint`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Manual testing on supported platforms:
  - [ ] ChatGPT (https://chatgpt.com)
  - [ ] Claude (https://claude.ai)
  - [ ] Perplexity (https://www.perplexity.ai)
  - [ ] Gemini (https://gemini.google.com)
- [ ] Validation script passes: `./scripts/validate-chrome-release.sh`
- [ ] Version numbers updated in:
  - [ ] `packages/community/package.json`
  - [ ] `CHANGELOG.md`
- [ ] Release notes prepared

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
  - **MAJOR**: Breaking changes or major feature overhauls
  - **MINOR**: New features, backward-compatible
  - **PATCH**: Bug fixes, backward-compatible

**Current Version:** 1.0.0

## Support and Troubleshooting

### Validation Script Issues

If the validation script fails:

1. Read the error messages carefully
2. Fix indicated issues
3. Re-run validation: `./scripts/validate-chrome-release.sh`
4. Repeat until all checks pass

### Chrome Web Store Rejection

If Chrome Web Store rejects the submission:

1. Review rejection email for specific issues
2. Address all mentioned problems
3. Update version number (increment PATCH)
4. Rebuild and revalidate
5. Resubmit with explanation of changes

### Common Rejection Reasons

- **Insufficient description**: Add more detail about features
- **Screenshot quality**: Provide high-resolution screenshots
- **Privacy policy**: Ensure privacy policy URL is valid and comprehensive
- **Permissions justification**: Clearly explain why each permission is needed
- **Functionality issues**: Extension doesn't work as described

## Additional Resources

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
- [Chrome Extension Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Web Store Publishing Guide](https://developer.chrome.com/docs/webstore/publish/)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/quality_guidelines/)

## Changelog Integration

After successful release:

1. Update `CHANGELOG.md` with release notes
2. Create Git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. Create GitHub Release with:
   - Tag: `v1.0.0`
   - Title: "Engram v1.0.0"
   - Description: Copy from CHANGELOG.md
   - Attach: `chrome-mv3-prod.zip` (optional)

## Monitoring Post-Release

After release is published:

1. **Monitor Chrome Web Store Reviews**
   - Check for user feedback
   - Respond to questions
   - Address reported issues

2. **Track Analytics** (if configured)
   - User count
   - Installation rate
   - Uninstall rate
   - Crash reports

3. **Plan Next Release**
   - Create issues for reported bugs
   - Prioritize feature requests
   - Update roadmap

---

**Last Updated:** 2026-02-14
**Script Version:** 1.0.0
**Maintained By:** Engram Development Team
