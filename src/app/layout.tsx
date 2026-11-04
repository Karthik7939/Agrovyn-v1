import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AGROVYN: Smart Adaptive Greenhouse Dashboard',
  description: 'AI/ML-Driven Predictive Microclimate & Precision Irrigation Control Using PDLC Glazing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen font-sans antialiased selection:bg-emerald-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
