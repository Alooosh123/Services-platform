# وكيل MikroTik للقراءة فقط — اختبار معزول

## نطاق الوكيل

المسارات المتاحة عبر Backend:

- `GET /api/network-monitoring/status`: قراءة الهوية وإصدار RouterOS والموارد والواجهات ثم بناء تشخيص قائم على قواعد واضحة.
- `GET /api/network-monitoring/history`: قراءة آخر الملاحظات المخزنة.

العميل البرمجي يستخدم HTTPS وطلبات `GET` فقط إلى `/rest/system/identity` و`/rest/system/resource` و`/rest/interface`. لا توجد دوال لتغيير إعدادات الراوتر أو تشغيل/إيقاف واجهة أو تعديل Firewall أو Route أو QoS. لا يتبع التحويلات، ويرفض HTTP والعناوين العامة، ويتحقق من TLS وشهادة CA، ويضع حداً لحجم الرد والمهلة.

النتائج التي تصدر عن الوكيل هي مؤشرات تشخيصية. عتبات CPU والذاكرة في الكود (85%/95% و15%/5%) عتبات تشغيلية داخل المنصة وليست تصنيفات رسمية من MikroTik. التحذير لا يثبت وحده وجود عطل، وغياب التحذير لا يثبت سلامة الشبكة.

## إعداد جهاز اختبار RouterOS

استخدم راوتراً احتياطياً أو جهاز اختبار ضمن VLAN إدارة معزولة أو VPN؛ لا تبدأ بعنوان إدارة مكشوف على الإنترنت، ولا تستخدم حساب `admin` أو حساب إدارة يومي.

1. حدّث جهاز الاختبار إلى إصدار RouterOS مدعوم، واضبط اسماً معروفاً للجهاز وتوقيتاً صحيحاً.
2. جهّز شهادة TLS موثوقة للـ `www-ssl`، وثبّت شهادة CA المقابلة في بيئة backend. لا تعطّل `rejectUnauthorized` ولا تستخدم HTTP/REST-plain.
3. لا تستخدم مجموعة RouterOS الافتراضية المسماة `read`: توضح وثائق MikroTik أنها قد تتضمن صلاحيات إضافية مثل `reboot` و`sensitive`. أنشئ مجموعة مخصصة بسياسات `read,api,rest-api` فقط، من دون `write` أو `policy` أو `sensitive` أو `reboot` أو `test` أو إدارة المستخدمين.
4. أنشئ مستخدم خدمة مستقلّاً داخل هذه المجموعة بكلمة مرور قوية وفريدة، وقيّد المستخدم بعنوان backend الثابت عبر خاصية `address`.
5. فعّل `www-ssl` فقط، وقيّد الخدمة بعنوان خادم التطبيق عبر `available-from`، واضبط TLS على 1.2 على الأقل أو `only-1.2`، وعطّل REST غير المشفر بخيار `rest-plain=no`. لا تفتح `www` غير المشفر ولا تفتح منفذ الإدارة على WAN.

مثال أوامر RouterOS 7.25+ بعد استبدال العناوين وكلمة المرور بقيم بيئة الاختبار:

```routeros
/user/group/add name=platform-rest-read policy=read,api,rest-api
/user/add name=platform-monitor group=platform-rest-read address=192.168.88.10/32 password="<unique-long-secret>"
/ip/service/set www-ssl disabled=no available-from=192.168.88.10/32 tls-version=only-1.2
/ip/service/webserver/set rest-plain=no
/ip/service/disable www
```

سياسة `api` المطلوبة هنا هي صلاحية مجموعة المستخدم كي يسمح RouterOS لمغلف REST بإنشاء جلسة API داخلية؛ لا يعني ذلك ضرورة فتح خدمة `/ip/service api` على الشبكة. لا تمنح الحساب `write`، وبذلك ترفض أوامر تغيير الإعدادات حتى لو أخطأ عميل المراقبة.
6. اختبر الطلبات الثلاثة للقراءة من نفس حاوية/خادم التطبيق مع التحقق من الشهادة؛ تأكد أن الحساب لا يستطيع تغيير إعداد عبر RouterOS CLI/API.

أمثلة مرجعية من وثائق MikroTik الرسمية:

