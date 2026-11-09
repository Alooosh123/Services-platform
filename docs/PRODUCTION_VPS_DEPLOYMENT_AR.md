# دليل نشر المنصة على VPS — بيئة الإنتاج

> هذا الدليل يجهز تشغيل التطبيق على خادم واحد. وجود ملفات Compose لا يعني اعتماد المنصة للإطلاق المالي؛ يجب اجتياز الاختبارات والتكاملات الخارجية والنسخ الاحتياطي قبل استقبال أموال العملاء.

## 1. DNS والجدار الناري

أنشئ سجلات A للنطاقات التالية لتشير إلى عنوان VPS العام:

- `shop.example.com`
- `admin.example.com`
- `saas.example.com`
- `api.example.com`

افتح TCP 22 من عناوين الإدارة المسموح بها فقط، وTCP 80 و443 للجمهور. افتح UDP 443 إذا أردت HTTP/3. لا تفتح 3000 أو 4000 أو 5432 أو 6379 أو 8080 على الإنترنت.

## 2. إعداد الأسرار

انسخ المثال إلى ملف محلي خارج Git:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

ولّد أسراراً مستقلة:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

استخدم نتائج مختلفة لقيم `POSTGRES_PASSWORD` و`REDIS_PASSWORD` و`JWT_SECRET` و`JWT_REFRESH_SECRET` و`ENCRYPTION_KEY` و`WEBHOOK_HMAC_SECRET`. عدّل `DATABASE_URL` و`REDIS_URL` لتتطابق كلمات المرور. استخدم hex حتى لا تحتاج كلمات المرور إلى URL-encoding. لا ترسل هذه القيم عبر المحادثة أو تحفظها في GitHub.

استبدل جميع قيم `example.com`، وحدد بريداً صالحاً لـ ACME، وأضف سجلات DNS الفعلية. تأكد من أن حساب الإدارة الأول لديه MFA حقيقي قبل منح الصلاحيات المالية.

## 3. نشر الخدمات

من جذر المستودع على الخادم:

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml config
docker compose --env-file .env.production -f docker/docker-compose.prod.yml build
docker compose --env-file .env.production -f docker/docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps
```

يشغّل Compose ترحيلات Prisma أولاً، ثم Backend والواجهات وCaddy. قاعدة البيانات وRedis لا يملكان منافذ منشورة على المضيف؛ الوصول إليهما يتم من الشبكات الداخلية فقط. لا تستخدم `prisma db push` في الإنتاج.

## 4. التحقق بعد النشر

```bash
curl -fsS https://api.example.com/api/health
curl -fsS https://api.example.com/api/health/ready
docker compose --env-file .env.production -f docker/docker-compose.prod.yml logs --tail=200 backend
```

تحقق أيضاً من تسجيل الدخول وRBAC وعزل المستأجرين والكتالوج والطلب التجريبي والإيداعات اليدوية والمطابقة. لا تنفذ عمليات مالية حقيقية قبل قبول اختبارات Sandbox الموثقة.

## 5. النسخ الاحتياطي

- خذ نسخة مشفرة يومية خارج VPS من PostgreSQL.
- احتفظ بنسخ WAL أو سياسة استعادة مناسبة لقيمة المعاملات.
- لا تضع النسخ الاحتياطية في نفس volume فقط.
- نفّذ تجربة استعادة شهرية إلى قاعدة معزولة وسجل RPO/RTO.
- لا تعتبر backup ناجحاً قبل نجاح restore فعلي.

## 6. الإيقاف والاستعادة

```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml stop
docker compose --env-file .env.production -f docker/docker-compose.prod.yml start
```

عند التحديث، خذ نسخة احتياطية، راجع PR ونتائج CI، ثم أعد البناء والتشغيل. لا تتجاوز ترحيلات قاعدة البيانات أو تغيّر مفاتيح التشفير دون خطة تدوير واستعادة.

## 7. بوابات إطلاق لا يغطيها النشر

1. وثائق ومفاتيح Sandbox/Production لمزودي الشحن غير متاحة في المستودع؛ محول `EXTERNAL_API` سيظل يفشل مغلقاً حتى إضافة محول خاص بكل مزود.
2. بيانات استقبال محافظ جيب وجوالي وكاش وون كاش وإيزي لم تعتمد بعد؛ القنوات معطلة حتى إثبات ملكية الحسابات واعتمادها مالياً.
3. أرباح المالك لا تُسحب من أرقام تقديرية أو بيانات ذاكرة؛ يلزم وجود رصيد أرباح دائم ناتج من مسار محاسبي معتمد.
4. ترحيل فروقات المطابقة إلى دفتر الأستاذ لا يزال يتطلب تعريف حسابات تصنيف مسموحة وموافقة مالية مستقلة؛ إجراء `ADJUST_LEDGER` يبقى محجوباً حتى اكتمال ذلك.
5. لا يوجد حتى الآن اختبار فعلي على VPS، أو فحص اختراق مستقل، أو تجربة استعادة RTO/RPO موثقة.
