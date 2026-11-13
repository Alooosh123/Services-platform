# تحديث حالة التشغيل المحلي — 13 نوفمبر 2026

> مصدر هذا التحديث: مخرجات PowerShell التي أرسلها صاحب المشروع أثناء تنفيذ الإعداد المحلي. لا تمثل هذه النتائج اختباراً أجريته على جهازه عن بُعد.

- Docker Desktop 4.99.0 وDocker Engine 29.9.3 يعملان باستخدام Linux containers.
- تم تنزيل الصورتين `postgres:16-alpine` و`redis:7-alpine` بنجاح بعد معالجة إعداد DNS داخل Docker Desktop.
- الحاويتان `topup_postgres` و`topup_redis` تعملان وحالتهما `healthy`.
- PostgreSQL 16.15 يقبل الاتصالات، ونجح استعلام SQL على قاعدة `digital_topup_db` بالمستخدم `postgres`.
- Redis أعاد `PONG`.
- ملف البيئة المحلي يحتوي على اتصال PostgreSQL عبر `localhost:5433` إلى `digital_topup_db`، ولم يُكشف أو يُعدّل ملف `.env`.
- لم يبدأ بعد تثبيت اعتماديات Node، أو توليد Prisma Client، أو تطبيق هجرات قاعدة البيانات المحلية، أو تشغيل Backend والواجهات. لا يوجد حتى الآن إثبات محلي لتسجيل حساب أو تسجيل الدخول.
- تم إنشاء وحدتي تخزين محليتين جديدتين بواسطة Docker Compose، ولم تُحذف أي حاوية أو وحدة تخزين.
- التحذير الخاص بحقل Compose `version` غير مانع؛ Docker Compose يتجاهله.

**المرحلة المحلية الحالية:** قاعدة البيانات وRedis جاهزتان؛ المرحلة التالية هي تثبيت الحزم، توليد Prisma Client، أخذ نسخة محلية قبل الهجرات، تطبيق الهجرات على عنوان loopback المحلي فقط، ثم بناء وتشغيل API والواجهات واختبار تسجيل العميل.

**قيود الإطلاق:** لا يتغير قرار `NO-GO` للإنتاج. لا تفعيل لمحافظ أو مزودي دفع، ولا إيداع أو شحن آلي أو ترحيل قاعدة إنتاجية دون الموافقات والتكاملات الرسمية واختبارات Staging والاستعادة المذكورة في هذا التقرير.

---

# تقرير حالة المشروع الشامل (Project Status Report)

## أحدث تحقق فعلي — 12 نوفمبر 2026 (Run #813)

> الالتزام المختبر: `a77bc3a2be474fbba2a00020f72db87aefc59909` على الفرع `fix/production-hardening-20261108`. اكتملت وظائف CI الست كلها بنجاح في GitHub Actions. هذه نتيجة Runner مؤقت، ولا تثبت تشغيل جهاز المطور أو Staging أو الإنتاج.

