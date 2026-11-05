# توثيق قاعدة البيانات (Database Schema Documentation)
## منصة الشحن والخدمات الرقمية — سوق اليمن (PostgreSQL & Prisma ORM)
**الإصدار:** 1.0 | **المحرك:** PostgreSQL 15+ | **المخطط الأساسي:** `packages/database/prisma/schema.prisma`

---

### 1. ملخص الكيانات والعلاقات الرئيسية (ER Overview)

تتألف قاعدة البيانات من 17 نموذجًا مترابطًا مقسمًا عبر 6 نطاقات رئيسية:

```
+-------------------+       1:N       +-------------------+
|      User         | --------------> |      Wallet       | (Unique by [userId, currency])
+-------------------+                 +-------------------+
          |                                     | 1:N
          | 1:N                                 v
          v                           +-------------------+
+-------------------+                 |    LedgerEntry    |
|       Order       |                 +-------------------+
+-------------------+                           ^
          |                                     | N:1
          |                           +-------------------+
          |                           | LedgerTransaction |
          |                           +-------------------+
          |                                     | N:1
          |                                     v
          |                           +-------------------+
          |                           |   LedgerAccount   |
          v                           +-------------------+
+-------------------+
|   ProductPrice    |
+-------------------+
          ^
          | N:1
+-------------------+       N:1       +-------------------+       N:1       +-------------------+
|      Product      | --------------> |      Service      | --------------> |  ServiceCategory  |
+-------------------+                 +-------------------+                 +-------------------+
                                                | 1:N
                                                v
                                      +-------------------+
                                      |   ServiceField    |
                                      +-------------------+
```

---

### 2. تفصيل الجداول والنماذج (Entity Reference)

#### 2.1 المستخدمون والجلسات (`users`, `sessions`)
* **`users`**:
  * `id`: معرف UUID فريد.
  * `email` (اختياري، فريد) | `phone` (اختياري، فريد): يدعم التسجيل برقم الهاتف اليمني أو البريد.
  * `fullName` و `fullNameAr`: اسم المستخدم باللغتين.
  * `passwordHash`: تجزئة كلمة المرور باستخدام bcrypt.
  * `role`: التعداد `UserRole` (`OWNER`, `GENERAL_MANAGER`, `FINANCE_MANAGER`, `SUPPORT`, `FULFILLMENT_OPERATOR`, `AUDITOR`, `CUSTOMER`).
  * `isActive`, `isVerified`: حالة الحساب.
* **`sessions`**:
  * إدارة رموز الجلسات وتجديد الدخول (`refreshToken`, `expiresAt`, `ipAddress`, `userAgent`).

#### 2.2 المحافظ ودفتر الأستاذ المالي المزدوج (`wallets`, `ledger_accounts`, `ledger_transactions`, `ledger_entries`)
* **`wallets`**:
  * `userId`: معرف العميل.
  * `currency`: عملة المحفظة (`YER`, `USD`, `SAR`).
  * `balance`: الرصيد المتاح بدقة `Decimal(16, 4)`.
  * `lockedBalance`: الرصيد المحجوز لمعاملات قيد المعالجة.
  * **الفهرس الفريد:** `@@unique([userId, currency])` يضمن وجود محفظة واحدة فقط لكل عملة لكل عميل.
