# FINANCIAL & INTEGRATION ARCHITECTURE — بنية النظام وحركة الأموال
> تصميم مرجعي يخضع لمواءمته مع نماذج Prisma الحالية. لا تُفترض أسماء جداول موجودة دون فحص الكود.

## 1. المكونات
```text
Customer Web/PWA ──┐
                   ├── NestJS API ─┬─ Auth & RBAC / Consent & Phone Verification
Admin Web ─────────┘               ├─ Dynamic Catalog / Pricing / Checkout
                                   ├─ Wallet + Strict Double-Entry Ledger
                                   ├─ Order State Machine / Outbox
                                   ├─ Fulfillment Worker / Provider Adapters
                                   ├─ Payment Channel Adapters / Webhooks
                                   ├─ AI Decision Assistant / Human Review
                                   ├─ Reconciliation / Earnings / Payouts
                                   └─ Daily Reporting / Audit / Notifications
                          PostgreSQL + Durable Queue + Encrypted Object Storage
```

## 2. السيناريو المالي — مثال توضيحي فقط
افترض أن سعر البيع 1,200 YER، وتكلفة المزود 1,000 YER، ورسوم القناة/المعالجة 40 YER. الهامش الإجمالي قبل الرسوم = 200، وبعد الرسوم = 160 YER **قبل مصاريف الشركة/الضرائب/التسويات**. هذه أرقام تعليمية وليست أسعارًا فعلية.

1. يدفع العميل من التزام محفظته؛ يُحجز مبلغ 1,200 YER دون دفع نهائي للمزود بعد.
2. عند تأكيد التنفيذ: يحرر الحجز على نحو متسق، وينخفض التزام محفظة العميل بمقدار الشراء وتسجل الإيرادات والتكاليف/المستحقات وفق السياسة المحاسبية المعتمدة.
3. للمزود التزام مستحق قدره 1,000 YER أو حساب دفع مسبق ينخفض، اعتمادًا على عقده الفعلي؛ لا يلزم أن تتحول النقود في لحظة تنفيذ الشحن إذا كان لديه رصيد مسبق أو تسوية مؤجلة.
4. تسجل الرسوم الفعلية (40 YER إن ثبتت)؛ ويُحسب الربح المحقق بصورة منفصلة عن النقد المتاح.
5. **Withdrawable Owner Earnings** لا تساوي آليًا مجموع الهوامش؛ يخصم الاحتياطي والضرائب/المصاريف المستحقة حسب السياسة، وتتحقق التسوية والسيولة.
6. عند سحب الأرباح: ينشأ PayoutRequest، تفحص الحدود والموافقات، يحجز المبلغ، ويرسل إلى قناة صرف رسمية أو يعالج يدويًا. يثبت الخروج المالي عند تأكيد جهة الدفع، ويعالج الرفض/المجهول دون صرف مضاعف.

## 3. حالات الدفعات والطلبات
- **Wallet top-up:** PENDING → UNDER_REVIEW/VERIFIED → CREDITED؛ لا زيادة قبل تحقق الاستلام.
- **Checkout:** CREATED → FUNDS_RESERVED → FULFILLING → SUCCESS / CONFIRMED_FAILURE / UNKNOWN / MANUAL_REVIEW.
- **Payout:** REQUESTED → APPROVED → SENT → CONFIRMED / FAILED / UNKNOWN؛ UNKNOWN ليست FAILED.
- **Provider job:** QUEUED → SENT → ACKNOWLEDGED → FINAL_STATUS؛ مُعرّف idempotency ثابت لكل عملية.

## 4. سجلات بيانات مقترحة بعد تدقيق Prisma
`CustomerServiceAccount`, `PhoneVerificationChallenge`, `ConsentGrant`, `ServiceRequest`, `Provider`, `ProviderCredentialRef`, `ProviderProductMapping`, `ProviderExecution`, `OrderEvent`, `OutboxEvent`, `PriceRuleVersion`, `PayoutRequest`, `BeneficiaryPayoutAccount`, `ReconciliationBatch`, `EarningsStatement`, `DailyClose`, `AiDecisionLog`.

## 5. الثبات أثناء التزامن
- استعمل `transaction` مع row locks/optimistic concurrency لخصم/حجز الأموال.
- ledger journal **append-only**، وقيد reversal في التصحيحات، ولا حذف مباشر.
- outbox حدثه وسجل الطلب يوضعان في transaction واحدة؛ dispatch خارجها.
- webhook incoming يتحقق من التوقيع والمرجع والتوقيت وتكرار الرسالة قبل معالجته.
- تجمد الطلبات مجهولة النتيجة حتى تسوية المزود؛ لا استرداد تلقائي بسبب network timeout.
- reconciliation ثلاثي: ledger الداخلي ↔ سجل مزود الخدمة ↔ كشف الحساب المالي.

## 6. فصل العملات والربحية
- لكل مبلغ `amount` و`currency` وقاعدة precision، مع الحفاظ على FX booking عند الحاجة.
- تقرير متعدد العملات يظهر **تقارير مفصولة** أو يعرض إجماليًا موحدًا فقط مع طريقة FX معلنة ومصدر سعر الصرف وتوقيته.
- الأرباح لا تخلط بين TopUp customer wallet وPurchase fulfillment وOwner payout.
- توزيع الربح على محفظة مدير تابعة للشركة هو قيد استحقاق/توزيع يخضع للمحاسبة والملكية، وليس إنشاء أموال جديدة.

## 7. الحدود الأخلاقية والتنظيمية للوكلاء
- LLM لا يملك مفاتيح Ledger ولا `executePayout` مباشرة.
- يعمل بنظام Rules Engine + Tool Allowlist + Decision Log؛ يمارس Auto-Approve فقط على حالات تُعرّفها سياسة معتمدة وقابلة للتراجع.
- أي قرار له أثر مالي كبير يحتاج صلاحية بشرية ومراجعة مستقلة.
- phone OTP يثبت التحكم بالقناة عند اللحظة الحالية، وليس صلة الرقم بالهوية الحقيقية دون أدلة أخرى.
