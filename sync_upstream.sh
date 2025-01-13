#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting synchronization with upstream...${NC}"

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check if upstream remote exists
if ! git remote | grep -q "upstream"; then
    echo -e "${RED}Error: 'upstream' remote not found. Please add it first:${NC}"
    echo "git remote add upstream https://github.com/danny-avila/LibreChat.git"
    exit 1
fi

# Save current branch name
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)

# Delete sync branch if it exists
git branch -D sync_from_upstream 2>/dev/null || true

# Create and checkout new sync branch
echo -e "\n${GREEN}Creating sync branch...${NC}"
git checkout -b sync_from_upstream

# Fetch and merge from upstream
echo -e "\n${GREEN}Pulling changes from upstream main...${NC}"
git pull upstream main --no-rebase

# Checkout back to original branch
echo -e "\n${GREEN}Checking out back to ${CURRENT_BRANCH}...${NC}"
git checkout "$CURRENT_BRANCH"

# Merge changes
echo -e "\n${GREEN}Merging changes from sync branch...${NC}"
git merge sync_from_upstream

# Clean up - delete sync branch
echo -e "\n${GREEN}Cleaning up...${NC}"
git branch -D sync_from_upstream

echo -e "\n${GREEN}Sync completed successfully!${NC}"
