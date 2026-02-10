# Engram Extension Release Plan

This document outlines the steps to prepare and publish a new version of the Engram Chrome Extension.

## 1. Preparation

### 1.1 Update Version
Modify `packages/community/package.json` to bump the version number.
- Current version: `1.0.0`
- Use [Semantic Versioning](https://semver.org/): MAJOR.MINOR.PATCH

### 1.2 Documentation
- Update `CHANGELOG.md` to document the changes in the new version.

## 2. Verification

Ensure the codebase is stable before packaging.

```bash
# Run Linting
npm run lint

# Run Type Checking
npm run typecheck

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
    -   Update description or screenshots if necessary.
5.  **Submit**:
    -   Click "Submit for Review".

## 5. Post-Release
- Create a Git tag for the release:
  ```bash
  git tag v<VERSION>
  git push origin v<VERSION>
  ```
- Create a GitHub Release with the changelog entry.

---

## Checklist

- [ ] Bump version in `packages/community/package.json`
- [ ] Update `CHANGELOG.md` with new version entry
- [ ] Run `npm run lint` and fix any issues
- [ ] Run `npm run typecheck` and fix any issues
- [ ] Run `npm run test` and ensure all tests pass
- [ ] Run `npm run package` and verify output
- [ ] Upload to Chrome Web Store
- [ ] Tag the release in git
- [ ] Create GitHub Release
