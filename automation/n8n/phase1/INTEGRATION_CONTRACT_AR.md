# عقد الربط بين NestJS وn8n — الدفعة الأولى

## 1. نقاط Backend المتحقق من وجودها
| المسار | الطريقة | استخدام الدفعة الأولى | المصادقة في Controller الحالي |
|---|---|---|---|
| `/api/health` | GET | فحص DB وRedis والطابور والذاكرة | لا يتطلب JWT |
| `/api/health/ready` | GET | فحص الجاهزية | لا يتطلب JWT |
| `/api/health/live` | GET | فحص حياة العملية | لا يتطلب JWT |
| `/api/monitoring/metrics` | GET | قراءة مؤشرات التشغيل | لا يتطلب JWT |
| `/api/monitoring/metrics/prometheus` | GET | Prometheus metrics | لا يتطلب JWT |

المسارات أعلاه موجودة في فرع `main` الذي تمت مراجعته. طابق البادئة مع `API_PREFIX` الفعلي.

## 2. واجهات ممنوعة على وكلاء الدفعة الأولى
هذه العمليات خارج نطاق n8n في هذه المرحلة:
- `POST /api/reconciliation/run`
- `POST /api/reconciliation/resolve-discrepancy/:itemId`
- `POST /api/monitoring/alerts` و`POST /api/monitoring/alerts/:id/resolve`
- `POST /api/payouts/admin/:id/dispatch`
- أي مسار اعتماد إيداع أو كتابة Ledger أو تغيير محفظة.

لا تمنح وكلاء التشغيل JWT مالياً أو دور OWNER/FINANCE_MANAGER. تكفي عمليات GET الصحية.

## 3. أحداث النسخ الاحتياطي
تستخدم سكربتات Windows Webhook داخل n8n مع ترويسة `X-SP-Agent-Token`.

مثال النسخ:
```json
{
  "eventId": "backup-unique-id",
  "eventType": "backup.result.created",
  "status": "BACKUP_CREATED",
  "sha256": "sha256-value",
  "hmacSha256": "hmac-value",
  "restoreVerified": false,
  "occurredAt": "2026-11-21T00:00:00.000Z"
}
```

مثال الاستعادة:
```json
{
  "eventId": "restore-unique-id",
  "eventType": "backup.restore.verified",
  "status": "RESTORE_VERIFIED",
  "restoreVerified": true,
  "ledgerBalanced": true,
  "ledgerTransactionCount": 0,
  "rtoSeconds": 42,
  "rpoSeconds": null,
  "occurredAt": "2026-11-21T00:00:00.000Z"
}
```

عدد قيود يساوي صفراً يصف قاعدة الاختبار المستعادة فقط، ولا يثبت سلامة بيانات إنتاجية. لا يُستنتج RPO من RTO.

## 4. ما لم يُنفذ في Backend
لا يوجد حالياً Event Bus عام أو Outbox يرسل جميع أحداث المنصة إلى n8n، ولا Service Account API مستقل لـ n8n.
- المراقبة تستخدم polling لواجهات GET.
- النسخ والاستعادة يرسلان أدلة من سكربت Windows.
- لا ترسل بيانات عملاء أو معلومات مالية إلى n8n.
- لا يمنح Webhook n8n حق تنفيذ إجراء في Backend.

إضافة HMAC outbound event delivery أو هوية خدمة مستقلة تحتاج تغيير Backend واختبارات RBAC وReplay/Idempotency قبل تفعيلها.

## 5. الشبكة
- n8n Native على Windows: `http://127.0.0.1:4000`.
- n8n داخل Docker: استخدم عنوان المضيف الذي يمكن للحاوية الوصول إليه، غالباً `http://host.docker.internal:4000`.
- لا تعرض Webhook على الإنترنت دون HTTPS ومصادقة قوية وRate Limits وتسجيل تدقيق.
