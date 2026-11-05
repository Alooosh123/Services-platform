import { BadRequestException } from '@nestjs/common';

export interface YemeniPhoneInfo {
  raw: string;
  normalizedE164: string; // e.g. +967770123456
  localNumber: string;    // e.g. 770123456
  carrier: string;        // Yemen Mobile, Sabafon, YOU, Y Telecom
  carrierAr: string;      // يمن موبايل، سبأفون، يو، شركة واي
  isValid: boolean;
}

export class PhoneNormalizer {
  /**
   * Validates and normalizes Yemeni mobile phone numbers to E.164 (+9677XXXXXXXX).
   */
  static normalizeYemeniPhone(rawPhone: string): YemeniPhoneInfo {
    if (!rawPhone || typeof rawPhone !== 'string') {
      throw new BadRequestException('رقم الهاتف مطلوب');
    }

    // Strip spaces, dashes, parentheses, plus signs
    let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');

    // Convert Arabic/Indic digits to standard digits
    cleaned = cleaned.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

    // Normalize international prefix (00967 or +967 or 967)
    if (cleaned.startsWith('+967')) {
      cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith('00967')) {
      cleaned = cleaned.slice(5);
    } else if (cleaned.startsWith('967')) {
      cleaned = cleaned.slice(3);
    }

    // Remove leading zero if entered locally (e.g., 0770123456 -> 770123456)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    // Must be exactly 9 digits
    if (!/^\d{9}$/.test(cleaned)) {
      throw new BadRequestException(
        `رقم الهاتف غير صحيح (${rawPhone}). يجب أن يتكون الرقم اليمني من 9 أرقام تبدأ بـ 7 (مثال: 770123456 أو 730123456).`,
      );
    }

    // Determine Yemeni Mobile Carrier by 2-digit prefix
    const prefix = cleaned.substring(0, 2);
    let carrier = 'Unknown Yemeni Carrier';
    let carrierAr = 'شبكة يمنية غير معروفة';

    switch (prefix) {
      case '77':
      case '78':
        carrier = 'Yemen Mobile';
        carrierAr = 'يمن موبايل (CDMA/LTE)';
        break;
      case '71':
        carrier = 'Sabafon';
        carrierAr = 'سبأفون (GSM)';
        break;
      case '73':
        carrier = 'YOU Telecom (MTN)';
        carrierAr = 'يو - إم تي إن سابقاً (GSM)';
        break;
      case '70':
        carrier = 'Y Telecom';
        carrierAr = 'شركة واي للاتصالات';
        break;
      default:
        throw new BadRequestException(
          `بادئة الرقم (${prefix}) غير معتمدة لدى مشغلي الهاتف النقال في اليمن (المعتمد: 77, 78, 71, 73, 70).`,
        );
    }

    const normalizedE164 = `+967${cleaned}`;

    return {
      raw: rawPhone,
      normalizedE164,
      localNumber: cleaned,
      carrier,
      carrierAr,
      isValid: true,
    };
  }
}
