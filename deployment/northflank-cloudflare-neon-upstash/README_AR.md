# خطة نقل Services-platform وn8n إلى Northflank + Cloudflare + Neon + Upstash

> **الحالة: تجهيز Staging فقط.** لا تعتبر هذه الملفات تصريحاً لإطلاق منصة مالية أو استقبال أموال حقيقية. لم يتم إنشاء موارد في حسابات Northflank/Cloudflare/Neon/Upstash ولم يتم نشر أي خدمة من هذا المستودع حتى الآن.

## 1) مخطط الاستضافة المعتمد

| المكوّن | الوجهة | إعداد النشر |
|---|---|---|
| NestJS API | Northflank: خدمة واحدة services-platform-api | بناء من جذر المستودع، Dockerfile هو docker/Dockerfile.backend، والمنفذ 4000 |
| n8n | Northflank: خدمة ثانية services-platform-n8n | صورة n8nio/n8n:2.49.5، المنفذ 5678 |
| PostgreSQL للمنصة | Neon project مستقل services-platform-staging | DATABASE_URL عبر pooler للتطبيق، وDIRECT_URL للترحيلات |
| PostgreSQL لـ n8n | Neon project مستقل services-platform-n8n | قاعدة وبيانات اعتماد منفصلة عن المنصة |
| Redis | Upstash Redis | اتصال Redis TCP/TLS في REDIS_URL، وليس REST API |
| واجهة العميل | Cloudflare Workers | تطبيق مستقل من apps/web-customer |
| لوحة الإدارة | Cloudflare Workers | تطبيق مستقل من apps/web-admin |
| SaaS | Cloudflare Workers | تطبيق مستقل من apps/web-saas |

خطة Northflank Sandbox الحالية تعرض خدمتين مجانيتين وإضافة قاعدة بيانات واحدة؛ التصميم يستخدم الخدمتين للخادم وn8n، ويترك قاعدة الإضافة غير مستخدمة لأن قواعد البيانات ستكون على Neon. تحقّق من حدود الخطة وطريقة التحقق من الحساب داخل لوحة Northflank قبل الإنشاء.

## 2) إعداد Northflank

### خدمة API
- النوع: Combined service (Build + Deploy).
- Git repository: Alooosh123/Services-platform.
- فرع Staging: infra/northflank-cloudflare-neon-upstash إلى أن يراجع طلب الدمج ويُعتمد.
- Build context: جذر المستودع (/).
- Dockerfile: docker/Dockerfile.backend.
- المنفذ العام: 4000.
- Health check: GET /api/health/ready، ويجب أن يرجع 200 بعد نجاح اتصال PostgreSQL وRedis.
- لا تضبط CORS_ORIGIN على *; أدخل أصول Cloudflare الثلاثة بدقة بعد صدورها.

### خدمة n8n
- Image: n8nio/n8n:2.49.5 لمطابقة النسخة المحلية التي تم تدقيقها، ثم تتم ترقية النسخة بشكل منفصل بعد اختبارات التوافق.
- Port: 5678.
- أضف قاعدة بيانات Neon منفصلة مع مستخدم مخصص لـ n8n. لا تستخدم مستخدم Prisma أو قاعدة بيانات المنصة.
- اربط نطاق HTTPS مخصصاً، واضبط WEBHOOK_URL وN8N_EDITOR_BASE_URL عليه.
- إعدادات أساسية (القيم السرية تحفظ في Secret Manager ولا تضاف إلى Git):
  - NODE_ENV=production
  - N8N_PORT=5678
  - N8N_PROTOCOL=https
  - N8N_HOST=<n8n-hostname>
  - N8N_EDITOR_BASE_URL=https://<n8n-hostname>/
  - WEBHOOK_URL=https://<n8n-hostname>/
  - N8N_PROXY_HOPS=1
  - N8N_SECURE_COOKIE=true
  - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
  - N8N_ENCRYPTION_KEY=<stable-random-secret>
  - GENERIC_TIMEZONE=Asia/Aden وTZ=Asia/Aden
  - DB_TYPE=postgresdb
  - DB_POSTGRESDB_HOST, DB_POSTGRESDB_PORT=5432, DB_POSTGRESDB_DATABASE, DB_POSTGRESDB_USER, DB_POSTGRESDB_PASSWORD
  - DB_POSTGRESDB_SCHEMA=n8n
  - DB_POSTGRESDB_SSL_ENABLED=true
