#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}🛑 Stopping Memory Service...${NC}"

pm2 delete memory-service 2>/dev/null && echo -e "${GREEN}✓ memory-service stopped${NC}"
pm2 delete firebase-emulator 2>/dev/null && echo -e "${GREEN}✓ firebase-emulator stopped${NC}"

pkill -f 'nest start' 2>/dev/null
pkill -f 'firebase emulators:start' 2>/dev/null

echo -e "${GREEN}✓ Done${NC}"