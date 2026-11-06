import { BrandIdentity, EmailDraft, UrgencyLevel } from '../types';
import { TEMPLATES } from './constants';

export function getUrgencyBadge(urgency: UrgencyLevel): { label: string; bg: string; color: string; border: string } {
  switch (urgency) {
    case 'urgent':
      return {
        label: 'عاجل جداً ومهم (Urgent)',
        bg: '#FEE2E2',
        color: '#991B1B',
        border: '#F87171',
      };
    case 'important':
      return {
        label: 'هام وأولوية (Priority)',
        bg: '#FEF3C7',
        color: '#92400E',
        border: '#FCD34D',
      };
    case 'normal':
    default:
      return {
        label: 'عادي / روتيني (Standard)',
        bg: '#F1F5F9',
        color: '#475569',
        border: '#CBD5E1',
      };
  }
}

export function generateEmailHtml(draft: EmailDraft, brand: BrandIdentity): string {
  const template = TEMPLATES[draft.templateId] || TEMPLATES.memo;
  const urgency = getUrgencyBadge(draft.urgency);
  const primaryColor = brand.primaryColor || '#1E3A8A';
  const secondaryColor = brand.secondaryColor || '#0284C7';
  const accentColor = brand.accentColor || '#D97706';

  const bulletListHtml =
    draft.bulletPoints && draft.bulletPoints.length > 0
      ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; border-collapse: separate; border-spacing: 0;">
      <tbody>
        ${draft.bulletPoints
          .map(
            (point, idx) => `
          <tr>
            <td style="width: 28px; vertical-align: top; padding: 6px 0 6px 10px;">
              <span style="display: inline-block; width: 22px; height: 22px; line-height: 22px; background-color: ${primaryColor}15; color: ${primaryColor}; font-weight: bold; font-size: 12px; text-align: center; border-radius: 50%; border: 1px solid ${primaryColor}30;">
                ${idx + 1}
              </span>
            </td>
            <td style="padding: 6px 0; font-size: 14px; line-height: 1.7; color: #334155;">
              ${escapeHtml(point)}
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `
      : '';

  const actionBlockHtml = draft.callToAction?.text
    ? `
    <div style="margin: 25px 0; padding: 18px 20px; background-color: #F8FAFC; border-right: 4px solid ${accentColor}; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
      <div style="font-size: 13px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; margin-bottom: 6px;">
        📌 الإجراء أو المخرجات المطلوبة (Call to Action):
      </div>
      <div style="font-size: 14px; color: #1E293B; line-height: 1.6; font-weight: 500;">
        ${escapeHtml(draft.callToAction.text)}
      </div>
      ${
        draft.callToAction.deadline
          ? `
        <div style="margin-top: 8px; font-size: 12px; color: #64748B;">
          ⏳ <strong>الموعد النهائي:</strong> ${escapeHtml(draft.callToAction.deadline)}
        </div>
      `
          : ''
      }
      ${
        draft.callToAction.buttonLabel
          ? `
        <div style="margin-top: 15px; text-align: right;">
          <a href="${escapeHtml(draft.callToAction.buttonUrl || '#')}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 10px 24px; border-radius: 6px; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
            ${escapeHtml(draft.callToAction.buttonLabel)} &larr;
          </a>
        </div>
      `
          : ''
      }
    </div>
  `
    : '';

  const attachmentsHtml =
    draft.attachments && draft.attachments.length > 0
      ? `
    <div style="margin: 20px 0; padding: 14px; background: #F1F5F9; border-radius: 6px; border: 1px dashed #CBD5E1;">
      <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px;">
        📎 المرفقات الرسمية (${draft.attachments.length}):
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${draft.attachments
          .map(
            (att) => `
          <span style="display: inline-block; padding: 5px 12px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 4px; font-size: 12px; color: #334155; margin-left: 8px; margin-bottom: 4px;">
            📄 <strong>${escapeHtml(att.name)}</strong> (${escapeHtml(att.size)})
          </span>
        `
          )
          .join('')}
      </div>
    </div>
  `
      : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(draft.subject)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap');
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      font-family: '${brand.fontFamily || 'Cairo'}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #F8FAFC;
      color: #1E293B;
      direction: rtl;
      text-align: right;
    }
  </style>
</head>
<body style="margin:0; padding: 24px 10px; background-color: #F8FAFC; direction: rtl; text-align: right; font-family: '${brand.fontFamily || 'Cairo'}', Tahoma, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #E2E8F0;">
    
    <!-- Top Branding Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 26px 30px; color: #FFFFFF;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  ${
                    brand.logoUrl
                      ? `
                    <td style="padding-left: 16px; vertical-align: middle;">
                      <img src="${escapeHtml(brand.logoUrl)}" alt="Logo" width="48" height="48" style="display: block; border-radius: 8px; background: rgba(255,255,255,0.15); padding: 4px; object-fit: contain;" />
                    </td>
                  `
                      : ''
                  }
                  <td style="vertical-align: middle;">
                    <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.3px; color: #FFFFFF; line-height: 1.2;">
                      ${escapeHtml(brand.companyName)}
                    </div>
                    <div style="font-size: 12px; color: rgba(255, 255, 255, 0.85); margin-top: 3px; font-weight: 400;">
                      ${escapeHtml(brand.companySubtitle)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align: left; vertical-align: middle;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.3); padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #FFFFFF; backdrop-filter: blur(4px);">
                ${escapeHtml(template.badge)}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Reference Metadata Bar -->
    <tr>
      <td style="background-color: #F8FAFC; padding: 12px 30px; border-bottom: 1px solid #E2E8F0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="font-size: 12px; color: #64748B;">
              <strong>الرقم المرجعي:</strong> <span style="font-family: monospace; color: #0F172A; font-weight: 600;">${escapeHtml(draft.referenceNumber || 'REF-OFFICIAL')}</span>
              &nbsp;&bull;&nbsp;
              <strong>التاريخ:</strong> <span style="color: #0F172A;">${escapeHtml(draft.date || new Date().toLocaleDateString('ar-EG'))}</span>
            </td>
            <td style="text-align: left;">
              <span style="display: inline-block; background-color: ${urgency.bg}; color: ${urgency.color}; border: 1px solid ${urgency.border}; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">
                ${urgency.label}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Email Body Area -->
    <tr>
      <td style="padding: 32px 30px; background-color: #FFFFFF;">

        <!-- Recipients Header Box -->
        <div style="margin-bottom: 24px; padding: 14px 18px; background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; font-size: 13px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 3px 0; color: #64748B; width: 70px;"><strong>إلى (To):</strong></td>
              <td style="padding: 3px 0; color: #0F172A; font-weight: 600;">
                ${escapeHtml(draft.to && draft.to.length > 0 ? draft.to.join(', ') : 'أعضاء الفريق المعنيين')}
              </td>
            </tr>
            ${
              draft.cc && draft.cc.length > 0
                ? `
            <tr>
              <td style="padding: 3px 0; color: #64748B;"><strong>نسخة (CC):</strong></td>
              <td style="padding: 3px 0; color: #475569;">
                ${escapeHtml(draft.cc.join(', '))}
              </td>
            </tr>
            `
                : ''
            }
            <tr>
              <td style="padding: 3px 0; color: #64748B;"><strong>الموضوع:</strong></td>
              <td style="padding: 3px 0; color: ${primaryColor}; font-weight: 700; font-size: 14px;">
                ${escapeHtml(draft.subject)}
              </td>
            </tr>
          </table>
        </div>

        <!-- Greeting -->
        <div style="font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 16px;">
          ${escapeHtml(draft.greeting || template.defaultGreeting)}
        </div>

        <!-- Intro -->
        ${
          draft.intro
            ? `
          <div style="font-size: 14px; line-height: 1.8; color: #334155; margin-bottom: 16px; text-align: justify;">
            ${escapeHtml(draft.intro)}
          </div>
        `
            : ''
        }

        <!-- Main Body -->
        ${
          draft.mainContent
            ? `
          <div style="font-size: 14px; line-height: 1.8; color: #334155; margin-bottom: 16px; text-align: justify; white-space: pre-line;">
            ${escapeHtml(draft.mainContent)}
          </div>
        `
            : ''
        }

        <!-- Bullet Points -->
        ${bulletListHtml}

        <!-- Call to Action Box -->
        ${actionBlockHtml}

        <!-- Attachments -->
        ${attachmentsHtml}

        <!-- Formal Closing -->
        <div style="margin-top: 28px; font-size: 14px; color: #475569; font-weight: 600;">
          ${escapeHtml(draft.closing || template.defaultClosing)}
        </div>

        <!-- Official Signature Card -->
        <div style="margin-top: 24px; padding-top: 20px; border-top: 2px dashed #E2E8F0;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 15px; font-weight: 800; color: #0F172A;">
                  ${escapeHtml(draft.sender?.name || 'مرسل الرسالة')}
                </div>
                <div style="font-size: 13px; color: ${primaryColor}; font-weight: 600; margin-top: 2px;">
                  ${escapeHtml(draft.sender?.role || 'مسؤول إداري')} &bull; ${escapeHtml(draft.sender?.department || 'إدارة المنصة')}
                </div>
                <div style="font-size: 12px; color: #64748B; margin-top: 4px;">
                  📧 ${escapeHtml(draft.sender?.email || brand.supportEmail)}
                  ${draft.sender?.phone ? ` &bull; 📱 ${escapeHtml(draft.sender.phone)}` : ''}
                </div>
              </td>
              ${
                brand.officialStamp
                  ? `
                <td style="text-align: left; vertical-align: middle;">
                  <div style="display: inline-block; border: 2px solid ${primaryColor}40; padding: 6px 14px; border-radius: 6px; text-align: center; background: ${primaryColor}08;">
                    <div style="font-size: 10px; color: ${primaryColor}; font-weight: 800; text-transform: uppercase;">معتمد وموثق</div>
                    <div style="font-size: 11px; font-weight: 700; color: #0F172A; font-family: monospace;">${escapeHtml(draft.referenceNumber || 'VERIFIED')}</div>
                  </div>
                </td>
              `
                  : ''
              }
            </tr>
          </table>
        </div>

      </td>
    </tr>

    <!-- Footer Notice -->
    <tr>
      <td style="background-color: #0F172A; color: #94A3B8; padding: 22px 30px; font-size: 11px; line-height: 1.6; text-align: center;">
        <div style="font-weight: 600; color: #CBD5E1; margin-bottom: 6px;">
          ${escapeHtml(brand.companyName)} - ${escapeHtml(brand.officeAddress || 'المقر الرئيسي')}
        </div>
        <div style="color: #64748B; max-width: 540px; margin: 0 auto;">
          ${escapeHtml(brand.footerLegalNotice)}
        </div>
        <div style="margin-top: 10px; font-size: 10px; color: #475569;">
          تم إنشاء وتنسيق هذه الرسالة عبر نظام نماذج المراسلات الداخلية الرسمية &bull; ${brand.website}
        </div>
      </td>
    </tr>

  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
