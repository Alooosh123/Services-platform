# استيراد الوكلاء الإضافيين في n8n

## الترتيب المطلوب
1. استورد Workflows السبعة الأساسية من حزمة Phase 1.
2. اربط Header Auth وLLM/Telegram credentials.
3. شغّل Smoke Test وفحص Backend health واختبارات Backup/Restore على قاعدة محلية اختبارية.
4. بعد نجاح Phase 1، استورد العشرة الإضافيين فقط.

## السكربت
السكربت: `scripts/Import-RemainingAgents.ps1`

يجب تمرير مسار مجلد JSON من الحزمة التنفيذية صراحةً:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Import-RemainingAgents.ps1 -WorkflowDir "D:\\ServicesPlatform-n8n\\02_ALL_12_AGENTS\\workflows"
```

يتحقق السكربت من وجود الملفات العشرة، يصدر نسخة احتياطية من Workflows الحالية، ثم يستورد العشرة باستخدام `import:workflow --activeState=false`. لا يقوم بنشر أو تفعيل Workflow.

## الملفات التي يستوردها
- 04 Wallet Deposit Intake
- 05 Financial Reconciliation
- 06 Daily Finance Report Schedule
- 06 Earnings Daily Report
- 07 Fulfillment Monitor
- 08 Customer Support
- 09 Fraud Security
- 10 Account Linking Review
- 11 QA/DevOps
- 13 Approval Notifier

لا يعيد استيراد الوكلاء السبعة المشتركة مع Phase 1.

## ضوابط
- الوكلاء 04/05/06/10 لا تُفعّل للعمليات المالية أو الحساسة.
- لا تستخدم JWT الخاص بـ OWNER أو FINANCE أو SUPER_ADMIN في n8n.
- لا تضع Bot Tokens أو LLM API Keys أو Database URLs في ملفات Git.
- لا تعتبر الاستيراد مرادفاً للتفعيل أو الإنتاج.
