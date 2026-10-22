'use client';

import { useMemo, useRef, useState } from 'react';
import Logo from '../../components/Logo';
import { portPhp } from '../../lib/porter';
import { EXAMPLES } from '../../lib/examples';
import { MAX_FILES, filesFromDrop, filesFromInput, jsPath, saveBlob, zip } from '../../lib/files';

const exampleFiles = () =>
  Object.entries(EXAMPLES).map(([name, php]) => ({ path: `examples/${name}.php`, php }));

export default function Port() {
  const [files, setFiles] = useState(exampleFiles);
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const dragDepth = useRef(0);

  const current = files[active] || files[0];
  const { code, warnings } = useMemo(() => portPhp(current?.php || ''), [current]);

  const accept = ({ files: loaded, found }) => {
    if (!loaded.length) {
      setNotice('no .php files found in that drop.');
      return;
    }
    setFiles(loaded);
    setActive(0);
    setNotice(found > MAX_FILES ? `found ${found} php files, loaded the first ${MAX_FILES}.` : `loaded ${found} file${found === 1 ? '' : 's'}.`);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    accept(await filesFromDrop(e.dataTransfer));
  };

  const onPick = async (e) => {
    if (e.target.files?.length) accept(await filesFromInput(e.target.files));
    e.target.value = '';
  };

  const edit = (php) => setFiles((fs) => fs.map((f, i) => (i === active ? { ...f, php } : f)));

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const downloadOne = () => saveBlob(new Blob([code], { type: 'text/javascript' }), jsPath(current.path).split('/').pop());
  const downloadAll = () =>
    saveBlob(zip(files.map((f) => ({ path: jsPath(f.path), content: portPhp(f.php).code }))), 'porter-output.zip');

  return (
    <div
      className="tool"
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDragging(true); }}
      onDragLeave={() => { if (--dragDepth.current <= 0) setDragging(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <nav className="nav tool-nav">
        <Logo />
        <div className="nav-links">
          <button className="btn btn-small btn-ghost" onClick={downloadAll}>download all .zip</button>
        </div>
      </nav>

      <div className="workspace">
        <aside className="sidebar">
          <div className="dropzone">
            <p className="drop-title">Drop a folder</p>
            <p className="drop-sub">or up to {MAX_FILES} .php files, anywhere on this page</p>
            <div className="drop-actions">
              <label className="btn btn-small">
                folder
                <input type="file" webkitdirectory="" directory="" multiple hidden onChange={onPick} />
              </label>
              <label className="btn btn-small btn-ghost">
                files
                <input type="file" accept=".php,.phtml,.inc" multiple hidden onChange={onPick} />
              </label>
            </div>
          </div>
          {notice && <p className="notice">{notice}</p>}

          <div className="file-list">
            <div className="list-head">
              <span>files</span>
              <span>{files.length}/{MAX_FILES}</span>
            </div>
            {files.map((f, i) => (
              <button key={f.path + i} className={`file ${i === active ? 'on' : ''}`} onClick={() => setActive(i)}>
                <span className="file-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="file-name" title={f.path}>{f.path}</span>
              </button>
            ))}
            <button className="file add" onClick={() => { setFiles((fs) => [...fs, { path: `untitled-${fs.length + 1}.php`, php: '<?php\n' }].slice(0, MAX_FILES)); setActive(Math.min(files.length, MAX_FILES - 1)); }} disabled={files.length >= MAX_FILES}>
              + new file
            </button>
          </div>
        </aside>

        <main className="editors">
          <section className="pane">
            <div className="pane-head">
              <span><i className="dot" />{current?.path}</span>
            </div>
            <textarea value={current?.php || ''} onChange={(e) => edit(e.target.value)} spellCheck={false} placeholder="<?php echo 'hello';" />
          </section>
          <section className="pane out">
            <div className="pane-head">
              <span><i className="dot lime" />{current ? jsPath(current.path) : 'output.js'}</span>
              <span className="pane-actions">
                <button onClick={copy} disabled={!code}>{copied ? 'copied' : 'copy'}</button>
                <button onClick={downloadOne} disabled={!code}>download</button>
              </span>
            </div>
            <textarea value={code} readOnly spellCheck={false} />
          </section>

          {warnings.length > 0 && (
            <section className="notes">
              <h2>Check by hand <span>{warnings.length}</span></h2>
              <ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </section>
          )}
        </main>
      </div>

      {dragging && (
        <div className="overlay">
          <p>Let go.<em> We&apos;ll take it from here.</em></p>
          <span>up to {MAX_FILES} php files, folders welcome</span>
        </div>
      )}
    </div>
  );
}
