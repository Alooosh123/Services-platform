import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  const ApiException(this.message);
  @override String toString() => message;
}
class ApiClient {
  ApiClient._({http.Client? httpClient, String? baseUrl})
      : client = httpClient ?? http.Client(),
        baseUrl = baseUrl ?? const String.fromEnvironment(
          'API_BASE_URL',
          defaultValue: 'http://10.0.2.2:4000/api',
        );

  /// Injectable HTTP client for integration/contract tests.
  ApiClient.withClient({required http.Client httpClient, required String baseUrl})
      : this._(httpClient: httpClient, baseUrl: baseUrl);

  static final instance = ApiClient._();
  static const storage = FlutterSecureStorage();
  final http.Client client;
  final String baseUrl;
  String? accessToken,refreshToken;
  bool get authenticated=>accessToken?.isNotEmpty==true;
  Future<void> restore() async {accessToken=await storage.read(key:'access_token');refreshToken=await storage.read(key:'refresh_token');}
  Future<void> save(Map tokens) async {
    final a=tokens['accessToken']?.toString();
    if(a==null||a.isEmpty)throw const ApiException('رمز الجلسة غير موجود.');
    accessToken=a;refreshToken=tokens['refreshToken']?.toString();
    await storage.write(key:'access_token',value:accessToken);
    if(refreshToken!=null)await storage.write(key:'refresh_token',value:refreshToken);
  }
  Future<dynamic> login(String id,String password) async {
    final d=await _send('POST','/auth/login',body:{'identifier':id.trim(),'password':password},auth:false);
    if(d is! Map||d['tokens'] is! Map)throw const ApiException('استجابة تسجيل الدخول غير مكتملة.');
    await save(d['tokens'] as Map);return d;
  }
  Future<dynamic> register(String name,String id,String password) async {
    await _send('POST','/auth/register',body:{'fullName':name.trim(),if(id.contains('@'))'email':id.trim() else 'phone':id.trim(),'password':password},auth:false);
    return login(id,password);
  }
  Future<dynamic> get(String path) => _send('GET', path);

  Future<dynamic> post(String path, {Object? body, Map<String, String>? headers}) =>
      _send('POST', path, body: body, headers: headers);

  Future<dynamic> patch(String path, {Object? body, Map<String, String>? headers}) =>
      _send('PATCH', path, body: body, headers: headers);

  Future<dynamic> getWalletTransactions({
    String? currency,
    int page = 1,
    int limit = 20,
  }) {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      if (currency != null && currency.isNotEmpty) 'currency': currency,
    };
    return _send('GET', '/wallet/transactions?${Uri(queryParameters: query).query}');
  }
  Future<void> _clearSession() async {
    accessToken=null;refreshToken=null;
    await storage.delete(key:'access_token');
    await storage.delete(key:'refresh_token');
  }
  Future<void> logout() async {
    try{if(authenticated)await post('/auth/logout');}catch(_){}
    await _clearSession();
  }
  Future<bool> _refresh() async {
    if(refreshToken==null||refreshToken!.isEmpty)return false;
    try{
      final r=await client.post(Uri.parse(baseUrl+'/auth/refresh'),headers:{'Content-Type':'application/json'},body:jsonEncode({'refreshToken':refreshToken}));
      if(r.statusCode!=200){await _clearSession();return false;}
      final d=jsonDecode(r.body);await save(d is Map&&d['tokens'] is Map?d['tokens'] as Map:d as Map);return true;
    } catch (_) {
      await _clearSession();
      return false;
    }
  }
  Future<dynamic> _send(String method,String path,{Object? body,Map<String,String>? headers,bool auth=true,bool retry=true}) async {
    http.Response r;
    try{
      final h=<String,String>{'Accept':'application/json','Content-Type':'application/json',if(auth&&authenticated)'Authorization':'Bearer '+accessToken!,...?headers};
      final uri=Uri.parse(baseUrl+path);
      final request = method == 'POST'
          ? client.post(uri, headers: h, body: body == null ? null : jsonEncode(body))
          : client.get(uri, headers: h);
      r = await request.timeout(const Duration(seconds: 25));
    }catch(_){throw const ApiException('تعذر الاتصال بالخادم. تحقق من عنوان API وتشغيل Backend.');}
    if(r.statusCode==401&&auth&&retry&&refreshToken!=null&&await _refresh())return _send(method,path,body:body,headers:headers,auth:auth,retry:false);
    dynamic d;try{d=r.body.isEmpty?{}:jsonDecode(r.body);}catch(_){d={};}
    if(r.statusCode<200||r.statusCode>=300)throw ApiException(d is Map?(d['message']?.toString()??'فشل الطلب: '+r.statusCode.toString()):'فشل الطلب: '+r.statusCode.toString());
    return d;
  }
}
List<Map<String,dynamic>> rows(dynamic v){
 if(v is List)return v.whereType<Map>().map((e)=>Map<String,dynamic>.from(e)).toList();
 if(v is Map){for(final k in ['data','items','results','orders']){if(v[k] is List)return rows(v[k]);}}
 return [];
}
String money(dynamic v,String c){final n=double.tryParse(v?.toString()??'');return n==null?'— '+c:n.toStringAsFixed(2)+' '+c;}
