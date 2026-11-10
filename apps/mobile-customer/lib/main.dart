import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import 'api_client.dart';

void main() async { WidgetsFlutterBinding.ensureInitialized(); await ApiClient.instance.restore(); runApp(const TopupApp()); }
const bg=Color(0xFF090D16), panel=Color(0xFF111827), purple=Color(0xFF6366F1), green=Color(0xFF10B981);
class TopupApp extends StatelessWidget {
 const TopupApp({super.key});
 @override Widget build(BuildContext c)=>MaterialApp(title:'منصة الشحن الرقمي',debugShowCheckedModeBanner:false,
 theme:ThemeData(brightness:Brightness.dark,scaffoldBackgroundColor:bg,colorScheme:const ColorScheme.dark(primary:purple,surface:panel),useMaterial3:true),
 builder:(c,w)=>Directionality(textDirection:TextDirection.rtl,child:w!),home:const Gate());
}
class Gate extends StatefulWidget {const Gate({super.key});@override State<Gate> createState()=>_GateState();}
class _GateState extends State<Gate>{
 bool loading=true;
 @override void initState(){super.initState();_check();}
 Future<void> _check()async{if(ApiClient.instance.authenticated){try{await ApiClient.instance.get('/auth/profile');if(mounted)Navigator.pushReplacement(context,MaterialPageRoute(builder:(_)=>const Shell()));}catch(_){await ApiClient.instance.logout();}}if(mounted)setState(()=>loading=false);}
 @override Widget build(BuildContext c)=>loading?const Scaffold(body:Center(child:CircularProgressIndicator())):AuthPage(onDone:()=>Navigator.pushReplacement(context,MaterialPageRoute(builder:(_)=>const Shell())));
}
class AuthPage extends StatefulWidget{final VoidCallback onDone;const AuthPage({super.key,required this.onDone});@override State<AuthPage> createState()=>_AuthPageState();}
class _AuthPageState extends State<AuthPage>{
 final form=GlobalKey<FormState>();final name=TextEditingController(),id=TextEditingController(),pass=TextEditingController();bool signup=false,busy=false;String? error;
 Future<void> submit()async{if(!form.currentState!.validate())return;setState(() { busy = true; error = null; });try{if(signup){await ApiClient.instance.register(name.text,id.text,pass.text);}else{await ApiClient.instance.login(id.text,pass.text);}if(mounted)widget.onDone();}catch(e){if(mounted)setState(()=>error=e.toString());}finally{if(mounted)setState(()=>busy=false);}}
 @override void dispose(){name.dispose();id.dispose();pass.dispose();super.dispose();}
 @override Widget build(BuildContext c)=>Scaffold(body:Center(child:SingleChildScrollView(padding:const EdgeInsets.all(20),child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:430),child:Card(color:panel,child:Padding(padding:const EdgeInsets.all(22),child:Form(key:form,child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
 const Icon(Icons.bolt,color:purple,size:48),Text(signup?'إنشاء حساب عميل':'تسجيل الدخول',textAlign:TextAlign.center,style:const TextStyle(fontSize:23,fontWeight:FontWeight.bold)),
 if(error!=null)Text(error!,style:const TextStyle(color:Colors.redAccent)),
 if(signup)TextFormField(controller:name,decoration:const InputDecoration(labelText:'الاسم الكامل'),validator:(v)=>v==null||v.trim().length<2?'أدخل الاسم':null),
 const SizedBox(height:12),TextFormField(controller:id,decoration:const InputDecoration(labelText:'البريد الإلكتروني أو الهاتف'),validator:(v)=>v==null||v.trim().isEmpty?'الحقل مطلوب':null),
 const SizedBox(height:12),TextFormField(controller:pass,obscureText:true,decoration:const InputDecoration(labelText:'كلمة المرور'),validator:(v)=>v==null||v.length<6?'6 أحرف على الأقل':null),
 const SizedBox(height:16),FilledButton(onPressed:busy?null:submit,child:Text(busy?'جارٍ التنفيذ…':signup?'إنشاء الحساب':'دخول')),
 TextButton(onPressed:busy?null:()=>setState(()=>signup=!signup),child:Text(signup?'لديك حساب؟ تسجيل الدخول':'مستخدم جديد؟ إنشاء حساب')),
 const Text('رموز الجلسة محفوظة في التخزين الآمن للجهاز.',textAlign:TextAlign.center,style:TextStyle(color:Colors.white38,fontSize:11)),
 ]))))))));
}
class Shell extends StatefulWidget{const Shell({super.key});@override State<Shell> createState()=>_ShellState();}
class _ShellState extends State<Shell>{int index=0;final pages=const[CatalogPage(),OrdersPage(),WalletPage(),ProfilePage()];@override Widget build(BuildContext c)=>Scaffold(body:IndexedStack(index:index,children:pages),bottomNavigationBar:NavigationBar(backgroundColor:panel,selectedIndex:index,onDestinationSelected:(i)=>setState(()=>index=i),destinations:const[
 NavigationDestination(icon:Icon(Icons.storefront),label:'المتجر'),NavigationDestination(icon:Icon(Icons.receipt_long),label:'طلباتي'),NavigationDestination(icon:Icon(Icons.account_balance_wallet),label:'المحفظة'),NavigationDestination(icon:Icon(Icons.person),label:'حسابي')]));
}
class CatalogPage extends StatefulWidget{const CatalogPage({super.key});@override State<CatalogPage> createState()=>_CatalogPageState();}
class _CatalogPageState extends State<CatalogPage>{
 late Future<dynamic> data;@override void initState(){super.initState();data=ApiClient.instance.get('/products/catalog');}
 Future<void> reload()async=>setState(()=>data=ApiClient.instance.get('/products/catalog'));
 @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('متجر توب آب'),actions:[IconButton(onPressed:reload,icon:const Icon(Icons.refresh))]),body:FutureBuilder(future:data,builder:(c,s){
 if(s.connectionState==ConnectionState.waiting)return const Center(child:CircularProgressIndicator());if(s.hasError)return Retry(s.error.toString(),reload);
 final services=<Map<String,dynamic>>[];for(final cat in rows(s.data)){services.addAll(rows(cat['services']));}
 if(services.isEmpty)return const Center(child:Text('لا توجد خدمات منشورة حالياً.'));
 return RefreshIndicator(onRefresh:reload,child:ListView(padding:const EdgeInsets.all(14),children:[
 Container(padding:const EdgeInsets.all(18),decoration:BoxDecoration(borderRadius:BorderRadius.circular(16),gradient:const LinearGradient(colors:[Color(0xFF312E81),Color(0xFF1E1B4B)])),child:const Text('خدمات رقمية وشحن ألعاب. الأسعار والحقول من الخادم مباشرة.',style:TextStyle(fontSize:16,fontWeight:FontWeight.bold))),
 for(final service in services)...[
 Padding(padding:const EdgeInsets.symmetric(vertical:10),child:Text(service['nameAr']?.toString()??service['name']?.toString()??'خدمة',style:const TextStyle(fontWeight:FontWeight.bold,fontSize:17))),
 for(final product in rows(service['products']))Card(color:panel,child:ListTile(title:Text(product['nameAr']?.toString()??product['name']?.toString()??'باقة'),subtitle:Text(rows(product['prices']).map((p)=>money(p['retailPrice'],p['currency']?.toString()??'')).join(' • ')),trailing:const Icon(Icons.chevron_left),onTap:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>CheckoutPage(service:service,product:product))))),
 ]]));
 }));
}
class CheckoutPage extends StatefulWidget{final Map<String,dynamic> service,product;const CheckoutPage({super.key,required this.service,required this.product});@override State<CheckoutPage> createState()=>_CheckoutPageState();}
class _CheckoutPageState extends State<CheckoutPage>{
 final values=<String,TextEditingController>{};final pin=TextEditingController();final idempotencyKey=const Uuid().v4();String currency='YER';bool busy=false;String? error;
 List<Map<String,dynamic>> get prices=>rows(widget.product['prices']);List<Map<String,dynamic>> get schema=>rows(widget.service['fields']);
 @override void initState(){super.initState();if(prices.isNotEmpty)currency=prices.first['currency']?.toString()??'YER';for(final f in schema){final k=(f['fieldKey']??f['key']??'').toString();if(k.isNotEmpty)values[k]=TextEditingController();}}
 @override void dispose(){for(final x in values.values){x.dispose();}pin.dispose();super.dispose();}
 Future<void> buy()async{
 if(schema.any((f)=>(f['required']??true)==true && (values[(f['fieldKey']??f['key']).toString()]?.text.trim().isEmpty??true))){setState(()=>error='أكمل بيانات المستفيد المطلوبة.');return;}if(!RegExp(r'^[0-9]{6}$').hasMatch(pin.text)){setState(()=>error='أدخل رمز المعاملة من 6 أرقام.');return;}
 setState(() { busy = true; error = null; });try{
 await ApiClient.instance.post('/orders/checkout',headers:{'x-transaction-pin':pin.text},body:{'productId':widget.product['id'],'currency':currency,'paymentMethod':'WALLET','playerFields':{for(final e in values.entries)e.key:e.value.text.trim()},'idempotencyKey':idempotencyKey});
 if(mounted){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('تم إرسال الطلب. تابع حالته في طلباتي.')));Navigator.pop(context);}
 }catch(e){if(mounted)setState(()=>error=e.toString());}finally{if(mounted)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext c){
 Map<String,dynamic>? price;for(final p in prices){if(p['currency']?.toString()==currency){price=p;break;}}
 return Scaffold(appBar:AppBar(title:Text(widget.service['nameAr']?.toString()??'تأكيد الطلب')),body:ListView(padding:const EdgeInsets.all(16),children:[
 Text(widget.product['nameAr']?.toString()??widget.product['name']?.toString()??'باقة',style:const TextStyle(fontSize:20,fontWeight:FontWeight.bold)),
 Text(price==null?'السعر غير متوفر':money(price['retailPrice'],currency),style:const TextStyle(color:green,fontWeight:FontWeight.bold)),
 const SizedBox(height:18),const Text('بيانات المستفيد'),
 for(final f in schema)...[TextField(controller:values[(f['fieldKey']??f['key']).toString()],keyboardType:f['type']?.toString()=='number'?TextInputType.number:TextInputType.text,decoration:InputDecoration(labelText:f['labelAr']?.toString()??f['label']?.toString()??f['fieldKey']?.toString(),hintText:f['placeholderAr']?.toString())),const SizedBox(height:10)],
 if(prices.map((p)=>p['currency']).toSet().length>1)DropdownButtonFormField<String>(initialValue:currency,decoration:const InputDecoration(labelText:'عملة الدفع'),items:prices.map((p)=>p['currency'].toString()).toSet().map((x)=>DropdownMenuItem(value:x,child:Text(x))).toList(),onChanged:(v)=>setState(()=>currency=v??currency)),
 TextField(controller:pin,obscureText:true,maxLength:6,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'رمز المعاملة المالي')),
 if(error!=null)Text(error!,style:const TextStyle(color:Colors.redAccent)),
 FilledButton(onPressed:busy||price==null?null:buy,child:Text(busy?'جارٍ الإرسال…':'تأكيد الطلب والدفع من المحفظة')),
 const Text('السعر والتحقق من الرصيد والخصم تتم داخل الخادم فقط.',style:TextStyle(color:Colors.white54,fontSize:12))
 ]));
 }
}
class OrdersPage extends StatefulWidget{const OrdersPage({super.key});@override State<OrdersPage> createState()=>_OrdersPageState();}
class _OrdersPageState extends State<OrdersPage>{
 late Future<dynamic> data;@override void initState(){super.initState();data=ApiClient.instance.get('/orders/my-orders?page=1&limit=50');}
 Future<void> reload()async=>setState(()=>data=ApiClient.instance.get('/orders/my-orders?page=1&limit=50'));
 @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('طلباتي'),actions:[IconButton(onPressed:reload,icon:const Icon(Icons.refresh))]),body:FutureBuilder(future:data,builder:(c,s){
 if(s.connectionState==ConnectionState.waiting)return const Center(child:CircularProgressIndicator());if(s.hasError)return Retry(s.error.toString(),reload);final list=rows(s.data);if(list.isEmpty)return const Center(child:Text('لا توجد طلبات.'));
 return RefreshIndicator(onRefresh:reload,child:ListView(children:[for(final o in list)Card(color:panel,child:ListTile(title:Text(o['orderNumber']?.toString()??'طلب'),subtitle:Text((o['snapshotProductNameAr']??o['snapshotProductName']??'').toString()+' • '+money(o['snapshotRetailPrice'],o['snapshotCurrency']?.toString()??'')+'\nالحالة: '+(o['status']??'—').toString()),isThreeLine:true,onTap:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>OrderDetailPage(id:o['id']?.toString()??o['orderNumber']?.toString()??'')))))]));
 }));
}
class OrderDetailPage extends StatelessWidget{final String id;const OrderDetailPage({super.key,required this.id});@override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('تفاصيل الطلب')),body:FutureBuilder(future:ApiClient.instance.get('/orders/'+id),builder:(c,s){
 if(s.connectionState==ConnectionState.waiting)return const Center(child:CircularProgressIndicator());if(s.hasError)return Center(child:Text(s.error.toString()));final d=s.data is Map?Map<String,dynamic>.from(s.data):<String,dynamic>{};
 return ListView(padding:const EdgeInsets.all(16),children:[InfoTile('رقم الطلب',d['orderNumber']),InfoTile('الحالة',d['status']),InfoTile('الخدمة',d['snapshotServiceNameAr']??d['snapshotServiceName']),InfoTile('الباقة',d['snapshotProductNameAr']??d['snapshotProductName']),InfoTile('المبلغ',money(d['snapshotRetailPrice'],d['snapshotCurrency']?.toString()??''))]);
 }));
}
class WalletPage extends StatefulWidget {
  const WalletPage({super.key});
  @override
  State<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<WalletPage> {
  late Future<dynamic> data;
  late Future<dynamic> history;

  @override
  void initState() {
    super.initState();
    data = ApiClient.instance.get('/wallet/balances');
    history = ApiClient.instance.getWalletTransactions(limit: 20);
  }

  Future<void> reload() async {
    setState(() {
      data = ApiClient.instance.get('/wallet/balances');
      history = ApiClient.instance.getWalletTransactions(limit: 20);
    });
    await Future.wait([data, history]);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('المحفظة'),
          actions: [IconButton(onPressed: reload, icon: const Icon(Icons.refresh))],
        ),
        body: FutureBuilder(
          future: data,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) return Retry(snapshot.error.toString(), reload);
            final wallets = rows(snapshot.data);
            return RefreshIndicator(
              onRefresh: reload,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  FilledButton.icon(
                    onPressed: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const DepositPage()),
                      );
                      if (mounted) await reload();
                    },
                    icon: const Icon(Icons.add_card),
                    label: const Text('إيداع في المحفظة'),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'أرصدة منفصلة حسب العملة',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                  ),
                  for (final wallet in wallets)
                    Card(
                      color: panel,
                      child: ListTile(
                        title: Text(wallet['currency']?.toString() ?? '—'),
                        subtitle: Text(
                          'المتاح: ${money(wallet['availableBalance'] ?? wallet['balance'], wallet['currency']?.toString() ?? '')}'
                          '\nالمحجوز: ${money(wallet['lockedBalance'], wallet['currency']?.toString() ?? '')}',
                        ),
                        isThreeLine: true,
                        trailing: Icon(
                          wallet['isFrozen'] == true ? Icons.lock : Icons.check_circle_outline,
                          color: wallet['isFrozen'] == true ? Colors.red : green,
                        ),
                      ),
                    ),
                  const SizedBox(height: 18),
                  const Text(
                    'آخر حركات المحفظة',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  FutureBuilder(
                    future: history,
                    builder: (context, historySnapshot) {
                      if (historySnapshot.connectionState == ConnectionState.waiting) {
                        return const Padding(
                          padding: EdgeInsets.all(18),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      if (historySnapshot.hasError) {
                        return Text(
                          'تعذر تحميل سجل الحركات: ${historySnapshot.error}',
                          style: const TextStyle(color: Colors.orangeAccent),
                        );
                      }
                      final entries = rows(historySnapshot.data);
                      if (entries.isEmpty) {
                        return const Card(
                          color: panel,
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: Text('لا توجد حركات مالية مسجلة حتى الآن.'),
                          ),
                        );
                      }
                      return Column(
                        children: [
                          for (final entry in entries)
                            Builder(
                              builder: (context) {
                                final direction = entry['direction']?.toString() ?? '';
                                final isCredit = ['CREDIT', 'REFUND', 'UNLOCK', 'COMMISSION'].contains(direction);
                                final title = switch (direction) {
                                  'CREDIT' => 'إضافة رصيد',
                                  'DEBIT' => 'خصم',
                                  'LOCK' => 'حجز مبلغ',
                                  'UNLOCK' => 'تحرير مبلغ محجوز',
                                  'REFUND' => 'استرداد',
                                  'COMMISSION' => 'عمولة',
                                  _ => 'حركة محفظة',
                                };
                                final created = DateTime.tryParse(entry['createdAt']?.toString() ?? '');
                                final date = created == null
                                    ? '—'
                                    : created.toLocal().toString().substring(0, 16);
                                return Card(
                                  color: panel,
                                  child: ListTile(
                                    leading: Icon(
                                      isCredit ? Icons.arrow_downward : Icons.arrow_upward,
                                      color: isCredit ? green : Colors.orangeAccent,
                                    ),
                                    title: Text(title),
                                    subtitle: Text(
                                      '${entry['description'] ?? entry['referenceType'] ?? ''}\n$date',
                                    ),
                                    isThreeLine: true,
                                    trailing: Text(
                                      money(entry['amount'], entry['currency']?.toString() ?? ''),
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: isCredit ? green : Colors.orangeAccent,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'لا يُضاف أي رصيد إلا بعد إثبات الاستلام وترحيل القيد المحاسبي.',
                    style: TextStyle(color: Colors.white54),
                  ),
                ],
              ),
            );
          },
        ),
      );
}

class DepositPage extends StatefulWidget {
  const DepositPage({super.key});
  @override
  State<DepositPage> createState() => _DepositPageState();
}

class _DepositPageState extends State<DepositPage> {
  final amount = TextEditingController(text: '25000');
  final reference = TextEditingController();
  final senderIdentifier = TextEditingController();
  final senderName = TextEditingController();
  String currency = 'YER';
  String? channelCode;
  bool consentAccepted = false;
  bool loading = true;
  bool submitting = false;
  List<Map<String, dynamic>> channels = [];
  List<Map<String, dynamic>> senderAccounts = [];

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    amount.dispose();
    reference.dispose();
    senderIdentifier.dispose();
    senderName.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final c = rows(await ApiClient.instance.get('/deposits/channels'));
      final a = rows(await ApiClient.instance.get('/deposits/sender-accounts'));
      if (!mounted) return;
      setState(() {
        channels = c;
        senderAccounts = a;
        final usable = c.where((item) =>
          (item['supportedCurrencies'] as List? ?? const []).contains(currency) &&
          item['mode'] == 'MANUAL'
        ).toList();
        channelCode = usable.isNotEmpty ? usable.first['code']?.toString() : null;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تعذر تحميل قنوات الإيداع: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  List<Map<String, dynamic>> get availableChannels => channels.where((item) =>
    item['mode'] == 'MANUAL' &&
    (item['supportedCurrencies'] as List? ?? const []).contains(currency)
  ).toList();

  Map<String, dynamic>? get selectedChannel {
    for (final item in availableChannels) {
      if (item['code']?.toString() == channelCode) return item;
    }
    return availableChannels.isEmpty ? null : availableChannels.first;
  }

  Map<String, dynamic>? get savedSenderAccount {
    for (final item in senderAccounts) {
      if (item['channelCode']?.toString() == channelCode) return item;
    }
    return null;
  }

  String get identifierLabel {
    switch (selectedChannel?['senderIdentifierType']?.toString()) {
      case 'ALIAS':
        return 'رقم البديل لمحفظتك';
      case 'WALLET_ID':
        return 'معرّف محفظتك';
      case 'ACCOUNT_NUMBER':
        return 'رقم حساب الإرسال';
      default:
        return 'رقم الهاتف المرتبط بمحفظتك';
    }
  }

  Future<void> submit() async {
    final channel = selectedChannel;
    if (channel == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('لا توجد قناة يدوية متاحة لهذه العملة حالياً.')),
      );
      return;
    }
    final value = double.tryParse(amount.text.trim());
    if (value == null || value <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('أدخل مبلغاً صالحاً.')),
      );
      return;
    }

    setState(() => submitting = true);
    try {
      String? senderAccountId;
      final saved = savedSenderAccount;
      if (senderIdentifier.text.trim().isNotEmpty) {
        if (!consentAccepted) {
          throw const ApiException('وافق على حفظ معرّف حساب الإرسال مشفّراً حتى يستخدمه الوكيل في المطابقة.');
        }
        final savedResult = await ApiClient.instance.post(
          '/deposits/sender-accounts',
          body: {
            'channelCode': channelCode,
            'identifierType': channel['senderIdentifierType'] ?? 'PHONE',
            'identifier': senderIdentifier.text.trim(),
            'consentAccepted': true,
          },
        );
        if (savedResult is! Map || savedResult['id'] == null) {
          throw const ApiException('تعذر حفظ حساب الإرسال.');
        }
        senderAccountId = savedResult['id'].toString();
        senderAccounts = [
          ...senderAccounts.where((a) => a['channelCode'] != channelCode),
          Map<String, dynamic>.from(savedResult),
        ];
        senderIdentifier.clear();
        consentAccepted = false;
      } else if (saved != null) {
        senderAccountId = saved['id']?.toString();
      } else {
        throw const ApiException('أدخل رقم البديل أو رقم الهاتف المرتبط بمحفظتك واحفظه أولاً.');
      }

      final payload = <String, dynamic>{
        'currency': currency,
        'amount': value,
        'paymentMethodCode': channelCode,
        'senderAccountId': senderAccountId,
        'senderName': senderName.text.trim(),
        if (reference.text.trim().isNotEmpty)
          'referenceNumber': reference.text.trim(),
      };
      final result = await ApiClient.instance.post('/deposits/request', body: payload);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result is Map
              ? (result['message']?.toString() ?? 'تم تسجيل طلب الإيداع.')
              : 'تم تسجيل طلب الإيداع.',
          ),
        ),
      );
      Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final channel = selectedChannel;
    final saved = savedSenderAccount;
    return Scaffold(
      appBar: AppBar(title: const Text('إيداع في المحفظة')),
      body: loading
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: load,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'حوّل المبلغ إلى حساب الاستقبال الرسمي ثم أرسل الطلب. سيطابق الوكيل سجل الحركة الواردة.',
                  style: TextStyle(color: Colors.white70, height: 1.6),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: currency,
                  decoration: const InputDecoration(labelText: 'عملة الإيداع'),
                  items: const [
                    DropdownMenuItem(value: 'YER', child: Text('ريال يمني (YER)')),
                    DropdownMenuItem(value: 'USD', child: Text('دولار أمريكي (USD)')),
                    DropdownMenuItem(value: 'SAR', child: Text('ريال سعودي (SAR)')),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() {
                      currency = value;
                      final next = channels.where((item) =>
                        item['mode'] == 'MANUAL' &&
                        (item['supportedCurrencies'] as List? ?? const []).contains(currency)
                      ).toList();
                      channelCode = next.isEmpty ? null : next.first['code']?.toString();
                      senderIdentifier.clear();
                      consentAccepted = false;
                    });
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: channelCode,
                  decoration: const InputDecoration(labelText: 'محفظة التحويل'),
                  items: [
                    for (final item in availableChannels)
                      DropdownMenuItem(
                        value: item['code']?.toString(),
                        child: Text(item['nameAr']?.toString() ?? item['code'].toString()),
                      ),
                  ],
                  onChanged: (value) => setState(() {
                    channelCode = value;
                    senderIdentifier.clear();
                    consentAccepted = false;
                  }),
                ),
                if (channel != null) ...[
                  const SizedBox(height: 12),
                  Card(
                    color: panel,
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('حساب الاستقبال: ${channel['accountNumber'] ?? '—'}'),
                          Text('الاسم: ${channel['accountHolderName'] ?? '—'}'),
                          const SizedBox(height: 8),
                          Text(
                            channel['instructionsAr']?.toString() ?? '',
                            style: const TextStyle(color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amount,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: 'المبلغ ($currency)'),
                  ),
                  const SizedBox(height: 12),
                  if (saved != null) ...[
                    Card(
                      color: panel,
                      child: ListTile(
                        title: Text('الحساب المحفوظ: ${saved['maskedIdentifier'] ?? '—'}'),
                        subtitle: Text(saved['status'] == 'VERIFIED'
                          ? 'تم التحقق من الحساب'
                          : 'بانتظار أول مطابقة من الوكيل'),
                        leading: const Icon(Icons.verified_user_outlined),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  TextField(
                    controller: senderIdentifier,
                    maxLength: 80,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: identifierLabel,
                      hintText: saved == null
                        ? 'أدخل المعرّف كما يظهر في تطبيق المحفظة'
                        : 'اتركه فارغاً لاستخدام الحساب المحفوظ أو أدخل الجديد لتحديثه',
                    ),
                  ),
                  if (senderIdentifier.text.trim().isNotEmpty)
                    CheckboxListTile(
                      value: consentAccepted,
                      onChanged: (value) => setState(() => consentAccepted = value == true),
                      title: const Text(
                        'أوافق على حفظ المعرّف مشفّراً واستخدامه لمطابقة الإيداعات.',
                        style: TextStyle(fontSize: 12),
                      ),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                    ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: reference,
                    decoration: const InputDecoration(
                      labelText: 'رقم الحوالة المرجعي (اختياري إذا لم يظهر)',
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: senderName,
                    decoration: const InputDecoration(labelText: 'اسم صاحب الحساب (اختياري)'),
                  ),
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    onPressed: submitting ? null : submit,
                    icon: submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                    label: Text(submitting ? 'جاري الإرسال...' : 'إرسال طلب الإيداع'),
                  ),
                ] else
                  const Padding(
                    padding: EdgeInsets.all(18),
                    child: Text('لا توجد قناة تحويل يدوية نشطة ومعتمدة لهذه العملة.'),
                  ),
              ],
            ),
          ),
    );
  }
}

