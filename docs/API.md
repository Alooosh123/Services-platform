# دليل واجهات برمجة التطبيقات (API Reference)
## منصة الشحن والخدمات الرقمية — سوق اليمن (RESTful API Specification)
**الإصدار:** 1.0 | **الرابط المرجعي المباشر:** `http://localhost:4000/api` | **توثيق Swagger التفاعلي:** `http://localhost:4000/api/docs`

---

### 1. معايير الاتصال والاستجابة العامة

* **نقطة الدخول الأساسية:** `/api`
* **صيغة تبادل البيانات:** `application/json; charset=utf-8`
* **المصادقة:** ترويسة بروتوكول Bearer عبر رمز الـ JWT:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
* **بنية الاستجابة القياسية:**
  ```json
  {
    "success": true,
    "message": "Operation completed successfully",
    "data": { ... }
  }
  ```

---

### 2. واجهات المصادقة والحساب (`/api/auth`)

#### 1. تسجيل حساب عميل جديد
* **الرابط:** `POST /api/auth/register`
* **الوصول:** عام (Public)
* **جسم الطلب (Request Body):**
  ```json
  {
    "fullName": "محمد أحمد الراعي",
    "phone": "+967770123456",
    "email": "customer@example.com",
    "password": "Password@123456"
  }
  ```
* **الاستجابة:** يُنشئ العميل ومحافظه الثلاث (`YER`, `USD`, `SAR`) ويعيد رموز الـ JWT.

#### 2. تسجيل الدخول
* **الرابط:** `POST /api/auth/login`
* **جسم الطلب:**
  ```json
  {
    "identifier": "+967770123456",
    "password": "Password@123456"
  }
  ```

---

### 3. واجهات الكتالوج والخدمات الديناميكية (`/api/products`)

#### 1. جلب الكتالوج العام الكامل
* **الرابط:** `GET /api/products/catalog`
* **الوصول:** عام (Public)
* **الاستجابة:** قائمة التصنيفات والخدمات والمنتجات مع أسعارها المتعددة العملات وحقول الإدخال.

#### 2. جلب تفاصيل خدمة معينة
* **الرابط:** `GET /api/products/service/:slug` (أو `GET /api/products/game/:slug`)
* **أمثلة على الـ Slug:** `pubg-mobile`، `yoyo`، `toptop`.
* **الاستجابة النموذجية:**
  ```json
  {
    "id": "service-uuid",
    "slug": "pubg-mobile",
    "name": "PUBG Mobile",
    "nameAr": "ببجي موبايل",
    "fields": [
      {
        "fieldKey": "player_id",
        "labelAr": "معرف اللاعب (Player ID)",
        "type": "text",
        "required": true,
        "validationRegex": "^[0-9]{5,15}$"
      }
    ],
    "products": [
      {
        "id": "product-uuid",
        "nameAr": "60 شدة ببجي",
        "sku": "PUBG-60-UC",
        "prices": [
          { "currency": "YER", "retailPrice": 550.0, "costPrice": 495.0 },
          { "currency": "USD", "retailPrice": 1.05, "costPrice": 0.94 },
          { "currency": "SAR", "retailPrice": 4.0, "costPrice": 3.6 }
        ]
      }
    ]
  }
  ```

#### 3. تقديم طلب توفير خدمة أو لعبة جديدة (Customer Service Request)
* **الرابط:** `POST /api/products/service-requests`
* **الوصول:** متاح للعملاء (Public / Customer)
* **جسم الطلب:**
  ```json
  {
    "title": "شحن عملات تطبيق لايكي (Likee)",
    "categorySlug": "apps",
    "identifierLabelAr": "معرف الحساب (Likee ID)",
    "description": "يرجى توفير باقات تطبيق لايكي للبث المباشر",
    "contactPhone": "777000111"
  }
  ```

#### 4. إدارة طلبات الخدمات والنشر الآلي (Admin Zero-Code Dynamic Publishing)
* **الروابط:**
  * `GET /api/products/admin/service-requests` — جلب قائمة طلبات العملاء.
  * `PUT /api/products/admin/service-requests/:id/status` — مراجعة واعتماد أو نشر الخدمة مباشرة في الكتالوج (`PUBLISHED`).

