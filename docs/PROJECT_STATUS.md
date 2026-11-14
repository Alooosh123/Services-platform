# تقرير حالة المشروع الشامل (Project Status Report)
## منصة الشحن والخدمات الرقمية — اليمن (Yemen Market Digital TopUp Platform v1.0)
**تاريخ التحديث:** 29 أكتوبر 2026 | **الإصدار:** 1.0.0 | **الحالة:** لا يوجد اعتماد إنتاجي؛ المراحل التشغيلية 10–12 غير معتمدة

---

## 0. تحديث فرع hardening — 13 نوفمبر 2026

- تم تحويل مخطط Prisma النشط إلى MySQL 8.4، مع أرشفة ترحيلات PostgreSQL القديمة وأدوات تصدير/استعادة مصدر منفصلة. لم يتم نقل بيانات الإنتاج.
- تم اعتماد Podman Desktop + Podman Compose وملفات Containerfile مستقلة، مع منافذ تطوير محلية وأسرار مطلوبة.
- تدقيق الاعتماديات في تشغيل CI رقم 43508745686: اعتماديات الإنتاج 0 ثغرات، والتدقيق الكامل 9 منخفضة فقط، ولا توجد ثغرات عالية/حرجة. الحاجز يبقى مفعلاً ولا يتجاهل النتائج.
- نقاط المقاييس محمية بـ JWT/RBAC، وأضيفت اختبارات مستقلة لحارسي الأدوار والسياسات.
- قنوات الدفع الخارجية الافتراضية غير مفعلة ولا تعرض أرقاماً تجريبية؛ الإيداع اليدوي يتطلب موافقة مالية مستقلة قبل القيد.
- أضيف وكيل MikroTik للقراءة فقط عبر HTTPS وREST ومسارات GET محددة، مع قواعد تشخيص تستند إلى وثائق MikroTik الرسمية. لم يتصل بعد بجهاز فعلي لعدم توفر جهاز اختبار وشهادة وحساب مقيّد.
- أضيفت سجلات موافقات الشبكة والمطابقة، وأُغلق مسار تسوية الفروق المباشر، وأصبح محرك المطابقة يستخدم Decimal.
- **لم يتم تفعيل مزود دفع حقيقي أو إجراء ترحيل PostgreSQL إلى MySQL أو اختبار RouterOS حي أو اعتماد إطلاق الإنتاج.** تتطلب هذه البنود بيانات مزود/جهاز وبيئة معزولة ومطابقة مالية موثقة. راجع وثائق MYSQL_PODMAN_MIGRATION_PLAN وMIKROTIK_READ_ONLY_AGENT وMANUAL_PAYMENT_OPERATIONS وPRODUCTION_READINESS_EVIDENCE_2026-11-13.

## 1. ملخص جاهزية المراحل (Phases Completion Summary)

