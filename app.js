(function () {
  'use strict';

  var TLAG_MAPPING = [
    '// Tlag consonants: longest spellings first for readability',
    '// (matching is always longest-first, so order does not matter)',
    '// first variant is written; every variant is accepted going IPA to spelling',
    'tl = ʈ͡ɭ˔ / ʈɭ˔ / t͡ɬ / tɬ',
    'ts = t͡sʼ / tsʼ / t͡s / ts',
    'f = p̪͡f / p̪f',
    'b = b̪͡v / b̪v',
    'm = m',
    '// n varies with its neighbours in narrow transcription (dental, palatal)',
    'n = ɳ / n / ɲ',
    'g = ŋ',
    '// stops are written with the ejective mark; plain readings still convert back',
    'p = pʼ / p',
    't = ʈʼ / ʈ',
    'k = kʼ / k',
    '// s is retroflex, but plain s still converts back (as in [sʈ])',
    's = ʂ / s',
    'z = ʐ',
    'c = ɕ',
    'x = x',
    'h = h',
    'j = j',
    'r = ɾ',
    'l = ɮ',
    '// Tlag vowels (tilde variants are nasalised neighbours in narrow transcription)',
    'aa = ɑ / ɑ̃',
    'i = i / ĩ',
    'e = ɛ / ɛ̃',
    'a = æ / æ̃',
    'v = ə / ə̃',
    'u = u / ũ',
    'o = o / õ'
  ].join('\n');

  var PRESETS = [
    { label: 'Tlag', m: TLAG_MAPPING, o: 'Homaa pvnv tlaghv ne.', from: 'o' },
    { label: 'Mini demo',
      m: '// a tiny demo: digraphs, and th reads both gifts\nsh = ʃ\nch = tʃ\nth = θ / ð\na = a\ni = i\nu = u',
      o: 'thachushi shathi',
      from: 'o' },
    { label: 'Blank', m: '', o: '', from: 'o' }
  ];

  var DEFAULTS = { m: PRESETS[0].m, o: PRESETS[0].o, i: '', from: 'o', fold: true };

  /* mapping parser */

  function parseMapping(text) {
    var entries = [], errors = [], warnings = [];
    var seenOrtho = {}, seenIpa = {};
    String(text).split(/\r?\n/).forEach(function (raw, idx) {
      var line = raw.trim();
      if (!line || line.indexOf('//') === 0) return;
      var sep = line.indexOf('=');
      var colon = line.indexOf(':');
      if (sep < 0 || (colon >= 0 && colon < sep)) sep = colon;
      if (sep < 0) {
        errors.push('Line ' + (idx + 1) + ' needs an "=" or ":", like sh = ʃ.');
        return;
      }
      var left = line.slice(0, sep).trim();
      var right = line.slice(sep + 1).trim();
      if (!left) {
        errors.push('Line ' + (idx + 1) + ' has nothing before the "=".');
        return;
      }
      var variants = right.split('/').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!variants.length) {
        errors.push('Line ' + (idx + 1) + ' has nothing after the "=". Write it like sh = ʃ.');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(seenOrtho, left)) {
        warnings.push('"' + left + '" is defined twice; the later line wins.');
      }
      seenOrtho[left] = true;
      variants.forEach(function (v) {
        if (Object.prototype.hasOwnProperty.call(seenIpa, v) && seenIpa[v] !== left) {
          warnings.push('IPA "' + v + '" is claimed by both "' + seenIpa[v] + '" and "' + left +
            '"; going IPA to spelling, the longer spelling wins.');
        } else if (!Object.prototype.hasOwnProperty.call(seenIpa, v)) {
          seenIpa[v] = left;
        }
      });
      entries.push({ ortho: left, ipas: variants });
    });
    return { entries: entries, errors: errors, warnings: warnings };
  }

  function buildTables(parsed, fold) {
    function norm(s) { return fold ? s.toLowerCase() : s; }
    var fwd = {}, rev = {};
    parsed.entries.forEach(function (e) {
      fwd[norm(e.ortho)] = e.ipas[0];
      e.ipas.forEach(function (v) {
        var k = norm(v);
        if (!Object.prototype.hasOwnProperty.call(rev, k) ||
            e.ortho.length > rev[k].ortho.length) {
          rev[k] = { out: e.ortho, ortho: e.ortho };
        }
      });
    });
    function keysDesc(map) {
      return Object.keys(map).sort(function (a, b) { return b.length - a.length; });
    }
    return { fwd: fwd, rev: rev, fwdKeys: keysDesc(fwd), revKeys: keysDesc(rev) };
  }

  function convert(text, tables, dir, fold) {
    var keys = dir === 'o2i' ? tables.fwdKeys : tables.revKeys;
    var map = dir === 'o2i' ? tables.fwd : tables.rev;
    var src = String(text);
    var cmp = fold ? src.toLowerCase() : src;
    var out = '', pos = 0, hits = 0, kept = {}, keptCount = 0;
    while (pos < src.length) {
      var match = null, matchLen = 0;
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (cmp.substr(pos, key.length) === key) { match = key; matchLen = key.length; break; }
      }
      if (match !== null) {
        var v = map[match];
        out += (v && typeof v === 'object') ? v.out : v;
        pos += matchLen;
        hits++;
      } else {
        var cp = String.fromCodePoint(src.codePointAt(pos));
        out += cp;
        pos += cp.length;
        if (!/\s/.test(cp)) {
          kept[cp] = (kept[cp] || 0) + 1;
          keptCount++;
        }
      }
    }
    return { text: out, hits: hits, kept: kept, keptCount: keptCount };
  }

  /* page wiring */

  function $(id) { return document.getElementById(id); }

  var PICKER = [
    { label: 'Stops', keys: ['p', 'b', 't', 'd', 'ʈ', 'ɖ', 'c', 'ɟ', 'k', 'g', 'q', 'ɢ', 'ʔ'] },
    { label: 'Affricates & fricatives', keys: ['ts', 'dz', 'tʃ', 'dʒ', 'tɕ', 'dʑ', 'ɸ', 'β', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'ʂ', 'ʐ', 'ɕ', 'ʑ', 'ç', 'ʝ', 'x', 'ɣ', 'χ', 'ʁ', 'h', 'ɦ', 'ɬ', 'ɮ'] },
    { label: 'Nasals, liquids & glides', keys: ['m', 'ɱ', 'n', 'ɳ', 'ɲ', 'ŋ', 'ɴ', 'r', 'ɾ', 'ɹ', 'ɻ', 'l', 'ɭ', 'ʎ', 'ʋ', 'ɰ', 'j', 'ɥ', 'w'] },
    { label: 'Vowels', keys: ['i', 'y', 'ɨ', 'ʉ', 'ɯ', 'u', 'ɪ', 'ʏ', 'ʊ', 'e', 'ø', 'ɘ', 'ɵ', 'ɤ', 'o', 'ə', 'ɛ', 'œ', 'ɜ', 'ɞ', 'ʌ', 'ɔ', 'æ', 'ɐ', 'a', 'ɶ', 'ɑ', 'ɒ'] },
    { label: 'Stress, length & diacritics', keys: ['ˈ', 'ˌ', 'ː', 'ˑ', '̃', 'ʰ', 'ʷ', 'ʲ', 'ˠ', 'ˤ', 'ʼ', '̥', '̬', '̪', '̟', '̠', '˔', '͡', 'ʻ', '.', '[', ']'] }
  ];

  var el = {
    mapping: $('mapping'), fold: $('foldcase'),
    ortho: $('ortho'), ipa: $('ipa'),
    meta: $('meta'), notes: $('notes'), status: $('status'),
    pickerGroups: $('picker-groups'), pickerTarget: $('picker-target')
  };

  var lastEdited = 'o';
  var pickerTarget = 'ipa';
  var timer = null;

  function read() {
    return { m: el.mapping.value, o: el.ortho.value, i: el.ipa.value, fold: el.fold.checked, from: lastEdited };
  }

  function write(s) {
    el.mapping.value = s.m;
    el.ortho.value = s.o;
    el.ipa.value = s.i;
    el.fold.checked = !!s.fold;
    lastEdited = s.from === 'i' ? 'i' : 'o';
  }

  function toQuery(s) {
    var q = new URLSearchParams();
    q.set('m', s.m);
    if (s.o) q.set('o', s.o);
    if (s.i) q.set('i', s.i);
    q.set('from', s.from);
    q.set('fold', s.fold ? '1' : '0');
    return q.toString();
  }

  function fromQuery() {
    var q = new URLSearchParams(window.location.search);
    var s = { m: DEFAULTS.m, o: DEFAULTS.o, i: DEFAULTS.i, from: DEFAULTS.from, fold: DEFAULTS.fold };
    if (q.has('m')) s.m = q.get('m');
    if (q.has('o')) s.o = q.get('o');
    if (q.has('i')) s.i = q.get('i');
    if (q.get('from') === 'i' || q.get('from') === 'o') s.from = q.get('from');
    if (q.has('fold')) s.fold = q.get('fold') !== '0';
    else if (q.has('m') || q.has('o') || q.has('i')) { /* keep default fold */ }
    return s;
  }

  function updateUrl(s) {
    try { window.history.replaceState(null, '', window.location.pathname + '?' + toQuery(s)); }
    catch (e) { /* file:// and some sandboxes refuse; the converter still works */ }
  }

  function say(msg) {
    el.status.textContent = msg;
    clearTimeout(say.t);
    say.t = setTimeout(function () { el.status.textContent = ''; }, 2800);
  }

  function copy(text, msg) {
    function fallback() {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', '');
      t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); say(msg); }
      catch (e) { say('Copy failed. Select the text and copy it by hand.'); }
      document.body.removeChild(t);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { say(msg); }, fallback);
    } else fallback();
  }

  function run() {
    var s = read();
    var parsed = parseMapping(s.m);
    var tables = buildTables(parsed, s.fold);
    var result, dirLabel;
    try {
      if (lastEdited === 'i') {
        result = convert(s.i, tables, 'i2o', s.fold);
        el.ortho.value = result.text;
        dirLabel = 'IPA → spelling';
      } else {
        result = convert(s.o, tables, 'o2i', s.fold);
        el.ipa.value = result.text;
        dirLabel = 'spelling → IPA';
      }
    } catch (e) {
      result = { text: '', hits: 0, kept: {}, keptCount: 0 };
      parsed.errors.push('Something went wrong: ' + e.message);
    }

    var notes = parsed.errors.concat(parsed.warnings);
    if (!parsed.entries.length && !parsed.errors.length) {
      notes.push('Add a mapping to start converting — or pick the Tlag preset above.');
    }
    var keptChars = Object.keys(result.kept).sort().slice(0, 12);
    if (keptChars.length) {
      notes.push('Kept as-is (' + result.keptCount + '): ' + keptChars.join(' ') +
        (Object.keys(result.kept).length > 12 ? ' …' : '') +
        ' — anything with no rule passes through unchanged.');
    }

    el.notes.textContent = '';
    notes.forEach(function (msg) {
      var d = document.createElement('div');
      d.textContent = msg;
      el.notes.appendChild(d);
    });
    el.notes.hidden = !notes.length;

    el.meta.textContent = parsed.entries.length
      ? parsed.entries.length + (parsed.entries.length === 1 ? ' rule' : ' rules') + ' · ' + dirLabel
      : dirLabel;

    updateUrl({ m: s.m, o: el.ortho.value, i: el.ipa.value, from: lastEdited, fold: s.fold });
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(run, 150); }

  /* presets */

  var presetBox = $('presets');
  PRESETS.forEach(function (pr) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn--small'; b.textContent = pr.label;
    b.addEventListener('click', function () {
      el.mapping.value = pr.m;
      el.ortho.value = pr.o || '';
      el.ipa.value = '';
      lastEdited = pr.from || 'o';
      run();
      say('Loaded "' + pr.label + '".');
    });
    presetBox.appendChild(b);
  });

  /* events */

  el.ortho.addEventListener('input', function () { lastEdited = 'o'; schedule(); });
  el.ipa.addEventListener('input', function () { lastEdited = 'i'; schedule(); });
  el.mapping.addEventListener('input', schedule);
  el.fold.addEventListener('change', run);

  el.ortho.addEventListener('focus', function () {
    pickerTarget = 'ortho';
    el.pickerTarget.textContent = 'Tapping a symbol types it into the spelling box. Click into a box first to redirect the picker there.';
  });
  el.ipa.addEventListener('focus', function () {
    pickerTarget = 'ipa';
    el.pickerTarget.textContent = 'Tapping a symbol types it into the IPA box. Click into a box first to redirect the picker there.';
  });
  el.mapping.addEventListener('focus', function () {
    pickerTarget = 'mapping';
    el.pickerTarget.textContent = 'Tapping a symbol types it into the mapping box (right-hand side). Click into a box first to redirect the picker there.';
  });

  $('swap').addEventListener('click', function () {
    // the box you were editing keeps driving: its text moves, the other converts
    var o = el.ortho.value;
    el.ortho.value = el.ipa.value;
    el.ipa.value = o;
    run();
    say('Swapped the two boxes.');
  });
  $('copy-ortho').addEventListener('click', function () {
    if (!el.ortho.value) { say('Nothing to copy yet.'); return; }
    copy(el.ortho.value, 'Spelling copied.');
  });
  $('copy-ipa').addEventListener('click', function () {
    if (!el.ipa.value) { say('Nothing to copy yet.'); return; }
    copy(el.ipa.value, 'IPA copied.');
  });
  $('copy-link').addEventListener('click', function () {
    clearTimeout(timer); run();
    copy(window.location.href, 'Link copied.');
  });

  /* IPA picker */

  function insertAtCursor(field, text) {
    field.focus();
    var start = field.selectionStart != null ? field.selectionStart : field.value.length;
    var end = field.selectionEnd != null ? field.selectionEnd : field.value.length;
    try {
      if (typeof field.setRangeText === 'function') {
        field.setRangeText(text, start, end, 'end');
      } else {
        field.value = field.value.slice(0, start) + text + field.value.slice(end);
      }
    } catch (e) {
      field.value += text;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  PICKER.forEach(function (group) {
    var wrap = document.createElement('div');
    wrap.className = 'picker-group';
    var lab = document.createElement('span');
    lab.textContent = group.label;
    wrap.appendChild(lab);
    var keys = document.createElement('div');
    keys.className = 'picker-keys';
    group.keys.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'key'; b.textContent = k;
      b.title = 'Insert "' + k + '"';
      b.addEventListener('click', function () {
        var field = el[pickerTarget] || el.ipa;
        insertAtCursor(field, k);
        if (pickerTarget === 'ortho') lastEdited = 'o';
        else if (pickerTarget === 'ipa') lastEdited = 'i';
      });
      keys.appendChild(b);
    });
    wrap.appendChild(keys);
    el.pickerGroups.appendChild(wrap);
  });

  write(fromQuery());
  run();

  window.OrthoConverter = {
    parseMapping: parseMapping,
    buildTables: buildTables,
    convert: convert,
    PRESETS: PRESETS
  };
})();
