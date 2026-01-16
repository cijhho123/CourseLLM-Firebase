#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Memory Service...${NC}"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$SCRIPT_DIR/../../.."
SERVICE_DIR="$SCRIPT_DIR/.."

# Create log directory
LOG_DIR="$SCRIPT_DIR/.logs"
mkdir -p "$LOG_DIR"

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}pm2 not found, installing globally...${NC}"
    npm install -g pm2
fi

# Stop any existing processes first
echo -e "${BLUE}Cleaning up existing processes...${NC}"
pm2 delete memory-service 2>/dev/null
pm2 delete firebase-emulator 2>/dev/null
pkill -f 'nest start' 2>/dev/null
pkill -f 'firebase emulators:start' 2>/dev/null
sleep 1

# Start Firebase emulator with pm2
echo -e "${GREEN}Starting Firebase Emulator...${NC}"
cd "$ROOT_DIR"
pm2 start "firebase emulators:start --only dataconnect" \
    --name firebase-emulator \
    --output "$LOG_DIR/emulator.log" \
    --error "$LOG_DIR/emulator-error.log" \
    --time

# Wait for emulator to be ready
echo -e "${BLUE}Waiting for emulator to be ready...${NC}"
MAX_WAIT=30
COUNTER=0
while [ $COUNTER -lt $MAX_WAIT ]; do
    if pm2 logs firebase-emulator --nostream --lines 50 2>/dev/null | grep -q "All emulators ready"; then
        echo -e "${GREEN}✓ Emulator is ready!${NC}"
        break
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
    echo -ne "\r${YELLOW}  Waiting... ${COUNTER}s${NC}"
done
echo ""

if [ $COUNTER -eq $MAX_WAIT ]; then
    echo -e "${YELLOW}⚠ Emulator may not be fully ready, continuing anyway...${NC}"
fi

# Start dev server with pm2
echo -e "${GREEN}Starting Dev Server...${NC}"
cd "$SERVICE_DIR"
pm2 start "npx nest start --watch" \
    --name memory-service \
    --output "$LOG_DIR/dev.log" \
    --error "$LOG_DIR/dev-error.log" \
    --time

sleep 2

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Both services are running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
pm2 list
echo ""
echo -e "${BLUE}Run ${YELLOW}npm run monitor${BLUE} to see CPU/memory stats${NC}"