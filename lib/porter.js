// porter: a small rule based php -> js converter.
// it won't understand every php program, but it handles the boring 80%
// (syntax, arrays, strings, classes, common builtins) and tells you
// what still needs a human.

const HEADER = '// ported from php with porter. review before shipping.\n\n';

export function portPhp(source) {
  const tokens = [];
  const warnings = new Set();

  let code = extractPhp(source.replace(/\r\n/g, '\n'), tokens);
  code = mask(code, tokens);
  collectWarnings(code, warnings);
  code = transform(code, tokens, warnings);
  code = code.replace(/__S(\d+)__/g, (_, i) => renderToken(tokens[i]));
  code = code.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

  return { code: code ? HEADER + code + '\n' : '', warnings: [...warnings] };
}

// ---------- step 1: pull php out of mixed html/php files ----------

function addToken(tokens, type, raw) {
  tokens.push({ type, raw });
  return `__S${tokens.length - 1}__`;
}

function extractPhp(src, tokens) {
  if (!src.includes('<?')) return src;
  let out = '';
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('<?', i);
    const html = open === -1 ? src.slice(i) : src.slice(i, open);
    if (html.trim()) out += `\necho ${addToken(tokens, 'html', html)};\n`;
    if (open === -1) break;

    let start = open + 2;
    let short = false;
    if (src.startsWith('php', start)) start += 3;
    else if (src[start] === '=') { start += 1; short = true; }

    const close = src.indexOf('?>', start);
    const body = close === -1 ? src.slice(start) : src.slice(start, close);
    out += short ? `echo ${body.trim().replace(/;$/, '')};` : body;
    if (close === -1) break;
    i = close + 2;
    if (src[i] === '\n') i++;
  }
  return out;
}

// ---------- step 2: hide strings and comments behind placeholders ----------

