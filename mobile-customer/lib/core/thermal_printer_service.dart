import 'dart:typed_data';
import 'package:flutter/material.dart';

enum PaperSize { mm58, mm80 }

class ThermalPrinterService {
  static final ThermalPrinterService _instance = ThermalPrinterService._internal();
  factory ThermalPrinterService() => _instance;
  ThermalPrinterService._internal();

  bool isConnected = false;
  String? connectedDeviceName;

  /// Simulates / scans for nearby Bluetooth ESC/POS printers
  Future<List<Map<String, String>>> scanBluetoothPrinters() async {
    await Future.delayed(const Duration(milliseconds: 600));
    return [
      {'name': 'POS-58-BT (طابعة فواتير 58mm)', 'address': '66:22:33:44:55:66'},
      {'name': 'Xprinter-80 (طابعة كروت 80mm)', 'address': 'AA:BB:CC:DD:EE:FF'},
    ];
  }

  /// Connects to selected Bluetooth printer
  Future<bool> connectPrinter(String address, String name) async {
    await Future.delayed(const Duration(milliseconds: 800));
    isConnected = true;
    connectedDeviceName = name;
    return true;
  }

  /// Formats and prints an instant recharge voucher receipt on 58mm / 80mm roll
  Future<bool> printVoucherReceipt({
    required String storeName,
    required String serviceName,
    required String productName,
    required String voucherPin,
    required String serialNumber,
    required double customerPrice,
    required String currency,
    required String orderNumber,
    PaperSize paperSize = PaperSize.mm58,
  }) async {
    if (!isConnected) {
      throw Exception('يرجى الاتصال بطابعة البلوتوث أولاً.');
    }

    // ESC/POS Command stream simulation
    debugPrint('================ ESC/POS PRINT JOB ===============');
    debugPrint('STORE: $storeName');
    debugPrint('SERVICE: $serviceName - $productName');
    debugPrint('ORDER NO: $orderNumber');
    debugPrint('PRICE: $customerPrice $currency');
    debugPrint('--------------------------------------------------');
    debugPrint('CARD PIN: $voucherPin');
    debugPrint('SERIAL: $serialNumber');
    debugPrint('DATE: ${DateTime.now().toIso8601String()}');
    debugPrint('==================================================');

    await Future.delayed(const Duration(milliseconds: 1000));
    return true;
  }
}
