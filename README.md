# منصة الشحن والخدمات الرقمية — Yemen Digital TopUp Platform

منصة متعددة التطبيقات لإدارة كتالوج الخدمات الرقمية، طلبات الشحن، محافظ متعددة العملات، القيود المحاسبية، القنوات اليدوية، ولوحات إدارة المنصة والمتاجر. تعتمد البنية على NestJS وPostgreSQL/Prisma وRedis وواجهات Next.js وتطبيق Flutter.

> **حالة الإطلاق:** التطوير والاختبارات الآلية متقدمان، لكن قرار الإطلاق التجاري ما زال `NO-GO`. لا تستقبل أموال عملاء ولا تفعّل قناة دفع أو مزود شحن اعتماداً على وجود الكود وحده. راجع [قرار Go/No-Go](docs/GO_NO_GO_DECISION.md).

---

## مكونات النظام

| المكون | التقنية | الوظيفة |
|---|---|---|
| Backend REST API | NestJS 11 + TypeScript | المصادقة والصلاحيات والطلبات والمحافظ والدفتر المالي والتكاملات |
| قاعدة البيانات | PostgreSQL 16 + Prisma | البيانات التشغيلية والمحاسبية والهجرات المنظمة |
| Cache / Queue | Redis 7 | التنسيق والتخزين المؤقت وضوابط التكرار |
| Customer Web | Next.js + TypeScript | متجر العميل والكتالوج والطلبات والمحفظة |
| Admin Web | Next.js + TypeScript | إدارة المنصة والعمليات والمالية والمراجعة |
| SaaS Web | Next.js + TypeScript | إدارة المتاجر والاشتراكات والخطط على مستوى المنصة |
| Customer Mobile | Flutter | تسجيل العميل والدخول والكتالوج والمحافظ والطلبات وPIN المعاملة عبر API |

### حدود الوظائف الحالية

تطبيق Flutter مربوط بمسارات تسجيل العميل والدخول والملف الشخصي وتجديد الجلسة والكتالوج والأرصدة وسجل الطلبات وCheckout. لا تتوفر بعد رحلة إيداع يدوية مكتملة في التطبيق، ولا يوجد تكامل مثبت مع مزود دفع أو شحن حقيقي. قنوات المحافظ اليمنية معطلة افتراضياً، وعمليات Auto-credit وإثبات التحويل الآلي مغلقة حتى اكتمال مصدر إثبات رسمي معتمد.

---

## التشغيل المحلي على Windows

المتطلبات:
- Node.js بإصدار `20.19.0` أو أحدث ضمن خط 20/22/24، وأقل من 25.
- npm بإصدار 10 أو أحدث.
- Docker Desktop مع Docker Engine يعمل بنمط Linux containers.
- Flutter SDK فقط عند تشغيل تطبيق الهاتف.

### 1. إعداد ملف البيئة

من PowerShell داخل مجلد المستودع:

~~~powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
~~~

لا تستبدل ملف .env موجوداً. افتح .env محلياً واضبط كلمات مرور Seed الخاصة بالمدير والمالية والعميل بقيم مختلفة وفريدة لا تقل كل منها عن 20 حرفاً. يجب أيضاً ضبط أسرار JWT والتشفير وWebhook وفق وصف المتغيرات في الملف. لا ترسل محتوى .env إلى أي شخص ولا ترفعه إلى Git.

### 2. تشغيل PostgreSQL وRedis محلياً

~~~powershell
docker compose -f docker/docker-compose.yml up -d postgres redis
docker compose -f docker/docker-compose.yml ps
~~~

انتظر حتى تظهر الخدمتان بحالة Healthy. منافذ PostgreSQL وRedis وAdminer مرتبطة بعنوان loopback فقط حتى لا تكون قاعدة البيانات مكشوفة لبقية الشبكة.

### 3. تثبيت الاعتماديات وتجهيز قاعدة بيانات محلية جديدة

~~~powershell
npm ci
npm run build --workspace=packages/shared
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
~~~

يطبّق أمر migrate:deploy ملفات الهجرة الموجودة في المستودع. استخدم هذه الخطوات على قاعدة محلية جديدة أو قاعدة سبق تسجيل خط أساس migrations لها. إذا كانت قاعدة موجودة أُنشئت سابقاً باستخدام db push أو تحتوي بيانات مهمة، فتوقف ولا تطبق الهجرات عليها مباشرة؛ يلزم فحص سجلها وتسجيل خط الأساس بخطة موثقة أولاً.

