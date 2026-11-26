# خطة نقل Services-platform وn8n إلى Northflank + Cloudflare + Neon + Upstash

> **الحالة: تجهيز Staging فقط.** لا تعتبر هذه الملفات تصريحاً لإطلاق منصة مالية أو استقبال أموال حقيقية. لم يتم إنشاء موارد في حسابات Northflank/Cloudflare/Neon/Upstash ولم يتم نشر أي خدمة من هذا المستودع حتى الآن.

## 1) مخطط الاستضافة المعتمد

| المكوّن | الوجهة | إعداد النشر |
|---|---|---|
| NestJS API | Northflank: services-platform-api | جذر المستودع، docker/Dockerfile.backend، المنفذ 4000 |
| n8n | Northflank: services-platform-n8n | n8nio/n8n:2.49.5، المنفذ 5678 |
| PostgreSQL للمنصة | Neon project مستقل services-platform-staging | DATABASE_URL عبر pooler للتطبيق، وDIRECT_URL للترحيلات |
| PostgreSQL لـ n8n | Neon project مستقل services-platform-n8n | قاعدة ومستخدم مستقلان تماماً عن المنصة |
| Redis | Upstash Redis | اتصال Redis TCP/TLS في REDIS_URL، وليس REST API |
| واجهة العميل | Cloudflare Workers | apps/web-customer |
| لوحة الإدارة | Cloudflare Workers | apps/web-admin |
| SaaS | Cloudflare Workers | apps/web-saas |

