/**
 * Hermes-Cloud-Relay
 * Serverless Multi-Provider AI Gateway & Reverse Proxy on Cloudflare Workers
 * Features:
 * - Beautiful Web Admin UI (/admin)
 * - Multi-Account Key Pool & Automatic Quota Failover (HTTP 429 / Quota Exceeded)
 * - Support for Google Gemini, OpenAI / Codex, Anthropic Claude
 * - Secure Client Token authentication
 */

const DEFAULT_CONFIG = {
  adminPassword: "change_me_hermes",
  clientTokens: ["hermes_default_token"],
  providers: {
    gemini: {
      name: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com",
      pathPrefix: "/gemini",
      keys: [], // array of { id, key, label, failedCount, disabledUntil }
      currentIndex: 0,
      enabled: true,
    },
    openai: {
      name: "OpenAI / Codex",
      baseUrl: "https://api.openai.com",
      pathPrefix: "/openai",
      keys: [],
      currentIndex: 0,
      enabled: true,
    },
    claude: {
      name: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com",
      pathPrefix: "/claude",
      keys: [],
      currentIndex: 0,
      enabled: true,
    }
  },
  stats: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    failoverCount: 0,
  }
};

async function getConfig(env) {
  if (!env.RELAY_KV) {
    return DEFAULT_CONFIG;
  }
  const raw = await env.RELAY_KV.get("config", "json");
  if (!raw) {
    // Seed initial config
    const initConfig = { ...DEFAULT_CONFIG };
    if (env.ADMIN_PASSWORD) initConfig.adminPassword = env.ADMIN_PASSWORD;
    if (env.DEFAULT_RELAY_KEY) initConfig.clientTokens = [env.DEFAULT_RELAY_KEY];
    await env.RELAY_KV.put("config", JSON.stringify(initConfig));
    return initConfig;
  }
  return raw;
}

async function saveConfig(env, config) {
  if (env.RELAY_KV) {
    await env.RELAY_KV.put("config", JSON.stringify(config));
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

// -------------------------------------------------------------
// Core Proxy Handler with Smart Key Rotation & Failover
// -------------------------------------------------------------
async function handleProxy(request, env, providerKey, config) {
  const provider = config.providers[providerKey];
  if (!provider || !provider.enabled) {
    return jsonResponse({ error: `Provider '${providerKey}' is disabled or not found` }, 404);
  }

  const keys = provider.keys || [];
  const now = Date.now();
  const availableKeys = keys.filter(k => !k.disabledUntil || k.disabledUntil < now);

  if (availableKeys.length === 0 && keys.length > 0) {
    return jsonResponse({ error: `All API keys for ${provider.name} are temporarily in cool-down (quota exceeded)` }, 429);
  }

  const url = new URL(request.url);
  // Strip provider prefix: /gemini/v1beta/models -> /v1beta/models
  const upstreamPath = url.pathname.replace(new RegExp(`^${provider.pathPrefix}`), "") || "/";
  const upstreamBase = new URL(provider.baseUrl);

  // If no keys configured in relay, forward incoming headers/query as transparent proxy
  const keysToTry = availableKeys.length > 0 ? availableKeys : [{ key: null }];
  let lastError = null;

  for (let attempt = 0; attempt < keysToTry.length; attempt++) {
    const activeKeyObj = keysToTry[attempt];
    const targetUrl = new URL(upstreamPath + url.search, upstreamBase);

    // Build upstream headers
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.delete("host");
    upstreamHeaders.delete("x-relay-key");
    upstreamHeaders.delete("cf-connecting-ip");
    upstreamHeaders.delete("cf-ipcountry");
    upstreamHeaders.delete("cf-ray");

    // Inject active API key if managed
    if (activeKeyObj && activeKeyObj.key) {
      if (providerKey === "gemini") {
        // Gemini allows key in query param or x-goog-api-key header
        upstreamHeaders.set("x-goog-api-key", activeKeyObj.key);
        // Also support queries that had key=...
        if (targetUrl.searchParams.has("key")) {
          targetUrl.searchParams.set("key", activeKeyObj.key);
        }
      } else if (providerKey === "openai") {
        upstreamHeaders.set("Authorization", `Bearer ${activeKeyObj.key}`);
      } else if (providerKey === "claude") {
        upstreamHeaders.set("x-api-key", activeKeyObj.key);
        if (!upstreamHeaders.has("anthropic-version")) {
          upstreamHeaders.set("anthropic-version", "2023-06-01");
        }
      }
    }

    // Clone request body for potential retry
    let body = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.clone().arrayBuffer();
    }

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body: body,
        redirect: "follow",
      });

      // Check if Quota Exceeded or Rate Limited (429)
      if (response.status === 429 || (response.status === 403 && providerKey === "gemini")) {
        const errText = await response.clone().text();
        if (errText.includes("RESOURCE_EXHAUSTED") || errText.includes("quota") || response.status === 429) {
          if (activeKeyObj && activeKeyObj.key) {
            activeKeyObj.disabledUntil = Date.now() + 5 * 60 * 1000; // 5 min cooldown
            activeKeyObj.failedCount = (activeKeyObj.failedCount || 0) + 1;
            config.stats.failoverCount = (config.stats.failoverCount || 0) + 1;
            await saveConfig(env, config);
          }
          lastError = { status: response.status, body: errText };
          // Try next key if available
          continue;
        }
      }

      // Success
      config.stats.totalRequests = (config.stats.totalRequests || 0) + 1;
      config.stats.successfulRequests = (config.stats.successfulRequests || 0) + 1;
      await saveConfig(env, config);

      const respHeaders = new Headers(response.headers);
      Object.entries(corsHeaders()).forEach(([k, v]) => respHeaders.set(k, v));
      return new Response(response.body, {
        status: response.status,
        headers: respHeaders,
      });

    } catch (err) {
      lastError = { status: 502, body: err.message };
    }
  }

  // If all attempts failed
  config.stats.failedRequests = (config.stats.failedRequests || 0) + 1;
  await saveConfig(env, config);

  return jsonResponse({
    error: "All upstream API keys failed or quota exceeded",
    detail: lastError,
  }, lastError ? lastError.status : 502);
}