- **GitHub Actions:** Run #813 — جميع الوظائف الست ناجحة: Safe Dependency Lockfile Refresh، Lint/Types/Security Audit، Backend Unit/Security/Stress، Flutter Analyze/Tests، Prisma Migration Apply/Safety، وBuild Monorepo.
- **Backend:** `npm run db:seed` نجح بعد تشديد رفض كلمات المرور الفارغة/النمطية، ثم نجحت **44 مجموعة اختبار و296 اختباراً**.
- **Flutter:** نجح `flutter analyze` و`flutter test`.
- **PostgreSQL/Prisma:** تم التحقق من المخطط وتطبيق **27 هجرة** على PostgreSQL 16 مؤقتة، ثم التحقق من سجل الهجرات.
- **Docker Compose:** نجح فحص `docker compose -f docker/docker-compose.yml config --quiet` في CI بعد تعديل ملف Compose.
- **Dependency audit:** `npm audit --omit=dev --audit-level=low` أعاد **0 vulnerabilities**. التدقيق الكامل نجح عند مستوى High، مع بقاء **9 نتائج LOW** في أدوات تطوير متعدية مرتبطة بـ `deepmerge@4.3.1`. لم تُستخدم ترقيات إجبارية قد تكسر Nest CLI أو Jest.
- **Build:** نجح بناء جميع الحزم والتطبيقات.
- **تغييرات hardening المصاحبة:** جعل كلمة مرور PostgreSQL مطلوبة، ربط منافذ PostgreSQL/Redis/Adminer بـ loopback، تحسين healthcheck، رفض كلمات مرور Seed الافتراضية، تفريغ قيم كلمات مرور Seed وقاعدة البيانات في `.env.example` حتى يحددها المطور محلياً، وإضافة توثيق تشغيل Windows وحل DNS وتحديث دليل النشر وإزالة بيانات الدخول التجريبية الثابتة.
- **التحقق المحلي:** Docker Desktop وLinux Engine و`hello-world` نجحت على جهاز صاحب المشروع، لكن سحب `postgres:16-alpine` و`redis:7-alpine` لا يزال متوقفاً بسبب فشل DNS إلى `registry-1.docker.io`. لذلك لم تثبت بعد صحة PostgreSQL/Redis محلياً أو تشغيل API والتطبيقات على الجهاز.
- **الإطلاق:** ما زال `NO-GO`. لا يوجد نشر Staging/Production أو استعادة احتياطية حية أو تكامل مالي/مزود شحن معتمد.

