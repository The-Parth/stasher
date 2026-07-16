import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Stasher',
  description: 'Private, encrypted link repository.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var theme = localStorage.getItem('stasher_theme');
            if (theme) {
              var t = JSON.parse(theme);
              document.documentElement.style.setProperty('--theme-h', t.h);
              document.documentElement.style.setProperty('--theme-s', t.s + '%');
            }
          } catch (e) {}
        `}} />
      </head>
      <body className={inter.className}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
