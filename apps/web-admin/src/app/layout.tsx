import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Sidebar } from '../components/Sidebar';

export const metadata: Metadata = {
  title: 'لوحة التحكم المركزية - إدارة منصة الشحن الرقمي',
  description: 'نظام إدارة شامل لمنصة الشحن الرقمي والخدمات',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ede7da',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <Sidebar />
        <div className="pr-64 flex flex-col min-h-screen">
          <main className="flex-1 bg-slate-950">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
