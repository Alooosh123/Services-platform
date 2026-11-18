# دليل نشر منصة الشحن على VPS

> هذه ملفات نشر الإنتاج الأولية. لا يعني إعداد Docker وحده اعتماد المنصة لاستقبال أموال العملاء؛ يجب اجتياز بوابات الاختبار والتكاملات والنسخ الاحتياطي أدناه.

## 1. DNS والجدار الناري

أنشئ سجلات A تشير إلى عنوان VPS العام:

- `shop.example.com`
- `admin.example.com`
- `saas.example.com`
- `api.example.com`

افتح TCP 22 لعناوين الإدارة المسموحة فقط، وTCP 80 و443 للجمهور، وUDP 443 اختياري لـ HTTP/3. لا تفتح 3000 أو 4000 أو 5432 أو 6379 أو 8080 على الإنترنت.

## 2. الأسرار

انسخ المثال محلياً إلى `.env.production` في جذر المستودع، ولا ترفعه إلى Git:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32
```

ولّد قيماً مستقلة لـ PostgreSQL وRedis وJWT Access وJWT Refresh والتشفير وتوقيع Webhooks. عدّل `DATABASE_URL` و`REDIS_URL` لتطابق كلمات المرور الفعلية. استبدل كل نطاقات example.com، واستخدم بريداً صالحاً لـ ACME.

لا تغيّر `ENCRYPTION_KEY` بعد تشفير بيانات إنتاجية دون خطة تدوير مفاتيح وإعادة تشفير قابلة للاستعادة.

## 3. معاينة الإعداد والنشر

**لا تشغّل `up -d` على كامل المشروع قبل النسخ الاحتياطي ومراجعة الهجرات.** خدمة Prisma migration ملفوفة في profile يدوي حتى لا تُنفّذ تلقائياً عند تشغيل Backend.

من جذر المستودع على VPS، بعد تجهيز `.env.production`:

### أ. تحقق من الإعداد وشغّل قاعدة البيانات وRedis فقط

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml config
docker compose --env-file .env.production -f docker/docker-compose.prod.yml up -d postgres redis
docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps
```

تحقق من صحة PostgreSQL وRedis:

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml exec -T postgres pg_isready
docker compose --env-file .env.production -f docker/docker-compose.prod.yml exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" ping'
```

### ب. أنشئ نسخة احتياطية قبل أي هجرة

تأكد أولاً أن مجلد النسخ الاحتياطية موجود على قرص آمن خارج مجلد المشروع، وأنه مشمول في سياسة النسخ المشفر والاحتفاظ خارج VPS. المثال التالي يكتب أرشيف PostgreSQL على جهاز/خادم الإدارة الذي ينفذ الأمر، وليس داخل حاوية قاعدة البيانات:

```bash
mkdir -p /secure-backups/yemen-topup
BACKUP="/secure-backups/yemen-topup/pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file .env.production -f docker/docker-compose.prod.yml exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$BACKUP"
test -s "$BACKUP"
docker compose --env-file .env.production -f docker/docker-compose.prod.yml exec -T postgres pg_restore --list < "$BACKUP" >/dev/null
sha256sum "$BACKUP"
```

لا تتابع إن فشل `pg_dump` أو كان الملف فارغاً أو فشل `pg_restore --list`. احفظ نسخة ثانية مشفرة خارج VPS، ونفّذ تجربة استعادة إلى قاعدة معزولة قبل تطبيق هجرات الإنتاج. لا تعتبر مجرد إنشاء ملف نسخة احتياطية اختبار استعادة ناجحاً.

### ج. راجع حالة الهجرات ثم نفّذها صراحةً

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml --profile manual-migration run --rm migrate npx prisma migrate status --schema=packages/database/prisma/schema.prisma
```

بعد مراجعة الحالة والنسخة الاحتياطية واختبار الاستعادة والموافقة التشغيلية، نفّذ:

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml --profile manual-migration run --rm migrate
docker compose --env-file .env.production -f docker/docker-compose.prod.yml --profile manual-migration run --rm migrate npx prisma migrate status --schema=packages/database/prisma/schema.prisma
```

إذا ظهر drift أو migration failed أو نتيجة غير متوقعة، أوقف النشر ولا تعِد المحاولة عشوائياً. افحص `_prisma_migrations` وسجلات PostgreSQL وخطة الاستعادة أولاً.

### د. شغّل التطبيقات بعد نجاح التحقق

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps
```

خدمة `migrate` موجودة ضمن profile باسم `manual-migration`، ولا تُشغّل عند تنفيذ `up -d` العادي. Backend لا يعتمد عليها تلقائياً؛ يجب أن تكون مرحلة الهجرة اليدوية قد اكتملت بنجاح قبل تشغيل التطبيقات.

PostgreSQL وRedis لا يملكان منافذ منشورة على المضيف. Caddy هو المدخل العام ويصدر شهادات TLS تلقائياً بعد ضبط DNS والجدار الناري. لا تفتح 3000 أو 4000 أو 5432 أو 6379 أو 8080 على الإنترنت.

## 4. التحقق بعد النشر

```bash
curl -fsS https://api.example.com/api/health
curl -fsS https://api.example.com/api/health/ready
docker compose --env-file .env.production -f docker/docker-compose.prod.yml logs --tail=200 backend
```

اختبر تسجيل الدخول وMFA وRBAC وعزل المستأجرين والكتالوج والطلبات اليدوية والقيود المالية والمطابقة. لا تنفذ معاملات أموال حقيقية قبل اختبارات Sandbox الموثقة وموافقة المالية.

## 5. النسخ والاستعادة

- نسخة PostgreSQL مشفرة يومياً خارج VPS.
- احتفظ بنسخ WAL أو سياسة استعادة تناسب حجم المعاملات.
- لا تكتفِ بحفظ النسخ داخل نفس القرص أو volume.
- نفّذ استعادة شهرية إلى قاعدة معزولة ووثّق RPO/RTO.
- اختبر سلامة سجلات دفتر الأستاذ وتوازن القيود بعد كل استعادة.

## 6. بوابات ما قبل الإطلاق التجاري

1. محول EXTERNAL_API يظل مغلقاً حتى تنفيذ محول رسمي خاص بكل مزود وفق وثائقه ومفاتيح Sandbox/Production.
2. قنوات جيب وجوالي وكاش وون كاش وإيزي غير مفعلة حتى إثبات ملكية حسابات الاستقبال وإدخال أرقام صحيحة واعتماد Finance.
3. أرصدة الموردين يجب أن تكون حسابات SupplierAccount حقيقية وممولة بوثائق؛ لا تُستخدم Provider.balance أو أرصدة تجريبية.
4. أرباح المالك تتطلب تدقيقاً تاريخياً للتأكد من أن الطلبات القديمة المكتملة تقابل قيود دفتر أستاذ صحيحة.
5. إجراء تسوية فروقات المطابقة يتطلب أن يختار Finance حسابات موجودة وصحيحة في دليل الحسابات، ثم يعتمد موظف آخر.
6. فحص الثغرات High/Critical، اختبارات اختراق، استعادة احتياطية، واختبار حمل حي لم يتم اعتمادها بعد.
