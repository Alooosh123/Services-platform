# Services-platform + n8n — الدفعة الأولى

هذه الدفعة تضيف طبقة تشغيل ومراقبة محلية فوق Backend الحالي، ولا تنقل منطق الأموال أو الصلاحيات إلى n8n.

## نطاق الدفعة
1. **مدير العمليات المركزي:** استقبال أحداث تشغيل غير مالية وتطبيعها وتلخيصها.
2. **مراقبة البنية التحتية:** فحص Backend بواسطة `GET /api/health` وقراءة الحالة الصحية فقط.
3. **النسخ الاحتياطي والتعافي:** استقبال دليل النسخ أو الاستعادة بعد تنفيذ أدوات PostgreSQL العملية الفعلية محلياً.

## الحزمة القابلة للاستيراد
ملفات Workflow JSON وPowerShell والاختبارات المحلية تم تسليمها في الحزمة:
`Services-platform_n8n_Phase1_Local_Operations_v1.1.zip`

استورد مجلد `workflows` بهذا الترتيب:
1. `12_NOTIFICATION_DISPATCHER.json`
2. `14_GLOBAL_ERROR_HANDLER.json`
3. `01_OPERATIONS_ORCHESTRATOR.json`
4. `02_INFRASTRUCTURE_WATCH.json`
5. `02_INFRASTRUCTURE_WATCH_SCHEDULE.json`
6. `03_BACKUP_DR_EVIDENCE.json`
7. `00_CORE_EVENT_ROUTER.json`

كل التدفقات غير نشطة افتراضياً. لا تفعّلها قبل ربط Credentials واختبارها محلياً.

## إعدادات محلية
- n8n: `http://127.0.0.1:5678`
- Backend: `http://127.0.0.1:4000`
- فحص Backend: `GET /api/health`
- لوحة الإدارة: `http://127.0.0.1:3001`
- المنطقة الزمنية: `Asia/Aden`

إذا كان n8n داخل Docker، استخدم العنوان الذي يمكن للحاوية الوصول إليه، وغالباً `host.docker.internal` في Docker Desktop.

## بيانات الاعتماد
أنشئ داخل n8n:
- Header Auth باسم `SP Agent Inbound` وترويسة `X-SP-Agent-Token`.
- Telegram API Credential إن رغبت بتنبيهات Telegram.
- بيانات اعتماد نموذج الذكاء الاصطناعي إذا استخدمت نموذجاً خارجياً.

لا تحفظ الأسرار في Git أو ملفات Workflow أو رسائل Telegram. لا تستخدم حساب مدير المنصة كحساب خدمة.

## حدود الأمان
- لا اعتماد إيداعات أو إضافة أرصدة.
- لا كتابة إلى Ledger.
- لا تنفيذ سحب أو حوالة.
- لا تشغيل أو إيقاف PostgreSQL أو Redis أو Backend.
- لا استعادة إلى قاعدة الإنتاج.
- لا إرسال بيانات شخصية أو إيصالات أو مفاتيح مزود إلى نموذج الذكاء الاصطناعي.

## حالة التحقق
المستودع يوثق عقد الربط والفحوص. استيراد JSON وربط Credentials واختبار نسخة n8n المحلية يحتاج جهاز Windows الذي يشغل n8n؛ لا تعتبر التدفقات مستوردة أو نشطة قبل ظهور تنفيذ ناجح داخل n8n.


## الاستيراد الآمن على Windows

بعد فك ضغط حزمة Phase 1، افتح PowerShell من حساب Windows نفسه الذي يشغّل n8n، ثم انتقل إلى مجلد السكربتات:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Import-Phase1Workflows.ps1
```

السكربت:
- يتحقق من وجود 7 ملفات JSON صالحة.
- يصدر نسخة من Workflows الحالية إلى `Documents\ServicesPlatform-n8n-backups` قبل الاستيراد.
- يستوردها عبر n8n Server CLI كمسودات غير نشطة باستخدام `--activeState=false`.
- لا ينشر أو يفعّل أي Trigger.
- يطلب تأكيداً قبل تعديل قاعدة n8n المحلية.

مهم: يجب تشغيله تحت حساب Windows وبيئة n8n نفسها حتى يستهدف قاعدة البيانات الصحيحة. إذا كان n8n داخل Docker، لا تشغل هذا السكربت على Windows Host؛ استخدم CLI داخل الحاوية مع المجلد المنقول إليها. افحص نسخة n8n أولاً من `n8n --version`.

بعد الاستيراد، اربط Header Auth credential في Webhook nodes وTelegram credential في Notification Dispatcher. راجع إعدادات كل Workflow، ثم نفّذ Smoke Test يدوياً قبل النشر.
