// helpers for loading php files from drops / pickers and zipping the result.

export const MAX_FILES = 10;
const PHP_EXT = /\.(php|phtml|inc)$/i;
const SKIP_DIRS = new Set(['vendor', 'node_modules', '.git', '.idea', '.vscode']);

const isPhp = (path) => PHP_EXT.test(path);
const skipped = (path) => path.split('/').some((part) => SKIP_DIRS.has(part));

// takes [{ path, file }] candidates and reads the first MAX_FILES php files
async function load(candidates) {
  const php = candidates.filter((c) => isPhp(c.path) && !skipped(c.path));
  php.sort((a, b) => a.path.localeCompare(b.path));
  const files = await Promise.all(
    php.slice(0, MAX_FILES).map(async (c) => ({ path: c.path, php: await c.file.text() })),
  );
  return { files, found: php.length };
}

// files from <input type="file" multiple webkitdirectory>
export function filesFromInput(fileList) {
  return load([...fileList].map((file) => ({ path: file.webkitRelativePath || file.name, file })));
}

// files and folders from a drag and drop
export async function filesFromDrop(dataTransfer) {
  // entries have to be grabbed synchronously, before the first await
  const entries = [...dataTransfer.items].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return filesFromInput(dataTransfer.files);

  const candidates = [];
  const walk = async (entry, prefix) => {
    const path = prefix + entry.name;
    if (entry.isFile) {
      if (isPhp(path)) candidates.push({ path, file: await new Promise((res, rej) => entry.file(res, rej)) });
    } else if (entry.isDirectory && !SKIP_DIRS.has(entry.name)) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const child of batch) await walk(child, path + '/');
      } while (batch.length);
    }
  };
  for (const entry of entries) await walk(entry, '');
  return load(candidates);
}

export const jsPath = (path) => path.replace(PHP_EXT, '.js');

// ---------- minimal zip writer (store only, no compression) ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(entries) {
  const enc = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;

  for (const { path, content } of entries) {
    const name = enc.encode(path);
    const data = enc.encode(content);
    const crc = crc32(data);

    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true); // utf-8 names
    head.setUint16(12, 0x21, true); // 1980-01-01
    head.setUint32(14, crc, true);
    head.setUint32(18, data.length, true);
    head.setUint32(22, data.length, true);
    head.setUint16(26, name.length, true);
    local.push(head, name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(14, 0x21, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(dir, name);

    offset += 30 + name.length + data.length;
  }

  const size = central.reduce((n, part) => n + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);

  return new Blob([...local, ...central, end], { type: 'application/zip' });
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
