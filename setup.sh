#!/usr/bin/env bash
set -e

echo "=========================================="
echo "⚡ Hermes-Cloud-Relay Setup Wizard"
echo "=========================================="

# Check wrangler
if ! command -v npx &> /dev/null; then
  echo "❌ Node.js and npm are required. Please install Node.js first."
  exit 1
fi

echo "1️⃣ Checking Cloudflare Authentication..."
if ! npx wrangler whoami &> /dev/null; then
  echo "🔑 Please authenticate with Cloudflare in the opened browser window..."
  npx wrangler login
fi

echo "2️⃣ Creating Cloudflare KV Namespace for dynamic settings..."
KV_OUTPUT=$(npx wrangler kv namespace create RELAY_KV || true)
echo "$KV_OUTPUT"

KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | head -n1 | cut -d'"' -f2 || true)

if [ -n "$KV_ID" ]; then
  echo "Updating wrangler.toml with KV ID: $KV_ID"
  # Replace id in wrangler.toml
  sed -i '' "s/hermes_relay_kv/$KV_ID/g" wrangler.toml 2>/dev/null || sed -i "s/hermes_relay_kv/$KV_ID/g" wrangler.toml
fi

echo "3️⃣ Deploying Hermes-Cloud-Relay to Cloudflare Workers..."
npx wrangler deploy

echo "=========================================="
echo "🎉 Deployment successful!"
echo "👉 Open your worker URL and visit /admin to manage API keys & quotas."
echo "=========================================="
