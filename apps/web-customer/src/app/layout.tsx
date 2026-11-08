import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'متجر الشحن الرقمي - شحن فوري للألعاب وبطاقات الهدايا',
  description: 'شحن فوري ومباشر لشدات ببجي موبايل، جواهر فري فاير، ماسات موبايل ليجندز، وبطاقات جوجل بلاي وأبل',
  manifest: '/manifest.json',
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
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
