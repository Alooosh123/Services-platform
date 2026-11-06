import { NextRequest, NextResponse } from 'next/server';
import { SentEmailRecord } from '@/types';

// In-memory store for sent mail archive
let sentEmailsStore: SentEmailRecord[] = [];

export async function GET() {
  return NextResponse.json({
    success: true,
    count: sentEmailsStore.length,
    sentEmails: sentEmailsStore,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, cc = [], subject, templateId, senderEmail, senderName, htmlContent } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'Recipients and subject are required' }, { status: 400 });
    }

    const record: SentEmailRecord = {
      id: `sent_${Date.now()}`,
      sentAt: new Date().toISOString(),
      to: Array.isArray(to) ? to : [to],
      cc: Array.isArray(cc) ? cc : [],
      subject,
      templateId,
      senderEmail: senderEmail || 'system@company.com',
      senderName: senderName || 'إدارة النظام',
      htmlContent,
      status: 'delivered',
    };

    sentEmailsStore.unshift(record);

    return NextResponse.json({
      success: true,
      message: 'تم إرسال الإيميل بنجاح وتسجيله في سجل المراسلات المعتمدة',
      record,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Send email failed' }, { status: 500 });
  }
}
