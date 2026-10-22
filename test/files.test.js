import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_FILES, filesFromInput, jsPath, zip } from '../lib/files.js';

const fake = (path, text = '<?php echo 1;') => {
  const file = new File([text], path.split('/').pop());
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
};

test('only php files are loaded, capped at MAX_FILES, vendor skipped', async () => {
  const list = [
    ...Array.from({ length: 14 }, (_, i) => fake(`app/page${String(i).padStart(2, '0')}.php`)),
    fake('app/vendor/lib.php'),
    fake('app/readme.md'),
  ];
  const { files, found } = await filesFromInput(list);
  assert.equal(found, 14);
  assert.equal(files.length, MAX_FILES);
  assert.equal(files[0].path, 'app/page00.php');
  assert.equal(files[0].php, '<?php echo 1;');
});

test('zip output opens with unzip', async () => {
  const blob = zip([
    { path: jsPath('src/a.php'), content: 'console.log(1);\n' },
    { path: jsPath('src/views/b.phtml'), content: 'console.log(2);\n' },
  ]);
  const file = join(mkdtempSync(join(tmpdir(), 'porter-')), 'out.zip');
  writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  assert.equal(execFileSync('unzip', ['-p', file, 'src/views/b.js']).toString(), 'console.log(2);\n');
  execFileSync('unzip', ['-t', file]); // throws on crc errors
});
