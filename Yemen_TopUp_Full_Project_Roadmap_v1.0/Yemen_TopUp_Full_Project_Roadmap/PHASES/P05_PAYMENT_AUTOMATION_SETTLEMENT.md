# P05 — أتمتة الإيداع والتحويل إلى مزودي الخدمة وتسوية الأموال
**ملف مستقل لتنفيذ مرحلة واحدة | الإصدار v1.0 | التاريخ 2026-10-09**

| الحقل | التفاصيل |
|---|---|
| الحالة | مخطط؛ قد يُحجب جزئيًا حتى عقود وواجهات مزودين |
| الاعتماديات | P03 P04 وشراكات تجارية معتمدة |
| المتطلبات المرتبطة | BR-01 وBR-06 وBR-07؛ AR-04 وAR-14 |
| التالي بعد الاعتماد | P06 |

## الهدف والنطاق
تفعيل التحويلات الآلية الفعلية عند وجود تفويض وتكامل رسمي، دون إلغاء مسار المراجعة اليدوية.

## الأعمال المطلوبة بالتسلسل
1. كتابة `PaymentChannelAdapter` بقدرات منفصلة `depositConfirm`, `transactionLookup`, `payout`, `balance`, `reconcile`؛ دعم capability flags.
2. التأكد من ملكية/قانونية حسابات الاستقبال وتفاصيل العملاء وعدم نشر أي أرقام اختبار أو أرقام غير مؤكدة.
3. إن توفرت API لدفع وارد، تحقق من Signature/Webhook وReference/Amount/Currency/Beneficiary وتكرار الطلب قبل CREDITED.
4. إن لم تتوفر API لاستلام الأموال، ابق تدفق `MANUAL_VERIFY` مع رفع سند ومطابقة كشف رسمي.
5. إعداد Supplier Balance/Prepaid Account أو Pay-Per-Order Transfer حسب طبيعة عقد شركة الشحن؛ فرق بين fulfillment cost وcash movement.
6. ربط تنفيذ الشحن بالتحقق من رصيد الحساب التجاري عند المزود وحدود الائتمان والمعاملات.
7. إن توفر API سحب/تحويل رسمي، نفّذ Payment Outbound بأوامر idempotent وصلاحيات منفصلة ومراجع مؤكدة.
8. نفّذ Reconciliation Batch يومي: bank/wallet statement ↔ deposits/payouts ↔ provider charges ↔ ledger journals.
9. ضع Unknown Deposits/Unknown Payouts/Disputes في مسار يدوي مع إيقاف إعادة الإرسال حتى اتضاح النتائج.
10. تحديث رسوم كل قناة وعمولاتها والحدود اليومية والفروق بين العملات؛ اختبارات Sandbox ثم مبالغ منخفضة في Pilot.

## المخرجات التي يجب تسليمها
- قنوات دفع قابلة للتبديل Manual/API
- آلية ربط شركة الشحن/الرصيد التجاري
- Reconciliation Dashboard & Exceptions
- تقارير نجاح فعلية من مزود رسمي أو تعليمات تشغيل Manual

## اختبارات القبول الخاصة بالمرحلة
- [ ] AT-16 وAT-18 وAT-21
- [ ] مكرر webhook لا يضيف رصيدًا مرتين
- [ ] مرجع إيداع لا يطابق المبلغ أو العملة لا يعتمد تلقائيًا
- [ ] قناة غير متوفرة تتحول إلى Manual/Disabled بأمان

## أهم المخاطر والقيود
- مزود لا يتيح تحويلًا آليًا.
- التباس «إرسال طلب API» مع «تحويل مال»
- Mismatch settlement & working capital

## بوابة الإغلاق (Definition of Done)
**إثبات مزود رسمي أو إبقاء ميزات AUTO غير مفعّلة وموسومة BLOCKED_EXTERNAL؛ التسويات تمر.**

يجب إضافة سجل تنفيذ حقيقي يثبت: نتائج Unit/Integration/E2E، مخطط وتغييرات قاعدة البيانات، endpoints وواجهات UI، مراجع القيود المالية عند ارتباطها بالأموال، وتحديث Swagger والوثائق. أي تكامل لا يملك اعتمادًا رسميًا يوضع `BLOCKED_EXTERNAL` دون ادعاء إنجازه.

## مهمة وكيل البرمجة لهذه المرحلة
اقرأ `10_AGENT_EXECUTION_PROTOCOL.md` ونفّذ **فقط P05** على النسخة الحالية مع المحافظة على Phase 1 وPhase 2 وStrict Double-Entry Ledger. ابدأ Gap Analysis، ثم Code + Migrations + Tests + Updated Docs، واكتب `docs/PHASE_05_IMPLEMENTATION_REPORT.md`. لا تنتقل إلى P06 دون قبول المخرجات.
