'use client';

import { useMemo, useState } from 'react';
import { portPhp } from '../lib/porter';
import { EXAMPLES } from '../lib/examples';

export default function Home() {
  const [php, setPhp] = useState(EXAMPLES.basics);
  const [copied, setCopied] = useState(false);
  const { code, warnings } = useMemo(() => portPhp(php), [php]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ported.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (file) setPhp(await file.text());
    e.target.value = '';
  };

  return (
    <main>
      <header>
        <h1>porter</h1>
        <p>paste php on the left, get javascript on the right. everything runs in your browser.</p>
      </header>

      <div className="toolbar">
        <span>examples:</span>
        {Object.keys(EXAMPLES).map((name) => (
          <button key={name} onClick={() => setPhp(EXAMPLES[name])}>{name}</button>
        ))}
        <label className="button">
          open .php file
          <input type="file" accept=".php,.phtml,.inc,text/plain" onChange={upload} hidden />
        </label>
        <button onClick={() => setPhp('')}>clear</button>
      </div>

      <div className="panes">
        <section>
          <div className="pane-head">php</div>
          <textarea value={php} onChange={(e) => setPhp(e.target.value)} spellCheck={false} placeholder="<?php echo 'hello';" />
        </section>
        <section>
          <div className="pane-head">
            javascript
            <span>
              <button onClick={copy} disabled={!code}>{copied ? 'copied' : 'copy'}</button>
              <button onClick={download} disabled={!code}>download</button>
            </span>
          </div>
          <textarea value={code} readOnly spellCheck={false} />
        </section>
      </div>

      {warnings.length > 0 && (
        <section className="notes">
          <h2>things to check by hand</h2>
          <ul>
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
