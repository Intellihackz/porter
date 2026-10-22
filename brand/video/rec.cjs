// records the launch videos: next start -p 3123, then
// node brand/video/rec.cjs brand/video landing|folder  -> brand/video/porter-<name>.mp4 (needs ffmpeg)
// frame-by-frame recorder: every css animation is paused and stepped to the
// exact frame time, so the output is perfectly smooth regardless of how long
// each screenshot takes.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = 'http://localhost:3123';
const FPS = 30;
const OUT = process.argv[2];
const which = process.argv[3];
// both render to 1920x1080; the tool gets a roomier viewport than the landing
const [W, H, SCALE] = which === 'folder' ? [1280, 720, 1.5] : [1024, 576, 1.875];

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function setup(page) {
  await page.addStyleTag({ content: `
    html { scroll-behavior: auto !important; }
    #rec-cursor { position: fixed; z-index: 9999; left: 0; top: 0; width: 26px; height: 26px; pointer-events: none;
      transform: translate(-3px, -2px); filter: drop-shadow(0 2px 6px rgba(0,0,0,.6)); }
    #rec-ripple { position: fixed; z-index: 9998; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      border: 2px solid #c6ff3d; pointer-events: none; opacity: 0; }
    #rec-chip { position: fixed; z-index: 9997; padding: 10px 16px; border-radius: 12px; background: #19191c; border: 1px solid #3a3a40;
      color: #f2efe8; font: 600 15px var(--font-sans); white-space: nowrap; pointer-events: none; opacity: 0;
      box-shadow: 0 12px 30px rgba(0,0,0,.5); transform: rotate(-4deg); }
    #rec-chip small { display: block; font: 12px var(--font-mono); color: #8a877f; font-weight: 400; }
    #rec-end { position: fixed; inset: 0; z-index: 10000; background: #0b0b0c; display: grid; place-content: center; justify-items: center;
      gap: 22px; opacity: 0; pointer-events: none; text-align: center; }
    #rec-end .m { width: 120px; height: 120px; border-radius: 28px; background: #c6ff3d; color: #0b0b0c; display: grid; place-items: center;
      font: 700 56px var(--font-mono); letter-spacing: -.13em; padding-right: 6px; }
    #rec-end h1 { margin: 0; font: 600 76px/1 var(--font-sans); letter-spacing: -.05em; color: #f2efe8; }
    #rec-end h1 em { color: #c6ff3d; }
    #rec-end p { margin: 0; font: 500 26px var(--font-mono); color: #c6ff3d; }
  `});
  await page.evaluate(() => {
    const c = document.createElement('div');
    c.id = 'rec-cursor';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 11.5-6.6.9 3.9 7.4-3 1.5-3.8-7.5L4 20z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const r = document.createElement('div'); r.id = 'rec-ripple';
    const chip = document.createElement('div'); chip.id = 'rec-chip';
    chip.innerHTML = '📁 legacy-shop<small>12 php files + vendor/</small>';
    const end = document.createElement('div'); end.id = 'rec-end';
    end.innerHTML = '<div class="m">&lt;?</div><h1>php in, <em>js source</em> out.</h1><p>porter.pxxlspace.cv</p>';
    document.body.append(c, r, chip, end);
  });
}

async function recorder(page, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let frame = 0;
  const cur = { x: W * 0.62, y: H * 0.8 };

  const sync = (t) => page.evaluate((t) => {
    window.__starts ??= new WeakMap();
    for (const a of document.getAnimations()) {
      if (a.id === 'skip') continue;
      if (!window.__starts.has(a)) window.__starts.set(a, a.currentTime == null || t < 50 ? 0 : t);
      a.pause();
      a.currentTime = Math.max(0, t - window.__starts.get(a));
    }
  }, t);

  const place = () => page.evaluate(({ x, y }) => {
    const c = document.getElementById('rec-cursor'); c.style.left = x + 'px'; c.style.top = y + 'px';
    const chip = document.getElementById('rec-chip'); chip.style.left = x + 18 + 'px'; chip.style.top = y + 16 + 'px';
  }, cur);

  const snap = async (n = 1) => {
    for (let i = 0; i < n; i++) {
      await place();
      await sync((frame * 1000) / FPS);
      await page.screenshot({ path: path.join(dir, String(frame).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 94 });
      frame++;
    }
  };
  const hold = (sec) => snap(Math.round(sec * FPS));

  const move = async (x, y, sec = 0.7) => {
    const n = Math.round(sec * FPS), sx = cur.x, sy = cur.y;
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      cur.x = sx + (x - sx) * k; cur.y = sy + (y - sy) * k;
      await snap();
    }
  };
  const center = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const moveTo = async (sel, sec) => { const p = await center(sel); await move(p.x, p.y, sec); };

  const ripple = async () => {
    for (let i = 0; i <= 9; i++) {
      await page.evaluate(({ x, y, k }) => {
        const r = document.getElementById('rec-ripple');
        r.style.left = x + 'px'; r.style.top = y + 'px';
        r.style.opacity = String(1 - k); r.style.transform = `scale(${0.4 + k})`;
      }, { ...cur, k: i / 9 });
      await snap();
    }
  };
  // click where the fake cursor is, so the page never auto-scrolls mid video
  const click = async () => { await page.mouse.click(cur.x, cur.y); await ripple(); };

  const scrollTo = async (y, sec = 1.2) => {
    const sy = await page.evaluate(() => scrollY), n = Math.round(sec * FPS);
    for (let i = 1; i <= n; i++) {
      await page.evaluate((v) => scrollTo(0, v), sy + (y - sy) * ease(i / n));
      await snap();
    }
  };

  const fade = async (sel, to, sec = 0.4) => {
    const n = Math.round(sec * FPS);
    const from = await page.evaluate((s) => +getComputedStyle(document.querySelector(s)).opacity, sel);
    for (let i = 1; i <= n; i++) {
      await page.evaluate(({ s, v }) => { document.querySelector(s).style.opacity = v; }, { s: sel, v: from + (to - from) * ease(i / n) });
      await snap();
    }
  };

  const endCard = async () => { await fade('#rec-end', 1, 0.5); await hold(2.5); };

  return { snap, hold, move, moveTo, click, ripple, scrollTo, fade, endCard, cur, frames: () => frame };
}

