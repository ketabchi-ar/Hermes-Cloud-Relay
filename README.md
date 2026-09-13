# ⚡ Hermes-Cloud-Relay

[![DevSponsors](https://img.shields.io/badge/DevSponsors-Verified_OSS-6366f1?style=for-the-badge&logo=github)](https://devsponsors.github.io)
[![Sponsor](https://img.shields.io/badge/Sponsor-DevSponsors_Hub-emerald?style=for-the-badge&logo=github-sponsors)](https://devsponsors.github.io)
[![GitHub stars](https://img.shields.io/github/stars/ketabchi-ar/Hermes-Cloud-Relay?style=for-the-badge&logo=github&color=amber)](https://github.com/ketabchi-ar/Hermes-Cloud-Relay/stargazers)
[![Deploy with 1-Click Wizard](https://img.shields.io/badge/🌐%20Web%20Wizard-1--Click%20Deploy-amber?style=for-the-badge)](https://ketabchi-ar.github.io/Hermes-Cloud-Relay/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**درگاه سرورلس و رله ابری هوشمند روی Cloudflare Workers ویژه اتصال مستقیم، پرسرعت و بدون نیاز به فیلترشکن ۹روتر به مدل‌های هوش مصنوعی (Google Gemini, Antigravity, Claude, OpenAI)**

👉 **[ورود به صفحه وب راه‌اندازی ویزارد (GitHub Pages)](https://ketabchi-ar.github.io/Hermes-Cloud-Relay/)**

---

## ✨ چرا این پروژه؟ (حل قطعی مشکل فیلترشکن در ایران)

در ایران برای استفاده از مدل‌های هوش مصنوعی (مثل گوگل جمینای و آنتی‌گراویتی)، روشن بودن فیلترشکن ضروری است، اما با روشن بودن فیلترشکن تمام سایت‌های ایرانی، درگاه‌های بانکی، پنل‌های پیامک و سامانه‌های اداری مختل می‌شوند.

این پروژه یک ورکر ابری اختصاصی روی شبکه جهانی کلودفلر می‌سازد و مستقیماً آن را در **پایگاه داده ۹روتر سیستم شما** ثبت می‌کند؛ به‌طوری که:
1. **سایت‌های ایرانی** مستقیماً و با حداکثر سرعت اینترنت ایران باز می‌شوند.
2. **درخواست‌های هوش مصنوعی ۹روتر** بدون نیاز به فیلترشکن از رله اختصاصی کلودفلر عبور می‌کنند و تحریم‌ها دور زده می‌شوند.

---

## 🚀 روش‌های استقرار (۳ روش مختلف بر اساس نیاز شما)

### روش ۱: راه‌اندازی خودکار با ۱ دستور در خط فرمان (پیشنهادی)
کافیست وارد [صفحه وب ویزارد](https://ketabchi-ar.github.io/Hermes-Cloud-Relay/) شوید، کلید کلودفلر را وارد کنید و دستور اختصاصی سیستم‌عامل خود را کپی و اجرا کنید.

* **مک و لینوکس (macOS & Ubuntu / Debian):**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/ketabchi-ar/Hermes-Cloud-Relay/main/install.sh | bash
  ```

* **ویندوز (Windows PowerShell):**
  ```powershell
  irm https://raw.githubusercontent.com/ketabchi-ar/Hermes-Cloud-Relay/main/install.ps1 | iex
  ```

---

### روش ۲: ویزارد وب ۱۰۰٪ آنلاین (استقرار مستقیم از مرورگر)
اگر نمی‌خواهید هیچ دستوری در ترمینال بزنید:
1. وارد [وب‌سایت پروژه](https://ketabchi-ar.github.io/Hermes-Cloud-Relay/) شوید و تب **روش ۲: ویزارد وب ۱۰۰٪ آنلاین** را انتخاب کنید.
2. روی دکمه نارنجی **«دیپلوی مستقیم با Deploy to Cloudflare»** بزنید یا با کلید کلودفلر استقرار را انجام دهید.
3. ورکر در اکانت کلودفلر شما ساخته شده و آدرس رله به شما نمایش داده می‌شود.

---

### روش ۳: کپی دستی کد در داشبورد کلودفلر
1. وارد داشبورد کلودفلر شوید > **Workers & Pages** > **Create Worker**.
2. کدهای رسمی موجود در فایل [`src/index.js`](src/index.js) را کپی کرده و در ادیتور کلودفلر پیست نمایید و دکمه **Save and deploy** را بزنید.
3. آدرس ورکر ساخته‌شده را کپی کرده و در بخش **Proxy Pools** نرم‌افزار ۹روتر قرار دهید.

---

## 📋 آموزش تست و راستی‌آزمایی در ۹روتر (کمتر از ۳۰ ثانیه)

پس از اجرای موفق دستور، مراحل زیر را برای اطمینان از اتصال انجام دهید:

1. در مرورگر خود صفحه تنظیمات پروکسی ۹روتر را باز کنید:
   👉 `http://127.0.0.1:20128/dashboard/proxy-pools`
2. بررسی کنید که رله جدید (`hermes-cloud-relay`) در لیست اضافه شده باشد و وضعیت آن فعال (سبز) باشد.
3. روی دکمه شبیه **لوله آزمایشگاه 🧪** کلیک کنید و مطمئن شوید پیام سبز **`Proxy test passed`** را می‌دهد.
4. از منوی سمت چپ وارد بخش **Providers** شوید.
5. ابزار مورد نظر خود که دچار تحریم است (مثلاً **Antigravity** یا **Google Gemini**) را انتخاب کنید.
6. در صفحه باز شده دکمه **Proxy** را بزنید و مطمئن شوید با همین رله جدید سینک است، سپس دکمه **`Test Connection One-by-One`** را بزنید.
7. **تمام!** اکنون تمام اتصالات هوش مصنوعی بدون نیاز به روشن بودن فیلترشکن با نهایت سرعت کار می‌کنند.

---

## 🌟 حمایت و اسپانسرشیپ (DevSponsors)

اگر این پروژه برای اتصال بدون فیلترشکن ۹روتر شما مفید بوده است، با دادن **ستاره (Star)** در بالای صفحه گیت‌هاب از ما حمایت کنید.

[![DevSponsors](https://img.shields.io/badge/DevSponsors-Verified_OSS-6366f1?style=for-the-badge&logo=github)](https://devsponsors.github.io)
[![Sponsor](https://img.shields.io/badge/Sponsor-DevSponsors_Hub-emerald?style=for-the-badge&logo=github-sponsors)](https://devsponsors.github.io)

---

## 🛡 لایسنس
این پروژه تحت لایسنس MIT به صورت ۱۰۰٪ رایگان و متن‌باز منتشر شده است.