روابط الإثبات:
- [GitHub Actions Run #813](https://github.com/Alooosh123/Services-platform/actions/runs/43293514243)
- [Commit a77bc3a](https://github.com/Alooosh123/Services-platform/commit/a77bc3a2be474fbba2a00020f72db87aefc59909)
- [PR #4](https://github.com/Alooosh123/Services-platform/pull/4)

---

## تحقق سابق — 12 نوفمبر 2026 (Run #783)

> الالتزام المختبر: `fff26535b12251e4df2a53bbbfaa85c0ba8497af` على الفرع `fix/production-hardening-20261108`. نجحت الوظائف الست كاملة في GitHub Actions. هذا يثبت التحقق على Runner مؤقت في GitHub فقط، ولا يثبت تشغيل Docker المحلي أو Staging أو الإنتاج.

- **GitHub Actions:** الوظائف الست ناجحة: Safe Dependency Lockfile Refresh، Backend Unit/Security/Stress، Flutter Analyze/Tests، Prisma Migrations، Lint/Types/Security Audit، وبناء جميع workspaces/apps.
- **Backend:** 44 مجموعة اختبارات و296 اختباراً ناجحاً.
- **Flutter:** `flutter pub get` و`flutter analyze` واختبارات الوحدات ناجحة على Flutter 3.50.0. تم تحديث الاستيراد إلى `material_ui: ^1.11.0` وتوافق `intl: ^0.20.3`، وإزالة استيراد Widgets غير الضروري.
- **PostgreSQL/Prisma:** تم التحقق من المخطط وتطبيق 27 هجرة على PostgreSQL 16 مؤقتة والتحقق من أن سجل الهجرات نظيف. لا يشمل ذلك قاعدة محلية أو إنتاجية.
- **Dependency audit:** `npm audit --omit=dev --audit-level=low` أعاد **0 vulnerabilities**. التدقيق الكامل عند مستوى high نجح، مع بقاء **9 ثغرات LOW** في اعتماديات تطوير متعدية عبر `deepmerge@4.3.1`. لم تُخفَ النتائج ولم تُستخدم ترقيات إجبارية.
- **Build:** نجح بناء جميع تطبيقات وحزم Monorepo في Run #783.
- **Docker production safety:** تم جعل خدمة Prisma migration في `docker/docker-compose.prod.yml` تعمل فقط عبر profile صريح `manual-migration`، وإزالة اعتماد Backend التلقائي عليها. أُحدّث دليل النشر ليشترط تشغيل قاعدة البيانات أولاً، ثم نسخة احتياطية قابلة للفحص وتجربة استعادة، ثم الهجرة اليدوية والتحقق قبل تشغيل التطبيقات. لم تُشغّل هذه الخطوات على VPS.
- **قرار الإطلاق:** يبقى `NO-GO`. لا يوجد بعد إثبات تشغيل محلي على جهاز صاحب المشروع، أو نشر Staging، أو استعادة نسخة فعلية، أو تكامل محافظ/مزودين حقيقيين، أو تهيئة Email/WhatsApp/FCM/APNs.

روابط الإثبات:
- [GitHub Actions Run #783](https://github.com/Alooosh123/Services-platform/actions/runs/43182192215)
- [Commit fff2653](https://github.com/Alooosh123/Services-platform/commit/fff26535b12251e4df2a53bbbfaa85c0ba8497af)
- [PR #4](https://github.com/Alooosh123/Services-platform/pull/4)

---

## تحقق سابق — 10 نوفمبر 2026 (Run #763، مرجع تاريخي)


> هذه أحدث نتيجة CI موثقة للفرع `fix/production-hardening-20261108` عند Commit `d259ca98b288f15e14bc0b59049d4529e58a80c4`. وهي تثبت جودة الكود على بيئة اختبار مؤقتة فقط؛ لا تثبت تشغيل الإنتاج أو تفعيل أي محفظة مالية.

- **GitHub Actions:** نجحت الوظائف الست كاملة في Run #763: تحديث ملف القفل، Backend tests، Flutter analyze/tests، Prisma migrations، quality/security audit، وبناء جميع workspaces/apps.
- **Backend:** 44 مجموعة اختبارات و296 اختباراً ناجحاً. تشمل `wallet-sender-account.e2e.spec.ts` و`notifications.service.spec.ts`.
- **PostgreSQL test:** تم التحقق من المخطط وتطبيق **27 هجرة** من البداية على قاعدة PostgreSQL 16 مؤقتة، بما فيها `20261208000000_payment_sender_account_owner_approval` و`20261209000000_wallet_transfer_evidence_source_integrity`. القاعدة المؤقتة ليست قاعدة الإنتاج.
- **Dependency audit:** تدقيق اعتماديات التشغيل `npm audit --omit=dev --audit-level=low` أعاد **0 vulnerabilities**. التدقيق الكامل عند مستوى high نجح، لكنه ما زال يعرض **9 ثغرات low** في اعتماديات تطوير متعدية تخص `deepmerge@4.3.1` عبر `jest-config` و`fork-ts-checker-webpack-plugin`. لا يوجد إصدار إصلاح موثق في GitHub Advisory حتى تاريخ هذا التحديث؛ لم يتم إخفاء التنبيه أو استخدام ترقيات إجبارية.
- **NestJS:** جرى الانتقال المتوافق إلى خط NestJS 11 مع `@nestjs/jwt` و`@nestjs/passport` من خط 11 لتوافق Jest/CommonJS. متطلب Node أصبح `>=20.19.0 <25`.
- **SMS/OTP:** أزيل نجاح SMS الوهمي؛ محول الإنتاج يرفض الإرسال إلى أن يجهز مزود موثق، ويتم إبطال تحدي OTP عند فشل الإرسال. لا يوجد SMS حقيقي متصل.
- **Notifications:** إشعارات الإنتاج تتطلب الحفظ والقراءة من Prisma الدائم، ولا تعود إلى بيانات Demo/الذاكرة عند تعطل قاعدة البيانات. أضيفت اختبارات فشل التخزين وعزل المستخدم.
- **Wallet sender approval:** اختبار PostgreSQL يثبت تسجيل العميل، منع الإيداع قبل اعتماد المالك، وصول إشعارات الأطراف، ثم إنشاء طلب إيداع جديد باستخدام المعرّف المحفوظ تلقائياً. هذا اختبار تكاملي آلي، وليس تجربة على عميل أو حوالة مالية حقيقية.

### قيود قانونية وتقنية جديدة — 10 نوفمبر 2026

- تقارير يمنية بتاريخ 29 أكتوبر تنقل عن قرار النائب العام رقم 20 لسنة 2026 وتعميم البنك المركزي `CBY/A/12/2026` بتاريخ 28 أكتوبر إدراج **Easy Wallet التابعة لشركة ثروات** ضمن كيانات جُمّدت أموالها وحُظر التعامل معها. لم أعثر على نسخة أصلية موقعة من التعميم في الصفحة العامة للبنك المركزي؛ لذلك تبقى هذه إشارة قانونية عالية الخطورة يلزم التحقق منها بنسخة رسمية ومحامٍ/الجهة الرقابية المختصة. لا تفعّل `EASY` أو تستقبل أموالاً عبرها قبل رفع هذا الحظر بمستند رسمي.
- لا تخلط بين **Saba Cash التابعة لسبأفون** المذكورة في تلك التقارير وبين **Cash Pay التابعة لـTamkeen/Cash Wallet**؛ هما اسمان وجهتان مختلفتان. وجود Cash Pay API معلن على موقعها لا يكفي وحده للتفعيل؛ يلزم عقد تاجر ومواصفات API وSandbox وموافقة تنظيمية حديثة.
- بوابة YemenPay تعرض وثائق API عامة، لكن مستودع SDK العام يتضمن أوضاع محاكاة صريحة: كلمة مرسل `success` تحقق نجاحاً فورياً، وأسماء أخرى تشغل محاكاة بنسبة نجاح تلقائي 80%. هذا ليس إثباتاً مالياً موثوقاً ولا يجوز استخدامه في Auto-credit. كما تتطلب وثائق API العامة `merchant_secret_key` ضمن طلب التحقق؛ يلزم تدقيق تعاقدي/أمني مستقل قبل النظر في استخدامها.
- لا توجد حتى الآن وثائق API/Sandbox موقعة أو حسابات تجار ومفاتيح اختبار/إنتاج من Jaib/Jawali/Cash Pay/OneCash. لا توجد خدمة ingestion مكتملة لWebhook موقع أو كشف حساب رسمي تدخل سجلات `WalletTransferEvidence`؛ وبذلك يبقى Auto-credit معطلاً.

### قرار الإطلاق الحالي: `NO-GO`

لم تُطبق هجرات الإنتاج، ولم يجر اختبار على قاعدة العميل أو شبكة المحفظة الحقيقية، ولا يوجد SMTP/WhatsApp/FCM، ولا مضيف Staging/Production أو DNS/TLS/Secret Manager أو وظيفة Deploy في CI. طلب الدمج #4 ما زال Draft وغير مدمج، وقاعدته الحالية `production-completion` وليست `main`. لا تغيّر قاعدة PR أو تدمجه تلقائياً قبل مراجعة اختلاف تاريخ الفرعين وسجل التغييرات.

روابط الإثبات:
- CI #763: https://github.com/Alooosh123/Services-platform/actions/runs/42907140507
- PR #4: https://github.com/Alooosh123/Services-platform/pull/4
- سجل الاعتمادات والتنظيم: `docs/INTEGRATIONS.md` و`docs/PROVIDER_OUTREACH_REGISTER_AR.md`

---

## منصة الشحن والخدمات الرقمية — اليمن (Yemen Market Digital TopUp Platform v1.0)
**تاريخ التحديث:** 6 نوفمبر 2026 | **الإصدار:** 1.0.1 | **الحالة الحالية:** `NO-GO — NOT PRODUCTION READY`؛ لا يوجد اعتماد إنتاجي

---

## ملاحظة تدقيق المصدر والقرار الحالي — 6 نوفمبر 2026

تمت مراجعة ملفات المستودع الفعلية وسجل GitHub Actions، وأُضيف التقرير التفصيلي في `docs/REPOSITORY_AUDIT_2026-11-06_AR.md`. التقرير السابق كان يسجل حالة SaaS قديمة؛ في فرع `production-completion` أصبحت عمليات الخطط والمستأجرين والاشتراكات والفواتير مدعومة بـ Prisma، وأضيف عزل أولي للسياق والاستعلامات والكتابات، واختبارات سلبية على حدود المتاجر.

نجحت في آخر تشغيل PR رقم `42289222350` (commit `745ad44f1a11fc756ec5148f0a9bb1e2ee7e69fe`) اختبارات Backend (39 مجموعة / 261 اختبارًا)، وتحليل Flutter، وتطبيق الترحيلات الـ19 على PostgreSQL مؤقت، وبناء جميع workspaces. بقي فشل `npm audit` بسبب 42 ثغرة (14 عالية و2 حرجة). لا يزال اختبار العزل المستقل الشامل مطلوبًا، كما تم تنفيذ واجهة MVP تشغيلية لبوابة SaaS وربطها بمسارات API الأساسية لكن لم تُثبت بعد باختبارات بناء وتشغيل مستقلة، وتطبيق Flutter غير مرتبط بالـ API. قنوات الدفع الخارجية معطلة في بيانات seed الجديدة لحين التحقق من حسابات الاستقبال واعتمادها.

**قرار النشر المعتمد: `NO-GO` حتى اجتياز جميع بوابات CI والقبول التشغيلي.**

---

## 1. ملخص جاهزية المراحل (Phases Completion Summary)

| المرحلة (Phase) | النطاق الوظيفي | الحالة | نسبة الإنجاز والضوابط |
| :--- | :--- | :---: | :--- |
| **Phase 1: Foundation & Ledger** | البنية التحتية، العملات اليمنية (YER/USD/SAR)، دفتر الأستاذ المزدوج الصارم | `COMPLETED` | 100% — توازن الدائن والمدين، منع التحويل التلقائي. |
| **Phase 2: Auth & Wallets** | المصادقة الحقيقية، محافظ العملاء، إيداعات الحوالات اليدوية | `COMPLETED` | 100% — دورة موافقة الإيداعات، تدقيق الرصيد المزدوج. |
| **Phase 3: Shopping & Fulfillment** | شراء الخدمات، تنفيذ الطلبات، محولات المزودين، طابور التنفيذ اليدوي | `COMPLETED` | 100% — فصل حالات الدفع والتنفيذ، عزل بيئة الإنتاج. |
| **Phase 3.1: Security Gate** | إلغاء كلمات المرور المكشوفة، TOTP MFA حقيقي، فحص SSRF وBOLA | `COMPLETED` | 100% — بوابة أمان صارمة تمنع تشغيل الإنتاج بأسرار ضعيفة. |
| **Phase 4: Phone, Consent & AI** | تأكيد الهواتف اليمنية، ربط حسابات الخدمات، تقييم المخاطر الذكي، طابور المراجعة | `COMPLETED` | 100% — صفر أثر مالي، دفاع ضد حقن الأوامر، 72 اختباراً ناجحاً. |
| **Phase 5: Payment Automation & 3-Way Reconciliation** | أتمتة الإيداع والتحويل لمزودي الخدمة، التسوية الثلاثية، الرصيد التجاري، أمان القنوات | `COMPLETED` | 100% — اجتياز AT-16 وAT-18 وAT-21، توازن الأستاذ العام المزدوج، 87 اختباراً ناجحاً (13 حزمة). |
| **Phase 6: Admin Dynamic Catalog, Package Margins & Dynamic Channels** | الكتالوج الديناميكي بدون كود، هوامش الباقات الهرمية، استقرار سجل الطلبات، قنوات الدفع، الرقابة الثنائية وزر الطوارئ | `COMPLETED` | 100% — اجتياز AT-11 وAT-12 وAT-15 وAT-22 وAT-24، 95 اختباراً ناجحاً (14 حزمة اختبار). |
| **Phase 7: Daily Close Reports, Profit Engine & MFA Owner Payouts** | تقارير نهاية اليوم غير القابلة للتعديل، فصل أرباح المالك عن أموال العملاء، سحب الأرباح مع MFA والرقابة الثنائية | `COMPLETED` | 100% — اجتياز AT-13 وAT-14 وAT-17 وAT-18 وAT-23، 104 اختبارات ناجحة (15 حزمة اختبار). |
| **Phase 8: Customer Mobile UX, Notifications & Support** | تجربة الجوال PWA، الإشعارات المعتمدة، تذاكر الدعم والنزاعات، حجب الملاحظات الداخلية، وأداة تشخيص الطلبات | `COMPLETED` | 100% — اجتياز AR-01 وAR-07 وAR-15 وAR-20، 115 اختباراً ناجحاً (16 حزمة اختبار). |
| **Phase 9: Security, Compliance, Anti-Fraud & Privacy** | نموذج التهديدات STRIDE، حماية BOLA/IDOR، عزل الذكاء الاصطناعي والصفر المالي، تبريد SIM Swap، تجميد المحافظ، وحق النسيان AR-08 | `COMPLETED` | 100% — اجتياز AT-08 وAT-09 وAT-19، 128 اختباراً ناجحاً (17 حزمة اختبار). |
| **Phase 10: Production Readiness, Staging & Disaster Recovery** | عزل البيئات، الرصد، النسخ والاستعادة، CI/CD واختبارات الضغط | `BLOCKED` | اتصال PostgreSQL 18.6 بقاعدة `digital_topup_db` ناجح؛ طُبقت الترحيلات الخمس، واكتمل backup واسترجاعه إلى قاعدة محلية معزولة (61 جدولاً). سجل دفتر الأستاذ المستعاد فارغ (0 قيود)، لذا لم يثبت بعد اختبار توازن مالي ببيانات فعلية أو RTO/RPO؛ Redis غير متاح، والرصد وCI/CD بحاجة إلى تحقق تشغيلي. |
| **Phase 11: Pilot Rollout & Public Commercial Launch** | دورة المعاملات المغلقة، حدود Pilot، بوابة Go/No-Go، وعزل القنوات | `BLOCKED` | تعتمد على اجتياز P10 وتوافر PostgreSQL ومزودي خدمات حقيقيين؛ لا يوجد دليل إطلاق ميداني موثق. |
| **Phase 12: Operations Handover & Continuous Evolution** | أدلة التشغيل، المناورات، مؤشرات الأداء ومحضر الاستلام | `BLOCKED` | اختبارات P12 الآلية تمر، لكن المناورات الحية والتسليم والتوقيعات متعددة الأطراف غير مهيأة. كما أن الاعتماد يتطلب اجتياز P10 وP11 أولاً. |

---

## 2. تفاصيل إنجاز المرحلة الثانية عشرة والنهائية (Phase 12 Achievements)

> ملاحظة الحالة: هذا القسم يسجل مخرجات توثيقية سابقة فقط؛ لم يتم التحقق من التوقيعات أو المناورات التشغيلية. حالة P12 الحالية `BLOCKED` كما هو موضح في الجدول، ولا ينبغي اعتبار هذه البنود قبولاً إنتاجياً.

### 2.1 حزمة تسليم العمليات وحسابات المالك (Operations Handover Package)
- [x] وثيقة تسليم الحسابات والبيئة وسجل الإصدارات وقواعد البيانات (`docs/OPERATIONS_HANDOVER_PACKAGE.md`).
- [x] تسليم آمن لقوائم المتغيرات ومفاتيح التشفير AES-256-GCM دون تسريب أي أسرار.

### 2.2 أدلة التشغيل القياسية الستة (The 6 Mandatory Operational Runbooks)
- [x] إعداد ومحاكاة كافة سيناريوهات الطوارئ التشغيلية والمالية مع مسارات التصعيد المحددة بالدقائق (`docs/SERVICE_AND_FINANCE_RUNBOOKS.md`):
  1. رفض إيداع بنكي وحماية العميل والمطابقة (`FINANCE_DEPOSIT_REJECT`).
  2. شحن عالق بحالة غير معروفة واستعلام المزود الآمن (`FULFILLMENT_UNKNOWN`).
  3. تعطل أو انقطاع بوابة دفع أو مزود شحن (`PROVIDER_OUTAGE`).
  4. سحب أرباح خاطئ أو تحويل غير مطابق (`WRONG_PAYOUT`).
  5. نزاع استرجاع مالي وشكاوى الشحن (`REFUND_DISPUTE`).
  6. تراكم طوابير المعالجة والعمال (`WORKER_LAG`).

### 2.3 مناورات القبول التشغيلية الثلاث (AT-22 Operational Drills)
- [x] **مناورة دعم ومتابعة طلب فاشل (Support Simulation):** تشخيص آمن لطلب متعثر دون لمس المحفظة.
- [x] **مناورة إقفال يوم محاسبي لموظف جديد (New Staff Daily Close SOP):** تنفيذ إقفال يومي كامل استناداً للدليل مع توازن الأستاذ العام بنسبة 100%.
- [x] **مناورة استرجاع تقرير تسوية تاريخي (Historical Reconciliation Audit):** تدقيق تاريخي مع فحص البصمة المشفرة SHA-256 وصفر تغييرات في البيانات.

### 2.4 لوحة مؤشرات الأداء ومحضر استلام المالك والتواقيع
- [x] مؤشرات أداء حية تشمل معدل نجاح المزودين (99.5%)، معدل الاسترجاع (0.4%)، فروقات المطابقة (0.00 YER)، وزمن استجابة الدعم (12 دقيقة).
- [x] محضر استلام المالك النهائي (`docs/OWNER_ACCEPTANCE_MINUTES.md`) متضمناً مطابقة المتطلبات السبعة وتوقيع كافة الأطراف.
- [x] واجهة مركز تسليم التشغيل في لوحة الإدارة (`apps/web-admin/src/app/handover/page.tsx`).

---

## 3. مقاييس جودة الكود والاختبارات الآلية

- **اختبارات Backend الآلية:**
  - آخر تشغيل محلي: 32 حزمة اختبار ناجحة و203 اختبارات ناجحة.
  - هذه اختبارات آلية، ولا تمثل بحد ذاتها اختبار تكامل حي مع Redis أو مزودي الدفع والشحن.
  - تم الاتصال بقاعدة PostgreSQL الحقيقية، وتطبيق الترحيلات الخمس، وأخذ نسخة احتياطية واستعادتها في قاعدة محلية معزولة؛ لم تُنشأ بيانات مالية اختبارية.
  - AT-20 وAT-21 والتدريبات التشغيلية في P12 ما زالت غير معتمدة دون بيئة حية وأدلة استعادة/تشغيل فعلية.
- **حزم الإنتاج (Production Builds):**
  - `@digital-topup/shared`: تم البناء والتحزيم بنجاح.
  - `@digital-topup/database`: تم توليد العميل وبنائه بنجاح (Prisma v5.22.0).
  - `@digital-topup/backend`: تم البناء والتحزيم بنجاح (`nest build`).
  - `@digital-topup/web-admin`: تم البناء والتحزيم بنجاح (Next.js 14 - 20 صفحة مستقرة تشمل مركز العمليات، مركز الإطلاق، ومركز تسليم التشغيل).
  - `@digital-topup/web-customer`: تم البناء والتحزيم بنجاح (Next.js 14 - 13 صفحة مستقرة).
- **الخدمات المباشرة ومسارات المراقبة:**
  - Backend API: `http://localhost:4000/api`
  - Pilot & Launch API: `http://localhost:4000/api/pilot/config`
  - Operations Handover API: `http://localhost:4000/api/handover/kpis` & `/api/handover/package`
  - Health Probe: `http://localhost:4000/api/health`
  - Readiness Probe: `http://localhost:4000/api/health/ready`
  - Prometheus Metrics: `http://localhost:4000/api/monitoring/metrics/prometheus`
  - Swagger Documentation: `http://localhost:4000/api/docs`
  - Web Customer Store: `http://localhost:3000`
  - Web Admin Dashboard: `http://localhost:3001`
  - Web Admin Operations: `http://localhost:3001/operations`
  - Web Admin Launch Center: `http://localhost:3001/launch`
  - Web Admin Handover & Runbooks Center: `http://localhost:3001/handover`

---

## تحديث تنفيذي لاحق — بوابة SaaS وبيئة التطوير المحلية

**التاريخ:** 6 نوفمبر 2026  
**الفرع:** `production-completion`

- استبدال صفحة SaaS التعريفية بواجهة عربية RTL تتضمن تسجيل دخول حقيقياً عبر `/auth/admin/login` والتحقق الثنائي عبر TOTP، ولا تحتوي على حسابات أو رموز دخول وهمية.
- تقييد جلسة الواجهة إلى دور `SUPER_ADMIN`، وربط النظرة العامة ومؤشرات KPI وحالة النظام والمتاجر والاشتراكات والفواتير والخطط بمسارات `/saas/*`.
- إضافة إجراءات إنشاء المتجر، وتغيير حالته بسبب تدقيق، وتأكيد الفاتورة بعد إدخال مرجع الدفع والتحقق اليدوي، وتعديل أسعار العملات الثلاث.
- إضافة `docker/Dockerfile.saas` وإدراج خدمة `web-saas` في Docker Compose المحلي على المنفذ `3002`، وتحديث إعداد CORS المحلي.
- إضافة `docs/SAAS_ADMIN_PORTAL_GUIDE.md` وتحديث README لتوثيق التشغيل.

**حدود التحقق:** التغييرات حُفظت على الفرع المستقل فقط. لا تتوفر في هذه الجلسة بيئة تشغيل Docker/Node لتنفيذ build أو اختبارات الواجهة، ولا يُعد غياب نتائج CI نجاحاً. يجب التحقق من بناء `apps/web-saas` وملف Compose، ثم اختبار API والصلاحيات قبل تغيير حالة المرحلة. لا تزال بوابة النشر `NO-GO` بسبب نتائج تدقيق الاعتماديات واختبارات العزل والتشغيل الحي وبقية البنود الواردة في تقرير التدقيق.


---

## تحديث تنفيذي — ربط تطبيق Flutter بالـ API

**التاريخ:** 6 نوفمبر 2026  
**الفرع:** `production-completion`

### المنجز على مستوى الكود
- إضافة `apps/mobile-customer/lib/api_client.dart` لطلبات HTTP، حفظ access/refresh tokens في Secure Storage، تدوير refresh token، وتوحيد معالجة أخطاء API.
- تحويل تطبيق Flutter من بيانات ألعاب وأسعار ثابتة إلى تحميل كتالوج الخدمات والمنتجات والأسعار وحقول المستفيد من `GET /products/catalog`.
- إضافة تسجيل العميل والدخول والملف الشخصي وتسجيل الخروج.
- إضافة عرض المحافظ متعددة العملات من `GET /wallet/balances` دون تحويل عملات أو تعديل أرصدة من العميل.
- إضافة سجل الطلبات وتفاصيلها، وإنشاء الطلب عبر `POST /orders/checkout` مع `x-transaction-pin` ومفتاح Idempotency ثابت خلال محاولات شاشة الشراء.
- إضافة إعداد PIN المعاملة من صفحة الحساب، ومعالجة الحقول الاختيارية في نموذج المستفيد.
- إضافة `flutter_secure_storage`، واختبارات وحدات لمساعدات قراءة الاستجابات وتنسيق العملة، وإضافة `flutter test` إلى بوابة CI.
- إضافة `docs/MOBILE_APP_API_INTEGRATION.md` وتحديث README.

### ما لم يُنفذ بعد
- لم تُنفذ أو تُسجل نتيجة `flutter analyze` أو `flutter test` على جهاز محلي في هذه الجلسة؛ ننتظر GitHub Actions.
- مجلد Flutter يحتوي حالياً على مصدر التطبيق وملف pubspec، ويجب توليد مجلدات المنصات محلياً إذا لم تكن موجودة باستخدام `flutter create --platforms=android,ios .`.
- واجهة طلب الإيداع اليدوي وقنوات الدفع لم تُربط بعد.
- يلزم اختبار E2E على قاعدة بيانات Staging مع حساب عميل حقيقي، منتج متاح، سعر صالح، رصيد كافٍ، وPIN مضبوط.
- لم يتم تنفيذ ترقية جماعية لاعتماديات Node؛ لا يجوز تطبيق `npm audit fix --force` دون تحليل تغييرات SemVer واختبارات التوافق.

**حالة الإطلاق:** ما زالت `NO-GO` حتى نجاح CI، واختبارات العزل المالي والمتاجر، ومراجعة الثغرات، واختبار Staging والاستعادة.