#### 5. محرك التسعير والهوامش الهرمية والمعاينة الفورية (Pricing Engine & Live Preview)
* **الروابط:**
  * `POST /api/products/pricing/rules` — إصدار قاعدة تسعير وهوامش جديدة مرقمة (`PriceRuleVersion`) مع توثيق إلزامي لسبب التعديل (`changeReason`).
  * `GET /api/products/pricing/rules` — جلب قواعد التسعير النشطة.
  * `POST /api/products/pricing/preview` — محاكاة احتساب سعر البيع والربح مع تحويل العملات FX وفحص حظر البيع بخسارة:
  ```json
  {
    "costPrice": 4.5,
    "costCurrency": "USD",
    "targetCurrency": "USD",
    "scope": "PRODUCT",
    "targetId": "prod-pubg-325"
  }
  ```

#### 6. زر الإيقاف الطارئ للباقات (Product Emergency Kill Switch)
* **الرابط:** `POST /api/products/admin/product/:id/kill-switch`
* **المصادقة:** تتطلب صلاحيات الإدارة (`Admin`).
* **جسم الطلب:**
  ```json
  {
    "reason": "صيانة طارئة في خط إمداد المزود الخارجي لمنع الخسائر"
  }
  ```

---

### 3.1 واجهات قنوات الدفع والرقابة الثنائية وزر الطوارئ (`/api/deposits`)

#### 1. تعديل رقم الحساب المستلم للقناة (Four-Eyes Principle)
* **الرابط:** `PUT /api/deposits/admin/channels/:code/account`
* **الهدف:** يقترح رقم حساب جديد فتتحول القناة إلى `PENDING_REVIEW` وتتطلب موافقة الإدارة المالية.
* **جسم الطلب:**
  ```json
  {
    "accountNumber": "300998877",
    "feePercentage": 0
  }
  ```

#### 2. اعتماد أو رفض التعديل بواسطة الإدارة المالية (Finance Dual Approval)
* **الرابط:** `POST /api/deposits/admin/channels/:code/review`
* **جسم الطلب:**
  ```json
  {
    "approved": true,
    "financeNotes": "تم التحقق من الوثائق البنكية واعتماد الحساب رسمياً"
  }
  ```

#### 3. زر الإيقاف الطارئ لقنوات الدفع (Channel Emergency Kill Switch)
* **الرابط:** `POST /api/deposits/admin/channels/:code/kill-switch`
* **جسم الطلب:**
  ```json
  {
    "reason": "صيانة طارئة في محفظة ون كاش المصرفية"
  }
  ```

---

### 4. واجهات المحافظ والمدفوعات (`/api/wallet`)

#### 1. جلب أرصدة المحافظ متعددة العملات
* **الرابط:** `GET /api/wallet/balances`
* **المصادقة:** تتطلب تسجيل الدخول (`Bearer Token`).
* **الاستجابة:** مصفوفة تحتوي على أرصدة العميل بعملات `YER`، `USD`، و`SAR`.

#### 2. طلب شحن رصيد يدوي بحوالة أو إشعار
* **الرابط:** `POST /api/wallet/topup/request`
* **جسم الطلب:**
  ```json
  {
    "currency": "YER",
    "amount": 20000,
    "paymentMethodCode": "JAIB",
    "referenceNumber": "JAIB-TX-998877",
    "proofImage": "https://storage.digitaltopup.com/proofs/receipt-123.jpg"
  }
  ```

#### 3. اعتماد وتأكيد الشحن المالي (إداري)
* **الرابط:** `POST /api/wallet/admin/topup/:id/confirm`
* **المصادقة:** محصورة بالمدير المالي ومالك المنصة (`FINANCE_MANAGER`, `OWNER`).
* **النتيجة:** تسجيل قيد مزدوج في دفتر الأستاذ وإيداع المبلغ في محفظة العميل فورياً.

---

### 5. واجهات الطلبات والتنفيذ (`/api/orders`)

#### 1. إنشاء طلب شحن (Checkout)
* **الرابط:** `POST /api/orders/checkout`
* **الرؤوس المطلوبة:**
  * `Authorization: Bearer <access-token>`
  * `Idempotency-Key: <same value as body.idempotencyKey>`
  * `x-transaction-pin: <six-digit transaction PIN>`
* يجب أن تطابق قيمة `Idempotency-Key` قيمة `idempotencyKey` داخل جسم الطلب حرفياً.
* **جسم الطلب:**
  ```json
  {
    "productId": "product-uuid-here",
    "currency": "YER",
    "playerFields": {
      "player_id": "5123456789"
    },
    "paymentMethod": "WALLET",
    "idempotencyKey": "IDEMP-CLIENT-REQ-887722"
  }
  ```
