import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'استوديو نماذج المراسلات الرسمية للفريق | Services Platform Email Forms',
  description: 'نظام توليد وإرسال الإيميلات الرسمية لأعضاء الفريق مع الاختيار التلقائي للقوالب والمعاينة المباشرة وتخصيص الهوية البصرية',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
