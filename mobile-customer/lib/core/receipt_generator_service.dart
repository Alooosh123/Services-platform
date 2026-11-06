import 'package:flutter/material.dart';

class ReceiptData {
  final String orderNumber;
  final String serviceName;
  final String productName;
  final String targetAccount;
  final double wholesaleCost;
  final double customerPrice;
  final String currency;
  final String? voucherCode;
  final DateTime timestamp;
  final bool hideAgentMargin;

  ReceiptData({
    required this.orderNumber,
    required this.serviceName,
    required this.productName,
    required this.targetAccount,
    required this.wholesaleCost,
    required this.customerPrice,
    required this.currency,
    this.voucherCode,
    required this.timestamp,
    this.hideAgentMargin = true,
  });
}

class WhatsAppReceiptGenerator {
  /// Builds a formatted Arabic WhatsApp message text ready to share with customer
  static String generateWhatsAppText(ReceiptData receipt) {
    final buffer = StringBuffer();
    buffer.writeln('🧾 *إيصال سداد وشحن إلكتروني*');
    buffer.writeln('--------------------------------');
    buffer.writeln('🔹 *الخدمة:* ${receipt.serviceName}');
    buffer.writeln('📦 *الباقة:* ${receipt.productName}');
    buffer.writeln('👤 *رقم المستفيد:* `${receipt.targetAccount}`');
    buffer.writeln('💰 *المبلغ الإجمالي:* ${receipt.customerPrice.toStringAsFixed(2)} ${receipt.currency}');

    if (!receipt.hideAgentMargin) {
      final profit = receipt.customerPrice - receipt.wholesaleCost;
      buffer.writeln('📊 *سعر الجملة:* ${receipt.wholesaleCost.toStringAsFixed(2)} ${receipt.currency}');
      buffer.writeln('📈 *عمولة الوكيل:* ${profit.toStringAsFixed(2)} ${receipt.currency}');
    }

    if (receipt.voucherCode != null && receipt.voucherCode!.isNotEmpty) {
      buffer.writeln('--------------------------------');
      buffer.writeln('🔑 *كود البطاقة الرقمي:*');
      buffer.writeln('`${receipt.voucherCode}`');
    }

    buffer.writeln('--------------------------------');
    buffer.writeln('🔖 *رقم العملية:* #${receipt.orderNumber}');
    buffer.writeln('⏱ *التاريخ والوقت:* ${receipt.timestamp.toLocal().toString().split('.')[0]}');
    buffer.writeln('✅ *الحالة:* تم التنفيذ بنجاح ⚡');
    buffer.writeln('شكراً لتعاملكم معنا 🙏');

    return buffer.toString();
  }
}
