import { BadRequestException } from '@nestjs/common';
import * as net from 'net';

export class SsrfValidator {
  /**
   * Validates target URL against SSRF threats.
   * @param rawUrl The URL to validate.
   * @param enforceAllowlist Whether to strictly check against approved domains.
   */
  static validateUrl(rawUrl: string, enforceAllowlist = false): URL {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new BadRequestException('عنوان المزود غير صالح أو فارغ (Invalid Provider URL)');
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException(`صيغة العنوان غير صالحة: ${rawUrl}`);
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // 1. Enforce HTTPS in production
    if (isProduction && parsed.protocol !== 'https:') {
      throw new BadRequestException('يجب استخدام بروتوكول HTTPS المشفر للاتصال بالمزودين في بيئة الإنتاج');
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException(`بروتوكول غير مدعوم: ${parsed.protocol}`);
    }

    const hostname = parsed.hostname.toLowerCase().trim();

    // 2. Block Localhost
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '0.0.0.0') {
      throw new BadRequestException(`محاولة اتصال محظورة بعنوان محلي: ${hostname} (SSRF Blocked)`);
    }

    // 3. Check IP address restrictions
    if (net.isIP(hostname)) {
      if (this.isPrivateOrRestrictedIp(hostname)) {
        throw new BadRequestException(`محاولة اتصال محظورة بعنوان شبكة داخلية أو بيانات وصفية: ${hostname} (SSRF Blocked)`);
      }
    }

    // 4. Check Allowlist if configured or required
    if (enforceAllowlist) {
      const customDomains = process.env.PROVIDER_ALLOWED_DOMAINS
        ? process.env.PROVIDER_ALLOWED_DOMAINS.split(',').map((d) => d.trim().toLowerCase())
        : [];
      if (customDomains.length === 0) {
        throw new BadRequestException('PROVIDER_ALLOWED_DOMAINS must contain documented provider API hostnames before connecting.');
      }
      const allowed = customDomains;

      const isAllowed = allowed.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );

      if (!isAllowed) {
        throw new BadRequestException(`نطاق المزود "${hostname}" غير مدرج في القائمة البيضاء المعتمدة (SSRF Blocked)`);
      }
    }

    return parsed;
  }

  /**
   * Determines if an IPv4 or IPv6 address is in a private, loopback, or cloud-metadata range.
   */
  static isPrivateOrRestrictedIp(ip: string): boolean {
    // IPv4 checks
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map((p) => parseInt(p, 10));
      if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
        return true;
      }

      // 127.0.0.0/8 - Loopback
      if (parts[0] === 127) return true;

      // 0.0.0.0/8 - Current network
      if (parts[0] === 0) return true;

      // 10.0.0.0/8 - RFC 1918 Private
      if (parts[0] === 10) return true;

      // 172.16.0.0/12 - RFC 1918 Private (172.16.0.0 to 172.31.255.255)
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

      // 192.168.0.0/16 - RFC 1918 Private
      if (parts[0] === 192 && parts[1] === 168) return true;

      // 169.254.0.0/16 - Link-Local / Cloud Instance Metadata (e.g. AWS/GCP 169.254.169.254)
      if (parts[0] === 169 && parts[1] === 254) return true;

      // 100.64.0.0/10 - Carrier Grade NAT
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

      // 224.0.0.0/4 - Multicast
      if (parts[0] >= 224) return true;

      return false;
    }

    // IPv4-mapped IPv6 addresses must receive the same RFC1918 checks as IPv4.
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return this.isPrivateOrRestrictedIp(mapped[1]);

    // IPv6 checks
    if (net.isIPv6(ip)) {
      const cleanIp = ip.toLowerCase();
      // ::1 Loopback
      if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1') return true;
      // Unspecified
      if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') return true;
      // Unique Local Addresses (fc00::/7)
      if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true;
      // Link-local unicast (fe80::/10)
      if (cleanIp.startsWith('fe80')) return true;

      return false;
    }

    return false;
  }
}
