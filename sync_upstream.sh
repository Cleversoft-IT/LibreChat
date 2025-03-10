#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Helper function for prompting yes/no questions
confirm() {
    local prompt="$1"
    local default="${2:-y}"
    
    while true; do
        if [ "$default" = "y" ]; then
            prompt_text="$prompt [Y/n] "
        else
            prompt_text="$prompt [y/N] "
        fi
        
        read -p "$prompt_text" response
        response=${response:-$default}
        
        case "$response" in
            [yY]|[yY][eE][sS]) return 0 ;;
            [nN]|[nN][oO]) return 1 ;;
            *) echo "Please answer yes or no." ;;
        esac
    done
}

# Function to handle errors
handle_error() {
    local error_msg="$1"
    local exit_code="$2"
    
    echo -e "\n${RED}Error: $error_msg${NC}"
    
    if confirm "Do you want to continue with the script?"; then
        return 0
    else
        echo -e "${YELLOW}Exiting script...${NC}"
        exit $exit_code
    fi
}

echo -e "${GREEN}Starting synchronization with upstream...${NC}"

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    
    if confirm "Would you like to initialize a git repository in the current directory?"; then
        git init
        echo -e "${GREEN}Git repository initialized.${NC}"
    else
        handle_error "Script requires a git repository to function." 1
    fi
fi

# Check if upstream remote exists
if ! git remote | grep -q "upstream"; then
    echo -e "${YELLOW}Warning: 'upstream' remote not found.${NC}"
    
    if confirm "Would you like to add the upstream remote (https://github.com/danny-avila/LibreChat.git)?"; then
        git remote add upstream https://github.com/danny-avila/LibreChat.git
        echo -e "${GREEN}Upstream remote added successfully.${NC}"
    else
        handle_error "Script requires the upstream remote to be configured." 1
    fi
fi

# Fetch updates from upstream first to see if there are any
echo -e "\n${GREEN}Fetching updates from upstream...${NC}"
if ! git fetch upstream; then
    handle_error "Failed to fetch from upstream." 2
fi

# Check if there are any updates to pull
UPDATES=$(git log HEAD..upstream/main --oneline)
if [ -z "$UPDATES" ]; then
    echo -e "\n${GREEN}Your fork is already up to date with upstream.${NC}"
    if confirm "There are no new updates. Do you want to continue anyway?"; then
        echo -e "${YELLOW}Continuing without updates...${NC}"
    else
        echo -e "${GREEN}Exiting script since there are no updates.${NC}"
        exit 0
    fi
else
    echo -e "\n${GREEN}Found the following updates from upstream:${NC}"
    echo "$UPDATES"
    if ! confirm "Do you want to sync these changes?"; then
        echo -e "${YELLOW}Sync cancelled by user.${NC}"
        exit 0
    fi
fi

# Save current branch name
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
echo -e "\n${GREEN}Current branch: ${CURRENT_BRANCH}${NC}"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "\n${YELLOW}Warning: You have uncommitted changes.${NC}"
    echo -e "Options:"
    echo -e "1. Stash changes and continue"
    echo -e "2. Commit changes and continue"
    echo -e "3. Abort sync"
    
    read -p "Choose an option [1-3]: " stash_option
    case $stash_option in
        1)
            echo -e "\n${GREEN}Stashing changes...${NC}"
            git stash save "Auto-stashed by sync_upstream script"
            STASHED=true
            ;;
        2)
            echo -e "\n${GREEN}Committing changes...${NC}"
            read -p "Enter commit message: " commit_msg
            git commit -am "${commit_msg:-Auto-committed by sync_upstream script}"
            ;;
        *)
            echo -e "\n${YELLOW}Sync aborted by user.${NC}"
            exit 0
            ;;
    esac
fi

# Delete sync branch if it exists
if git show-ref --verify --quiet refs/heads/sync_from_upstream; then
    if confirm "The 'sync_from_upstream' branch already exists. Delete it?"; then
        git branch -D sync_from_upstream || handle_error "Failed to delete existing sync branch." 3
    else
        handle_error "Cannot continue without removing the existing sync branch." 3
    fi
fi

# Create and checkout new sync branch
echo -e "\n${GREEN}Creating sync branch...${NC}"
if ! git checkout -b sync_from_upstream; then
    handle_error "Failed to create and checkout sync branch." 4
fi

# Fetch and merge from upstream
echo -e "\n${GREEN}Merging changes from upstream main...${NC}"
if ! git merge upstream/main; then
    echo -e "\n${YELLOW}Merge conflict detected.${NC}"
    echo -e "Options:"
    echo -e "1. Open merge tool to resolve conflicts"
    echo -e "2. Abort merge and exit"
    
    read -p "Choose an option [1-2]: " merge_option
    case $merge_option in
        1)
            echo -e "\n${GREEN}Opening merge tool...${NC}"
            git mergetool
            if confirm "Have you resolved all conflicts?"; then
                git commit -m "Merge upstream/main with conflict resolution"
            else
                git merge --abort
                git checkout "$CURRENT_BRANCH"
                git branch -D sync_from_upstream
                handle_error "Merge conflicts were not resolved." 5
            fi
            ;;
        *)
            git merge --abort
            git checkout "$CURRENT_BRANCH"
            git branch -D sync_from_upstream
            handle_error "Merge aborted by user." 5
            ;;
    esac
fi

# Checkout back to original branch
echo -e "\n${GREEN}Checking out back to ${CURRENT_BRANCH}...${NC}"
if ! git checkout "$CURRENT_BRANCH"; then
    handle_error "Failed to checkout original branch." 6
fi

# Merge changes
echo -e "\n${GREEN}Merging changes from sync branch...${NC}"
if ! git merge sync_from_upstream; then
    echo -e "\n${YELLOW}Merge conflict detected when merging to original branch.${NC}"
    echo -e "Options:"
    echo -e "1. Open merge tool to resolve conflicts"
    echo -e "2. Abort merge and keep sync branch for manual merge later"
    
    read -p "Choose an option [1-2]: " merge_option
    case $merge_option in
        1)
            echo -e "\n${GREEN}Opening merge tool...${NC}"
            git mergetool
            if confirm "Have you resolved all conflicts?"; then
                git commit -m "Merge sync_from_upstream with conflict resolution"
            else
                git merge --abort
                echo -e "${YELLOW}Sync branch 'sync_from_upstream' preserved for manual merging.${NC}"
                echo -e "${YELLOW}Please resolve conflicts manually and then delete the branch.${NC}"
                exit 7
            fi
            ;;
        *)
            git merge --abort
            echo -e "${YELLOW}Sync branch 'sync_from_upstream' preserved for manual merging.${NC}"
            echo -e "${YELLOW}Please resolve conflicts manually and then delete the branch.${NC}"
            exit 7
            ;;
    esac
fi

# Clean up - delete sync branch
echo -e "\n${GREEN}Cleaning up...${NC}"
if ! git branch -D sync_from_upstream; then
    handle_error "Failed to delete sync branch, but sync was completed." 0
fi

# Restore stashed changes if needed
if [ "${STASHED:-false}" = true ]; then
    if confirm "Would you like to re-apply your stashed changes?"; then
        echo -e "\n${GREEN}Applying stashed changes...${NC}"
        git stash pop || handle_error "Failed to apply stashed changes." 8
    fi
fi

echo -e "\n${GREEN}Sync completed successfully!${NC}"
echo -e "${GREEN}Your fork is now up to date with the upstream repository.${NC}"
