#!/usr/bin/env bash
# ==============================================================================
# Hermes-Cloud-Relay Installer for macOS & Linux (Ubuntu, Debian, Fedora, Arch)
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}⚡ Hermes-Cloud-Relay Installer (macOS & Linux)${NC}"
echo -e "${CYAN}============================================================${NC}"

# Check python3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ پایتون ۳ یافت نشد. لطفاً python3 را نصب کنید (sudo apt install python3)${NC}"
    exit 1
fi

TS=$(date +%s)
SCRIPT_URL="https://raw.githubusercontent.com/ketabchi-ar/Hermes-Cloud-Relay/main/auto_deploy.py?ts=${TS}"

echo -e "${YELLOW}📥 در حال دریافت و اجرای اسکریپت خودکار...${NC}"
curl -fsSL "${SCRIPT_URL}" | python3 -
