#!/bin/bash

# Story Definition of Done Checker
# This script helps verify that a story meets the Definition of Done criteria

echo "🔍 EzEnv CLI - Story Definition of Done Checker"
echo "=============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2 (missing: $1)"
        return 1
    fi
}

run_check() {
    echo -n "Running: $1... "
    if eval "$2" &> /dev/null; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Run manually: $2"
        return 1
    fi
}

# Track failures
FAILED_CHECKS=0

echo "📋 Pre-Development Checks"
echo "------------------------"
echo -e "${YELLOW}⚠${NC}  Please verify manually:"
echo "  - Story requirements are clear"
echo "  - Acceptance criteria defined"
echo "  - Technical approach planned"
echo ""

echo "🔧 Development Environment"
echo "------------------------"
check_command "node" "Node.js installed" || ((FAILED_CHECKS++))
check_command "pnpm" "pnpm installed" || ((FAILED_CHECKS++))
check_command "git" "Git installed" || ((FAILED_CHECKS++))
echo ""

echo "🏗️  Build & Type Checks"
echo "----------------------"
run_check "TypeScript compilation" "pnpm typecheck" || ((FAILED_CHECKS++))
run_check "Build process" "pnpm build" || ((FAILED_CHECKS++))
echo ""

echo "🧹 Code Quality"
echo "--------------"
run_check "ESLint" "pnpm lint" || ((FAILED_CHECKS++))
echo ""

echo "🧪 Testing"
echo "---------"
run_check "Unit tests" "pnpm test" || ((FAILED_CHECKS++))

# Check test coverage
echo -n "Running: Test coverage... "
COVERAGE_OUTPUT=$(pnpm test -- --coverage 2>&1)
if [[ $? -eq 0 ]]; then
    # Try to extract coverage percentage
    COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep -E "All files.*\|.*\|" | awk '{print $10}')
    if [[ -n "$COVERAGE" ]]; then
        COVERAGE_NUM=${COVERAGE%\%}
        if (( $(echo "$COVERAGE_NUM >= 80" | bc -l) )); then
            echo -e "${GREEN}PASS${NC} ($COVERAGE)"
        else
            echo -e "${YELLOW}WARN${NC} ($COVERAGE - target is 80%)"
            ((FAILED_CHECKS++))
        fi
    else
        echo -e "${GREEN}PASS${NC}"
    fi
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED_CHECKS++))
fi
echo ""

echo "🔒 Security Checks"
echo "-----------------"
echo -n "Checking for hardcoded secrets... "
if grep -r -E "(password|secret|key|token)\s*=\s*['\"][^'\"]+['\"]" src/ --exclude-dir=node_modules &> /dev/null; then
    echo -e "${RED}FAIL${NC} (potential secrets found)"
    echo "  Run: grep -r -E \"(password|secret|key|token)\\s*=\\s*['\\\"][^'\\\"]+['\\\"]\" src/"
    ((FAILED_CHECKS++))
else
    echo -e "${GREEN}PASS${NC}"
fi
echo ""

echo "📚 Documentation"
echo "---------------"
echo -e "${YELLOW}⚠${NC}  Please verify manually:"
echo "  - README is up to date"
echo "  - API docs updated (if applicable)"
echo "  - Breaking changes documented"
echo ""

echo "🌿 Git Status"
echo "-------------"
# Check if working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}⚠${NC}  Working directory has uncommitted changes"
else
    echo -e "${GREEN}✓${NC} Working directory is clean"
fi

# Check if branch is up to date
BRANCH=$(git branch --show-current)
echo -e "Current branch: ${YELLOW}$BRANCH${NC}"

# Try to check if behind remote
git fetch origin &> /dev/null
BEHIND=$(git rev-list --count HEAD..origin/$BRANCH 2>/dev/null || echo "0")
if [[ "$BEHIND" -gt 0 ]]; then
    echo -e "${YELLOW}⚠${NC}  Branch is $BEHIND commits behind origin/$BRANCH"
else
    echo -e "${GREEN}✓${NC} Branch is up to date with origin"
fi
echo ""

echo "📊 Summary"
echo "---------"
if [[ $FAILED_CHECKS -eq 0 ]]; then
    echo -e "${GREEN}✅ All automated checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the manual checklist items above"
    echo "2. Create/update your Pull Request"
    echo "3. Request code review"
else
    echo -e "${RED}❌ $FAILED_CHECKS automated checks failed${NC}"
    echo ""
    echo "Please fix the issues above before proceeding."
fi
echo ""
echo "For the complete DoD checklist, see: STORY_DOD_CHECKLIST.md"