- فعّل HTTPS، حساب مالك n8n، MFA، وحماية لوحة المحرر بطبقة وصول مثل Cloudflare Access. أبقِ Webhooks محمية بمصادقة مستقلة؛ لا تجعل Webhook غير موثّق لمجرد أن لوحة المحرر محمية.
- احتفظ بمفتاح N8N_ENCRYPTION_KEY في مدير أسرار خارج Git وخذ نسخة آمنة منه. فقدانه يمنع فك تشفير بيانات الاعتماد المحفوظة.
- استخدم Volume دائم إذا كانت التدفقات تعتمد على ملفات محلية أو بيانات Binary. لا تعتمد على نظام ملفات الحاوية المؤقت لتخزين ملفات يحتاجها سير العمل.

## 3) إعداد Neon وPrisma

أنشئ مشروعين منفصلين:
1. services-platform-staging لقاعدة بيانات المنصة.
2. services-platform-n8n لقاعدة n8n.

في مشروع المنصة:
- استخدم عنوان Neon الذي يحتوي -pooler في DATABASE_URL لحركة التطبيق.
- استخدم العنوان المباشر (من دون -pooler) في DIRECT_URL لتشغيل Prisma Migrate.
- استخدم TLS مع sslmode=require.
- لا تشغّل prisma db push على قاعدة تحتوي بيانات فعلية؛ اعتمد ملفات migrations المراجعة فقط.
- نفّذ npm run db:migrate:deploy --workspace=packages/database كخطوة يدوية/Job منفصلة بعد نسخة احتياطية وفحص نسخة Staging. لا تضع الترحيلات داخل كل إعادة تشغيل للخادم.
- لا تشغّل db:seed أو RESET_DATABASE_SEED=true على أي قاعدة إنتاجية. Seeder الحالي مخصص للتطوير ويحوي حسابات وقيم دفع تجريبية.

## 4) إعداد Upstash Redis

يستخدم Backend مكتبة Redis TCP ويعتمد على Lua EVAL وعمليات MULTI ومجموعات الجلسات لتخزين idempotency وجلسات Refresh Token. لذلك:
- أنشئ قاعدة Upstash Redis واختر Redis TCP connection، لا REST URL.
- خزّن الاتصال في REDIS_URL بصيغة TLS مثل rediss://default:<password>@<tcp-endpoint>:6379.
- لا تنسخ بيانات الاتصال إلى الواجهة أو ملفات Workflow أو المستودع.
- اختبر PING وEVAL وMULTI وعمليات الجلسات في Staging قبل قبول جاهزية Backend.

## 5) إعداد Cloudflare للواجهات الثلاث

المستودع يستخدم Next.js 14.1. محوّل @opennextjs/cloudflare الحالي لا يدعم Next.js 14، ولذلك لا نضيف إعداد OpenNext قد يفشل عند البناء. المسار المرشح هو vinext الذي يوفّر فحص توافق ثم تهيئة غير هدامة للتطبيق الحالي، لكنه ما زال في Beta؛ لا يُعتمد للإنتاج قبل فحص كل تطبيق وتجربة تدفقات تسجيل الدخول والصفحات الديناميكية وطلبات API.

من جذر المستودع شغّل:
    .\scripts\check-cloudflare-vinext.ps1

راجع تقارير الفحص. بعد نجاح الفحص لكل تطبيق، نفّذ vinext init --platform=cloudflare من داخل مجلد التطبيق الواحد تلو الآخر، مع مراجعة كل فرق قبل اعتماده. لا تحذف سكربتات Next.js الحالية؛ يجب أن يبقى مسار التطوير الحالي صالحاً أثناء التقييم.

بعد إعداد كل Worker:
- Customer: نطاق مستقل.
- Admin: نطاق مستقل، ويُفضّل حمايته بطبقة وصول موثوقة.
- SaaS: نطاق مستقل.
- اضبط متغير البناء NEXT_PUBLIC_API_URL=https://<api-hostname>/api في كل تطبيق يحتاج API، ثم أعد البناء والنشر عند تغييره.
- اضبط CORS_ORIGIN في Northflank على النطاقات الثلاثة الفعلية مفصولة بفواصل.
- لا تنشر لوحة الإدارة للعامة قبل إزالة سلوكيات Demo/Fallback التي قد تعرض بيانات وهمية أو تقبل تسجيل دخول تجريبياً عند تعطل API؛ راجع خصوصاً صفحة تسجيل الدخول وشاشات الأموال/المحافظ/السجل.