* **آلية المعالجة:**
  * التحقق من سلامة وصلاحية حقول اللاعب (`player_id`) وفق النمط المحدد.
  * التحقق من كفاية رصيد المحفظة بالعملة المحددة (`YER`).
  * حجز رصيد المحفظة وإنشاء الطلب ذرياً ضمن معاملة قاعدة بيانات واحدة؛ ثم تُنفّذ التسوية المحاسبية المزدوجة في مسار تنفيذ الطلب.
  * حفظ اللقطة التاريخية للطلب (`OrderSnapshot`).
  * إرسال الطلب إلى مسار التنفيذ الآلي أو اليدوي، وتحديث حالته وفق نتيجة المزوّد أو تحويله إلى المراجعة اليدوية عند الحاجة.

#### 2. استعراض سجل طلبات العميل
* **الرابط:** `GET /api/orders/my-orders?page=1&limit=20`

---

### 6. واجهات العملات وأسعار الصرف (`/api/currencies`)

* **`GET /api/currencies`**: قائمة العملات النشطة مع بياناتها وأسمائها باللغة العربية.
* **`GET /api/currencies/rates`**: قائمة أسعار الصرف الحالية ومطابقة هوامش التحويل.
* **`POST /api/currencies/exchange`**: إجراء عملية تحويل عملة موثقة في دفتر الأستاذ بين محفظتي العميل.

---

### 7. واجهات أتمتة المدفوعات والتسوية والمطابقة الثلاثية (Phase P05)

#### 1. استلام وتأكيد إشعارات الدفع الواردة (Inbound Payment Webhook)
* **الرابط:** `POST /api/deposits/webhook/:channel` (حيث `:channel` = `JAIB`, `JAWALI`, `ONE_CASH`, `EASY`, `CASH`, `WALLET`)
* **الترويسات:** `x-webhook-signature` (للتحقق من التوقيع الرقمي للمزود)
* **جسم الطلب:**
  ```json
  {
    "channelCode": "JAIB",
    "transactionReference": "REF-JAIB-112233",
    "amount": 50000,
    "currency": "YER",
    "beneficiaryAccount": "770123456",
    "senderPhone": "+967770000003",
    "senderName": "أحمد محمد"
  }
  ```
* **الضوابط الصارمة:**
  * منع إضافة الرصيد مرتين عند تكرار الإشعار (Idempotency Handled -> `DUPLICATE`).
  * رفض الاعتماد التلقائي فوراً في حال عدم تطابق المبلغ أو العملة وتحويل المعاملة إلى `MANUAL_REVIEW`.
  * حظر الإشعار فوراً في حال عدم تطابق رقم حساب المستفيد مع الحساب الرسمي المعتمد للمنصة.

#### 2. إدارة قنوات الدفع ومحددات القدرات (Capability Flags & Safe Mode)
* **`GET /api/deposits/admin/channels`**: استعراض كافة القنوات ومحددات القدرات (`depositConfirm`, `txLookup`, `payout`, `balance`, `reconcile`) والأوضاع التشغيلية (`API`, `MANUAL`, `BLOCKED_EXTERNAL`, `DISABLED`).
* **`POST /api/deposits/admin/channels/:channel/mode`**: تبديل وضع القناة بأمان.
* **`POST /api/deposits/admin/channels/:channel/failover`**: التحويل الفوري لوضع الطوارئ اليدوي `MANUAL` عند رصد أي اختلال شبكي.
* **`GET /api/deposits/admin/verify-legal-accounts`**: التحقق القانوني من ملكية حسابات الاستقبال وخلو الإنتاج من أي أرقام اختبارية (BR-06).

#### 3. طلبات السحب والتحويل الخارجي (Outbound Payouts)
* **`POST /api/payouts`**: إنشاء طلب سحب خارجي جديد (مع حجز رصيد المحفظة فورياً ومفتاح تكرار فريد).
* **`GET /api/payouts`**: استعراض طلبات السحب الخاصة بالمستخدم الحالي.
* **`GET /api/payouts/admin/all`**: استعراض كافة طلبات السحب للرقابة المالية.
* **`POST /api/payouts/admin/:id/approve`**: اعتماد الطلب وتحويله لحالة التنفيذ.
* **`POST /api/payouts/admin/:id/confirm`**: تأكيد إتمام التحويل البنكي وإبراء الذمة في دفتر الأستاذ العام.
* **`POST /api/payouts/admin/:id/fail`**: إلغاء/فشل التحويل وإلغاء حجز الرصيد فوراً وإعادته لمحفظة المستخدم (حماية AT-18).

