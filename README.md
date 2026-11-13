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
| **تطبيق الهاتف (Customer Mobile)** | Flutter (iOS & Android) | تطبيق عميل بنمط Clean Architecture للشحن المباشر والمحفظة |
| **التوثيق التفاعلي** | Swagger OpenAPI | توثيق كافة مسارات الـ API واختبارها |

---

## ⚡ التشغيل السريع (Quickstart)

### 1. عبر Podman Desktop + Podman Compose
```powershell
.\scripts\setup-podman.ps1
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Configure unique random secrets in .env before starting.
.\scripts\start-platform-podman.ps1
podman compose -f podman/compose.yml ps
```

استخدم Podman Desktop على Windows مع Podman Machine وامتداد Compose. لا يتطلب المشروع Docker Desktop أو Docker Engine. ملف `.env.example` يحتوي عناصر نائبة فقط. يمكن تشغيل Adminer اختيارياً بالأمر: `podman compose -f podman/compose.yml --profile tools up -d db-admin`.

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
يتطلب إنشاء مدير التهيئة ضبط `SEED_SUPER_ADMIN_EMAIL` وكلمة مرور فريدة لا تقل عن 20 حرفاً في `.env`. لا توجد بيانات دخول افتراضية أو حسابات مدير منشورة. ملف التهجير الأول يمثل مخطط قاعدة جديدة؛ إذا كانت قاعدة قائمة قد أُنشئت سابقاً باستخدام `db push`، فيجب تسجيل خط الأساس كمنفذ قبل استخدام `migrate deploy`، وعدم تطبيقه على قاعدة تحتوي الجداول نفسها مباشرة.

---

## 🔐 حسابات الدخول

لا يوفر المستودع كلمات مرور افتراضية أو حسابات تجربة عامة. تُنشأ هوية المدير محلياً بكلمة مرور خاصة، وتُعطّل هويات seed الاصطناعية غير القابلة للدخول.

---

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