class ProfilePage extends StatefulWidget{const ProfilePage({super.key});@override State<ProfilePage> createState()=>_ProfilePageState();}
class _ProfilePageState extends State<ProfilePage>{
 late Future<dynamic> profile;@override void initState(){super.initState();profile=ApiClient.instance.get('/auth/profile');}
 Future<void> setPin()async{
 final pass=TextEditingController(),pin=TextEditingController();
 final ok=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(title:const Text('إعداد رمز المعاملة'),content:Column(mainAxisSize:MainAxisSize.min,children:[TextField(controller:pass,obscureText:true,decoration:const InputDecoration(labelText:'كلمة المرور الحالية')),TextField(controller:pin,obscureText:true,maxLength:6,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'رمز جديد من 6 أرقام'))]),actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('إلغاء')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('حفظ'))]));
 if(ok==true){try{await ApiClient.instance.post('/auth/transaction-pin',body:{'currentPassword':pass.text,'pin':pin.text});if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('تم تحديث رمز المعاملة.')));}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}}
 pass.dispose();pin.dispose();
 }
 @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('حسابي')),body:FutureBuilder(future:profile,builder:(c,s){
 if(s.connectionState==ConnectionState.waiting)return const Center(child:CircularProgressIndicator());if(s.hasError)return Retry(s.error.toString(),()async=>setState(()=>profile=ApiClient.instance.get('/auth/profile')));
 final d=s.data is Map?Map<String,dynamic>.from(s.data):<String,dynamic>{};final u=d['user'] is Map?Map<String,dynamic>.from(d['user']):d;
 return ListView(padding:const EdgeInsets.all(16),children:[Card(color:panel,child:ListTile(title:Text(u['fullName']?.toString()??'العميل'),subtitle:Text(u['email']?.toString()??u['phone']?.toString()??''))),ListTile(leading:const Icon(Icons.password),title:const Text('إعداد / تغيير رمز المعاملة'),onTap:setPin),ListTile(leading:const Icon(Icons.logout,color:Colors.red),title:const Text('تسجيل الخروج'),onTap:()async{await ApiClient.instance.logout();if(c.mounted)Navigator.pushAndRemoveUntil(c,MaterialPageRoute(builder:(_)=>AuthPage(onDone:()=>Navigator.pushReplacement(c,MaterialPageRoute(builder:(_)=>const Shell())))),(_)=>false);})]);
 }));
}
class InfoTile extends StatelessWidget{final String label;final dynamic value;const InfoTile(this.label,this.value);@override Widget build(BuildContext c)=>Card(color:panel,child:ListTile(title:Text(label,style:const TextStyle(color:Colors.white54,fontSize:12)),subtitle:Text(value?.toString()??'—')));}
class Retry extends StatelessWidget{final String message;final Future<void> Function() retry;const Retry(this.message,this.retry);@override Widget build(BuildContext c)=>Center(child:Padding(padding:const EdgeInsets.all(22),child:Column(mainAxisSize:MainAxisSize.min,children:[const Icon(Icons.cloud_off,size:36,color:Colors.amber),Text(message,textAlign:TextAlign.center),OutlinedButton(onPressed:retry,child:const Text('إعادة المحاولة'))])));}
