# دليل التشغيل المحلي على Windows — منصة الشحن والخدمات الرقمية

هذا الدليل مخصص للتشغيل المحلي فقط على Windows 10/11 باستخدام PowerShell وDocker Desktop. لا يفعّل أي محفظة مالية ولا يرسل أموالاً حقيقية ولا يغيّر قاعدة إنتاجية.

## 1. فحص الأدوات

افتح PowerShell داخل مجلد المشروع، ثم نفّذ:

~~~powershell
node --version
npm --version
docker version
docker info --format '{{.OSType}}'
docker compose version
~~~

متطلبات المستودع: Node.js من 20.19.0 إلى أقل من 25، وnpm 10 أو أحدث. يجب أن يعرض Docker نوع التشغيل linux وأن تظهر معلومات Client وServer معاً.

اختبر Docker Engine:

~~~powershell
docker run --rm hello-world
~~~

لا تبدأ تنزيل صور قواعد البيانات قبل نجاح هذا الاختبار.

## 2. حل مشكلة Docker Hub DNS

قد يظهر أثناء سحب PostgreSQL أو Redis خطأ مثل:

~~~text
failed to resolve reference "docker.io/library/postgres:16-alpine"
lookup registry-1.docker.io: no such host
~~~

هذا الخطأ يعني أن Docker Desktop لم يستطع الوصول إلى اسم سجل Docker Hub عبر DNS. لا يعني وجود خلل في كود المنصة أو Prisma.

نفّذ فحوص Windows التالية:

~~~powershell
Write-Host "===== WINDOWS DNS =====" -ForegroundColor Cyan
nslookup google.com
nslookup registry-1.docker.io
nslookup auth.docker.io

Write-Host "===== INTERNET ROUTE =====" -ForegroundColor Cyan
Test-NetConnection 1.1.1.1 -Port 443

Write-Host "===== DOCKER HUB HTTPS =====" -ForegroundColor Cyan
curl.exe -I --max-time 15 https://registry-1.docker.io/v2/

Write-Host "===== LOCAL IMAGES =====" -ForegroundColor Cyan
docker image ls

Write-Host "===== EXISTING CONTAINERS =====" -ForegroundColor Cyan
docker ps -a
~~~

### تفسير النتيجة

1. إذا فشل nslookup على Windows نفسه، أصلح DNS أو الاتصال أو VPN على Windows/الموجّه أولاً. لا تحاول تغيير إعدادات Compose؛ فالمشكلة تحدث قبل بدء الحاوية.
2. إذا نجح nslookup على Windows لكن docker pull ما زال يفشل، افتح Docker Desktop > Settings > Resources > Proxies وراجع تحديداً Containers proxy. هذا الإعداد هو الذي يمر عبره تنزيل الصور. استخدم إعداد System أو Same as host عندما تكون شبكتك تستخدم Proxy نظامياً، أو No proxy عندما يكون الاتصال المباشر هو الإعداد الصحيح. لا تخترع عنوان Proxy ولا تستخدم خادماً عاماً مجهولاً.
3. افتح Settings > Resources > Network واترك DNS resolution behavior على Auto أولاً. إذا كانت الشبكة لا تدعم IPv6 بصورة صحيحة، افحص خيارات التوافق قبل تغيير وضع الشبكة.
4. إذا كان Windows Firewall أو برنامج حماية يمنع Docker، تحقق من السماح للعملية com.docker.backend.exe بالاتصال الصادر. لا توقف جدار الحماية بالكامل.
5. عند استخدام شبكة شركة أو VPN، قد تحتاج النطاقات الرسمية التالية إلى السماح عبر سياسة مسؤول الشبكة: registry-1.docker.io وauth.docker.io وproduction.cloudfront.docker.com.

مراجع Docker الرسمية:
- إعدادات Proxy وNetwork: https://docs.docker.com/desktop/settings-and-maintenance/settings/
- Docker Desktop Networking: https://docs.docker.com/desktop/features/networking/
- قائمة النطاقات المطلوبة: https://docs.docker.com/desktop/enterprise/allow-list/

بعد إصلاح الاتصال، اسحب الصور المطلوبة منفردة:

~~~powershell
docker pull postgres:16-alpine
docker pull redis:7-alpine
~~~

إذا نجحت، انتقل إلى الخطوة التالية. لا تنفذ docker system prune أو docker volume prune أو تحذف أي Volume لمعالجة DNS.

## 3. إعداد البيئة المحلية

من جذر المشروع:

~~~powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
~~~

إذا كان .env موجوداً، اتركه كما هو وافحصه محلياً. لا تطبع محتواه في الطرفية عند مشاركة النتائج، ولا ترفعه للمستودع.

قبل تشغيل الحاويات، اضبط `POSTGRES_PASSWORD` بكلمة مرور محلية خاصة، ثم اجعل كلمة المرور داخل `DATABASE_URL` مطابقة لها حرفياً. استخدم أحرفاً وأرقاماً فقط لتجنب مشاكل URL encoding. إذا كان `.env` يحتوي مسبقاً على كلمة مرور مختلفة، لا تغيّرها قبل فهم ما إذا كانت قاعدة محلية قائمة تعتمد عليها.

