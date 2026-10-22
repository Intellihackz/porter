import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';

const sans = Inter_Tight({ subsets: ['latin'], variable: '--font-sans' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

// link previews need absolute urls. we build them from whatever domain served
// the request, so useporter.lol, porter.pxxlspace.cv or any preview url all
// get working preview images. SITE_URL forces one domain if you ever need it.
export async function generateMetadata() {
  let base = process.env.SITE_URL;
  if (!base) {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
    base = host ? `${proto.split(',')[0]}://${host.split(',')[0]}` : 'https://useporter.lol';
  }
  return {
    metadataBase: new URL(base),
    title: 'porter: reverse engineer php into js',
    description: 'reverse engineer your php app into javascript source. runs entirely in your browser.',
    twitter: { card: 'summary_large_image' },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
