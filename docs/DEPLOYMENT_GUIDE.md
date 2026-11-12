# دليل التشغيل والنشر — Digital TopUp Platform

هذا الدليل يميّز بين بيئة التطوير المحلية وبيئة الإنتاج. لا تستخدم بيانات التطوير أو قنوات الدفع غير المعتمدة لاستقبال أموال حقيقية.

## 1. متطلبات التشغيل المحلي

- Node.js: إصدار 20.19.0 أو أحدث ضمن خط 20/22/24، وأقل من 25.
- npm: الإصدار 10 أو أحدث.
- Docker Desktop مع Docker Engine يعمل باستخدام Linux containers، أو PostgreSQL 16 وRedis 7 مثبتين محلياً.
- Flutter SDK عند تشغيل تطبيق الهاتف.

## 2. التشغيل على Windows PowerShell

نفّذ الأوامر من جذر المستودع. احتفظ بملف .env الموجود ولا تستبدله:

~~~powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
~~~

افتح ملف .env محلياً واضبط `POSTGRES_PASSWORD` بكلمة مرور خاصة، ثم حدّث كلمة المرور نفسها داخل `DATABASE_URL` لتتطابق حرفياً. استخدم أحرفاً وأرقاماً فقط لتجنب الحاجة إلى URL encoding. اضبط كلمات مرور Seed مختلفة وفريدة لا تقل كل واحدة عن 20 حرفاً، وأسرار JWT والتشفير وWebhook. حقول كلمات مرور Seed في .env.example فارغة عمداً؛ يمنع Seed الآن استخدام كلمات مرور المثال العامة. لا تشارك ملف .env أو محتوياته.

### تشغيل قواعد البيانات

~~~powershell
docker compose -f docker/docker-compose.yml up -d postgres redis
docker compose -f docker/docker-compose.yml ps
~~~

تأكد من ظهور PostgreSQL وRedis بحالة Healthy قبل المتابعة. منافذ قاعدة البيانات وRedis وAdminer مرتبطة بـ 127.0.0.1 فقط.

### تثبيت المشروع وتطبيق migrations

~~~powershell
npm ci
npm run build --workspace=packages/shared
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
~~~

طبّق migrations على قاعدة تطوير جديدة أو قاعدة سبق تسجيل خط أساس Prisma لها فقط. إذا كانت لديك قاعدة محلية قائمة أُنشئت بواسطة db push أو تحتوي بيانات تريد الاحتفاظ بها، فلا تنفذ migrate deploy قبل مراجعة تاريخ المخطط والهجرات. لا تحذف Docker volumes لحل مشكلة هجرة أو تشغيل.

### تشغيل الخدمات محلياً

شغّل كل أمر في نافذة مستقلة:

~~~powershell
npm run dev:backend
~~~

~~~powershell
npm run dev:customer
~~~

~~~powershell
npm run dev:admin
~~~

~~~powershell
npm run dev:saas
~~~

العناوين:
- Customer: http://localhost:3000
- Admin: http://localhost:3001
- SaaS: http://localhost:3002
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs
- Readiness: http://localhost:4000/api/health/ready

لا تعتبر ظهور صفحات الويب دليلاً على أن قاعدة البيانات جاهزة؛ افحص readiness وسجلات Backend.

### تشغيل تطبيقات الويب داخل Docker

بعد تطبيق migrations وSeed محلياً:

~~~powershell
docker compose -f docker/docker-compose.yml up -d --build backend web-admin web-customer web-saas db-admin
docker compose -f docker/docker-compose.yml ps
~~~

## 3. تشخيص تعذر تنزيل صور Docker Hub

إذا ظهر خطأ من نوع:

~~~text
failed to resolve reference "docker.io/library/postgres:16-alpine"
lookup registry-1.docker.io: no such host
~~~

فهذا يعني أن Docker لم يتمكن من حل اسم سجل الصور. نفّذ الفحوص التالية على Windows:

~~~powershell
nslookup google.com
nslookup registry-1.docker.io
nslookup auth.docker.io
curl.exe -I --max-time 15 https://registry-1.docker.io/v2/
Test-NetConnection 1.1.1.1 -Port 443
~~~

