import Link from 'next/link';
import Logo from '../components/Logo';
import LiveDemo from '../components/LiveDemo';

const MAPPINGS = [
  ['count($a)', 'a.length'], ['implode(", ", $a)', 'a.join(", ")'], ['"Hi $name"', '`Hi ${name}`'],
  ['$a[] = $x', 'a.push(x)'], ["['k' => 1]", "{ 'k': 1 }"], ['str_replace()', '.replaceAll()'],
  ['json_encode()', 'JSON.stringify()'], ['$this->x', 'this.x'], ['isset($x)', 'x != null'],
  ['array_map()', '.map()'], ['foreach', 'for...of'], ['$_GET', 'req.query'],
];

const FEATURES = [
  ['Variables & scope', 'adds let where a variable is born and hoists the ones php lets you set inside blocks.'],
  ['Strings', 'concat dots, single quotes, "$interpolation", {$complex} and heredocs become clean template literals.'],
  ['Arrays', 'lists stay arrays, associative arrays become objects, $arr[] becomes push.'],
  ['Classes', 'properties, constants, static methods, constructors, $this and parent:: all carry over.'],
  ['Templates', 'mixed html and <?= ?> files work, including if: / endif; style blocks.'],
  ['70+ builtins', 'count, explode, array_filter, in_array, json_decode, intval and friends map to native js.'],
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="nav">
        <Logo />
        <div className="nav-links">
          <a href="#how">how it works</a>
          <a href="#features">what it ports</a>
          <Link href="/port" className="btn btn-small">open porter</Link>
        </div>
      </nav>

      <header className="hero">
        <p className="eyebrow"><span className="pulse" /> php → javascript, right in your browser</p>
        <h1>
          Move your <span className="strike">PHP</span><br />
          <em>to</em> JavaScript.
        </h1>
        <div className="hero-foot">
          <p className="lede">
            drop a folder of up to ten php files and porter rewrites the syntax, arrays, classes and builtins into
            modern js. no signup, no api keys, and your code never leaves the tab.
          </p>
          <div className="cta-row">
            <Link href="/port" className="btn">start porting <span>↗</span></Link>
            <a href="#demo" className="btn btn-ghost">try it here</a>
          </div>
        </div>
      </header>

      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[...MAPPINGS, ...MAPPINGS].map(([from, to], i) => (
            <span key={i}><code>{from}</code><b>→</b><code className="to">{to}</code></span>
          ))}
        </div>
      </div>

      <section id="demo" className="section">
        <div className="section-head">
          <span className="num">(01)</span>
          <h2>Type php. <em>Watch it turn.</em></h2>
        </div>
        <LiveDemo />
      </section>

      <section id="how" className="section">
        <div className="section-head">
          <span className="num">(02)</span>
          <h2>Three moves, <em>zero setup.</em></h2>
        </div>
        <ol className="steps">
          <li><span>01</span><h3>Drop a folder</h3><p>drag a project in. porter picks up to ten .php files and skips vendor and node_modules.</p></li>
          <li><span>02</span><h3>Read the port</h3><p>flip between files, edit the php and watch the js update. notes flag what needs a human.</p></li>
          <li><span>03</span><h3>Take the zip</h3><p>download every ported file in one zip, same folder layout, .php swapped for .js.</p></li>
        </ol>
      </section>

      <section id="features" className="section">
        <div className="section-head">
          <span className="num">(03)</span>
          <h2>What it <em>actually</em> ports.</h2>
        </div>
        <div className="features">
          {FEATURES.map(([title, body]) => (
            <article key={title}><h3>{title}</h3><p>{body}</p></article>
          ))}
        </div>
        <p className="honest">
          porter is rule based, so it is a head start, not a magic button. database calls, sessions, sprintf, dates and
          file io get flagged for you to port by hand.
        </p>
      </section>

      <footer className="footer">
        <Link href="/port" className="mega">Start porting<span>↗</span></Link>
        <div className="footer-row">
          <Logo />
          <span>runs 100% client side · open source</span>
        </div>
      </footer>
    </div>
  );
}
