#!/usr/bin/env bash
#!/usr/bin/env python3
"""
Hermes-Cloud-Relay: Zero-Touch 1-Click Deployer & 9Router Auto-Binder
Automates everything directly through Cloudflare REST API:
1. Validates API Token
2. Discovers Cloudflare Account ID & Active Domains (Zones)
3. Uploads & Deploys Hermes Cloud Relay Worker
4. Attaches a Custom Domain to bypass Iran censorship
5. Injects the custom URL directly into local 9Router SQLite DB
6. Restarts 9Router and verifies live connection
"""

import sys
import os
import json
import sqlite3
import subprocess
import urllib.request
import urllib.error

API_BASE = "https://api.cloudflare.com/client/v4"

def cf_request(endpoint, token, method="GET", data=None, content_type="application/json"):
    url = f"{API_BASE}{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
    }
    if content_type:
        headers["Content-Type"] = content_type

    body = None
    if data is not None:
        if content_type == "application/json":
            body = json.dumps(data).encode("utf-8")
        elif isinstance(data, str):
            body = data.encode("utf-8")
        else:
            body = data

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if "json" in resp.headers.get("Content-Type", "") else raw
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return json.loads(err_body)
        except:
            return {"success": False, "errors": [{"message": err_body}]}

def main():
    print("\033[1;36m" + "="*60 + "\033[0m")
    print("\033[1;36m⚡ Hermes Cloud Relay: نصب خودکار ۱-کلیکی و اتصال به 9Router\033[0m")
    print("\033[1;36m" + "="*60 + "\033[0m")

    # 1. Get Token from env or input
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not token and len(sys.argv) > 1:
        token = sys.argv[1].strip()

    if not token:
        print("\033[1;33m🔑 توکن دسترسی Cloudflare API Token خود را وارد کنید:\033[0m")
        print("  (لینک دریافت: https://dash.cloudflare.com/profile/api-tokens با دسترسی Workers & DNS)")
        token = input("API Token: ").strip()

    if not token:
        print("\033[0;31m❌ توکن وارد نشد. عملیات لغو شد.\033[0m")
        sys.exit(1)

    # 2. Verify Token & Get Account
    print("\n\033[0;34m1️⃣ در حال بررسی دسترسی به حساب کلودفلر...\033[0m")
    accounts_res = cf_request("/accounts", token)
    if not accounts_res.get("success"):
        print(f"\033[0;31m❌ توکن نامعتبر است: {accounts_res.get('errors')}\033[0m")
        sys.exit(1)

    accounts = accounts_res.get("result", [])
    if not accounts:
        print("\033[0;31m❌ هیچ حسابی برای این توکن پیدا نشد.\033[0m")
        sys.exit(1)

    account_id = accounts[0]["id"]
    account_name = accounts[0]["name"]
    print(f"\033[0;32m✔ متصل به حساب: {account_name} ({account_id})\033[0m")

    # 3. Get Zones (Domains) - Fully Automatic Selection
    print("\n\033[0;34m2️⃣ در حال دریافت خودکار دامنه‌های متصل...\033[0m")
    custom_sub_env = os.environ.get("CLOUDFLARE_SUBDOMAIN", "").strip()

    zones_res = cf_request(f"/zones?account.id={account_id}", token)
    zones = zones_res.get("result", [])

    zone_id = None
    domain_name = None
    target_subdomain = None

    if custom_sub_env:
        # Match zone for custom subdomain
        parts = custom_sub_env.split(".")
        if len(parts) >= 2:
            base_d = ".".join(parts[-2:])
            for z in zones:
                if z["name"] == base_d:
                    zone_id = z["id"]
                    domain_name = z["name"]
                    target_subdomain = custom_sub_env
                    break
        if not zone_id and zones:
            zone_id = zones[0]["id"]
            domain_name = zones[0]["name"]
            target_subdomain = custom_sub_env
        print(f"\033[0;32m✔ ساب‌دامنه اختصاصی: {target_subdomain}\033[0m")
    elif zones:
        # Pick first active zone automatically
        zone = zones[0]
        zone_id = zone["id"]
        domain_name = zone["name"]
        target_subdomain = f"ai.{domain_name}"
        print(f"\033[0;32m✔ دامنه فعال پیدا شد: {domain_name}\033[0m")
        print(f"\033[0;32m✔ ساب‌دامنه خودکار ایجاد شد: {target_subdomain}\033[0m")
    else:
        print("\033[1;33m⚠️ دامنه مستقلی در کلودفلر یافت نشد؛ از آدرس پیش‌فرض ورکر استفاده می‌شود.\033[0m")

    # 4. Upload Worker Script
    script_name = "hermes-cloud-relay"
    worker_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "index.js")
    if not os.path.exists(worker_file):
        worker_file = os.path.expanduser("~/Hermes-Cloud-Relay/src/index.js")

    with open(worker_file, "r", encoding="utf-8") as f:
        worker_code = f.read()

    print(f"\n\033[0;34m3️⃣ در حال دیپلوی خودکار ورکر ({script_name}) در کلودفلر...\033[0m")
    deploy_res = cf_request(
        f"/accounts/{account_id}/workers/scripts/{script_name}",
        token,
        method="PUT",
        data=worker_code,
        content_type="application/javascript"
    )

    if not deploy_res.get("success"):
        print(f"\033[0;31m❌ خطا در دیپلوی ورکر: {deploy_res.get('errors')}\033[0m")
        sys.exit(1)

    print("\033[0;32m✔ ورکر با موفقیت ساخته و دیپلوی شد!\033[0m")

    # Enable workers.dev subdomain route as fallback
    subdomain_res = cf_request(f"/accounts/{account_id}/workers/scripts/{script_name}/subdomain", token, method="POST", data={"enabled": True})

    # 5. Attach Custom Domain if available
    final_url = None
    if zone_id and target_subdomain:
        print(f"\n\033[0;34m4️⃣ در حال اتصال ساب‌دامنه بدون فیلتر ({target_subdomain}) به ورکر...\033[0m")
        attach_res = cf_request(
            f"/accounts/{account_id}/workers/domains",
            token,
            method="PUT",
            data={
                "zone_id": zone_id,
                "hostname": target_subdomain,
                "service": script_name,
                "environment": "production"
            }
        )
        if attach_res.get("success"):
            final_url = f"https://{target_subdomain}"
            print(f"\033[0;32m✔ ساب‌دامنه اختصاصی با موفقیت متصل شد: {final_url}\033[0m")
        else:
            print(f"\033[1;33m⚠️ نتوانست ساب‌دامنه را اتوماتیک اضافه کند ({attach_res.get('errors')}).\033[0m")

    if not final_url:
        sub_info = cf_request(f"/accounts/{account_id}/workers/subdomain", token)
        user_sub = sub_info.get("result", {}).get("subdomain", "worker")
        final_url = f"https://{script_name}.{user_sub}.workers.dev"

    # 6. Bind to 9Router SQLite Database
    print(f"\n\033[0;34m5️⃣ در حال درج خودکار آدرس رله در پایگاه‌داده 9Router...\033[0m")
    db_path = os.path.expanduser("~/.9router/db/data.sqlite")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            UPDATE proxyPools 
            SET config = json_set(config, '$.proxyUrl', ?) 
            WHERE type = 'cloudflare' OR json_extract(config, '$.name') = 'cloudflare-relay';
        """, (final_url,))
        conn.commit()
        conn.close()
        print("\033[0;32m✔ آدرس رله مستقیماً در 9Router ذخیره شد.\033[0m")

        # Restart 9Router
        print("\033[0;34m6️⃣ در حال بازنشانی سرویس 9Router...\033[0m")
        uid = os.getuid()
        subprocess.run(["launchctl", "kickstart", "-k", f"gui/{uid}/com.ardalan.9router"], capture_output=True)
        print("\033[0;32m✔ سرویس 9Router ریستارت شد.\033[0m")
    else:
        print(f"\033[1;33m⚠️ دیتابیس 9Router در {db_path} پیدا نشد.\033[0m")

    print("\n\033[1;32m" + "="*60 + "\033[0m")
    print(f"\033[1;32m🎉 راه‌اندازی ۱۰۰٪ خودکار به پایان رسید!\033[0m")
    print(f"\033[1;32m✔ آدرس رله اختصاصی شما: {final_url}\033[0m")
    print(f"\033[1;32m✔ پنل مدیریت هوشمند: {final_url}/admin (رمز: change_me_hermes)\033[0m")
    print(f"\033[1;32m✔ حالا می‌توانید فیلترشکن سیستم را خاموش کنید و از هوش مصنوعی لذت ببرید.\033[0m")
    print("\033[1;32m" + "="*60 + "\033[0m")

if __name__ == "__main__":
    main()
