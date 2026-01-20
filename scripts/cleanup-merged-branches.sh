#!/bin/bash

# Branch Cleanup Script
# Deletes branches that have been fully merged into main

set -e

echo "Branch Cleanup Script"
echo "====================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fully merged branches that are safe to delete
MERGED_BRANCHES=(
    "claude/fix-google-signin-redirect-oj2nc"
    "claude/fix-hnsw-index-ready-state-EhWKK"
    "feat/atomic-persistence-issue-73"
    "fix/secure-plaintext-encrypted-embeddings-issue-75"
    "claude/fix-failing-tests-EhWKK"
)

# Function to delete a remote branch
delete_remote_branch() {
    local branch=$1
    echo -n "Deleting remote branch: $branch ... "

    if git push origin --delete "$branch" 2>&1; then
        echo -e "${GREEN}✓ Deleted${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
}

# Main execution
echo "This script will delete the following MERGED branches:"
echo ""
for branch in "${MERGED_BRANCHES[@]}"; do
    echo "  - $branch"
done
echo ""

read -p "Do you want to proceed? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Deleting remote branches..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
FAILED_BRANCHES=()

for branch in "${MERGED_BRANCHES[@]}"; do
    if delete_remote_branch "$branch"; then
        ((SUCCESS_COUNT++))
    else
        ((FAIL_COUNT++))
        FAILED_BRANCHES+=("$branch")
    fi
done

echo ""
echo "Summary:"
echo "--------"
echo -e "${GREEN}Successfully deleted: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failed to delete: $FAIL_COUNT${NC}"

if [ $FAIL_COUNT -gt 0 ]; then
    echo ""
    echo "Failed branches:"
    for branch in "${FAILED_BRANCHES[@]}"; do
        echo "  - $branch"
    done
    echo ""
    echo -e "${YELLOW}Note: You may need to delete these manually via GitHub web UI${NC}"
    echo "      or with proper repository admin credentials."
fi

echo ""
echo "Cleaning up local references..."
git fetch --prune

echo ""
echo "Done!"
