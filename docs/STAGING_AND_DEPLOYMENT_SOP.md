# دليل إجراءات التشغيل المعياري لبيئة الاختبار والنشر (Staging & Deployment SOP)
## منصة الشحن والخدمات الرقمية — اليمن (Yemen Market Digital TopUp Platform v1.0)
**تاريخ الاعتماد:** 11 أكتوبر 2026 | **الإصدار:** v1.0 (ضمن Phase 10) | **المطابقة:** AR-16 & NFR-01

---

## 1. عزل البيئات وإدارة الأسرار (Environment Isolation & Secrets)

يتبنى النظام نموذج العزل التام بين البيئات الثلاث:

| البيئة (Environment) | النطاقات (Domains) | مصدر البيانات (Database) | إدارة الأسرار (Secrets Management) | وضع المزودين (Provider Mode) |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | `localhost:3000 / 3001 / 4000` | MySQL 8.4 محلياً عبر Podman Desktop | ملف `.env` محلي يحوي أسراراً فريدة غير افتراضية وغير متعقبة | `MOCK` / محاكيات محلية |
| **Staging** | `staging.yementopup.com` | خادم MySQL 8.4 سحابي مخصص معزول | بيئة CI/CD المحمية (`.env.staging`) | `SANDBOX` + محاكيات معتمدة |
| **Production** | `yementopup.com` | عنقود MySQL 8.4 مكرر عالي التوافر | Vault / AWS Secrets Manager / Cloud KMS | `MANUAL` / `API` (بعقود رسمية فقط) |

### ضوابط حظر نقل بيانات الإنتاج (PII Masking Guardrails)
- يُحظر حظراً قاطعاً استيراد أي نسخة احتياطية من قاعدة بيانات الإنتاج إلى بيئة Staging دون تمريرها عبر سكربت التعمية الآلي:
  ```bash
  npx ts-node -r dotenv/config scripts/sanitize-staging-data.ts
  ```
- يقوم السكربت بتعمية أرقام الهواتف والأسماء وعناوين البريد، وحذف رموز الجلسات ورموز OTP، مع الإبقاء الصارم على توازن قيود دفتر الأستاذ العام المزدوج لضمان واقعية الاختبارات.

---

## 2. إجراءات النشر المعتمدة (Deployment SOP Pipeline)

1. **الخطوة 1: الفحص المسبق والتحقق من الشيفرة (Pre-flight Validation):**
   - فحص Linter وخلو الشيفرة من الأخطاء: `npm run lint`
   - التحقق من مطابقة Typescript: `npm run build --workspaces`
   - اختبارات Backend والـ Security Gate: `npm test --workspace=apps/backend`. تُعتمد أعداد الاختبارات من أحدث تشغيل CI ناجح، ولا تُنسخ أرقام تاريخية قديمة.

2. **الخطوة 2: فحص هجرة قاعدة البيانات (Prisma Migration Dry-Run):**
   - التأكد من أن أي تعديل في `schema.prisma` غير هدام (Non-destructive).
   - التحقق من عدم حذف أي جداول مالية أو أعمدة مستخدمة.

3. **الخطوة 3: النشر التلقائي لبيئة Staging:**
   - بناء وتشغيل الحاويات عبر Podman Desktop وPodman Compose باستخدام ملفات Containerfile. لا تعتمد هذه التعليمات على Docker Desktop.
   - التحقق من نجاح فحص الجاهزية:
     ```bash
     curl -f https://staging-api.yementopup.com/api/health/ready
     ```

4. **الخطوة 4: فحص قبول الإصدار (Smoke Tests & Acceptance Tests):**
   - تنفيذ تجربة استعادة النسخ الاحتياطي AT-20.
   - التحقق من توازن الأستاذ العام عبر مسار `/api/monitoring/reconciliation-check`.

5. **الخطوة 5: ترقية الإنتاج المشروطة (Gated Production Release):**
   - موافقة صريحة من المدير الفني والمدير المالي في بوابة GitHub Actions.
   - تفعيل وضع النشر المتدرج (Rolling Deployment / Blue-Green) بعد توفر بيانات الاعتماد، وفحوص الاستعادة والمطابقة المالية الحية. إلى حينها تبقى ترقية Staging/Production محجوبة.

---

## 3. إجراءات إيقاف وتشغيل الخدمات (Service Shutdown & Startup Runbook)

### إيقاف الخدمة المجدول (Graceful Maintenance Shutdown):
1. تحويل القنوات والبوابات لوضع الصيانة الطارئة عبر لوحة الإدارة (`/operations`).
2. الانتظار حتى اكتمال جميع الطلبات الجارية في طابور التنفيذ (`Queue lag = 0`).
3. إيقاف خوادم الـ API والعمال:
   ```bash
   podman compose -f podman/compose.yml stop backend web-admin web-customer
   ```
4. أخذ لقطة احتياطية فورية لقاعدة البيانات وحساب بصمتها SHA-256.

### تشغيل الخدمة واستئناف العمل (Cold Startup SOP):
1. بدء تشغيل MySQL 8.4 وRedis والتأكد من الصحة:
   ```bash
   podman compose -f podman/compose.yml up -d mysql redis
   ```
2. فحص استجابة قاعدة البيانات: `podman compose -f podman/compose.yml exec mysql sh -lc 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent'`.
3. بدء تشغيل Backend والتحقق من سجلات البداية وفحص الأسرار `validateProductionSecrets`.
4. التحقق من مسار `/api/health` والتأكد من رجوع `status: "HEALTHY"`.
5. بدء واجهات الويب `web-admin` و `web-customer`.
