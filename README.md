# ⚡ Hermes-Cloud-Relay

[![Deploy with 1-Click Wizard](https://img.shields.io/badge/🌐%20Web%20Wizard-1--Click%20Deploy-amber?style=for-the-badge)](https://ketabchi-ar.github.io/Hermes-Cloud-Relay/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Active-emerald?style=flat-square)](https://ketabchi-ar.github.io/Hermes-Cloud-Relay/)
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

### روش ۲: ویزارد وب ۱۰۰٪ آنلاین (مشابه BPB Wizard - بدون ترمینال)
اگر نمی‌خواهید هیچ دستوری در ترمینال بزنید:
1. وارد [وب‌سایت پروژه](https://ketabchi-ar.github.io/Hermes-Cloud-Relay/) شوید و تب **روش ۲: ویزارد وب ۱۰۰٪ آنلاین** را انتخاب کنید.
2. کلید یا توکن کلودفلر را وارد کنید و دکمه **«ساخت و استقرار مستقیم ورکر در کلودفلر»** را بزنید.
3. در عرض چند ثانیه ورکر در اکانت کلودفلر شما ساخته می‌شود و آدرس رله به شما تحویل داده خواهد شد.

---

### روش ۳: کپی دستی کد در داشبورد کلودفلر
1. وارد داشبورد کلودفلر شوید > **Workers & Pages** > **Create Worker**.
2. کدهای رسمی موجود در فایل [`src/index.js`](src/index.js) را کپی کرده و در ادیتور کلودفلر پیست نمایید و دکمه **Save and deploy** را بزنید.
3. آدرس ورکر ساخته‌شده را کپی کرده و در بخش **Proxy Pools** نرم‌افزار ۹روتر قرار دهید.

---

## 🛡 لایسنس
این پروژه تحت لایسنس MIT به صورت ۱۰۰٪ رایگان و متن‌باز منتشر شده است.
