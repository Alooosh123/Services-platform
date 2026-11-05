# سجل القرارات الهندسية (Engineering Decisions Log)
## منصة الشحن والخدمات الرقمية — اليمن (Yemen Market)

توثق هذه الوثيقة القرارات المعمارية والتقنية المعتمدة للمنصة لضمان عدم إعادة فتح النقاشات المحسومة، وفقاً للـ MASTER BUILD PLAN (الإصدار 1.0).

---

## 1. القرارات المعمارية المعتمدة (Architectural Decisions)

| الرمز | القرار | التفاصيل والسبب | الحالة |
| :--- | :--- | :--- | :--- |
| **DEC-001** | **Modular Monolith Backend** | اعتماد NestJS مع TypeScript كـ Modular Monolith لتجنب تعقيد الـ Microservices في المرحلة الحالية، مع عزل النطاقات (Bounded Contexts) لتسهيل الفصل لاحقاً. | **معتمد** |
| **DEC-002** | **Multi-Currency (YER / USD / SAR)** | الفصل الصريح بين العملات: كل رصيد ومبلغ مرتبط بعملة صريحة. لكل مستخدم محافظ مستقلة (`Wallet YER`, `Wallet USD`, `Wallet SAR`). ممنوع التحويل التلقائي للأموال دون عملية صرف مسجلة صراحة. | **معتمد** |
| **DEC-003** | **Strict Double-Entry Ledger** | تطبيق القيد المحاسبي المزدوج الصارم (`ledger_accounts`, `ledger_transactions`, `ledger_entries`) حيث يكون إجمالي المدين = إجمالي الدائن (`Total Debit == Total Credit`). العمليات المنشورة غير قابلة للتعديل وتُصحح فقط عبر قيود العكس (Reversal Entries). | **معتمد** |
| **DEC-004** | **Yemeni Payment Channels** | دعم قنوات الدفع اليمنية الأساسية (جيب Jaib، جوالي Jawali، كاش Cash، ون كاش One Cash، محفظة إيزي Easy، والمحفظة الداخلية Wallet). عند غياب API رسمي موثق يتم اعتماد التحقق اليدوي (Manual Verification) أو محاكي الدفع (Mock Provider). | **معتمد** |
| **DEC-005** | **Separation of Payment & Fulfillment States** | فصل كامل ومطلق بين حالة الدفع (`PaymentStatus`: Created, Pending, AwaitingVerification, Confirmed, Failed, Expired, Reversed, Refunded, NeedsReconciliation) وحالة تنفيذ الطلب (`OrderStatus`: AwaitingPayment, PaymentReview, Paid, Queued, Processing, ManualReview, Completed, Failed, Cancelled, RefundPending, Refunded, ReconciliationRequired). | **معتمد** |
| **DEC-006** | **Dynamic Catalog Architecture** | ممنوع كتابة شروط كود خاصة بألعاب محددة مثل `if PUBG / if YoYo / if TopTop`. الكتالوج مبني بالكامل في قاعدة البيانات عبر الخدمات (Services) والمنتجات (Products) وحقول إدخال اللاعب (Service Fields) والأسعار متعددة العملات (Product Prices). | **معتمد** |
| **DEC-007** | **No-Blind-Retry on Provider Timeout** | عند انقطاع الاتصال أو عدم وضوح نتيجة المزود الخارجي، يحظر إعادة الإرسال التلقائي الأعمى، ويُحوّل الطلب إلى `ReconciliationRequired` أو `ManualReview` للتحقق اليدوي والمطابقة قبل اتخاذ أي إجراء مالي أو تنفيذي. | **معتمد** |
| **DEC-008** | **High Precision Money Types** | تخزين كافة المبالغ المالية كـ `Decimal(14, 4)` في PostgreSQL، وحظر استخدام أنواع الفاصلة العائمة (Float/Double) منعاً لأي خطأ في الحسابات المالية الدقيقة. | **معتمد** |
| **DEC-009** | **Order Snapshots** | كل طلب يحفظ لقطة ثابتة (Snapshot) لسعر المنتج وعملته وتكلفته وهوامشه والبيانات المدخلة للمستفيد، لضمان عدم تأثر الطلبات التاريخية بأي تعديل مستقبلي في الأسعار. | **معتمد** |
| **DEC-010** | **RBAC Backend Enforcement** | تطبيق صلاحيات الأدوار الإدارية (Owner, General Manager, Finance Manager, Support, Fulfillment Operator, Auditor) في الـ Backend Guards، وليس مجرد إخفاء الأزرار في واجهة الإدارة. | **معتمد** |
