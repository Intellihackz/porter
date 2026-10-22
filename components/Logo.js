import Link from 'next/link';

export default function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark">&lt;?</span>porter
    </Link>
  );
}
