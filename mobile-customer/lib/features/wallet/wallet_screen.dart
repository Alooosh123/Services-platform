import 'package:flutter/material.dart';
import '../../core/thermal_printer_service.dart';
import '../../core/receipt_generator_service.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final ThermalPrinterService _printerService = ThermalPrinterService();
  double _yerBalance = 154000.0;
  double _usdBalance = 240.50;
  bool _hideResellerMargin = true;

  void _showTransferDialog() {
    final TextEditingController receiverController = TextEditingController();
    final TextEditingController amountController = TextEditingController();
    final TextEditingController pinController = TextEditingController();
    String currency = 'YER';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF111827),
          title: const Text('تحويل رصيد فوري (قيد مزدوج)', style: TextStyle(color: Colors.white, fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: receiverController,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'معرف المستلم أو رقم هاتفه',
                  labelStyle: TextStyle(color: Colors.white60, fontSize: 12),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: amountController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontFamily: 'monospace'),
                      decoration: const InputDecoration(
                        labelText: 'المبلغ',
                        labelStyle: TextStyle(color: Colors.white60, fontSize: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  DropdownButton<String>(
                    value: currency,
                    dropdownColor: const Color(0xFF1F2937),
                    style: const TextStyle(color: Colors.emerald, fontWeight: FontWeight.bold),
                    items: const [
                      DropdownMenuItem(value: 'YER', child: Text('YER')),
                      DropdownMenuItem(value: 'USD', child: Text('USD')),
                      DropdownMenuItem(value: 'SAR', child: Text('SAR')),
                    ],
                    onChanged: (val) {
                      if (val != null) setDialogState(() => currency = val);
                    },
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: pinController,
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                style: const TextStyle(color: Colors.amber, fontSize: 16, letterSpacing: 4, fontFamily: 'monospace'),
                decoration: const InputDecoration(
                  labelText: 'رمز العمليات المالية (PIN)',
                  labelStyle: TextStyle(color: Colors.white60, fontSize: 12),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('إلغاء', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.emerald),
              onPressed: () {
                final amt = double.tryParse(amountController.text) ?? 0;
                if (amt <= 0 || pinController.text.length < 4) {
                  return;
                }
                Navigator.pop(ctx);
                setState(() {
                  _yerBalance -= amt;
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('تم تحويل $amt $currency بنجاح بالقيد المزدوج الذري ⚡')),
                );
              },
              child: const Text('تأكيد التحويل', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  void _showPrintDialog() async {
    final printers = await _printerService.scanBluetoothPrinters();

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF111827),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Row(
              children: [
                Icon(Icons.print, color: Colors.amber),
                SizedBox(width: 8),
                Text('طباعة إيصال الشحن عبر البلوتوث (POS Printer)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
            const SizedBox(height: 16),
            ...printers.map(
              (p) => ListTile(
                leading: const Icon(Icons.bluetooth, color: Colors.indigoAccent),
                title: Text(p['name']!, style: const TextStyle(color: Colors.white, fontSize: 13)),
                subtitle: Text(p['address']!, style: const TextStyle(color: Colors.white54, fontSize: 11)),
                trailing: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, foregroundColor: Colors.black),
                  onPressed: () async {
                    await _printerService.connectPrinter(p['address']!, p['name']!);
                    await _printerService.printVoucherReceipt(
                      storeName: 'متجر الشحن الرقمي',
                      serviceName: 'PUBG Mobile',
                      productName: '60 UC Voucher',
                      voucherPin: 'PUBG-8877-6655-4433',
                      serialNumber: 'SN-9988112233',
                      customerPrice: 1200.0,
                      currency: 'YER',
                      orderNumber: 'ORD-998811',
                    );
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('تمت الطباعة الحرارية بنجاح على ورق 58mm ✅')),
                    );
                  },
                  child: const Text('اتصال وطباعة', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _shareReceiptWhatsApp() {
    final receipt = ReceiptData(
      orderNumber: 'TX-778899',
      serviceName: 'شدات ببجي موبايل PUBG UC',
      productName: '60 شدة UC فوري',
      targetAccount: '5123456789 (Player Name: HawkEye)',
      wholesaleCost: 950.0,
      customerPrice: 1200.0,
      currency: 'YER',
      voucherCode: 'PUBG-UC-9988-7766-5544',
      timestamp: DateTime.now(),
      hideAgentMargin: _hideResellerMargin,
    );

    final text = WhatsAppReceiptGenerator.generateWhatsAppText(receipt);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF111827),
        title: const Text('معاينة إيصال الواتساب للعميل', style: TextStyle(color: Colors.white, fontSize: 15)),
        content: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(10)),
          child: SingleChildScrollView(
            child: Text(text, style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.5)),
          ),
        ),
        actions: [
          Row(
            children: [
              Checkbox(
                value: _hideResellerMargin,
                onChanged: (val) {
                  setState(() => _hideResellerMargin = val ?? true);
                  Navigator.pop(ctx);
                  _shareReceiptWhatsApp();
                },
              ),
              const Text('إخفاء عمولة الوكيل', style: TextStyle(color: Colors.white70, fontSize: 11)),
            ],
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('تم نسخ نص الإيصال ومشاركته للواتساب 📲')),
              );
            },
            icon: const Icon(Icons.share, size: 16, color: Colors.white),
            label: const Text('إرسال عبر واتساب', style: TextStyle(color: Colors.white, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('المحفظة المالية والطباعة الحرارية', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Balances
            Card(
              color: const Color(0xFF111827),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('الرصيد المتاح (ريال يمني):', style: TextStyle(color: Colors.white70, fontSize: 13)),
                        Text('${_yerBalance.toStringAsFixed(0)} YER', style: const TextStyle(color: Colors.emerald, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                      ],
                    ),
                    const Divider(color: Colors.white12, height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('الرصيد المتاح (دولار أمريكي):', style: TextStyle(color: Colors.white70, fontSize: 13)),
                        Text('\$${_usdBalance.toStringAsFixed(2)} USD', style: const TextStyle(color: Colors.indigoAccent, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // POS Actions Grid
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _showTransferDialog,
                    icon: const Icon(Icons.swap_horiz),
                    label: const Text('تحويل رصيد لفرع'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber.shade700,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _showPrintDialog,
                    icon: const Icon(Icons.print),
                    label: const Text('طباعة حرارية POS'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF25D366),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _shareReceiptWhatsApp,
              icon: const Icon(Icons.share),
              label: const Text('توليد ومشاركة إيصال واتساب (مع إخفاء العمولة)'),
            ),
          ],
        ),
      ),
    );
  }
}
