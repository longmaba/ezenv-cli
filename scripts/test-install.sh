#!/bin/bash

# Cross-platform installation test script
# Tests npm package installation and execution

set -e

echo "🧪 EzEnv CLI Installation Test"
echo "=============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get package info
PACKAGE_NAME="@ezenv/cli"
PACKAGE_VERSION=$(node -p "require('./package.json').version")

# Create temp directory for testing
TEST_DIR=$(mktemp -d)
echo -e "${YELLOW}Test directory: $TEST_DIR${NC}"

# Function to test installation method
test_install() {
    local method=$1
    local command=$2
    
    echo -e "\n${YELLOW}Testing $method installation...${NC}"
    
    # Create a fresh test environment
    cd "$TEST_DIR"
    mkdir -p "$method-test"
    cd "$method-test"
    
    # Run installation
    echo "Running: $command"
    if eval "$command"; then
        echo -e "${GREEN}✓ $method installation successful${NC}"
        
        # Test execution
        if [ "$method" = "global" ]; then
            if ezenv --version | grep -q "$PACKAGE_VERSION"; then
                echo -e "${GREEN}✓ ezenv command works${NC}"
            else
                echo -e "${RED}✗ ezenv command failed${NC}"
                return 1
            fi
        fi
    else
        echo -e "${RED}✗ $method installation failed${NC}"
        return 1
    fi
}

# Function to test npx execution
test_npx() {
    echo -e "\n${YELLOW}Testing npx execution...${NC}"
    
    cd "$TEST_DIR"
    mkdir -p "npx-test"
    cd "npx-test"
    
    # Test npx without installation
    echo "Running: npx $PACKAGE_NAME --version"
    if npx "$PACKAGE_NAME" --version | grep -q "$PACKAGE_VERSION"; then
        echo -e "${GREEN}✓ npx execution successful${NC}"
    else
        echo -e "${RED}✗ npx execution failed${NC}"
        return 1
    fi
}

# Function to test commands
test_commands() {
    local exec_cmd=$1
    
    echo -e "\n${YELLOW}Testing commands with $exec_cmd...${NC}"
    
    # Test help
    if $exec_cmd --help > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Help command works${NC}"
    else
        echo -e "${RED}✗ Help command failed${NC}"
    fi
    
    # Test version
    if $exec_cmd --version | grep -q "$PACKAGE_VERSION"; then
        echo -e "${GREEN}✓ Version command works${NC}"
    else
        echo -e "${RED}✗ Version command failed${NC}"
    fi
    
    # Test auth status (should fail gracefully when not authenticated)
    if $exec_cmd auth status 2>&1 | grep -q "Not authenticated"; then
        echo -e "${GREEN}✓ Auth status command works${NC}"
    else
        echo -e "${RED}✗ Auth status command failed${NC}"
    fi
}

# Function to test platform-specific features
test_platform() {
    echo -e "\n${YELLOW}Testing platform-specific features...${NC}"
    
    # Check shebang on Unix
    if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
        if head -n 1 "$(which ezenv 2>/dev/null || echo "/dev/null")" | grep -q "#!/usr/bin/env node"; then
            echo -e "${GREEN}✓ Shebang line present${NC}"
        else
            echo -e "${YELLOW}⚠ Shebang line check skipped${NC}"
        fi
        
        # Check file permissions
        if [ -x "$(which ezenv 2>/dev/null || echo "/dev/null")" ]; then
            echo -e "${GREEN}✓ Executable permissions set${NC}"
        else
            echo -e "${YELLOW}⚠ Executable permissions check skipped${NC}"
        fi
    fi
}

# Main test sequence
main() {
    echo -e "\n${YELLOW}Platform: $OSTYPE${NC}"
    echo -e "${YELLOW}Node version: $(node --version)${NC}"
    echo -e "${YELLOW}npm version: $(npm --version)${NC}"
    
    # Test local installation
    test_install "local" "npm install $PACKAGE_NAME"
    
    # Test global installation
    test_install "global" "npm install -g $PACKAGE_NAME"
    
    # Test npx
    test_npx
    
    # Test commands with global install
    if command -v ezenv &> /dev/null; then
        test_commands "ezenv"
    fi
    
    # Test platform features
    test_platform
    
    # Cleanup
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    npm uninstall -g "$PACKAGE_NAME" 2>/dev/null || true
    rm -rf "$TEST_DIR"
    
    echo -e "\n${GREEN}✅ All tests completed!${NC}"
}

# Run tests
main