## 6) متغيرات Backend المطلوبة في Northflank

| المتغير | الاستخدام |
|---|---|
| NODE_ENV | production |
| PORT | 4000 |
| API_PREFIX | api |
| DATABASE_URL | Neon pooled URL |
| DIRECT_URL | Neon direct URL للترحيلات |
| REDIS_URL | Upstash Redis TLS TCP URL |
| JWT_SECRET | سر وصول عشوائي مستقل لا يقل عن 32 حرفاً |
| JWT_REFRESH_SECRET | سر Refresh مستقل لا يقل عن 32 حرفاً |
| ENCRYPTION_KEY | 32 بايت بصيغة 64 خانة Hex |
| WEBHOOK_HMAC_SECRET | سر HMAC عشوائي لا يقل عن 32 بايت |
| CORS_ORIGIN | أصول Cloudflare الثلاثة |
| NEXT_PUBLIC_API_URL | قيمة بناء الواجهات، وليست بديلاً عن CORS |

ولّد الأسرار داخل بيئتك الآمنة، ولا ترسلها في المحادثة أو تضعها في GitHub. لا تستخدم قيم .env.example في Staging أو Production.

## 7) نقل n8n دون نقل مخاطر التدفقات المحلية

المستودع يحتوي أدلة ومصفوفات جاهزية، لكنه لا يحتوي JSON الفعلي لوكلاء n8n الـ31 الموجودة في نسختك المحلية. لذلك لا يمكن نقل تعريفات التدفقات من GitHub وحده.

التسلسل الآمن:
1. خذ نسخة احتياطية من قاعدة n8n المحلية قبل التصدير.
2. صدّر Workflow definitions فقط من n8n المحلي إلى مجلد مؤقت، ولا تصدّر كلمات مرور أو بيانات اعتماد مفكوكة التشفير.
3. راجع كل Workflow على حدة، ثم استورد كمسودات غير مفعّلة إلى Northflank n8n.
4. أعد إنشاء Credentials يدوياً داخل n8n الجديد، واربط كل عقدة بالاعتماد الصحيح، ثم اختبرها ببيانات وهمية.
5. تحقق من أن كل التدفقات لا تزال غير نشطة قبل كشف أي Webhook للعامة.

**ممنوع تفعيل الوكلاء المالية 04 و05 و06 و10** أو منح n8n صلاحية إضافة رصيد أو كتابة Ledger أو اعتماد إيداع أو إرسال حوالة أو تنفيذ استرداد. كما يجب إصلاح مصادقة Webhooks لوكلاء SmartNet وربط Header Auth المفقود في تدفقات Services-platform قبل استيرادها. لا تمنح n8n JWT مالك المنصة أو المدير المالي.

## 8) اختبارات قبول Staging قبل أي Cutover

- [ ] GET /api/health/live يرجع 200.
- [ ] GET /api/health/ready يرجع 200 مع PostgreSQL وRedis.
- [ ] Prisma migrations تُنفّذ على قاعدة Staging فارغة/مخصصة دون حذف بيانات.
- [ ] تسجيل دخول عميل حقيقي على بيئة اختبار، دون استخدام حسابات Seeder.
- [ ] طلبات الواجهة تصل إلى API عبر Cloudflare domains، لا إلى localhost.
- [ ] CORS يسمح بالنطاقات الثلاثة فقط.
- [ ] اختبار Redis EVAL وعمليات الجلسات وidempotency.
- [ ] n8n UI محمي، وWebhooks محمية بمصادقة، وكل Workflows غير نشطة حتى إكمال المراجعة.
- [ ] أخذ نسخة احتياطية من Neon وإجراء Restore drill مستقل مع قياس RPO/RTO.
- [ ] مراجعة أمنية للواجهات التجريبية ومراجعة مالية مستقلة.

## 9) حدود التنفيذ الحالية

هذا التغيير يجهّز المستودع ودليل الترحيل. لم يتم ربط حسابات Northflank أو Cloudflare أو Neon أو Upstash، ولم تُنشأ قاعدة Neon أو Redis، ولم يُنشر Backend أو n8n أو أي Worker. إنشاء الموارد يتطلب تسجيل الدخول إلى حسابات تلك المنصات وإضافة الأسرار من لوحاتها. يظل مشروع Railway السابق كما هو دون حذف أو تعديل.