استجابة HTTP 401 من مسار /v2/ متوقعة عادةً وتدل على أن عنوان السجل قابل للوصول؛ أما فشل DNS أو timeout فيحتاج إلى تشخيص شبكة الجهاز أو Docker Desktop.

- إذا فشل nslookup على Windows نفسه، فالمشكلة في DNS أو الشبكة أو VPN على الجهاز/الموجّه. أصلح اتصال Windows أولاً، ثم أعد الفحص.
- إذا نجح DNS في Windows وفشل docker pull، افتح Docker Desktop ثم Settings > Resources > Proxies. راجع إعداد Containers proxy لأنه المسار المستخدم لتنزيل الصور. استخدم System/Same as host إذا كانت شبكتك تتطلب Proxy مضبوطاً، أو No proxy إذا كان الاتصال المباشر هو إعداد شبكتك الصحيح. لا تضع عنوان Proxy عشوائياً.
- راجع Settings > Resources > Network واترك DNS resolution behavior على Auto أولاً. لا تغيّر وضع IPv4/IPv6 إلا إذا أثبتت الاختبارات عدم توافق الشبكة.
- تحقق من أن جدار حماية Windows أو برنامج الحماية لا يمنع com.docker.backend.exe من الوصول إلى الإنترنت.

وثائق Docker الرسمية:
- https://docs.docker.com/desktop/settings-and-maintenance/settings/
- https://docs.docker.com/desktop/features/networking/
- https://docs.docker.com/desktop/enterprise/allow-list/

بعد إصلاح الاتصال، اختبر تنزيل الصور مباشرة:

~~~powershell
docker pull postgres:16-alpine
docker pull redis:7-alpine
~~~

ثم أعد تشغيل قاعدة البيانات فقط. لا تحذف volumes ولا تستخدم أوامر prune لحل مشكلة DNS.

## 4. تطبيق Flutter

~~~powershell
Set-Location apps/mobile-customer
flutter pub get
flutter analyze
flutter test
~~~

إذا لم تكن مجلدات Android وiOS موجودة:

~~~powershell
flutter create --platforms=android,ios .
~~~

Android Emulator يستخدم عادةً العنوان التالي للـ API المحلي:

~~~powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api
~~~

أما الهاتف الفعلي فيستخدم IP الحاسوب ضمن الشبكة المحلية. لا تستخدم HTTP خارج التطوير المحلي.

## 5. النشر على Staging أو Production

لا تعتمد هذا الدليل القديم وحده للنشر. اتبع [دليل نشر VPS الحالي](PRODUCTION_VPS_DEPLOYMENT_AR.md)، وراجع [قرار Go/No-Go](GO_NO_GO_DECISION.md) أولاً. قرار المستودع الحالي هو NO-GO؛ لم يثبت بعد نشر Staging، أو استعادة نسخة احتياطية تشغيلية، أو ربط مزود دفع/شحن حقيقي معتمد.

قبل أي قاعدة إنتاجية يجب توفير نسخة احتياطية قابلة للتحقق وتجربة استعادة مكتملة وموافقة تشغيلية مكتوبة، ثم تنفيذ migrations عبر الإجراء الإنتاجي المخصص. لا تستخدم db push أو Seed على الإنتاج. لا تفعّل أي محفظة أو Auto-credit أو مزود خارجي إلا بعد المستندات النظامية والعقد ومواصفات API/Sandbox الرسمية واختبار المطابقة والتسوية.

## 6. بيانات الحسابات وأمان التشغيل

لا توجد كلمات مرور دخول ثابتة موثوقة للمشروع. تُنشأ حسابات Seed محلياً فقط من القيم الخاصة في ملف .env، وتتطلب كلمات مرور مختلفة لا تقل عن 20 حرفاً. لا تستخدم حسابات Seed في Staging أو Production.

قنوات المحافظ في Seed معطلة، وبيانات الاستقبال ليست أرقاماً فعلية. لا تحاول اختبار الإيداع بأموال حقيقية. أبقِ مفاتيح مزودي الخدمة وملفات البيئة خارج GitHub وسجلات CI والمحادثات.
