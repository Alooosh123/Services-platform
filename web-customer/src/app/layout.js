import './globals.css';

export const metadata = {
  title: 'توب آب ستور | متجر الشحن والخدمات الرقمية للألعاب والاتصالات',
  description: 'شحن ألعاب ببجي وفري فاير، باقات يمن موبايل وسبأفون ويو، بطاقات رقمية وتسديد إنترنت فوري بأفضل الأسعار وبأمان تام',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0B0F19] text-slate-100 min-h-screen selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
