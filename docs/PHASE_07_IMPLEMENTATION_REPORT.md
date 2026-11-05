# تقرير إنجاز المرحلة السابعة (P07) — تقارير نهاية اليوم وربح الشركة ومحفظة المالك والسحب

**تاريخ الإنجاز:** 11 أكتوبر 2026  
**الإصدار:** v1.0  
**الحالة:** مكتمل ومُختبر 100% (15/15 حزم اختبار، 104/104 اختبارات ناجحة)  
**المرجع:** `P07_OWNER_EARNINGS_PAYOUT_DAILY_REPORTS.md` و`10_AGENT_EXECUTION_PROTOCOL.md`  

---

## 1. أهداف المرحلة والمخرجات المحققة

| المعيار / المتطلب | الحالة | التفاصيل والتوثيق |
|---|---|---|
| **AT-13: مطابقة تقرير نهاية اليوم مع القيد المحاسبي** | **ناجح** | احتساب مؤشرات المبيعات، تكلفة المزودين، عمولات القنوات، والأرباح المحققة بشكل منفصل لكل عملة (`YER`، `USD`، `SAR`). |
| **AT-14: عزل الطلبات غير المكتملة عن الربح والسيولة** | **ناجح** | احتساب الطلبات المعلقة (`Processing` / `Queued`) ضمن الأرباح المقدرة فقط (`Estimated Profit`)، ومنع إدراجها في الربح المحقق (`Realized Profit`) أو السيولة القابلة للسحب (`Withdrawable Liquidity`). |
| **AT-23: ثبات لقطات الإغلاق اليومي ومنع التكرار** | **ناجح** | لقطات الإغلاق اليومي غير قابلة للتعديل (`Immutable Snapshot`). إعادة طلب الإغلاق لنفس التاريخ لا يكرر القيود ولا يمسح السجل الأساسي، مع دعم إلحاق تسويات محاسبية لاحقة (`DailyCloseAdjustment`) مع سجل تدقيق تفصيلي. |
| **AT-17: التحقق الثنائي MFA ومطابقة السيولة الحرة** | **ناجح** | تطبيق التحقق الثنائي عبر رموز TOTP (RFC 6238) لطلبات سحب أرباح المالك، والتحقق الصارم من معادلة السيولة الحرة: `السيولة = النقد الفعلي − التزامات العملاء − ديون المزودين − احتياطي التشغيل`. |
| **AT-18: عدم تكرار طلبات السحب وحل الحجز التلقائي** | **ناجح** | إلزامية مفتاح عدم التكرار (`idempotencyKey`). حجز المبلغ في `lockedEarnings` بصورة ذرية، وفي حال فشل الحوالة أو رفضها يتم فك الحجز وإعادة المبلغ فوراً إلى الرصيد المتاح. |
| **الرقابة الثنائية (Four-Eyes Principle)** | **ناجح** | تدفق معتمد: طلب المالك (MFA) ➔ اعتماد مسؤول المالية ➔ تنفيذ التحويل المصرفي الخارجي وإرفاق رقم المرجع ➔ ترحيل القيد المالي المتوازن في دفتر الأستاذ (`3100-RETAINED_EARNINGS` / `1110-CASH`). |

---

## 2. التغييرات في قاعدة البيانات والأنواع المشتركة

### 2.1 النماذج الجديدة في Prisma Schema (`packages/database/prisma/schema.prisma`):
1. **`DailyCloseReport`**: حفظ لقطة الإغلاق اليومي لكل تاريخ، مع حقول الأرقام الإجمالية والعملات وبيانات الإغلاق وثبات السجل (`isImmutable`).
2. **`DailyCloseAdjustment`**: سجل التسويات والفوارق الملحقة بالتقارير المغلقة.
3. **`PayoutBeneficiary`**: حسابات المستفيدين المعتمدة للمالك مع حالات التحقق.
4. **`OwnerPayoutTransaction`**: سجل طلبات سحب أرباح المالك مع مفاتيح عدم التكرار، المرجع المصرفي، وحالات الاعتماد.
5. **`OwnerEarningsWallet`**: محفظة مستحقات المالك المالية التراكمية.

