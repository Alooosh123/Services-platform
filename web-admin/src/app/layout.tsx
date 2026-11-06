import React from 'react';
import './globals.css';
import { Sidebar } from '../components/Sidebar';

export const metadata = {
  title: 'لوحة التحكم المركزية | منصة الشحن الرقمي',
  description: 'إدارة المزودين والمحافظ والطلبات والعمليات المالية',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <Sidebar />
        <main className="mr-64 p-6 min-h-screen bg-slate-950">
          {children}
        </main>
      </body>
    </html>
  );
}

