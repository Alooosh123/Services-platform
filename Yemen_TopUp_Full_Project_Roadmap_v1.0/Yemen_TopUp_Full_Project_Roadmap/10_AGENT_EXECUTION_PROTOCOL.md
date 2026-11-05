# AGENT EXECUTION PROTOCOL — أسلوب التنفيذ مع AI Coding Agent
**الغرض:** كل ملف مرحلة يُنفذ بصورة مستقلة وبالتسلسل، مع منع اختزال الملفات إلى شكل فقط.

## الخطوات الثابتة لكل مرحلة
1. اقرأ `00_README_START_HERE.md` و`01_MASTER_PROJECT_PLAN.md` و`03_DETAILED_REQUIREMENTS_SRS.md` والمرحلة المحددة وملفات `docs/` الموجودة بالمشروع.
2. **افحص الكود الموجود** (NestJS, Prisma, web-customer, web-admin) والـDB schema والمهاجرات والـledger. لا تفترض ما تم من تقارير المستخدم دون مقارنة.
3. أنشئ `PHASE_XX_GAP_ANALYSIS.md`: جدول EXISTING / MISSING / CONFLICT / RISK. لا تغير البيانات قبل خطة migration.
4. أنشئ خطة ملفات ومسارات APIs وتحديثات Schema وشجرة اعتماديات واختبارات، ثم نفذ بأصغر تغييرات متوافقة مع البنية الحالية.
5. امنع Mock Data على الواجهات الحقيقية، ولا تكتب أسماء مزودين أو حقول مالية أو أرقام استقبال وهمية على أنها بيانات إنتاج.
6. استخدم transaction/idempotency/outbox/audit لكل عملية مالية خارجية حسب انطباقها.
7. شغّل الاختبارات Unit + Integration + E2E + Security Scenarios ولا تتجاوز أي فشل بوسم نجاح اصطناعي.
8. حدّث Swagger والوثائق وTraceability ثم سجّل تقرير `docs/PHASE_XX_IMPLEMENTATION_REPORT.md`.
9. أضف فقرة `BLOCKED_EXTERNAL` لأي تكامل غير ممكن دون اعتماد رسمي، مع خطة بديل Manual وأدلة النقص.
10. اترك المشروع قابلاً للتشغيل، ولا تنتقل إلى المرحلة التالية إلا بعد تقرير قبول شامل.

## قالب أمر النسخ لوكيل البرمجة
```text
You are the lead implementation agent for Yemen Digital TopUp & Services Platform.
Read and follow: 00_README_START_HERE.md, 01_MASTER_PROJECT_PLAN.md,
03_DETAILED_REQUIREMENTS_SRS.md, 06_ARCHITECTURE_AND_MONEY_FLOWS.md,
10_AGENT_EXECUTION_PROTOCOL.md, and PHASES/[CURRENT_PHASE_FILE].
Inspect the existing project first, preserve Phase 1/2 and the strict double-entry ledger.
Implement ONLY the selected phase and mandatory prerequisite fixes.
Provide real code, migrations, tests, evidence, Swagger/docs and a gap/completion report.
Never claim third-party API, phone identity proofing, fund transfer, fulfillment or payout
works unless proven with authorized credentials and verifiable provider confirmations.
Mark external blockers explicitly, keep a controlled manual alternative when lawful.
```

## صيغة تقرير التسليم
- التغييرات: ملفات/روابط PR/المخططات.
- حالات المتطلبات: VERIFIED_DONE / PARTIAL / BLOCKED_EXTERNAL / NOT_STARTED.
- سجلات الاختبارات: أمر التشغيل ونتيجة واقعية وأي failing cases.
- المالية: Ledger IDs وReconciliation Results بتجربة اختبارية معتمدة.
- الأمان: حدود الصلاحيات، السجلات، ونتائج حالات إساءة الاستعمال.
- إجراءات نشر/تراجع وهجرة البيانات.
- قرار الانتقال للمرحلة التالية ومن اعتمده.
