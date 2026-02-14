#!/bin/bash

# Chrome Web Store Release Validation Script
# This script validates that the extension package is ready for Chrome Web Store submission

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Helper functions
check_start() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "\n${YELLOW}[CHECK $TOTAL_CHECKS]${NC} $1..."
}

check_pass() {
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    echo -e "${GREEN}✓ PASSED:${NC} $1"
}

check_fail() {
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo -e "${RED}✗ FAILED:${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠ WARNING:${NC} $1"
}

# Navigate to community package directory
cd "$(dirname "$0")/../packages/community" || exit 1

echo "=================================="
echo "Chrome Web Store Release Validator"
echo "=================================="

# Check 1: Verify package.json exists and has version
check_start "Verifying package.json exists"
if [ -f "package.json" ]; then
    VERSION=$(node -p "require('./package.json').version")
    check_pass "package.json exists with version $VERSION"
else
    check_fail "package.json not found"
    exit 1
fi

# Check 2: Verify build directory exists
check_start "Checking build directory"
if [ -d "build/chrome-mv3-prod" ]; then
    check_pass "Production build directory exists"
else
    check_fail "Production build directory not found. Run 'npm run build' first."
    exit 1
fi

# Check 3: Verify package zip exists
check_start "Checking for packaged zip file"
if [ -f "build/chrome-mv3-prod.zip" ]; then
    ZIP_SIZE=$(du -h "build/chrome-mv3-prod.zip" | cut -f1)
    check_pass "Package zip exists (size: $ZIP_SIZE)"
else
    check_fail "Package zip not found. Run 'npm run package' first."
    exit 1
fi

# Check 4: Validate manifest.json exists in zip
check_start "Validating manifest.json in package"
if unzip -l build/chrome-mv3-prod.zip | grep -q "manifest.json"; then
    check_pass "manifest.json found in package"
else
    check_fail "manifest.json missing from package"
    exit 1
fi

# Check 5: Extract and validate manifest.json structure
check_start "Validating manifest.json structure"
TEMP_DIR=$(mktemp -d)
unzip -q -j build/chrome-mv3-prod.zip manifest.json -d "$TEMP_DIR"

MANIFEST_VERSION=$(node -p "require('$TEMP_DIR/manifest.json').manifest_version")
EXTENSION_VERSION=$(node -p "require('$TEMP_DIR/manifest.json').version")
EXTENSION_NAME=$(node -p "require('$TEMP_DIR/manifest.json').name")
EXTENSION_DESC=$(node -p "require('$TEMP_DIR/manifest.json').description")

if [ "$MANIFEST_VERSION" = "3" ]; then
    check_pass "Manifest version 3 (required by Chrome Web Store)"
else
    check_fail "Invalid manifest_version: $MANIFEST_VERSION (must be 3)"
fi

if [ -n "$EXTENSION_NAME" ]; then
    check_pass "Extension name: $EXTENSION_NAME"
else
    check_fail "Extension name is missing"
fi

if [ -n "$EXTENSION_VERSION" ]; then
    check_pass "Extension version: $EXTENSION_VERSION"
else
    check_fail "Extension version is missing"
fi

if [ -n "$EXTENSION_DESC" ]; then
    check_pass "Extension description exists (${#EXTENSION_DESC} chars)"
else
    check_fail "Extension description is missing"
fi

# Check 6: Validate required permissions
check_start "Validating permissions"
PERMISSIONS=$(node -p "JSON.stringify(require('$TEMP_DIR/manifest.json').permissions || [])")
if echo "$PERMISSIONS" | grep -q "storage"; then
    check_pass "Storage permission present"
else
    check_warn "Storage permission missing"
fi

# Check 7: Validate icons exist
check_start "Validating extension icons"
REQUIRED_ICONS="16 32 48 64 128"
MISSING_ICONS=""

for size in $REQUIRED_ICONS; do
    ICON_FILE=$(node -p "require('$TEMP_DIR/manifest.json').icons['$size'] || ''")
    if [ -n "$ICON_FILE" ]; then
        if unzip -l build/chrome-mv3-prod.zip | grep -q "$ICON_FILE"; then
            check_pass "Icon ${size}x${size} exists: $ICON_FILE"
        else
            check_fail "Icon ${size}x${size} referenced but file missing: $ICON_FILE"
            MISSING_ICONS="$MISSING_ICONS $size"
        fi
    else
        check_warn "Icon ${size}x${size} not defined in manifest"
        MISSING_ICONS="$MISSING_ICONS $size"
    fi
done