Seed مخصص للتطوير المحلي فقط، ويرفض كلمات المرور الفارغة أو المعروفة من ملفات المثال. لا تستخدم RESET_DATABASE_SEED=true إلا على قاعدة تطوير قابلة لإعادة الإنشاء وبعد فهم أنه يحذف بيانات Seed. لا تستخدم db push أو Seed على الإنتاج.

### 4. تشغيل التطبيقات

افتح أربع نوافذ PowerShell منفصلة من جذر المستودع، وشغّل أمراً واحداً في كل نافذة:

~~~powershell
npm run dev:backend
~~~

~~~powershell
npm run dev:admin
~~~

~~~powershell
npm run dev:customer
~~~

~~~powershell
npm run dev:saas
~~~

العناوين المحلية:
- Customer Web: http://localhost:3000
- Admin Web: http://localhost:3001
- SaaS Web: http://localhost:3002
- Backend API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs
- Readiness: http://localhost:4000/api/health/ready

تحقق من جاهزية الخادم:

~~~powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health/ready"
~~~

### تشغيل تطبيقات الويب داخل Docker بدلاً من نوافذ Node

بعد تشغيل قاعدة البيانات وتطبيق migrations وSeed محلياً بنجاح:

~~~powershell
docker compose -f docker/docker-compose.yml up -d --build backend web-admin web-customer web-saas db-admin
docker compose -f docker/docker-compose.yml ps
~~~

لا يشغّل Compose بيانات Seed تلقائياً؛ نفّذها فقط بعد مراجعة ملف .env وعلى قاعدة تطوير محلية جديدة.

---

## تشغيل Flutter

من PowerShell:

~~~powershell
Set-Location apps/mobile-customer
flutter pub get
flutter analyze
flutter test
~~~

إذا كانت مجلدات Android وiOS الأصلية غير موجودة، أنشئها مرة واحدة:

~~~powershell
flutter create --platforms=android,ios .
~~~

على Android Emulator استخدم:

~~~powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api
~~~

على هاتف فعلي استبدل العنوان بعنوان IP المحلي لجهاز التطوير، ولا تستخدم localhost داخل الهاتف. استخدم HTTPS في أي بيئة خارج التطوير المحلي.

---

## الاختبارات والأمان

يُفضّل تنفيذ ما يلي قبل أي تسليم:

~~~powershell
npm run test
npm run build
npm audit --omit=dev --audit-level=low
~~~

تعرض [وثيقة Go/No-Go](docs/GO_NO_GO_DECISION.md) ما تم إثباته وما لم يُثبت بعد. نجاح GitHub Actions على PostgreSQL مؤقتة لا يساوي اختبار تشغيل محلي أو Staging أو إنتاج.

قنوات الدفع الخارجية، ومزودو الشحن، والإشعارات الخارجية لا تعد مفعلة لمجرد ظهور إعداداتها في لوحة الإدارة. يلزم عقد وموافقة رسمية وبيانات Sandbox/Production حقيقية واختبارات طرف لطرف ومطابقة قبل تشغيلها. لا تستخدم أرقام استقبال أو مفاتيح أو بيانات Seed تجريبية لاستقبال أموال العملاء.

---

## الوثائق

- [دليل التشغيل المحلي على Windows وحل مشكلة Docker Hub](docs/LOCAL_DEVELOPMENT_ON_WINDOWS_AR.md)
- [دليل ربط وتشغيل تطبيق Flutter](docs/MOBILE_APP_API_INTEGRATION.md)
- [دليل بوابة إدارة SaaS](docs/SAAS_ADMIN_PORTAL_GUIDE.md)
- [دليل النشر والتشغيل](docs/DEPLOYMENT_GUIDE.md)
- [قرار Go/No-Go](docs/GO_NO_GO_DECISION.md)
- [قائمة التحقق الأمني](docs/SECURITY_CHECKLIST.md)
- [دليل النسخ الاحتياطي والاستعادة](docs/BACKUP_AND_RECOVERY_GUIDE.md)
- [تكاملات المحافظ ومزودي الخدمة](docs/INTEGRATIONS.md)
