# ⚡ Hermes-Cloud-Relay

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ketabchi-ar/Hermes-Cloud-Relay)

**Serverless AI Gateway & Reverse Proxy on Cloudflare Workers with Web UI, Multi-Account Key Pool & Automatic Quota Failover**

طراحی شده ویژه کاربران و توسعه‌دهندگان ایرانی برای اتصال مستقیم، پرسرعت و بدون نیاز به فیلترشکن به سرویس‌های هوش مصنوعی (Google Gemini, OpenAI / Codex, Anthropic Claude) با مدیریت هوشمند محدودیت مصرف (Rate Limit Failover) و داشبورد گرافیکی اختصاصی.

---

## ⚡ ساده‌ترین روش استقرار (۱۰۰٪ بدون نیاز به ترمینال)

### روش ۱: استقرار با یک کلیک (One-Click Web Deploy)
کافیست روی دکمه زیر کلیک کنید و در صفحه باز شده دکمه **Deploy** کلودفلر را بزنید:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ketabchi-ar/Hermes-Cloud-Relay)

---

### روش ۲: کپی مستقیم کد در داشبورد کلودفلر (فوق‌العاده ساده و بدون باگ لاگین)
اگر نمی‌خواهید درگیر ابزارهای ترمینال، نود یا ارورهای ۴۰۳ لاگین شوید:
1. وارد داشبورد کلودفلر ([dash.cloudflare.com](https://dash.cloudflare.com)) شوید.
2. از منوی سمت چپ به بخش **Workers & Pages** بروید و روی **Create Application** و سپس **Create Worker** کلیک کنید.
3. یک نام انتخاب کنید (مثلاً `hermes-relay`) و دکمه **Deploy** را بزنید.
4. سپس روی **Edit Code** کلیک کنید.
5. تمام محتوای فایل [`src/index.js`](src/index.js) را کپی کرده و در ادیتور کلودفلر پیست کنید و دکمه **Save and Deploy** را بزنید.
6. **(بسیار مهم برای ایران):** در صفحه ورکر به تب **Settings > Domains & Routes** بروید، روی **Add > Custom Domain** بزنید و یک ساب‌دامنه از دامنه خودتان (مثلاً `ai.yourdomain.com`) ست کنید تا بدون فیلترشکن باز شود.
7. حالا آدرس ساب‌دامنه را در مرورگر باز کنید و با رفتن به `/admin` وارد پنل مدیریت هوشمند شوید!

---

## 💻 روش ۳: استقرار از طریق ترمینال (برای برنامه‌نویسان)

1. **بدون نیاز به VPN و بدون سرور (Serverless):**
   - اجرا روی شبکه ابری کلودفلر (Cloudflare Workers) به صورت ۱۰۰٪ رایگان.
   - امکان اتصال دامنه یا ساب‌دامنه اختصاصی جهت دسترسی آزاد و بدون فیلتر در ایران.

2. **داشبورد مدیریت گرافیکی (`/admin`):**
   - طراحی مدرن و ریسپانسیو با رابط کاربری فارسی و دارک‌مود.
   - مشاهده آمار زنده درخواست‌های موفق، ناموفق و رخدادهای تعویض کلید (Failover).

3. **استخر چند اکانته و چرخش خودکار (Key Pool & Smart Quota Failover):**
   - افزودن نامحدود اکانت و کلید API برای هر سرویس.
   - در صورت اتمام سهمیه یا خطای `429 Too Many Requests` روی یک اکانت، سیستم به صورت کاملاً خودکار و آنی به اکانت بعدی سوییچ کرده و به درخواست کاربر پاسخ می‌دهد (Zero Downtime).
   - ورود خودکار اکانت پرشده به حالت خنک‌سازی (Cool-down) به مدت ۵ دقیقه.

4. **پشتیبانی از ارائه‌دهندگان مطرح:**
   - 🟢 **Google Gemini API** (`/gemini/*` یا `/v1beta/*`)
   - 🟢 **OpenAI / Codex** (`/openai/*` یا `/v1/*`)
   - 🟢 **Anthropic Claude** (`/claude/*`)

5. **امنیت و احراز هویت اختصاصی:**
   - قابلیت تعیین رمز عبور برای پنل ادمین.
   - صدور توکن دسترسی اختصاصی (`x-relay-key` یا `Bearer`) جهت جلوگیری از مصرف عمومی یا ناشناس.

---

## 🚀 نحوه نصب و استقرار (Quick Deployment)

### روش اول: دیپلوی خودکار با Wrangler CLI (پیشنهادی)

```bash
# ۱. کلون کردن مخزن
git clone https://github.com/ketabchi-ar/Hermes-Cloud-Relay.git
cd Hermes-Cloud-Relay

# ۲. ورود به حساب کلودفلر (یک‌بار)
npx wrangler login

# ۳. ساخت دیتابیس KV برای ذخیره تنظیمات و کلیدها
npx wrangler kv namespace create RELAY_KV

# پس از اجرای دستور فوق، مقادیر id را داخل wrangler.toml قرار دهید.

# ۴. دیپلوی ورکر
npx wrangler deploy
```

### روش دوم: کپی مستقیم کد در پنل کلودفلر
1. وارد داشبورد کلودفلر شوید > **Workers & Pages** > **Create Application**.
2. یک ورکر بسازید و روی **Edit Code** کلیک کنید.
3. تمام محتوای فایل `src/index.js` را کپی کرده و پیست کنید، سپس **Save and Deploy** را بزنید.
4. در بخش **Settings > Domains & Routes** یک ساب‌دامنه از دامنه اختصاصی خود (مثلاً `ai.yourdomain.com`) به ورکر متصل نمایید.

---

## ⚙️ نحوه اتصال به هرمس (Hermes Agent Configuration)

برای اینکه هرمس شما بدون فیلترشکن مستقیم به مدل دسترسی داشته باشد:

در فایل کانفیگ هرمس یا ابزارهای مجهز به API OpenAI / Gemini، آدرس پایه (Base URL) را برابر با آدرس ورکر خود قرار دهید:

```yaml
# نمونه برای Gemini در Hermes
model: ag/gemini-3.8-flash-medium
base_url: https://ai.yourdomain.com/gemini/v1beta
headers:
  x-relay-key: "کلید_تعریف_شده_شما_در_پنل"
```

---

## 🛡 لایسنس
این پروژه تحت لایسنس MIT منتشر شده است و برای تمام کاربران و توسعه‌دهندگان رایگان و متن‌باز است.