* **`ledger_accounts`**:
  * `code`: رمز الحساب الفريد (مثل: `1001-CASH-JAIB`, `2001-CUSTOMER-WALLETS-YER`).
  * `type`: نوع الحساب المحاسبي (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`).
  * `currency`: عملة الحساب.
* **`ledger_transactions`**:
  * `txNumber`: رقم المعاملة المحاسبية الفريد (مثل: `LTX-20261009-001`).
  * `type`: نوع المعاملة (`TOPUP`, `PURCHASE`, `REFUND`, `EXCHANGE`, `ADJUSTMENT`).
  * `status`: حالة القيد (`POSTED`, `REVERSED`).
  * `isReversal`: علامة منطقية تشير لما إذا كانت المعاملة قيد تراجع.
  * `reversalOfId`: رابط للمعاملة الأصلية المعكوسة.
* **`ledger_entries`**:
  * `transactionId`: رابط المعاملة.
  * `accountId`: رابط الحساب المحاسبي.
  * `walletId`: رابط المحفظة المتأثرة (إن وجدت).
  * `debitAmount`: مبلغ المدين `Decimal(16, 4)`.
  * `creditAmount`: مبلغ الدائن `Decimal(16, 4)`.
  * `currency`: عملة القيد.

#### 2.3 الكتالوج الديناميكي والخدمات (`service_categories`, `services`, `service_fields`, `products`, `product_prices`)
* **`service_categories`**: تصنيفات العرض (مثل: `games`, `apps`, `cards`).
* **`services`**: بيانات الخدمة أو اللعبة (`slug`, `name`, `nameAr`, `iconUrl`).
* **`service_fields`**:
  * الحقول الديناميكية المدخلة من اللاعب.
  * `fieldKey`: مفتاح الحقل (مثل: `player_id`).
  * `validationRegex`: التعبير النمطي للتحقق من الصحة (مثل: `^[0-9]{5,15}$`).
* **`products`**: الباقة أو حزمة الشحن (`sku`, `name`, `nameAr`).
* **`product_prices`**:
  * `productId`: رابط الباقة.
  * `currency`: عملة التسعير (`YER`, `USD`, `SAR`).
  * `retailPrice`: سعر البيع للمستهلك.
  * `costPrice`: تكلفة التوريد من المزود.
  * **الفهرس الفريد:** `@@unique([productId, currency])`.

#### 2.4 الطلبات والمدفوعات (`orders`, `order_status_history`, `payments`, `wallet_topups`)
* **`orders`**:
  * يحتوي على لقطات الشراء التاريخية (`snapshotRetailPrice`, `snapshotCostPrice`, `snapshotProfit`, `snapshotCurrency`, `snapshotBeneficiaryFields`, إلخ).
  * `status`: حالة الطلب (`OrderStatus`).
* **`payments`**:
  * سجل محاولات الدفع المالي المنفصل عن حالة الطلب.
  * `status`: حالة الدفع (`PaymentStatus`).
  * `proofImage`: صورة سند التحويل أو إشعار المحفظة.

#### 2.5 أتمتة المدفوعات والتسوية وحسابات المزودين — المرحلة P05
* **`payout_requests`**:
  * إدارة دورة حياة طلبات السحب الخارجي للمستخدمين والوكلاء.
  * `payoutNumber`: معرّف مرجعي فريد.
  * `status`: حالة السحب (`PayoutStatus`: `REQUESTED`, `APPROVED`, `PROCESSING`, `CONFIRMED`, `FAILED`, `UNKNOWN`).
  * `walletId` & `amount` & `currency`: حجز الرصيد فور تقديم الطلب وإفراجه فور الفشل (حماية AT-18).
  * `beneficiaryAccount`, `beneficiaryName`, `idempotencyKey`: منع تكرار أوامر التحويل.
  * `channelMode`: وسوم وضع القناة (`API` أو `MANUAL` مع إبقاء القنوات المصرفية اليمنية `BLOCKED_EXTERNAL` حتى اكتمال التوثيق).
* **`reconciliation_batches`**:
  * سجل دفعات المطابقة والتسوية الثلاثية اليومية.
  * `batchNumber`: رقم الدفعة الفريد (`REC-YYYYMMDD-XXX`).
  * `channelCode`, `periodStart`, `periodEnd`.
  * `totalItems`, `matchedItems`, `discrepanciesCount`, `totalBankAmount`, `totalInternalAmount`, `netDifference`.
  * `status`: (`BALANCED`, `DISCREPANCY_FOUND`, `RECONCILED_WITH_ADJUSTMENTS`).
* **`reconciliation_items`**:
  * بنود وفروقات التسوية المفردة.
  * `discrepancyType`: (`AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `MISSING_IN_INTERNAL`, `MISSING_IN_BANK`).
  * `status`: (`OPEN`, `INVESTIGATING`, `RESOLVED`, `DISPUTED`).
  * `resolutionType`: (`ADJUST_LEDGER`, `FORCE_MATCH`, `REJECT_EXTERNAL`, `DISPUTE_RAISED`).
* **`supplier_accounts`**:
  * الحسابات التجارية ومحافظ الشحن المسبقة لدى مزودي الخدمات (`Provider`).
  * `accountType`: (`PREPAID` مقابل `PAY_PER_ORDER`).
  * `balance`, `creditLimit`, `lowBalanceThreshold`.
  * `status`: (`ACTIVE`, `LOW_BALANCE`, `SUSPENDED`).
  * ربط مباشر ببوابة الشحن في `FulfillmentService` لحظر الأوامر عند نقص الرصيد (حماية AT-16).
* **`supplier_transactions`**:
  * سجل حركات التغذية والاستهلاك للأرصدة التجارية.
  * `type`: (`FUNDING`, `DEDUCTION_FULFILLMENT`, `REFUND_ORDER`, `ADJUSTMENT`).
  * `cashMovementType`: التفريق المحاسبي الصارم بين حركة الأموال (Asset ↔ Asset) وتكلفة الشحن (Asset ↔ Expense).

---

### 3. الفهارس وقواعد الأداء (Indexes & Performance Constraints)

1. **فهارس الأداء السريع:**
   * `orders(userId, status)`: تسريع استعلامات طلبات العميل حسب الحالة.
   * `orders(orderNumber)`: البحث الفوري عن الطلبات بالرقم المرجعي.
   * `ledger_entries(transactionId)` و `ledger_entries(accountId)`: تسريع إصدار كشوفات الحسابات والقوائم المالية.
   * `payout_requests(userId, status)` و `payout_requests(idempotencyKey)`: تسريع استعلامات السحب وضمان منع التكرار.
   * `reconciliation_batches(batchNumber)` و `reconciliation_items(batchId, status)`: تسريع فلترة استثناءات التسوية.
   * `supplier_accounts(providerId)`: الوصول اللحظي لرصيد المزود قبل تفويض أمر الشحن.
2. **قيود السلامة المنطقية:**
   * `wallets`: `@@unique([userId, currency])` يمنع إنشاء محافظ مكررة.
   * `product_prices`: `@@unique([productId, currency])` يمنع تضارب أسعار المنتج لنفس العملة.
   * `ledger_transactions`: `idempotencyKey` فريد لمنع تكرار أي قيد مالي تحت ظروف إعادة الإرسال.
   * `payout_requests`: `idempotencyKey` فريد لمنع تكرار أوامر التحويل الصادر.
   * `supplier_accounts`: `@@unique([providerId, currency])` يمنع تكرار حسابات العملة للمزود الواحد.
