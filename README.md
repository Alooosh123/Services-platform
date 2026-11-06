# Digital TopUp & Services Platform
## المنصة التجارية لشحن الألعاب والخدمات الرقمية

منظومة متكاملة وتجارية مصممة بنمط **Modular Monolith** عالي الموثوقية لشحن الألعاب الإلكترونية (PUBG Mobile UC, Free Fire Diamonds, Mobile Legends) وبطاقات الهدايا الرقمية (Google Play, Apple iTunes) مع نظام مالي محاسبي بالقيد المزدوج (Immutable Ledger).

---

## 🏗️ مكونات المنظومة (Architecture & Tech Stack)

| المكون | التقنية | الوظيفة |
| :--- | :--- | :--- |
| **Backend REST API** | NestJS + TypeScript | المحرك المركزي، المصادقة RBAC، دورة الطلبات، المزودات، والـ Ledger |
| **قاعدة البيانات** | PostgreSQL + Prisma ORM | جداول علائقية عالية الدقة لبيانات العملاء والألعاب والقيود المحاسبية |
| **الكاش وقوائم الانتظار** | Redis | التخزين المؤقت، Rate Limiting، ومزامنة العمليات |
| **لوحة الإدارة (Web Admin)** | Next.js 14 + Tailwind CSS | الإدارة المركزية، متابعة الطلبات، إضافة الألعاب ديناميكياً، والتدقيق المالي |
| **متجر العميل (Web Customer)** | Next.js 14 + Tailwind CSS | متجر سريع ومتجاوب، التحقق الفوري من معرف اللاعب، والمحفظة الرقمية |
| **تطبيق الهاتف (Customer Mobile)** | Flutter (iOS & Android) | واجهة نموذجية غير مكتملة؛ لا تتصل بعد بالـ API ولا تنفذ عمليات مالية فعلية |
| **التوثيق التفاعلي** | Swagger OpenAPI | توثيق كافة مسارات الـ API واختبارها |

---

## ⚡ التشغيل السريع (Quickstart)

### 1. عبر Docker Compose (أمر واحد لكامل المنظومة)
```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml ps
```

يجب تثبيت Docker Desktop وتشغيله أولاً. ملف `.env.example` مخصص للتطوير المحلي فقط؛ لا تستخدم القيم الافتراضية أو أسرار المثال في الإنتاج.

* **متجر العميل:** `http://localhost:3000`
* **لوحة الإدارة:** `http://localhost:3001`
* **توثيق Swagger:** `http://localhost:4000/api/docs`

### 2. التشغيل اليدوي (Local Development)
```bash
# تثبيت الحزم وبناء الحزم المشتركة
npm install
npm run build --workspace=packages/shared

# إعداد قاعدة البيانات وتغذية البيانات الأولية
npm run db:generate
npm run db:migrate
npm run db:seed

# تشغيل الـ Backend
npm run dev:backend

# تشغيل لوحة الإدارة (نافذة أخرى)
npm run dev:admin

# تشغيل متجر العميل (نافذة ثالثة)
npm run dev:customer
```

أمر `npm run db:seed` لا يمسح بيانات قاعدة موجودة. إعادة ضبط بيانات التطوير بشكل صريح تتطلب تعيين `RESET_DATABASE_SEED=true`، وهو أمر هدّام ولا يعمل في بيئة الإنتاج.
يمكن تغيير حساب المدير الأول عبر `SEED_SUPER_ADMIN_EMAIL` و`SEED_SUPER_ADMIN_PASSWORD` في `.env`. ملف التهجير الأول يمثل مخطط قاعدة جديدة؛ إذا كانت قاعدة قائمة قد أُنشئت سابقاً باستخدام `db push`، فيجب تسجيل خط الأساس كمنفذ قبل استخدام `migrate deploy`، وعدم تطبيقه على قاعدة تحتوي الجداول نفسها مباشرة.

---

## 🔐 إعداد حسابات التطوير

لا توجد كلمات مرور افتراضية أو حسابات دخول عامة داخل المستودع. قبل تشغيل `npm run db:seed`، انسخ ملف `.env.example` إلى `.env` وحدد قيماً سرية محلية وفريدة للمتغيرات التالية:

- `SEED_SUPER_ADMIN_EMAIL`
- `SEED_SUPER_ADMIN_PASSWORD`
- `SEED_FINANCE_PASSWORD`
- `SEED_CUSTOMER_PASSWORD`

يجب أن تكون كلمات مرور التطوير بطول 20 حرفاً على الأقل، وألا يعاد استخدامها في الإنتاج. لا تستخدم حسابات seed كحسابات تشغيل حقيقية.

**قنوات الدفع اليمنية تُنشأ معطلة افتراضياً** إلى أن يضع مسؤول المالية أرقام الاستقبال الرسمية ويتحقق منها ويعتمدها. لا تعتمد على بيانات المثال أو على أسعار الصرف المرجعية كقيم تشغيلية دون مراجعة مالية حديثة.

## 💎 أبرز المزايا المعمارية المنفذة

1. **النظام المالي المحاسبي (Immutable Ledger):**
   * لا يمكن تعديل رصيد العميل عبر تحديث مباشر.
   * كل حركة مالية تسجل كقيد مزدوج في جدول `ledger_entries` (إيداع، شراء، استرداد، تعديل إداري).
   * حماية ضد حالات السباق (Race Conditions) ومعاملات ACID مغلقة.

2. **محرك الألعاب والحقول الديناميكية (Dynamic Forms Engine):**
   * إمكانية إضافة أي لعبة جديدة من لوحة الإدارة بتحديد حقول إدخال اللاعب (مثل `player_id`, `zone_id`) مع الـ Regex المطلوب.
   * واجهات العميل تبني نماذج الإدخال وتفحص المدخلات تلقائياً دون كتابة كود جديد.

3. **طبقة محولات المزودين (Provider Adapter Layer):**
   * دعم الـ Mock Provider لوضع التجربة (Demo Mode) لمحاكاة جميع حالات الشحن (نجاح فوري، تعليق، خطأ في الحساب مع استرداد آمن).
   * جاهزية الربط المباشر مع مزودي الشحن التجاريين (Smile.One, UniPin, إلخ).

4. **مفاتيح منع تكرار العمليات (Idempotency Keys):**
   * حماية كل طلب بمفتاح فريد لمنع الخصم أو الشحن المزدوج عند انقطاع الاتصال.

---

## 📚 التوثيق المرفق
* 📖 [دليل النشر والتشغيل (Deployment Guide)](docs/DEPLOYMENT_GUIDE.md)
* 🛡️ [قائمة التحقق الأمني (Security Checklist)](docs/SECURITY_CHECKLIST.md)
* 💾 [دليل النسخ الاحتياطي والطوارئ (Backup & Recovery Guide)](docs/BACKUP_AND_RECOVERY_GUIDE.md)
* 📋 [دليل المستخدم والمشرف (User Manual)](docs/USER_MANUAL.md)
"# Services-platform" 