function mask(code, tokens) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const n = code[i + 1];

    if ((c === '/' && n === '/') || (c === '#' && n !== '[')) {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      out += addToken(tokens, 'comment', code.slice(i, end));
      i = end;
      continue;
    }
    if (c === '/' && n === '*') {
      let end = code.indexOf('*/', i + 2);
      end = end === -1 ? code.length : end + 2;
      out += addToken(tokens, 'comment', code.slice(i, end));
      i = end;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) {
        if (code[j] === '\\') j++;
        j++;
      }
      out += addToken(tokens, c === "'" ? 'sq' : 'dq', code.slice(i + 1, j));
      i = j + 1;
      continue;
    }
    if (code.startsWith('<<<', i)) {
      const m = /^<<<[ \t]*(['"]?)(\w+)\1\n/.exec(code.slice(i));
      if (m) {
        const bodyStart = i + m[0].length;
        const rest = code.slice(bodyStart);
        const end = new RegExp(`^[ \\t]*${m[2]}\\b`, 'm').exec(rest);
        const body = end ? rest.slice(0, end.index) : rest;
        out += addToken(tokens, m[1] === "'" ? 'nowdoc' : 'heredoc', body.replace(/\n$/, ''));
        i = end ? bodyStart + end.index + end[0].length : code.length;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

// ---------- step 3: rewrite the code ----------

function transform(code, tokens, warnings) {
  code = code.replace(/^\s*declare\s*\([^)]*\)\s*;/gm, '');
  code = code.replace(/^([ \t]*)namespace\s+([^;{]+);/gm, '$1// namespace $2');
  code = code.replace(/^([ \t]*)use\s+([\w\\]+)(\s+as\s+\w+)?\s*;/gm, '$1// TODO: import $2$3');
  code = code.replace(
    /^([ \t]*)(?:require|include)(?:_once)?\b\s*\(?\s*([^;]*?)\)?\s*;/gm,
    '$1// TODO: import $2',
  );
  code = code.replace(/\bglobal\s+([^;]+);/g, '// global $1 (move to module scope)');
  code = code.replace(/\bdefine\s*\(\s*__S(\d+)__\s*,\s*([^;]*)\)\s*;/g, (_, i, v) => `const ${tokens[i].raw} = ${v};`);

  code = convertAltSyntax(code);

  // string concatenation
  code = code.replace(/\.=/g, '+=');
  code = code.replace(/(\s*)\.(\s*)/g, (m, a, b, off, s) => {
    const dot = off + a.length;
    const prev = s[dot - 1] || '';
    const next = s[dot + 1] || '';
    if (prev === '.' || next === '.') return m; // spread ...
    if (/\d/.test(next) && (/\d/.test(prev) || !/\w/.test(prev))) return m; // 1.5 or .5
    return ' + ';
  });

  // type hints, return types, casts
  code = code.replace(
    /([(,]\s*)(?:(?:public|private|protected|readonly)\s+)*\??([\w\\|]+)\s+(?=&?(?:\.\.\.)?\$)/g,
    (m, lead, type) => (/^(new|clone|print|echo|yield|return)$/.test(type) ? m : lead),
  );
  code = code.replace(/(\b(?:function|fn)\b[^{;]*?\))\s*:\s*\??[\w\\|]+/g, '$1');
  code = code.replace(/\b(public|private|protected|var)(\s+static)?(?:\s+readonly)?\s+\??[\w\\|]+\s+(?=\$)/g, '$1$2 ');
  code = code.replace(/\((?:int|integer|float|double)\)\s*/g, '+');
  code = code.replace(/\(bool(?:ean)?\)\s*/g, '!!');
  code = code.replace(/\(string\)\s*/g, "'' + ");
  code = code.replace(/\((?:array|object)\)\s*/g, '');

  // superglobals, express style
  const globals = {
    GET: 'req.query', POST: 'req.body', REQUEST: '{ ...req.query, ...req.body }',
    COOKIE: 'req.cookies', SESSION: 'req.session', FILES: 'req.files',
    SERVER: 'req', ENV: 'process.env',
  };
  code = code.replace(/\$_(GET|POST|REQUEST|COOKIE|SESSION|FILES|SERVER|ENV)\b/g, (_, n) => globals[n]);

  // foreach and $arr[] = x
  code = code.replace(
    /\bforeach\s*\(\s*(.+?)\s+as\s+&?(\$\w+)(?:\s*=>\s*&?(\$\w+))?\s*\)/g,
    (_, list, a, b) => (b ? `for (const [${a}, ${b}] of Object.entries(${list}))` : `for (const ${a} of ${list})`),
  );
  code = code.replace(/(\$\w+(?:->\w+)*)\[\]\s*=\s*([^;]+);/g, '$1.push($2);');

  code = declareVariables(code, tokens);
  code = convertArrayCalls(code);
  code = convertAssocArrays(code);

  // members, statics, classes
  code = code.replace(/\?->/g, '?.').replace(/->/g, '.');
  code = code.replace(/\bparent::__construct\b/g, 'super');
  code = code.replace(/\bparent::/g, 'super.');
  code = code.replace(/\b(?:self|static)::/g, 'this.constructor.');
  code = code.replace(/::/g, '.');
  code = code.replace(/\b(?:public|private|protected|var|abstract|final|readonly)\s+/g, '');
  code = code.replace(/\s+implements\s+[\w\\,\s]+?(?=\s*\{)/g, '');
  code = code.replace(/\b__construct\b/g, 'constructor');

  // closures
  code = code.replace(/\)\s*use\s*\([^)]*\)/g, ')');
  code = code.replace(/\bfn\s*\(/g, '(');

  // drop the $ sigil
  code = code.replace(/([(,]\s*)&(?=\$)/g, '$1');
  code = code.replace(/\$(?=[A-Za-z_])/g, '');

  code = mapFunctions(code);

  code = code.replace(/\b(?:echo|print)\b\s*([^;]+);/g, (_, args) => `console.log(${unwrap(args.trim())});`);
  code = code.replace(/\belseif\b/g, 'else if');
  code = code.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
  code = code.replace(/\b(null|true|false)\b/gi, (m) => m.toLowerCase());
  code = code.replace(/\bnew\s+\\?\w*Exception\b/g, 'new Error');
  code = code.replace(/\bcatch\s*\(\s*[\w\\|]+\s+(\w+)\s*\)/g, 'catch ($1)');
  code = code.replace(/\bthis\.constructor\.class\b/g, 'this.constructor');
  code = code.replace(/\.getMessage\(\)/g, '.message');

  return code;
}

// if (...): ... endif; -> if (...) { ... }
function convertAltSyntax(code) {
  let out = code;
  const re = /\b(if|elseif|foreach|for|while|switch)\s*\(/g;
  let m;
  while ((m = re.exec(out))) {
    const close = matchClose(out, m.index + m[0].length - 1);
    if (close === -1) continue;
    const after = /^\s*:/.exec(out.slice(close + 1));
    if (!after) continue;
    const prefix = m[1] === 'elseif' ? '} ' : '';
    out = out.slice(0, m.index) + prefix + out.slice(m.index, close + 1) + ' {' + out.slice(close + 1 + after[0].length);
    re.lastIndex = m.index + prefix.length + 1;
  }
  out = out.replace(/\belse\s*:/g, '} else {');
  out = out.replace(/\b(?:endif|endforeach|endfor|endwhile|endswitch)\s*;/g, '}');
  return out;
}

// adds let declarations the first time a variable is assigned, php style
// (function scoped), and drops the `function` keyword from class methods.
function declareVariables(code, tokens) {
  const toks = code.match(/__S\d+__|\$[A-Za-z_]\w*|::|\?->|->|[A-Za-z_]\w*|\s+|./gs) || [];
  const out = [];
  const root = { kind: 'function', depth: 0, vars: new Set(), hoist: new Set(), slot: out.push('') - 1 };
  const stack = [root];
  const scopes = [root];
  const top = () => stack[stack.length - 1];
  const fnScope = () => [...stack].reverse().find((s) => s.kind === 'function');
  const isSpace = (t) => /^\s+$/.test(t) || (/^__S\d+__$/.test(t) && tokens[t.slice(3, -2)].type === 'comment');
  const nextIdx = (i) => {
    let j = i + 1;
    while (j < toks.length && isSpace(toks[j])) j++;
    return j;
  };

  let depth = 0;
  let parens = 0;
  let forParens = -1;
  let stmtStart = true;
  let pending = null;
  let pendingVars = null;
  let prev = '';

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (isSpace(t)) { out.push(t); continue; }

    if (t === 'class' || t === 'interface' || t === 'trait') {
      if (prev !== '::' && prev !== '->') pending = 'class';
      out.push(t);
    } else if (t === 'function') {
      const scope = top();
      pending = 'function';
      pendingVars = new Set();
      if (scope.kind === 'class' && depth === scope.depth) i = nextIdx(i) - 1; // method: drop keyword
      else out.push(t);
    } else if (t === 'const' && top().kind === 'class' && depth === top().depth) {
      out.push('static');
    } else if (t.startsWith('$')) {
      const name = t.slice(1);
      let text = t;
      if (pending === 'function') {
        pendingVars.add(name);
      } else if (stmtStart && name !== 'this') {
        const j = nextIdx(i);
        if (toks[j] === '=' && toks[j + 1] !== '=' && toks[j + 1] !== '>') {
          const scope = fnScope();
          if (!scope.vars.has(name)) {
            scope.vars.add(name);
            if (depth === scope.depth && forParens === -1) text = 'let ' + t;
            else scope.hoist.add(name);
          }
        }
      }
      out.push(text);
    } else if (t === '{') {
      depth++;
      out.push(t);
      if (pending === 'function') {
        const scope = { kind: 'function', depth, vars: pendingVars, hoist: new Set(), slot: out.push('') - 1 };
        stack.push(scope);
        scopes.push(scope);
      } else if (pending === 'class') {
        stack.push({ kind: 'class', depth });
      }
      pending = null;
    } else if (t === '}') {
      if (stack.length > 1 && top().depth === depth) stack.pop();
      depth--;
      out.push(t);
    } else if (t === '(') {
      parens++;
      if (prev === 'for') forParens = parens;
      out.push(t);
    } else if (t === ')') {
      if (parens === forParens) forParens = -1;
      parens--;
      out.push(t);
    } else {
      if (t === ';' && pending === 'function') pending = null;
      out.push(t);
    }

    stmtStart = t === ';' || t === '{' || t === '}' || t === ':' || t === 'else' ||
      (t === '(' && prev === 'for');
    prev = t;
  }

  // php variables are function scoped, so anything first set inside a
  // nested block gets declared at the top of its function instead.
  for (const scope of scopes) {
    if (!scope.hoist.size) continue;
    const decl = `let ${[...scope.hoist].join(', ')};`;
    if (scope === root) {
      out[scope.slot] = decl + '\n';
    } else {
      const ws = out[scope.slot + 1] || '';
      const indent = ws.includes('\n') ? ws.slice(ws.lastIndexOf('\n')) : ' ';
      out[scope.slot] = indent + decl;
    }
  }
  return out.join('');
}

// array(1, 2) -> [1, 2]
function convertArrayCalls(code) {
  const re = /(?<![\w$.>])array\s*\(/g;
  let m;
  while ((m = re.exec(code))) {
    const open = m.index + m[0].length - 1;
    const close = matchClose(code, open);
    if (close === -1) break;
    code = code.slice(0, m.index) + '[' + code.slice(open + 1, close) + ']' + code.slice(close + 1);
    re.lastIndex = m.index;
  }
  return code;
}

// ['a' => 1] -> { 'a': 1 }
function convertAssocArrays(code) {
  const keywords = /\b(return|echo|print|yield|case|else|in|of|as|and|or)\s*$/;
  for (let i = code.length - 1; i >= 0; i--) {
    if (code[i] !== '[') continue;
    const before = code.slice(0, i).trimEnd();
    if (/[\w)\]$]$/.test(before) && !keywords.test(before)) continue; // index access
    const close = matchClose(code, i);
    if (close === -1) continue;
    const parts = splitTopLevel(code.slice(i + 1, close));
    const pairs = parts.map(splitArrow);
    if (!pairs.some(Boolean)) continue;
    const body = parts
      .map((p, idx) => {
        const kv = pairs[idx];
        if (!kv) return p;
        let [k, v] = kv;
        const key = k.trim();
        if (!/^(__S\d+__|\d+)$/.test(key)) k = k.replace(key, `[${key}]`);
        return `${k.trimEnd()}:${v}`;
      })
      .join(',');
    code = code.slice(0, i) + '{' + body + '}' + code.slice(close + 1);
  }
  return code;
}

function splitArrow(part) {
  let depth = 0;
  for (let i = 0; i < part.length - 1; i++) {
    const c = part[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && c === '=' && part[i + 1] === '>') {
      if (part.slice(0, i).trimEnd().endsWith(')')) return null; // arrow fn
      return [part.slice(0, i), part.slice(i + 2)];
    }
  }
  return null;
}

// ---------- builtin function mapping ----------

const wrap = (a = '') => (isSimple(a) ? a : `(${a})`);

const FUNCS = {
  count: ([a]) => `${wrap(a)}.length`,
  sizeof: ([a]) => `${wrap(a)}.length`,
  strlen: ([a]) => `${wrap(a)}.length`,
  strtoupper: ([a]) => `${wrap(a)}.toUpperCase()`,
  strtolower: ([a]) => `${wrap(a)}.toLowerCase()`,
  ucfirst: ([a]) => `${wrap(a)}.charAt(0).toUpperCase() + ${wrap(a)}.slice(1)`,
  trim: ([a]) => `${wrap(a)}.trim()`,
  ltrim: ([a]) => `${wrap(a)}.trimStart()`,
  rtrim: ([a]) => `${wrap(a)}.trimEnd()`,
  str_repeat: ([s, n]) => `${wrap(s)}.repeat(${n})`,
  str_replace: ([a, b, s]) => `${wrap(s)}.replaceAll(${a}, ${b})`,
  str_contains: ([h, n]) => `${wrap(h)}.includes(${n})`,
  str_starts_with: ([h, n]) => `${wrap(h)}.startsWith(${n})`,
  str_ends_with: ([h, n]) => `${wrap(h)}.endsWith(${n})`,
  strpos: ([h, n]) => `${wrap(h)}.indexOf(${n})`,
  substr: ([s, a, n]) => (n ? `${wrap(s)}.substr(${a}, ${n})` : `${wrap(s)}.slice(${a})`),
  explode: ([sep, s]) => `${wrap(s)}.split(${sep})`,
  implode: ([sep, arr]) => `${wrap(arr)}.join(${sep})`,
  join: ([sep, arr]) => `${wrap(arr)}.join(${sep})`,
  number_format: ([n, d]) => `Number(${n}).toFixed(${d || 0})`,
  in_array: ([n, h]) => `${wrap(h)}.includes(${n})`,
  array_push: ([a, ...rest]) => `${wrap(a)}.push(${rest.join(', ')})`,
  array_pop: ([a]) => `${wrap(a)}.pop()`,
  array_shift: ([a]) => `${wrap(a)}.shift()`,
  array_unshift: ([a, ...rest]) => `${wrap(a)}.unshift(${rest.join(', ')})`,
  array_map: ([fn, arr]) => `${wrap(arr)}.map(${fn})`,
  array_filter: ([arr, fn]) => `${wrap(arr)}.filter(${fn || 'Boolean'})`,
  array_reduce: ([arr, fn, init]) => `${wrap(arr)}.reduce(${fn}${init ? `, ${init}` : ''})`,
  array_sum: ([a]) => `${wrap(a)}.reduce((sum, n) => sum + n, 0)`,
  array_keys: ([a]) => `Object.keys(${a})`,
  array_values: ([a]) => `Object.values(${a})`,
  array_merge: (args) => `[${args.map((a) => `...${a}`).join(', ')}]`,
  array_reverse: ([a]) => `[...${a}].reverse()`,
  array_unique: ([a]) => `[...new Set(${a})]`,
  array_slice: ([a, o, n]) => `${wrap(a)}.slice(${o}${n ? `, ${o} + ${n}` : ''})`,
  array_search: ([n, h]) => `${wrap(h)}.indexOf(${n})`,
  array_key_exists: ([k, a]) => `(${k} in ${a})`,
  sort: ([a]) => `${wrap(a)}.sort()`,
  json_encode: ([a]) => `JSON.stringify(${a})`,
  json_decode: ([a]) => `JSON.parse(${a})`,
  intval: ([a]) => `parseInt(${a}, 10)`,
  floatval: ([a]) => `parseFloat(${a})`,
  strval: ([a]) => `String(${a})`,
  is_array: ([a]) => `Array.isArray(${a})`,
  is_string: ([a]) => `typeof ${wrap(a)} === 'string'`,
  is_numeric: ([a]) => `!isNaN(${a})`,
  is_null: ([a]) => `${wrap(a)} === null`,
  is_int: ([a]) => `Number.isInteger(${a})`,
  isset: (args) => `(${args.map((a) => `${a} != null`).join(' && ')})`,
  empty: ([a]) => `!${wrap(a)}`,
  unset: ([a]) => `delete ${a}`,
  print_r: ([a]) => `console.log(${a})`,
  var_dump: (args) => `console.log(${args.join(', ')})`,
  max: (args) => (args.length === 1 ? `Math.max(...${args[0]})` : `Math.max(${args.join(', ')})`),
  min: (args) => (args.length === 1 ? `Math.min(...${args[0]})` : `Math.min(${args.join(', ')})`),
  abs: ([a]) => `Math.abs(${a})`,
  floor: ([a]) => `Math.floor(${a})`,
  ceil: ([a]) => `Math.ceil(${a})`,
  round: ([a]) => `Math.round(${a})`,
  sqrt: ([a]) => `Math.sqrt(${a})`,
  pow: ([a, b]) => `${wrap(a)} ** ${wrap(b)}`,
  rand: ([a, b]) => (b ? `Math.floor(Math.random() * (${b} - ${a} + 1)) + ${a}` : 'Math.random()'),
  mt_rand: (args) => FUNCS.rand(args),
  time: () => 'Math.floor(Date.now() / 1000)',
  die: ([a]) => (a ? `throw new Error(${a})` : 'process.exit()'),
  exit: ([a]) => (a ? `throw new Error(${a})` : 'process.exit()'),
};

function mapFunctions(code) {
  const re = new RegExp(`(?<![\\w.$\\\\])\\\\?\\b(${Object.keys(FUNCS).join('|')})\\s*\\(`, 'g');
  for (let guard = 0; guard < 10000; guard++) {
    let last = null;
    for (const m of code.matchAll(re)) {
      if (/\bfunction\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index))) continue;
      last = m;
    }
    if (!last) break;
    const open = last.index + last[0].length - 1;
    const close = matchClose(code, open);
    if (close === -1) break;
    const args = splitTopLevel(code.slice(open + 1, close)).map((s) => s.trim()).filter(Boolean);
    code = code.slice(0, last.index) + FUNCS[last[1]](args) + code.slice(close + 1);
  }
  return code;
}

// ---------- warnings ----------

const HINTS = [
  [/\becho\b|\bprint\b|__S\d+__;/, 'echo became console.log. in a web app, build a string and send it with res.send() instead'],
  [/\$_(GET|POST|REQUEST|COOKIE|SESSION|FILES|SERVER)\b/, 'superglobals were mapped to express style req.* so wrap the code in a route like app.get("/", (req, res) => { ... })'],
  [/\b(mysqli_\w+|mysql_\w+|PDO)\b/, 'database calls need a node driver such as mysql2 or pg, port those by hand'],
  [/\bsession_\w+\s*\(/, 'php sessions map to express-session in node'],
  [/\bheader\s*\(/, 'header() becomes res.setHeader() or res.redirect() in express'],
  [/\b(require|include)(_once)?\b/, 'require/include lines became TODO comments, swap them for import statements'],
  [/\bs?printf\s*\(/, 'sprintf/printf have no built in js twin, template literals usually do the job'],
  [/\bstrpos\s*\(|\barray_search\s*\(/, 'strpos/array_search return false when nothing is found, indexOf returns -1, so check those comparisons'],
  [/\bempty\s*\(/, 'empty() became a falsy check, but an empty array is truthy in js'],
  [/\bglobal\s+\$/, 'global variables were commented out, move shared state to module scope'],
  [/\b(interface|abstract|trait)\b/, 'interfaces, abstract classes and traits have no direct js equivalent, review them by hand'],
  [/\$\$\w/, 'variable variables ($$name) do not exist in js, use an object instead'],
  [/\b(date|strtotime|mktime)\s*\(/, 'date functions need Intl.DateTimeFormat or a library like date-fns'],
  [/\b(file_get_contents|file_put_contents|fopen|fwrite|unlink)\s*\(/, 'file functions map to node:fs (readFileSync, writeFileSync, ...)'],
  [/\b(password_hash|password_verify|md5|sha1|hash)\s*\(/, 'hashing needs node:crypto or a package like bcrypt'],
  [/\b(htmlspecialchars|htmlentities)\s*\(/, 'html escaping needs a small helper in js, most template engines do it for you'],
  [/\b(private|protected)\s+[^(;]*\$\w+\s*[,)]/, 'constructor property promotion was stripped, assign those properties inside the constructor'],
  [/\b(self|static)::/, 'self:: and static:: became this.constructor, inside static methods use the class name or this instead'],
];

function collectWarnings(code, warnings) {
  for (const [re, msg] of HINTS) if (re.test(code)) warnings.add(msg);
}

// ---------- string rendering ----------

function renderToken(tok) {
  switch (tok.type) {
    case 'comment':
      return tok.raw.startsWith('#') ? '//' + tok.raw.slice(1) : tok.raw;
    case 'sq':
      return sqToJs(tok.raw);
    case 'dq':
      return dqToJs(tok.raw);
    case 'heredoc':
      return interpolate(tok.raw);
    case 'nowdoc':
    case 'html':
      return '`' + escTemplate(tok.raw.replace(/\\/g, '\\\\')) + '`';
    default:
      return tok.raw;
  }
}

const escTemplate = (s) => s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

function sqToJs(raw) {
  // in php single quotes only \' and \\ are escapes
  const s = raw.replace(/\\(.)/gs, (m, c) => (c === '\\' || c === "'" ? m : '\\\\' + c));
  if (!s.includes('\n')) return `'${s}'`;
  return '`' + escTemplate(s.replace(/\\'/g, "'")) + '`';
}

function normalizeDq(s) {
  return s.replace(/\\(.)/gs, (m, c) => {
    if (c === '$') return '$';
    if (c === 'e') return '\\x1b';
    return 'nrtvf0123456789xu\\"'.includes(c) ? m : '\\\\' + c;
  });
}

function dqToJs(raw) {
  const stripped = raw.replace(/\\./gs, '');
  if (!/\$[A-Za-z_{]|\{\$/.test(stripped) && !raw.includes('\n')) return `"${normalizeDq(raw)}"`;
  return interpolate(raw);
}

const jsExpr = (e) =>
  e.replace(/\?->/g, '?.').replace(/->/g, '.').replace(/\$(?=[A-Za-z_])/g, '');

function interpolate(raw) {
  let out = '';
  let lit = '';
  const flush = () => {
    out += escTemplate(normalizeDq(lit).replace(/\\"/g, '"'));
    lit = '';
  };
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '\\') {
      lit += raw.slice(i, i + 2);
      i += 2;
    } else if ((c === '{' && raw[i + 1] === '$') || (c === '$' && raw[i + 1] === '{')) {
      const open = c === '{' ? i : i + 1;
      const close = matchClose(raw, open);
      if (close === -1) { lit += c; i++; continue; }
      flush();
      out += '${' + jsExpr(raw.slice(open + 1, close)) + '}';
      i = close + 1;
    } else if (c === '$' && /[A-Za-z_]/.test(raw[i + 1] || '')) {
      const m = /^\$\w+(?:->\w+|\[[^\]]*\])?/.exec(raw.slice(i));
      const e = m[0].replace(/\[([A-Za-z_]\w*)\]$/, "['$1']");
      flush();
      out += '${' + jsExpr(e) + '}';
      i += m[0].length;
    } else {
      lit += c;
      i++;
    }
  }
  flush();
  return '`' + out + '`';
}

// ---------- helpers ----------

function matchClose(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c) && --depth === 0) return i;
  }
  return -1;
}

function splitTopLevel(s) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

function isSimple(a) {
  let depth = 0;
  for (const c of a) {
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && !/[\w.$]/.test(c)) return false;
  }
  return true;
}

function unwrap(a) {
  return a.startsWith('(') && matchClose(a, 0) === a.length - 1 ? a.slice(1, -1).trim() : a;
}
