# نموذج التهديدات والمراجعة الأمنية الشاملة (Threat Model & Security Review)
## منصة الشحن والخدمات الرقمية — اليمن (Yemen Market Digital TopUp Platform v1.0)
**الإصدار:** v1.0 | **تاريخ الاعتماد:** 11 أكتوبر 2026 | **المعيار:** OWASP API Security Top 10 + STRIDE

---

## 1. الأصول الحساسة وحدود الثقة (Trust Boundaries & Critical Assets)

```
[ متجر العميل / الجوال ]
       │  (HTTPS / TLS 1.3 / E.164 SMS OTP)
       ▼
┌────────────────────────────────────────────────────────┐
│               بوابة الأمان والرقابة (API Gate)           │
│  - JWT Verification (HS256 >= 32 chars non-default)    │
│  - BOLA / IDOR Authorization Guard (AT-19)             │
│  - Anti-Fraud Velocity & Rate Limiter                  │
│  - SIM Swap Cooling-off Engine (24h Window)            │
└────────────────────────────────────────────────────────┘
       │                              │
       ▼ (RBAC: CUSTOMER / STAFF)      ▼ (TOTP MFA / Four-Eyes)
┌───────────────────────────────┐ ┌───────────────────────────────┐
│     عمليات الشراء والطلبات    │ │   الإدارة المالية وسحب الأرباح  │
│  - Idempotency Engine         │ │   - Four-Eyes Separation     │
│  - Immutable Snapshot         │ │   - Frozen Wallet Check      │
│  - Wallet Balance Reservation │ │   - 3-Way Reconciliation     │
└───────────────────────────────┘ └───────────────────────────────┘
       │                              │
       ▼                              ▼
┌────────────────────────────────────────────────────────┐
│     دفتر الأستاذ العام المزدوج الصارم (Strict Double-Entry)│
│  - Debits == Credits (قيد متوازن لا يقبل التجزئة)      │
│  - عدم إمكانية الحذف أو التعديل (Ledger Immutability)   │
│  - عزل تام عن أي محركات ذكاء اصطناعي (Zero Impact)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. مصفوفة نموذج التهديدات (STRIDE Threat Matrix)

| فئة التهديد (STRIDE) | سيناريو الهجوم المحتمل | الإجراء الوقائي المطبق في النظام | نتيجة الاختبار والتحقق |
| :--- | :--- | :--- | :---: |
| **Spoofing (انتحال الهوية)** | انتحال إشعارات الدفع الواردة من البنوك (Forged Webhook) | فحص التوقيع الرقمي HMAC-SHA256، والتحقق من حساب المستفيد الرسمي | `PASS` — رفض أي إشعار بدون توقيع أو بحساب غير معتمد |
| **Tampering (التلاعب بالبيانات)** | التلاعب بالأسعار أو الهوامش في جسم الطلب من المتصفح | الأسعار وهيكل العملات تؤخذ حصراً من قاعدة البيانات وليس من العميل | `PASS` — حظر كامل للاعتماد على قيم الواجهة |
| **Repudiation (التنكر والإنكار)** | إنكار تنفيذ سحب مالي أو تحويل رصيد | سجل تدقيق غير قابل للتعديل `AuditLog` موثق بـ IP و Timestamp و UserID | `PASS` — توثيق إلزامي لكافة العمليات الحساسة |
| **Information Disclosure (تسريب البيانات)** | كشف ملاحظات التحقيق السرية لموظفي الدعم للعميل | حجب تلقائي لكافة الرسائل الموسومة `isInternalNote: true` عند تصفح العميل | `PASS` — تم اختباره برمجياً في `support-notifications.spec.ts` |
| **Denial of Service (حجب الخدمة والاحتيال)** | ضخ آلاف طلبات الشحن أو الـ OTP لاستنزاف الخوادم ومحفظة SMS | Rate Limiting (3 طلبات/15 دقيقة للرقم)، و10 طلبات/دقيقة للشراء | `PASS` — قفل فوري للحساب والـ IP عند التجاوز |
| **Elevation of Privilege (تصعيد الصلاحيات)** | موظف دعم يحاول اعتماد سحب أرباح أو فك تجميد محفظة | حماية الأدوار الصارمة `@Roles()` ومنع الوصول لغير المدراء الماليين | `PASS` — حظر تام مع إرجاع 403 Forbidden |

---

## 3. مراجعة OWASP API Top 10

### 1. API1:2023 - Broken Object Level Authorization (BOLA/IDOR - AT-19)
- **الخطر:** قيام مستخدم بتغيير معرف الطلب `orderId` أو المحفظة `walletId` في الرابط للوصول لبيانات عميل آخر.
- **الحماية:** يتم فحص ملكية الكائن `entity.userId === currentUser.id` في كل خدمة؛ عند عدم التطابق لغير الموظفين يتم رمي `ForbiddenException` وتسجيل حدث أمني فوري `BOLA_VIOLATION_ATTEMPT` في سجل الرقابة.

### 2. API2:2023 - Broken Authentication (MFA & Password Security)
- **الخطر:** تخمين كلمات المرور أو تجاوز الـ OTP.
- **الحماية:** تشفير كلمات المرور بـ `bcrypt` (Salt Rounds: 10)، إلزامية الـ TOTP MFA للعمليات الإدارية والمالية، وقفل تحدي الـ OTP بعد 3 محاولات فاشلة.

### 3. API3:2023 - Broken Object Property Level Authorization
- **الخطر:** تعديل حقول حساسة مثل `role`, `balance`, `isFrozen` عبر الـ Mass Assignment.
- **الحماية:** استخدام DTOs صارمة مفحوصة بـ `class-validator` مع تفعيل `whitelist: true` و `forbidNonWhitelisted: true`.

### 4. API4:2023 - Unrestricted Resource Consumption (Rate Limiting)
- **الخطر:** ضخ الرسائل القصيرة وطلبات السحب السريعة.
- **الحماية:** تحديد سقف 5 طلبات سحب يومياً، و10 طلبات شراء في الدقيقة، وحدود مبالغ قصوى للعملية الفردية.

### 5. API5:2023 - Broken Function Level Authorization
- **الخطر:** استدعاء مسارات سحب أرباح المالك من قبل موظفي الدعم أو العمليات.
- **الحماية:** حظر الحسابات غير المصرح لها برمجياً على مستوى وحدات التحكم ومستوى الخدمات (Defense-in-Depth).

---

## 4. سياسة عزل الذكاء الاصطناعي التام (AI Isolation & Zero Financial Impact - AT-09)
1. **مبدأ الصفر المالي:** محرك تقييم المخاطر الذكي (`AiRiskEvaluatorService`) هو محرك استشاري تحليلي باللغة العربية حصراً؛ لا يملك صلاحية الاتصال بـ `LedgerService` أو تعديل أي أرصدة في `Wallet`.
2. **التحصين ضد حقن الأوامر (Prompt Injection Defense):** يتم تطهير كافة المعرفات والنصوص عبر تعبيرات نمطية صارمة تحذف عبارات الالتفاف والأوامر الموجهة للنظام (`ignore previous instructions/rules`, `developer mode`, `bypass security`).
