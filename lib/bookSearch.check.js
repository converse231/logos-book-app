/*
 * Regression check for the one distinction the offline notice depends on:
 * searchBooks must THROW SearchUnavailableError when every provider fails, and
 * must still return [] when they merely answer with nothing. Collapsing the two
 * is what made a dead connection read as "No results for 'Dune'".
 *
 *   node lib/bookSearch.check.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const src = fs.readFileSync(path.join(__dirname, 'bookSearch.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const mod = { exports: {} };
new Function('module', 'exports', 'require', 'process', js)(
  mod, mod.exports, () => ({}), { env: {} }
);
const { searchBooks, clearSearchCache, isSearchUnavailable } = mod.exports;

const ok = (body) => ({ ok: true, json: async () => body });
let mode = 'fail';
global.fetch = async (url) => {
  if (mode === 'fail') throw new Error('network down');
  if (mode === 'empty') return ok(String(url).includes('googleapis') ? { items: [] } : { docs: [] });
  if (mode === 'google-only') {
    if (String(url).includes('googleapis')) {
      return ok({ items: [{ id: 'g1', volumeInfo: { title: 'Dune', authors: ['Frank Herbert'] } }] });
    }
    throw new Error('open library down');
  }
  throw new Error('unknown mode');
};

(async () => {
  // 1. every provider down → a distinguishable failure, not an empty shelf
  mode = 'fail';
  clearSearchCache();
  await assert.rejects(() => searchBooks('dune'), (e) => isSearchUnavailable(e), 'all-down must throw');

  // 2. providers answered, with nothing → an ordinary empty result
  mode = 'empty';
  clearSearchCache();
  assert.deepStrictEqual(await searchBooks('zzzzqqq'), [], 'genuine no-match must return []');

  // 3. one provider surviving still yields results — a partial outage must not
  //    escalate into an offline notice
  mode = 'google-only';
  clearSearchCache();
  const partial = await searchBooks('dune');
  assert.ok(partial.length > 0, 'one live provider must still return results');
  assert.strictEqual(partial[0].title, 'Dune');

  // 4. subject browsing (Discover's single-provider path) reports failure too
  mode = 'fail';
  clearSearchCache();
  await assert.rejects(() => searchBooks('subject:fiction'), (e) => isSearchUnavailable(e), 'subject path must throw');

  console.log('OK — offline is distinguishable from empty on both search paths');
})();
