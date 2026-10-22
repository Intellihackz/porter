'use client';

import { useMemo, useState } from 'react';
import { portPhp } from '../lib/porter';

const START = `<?php
$crew = ['ada' => 36, 'linus' => 28];

foreach ($crew as $name => $age) {
    echo ucfirst($name) . " is $age";
}`;

export default function LiveDemo() {
  const [php, setPhp] = useState(START);
  const js = useMemo(() => portPhp(php).code.replace(/^\/\/.*\n\n/, ''), [php]);

  return (
    <div className="demo">
      <div className="demo-pane">
        <div className="demo-label"><span className="dot" />input.php <em>edit me</em></div>
        <textarea value={php} onChange={(e) => setPhp(e.target.value)} spellCheck={false} aria-label="php input" />
      </div>
      <div className="demo-arrow" aria-hidden>→</div>
      <div className="demo-pane out">
        <div className="demo-label"><span className="dot lime" />source.js</div>
        <pre>{js}</pre>
      </div>
    </div>
  );
}
