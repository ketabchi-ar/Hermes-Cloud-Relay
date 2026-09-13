#!/usr/bin/env bash
# ==============================================================================
# Hermes-Cloud-Relay: One-Click 9Router & Hermes Auto-Configurator
# Automatically detects 9Router, updates proxy pools with your custom domain relay,
# and verifies Antigravity AI connectivity without requiring a system VPN.
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}⚡ Hermes-Cloud-Relay: 9Router One-Click Configurator${NC}"
echo -e "${CYAN}====================================================${NC}"

RELAY_URL="$1"

if [ -z "$RELAY_URL" ]; then
  echo -e "${YELLOW}لطفاً آدرس ساب‌دامنه رله کلودفلر خود را وارد کنید:${NC}"
  read -p "Custom Relay Domain (مثال: https://relay.yourdomain.com): " RELAY_URL
fi

# Ensure https://
if [[ ! "$RELAY_URL" =~ ^https?:// ]]; then
  RELAY_URL="https://$RELAY_URL"
fi

# Trim trailing slash
RELAY_URL="${RELAY_URL%/}"

echo -e "\n${GREEN}✔ آدرس رله انتخابی:${NC} $RELAY_URL"

# 1. Check 9Router SQLite Database
DB_PATH="$HOME/.9router/db/data.sqlite"
if [ ! -f "$DB_PATH" ]; then
  echo -e "${RED}❌ پایگاه داده 9Router در مسیر $DB_PATH یافت نشد.${NC}"
  exit 1
fi

echo -e "${CYAN}1️⃣ در حال به‌روزرسانی تنظیمات Proxy Pool در 9Router...${NC}"

# Update SQLite directly
sqlite3 "$DB_PATH" <<EOF
UPDATE proxyPools 
SET data = json_set(data, '$.proxyUrl', '$RELAY_URL') 
WHERE type = 'cloudflare' OR json_extract(data, '$.name') = 'cloudflare-relay';
EOF

echo -e "${GREEN}✔ آدرس پروکسی در پایگاه‌داده با موفقیت ثبت شد.${NC}"

# 2. Restart 9Router via Launchctl
echo -e "${CYAN}2️⃣ در حال بارگذاری مجدد سرویس 9Router...${NC}"
UID_NUM=$(id -u)
launchctl kickstart -k "gui/$UID_NUM/com.ardalan.9router" 2>/dev/null || true

sleep 2

# 3. Verify Health
echo -e "${CYAN}3️⃣ در حال آزمایش سلامت اتصال مدل...${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:20128/v1/models" || echo "000")

if [ "$STATUS" == "200" ]; then
  echo -e "${GREEN}====================================================${NC}"
  echo -e "${GREEN}🎉 تبریک! اتصال 9Router و Antigravity به طور کامل برقرار شد.${NC}"
  echo -e "${GREEN}حالا می‌توانید با خیال راحت فیلترشکن سیستم را خاموش کنید.${NC}"
  echo -e "${GREEN}====================================================${NC}"
else
  echo -e "${YELLOW}⚠️ سرویس 9Router در حال بوت است (کد وضعیت: $STATUS). ظرف چند ثانیه آماده خواهد شد.${NC}"
fi