| المرحلة (Phase) | النطاق الوظيفي | الحالة | نسبة الإنجاز والضوابط |
| :--- | :--- | :---: | :--- |
| **Phase 1: Foundation & Ledger** | البنية التحتية، العملات اليمنية (YER/USD/SAR)، دفتر الأستاذ المزدوج الصارم | `COMPLETED` | 100% — توازن الدائن والمدين، منع التحويل التلقائي. |
| **Phase 2: Auth & Wallets** | المصادقة الحقيقية، محافظ العملاء، إيداعات الحوالات اليدوية | `COMPLETED` | 100% — دورة موافقة الإيداعات، تدقيق الرصيد المزدوج. |
| **Phase 3: Shopping & Fulfillment** | شراء الخدمات، تنفيذ الطلبات، محولات المزودين، طابور التنفيذ اليدوي | `COMPLETED` | 100% — فصل حالات الدفع والتنفيذ، عزل بيئة الإنتاج. |
| **Phase 3.1: Security Gate** | إلغاء كلمات المرور المكشوفة، TOTP MFA حقيقي، فحص SSRF وBOLA | `COMPLETED` | 100% — بوابة أمان صارمة تمنع تشغيل الإنتاج بأسرار ضعيفة. |
| **Phase 4: Phone, Consent & AI** | تأكيد الهواتف اليمنية، ربط حسابات الخدمات، تقييم المخاطر الذكي، طابور المراجعة | `COMPLETED` | 100% — صفر أثر مالي، دفاع ضد حقن الأوامر، 72 اختباراً ناجحاً. |
| **Phase 5: Payment Automation & 3-Way Reconciliation** | مسارات الإيداع اليدوي، التسوية، سجل الأستاذ، وحالات المزودين | `PARTIALLY COMPLETED` | تدفقات الإيداع اليدوي والمطابقة مؤمنة برمجياً؛ لا يوجد مزود يمني آلي موثق ولا تحويل خارجي حقيقي معتمد. |
| **Phase 6: Admin Dynamic Catalog, Package Margins & Dynamic Channels** | الكتالوج الديناميكي، تسعير الباقات، إعدادات القنوات، الرقابة الثنائية وزر الطوارئ | `PARTIALLY COMPLETED` | إدارة حسابات القنوات أصبحت دائمة ومعتمدة بشخصين؛ لا تزال الحسابات الفعلية بحاجة إلى مستندات ملكية واعتماد مالي ميداني. |
| **Phase 7: Daily Close Reports, Profit Engine & Owner Payouts** | تقارير الإقفال وفصل الأرباح وطلبات السحب اليدوية | `PARTIALLY COMPLETED` | تم تشديد حجز رصيد السحب، الموافقة الثنائية، والتسوية بقيد مزدوج؛ لا يوجد مزود تحويل آلي حقيقي معتمد. |
| **Phase 8: Customer Mobile UX, Notifications & Support** | تجربة الجوال PWA، الإشعارات المعتمدة، تذاكر الدعم والنزاعات، حجب الملاحظات الداخلية، وأداة تشخيص الطلبات | `COMPLETED` | 100% — اجتياز AR-01 وAR-07 وAR-15 وAR-20، 115 اختباراً ناجحاً (16 حزمة اختبار). |
| **Phase 9: Security, Compliance, Anti-Fraud & Privacy** | نموذج التهديدات STRIDE، حماية BOLA/IDOR، عزل الذكاء الاصطناعي والصفر المالي، تبريد SIM Swap، تجميد المحافظ، وحق النسيان AR-08 | `COMPLETED` | 100% — اجتياز AT-08 وAT-09 وAT-19، 128 اختباراً ناجحاً (17 حزمة اختبار). |
| **Phase 10: Production Readiness, Staging & Disaster Recovery** | MySQL 8.4، Podman، النسخ والاستعادة، المراقبة وCI/CD | `BLOCKED` | تحقق CI من baseline MySQL 8.4 وتمرين backup/restore معزول. لم يتم ETL من PostgreSQL الإنتاجي، ولا يوجد قياس RTO/RPO ببيانات مماثلة للإنتاج أو اختبار استعادة إنتاجي. أدلة PostgreSQL السابقة تاريخية ولا تثبت جاهزية MySQL. |
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
  - آخر دليل CI تمت مراجعته قبل إعادة تشغيل بناء Prisma: اجتازت بوابة الاعتماديات واختبارات Backend وMySQL baseline/backup/restore على MySQL 8.4. فشل بناء Monorepo في ذلك التشغيل بسبب عدم توليد Prisma Client قبل Nest build؛ أضيفت خطوة توليده ويجري التحقق من التشغيل التالي.
  - لا تمثل الاختبارات الآلية اتصالاً حياً بـ MikroTik أو Redis خارجي أو محافظ/مزودي دفع حقيقيين.
  - اتصال PostgreSQL والترحيلات/النسخ المذكورة في الأقسام التاريخية يخص مرحلة سابقة فقط؛ لم يتم نقل بيانات الإنتاج إلى MySQL.
  - AT-20 وAT-21 ومناورات P12 والإطلاق الحقيقي ما زالت غير معتمدة دون بيئات وأدلة حية.
- **حزم الإنتاج (Production Builds):**
  - `@digital-topup/shared`: تم البناء والتحزيم بنجاح.
  - `@digital-topup/database`: تم توليد العميل وبنائه بنجاح (Prisma v5.22.0).
  - `@digital-topup/backend`: يتطلب تحققاً من أحدث تشغيل بعد توليد Prisma Client في مهمة Build.
  - `@digital-topup/web-admin` و`@digital-topup/web-customer` و`@digital-topup/web-saas`: شُغلت بنجاح في تشغيل CI السابق باستخدام Next.js 15.5.29؛ يجب أن يكتمل بناء Monorepo كله قبل إعلان الجاهزية.
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