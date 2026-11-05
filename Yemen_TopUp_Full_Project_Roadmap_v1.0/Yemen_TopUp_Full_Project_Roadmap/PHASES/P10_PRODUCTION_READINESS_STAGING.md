# P10 — بنية الإنتاج والمراقبة والنسخ الاحتياطي وضمان الجودة
**ملف مستقل لتنفيذ مرحلة واحدة | الإصدار v1.0 | التاريخ 2026-10-09**

| الحقل | التفاصيل |
|---|---|
| الحالة | مخطط |
| الاعتماديات | P03–P09 |
| المتطلبات المرتبطة | NFR-01, NFR-02, NFR-06, NFR-08؛ AR-16 |
| التالي بعد الاعتماد | P11 |

## الهدف والنطاق
تجهيز منصة مستقرة وخطط تعافٍ ومراقبة واضحة قبل فتح التسجيل العام.

## الأعمال المطلوبة بالتسلسل
1. فصل بيئات Dev/Staging/Production وملفات البيئة والأسرار والهجرات، وعدم نسخ بيانات عملاء الإنتاج إلى الاختبار دون حماية.
2. إعداد domain/TLS/WAF/secure cookies وإعدادات قاعدة البيانات وQueue/object storage مع backups معتمدة.
3. تهيئة CI/CD بفحص Unit/Integration/E2E وlint وsecurity checks وMigration dry-run وRollback.
4. مراقبة HTTP errors وlatency وDB locks وQueue lag وDeposit mismatches وUnknown provider orders وPayout failures.
5. إنشاء Daily Finance Reconciliation Alert وSLO/SLA ورقابة uptime، ومسارات escalation للإدارة المالية.
6. اختبار restore backup ومخطط RTO/RPO، وتوثيق ما يحدث عند سقوط البنك/مزود الشحن/شبكة الرسائل.
7. اختبار الضغط على عمليات Checkout والتزامن والصفوف/إعادة المحاولة، ومراجعة الكلفة التشغيلية.
8. تجهيز وثائق تشغيل/إيقاف خدمات وإجراءات بعد اختراق وPlaybooks واعتماد UAT.

## المخرجات التي يجب تسليمها
- Staging موثقة
- Monitoring/Alerts
- CI/CD + Rollback + DB Backups
- Disaster Recovery Test Evidence
- Release Candidate وUAT

## اختبارات القبول الخاصة بالمرحلة
- [ ] AT-20
- [ ] Stress run للشراء المتزامن
- [ ] إطفاء Worker ثم تشغيله دون تكرار شحن
- [ ] انقطاع مزود الدفع يؤدي إلى حالة آمنة

## أهم المخاطر والقيود
- فشل الاستعادة رغم نجاح أخذ Backup
- انقطاع مزود خارجي دون تنبيهات
- تسرّب سر API إلى git

## بوابة الإغلاق (Definition of Done)
**قائمة `09_PRODUCTION_LAUNCH_CHECKLIST.md` مكتملة وموقعة.**

يجب إضافة سجل تنفيذ حقيقي يثبت: نتائج Unit/Integration/E2E، مخطط وتغييرات قاعدة البيانات، endpoints وواجهات UI، مراجع القيود المالية عند ارتباطها بالأموال، وتحديث Swagger والوثائق. أي تكامل لا يملك اعتمادًا رسميًا يوضع `BLOCKED_EXTERNAL` دون ادعاء إنجازه.

## مهمة وكيل البرمجة لهذه المرحلة
اقرأ `10_AGENT_EXECUTION_PROTOCOL.md` ونفّذ **فقط P10** على النسخة الحالية مع المحافظة على Phase 1 وPhase 2 وStrict Double-Entry Ledger. ابدأ Gap Analysis، ثم Code + Migrations + Tests + Updated Docs، واكتب `docs/PHASE_10_IMPLEMENTATION_REPORT.md`. لا تنتقل إلى P11 دون قبول المخرجات.
