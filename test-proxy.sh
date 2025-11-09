#!/bin/bash

set -e

echo "Testing OpenCode Proxy Setup"
echo "============================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local url=$1
    local expected_status=$2
    local description=$3

    echo -n "Testing $description... "

    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} (Status: $status)"
        return 0
    else
        echo -e "${RED}✗${NC} (Expected: $expected_status, Got: $status)"
        return 1
    fi
}

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 5

# Test proxy health
test_endpoint "http://localhost:3000/health" "200" "Proxy health check"

# Test proxy root
test_endpoint "http://localhost:3000/" "200" "Proxy root endpoint"

# Test OpenCode endpoints via proxy
test_endpoint "http://localhost:3000/api/opencode/app" "200" "OpenCode app endpoint"
test_endpoint "http://localhost:3000/api/opencode/config" "200" "OpenCode config endpoint"
test_endpoint "http://localhost:3000/api/opencode/agent" "200" "OpenCode agents list"

echo ""
echo "All tests completed!"
