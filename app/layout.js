import './globals.css';

export const metadata = {
  title: 'porter',
  description: 'port php code to javascript in your browser',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
