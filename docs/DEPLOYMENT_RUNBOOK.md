# دليل النشر والتشغيل في بيئة الإنتاج (Production Deployment Runbook)
## منصة الشحن والخدمات الرقمية — اليمن (Yemen TopUp Platform v1.0)
**تاريخ الإصدار:** 11 أكتوبر 2026 | **الإصدار المعتمد:** v1.0 | **المرجع:** `10_PRODUCTION_READINESS_STAGING.md` & `11_PILOT_AND_PUBLIC_LAUNCH.md`

---

## 1. متطلبات ما قبل النشر (Pre-Deployment Checklist)
1. **التحقق من متغيرات البيئة (`.env.production`):**
   - التأكد من عدم استخدام أي أسرار افتراضية أو تجريبية.
   - `JWT_SECRET` مشفر بطول 32 خانة على الأقل.
   - `DATABASE_URL` يشير إلى خادم MySQL 8.4 LTS المؤمن مع شهادة SSL.
   - `REDIS_URL` مفعل بنظام التشفير وكلمة المرور.
2. **فحص سلامة المهاجرات (Migration Dry-Run):**
   - تشغيل `npm run db:migrate:deploy` أو فحص التوافق دون حذف أي بيانات سابقة.
3. **أخذ نسخة احتياطية فورية قبل النشر (Pre-Release Backup):**
   - تنفيذ `npm run db:backup` أو عبر مسار `/api/backups`.
   - التأكد من تسجيل بصمة SHA-256 في جدول `backup_records`.

---

## 2. خطوات النشر القياسية (Standard Deployment Steps)

```bash
# 1. جلب أحدث كود معتمد
git checkout main
git pull origin main

# 2. تثبيت الحزم بدقة
npm ci --prefer-offline

# 3. بناء الحزم المشتركة وقاعدة البيانات
npm run build --workspace=@digital-topup/shared
npm run generate --workspace=packages/database
npm run build --workspace=packages/database

# 4. تشغيل الاختبارات الآلية الشاملة
npm run test --workspace=apps/backend

# 5. بناء التطبيقات
npm run build --workspace=apps/backend
npm run build --workspace=apps/web-admin
npm run build --workspace=apps/web-customer

# 6. إعادة تشغيل الخدمات (Zero-Downtime Reload)
pm2 reload digital-topup-backend --update-env
pm2 reload digital-topup-admin --update-env
pm2 reload digital-topup-customer --update-env

# 7. فحص الجاهزية والمسابير (Health Check)
curl -f http://localhost:4000/api/health/ready
curl -f http://localhost:4000/api/monitoring/metrics
```

---

## 3. خطة التراجع الآمن عن الإصدار (Rollback Procedures)
في حال تسجيل أي تعثر تشغيلي، أو ارتفاع نسبة أخطاء 5xx أعلى من 1%، أو رصد أي خلل محاسبي في الأستاذ العام:

1. **تفعيل وضع الأمان الفوري (Safe Mode):**
   - تفعيل زر الطوارئ عبر لوحة الإدارة `/operations` أو مسار API لتحويل الطلبات إلى المراجعة اليدوية المؤقتة.
2. **استعادة الإصدار السابق (Binary Rollback):**
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT_TAG>
   npm run build
   pm2 reload all
   ```
3. **التعامل مع قاعدة البيانات والأموال:**
   - **قاعدة ذهبية:** ممنوع التراجع عن قاعدة البيانات بحذف أي عمليات مالية (Non-destructive Rollback).
   - في حال الحاجة لاستعادة النسخة الاحتياطية بالكامل:
     ```bash
     npx ts-node scripts/restore-db.ts --backup=<BACKUP_FILE_PATH> --verify-ledger
     ```
   - التحقق من تطابق البصمة SHA-256 وتوازن الدائن والمدين 100%.

---

## 4. مسارات المراقبة ومؤشرات الأداء اللحظية
- **لوحة عمليات الإدارة:** `http://localhost:3001/operations`
- **مركز الإطلاق التجريبي:** `http://localhost:3001/launch`
- **مسار مسبار الجاهزية:** `GET http://localhost:4000/api/health/ready`
- **مقاييس Prometheus المركزية:** `GET http://localhost:4000/api/monitoring/metrics/prometheus`
- **التوثيق الحي Swagger:** `http://localhost:4000/api/docs`