function encode(dir, file) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file]);
}

// ---------- scenes ----------

async function landing(page, r) {
  await page.goto(BASE + '/');
  await page.evaluate(() => document.fonts.ready);
  await setup(page);
  await r.hold(3.0); // hero rises in, PHP gets struck through
  await r.scrollTo(170, 0.9);
  await r.moveTo('.cta-row .btn', 0.7);
  await r.hold(0.7);

  const demoTop = await page.evaluate(() => document.querySelector('#demo').getBoundingClientRect().top + scrollY - 40);
  await r.scrollTo(demoTop, 1.4);
  await r.hold(0.5);

  await r.moveTo('.demo textarea', 0.7);
  await r.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await r.snap(6);

  const code = `<?php
$user = ['name' => 'ada', 'langs' => ['php', 'js']];

function greet($u) {
    $n = count($u['langs']);
    return "hi {$u['name']}, you know $n langs";
}

echo strtoupper(greet($user));`;
  for (let i = 0; i < code.length; i += 2) {
    await page.keyboard.type(code.slice(i, i + 2));
    await r.snap();
  }
  await r.move(W * 0.97, H * 0.5, 0.6);
  await r.hold(2.6);
  await r.endCard();
}

async function folder(page, r, dirPath) {
  await page.goto(BASE + '/port');
  await page.evaluate(() => document.fonts.ready);
  await setup(page);
  await page.addStyleTag({ content: `
    .tool { height: 100vh; overflow: hidden; }
    .workspace { min-height: 0; overflow: hidden; }
    .sidebar { overflow: hidden; gap: 12px; padding: 16px; }
    .dropzone { padding: 16px; }
    .drop-sub { margin-bottom: 12px; }
    .file { padding: 7px 10px; }
    .editors { grid-template-rows: minmax(0, 1fr) auto; min-height: 0; padding: 16px; }
    .pane textarea { min-height: 0; }
    .notes { padding: 12px 18px; }
    .notes ul { font-size: 13px; line-height: 1.55; }
  `});
  r.cur.x = W + 40; r.cur.y = H * 0.55;
  await r.hold(0.8);
  await r.fade('#rec-chip', 1, 0.01);
  await r.move(W * 0.58, H * 0.5, 0.9);
  await page.locator('.tool').dispatchEvent('dragenter');
  await r.hold(1.3);
  await r.fade('#rec-chip', 0, 0.15);
  await page.locator('.tool').dispatchEvent('dragleave');
  await page.locator('input[webkitdirectory]').setInputFiles(dirPath);
  await page.waitForSelector('.notice');
  await r.hold(1.2);

  await r.moveTo('.notice', 0.6);
  await r.hold(0.8);

  for (const name of ['lib/helpers.php', 'models/Order.php', 'index.php', 'api/products.php']) {
    const sel = `.file[title], .file`;
    const idx = await page.locator('.file-name').evaluateAll((els, n) => els.findIndex((e) => e.textContent.endsWith('/' + n)), name);
    if (idx < 0) throw new Error('file not loaded: ' + name);
    const target = page.locator('.file').nth(idx);
    const b = await target.boundingBox();
    await r.move(b.x + 120, b.y + b.height / 2, 0.55);
    await r.click();
    await r.hold(1.7);
  }

  await r.moveTo('.notes', 0.7);
  await r.hold(1.6);
  await r.moveTo('text=download all .zip', 0.8);
  const dl = page.waitForEvent('download');
  await r.click();
  await dl;
  await r.hold(1.0);
  await r.endCard();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, acceptDownloads: true });
  const page = await ctx.newPage();
  const dir = path.join(OUT, 'frames-' + which);
  const r = await recorder(page, dir);
  if (which === 'landing') await landing(page, r);
  else await folder(page, r, path.join(OUT, 'legacy-shop'));
  console.log(which, r.frames(), 'frames', (r.frames() / FPS).toFixed(1) + 's');
  encode(dir, path.join(OUT, `porter-${which}.mp4`));
  await b.close();
})();
