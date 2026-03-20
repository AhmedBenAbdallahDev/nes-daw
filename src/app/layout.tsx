import type { Metadata } from 'next';
import { Poppins, Righteous } from 'next/font/google';
import './globals.css';

const bodyFont = Poppins({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const displayFont = Righteous({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NES DAW Extended Suite',
  description:
    'Browser-based NES and modern hybrid DAW with strict APU mode, arrangement sequencing, MIDI import/export, and WAV bounce.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
