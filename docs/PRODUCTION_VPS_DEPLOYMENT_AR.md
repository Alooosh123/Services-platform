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

من جذر المستودع على VPS:

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml config
docker compose --env-file .env.production -f docker/docker-compose.prod.yml build
docker compose --env-file .env.production -f docker/docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps
```

خدمة migrate تشغّل `prisma migrate deploy` قبل تشغيل Backend. لا تستخدم `prisma db push` على قاعدة الإنتاج. لا يوجد نشر تلقائي إلى خادم إنتاج في CI بعد؛ النشر اليدوي أعلاه يجب أن يُنفذ بعد الموافقة على الإصدار.

PostgreSQL وRedis لا يملكان منافذ منشورة على المضيف. Caddy هو المدخل العام ويصدر شهادات TLS تلقائياً بعد ضبط DNS والجدار الناري.

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
