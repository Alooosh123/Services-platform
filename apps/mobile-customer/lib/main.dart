import 'package:flutter/material.dart';

void main() {
  runApp(const DigitalTopupApp());
}

class DigitalTopupApp extends StatelessWidget {
  const DigitalTopupApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'منصة الشحن الرقمي والخدمات',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF090D16),
        primaryColor: const Color(0xFF6366F1),
        fontFamily: 'Roboto',
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF6366F1),
          secondary: Color(0xFF10B981),
          surface: Color(0xFF111827),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0B0F19),
          elevation: 0,
        ),
      ),
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        );
      },
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    HomeScreen(),
    OrdersScreen(),
    WalletScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        backgroundColor: const Color(0xFF0B0F19),
        selectedItemColor: const Color(0xFF6366F1),
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.sports_esports),
            label: 'متجر الألعاب',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long),
            label: 'طلباتي',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.account_balance_wallet),
            label: 'المحفظة',
          ),
        ],
      ),
    );
  }
}

// 1. Home / Storefront Screen in Arabic
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  final List<Map<String, dynamic>> games = const [
    {
      'name': 'ببجي موبايل',
      'subTitle': 'PUBG Mobile UC',
      'slug': 'pubg-mobile',
      'price': 'يبدأ من \$1.05',
      'icon': Icons.sports_esports,
      'color': Color(0xFFF59E0B),
    },
    {
      'name': 'فري فاير',
      'subTitle': 'Free Fire Diamonds',
      'slug': 'free-fire',
      'price': 'يبدأ من \$1.10',
      'icon': Icons.local_fire_department,
      'color': Color(0xFFEF4444),
    },
    {
      'name': 'موبايل ليجندز',
      'subTitle': 'Mobile Legends',
      'slug': 'mobile-legends',
      'price': 'يبدأ من \$1.49',
      'icon': Icons.shield,
      'color': Color(0xFF3B82F6),
    },
    {
      'name': 'جوجل بلاي (أمريكي)',
      'subTitle': 'Google Play US',
      'slug': 'google-play-us',
      'price': 'يبدأ من \$10.25',
      'icon': Icons.credit_card,
      'color': Color(0xFF10B981),
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'متجر توب آب الرقمي',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(left: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white12),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: Color(0xFFFBBF24)),
                SizedBox(width: 6),
                Text('نسخة تجريبية', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFFFBBF24))),
              ],
            ),
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF78350F).withOpacity(0.22),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.55)),
              ),
              child: const Text(
                'نسخة واجهة تجريبية غير مرتبطة بالخادم. الأسعار والبيانات المعروضة أمثلة فقط، ولا يمكن تنفيذ الشحن أو الخصم حالياً.',
                style: TextStyle(color: Color(0xFFFBBF24), fontSize: 12, height: 1.5),
              ),
            ),
            // Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF312E81), Color(0xFF1E1B4B)],
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.3)),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '⚡ تسليم فوري ومباشر',
                    style: TextStyle(color: Color(0xFF818CF8), fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'شحن الحساب عبر ID اللاعب',
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'شدات ببجي، جواهر فري فاير، وبطاقات الهدايا على مدار 24 ساعة.',
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'أشهر الألعاب والخدمات المدعومة',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            // Grid of games
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: games.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.95,
              ),
              itemBuilder: (context, index) {
                final game = games[index];
                return InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => DynamicTopupScreen(game: game),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF111827),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        CircleAvatar(
                          backgroundColor: (game['color'] as Color).withOpacity(0.15),
                          child: Icon(game['icon'] as IconData, color: game['color'] as Color),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              game['name'] as String,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                            ),
                            Text(
                              game['subTitle'] as String,
                              style: const TextStyle(fontSize: 11, color: Colors.grey),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              game['price'] as String,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF10B981)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

// 2. Dynamic Topup Screen in Arabic
class DynamicTopupScreen extends StatefulWidget {
  final Map<String, dynamic> game;
  const DynamicTopupScreen({super.key, required this.game});

  @override
  State<DynamicTopupScreen> createState() => _DynamicTopupScreenState();
}

class _DynamicTopupScreenState extends State<DynamicTopupScreen> {
  final TextEditingController _playerIdCtrl = TextEditingController();
  final TextEditingController _zoneIdCtrl = TextEditingController();
  int _selectedPackageIndex = 0;
  bool _isFulfilling = false;

  final List<Map<String, String>> _packages = [
    {'name': '60 شدة / جوهرة', 'price': '\$1.05'},
    {'name': '325 شدة / جوهرة', 'price': '\$5.25'},
    {'name': '660 شدة / جوهرة', 'price': '\$10.49'},
    {'name': '1800 شدة / جوهرة', 'price': '\$25.99'},
  ];

  @override
  Widget build(BuildContext context) {
    final isMlbb = widget.game['slug'] == 'mobile-legends';

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.game['name'] as String),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // STEP 1: Dynamic player fields
            const Text(
              '1. بيانات حساب اللاعب داخل اللعبة',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _playerIdCtrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF111827),
                labelText: 'معرف اللاعب (Player ID)',
                hintText: 'مثال: 512345678',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            if (isMlbb) ...[
              const SizedBox(height: 10),
              TextField(
                controller: _zoneIdCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFF111827),
                  labelText: 'رمز النطاق والسيرفر (Zone ID)',
                  hintText: 'مثال: 2001',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                OutlinedButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('التحقق من اسم اللاعب غير متاح بعد: لم يتم ربط التطبيق بواجهة مزود الخدمة.'),
                      ),
                    );
                  },
                  child: const Text('التحقق الحي غير متاح'),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // STEP 2: Package selector
            const Text(
              '2. اختر الباقة المطلوبة',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
            ),
            const SizedBox(height: 8),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _packages.length,
              itemBuilder: (context, i) {
                final isSelected = _selectedPackageIndex == i;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: isSelected ? const Color(0xFF6366F1) : Colors.white10),
                    ),
                    tileColor: isSelected ? const Color(0xFF6366F1).withOpacity(0.15) : const Color(0xFF111827),
                    leading: Icon(
                      isSelected ? Icons.check_circle : Icons.circle_outlined,
                      color: isSelected ? const Color(0xFF6366F1) : Colors.grey,
                    ),
                    title: Text(_packages[i]['name']!, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    trailing: Text(
                      _packages[i]['price']!,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981), fontSize: 14),
                    ),
                    onTap: () => setState(() => _selectedPackageIndex = i),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),

            // Checkout CTA Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _isFulfilling
                    ? null
                    : () {
                        if (_playerIdCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('يرجى إدخال معرف اللاعب أولاً')),
                          );
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('لم يتم إرسال الطلب: التطبيق غير متصل بالخادم. لم يحدث أي خصم أو شحن.'),
                          ),
                        );
                      },
                child: Text(
                  'طلب تجريبي — لن يتم تنفيذه',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// 3. Orders Screen in Arabic
class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('سجل طلباتي')),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'سجل الطلبات غير متاح بعد. سيظهر هنا فقط بعد ربط التطبيق بواجهة الخادم.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, height: 1.6),
          ),
        ),
      ),
    );
  }
}

// 4. Wallet Screen in Arabic
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('المحفظة والسجل المالي')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF312E81), Color(0xFF1E1B4B)]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                children: [
                  Text('رصيد المحفظة', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  SizedBox(height: 8),
                  Text('غير متاح', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 30, fontWeight: FontWeight.bold)),
                  SizedBox(height: 8),
                  Text('لم يتم تحميل رصيد حقيقي: التطبيق غير متصل بالخادم.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
