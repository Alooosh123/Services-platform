import 'dart:convert';
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
 final values=<String,TextEditingController>{};final pin=TextEditingController();String? idempotencyFingerprint;String? idempotencyKey;String currency='YER';bool busy=false;String? error;
 List<Map<String,dynamic>> get prices=>rows(widget.product['prices']);List<Map<String,dynamic>> get schema=>rows(widget.service['fields']);
 @override void initState(){super.initState();if(prices.isNotEmpty)currency=prices.first['currency']?.toString()??'YER';for(final f in schema){final k=(f['fieldKey']??f['key']??'').toString();if(k.isNotEmpty)values[k]=TextEditingController();}}
 @override void dispose(){for(final x in values.values){x.dispose();}pin.dispose();super.dispose();}
 Future<void> buy() async {
  if (schema.any((f) => (f['required'] ?? true) == true &&
      (values[(f['fieldKey'] ?? f['key']).toString()]?.text.trim().isEmpty ?? true))) {
    setState(() => error = 'أكمل بيانات المستفيد المطلوبة.');
    return;
  }
  if (!RegExp(r'^[0-9]{6}$').hasMatch(pin.text)) {
    setState(() => error = 'أدخل رمز المعاملة من 6 أرقام.');
    return;
  }

  final requestBody = <String, dynamic>{
    'productId': widget.product['id'],
    'currency': currency,
    'paymentMethod': 'WALLET',
    'playerFields': {
      for (final entry in values.entries) entry.key: entry.value.text.trim(),
    },
  };
  final fingerprint = jsonEncode(requestBody);
  if (idempotencyFingerprint != fingerprint || idempotencyKey == null) {
    idempotencyFingerprint = fingerprint;
    idempotencyKey = const Uuid().v4();
  }
  final requestKey = idempotencyKey!;

  setState(() { busy = true; error = null; });
  try {
    await ApiClient.instance.post(
      '/orders/checkout',
      headers: {
        'x-transaction-pin': pin.text,
        'Idempotency-Key': requestKey,
      },
      body: {...requestBody, 'idempotencyKey': requestKey},
    );
    if (mounted) {
      idempotencyFingerprint = null;
      idempotencyKey = null;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم إرسال الطلب. تابع حالته في طلباتي.')),
      );
      Navigator.pop(context);
    }
  } catch (e) {
    if (mounted) setState(() => error = e.toString());
  } finally {
    if (mounted) setState(() => busy = false);
  }
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
class WalletPage extends StatefulWidget{const WalletPage({super.key});@override State<WalletPage> createState()=>_WalletPageState();}
class _WalletPageState extends State<WalletPage>{
 late Future<dynamic> data;@override void initState(){super.initState();data=ApiClient.instance.get('/wallet/balances');}
 Future<void> reload()async=>setState(()=>data=ApiClient.instance.get('/wallet/balances'));
 @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('المحفظة'),actions:[IconButton(onPressed:reload,icon:const Icon(Icons.refresh))]),body:FutureBuilder(future:data,builder:(c,s){
 if(s.connectionState==ConnectionState.waiting)return const Center(child:CircularProgressIndicator());if(s.hasError)return Retry(s.error.toString(),reload);final list=rows(s.data);
 return RefreshIndicator(onRefresh:reload,child:ListView(padding:const EdgeInsets.all(16),children:[const Text('أرصدة منفصلة حسب العملة',style:TextStyle(fontSize:17,fontWeight:FontWeight.bold)),for(final w in list)Card(color:panel,child:ListTile(title:Text(w['currency']?.toString()??'—'),subtitle:Text('المتاح: '+money(w['availableBalance']??w['balance'],w['currency']?.toString()??'')+'\nالمحجوز: '+money(w['lockedBalance'],w['currency']?.toString()??'')),isThreeLine:true,trailing:Icon(w['isFrozen']==true?Icons.lock:Icons.check_circle_outline,color:w['isFrozen']==true?Colors.red:green))),const Text('تأكيد الإيداعات يتم بعد المطابقة المالية فقط.',style:TextStyle(color:Colors.white54))]));
 }));
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
