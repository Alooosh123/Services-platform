import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { ThemeToggle } from '../components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Digital TopUp SaaS',
  description: 'SaaS platform overview for the Digital TopUp & Services Platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ede7da',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>
        <ThemeToggle className="asaas-theme-toggle--floating" />
        {children}
      </body>
    </html>
  );
}