#### 4. نظام التسوية والمطابقة الثلاثية (3-Way Reconciliation Engine)
* **`POST /api/reconciliation/batches/run`**: تشغيل دفعة مطابقة ثلاثية يومية (كشف البنك ↔ الإيداعات/السحوبات ↔ فواتير المزودين ↔ دفتر الأستاذ العام).
* **`GET /api/reconciliation/batches`**: استعراض دفعات المطابقة وحالاتها (`BALANCED`, `DISCREPANCY_FOUND`, `RECONCILED_WITH_ADJUSTMENTS`).
* **`GET /api/reconciliation/discrepancies`**: استعراض الفروقات والاستثناءات المعلقة (`AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `MISSING_IN_INTERNAL`, `MISSING_IN_BANK`).
* **`POST /api/reconciliation/discrepancies/:id/resolve`**: تسوية الاستثناء محاسبياً (`ADJUST_LEDGER`, `FORCE_MATCH`, `REJECT_EXTERNAL`, `DISPUTE_RAISED`).

#### 5. إدارة الأرصدة التجارية لمزودي الشحن وبوابة التنفيذ (Supplier Balances & Gating)
* **`GET /api/providers/admin/supplier-accounts`**: مراقبة الأرصدة التجارية المسبقة والحدود الائتمانية لدى مزودي الشحن (SMILE_ONE, MOOGOLD, UNIPIN).
* **`POST /api/providers/admin/fund-supplier`**: تسجيل تغذية الرصيد التجاري للمزود وإثبات حركة الأموال بين الأصول في دفتر الأستاذ العام (Cash Movement: Asset ↔ Asset).
* **`GET /api/providers/admin/supplier-transactions`**: سجل الحركات التجارية واستنزاف الأرصدة المرتبط بأوامر الشحن.

---

### 9. واجهات تقارير نهاية اليوم وسحب أرباح المالك — المرحلة السابعة (`/api/reports`)

#### 1. إغلاق اليوم المالي ولقطات التدقيق غير القابلة للتعديل (Daily Close & Immutable Snapshots - AT-13, AT-23)
* **`POST /api/reports/daily-close`**: إغلاق اليوم المالي واحتساب مؤشرات المبيعات، تكلفة المزودين، والربح المحقق والسيولة الحرة لكل عملة وحفظ لقطة ثابتة (مع منع التكرار وإعادة الكتابة AT-23).
* **`GET /api/reports/daily-close`**: استعراض كافة لقطات الإغلاق اليومي التاريخية.
* **`GET /api/reports/daily-close/:date`**: استرجاع لقطة يوم محدد (صيغة `YYYY-MM-DD`).
* **`POST /api/reports/daily-close/:date/adjustment`**: إلحاق تسوية محاسبية جديدة بتقرير الإغلاق دون المساس باللقطة الأصلية (`DailyCloseAdjustment`).
* **`GET /api/reports/daily-close/:date/export`**: تصدير تقرير الإغلاق المالي بصيغة `CSV`.

#### 2. محفظة أرباح المالك وسحب السيولة المتاحة (Owner Earnings & MFA Payout - AT-14, AT-17, AT-18)
* **`GET /api/reports/owner-earnings/statement?currency=YER`**: كشف مستحقات المالك، الأرباح المحققة التراكمية، والمبالغ المحجوزة والمسحوبة، ومطابقة معادلة السيولة الحرة بعد استبعاد التزامات العملاء.
* **`GET /api/reports/owner-earnings/beneficiaries`**: استعراض حسابات المستفيدين المعتمدة للمالك.
* **`POST /api/reports/owner-earnings/beneficiaries`**: تسجيل حساب مستفيد جديد مع التحقق.
* **`POST /api/reports/owner-earnings/payouts/request`**: تقديم طلب سحب أرباح محمي برمز التحقق الثنائي `TOTP MFA` ومفتاح عدم التكرار وحجز فوري للمبلغ (AT-17, AT-18).
* **`GET /api/reports/owner-earnings/payouts`**: استعراض قائمة طلبات السحب وحالاتها ومسار الموافقات.
* **`POST /api/reports/owner-earnings/payouts/:id/approve`**: اعتماد الطلب من قبل ضابط الإدارة المالية (Four-Eyes Principle).
* **`POST /api/reports/owner-earnings/payouts/:id/confirm`**: تأكيد صرف الحوالة البنكية وإرفاق رقم الإشعار المصرفي وترحيل القيد المتوازن في دفتر الأستاذ العام.

---

### 10. واجهات مركز الإشعارات وتذاكر الدعم والنزاعات — المرحلة الثامنة (`/api/notifications` & `/api/support`)

#### 1. مركز الإشعارات المعتمدة للعميل (`/api/notifications`)
* **`GET /api/notifications`**: استعراض إشعارات المستخدم الحالية مع إحصائية العداد غير المقروء `unreadCount`، ودعم التصفية حسب النوع (`ORDER_UPDATE`, `DEPOSIT_CONFIRMED`, `DISPUTE_REFUNDED`, `SECURITY_ALERT`, إلخ). (حماية BOLA كاملة).
* **`PATCH /api/notifications/:id/read`**: تعليم إشعار محدد كمقروء للمستخدم الحالي.
* **`POST /api/notifications/read-all`**: تعليم كافة الإشعارات كمقروءة دفعة واحدة بنقرة واحدة.

#### 2. نظام تذاكر الدعم والنزاعات والتشخيص (`/api/support`)
* **`POST /api/support/tickets`**: إنشاء تذكرة دعم جديدة للعميل مع ربط اختياري برقم الطلب `orderId` أو رقم الإيداع `depositId` مع تحديد التصنيف والأولوية.
* **`GET /api/support/tickets`**: استعراض تذاكر الدعم (تقتصر على تذاكر العميل نفسه، بينما يُتاح لموظف الدعم `SUPPORT` والإدارة `ADMIN` استعراض كافة التذاكر مع فلاتر الحالة والتصنيف).
* **`GET /api/support/tickets/:id`**: استرجاع تفاصيل التذكرة وسجل الرسائل (مع **حجب صارم** لأي ملاحظات داخلية `isInternalNote: true` عن العميل).
* **`POST /api/support/tickets/:id/messages`**: إضافة رسالة جديدة للمحادثة (مع إمكانية تفعيل خيار `isInternalNote: true` لموظفي الدعم حصراً لتدوين الملاحظات الفنية السرية).
* **`PATCH /api/support/tickets/:id/status`**: تحديث حالة التذكرة (`OPEN`, `WAITING_USER`, `RESOLVED`, `CLOSED`) أو تعديل الأولوية أو الإسناد لموظف.
* **`POST /api/support/tickets/:id/resolve-dispute-refund`**: حل نزاع الطلب واسترداد القيمة فورياً إلى محفظة العميل (`DISPUTED_REFUND`) وتوثيق القيد العكسي المتوازن في دفتر الأستاذ العام.
* **`GET /api/support/diagnostics/orders/:orderId`**: أداة تشخيص الطلبات لموظفي الدعم والتحقيق الفني في الطلبات العالقة لدى المزودين وسجلات الأخطاء وحالات الرصيد التجاري للمزود (AR-15).

---

### 11. واجهات الخصوصية والامتثال وحفظ البيانات — المرحلة التاسعة (`/api/privacy`)

#### 1. تصدير البيانات الشخصية (Data Portability - AR-08)
* **`POST /api/privacy/export-data`**: تنزيل وتصدير نسخة أرشيفية كاملة وموثقة لبيانات العميل بصيغة JSON (الملف الشخصي، كافة المحافظ، سجل الطلبات، الإيداعات، السحوبات، التذاكر، والموافقات).

#### 2. حق النسيان ومسح الحساب (Right to Erasure / Anonymization - AR-08)
* **`POST /api/privacy/request-deletion`**: طلب مسح وتعليم الهوية الشخصية بشكل دائم:
  * **شروط القبول:** يشترط خلو المحفظة من أي رصيد متبقي (`balance == 0`) وخلو الحساب من أي طلبات شحن جارية أو معلقة.
  * **الضمانات المحاسبية:** تعمية البيانات الشخصية PII (الاسم، الهاتف، البريد) مع الإبقاء الإلزامي على القيود المحاسبية وتاريخ الطلبات في دفتر الأستاذ العام وفق القوانين المالية.
  * **عبارة التأكيد:** تتطلب إرسال `"confirmPhrase": "CONFIRM_DELETE"`.

#### 3. صيانة البيانات وحفظ السجلات (Data Retention)
* **`POST /api/privacy/admin/purge-expired-tokens`**: تنظيف وحذف الجلسات المنتهية ورموز التحقق المؤقتة منتهية الصلاحية من قاعدة البيانات بصورة فورية وموثقة في سجل الرقابة.