- [REST API](https://manual.mikrotik.com/docs/developer-guides/rest-api/)
- [المستخدمون والصلاحيات](https://manual.mikrotik.com/docs/authentication-authorization-accounting/user/)
- [تحديثات دليل RouterOS في 28 سبتمبر 2026، بما فيها مراجعة REST API على RouterOS 7.25](https://manual.mikrotik.com/changelog/changelog-2026-09-28/)
- [مراقبة الموارد والسجلات](https://manual.mikrotik.com/docs/diagnostics-monitoring-and-troubleshooting/)
- [Ethernet](https://manual.mikrotik.com/docs/wired-connections/ethernet/)

## إعداد التطبيق

ضع المتغيرات في Secret Manager أو `.env` غير المتعقب؛ لا تحفظ كلمة مرور الراوتر في Git أو سجل CI. يبقى الوكيل متوقفاً ما لم تضبط `MIKROTIK_MONITORING_ENABLED=true`. يعمل الفحص الدوري كل 60 ثانية افتراضياً، ويمكن ضبطه بين 15 و300 ثانية:

```dotenv
MIKROTIK_MONITORING_ENABLED=true
MIKROTIK_POLL_INTERVAL_MS=60000
MIKROTIK_BASE_URL=https://192.168.88.1
MIKROTIK_USERNAME=monitor-api
MIKROTIK_PASSWORD=<unique-long-secret>
MIKROTIK_CA_FILE=/run/secrets/routeros-ca.pem
```

العنوان يجب أن يكون IPv4 خاصاً ضمن شبكة الإدارة. يسمح الاختبار الآلي بـ loopback فقط عند `NODE_ENV=test`. لا يحتوي المسار على اسم مستخدم أو كلمة مرور داخل URL.

بعد تشغيل backend، استخدم حساباً مصرحاً له (Owner أو General Manager أو Admin أو Auditor) واستدعِ:

```http
GET /api/network-monitoring/status
GET /api/network-monitoring/history?limit=20
```

تظهر الحالة `DISABLED` عندما لا تكتمل التهيئة، و`UNAVAILABLE` عند فشل المصادقة/الشبكة/TLS، و`DEGRADED` عند وجود تشخيص تحذيري أو حرج، و`HEALTHY` إذا لم تتجاوز القراءات عتبات القواعد الحالية. تُحفظ الملاحظات في `network_snapshots` دون حفظ كلمة المرور.

## حدود الثقة والتشغيل

- لا ينفذ الوكيل إجراءً علاجياً أو تغييراً شبكياً، حتى بعد موافقة إدارية.
- طلب الموافقة على تغيير شبكة يسجل في `/api/operational-approvals`، وقرار الموافقة منفصل عن التنفيذ. يسجل closeout مرجع تنفيذ يدوي فقط، ولا يرسل أمر RouterOS.
- لا تعتمد أي تشخيص آلي قبل مقارنته بعينات متكررة وسجلات RouterOS ومراجعة مسؤول الشبكة.
- يبدأ الوكيل جولة قراءة مباشرة عند التشغيل ثم يكررها على الفاصل المحدد، ويمنع تداخل جولات الفحص في نسخة التطبيق الواحدة. عند تشغيل عدة نسخ Backend ستنفذ كل نسخة مراقبتها؛ لذلك ابدأ بنسخة واحدة في بيئة الاختبار.

لا يوجد في هذا الفرع إثبات اتصال حي براوتر فعلي؛ يلزم إعداد جهاز الاختبار وشهادة CA وحساب القراءة فقط ثم حفظ نتيجة `status` كدليل اختبار.

## فحص القبول المقترح

1. مع متغيرات اتصال فارغة: الحالة `DISABLED` ولا يحدث أي اتصال خارجي.
2. مع HTTP أو عنوان عام أو URL يتضمن credentials/path/query: يرفض الوكيل الإعداد.
3. مع CA غير موثوق أو كلمة مرور خطأ أو خدمة معطلة: الحالة `UNAVAILABLE` مع رمز تشخيص واضح ودون تسريب أسرار.
4. مع حساب قراءة فقط: تنجح قراءات الهوية والموارد والواجهات فقط.
5. تحقق من عدم وجود أي HTTP method غير GET في مسار عميل MikroTik، ومن عدم وجود استدعاء كتابة في اختبارات الوكيل.
6. اختبر CPU مرتفعاً وذاكرة منخفضة وواجهة down في اختبارات unit، وتأكد أن الحالة `DEGRADED` وأن التوصيات لا تتضمن تشغيل أوامر تلقائية.
