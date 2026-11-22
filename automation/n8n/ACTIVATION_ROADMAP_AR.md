# خارطة تنفيذ وكلاء n8n لمنصة Services-platform

## الهدف
تشغيل وكلاء n8n تدريجياً دون نقل صلاحيات المنصة أو منطق الأموال من NestJS. n8n للتنسيق والتحليل والتنبيه فقط؛ Backend يظل صاحب القرار ومصدر الحقيقة.

## المرحلة 0 — تثبيت البيئة (لا تفعيل)
- تثبيت n8n المحلي وتحديد طريقة تشغيله: Native Windows أو Docker.
- تثبيت نسخة n8n والتحقق من توافق Node versions للعقد.
- ضبط المنطقة الزمنية Asia/Aden.
- إنشاء Header Auth Credential منفصل للـ Webhooks.
- إنشاء Telegram Credential في n8n عند الحاجة.
- استخدام مفاتيح محلية تجريبية وعدم وضع أسرار حقيقية في Git أو JSON.
- تصدير نسخة احتياطية من Workflows الحالية قبل الاستيراد.

معيار الاجتياز: نسخة n8n تعمل، وتصدير Workflows الحالي يمكن فتحه، وكل Secrets محفوظة خارج Git.

## المرحلة 1 — وكلاء التشغيل المحلي الثلاثة
1. مدير العمليات المركزي (01): تحليل وتلخيص أحداث غير مالية.
2. مراقبة البنية التحتية (02): GET health/readiness فقط، مع تصنيف حتمي.
3. النسخ الاحتياطي والتعافي (03): استقبال أدلة النسخ والاستعادة فقط.

خطوات التنفيذ:
- استيراد Phase 1 من الحزمة v1.3 عبر Import-Phase1Workflows.ps1.
- التحقق من بقاء التدفقات غير نشطة.
- ربط Header Auth وTelegram/LLM credentials.
- تنفيذ Smoke Event غير مالي.
- اختبار Health schedule يدوياً، ثم تفعيله بعد مراجعة المخرجات.
- تشغيل Backup على قاعدة اختبار، ثم Restore إلى قاعدة اختبار محلية منفصلة.
- تنفيذ Ledger verification read-only وتوثيق RTO/RPO الحقيقيين من الاختبار.

معيار الاجتياز: كل Workflow ينفذ يدوياً بلا أخطاء، والتنبيهات تصل دون بيانات شخصية أو مالية حساسة، وRestore drill ينجح على قاعدة اختبار منفصلة.

## المرحلة 2 — تكامل أحداث موثوق مع Backend
ما ينقص Backend قبل تشغيل بقية الوكلاء تلقائياً:
- Outbox transactional موثوق يكتب الحدث داخل نفس معاملة العملية.
- توقيع HMAC outbound، timestamp، eventId، correlationId، schema version.
- حماية Replay/Idempotency وretry/dead-letter queue.
- endpoint أو توصيل webhook خاص باستخدام هوية خدمة مستقلة.
- سجل audit لمخرجات n8n ومَن استلم الحدث.
- allowlist لأسماء الأحداث والحقول المسموح بها لكل وكيل.
- PII minimization قبل إرسال البيانات خارج Backend.
- لا ترسل raw SQL أو credentials أو ملفات إثبات إلى LLM.

معيار الاجتياز: حدث test ينتقل مرة واحدة من Backend إلى n8n، ويُرفض التوقيع غير الصحيح وإعادة الإرسال القديمة، ولا تتسرب بيانات غير مسموح بها.

## المرحلة 3 — الوكلاء غير الماليين وتحليل الحالات
يمكن تفعيل الوكلاء التالية تدريجياً بعد Phase 2:
- 07 Fulfillment Monitor: توصية STATUS_QUERY/MANUAL_REVIEW فقط. لا إعادة شحن عند UNKNOWN ولا Refund.
- 08 Customer Support: مسودات رد فقط ومراجعة بشرية. PII redaction قبل LLM.
- 09 Fraud/Security: توصيات ومؤشرات، لا تجميد محافظ ولا تعطيل قنوات.
- 11 QA/DevOps: تحليل نتائج CI وPR فقط، دون Merge أو Deploy أو Shell commands.
- 12 Notification Dispatcher: بعد Telegram/private channel configuration وrate limit واختبار redaction.

معيار الاجتياز: اختبارات حالات سلبية، بيانات وهمية فقط، لا تنفيذ كتابة في Backend، ومراجعة سجلات التنفيذ.

## المرحلة 4 — المجالات المالية والحساسة (محجوبة حتى تحقق الشروط)
هذه الوكلاء ليست مخولة بقرارات مالية حتى بعد تفعيلها:
- 04 Wallet Deposit Intake: تحليل مرشح المطابقة. لا اعتماد إيداع ولا رصيد. لا يُعتمد SMS أو Screenshot وحده.
- 05 Financial Reconciliation: قراءة نتائج فقط. لا FORCE_MATCH أو ADJUST_LEDGER ولا تغيير الحالة.
- 06 Earnings/Finance Reports: لا اتصال بالـ endpoints المحمية باستخدام JWT مالك أو مالية؛ يلزم Service Account read-only مستقل.
- 10 Account Linking: لا قراءة identifiers كاملة ولا موافقة/رفض. قرار Owner يظل في Backend.

قبل أي تشغيل مالي:
- مصدر رسمي أو كشف حساب موثّق ومصادق عليه أو تكامل مزود موقّع.
- موافقات قانونية وتنظيمية مكتوبة خاصة بكل قناة/مزود.
- هوية Backend read-only ضيقة الصلاحيات لكل نطاق بيانات.
- اختبارات RBAC وtenant isolation وreplay/idempotency.
- فصل اقتراح الوكيل عن اعتماد الموظف المالي، مع أربعة أعين حيث يلزم.
- كل كتابة مالية تبقى معاملة ذرية داخل Backend وسجل Ledger غير قابل للتعديل.

معيار الاجتياز: مراجعة أمنية ومالية مستقلة وتوقيع قبول قبل ربط أي عملية بأموال حقيقية.

## المرحلة 5 — الانتقال إلى VPS
- نقل n8n خلف HTTPS/TLS ونطاق خاص.
- قاعدة بيانات n8n منفصلة عن قاعدة المنصة.
- إدارة الأسرار عبر Secret Manager أو Credentials، ومنع وصول متغيرات البيئة من Code nodes على خادم متعدد المستخدمين بعد نقل العقد إلى Credentials.
- تفعيل Basic Auth/SSO وMFA بحسب الإمكانيات، وتقييد API/Webhook IPs.
- تشفير النسخ، نسخة خارج الخادم، Restore drill دوري، ومراقبة الموارد.
- حفظ logs لفترة محددة مع إخفاء PII وبيانات الدفع.
- لا نشر تلقائي ولا Merge تلقائي ولا تغييرات RBAC من n8n.

## معيار الإطلاق
لا يُعلن Production Ready إلا بعد:
1. Phase 1 local acceptance.
2. Backend outbox/S2S tests.
3. Independent security/financial review.
4. Provider/legal approvals where relevant.
5. Restore drill with measured RTO/RPO.
6. Staging end-to-end tests and monitoring.
7. Owner approval recorded for production cutover.
