# عقد الربط بين NestJS وn8n — الدفعة الأولى

## 1. نقاط Backend التي تم التحقق من وجودها

| المسار | الطريقة | الاستخدام في الدفعة الأولى | المصادقة |
|---|---|---|---|
| `/api/health` | GET | فحص DB وRedis والطابور والذاكرة | لا يتطلب JWT في Controller الحالي |
| `/api/health/ready` | GET | فحص الجاهزية | لا يتطلب JWT في Controller الحالي |
| `/api/health/live` | GET | فحص حياة العملية | لا يتطلب JWT في Controller الحالي |
| `/api/monitoring/metrics` | GET | قراءة مؤشرات التشغيل | لا يتطلب JWT في Controller الحالي |
| `/api/monitoring/metrics/prometheus` | GET | قراءة Prometheus metrics | لا يتطلب JWT في Controller الحالي |

يجب مطابقة المسار مع `API_PREFIX` الفعلي (الافتراضي في المشروع هو `api`).

## 2. واجهات ليست ضمن الدفعة الأولى

هذه المسارات موجودة لكنها حساسة ولا يستدعيها n8n في هذه المرحلة:

- `POST /api/reconciliation/run`
- `POST /api/reconciliation/resolve-discrepancy/:itemId`
- `POST /api/monitoring/alerts`
- `POST /api/monitoring/alerts/:id/resolve`
- `POST /api/payouts/admin/:id/dispatch`
- أي مسار اعتماد إيداع أو كتابة Ledger أو تغيير محفظة.

لا تمنح وكيل التشغيل JWT مالي أو دور OWNER/FINANCE_MANAGER. المراقبة تكفيها عمليات GET العامة المذكورة أعلاه.

## 3. الأحداث بين سكربتات التشغيل وn8n

تستخدم سكربتات النسخ المحلي Webhook في n8n وترسل `X-SP-Agent-Token`. أمثلة أنواع الحدث:

### Backup created

```json
{
  "eventId": "backup-<unique-id>",
  "eventType": "backup.result.created",
  "status": "BACKUP_CREATED",
  "sha256": "<sha256>",
  "hmacSha256": "<hmac>",
  "restoreVerified": false,
  "occurredAt": "<ISO-8601 UTC>"
}
```

### Restore verified

```json
{
  "eventId": "restore-<unique-id>",
  "eventType": "backup.restore.verified",
  "status": "RESTORE_VERIFIED",
  "restoreVerified": true,
  "ledgerBalanced": true,
  "ledgerTransactionCount": 0,
  "rtoSeconds": 42,
  "rpoSeconds": null,
  "occurredAt": "<ISO-8601 UTC>"
}
```

`ledgerTransactionCount=0` لا يثبت سلامة استعادة إنتاجية؛ يصف عدد القيود في قاعدة الاستعادة المختبرة فقط. توثيق RPO مسؤولية مشغل الاختبار ولا يستنتج من RTO.

## 4. ما لم يتم بناؤه في Backend بعد

لا يوجد حالياً Event Bus عام أو Outbox مخصص يرسل كل أحداث المنصة تلقائياً إلى n8n، ولا توجد هوية Service Account مستقلة خاصة بـ n8n ضمن الـ API.

لذلك، في الدفعة الأولى:
- مراقبة البنية التحتية تعمل بالاستعلام الدوري GET.
- دليل النسخ والاستعادة يصل من سكربت PowerShell المحلي إلى Webhook n8n.
- لا تستقبل n8n بيانات مالية أو بيانات عملاء.
- لا تفترض أن Webhook داخل n8n يملك حق تنفيذ أي إجراء داخل Backend.

إضافة HMAC outbound event delivery أو Service Account API ستحتاج تغيير Backend منفصلاً واختبارات RBAC وReplay/Idempotency قبل تفعيلها.

## 5. شبكة التشغيل

- عندما يعمل n8n Native على Windows، يمكنه استخدام `http://127.0.0.1:4000`.
- عندما يعمل n8n داخل Docker Desktop، استخدم عنوان المضيف الذي يمكن للحاوية الوصول إليه، غالباً `http://host.docker.internal:4000`.
- لا تعرض Webhook n8n على الإنترنت من دون HTTPS ومصادقة قوية وrate limits وتسجيل تدقيق.