خطة Northflank Sandbox الحالية تعرض خدمتين، ووظيفتين، وإضافة قاعدة بيانات واحدة، وحتى 20 دولاراً من موارد Northflank شهرياً، مع تشغيل دائم دون نوم. الخدمتان تكفيان مبدئياً لـ API وn8n؛ قواعد البيانات ستكون في Neon وRedis في Upstash. الخطة للتجربة وليست للإنتاج. راجع [Northflank Pricing](https://northflank.com/pricing).

## 2) إعداد Northflank

### خدمة API
- النوع: Combined service (Build + Deploy).
- Git repository: Alooosh123/Services-platform.
- فرع Staging: infra/northflank-cloudflare-neon-upstash إلى أن يجتاز طلب الدمج الاختبارات والمراجعة.
- Build context: جذر المستودع (/).
- Dockerfile: docker/Dockerfile.backend.
- المنفذ الداخلي: 4000. اتصال n8n بالخدمة يستخدم عنوان Northflank الداخلي services-platform-api:4000. لا تجعل المنفذ عاماً إلا عند الحاجة.
- Health check: GET /api/health/ready، ويجب أن يرجع 200 بعد نجاح اتصال PostgreSQL وRedis.
- لا تضبط CORS_ORIGIN على *; أدخل أصول Cloudflare الثلاثة بدقة بعد صدورها.

### خدمة n8n
- Image: n8nio/n8n:2.49.5 لمطابقة النسخة المحلية المدققة، ثم تتم ترقية النسخة بعد اختبارات توافق منفصلة.
- المنفذ الداخلي: 5678.
- أضف قاعدة Neon منفصلة مع مستخدم مخصص لـ n8n. لا تستخدم مستخدم Prisma أو قاعدة بيانات المنصة.
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
  - N8N_BLOCK_ENV_ACCESS_IN_NODE=true
  - N8N_ENCRYPTION_KEY=<stable-random-secret>
  - GENERIC_TIMEZONE=Asia/Aden وTZ=Asia/Aden
  - DB_TYPE=postgresdb
  - DB_POSTGRESDB_HOST, DB_POSTGRESDB_PORT=5432, DB_POSTGRESDB_DATABASE, DB_POSTGRESDB_USER, DB_POSTGRESDB_PASSWORD
  - DB_POSTGRESDB_SCHEMA=n8n
  - DB_POSTGRESDB_SSL_ENABLED=true
- اجعل منفذ n8n داخلياً. لا تفتح لوحة المحرر للإنترنت بلا طبقة وصول وMFA. إذا احتاجت Webhooks استقبالاً عاماً، افصل حماية المسارات عن حماية لوحة المحرر واجعل كل Webhook بمصادقة مستقلة.
- فعّل حساب مالك n8n وMFA، واحمِ لوحة المحرر بطبقة وصول مثل Cloudflare Access.
- احتفظ بمفتاح N8N_ENCRYPTION_KEY في مدير أسرار خارج Git وخذ نسخة آمنة منه. فقدانه يمنع فك تشفير بيانات الاعتماد المحفوظة.
- استخدم Volume دائم إذا كانت التدفقات تعتمد على ملفات محلية أو بيانات Binary. لا تعتمد على نظام ملفات الحاوية المؤقت.
- **لا تضبط N8N_BLOCK_ENV_ACCESS_IN_NODE=false كحل سريع.** صرّحنا به true كي لا تستطيع Code Nodes قراءة أسرار الخدمة. يجب إزالة مراجع $env من Code Nodes وتحويل المصادقة إلى Credentials مناسبة قبل تفعيل أي Workflow.
- N8N_BASE_URL متغير خاص بتدفقات المشروع وليس هو إعداد n8n العام. إعداد عنوان Webhook العام يكون عبر WEBHOOK_URL، وواجهة التحرير عبر N8N_EDITOR_BASE_URL.

## 3) إعداد Neon وPrisma

أنشئ مشروعين منفصلين:
1. services-platform-staging لقاعدة بيانات المنصة.
2. services-platform-n8n لقاعدة n8n.

في مشروع المنصة:
- استخدم عنوان Neon الذي يحتوي -pooler في DATABASE_URL لحركة التطبيق، والعنوان المباشر في DIRECT_URL للترحيلات. اختر الاتصال من نافذة Connect في Neon وتأكد من المضيف وقيم TLS.
- استخدم TLS مع sslmode=require.
- لا تشغّل prisma db push على قاعدة تحتوي بيانات فعلية؛ اعتمد ملفات migrations المراجعة فقط.
- نفّذ npm run db:migrate:deploy --workspace=packages/database كخطوة يدوية/Job منفصلة بعد نسخة احتياطية وفحص Staging. لا تضع الترحيلات داخل كل إعادة تشغيل للخادم.
- لا تشغّل db:seed أو RESET_DATABASE_SEED=true على أي قاعدة إنتاجية. Seeder الحالي مخصص للتطوير ويحوي حسابات وقيم دفع تجريبية.
- Neon يدعم عنواناً مجمّعاً للتطبيق وعنواناً مباشراً للترحيلات؛ راجع [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

## 4) إعداد Upstash Redis

يستخدم Backend مكتبة Redis TCP ويعتمد على Lua EVAL وعمليات MULTI ومجموعات الجلسات لتخزين idempotency وجلسات Refresh Token. لذلك:
- أنشئ قاعدة Upstash Redis واختر Redis TCP connection، لا REST URL.
- خزّن الاتصال في REDIS_URL بصيغة TLS مثل rediss://default:<password>@<tcp-endpoint>:6379.
- لا تنسخ بيانات الاتصال إلى الواجهة أو ملفات Workflow أو المستودع.
- اختبر PING وEVAL وMULTI وعمليات الجلسات في Staging قبل قبول جاهزية Backend.

## 5) إعداد Cloudflare للواجهات الثلاث

المستودع يستخدم Next.js 14.1. مسار الترحيل المرشح حالياً هو vinext على Cloudflare Workers. توصي Cloudflare بـ vinext للتطبيقات Next.js، لكن vinext ما زال في Beta؛ نتيجة vinext check ليست إثبات بناء أو اعتماد إنتاجي. راجع [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/).

من جذر المستودع شغّل:
    .\scripts\check-cloudflare-vinext.ps1

تم تشغيل الفحص محلياً على التطبيقات الثلاث بتاريخ 2026-11-27، وأظهرت السجلات التي قدمها مالك المشروع 100% توافقاً مبدئياً دون مشكلات مكتشفة. هذا الفحص يراجع مجموعة محدودة من imports/config/library/structure فقط.

الخطوات التالية بعد مراجعة سجل كل تطبيق:
1. نفّذ vinext init داخل تطبيق واحد في كل مرة، واختر Cloudflare Workers عند ظهور الخيار.
2. راجع كل الملفات التي أضافها أو عدّلها initializer، ولا تستبدل إعدادات Next.js القديمة قبل نجاح البناء.
3. شغّل build وdev:vinext، ثم اختبر App Router وSSR وRSC وServer Actions وطلبات API وتسجيل الدخول والتنقل.
4. انشر Customer وAdmin وSaaS في Workers منفصلة بعد اجتياز اختبارات كل تطبيق.

بعد إعداد كل Worker:
- Customer: نطاق مستقل.
- Admin: نطاق مستقل، ويُفضّل حمايته بطبقة وصول موثوقة.
- SaaS: نطاق مستقل.
- اضبط NEXT_PUBLIC_API_URL=https://<api-hostname>/api في كل تطبيق يحتاج API، ثم أعد البناء والنشر عند تغييره.
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

ولّد الأسرار داخل بيئتك الآمنة، ولا ترسلها في المحادثة أو تضعها في GitHub. لا تستخدم قيم .env.example في Staging أو Production.

## 7) تدقيق n8n المحلي الذي تم إنجازه

نتائج التدقيق المحلي المقدمة بتاريخ 2026-11-27:

- n8n المحلي: 2.49.5.
- تعريفات التدفقات المصدّرة: 31، منها 30 تدفقاً يحتوي عقداً وتدفق واحد فارغ Services-Platform-n8n.
- جميع التدفقات الـ31 في التصدير المحلي كانت active=false.
- يوجد 14 inbound Webhook في تدفقات Services-platform بإعداد headerAuth لكن بلا httpHeaderAuth binding في المصدر.
- يوجد 13 inbound Webhook لـ SmartNet بإعداد headerAuth وربط httpHeaderAuth محلياً؛ يجب إنشاء وربط الاعتماد من جديد في الخدمة الجديدة.
- توجد 13 سجلاً لـ OpenAI credentials ضمن تدفقات SmartNet؛ يجب إعادة إنشائها في target n8n.
- عقد Respond to Webhook عددها 13، وهي عقد استجابة وليست Webhook استقبال. يجب عدم تصنيفها كثغرات Webhook inbound.
- مراجع متغيرات البيئة التي تم رصدها: N8N_BASE_URL (25)، SP_LLM_BASE_URL (10)، SP_LLM_MODEL (10)، SP_LLM_API_KEY (10)، SP_API_BASE_URL (3)، SP_API_TOKEN (2)، SP_N8N_AGENT_TOKEN (15)، SP_ADMIN_BASE_URL (2)، TELEGRAM_BOT_TOKEN (1)، TELEGRAM_CHAT_ID (2). مجموع المراجع 80؛ هذه أعداد مراجع لا عدد أسرار فريدة.
- ظهرت ثلاثة Code Nodes تستخدم $env: اثنتان لـ SP_ADMIN_BASE_URL وواحدة لـ TELEGRAM_BOT_TOKEN. لا تفعّل الوصول إلى متغيرات بيئة الخادم لحل ذلك؛ أعد تصميم تلك العقد لاستخدام مدخلات Workflow غير السرية أو Telegram Credentials.
- توجد مراجع محلية إلى n8n (5678)، وOllama (11434)، وBackend (4000)، وFastAPI (8000)، وخدمة غير معروفة (3001). لا تستبدل العناوين آلياً قبل مراجعة كل عقدة ومسارها.
- توجد 14 Webhooks تحتاج ربط اعتماد؛ لا تخلط بين ضبط headerAuth ووجود Credential فعلي مرتبط بالعقدة.

### بوابة نقل التدفقات

1. احتفظ بمجلد source-workflows-private محلياً وبشكل خاص. لا ترفعه إلى GitHub أو ترسله في المحادثة.
2. استخدم سكربت Export-LocalWorkflowsForCloud.ps1 المحدث. سيستثني التدفق الفارغ من مجلد المراجعة، ويعدّ فقط n8n-nodes-base.webhook كـ inbound webhook، ويسجل أسماء متغيرات البيئة والعقد المرتبطة بها دون تسجيل قيمها.
3. جميع النسخ الناتجة في review-only-workflows غير مفعّلة وليست جاهزة للاستيراد. اقرأ ImportReadiness في تقرير workflow-migration-review.csv وعالج كل مانع.
4. انقل قيم URL غير السرية إلى إعدادات Workflow واضحة أو مدخلات Set، ولا تضع مفاتيح API أو Tokens في Set fields أو بيانات تنفيذ Workflow.
5. استخدم Credentials مخصصة لـ OpenAI وTelegram وHTTP Header Auth وBackend API، ثم اربط كل عقدة يدوياً في target n8n.
6. أعد بناء Code Nodes التي تقرأ $env؛ لا تفتح قراءة بيئة الخادم لكل التدفقات.
7. افحص كل HTTP Request وعناوينه وطرقها وWebhook path والمصادقة والبيانات المرسلة قبل السماح بالاستيراد.
8. استورد كمسودات غير نشطة، واختبر مع بيانات وهمية وسجلات تشغيل نظيفة.

**ممنوع تفعيل الوكلاء المالية 04/05/06/10** أو منح n8n صلاحية إضافة رصيد أو كتابة Ledger أو اعتماد إيداع أو إرسال حوالة أو تنفيذ استرداد. كما يجب إصلاح مصادقة Webhooks لوكلاء Services-platform وربط Header Auth المفقود قبل اختبارها. لا تمنح n8n JWT مالك المنصة أو المدير المالي.

## 8) بوابة الاختبار والقبول في Staging

- [ ] GitHub CI: npm ci، Prisma Client generation، backend unit tests، monorepo build، وnpm audit.
- [ ] GET /api/health/live يرجع 200.
- [ ] GET /api/health/ready يرجع 200 مع PostgreSQL وRedis.
- [ ] Prisma migrations تُنفّذ على قاعدة Staging مخصصة دون حذف بيانات.
- [ ] اختبار اتصال Neon pooled/direct بما يتوافق مع استخدام التطبيق والترحيلات.
- [ ] اختبار Redis PING وEVAL وMULTI وعمليات الجلسات وidempotency.
- [ ] تسجيل دخول مستخدم اختبار جديد دون الاعتماد على Seeder أو حسابات تجريبية.
- [ ] طلبات الواجهة تصل إلى API عبر Cloudflare domains، لا إلى localhost.
- [ ] CORS يسمح بالنطاقات الثلاثة فقط.
- [ ] n8n UI محمي، وWebhooks محمية بمصادقة، وكل Workflows غير نشطة حتى إكمال المراجعة.
- [ ] اختبار تدفقات غير مالية أولاً ببيانات وهمية.
- [ ] أخذ نسخة احتياطية من Neon وإجراء Restore drill مستقل مع قياس RPO/RTO.
- [ ] مراجعة أمنية للواجهات التجريبية ومراجعة مالية مستقلة.

## 9) حدود التنفيذ الحالية

تم تجهيز مستودع النقل وبدأت إضافة فحوص CI ومراجعة أكثر صرامة لتصدير n8n. لكن لم يتم إنشاء موارد في Northflank أو Neon أو Upstash أو Cloudflare، ولم يُنشر Backend أو n8n أو أي Worker من خلال هذه التعديلات. هذا يتطلب تسجيل الدخول إلى حسابات تلك المنصات وإضافة الأسرار في لوحاتها. لا نملك في هذه الجلسة وصولاً تنفيذياً إلى حسابات Northflank/Neon/Upstash/Cloudflare أو جهاز Windows المحلي؛ لذلك تُنفذ اختبارات الجهاز واستيراد n8n من نسخة المستخدم بعد تحديث الفرع. مشروع Railway السابق لم يُحذف أو يُعدّل.


### تشغيل اختبار Staging بعد النشر

بعد إنشاء الخدمات وصدور عناوين HTTPS الفعلية، شغّل من Windows (طلبات قراءة فقط، دون إنشاء مستخدمين أو طلبات أو حركات أموال):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\\scripts\\Test-ServicesPlatformStaging.ps1" `
  -ApiBaseUrl "https://<api-hostname>" `
  -CustomerUrl "https://<customer-domain>" `
  -AdminUrl "https://<admin-domain>" `
  -SaasUrl "https://<saas-domain>"
```

يقيس السكربت صحة Backend liveness/readiness، واستجابة الواجهات الثلاث، وCORS لكل نطاق، ويحفظ تقرير CSV محلياً في artifacts/staging-smoke-tests. لا تمرر رابط n8n العام إن كان المحرر خاصاً؛ تحقق منه من داخل Northflank أو عبر جلسة وصول إدارية.

يستخدم GitHub Actions عنوان placeholder محجوزاً (`https://api.staging.invalid/api`) لبناء الواجهات فقط؛ ليس عنوان API حقيقياً ولا يُستخدم في نشر Workers.

كما أصبحت واجهتا العميل والإدارة ترفضان بناء Production عند غياب NEXT_PUBLIC_API_URL أو عند عدم استخدام HTTPS. لذلك يجب ضبط هذا المتغير عند البناء في بيئة النشر.