// -------------------------------------------------------------
// Authentication Check for Relay Proxy Requests
// -------------------------------------------------------------
function isAuthorized(request, config) {
  const tokens = config.clientTokens || [];
  if (tokens.length === 0) return true; // Open relay if no tokens defined

  const authHeader = request.headers.get("Authorization") || "";
  const relayHeader = request.headers.get("x-relay-key") || "";
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("relay_key") || "";

  const token = relayHeader || queryToken || authHeader.replace(/^Bearer\s+/i, "");
  return tokens.includes(token);
}

// -------------------------------------------------------------
// Web Dashboard HTML & Client-side App (/admin)
// -------------------------------------------------------------
function renderAdminDashboard() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hermes Cloud Relay | داشبورد هوشمند</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Vazirmatn', -apple-system, sans-serif; }
    [dir="ltr"] { direction: ltr; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <!-- Auth Modal -->
  <div id="authModal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-bold text-lg text-white">⚡</div>
        <div>
          <h2 class="font-bold text-lg">Hermes Cloud Relay</h2>
          <p class="text-xs text-slate-400">ورود به پنل مدیریت سرورلس</p>
        </div>
      </div>
      <form id="authForm" onsubmit="event.preventDefault(); login();">
        <input type="password" id="adminPassInput" placeholder="رمز عبور ادمین" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition mb-4 text-center">
        <button type="submit" class="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-orange-500/20">ورود</button>
      </form>
    </div>
  </div>

  <!-- Main Container -->
  <div class="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
    <!-- Header -->
    <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-orange-500/20">⚡</div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-black tracking-tight">Hermes Cloud Relay</h1>
            <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">فعال و آماده</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">درگاه هوشمند اتصال هوش مصنوعی بدون نیاز به فیلترشکن با مدیریت چرخش اکانت‌ها</p>
        </div>
      </div>
      <div class="flex items-center gap-2 self-end sm:self-auto">
        <button onclick="logout()" class="text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 px-3 py-2 rounded-xl transition text-slate-400 hover:text-white">خروج</button>
      </div>
    </header>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
        <p class="text-xs text-slate-400 mb-1">کل درخواست‌ها</p>
        <p id="statTotal" class="text-2xl font-black text-white">0</p>
      </div>
      <div class="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
        <p class="text-xs text-emerald-400 mb-1">درخواست‌های موفق</p>
        <p id="statSuccess" class="text-2xl font-black text-emerald-400">0</p>
      </div>
      <div class="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
        <p class="text-xs text-rose-400 mb-1">ناموفق / سقف مصرف</p>
        <p id="statFailed" class="text-2xl font-black text-rose-400">0</p>
      </div>
      <div class="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
        <p class="text-xs text-amber-400 mb-1">تعویض خودکار اکانت (Failover)</p>
        <p id="statFailover" class="text-2xl font-black text-amber-400">0</p>
      </div>
    </div>

    <!-- Provider Tabs -->
    <div class="space-y-4">
      <div class="flex border-b border-slate-800 gap-4 text-sm font-bold">
        <button onclick="selectTab('gemini')" id="tab-gemini" class="pb-3 border-b-2 border-amber-500 text-amber-400">Google Gemini</button>
        <button onclick="selectTab('openai')" id="tab-openai" class="pb-3 border-b-2 border-transparent text-slate-400 hover:text-slate-200">OpenAI / Codex</button>
        <button onclick="selectTab('claude')" id="tab-claude" class="pb-3 border-b-2 border-transparent text-slate-400 hover:text-slate-200">Anthropic Claude</button>
        <button onclick="selectTab('tokens')" id="tab-tokens" class="pb-3 border-b-2 border-transparent text-slate-400 hover:text-slate-200">کلیدهای دسترسی هرمس</button>
      </div>

      <!-- Tab Content Area -->
      <div id="tabContent" class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
        <!-- Rendered dynamically -->
      </div>
    </div>
  </div>

  <script>
    let activeTab = 'gemini';
    let currentConfig = null;
    let authPass = sessionStorage.getItem('relay_admin_pass') || '';

    if (authPass) {
      document.getElementById('authModal').classList.add('hidden');
      loadData();
    }

    async function login() {
      const pass = document.getElementById('adminPassInput').value;
      if (!pass) return;
      authPass = pass;
      sessionStorage.setItem('relay_admin_pass', pass);
      const ok = await loadData();
      if (ok) {
        document.getElementById('authModal').classList.add('hidden');
      } else {
        alert('رمز عبور اشتباه است یا خطایی رخ داد.');
      }
    }

    function logout() {
      sessionStorage.removeItem('relay_admin_pass');
      location.reload();
    }

    async function loadData() {
      try {
        const res = await fetch('/admin/api/config', {
          headers: { 'Authorization': 'Bearer ' + authPass }
        });
        if (!res.ok) return false;
        currentConfig = await res.json();
        renderStats();
        renderActiveTab();
        return true;
      } catch(e) {
        return false;
      }
    }

    function renderStats() {
      if (!currentConfig || !currentConfig.stats) return;
      document.getElementById('statTotal').innerText = currentConfig.stats.totalRequests || 0;
      document.getElementById('statSuccess').innerText = currentConfig.stats.successfulRequests || 0;
      document.getElementById('statFailed').innerText = currentConfig.stats.failedRequests || 0;
      document.getElementById('statFailover').innerText = currentConfig.stats.failoverCount || 0;
    }

    function selectTab(tab) {
      activeTab = tab;
      ['gemini', 'openai', 'claude', 'tokens'].forEach(t => {
        const el = document.getElementById('tab-' + t);
        if (t === tab) {
          el.className = 'pb-3 border-b-2 border-amber-500 text-amber-400';
        } else {
          el.className = 'pb-3 border-b-2 border-transparent text-slate-400 hover:text-slate-200';
        }
      });
      renderActiveTab();
    }

    function renderActiveTab() {
      const container = document.getElementById('tabContent');
      if (!currentConfig) return;

      if (activeTab === 'tokens') {
        const tokens = currentConfig.clientTokens || [];
        container.innerHTML = \`
          <div class="space-y-4">
            <div>
              <h3 class="text-base font-bold text-white">کلیدهای احراز هویت اتصال به رله</h3>
              <p class="text-xs text-slate-400 mt-1">این کلید را در هدر x-relay-key یا متغیرهای کلاینت هرمس خود قرار دهید تا دسترسی امن برقرار شود.</p>
            </div>
            <div class="flex gap-2">
              <input type="text" id="newTokenInput" dir="ltr" placeholder="توکن جدید (مثلاً: secret_token_xyz)" class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm">
              <button onclick="addToken()" class="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition">افزودن</button>
            </div>
            <div class="space-y-2 pt-2">
              \${tokens.map((t, idx) => \`
                <div class="flex items-center justify-between bg-slate-950/80 border border-slate-800 px-4 py-3 rounded-xl">
                  <span dir="ltr" class="text-xs text-amber-300 font-mono">\${t}</span>
                  <button onclick="deleteToken(\${idx})" class="text-xs text-rose-400 hover:text-rose-300">حذف</button>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
        return;
      }

      const p = currentConfig.providers[activeTab];
      const keys = p.keys || [];
      const now = Date.now();

      // Help Guides per provider
      const guides = {
        gemini: {
          title: "راهنمای دریافت رایگان کلید Google Gemini",
          link: "https://aistudio.google.com/app/apikey",
          btnText: "ورود به Google AI Studio و دریافت API Key",
          steps: [
            "روی دکمه زیر کلیک کنید و با جیمیل خود وارد Google AI Studio شوید.",
            "روی دکمه آبی Create API Key کلیک کنید.",
            "کلید ساخته شده را کپی کرده و در کادر زیر پیست کنید.",
            "نکته طلایی: گوگل به هر اکانت جیمیل روزانه ۱۵۰۰ درخواست رایگان می‌دهد! می‌توانید چند اکانت مختلف اضافه کنید تا هیچ‌وقت به سقف نخورید."
          ]
        },
        openai: {
          title: "راهنمای دریافت کلید OpenAI / ChatGPT",
          link: "https://platform.openai.com/api-keys",
          btnText: "ورود به داشبورد OpenAI API Keys",
          steps: [
            "وارد پنل توسعه‌دهندگان OpenAI شوید.",
            "روی Create new secret key کلیک کرده و نام دلخواه بگذارید.",
            "کلید sk-... را کپی و در کادر زیر وارد نمایید."
          ]
        },
        claude: {
          title: "راهنمای دریافت کلید Anthropic Claude",
          link: "https://console.anthropic.com/settings/keys",
          btnText: "ورود به کنسول Anthropic",
          steps: [
            "وارد کنسول Anthropic شوید.",
            "در بخش API Keys روی Create Key بزنید و کلید را کپی نمایید."
          ]
        }
      };

      const g = guides[activeTab] || null;

      container.innerHTML = \`
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 class="text-base font-bold text-white">\${p.name}</h3>
              <p class="text-xs text-slate-400 mt-0.5">آدرس پروکسی اختصاصی: <span dir="ltr" class="text-amber-400 font-mono select-all">\${location.origin}\${p.pathPrefix}</span></p>
            </div>
            <div class="text-xs bg-slate-800 px-3 py-1.5 rounded-lg text-slate-300 font-mono">تعداد اکانت‌های فعال: \${keys.length}</div>
          </div>

          \${g ? \`
            <!-- Provider Guide Card -->
            <div class="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <span>💡</span> \${g.title}
                </h4>
                <a href="\${g.link}" target="_blank" class="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1">
                  \${g.btnText} ↗
                </a>
              </div>
              <ul class="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                \${g.steps.map(s => \`<li>\${s}</li>\`).join('')}
              </ul>
            </div>
          \` : ''}

          <!-- Add Key Box -->
          <div class="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl space-y-3">
            <h4 class="text-xs font-bold text-slate-300">افزودن کلید API / اکانت جدید</h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input type="text" id="newKeyLabel" placeholder="برچسب (مثلاً اکانت ۱ یا ایمیل)" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs">
              <input type="password" id="newKeyValue" dir="ltr" placeholder="API Key" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs">
              <button onclick="addKey('\${activeTab}')" class="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-xs transition">افزودن به استخر کلیدها</button>
            </div>
          </div>

          <!-- Keys List -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-slate-400">لیست کلیدها و وضعیت چرخش خودکار:</h4>
            \${keys.length === 0 ? '<p class="text-xs text-slate-500 py-4 text-center">هیچ کلیدی ثبت نشده است. می‌توانید کلیدها را اضافه کنید تا سیستم خودکار چرخش انجام دهد.</p>' : ''}
            \${keys.map((k, idx) => {
              const inCoolDown = k.disabledUntil && k.disabledUntil > now;
              return \`
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-950/80 border border-slate-800 px-4 py-3 rounded-xl gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-white">\${k.label || 'کلید بدون نام'}</span>
                      \${inCoolDown ? '<span class="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">محدودیت موقت (Cool-down)</span>' : '<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">آماده</span>'}
                    </div>
                    <span dir="ltr" class="text-[11px] text-slate-500 font-mono mt-0.5 block">\${k.key.substring(0, 7)}••••••••\${k.key.substring(k.key.length - 4)}</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-slate-400">خطاها: \${k.failedCount || 0}</span>
                    <button onclick="deleteKey('\${activeTab}', \${idx})" class="text-xs text-rose-400 hover:text-rose-300">حذف</button>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      \`;
    }

    async function addKey(providerKey) {
      const label = document.getElementById('newKeyLabel').value.trim();
      const key = document.getElementById('newKeyValue').value.trim();
      if (!key) return alert('لطفاً API Key را وارد کنید');
      
      currentConfig.providers[providerKey].keys.push({
        id: Math.random().toString(36).substring(2),
        label: label || 'Account ' + (currentConfig.providers[providerKey].keys.length + 1),
        key: key,
        failedCount: 0,
        disabledUntil: null
      });

      await save();
    }

    async function deleteKey(providerKey, idx) {
      if (!confirm('آیا از حذف این کلید اطمینان دارید؟')) return;
      currentConfig.providers[providerKey].keys.splice(idx, 1);
      await save();
    }

    async function addToken() {
      const token = document.getElementById('newTokenInput').value.trim();
      if (!token) return;
      currentConfig.clientTokens.push(token);
      await save();
    }

    async function deleteToken(idx) {
      if (!confirm('آیا از حذف این توکن اطمینان دارید؟')) return;
      currentConfig.clientTokens.splice(idx, 1);
      await save();
    }

    async function save() {
      await fetch('/admin/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + authPass
        },
        body: JSON.stringify(currentConfig)
      });
      await loadData();
    }
  </script>
</body>
</html>`;
}

// -------------------------------------------------------------
// Cloudflare Worker Main Entry Point
// -------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Health check
    if (url.pathname === "/health" || url.pathname === "/ping") {
      return jsonResponse({ status: "ok", service: "Hermes-Cloud-Relay" });
    }

    // Dynamic 1-Click Setup script for 9Router & Hermes clients
    if (url.pathname === "/setup" || url.pathname === "/setup.sh") {
      const origin = url.origin;
      const setupScript = `#!/usr/bin/env bash
set -e
GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
NC='\\033[0m'
echo -e "\${CYAN}====================================================\${NC}"
echo -e "\${CYAN}⚡ پیکربندی خودکار ۱-کلیکی 9Router با رله اختصاصی کلودفلر\${NC}"
echo -e "\${CYAN}====================================================\${NC}"

DB_PATH="$HOME/.9router/db/data.sqlite"
if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" "UPDATE proxyPools SET config = json_set(config, '$.proxyUrl', '${origin}') WHERE type = 'cloudflare' OR json_extract(config, '$.name') = 'cloudflare-relay';"
  echo -e "\${GREEN}✔ آدرس رله با موفقیت در 9Router ذخیره شد: ${origin}\${NC}"
  launchctl kickstart -k "gui/$(id -u)/com.ardalan.9router" 2>/dev/null || true
  echo -e "\${GREEN}🎉 سرویس 9Router بازنشانی شد. بدون نیاز به فیلترشکن آماده است!\${NC}"
else
  echo "9Router دیتابیس در سیستم یافت نشد، اما آدرس رله شما آماده است: ${origin}"
fi
`;
      return new Response(setupScript, {
        headers: { "Content-Type": "text/x-shellscript; charset=utf-8" },
      });
    }

    // Load dynamic configuration
    const config = await getConfig(env);

    // 1. Web UI Routes
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return new Response(renderAdminDashboard(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 2. Admin API Routes
    if (url.pathname.startsWith("/admin/api/")) {
      const authHeader = request.headers.get("Authorization") || "";
      const pass = authHeader.replace(/^Bearer\s+/i, "");
      if (pass !== config.adminPassword && pass !== env.ADMIN_PASSWORD) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      if (url.pathname === "/admin/api/config") {
        if (request.method === "GET") {
          return jsonResponse(config);
        }
        if (request.method === "POST") {
          const newConfig = await request.json();
          await saveConfig(env, newConfig);
          return jsonResponse({ status: "success" });
        }
      }
      return jsonResponse({ error: "Not Found" }, 404);
    }

    // 3. AI Gateway Proxy Routes
    // Gemini: /gemini/* or /v1beta/*
    // OpenAI: /openai/* or /v1/*
    // Claude: /claude/*
    let providerKey = null;
    if (url.pathname.startsWith("/gemini") || url.pathname.startsWith("/v1beta")) {
      providerKey = "gemini";
    } else if (url.pathname.startsWith("/openai") || url.pathname.startsWith("/v1")) {
      providerKey = "openai";
    } else if (url.pathname.startsWith("/claude")) {
      providerKey = "claude";
    }

    if (providerKey) {
      // Authenticate client (Hermes or user)
      if (!isAuthorized(request, config)) {
        return jsonResponse({ error: "Unauthorized: Invalid or missing relay key" }, 401);
      }
      return await handleProxy(request, env, providerKey, config);
    }

    // Default welcome page
    return new Response(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>Hermes Cloud Relay</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2rem; border-radius: 1rem; text-align: center; border: 1px solid #334155; }
    a { color: #f59e0b; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ Hermes Cloud Relay در حال اجرا است</h2>
    <p>برای ورود به پنل مدیریت کلیدها و سهمیه‌ها به <a href="/admin">/admin</a> بروید.</p>
  </div>
</body>
</html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