# Check 8: Validate background service worker
check_start "Validating background service worker"
BG_WORKER=$(node -p "require('$TEMP_DIR/manifest.json').background?.service_worker || ''")
if [ -n "$BG_WORKER" ]; then
    if unzip -l build/chrome-mv3-prod.zip | grep -q "$BG_WORKER"; then
        check_pass "Background service worker exists: $BG_WORKER"
    else
        check_fail "Background service worker referenced but file missing: $BG_WORKER"
    fi
else
    check_warn "No background service worker defined"
fi

# Check 9: Validate content scripts
check_start "Validating content scripts"
CONTENT_SCRIPTS_COUNT=$(node -p "(require('$TEMP_DIR/manifest.json').content_scripts || []).length")
if [ "$CONTENT_SCRIPTS_COUNT" -gt 0 ]; then
    check_pass "Content scripts defined: $CONTENT_SCRIPTS_COUNT"

    # Validate content script files exist
    CONTENT_JS=$(node -p "JSON.stringify(require('$TEMP_DIR/manifest.json').content_scripts[0]?.js || [])")
    echo "$CONTENT_JS" | grep -o '[^"]*\.js' | while read -r js_file; do
        if unzip -l build/chrome-mv3-prod.zip | grep -q "$js_file"; then
            check_pass "Content script exists: $js_file"
        else
            check_fail "Content script referenced but file missing: $js_file"
        fi
    done
else
    check_warn "No content scripts defined"
fi

# Check 10: Validate package size
check_start "Validating package size"
ZIP_SIZE_BYTES=$(stat -f%z "build/chrome-mv3-prod.zip" 2>/dev/null || stat -c%s "build/chrome-mv3-prod.zip" 2>/dev/null)
MAX_SIZE=$((128 * 1024 * 1024)) # 128 MB Chrome Web Store limit

if [ "$ZIP_SIZE_BYTES" -lt "$MAX_SIZE" ]; then
    ZIP_SIZE_MB=$(echo "scale=2; $ZIP_SIZE_BYTES / 1024 / 1024" | bc)
    check_pass "Package size ($ZIP_SIZE_MB MB) is within Chrome Web Store limit (128 MB)"
else
    ZIP_SIZE_MB=$(echo "scale=2; $ZIP_SIZE_BYTES / 1024 / 1024" | bc)
    check_fail "Package size ($ZIP_SIZE_MB MB) exceeds Chrome Web Store limit (128 MB)"
fi

# Check 11: Validate version consistency
check_start "Validating version consistency"
PACKAGE_JSON_VERSION=$(node -p "require('./package.json').version")
if [ "$PACKAGE_JSON_VERSION" = "$EXTENSION_VERSION" ]; then
    check_pass "Version consistent across package.json and manifest.json: $EXTENSION_VERSION"
else
    check_warn "Version mismatch: package.json ($PACKAGE_JSON_VERSION) vs manifest.json ($EXTENSION_VERSION)"
fi

# Check 12: Check for suspicious files
check_start "Checking for suspicious or unnecessary files"
SUSPICIOUS_PATTERNS="node_modules .git .env .DS_Store *.map *.log"
FOUND_SUSPICIOUS=""

for pattern in $SUSPICIOUS_PATTERNS; do
    if unzip -l build/chrome-mv3-prod.zip | grep -q "$pattern"; then
        check_warn "Found potentially unnecessary files matching: $pattern"
        FOUND_SUSPICIOUS="$FOUND_SUSPICIOUS $pattern"
    fi
done

if [ -z "$FOUND_SUSPICIOUS" ]; then
    check_pass "No suspicious files detected"
fi

# Cleanup
rm -rf "$TEMP_DIR"

# Final summary
echo ""
echo "=================================="
echo "VALIDATION SUMMARY"
echo "=================================="
echo "Total checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo "Package is ready for Chrome Web Store submission:"
    echo "  Location: build/chrome-mv3-prod.zip"
    echo "  Version: $EXTENSION_VERSION"
    echo "  Size: $ZIP_SIZE"
    echo ""
    echo "Next steps:"
    echo "  1. Go to Chrome Web Store Developer Dashboard"
    echo "     https://chrome.google.com/webstore/developer/dashboard"
    echo "  2. Click on 'Engram' extension"
    echo "  3. Click 'Package' → 'Upload new package'"
    echo "  4. Select: build/chrome-mv3-prod.zip"
    echo "  5. Click 'Submit for Review'"
    exit 0
else
    echo -e "${RED}✗ Validation failed with $FAILED_CHECKS error(s)${NC}"
    echo ""
    echo "Please fix the errors above before submitting to Chrome Web Store."
    exit 1
fi
