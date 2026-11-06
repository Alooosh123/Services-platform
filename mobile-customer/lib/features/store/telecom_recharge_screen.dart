import 'package:flutter/material.dart';

class TelecomRechargeScreen extends StatefulWidget {
  const TelecomRechargeScreen({super.key});

  @override
  State<TelecomRechargeScreen> createState() => _TelecomRechargeScreenState();
}

class _TelecomRechargeScreenState extends State<TelecomRechargeScreen> {
  final TextEditingController _phoneController = TextEditingController();
  String _detectedOperator = 'يرجى إدخال الرقم للكشف التلقائي';
  Color _operatorColor = Colors.grey;
  bool _isInquiring = false;
  Map<String, dynamic>? _inquiryResult;

  void _onPhoneChanged(String value) {
    final clean = value.replaceAll(RegExp(r'[\s\-]'), '');
    setState(() {
      if (clean.startsWith('77')) {
        _detectedOperator = 'يمن موبايل (Yemen Mobile)';
        _operatorColor = const Color(0xFFDC2626);
      } else if (clean.startsWith('73')) {
        _detectedOperator = 'يو - إم تي إن سابقاً (YOU Telecom)';
        _operatorColor = const Color(0xFFEAB308);
      } else if (clean.startsWith('71')) {
        _detectedOperator = 'سبأفون (Sabafon)';
        _operatorColor = const Color(0xFF2563EB);
      } else if (clean.startsWith('78')) {
        _detectedOperator = 'واي للاتصالات (Y Telecom)';
        _operatorColor = const Color(0xFF0D9488);
      } else if (clean.startsWith('01') || clean.startsWith('10')) {
        _detectedOperator = 'يمن نت ADSL / الفايبر المنزلي';
        _operatorColor = const Color(0xFF9333EA);
      } else {
        _detectedOperator = 'شركة اتصالات غير معروفة';
        _operatorColor = Colors.grey;
      }
    });
  }

  Future<void> _inquireSubscriber() async {
    final phone = _phoneController.text.trim();
    if (phone.length < 6) return;

    setState(() => _isInquiring = true);
    await Future.delayed(const Duration(milliseconds: 700));

    setState(() {
      _isInquiring = false;
      _inquiryResult = {
        'subscriberName': 'مشترك $_detectedOperator (${phone.substring(phone.length - 4)})',
        'lineType': phone.endsWith('0') ? 'مفوتر (فاتورة شهرية)' : 'دفع مسبق (رصيد)',
        'dueAmount': phone.endsWith('0') ? '3,500 ر.ي' : '0.00 ر.ي',
        'currentBalance': phone.endsWith('0') ? '0 ر.ي' : '450 ر.ي',
        'packages': [
          {'name': 'باقة مزايا أسبوعية (مكالمات + نت)', 'price': '1000 ر.ي'},
          {'name': 'باقة مزايا ماكس الشهرية 3500 ر.ي', 'price': '3500 ر.ي'},
          {'name': 'باقة فورجي 12 جيجابايت 4G', 'price': '4200 ر.ي'},
        ]
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('تسديد فواتير وباقات الاتصالات والإنترنت', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Phone input box
            Card(
              color: const Color(0xFF111827),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('رقم الهاتف أو رقم خط الإنترنت', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _phoneController,
                      onChanged: _onPhoneChanged,
                      keyboardType: TextInputType.phone,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontFamily: 'monospace'),
                      decoration: InputDecoration(
                        hintText: '77XXXXXXX أو 01XXXXX',
                        hintStyle: const TextStyle(color: Colors.white30),
                        filled: true,
                        fillColor: const Color(0xFF1F2937),
                        prefixIcon: const Icon(Icons.phone_android, color: Colors.indigoAccent),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.contacts, color: Colors.amber),
                          tooltip: 'اختيار من جهات الاتصال',
                          onPressed: () {
                            _phoneController.text = '771234567';
                            _onPhoneChanged('771234567');
                          },
                        ),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Detected operator banner
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: _operatorColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: _operatorColor.withOpacity(0.4)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.cell_tower, color: _operatorColor, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _detectedOperator,
                              style: TextStyle(color: _operatorColor, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: _isInquiring ? null : _inquireSubscriber,
                      icon: _isInquiring
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.search),
                      label: const Text('استعلام عن الفاتورة والباقات المؤهلة'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.indigoAccent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            if (_inquiryResult != null) ...[
              const SizedBox(height: 16),
              Card(
                color: const Color(0xFF111827),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('نتيجة الاستعلام الفوري', style: TextStyle(color: Colors.emerald, fontSize: 14, fontWeight: FontWeight.bold)),
                      const Divider(color: Colors.white12, height: 20),
                      Text('👤 المشترك: ${_inquiryResult!['subscriberName']}', style: const TextStyle(color: Colors.white, fontSize: 13)),
                      const SizedBox(height: 6),
                      Text('📑 نوع الخط: ${_inquiryResult!['lineType']}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      const SizedBox(height: 6),
                      Text('💰 المديونية المستحقة: ${_inquiryResult!['dueAmount']}', style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 16),
                      const Text('الباقات المتاحة للتفعيل:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 8),
                      ...((_inquiryResult!['packages'] as List).map(
                        (pkg) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(pkg['name'], style: const TextStyle(color: Colors.white, fontSize: 12)),
                          trailing: ElevatedButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('تم إرسال طلب تفعيل ${pkg['name']} بنجاح')),
                              );
                            },
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.emerald, foregroundColor: Colors.white),
                            child: Text(pkg['price'], style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      )),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