قبل تشغيل Seed، اضبط كلمات مرور مختلفة وفريدة لهذه المتغيرات:
- SEED_SUPER_ADMIN_PASSWORD
- SEED_FINANCE_PASSWORD
- SEED_CUSTOMER_PASSWORD

يجب ألا يقل طول كل كلمة مرور عن 20 حرفاً. أصبحت قيم Seed في .env.example فارغة عمداً، والبرنامج يرفض كلمات المرور الفارغة أو المعروفة من قوالب المثال.

استخدم أيضاً أسرار JWT فريدة، ومفتاح ENCRYPTION_KEY مكوناً من 64 خانة Hex، وWEBHOOK_HMAC_SECRET بطول لا يقل عن 32 بايت. لا تشارك هذه القيم.

## 4. تشغيل PostgreSQL وRedis

بعد نجاح تنزيل الصور:

~~~powershell
docker compose -f docker/docker-compose.yml up -d postgres redis
docker compose -f docker/docker-compose.yml ps
~~~

تأكد من أن PostgreSQL وRedis بحالة Healthy. إذا ظهرت Starting، انتظر قليلاً ثم أعد فحص الحالة. لا تبدأ migrations قبل جاهزية PostgreSQL.

المنافذ المنشورة لقاعدة PostgreSQL وRedis وAdminer مرتبطة بـ 127.0.0.1 فقط؛ التطبيقات داخل شبكة Compose تستخدم أسماء الخدمات الداخلية.

## 5. تثبيت الاعتماديات وتجهيز قاعدة محلية جديدة

~~~powershell
npm ci
npm run build --workspace=packages/shared
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
~~~

هذه الأوامر مخصصة لقاعدة تطوير محلية جديدة أو لقاعدة سبق أن سُجل خط أساس migrations لها. إذا كانت قاعدة البيانات تحتوي بيانات مهمة أو أُنشئت سابقاً باستخدام prisma db push، أوقف التنفيذ قبل migrate:deploy. لا تحذف البيانات أو Volumes ولا تطبق الهجرات عشوائياً؛ يلزم مراجعة سجل المخطط والهجرات أولاً.

نفّذ Seed مرة واحدة لتهيئة بيانات التطوير. لا تستخدم RESET_DATABASE_SEED=true إلا على قاعدة محلية قابلة لإعادة الإنشاء وبعد إدراك أن ذلك يحذف بيانات Seed. Seed ممنوع في Production.

## 6. تشغيل Backend والواجهات

افتح أربع نوافذ PowerShell مستقلة من جذر المشروع:

النافذة الأولى:

~~~powershell
npm run dev:backend
~~~

الثانية:

~~~powershell
npm run dev:customer
~~~

الثالثة:

~~~powershell
npm run dev:admin
~~~

الرابعة:

~~~powershell
npm run dev:saas
~~~

العناوين:
- متجر العميل: http://localhost:3000
- لوحة الإدارة: http://localhost:3001
- بوابة SaaS: http://localhost:3002
- Backend API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs
- Readiness: http://localhost:4000/api/health/ready

تحقق من Readiness:

~~~powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health/ready"
~~~

إذا فشل الطلب، افحص سجل نافذة Backend أولاً، ثم حالة PostgreSQL وRedis. لا تعتبر صفحة Next.js وحدها إثباتاً على جاهزية API.

## 7. تشغيل التطبيقات من خلال Docker بدلاً من Node على المضيف

بعد إتمام تثبيت الاعتماديات وتهيئة قاعدة التطوير وتطبيق migrations وSeed:

~~~powershell
docker compose -f docker/docker-compose.yml up -d --build backend web-admin web-customer web-saas db-admin
docker compose -f docker/docker-compose.yml ps
~~~

روابط الواجهات وAPI تبقى كما في الخطوة السابقة. لمزامنة حالة قاعدة البيانات، راجع سجلات الخدمات ولا تفترض أن بناء الصور طبّق migrations تلقائياً.

## 8. اختبار أولي آمن

نفّذ اختبار تسجيل عميل جديد من واجهة Customer أو عبر مسار API، ثم اختبر تسجيل الدخول وعرض الكتالوج والمحفظة الفارغة وسجل الطلبات. لا تنشئ إيداعاً بأموال حقيقية ولا تستخدم بيانات محافظ فعلية. تظل قنوات الدفع الخارجية معطلة إلى حين اكتمال الموافقات والعقود والتحقق من حساب الاستقبال.

لفحص المشروع آلياً:

~~~powershell
npm run test
npm run build
npm audit --omit=dev --audit-level=low
~~~

تُظهر [وثيقة Go/No-Go](GO_NO_GO_DECISION.md) بوابات Staging والإنتاج التي لم تُغلق بعد.

## 9. ما الذي ترسله عند طلب المساعدة؟

أرسل فقط نتائج أوامر DNS وTest-NetConnection وcurl.exe وdocker version وdocker image ls وdocker ps -a وسجلات الخطأ ذات الصلة. لا ترسل ملف .env أو كلمات مرور أو JWT أو مفاتيح تشفير أو رموز دخول.