### 2.2 الحزم والأنواع المشتركة (`packages/shared`):
- حالات الإغلاق: `DailyCloseStatus` (`OPEN`, `PRELIMINARY`, `CLOSED`, `ADJUSTED`).
- حالات السحب: `OwnerPayoutStatus` (`REQUESTED`, `APPROVED`, `PROCESSING`, `CONFIRMED`, `FAILED`, `UNKNOWN`).
- واجهات ونماذج البيانات: `CurrencyCloseMetrics`, `CreateDailyCloseDto`, `DailyCloseAdjustmentDto`, `CreatePayoutBeneficiaryDto`, `OwnerPayoutRequestDto`, `ApproveOwnerPayoutDto`.

---

## 3. نتائج الاختبارات الآلية (Automated Test Suite)

تم تشغيل حزمة الاختبارات بالكامل لضمان سلامة كافة وحدات النظام:

```text
PASS src/modules/products/catalog-pricing.spec.ts (21.493 s)
PASS src/modules/payouts/payouts.service.spec.ts (21.71 s)
PASS src/modules/products/products.service.spec.ts
PASS src/modules/reports/owner-earnings-daily-close.spec.ts
PASS src/modules/deposits/deposits.service.spec.ts
PASS src/modules/orders/orders.service.spec.ts
PASS src/modules/reconciliation/reconciliation.service.spec.ts
PASS src/modules/auth/auth.security.spec.ts
PASS src/modules/deposits/webhook.service.spec.ts
PASS src/modules/phone-verification/phone-verification.spec.ts
PASS src/modules/providers/fulfillment.service.spec.ts
PASS src/modules/providers/supplier-balance.spec.ts
PASS src/modules/service-accounts/service-accounts.spec.ts
PASS src/modules/ledger/ledger.service.spec.ts
PASS src/modules/providers/fulfillment.security.spec.ts

Test Suites: 15 passed, 15 total
Tests:       104 passed, 104 total
Snapshots:   0 total
```

---

## 4. واجهة لوحة الإدارة (Web Admin UI)

تم تحديث صفحة التقارير الإدارية (`/reports`) لتشمل ثلاث بوابات رئيسية:
1. **إغلاق اليوم المالي ولقطات التدقيق (Daily Close & Audit)**:
   - نافذة إغلاق اليوم المالي وإصدار اللقطة المحاسبية.
   - جدول لقطات الإغلاق اليومي التاريخية مع فلاتر العملات (`YER` / `USD` / `SAR`).
   - تنزيل تقرير الإغلاق بصيغة `CSV`.
   - إضافة تسوية تعديلية لاحقة (`Adjustment`) مرتبطة بالتقرير.
2. **أرباح المالك وسحب السيولة (Owner Earnings & MFA Payout)**:
   - بطاقات كشف أرباح المالك: الأرباح المحققة التراكمية، المحجوز في طلبات السحب، المسحوب فعلياً، والرصيد المتاح للسحب.
   - كشف معادلة السيولة الحرة والرقابة على أموال العملاء وديون المزودين.
   - نافذة طلب سحب أرباح المالك المحمية برمز التحقق الثنائي `TOTP MFA` ومفتاح عدم التكرار.
   - قائمة اعتماد وتأكيد صرف الحوالات المصرفية من قبل الإدارة المالية وقيدها في الدفتر المحاسبي.
3. **الأداء العام وهوامش المزودين (Analytics & Margins)**:
   - مؤشرات المبيعات والتكلفة وصافي الهامش ونسب نجاح المزودين.

---

## 5. حالة الخوادم والتشغيل الراهن

- **الواجهة الخلفية (Backend API):** `http://localhost:4000/api` (Swagger: `http://localhost:4000/api/docs`)
- **لوحة الإدارة (Web Admin):** `http://localhost:3001/reports`
- **تطبيق العميل (Web Customer):** `http://localhost:3000`
