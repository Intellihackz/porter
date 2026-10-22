import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portPhp } from '../lib/porter.js';
import { EXAMPLES } from '../lib/examples.js';

const valid = (code) => assert.doesNotThrow(() => new Function(code), code);

for (const [name, php] of Object.entries(EXAMPLES)) {
  test(`example "${name}" ports to valid js`, () => valid(portPhp(php).code));
}

test('variables, concat and echo', () => {
  const { code } = portPhp('<?php $a = "hi"; $b = $a . " there"; echo $b;');
  assert.match(code, /let a = "hi";/);
  assert.match(code, /let b = a \+ " there";/);
  assert.match(code, /console\.log\(b\);/);
});

test('interpolation becomes template literals', () => {
  const { code } = portPhp('<?php $n = 1; echo "n is $n and {$n}";');
  assert.match(code, /`n is \$\{n\} and \$\{n\}`/);
});

test('assoc arrays become objects', () => {
  const { code } = portPhp("<?php $x = ['a' => 1, 'b' => [1, 2]];");
  assert.match(code, /let x = \{'a': 1, 'b': \[1, 2\]\};/);
});

test('variables first set in a block are hoisted', () => {
  const { code } = portPhp('<?php if (true) { $m = 1; } else { $m = 2; } echo $m;');
  assert.match(code, /^let m;/m);
  valid(code);
});

test('methods named like builtins are left alone', () => {
  const { code } = portPhp('<?php class Cart { public function count(): int { return count($this->items); } }');
  assert.match(code, /count\(\) \{\s*return this\.items\.length;/);
  valid(code);
});

test('constructor promotion assigns the properties', () => {
  const { code } = portPhp('<?php class U { public function __construct(public string $email, private $name) {} }');
  assert.match(code, /constructor\(email, name\) \{ this\.email = email; this\.name = name;\}/);
  valid(code);
});

test('round keeps its precision argument', () => {
  const { code } = portPhp('<?php $t = round($x * 1.08, 2);');
  assert.match(code, /Math\.round\(\(x \* 1\.08\) \* 10 \*\* 2\) \/ 10 \*\* 2/);
});

test('builtins are mapped', () => {
  const { code } = portPhp('<?php $s = strtoupper(trim($t)); $n = count($list);');
  assert.match(code, /t\.trim\(\)\.toUpperCase\(\)/);
  assert.match(code, /list\.length/);
});
