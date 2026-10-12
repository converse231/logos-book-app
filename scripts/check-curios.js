// Curio consistency check — the four places a curio key must agree:
//   1. the newest migration that defines open_pouch(p_set)   (what the server rolls)
//   2. components/curio/curios.ts  *_KEYS + CURIOS            (what the app can draw)
//   3. assets/curio/<key>.webp                                (the art itself)
//   4. services/mock/index.ts MOCK_CURIO_KEYS                 (mock mode)
// plus the shape rules: every set is 13 (rowsFor + tuning assume it), keys are
// unique across sets, and setOf()'s prefix rule puts each key on its own shelf.
//
//   node scripts/check-curios.js            repo only
//   node scripts/check-curios.js --live     also compares against the live DB
//                                           (needs DATABASE_URL in .env + pg)
//
// Exit code 1 on any mismatch. Run it whenever a key, a set or its art changes.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const quoted = (s) => [...s.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
const fails = [];
const check = (ok, msg) => (ok ? console.log('ok   ' + msg) : (fails.push(msg), console.log('FAIL ' + msg)));

// 1. Server: newest migration with a p_set overload; each `v_<name> constant text[] := array[...]`.
function serverSets(sql) {
  const out = {};
  for (const m of sql.matchAll(/v_(\w+)\s+constant text\[\]\s*:=\s*array\[([^\]]*)\]/g)) out[m[1]] = quoted(m[2]);
  const ids = {};
  for (const m of sql.matchAll(/when '(\w+)'\s+then v_(\w+)/g)) ids[m[1]] = out[m[2]];
  return ids;
}
const migs = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).sort()
  .filter((f) => /open_pouch\(p_set text\)/.test(read('supabase/migrations/' + f)));
const latest = migs[migs.length - 1];
const server = serverSets(read('supabase/migrations/' + latest));

// 2. Client.
const curios = read('components/curio/curios.ts');
const clientSets = {};
for (const m of curios.matchAll(/\{\s*id: '(\w+)',[\s\S]*?keys: (\w+),/g)) {
  const arr = curios.match(new RegExp(`export const ${m[2]} = \\[([\\s\\S]*?)\\] as const`));
  clientSets[m[1]] = arr ? quoted(arr[1]) : null;
}
const curiosBody = curios.slice(curios.indexOf('export const CURIOS'), curios.indexOf('export interface CurioSet'));
const defined = new Set([...curiosBody.matchAll(/^ {2}'?([a-z0-9-]+)'?: \{/gm)].map((m) => m[1]));
const artReq = new Map([...curiosBody.matchAll(/^ {2}'?([a-z0-9-]+)'?: \{[\s\S]*?require\('@\/assets\/curio\/([a-z0-9-]+)\.webp'\)/gm)].map((m) => [m[1], m[2]]));
const bgs = [...curios.matchAll(/bg: require\('@\/assets\/curio\/([a-z0-9-]+)\.webp'\)/g)].map((m) => m[1]);

// setOf, as written in curios.ts, evaluated rather than re-implemented here.
const setOfSrc = curios.match(/export function setOf\(key: string\): CurioSetId \{([\s\S]*?)\n\}/)[1];
const setOf = new Function('key', setOfSrc);

// 4. Mock.
const mock = read('services/mock/index.ts');
const mockBlock = mock.slice(mock.indexOf('const MOCK_CURIO_KEYS'), mock.indexOf('const mockCurios'));
const mockSets = {};
for (const m of mockBlock.matchAll(/^ {2}(\w+): \[([\s\S]*?)\]/gm)) mockSets[m[1]] = quoted(m[2]);

const types = read('services/types.ts').match(/export type CurioSetId = ([^;]+);/)[1];
const typeIds = quoted(types);

console.log(`server source: ${latest}\n`);
const ids = Object.keys(clientSets);
check(JSON.stringify(ids.slice().sort()) === JSON.stringify(Object.keys(server).sort()), `set ids match server: client [${ids}] / server [${Object.keys(server)}]`);
check(JSON.stringify(typeIds.slice().sort()) === JSON.stringify(ids.slice().sort()), `CurioSetId type lists every set: [${typeIds}]`);
const all = [];
for (const id of ids) {
  const c = clientSets[id] ?? [];
  const s = server[id] ?? [];
  all.push(...c);
  check(c.length === 13, `${id}: 13 keys (${c.length})`);
  check(JSON.stringify([...c].sort()) === JSON.stringify([...s].sort()), `${id}: client keys == server keys`);
  check(JSON.stringify([...(mockSets[id] ?? [])].sort()) === JSON.stringify([...c].sort()), `${id}: mock keys == client keys`);
  const missingDef = c.filter((k) => !defined.has(k));
  check(!missingDef.length, `${id}: every key has a CURIOS entry${missingDef.length ? ' — missing ' + missingDef : ''}`);
  const badArt = c.filter((k) => artReq.get(k) !== k || !fs.existsSync(path.join(ROOT, 'assets/curio', k + '.webp')));
  check(!badArt.length, `${id}: every key requires its own existing webp${badArt.length ? ' — bad ' + badArt : ''}`);
  const stray = c.filter((k) => setOf(k) !== id);
  check(!stray.length, `${id}: setOf() puts every key on this shelf${stray.length ? ' — strays ' + stray : ''}`);
}
check(new Set(all).size === all.length, `keys unique across sets (${all.length})`);
const orphans = [...defined].filter((k) => !all.includes(k));
check(!orphans.length, `no CURIOS entry outside a set${orphans.length ? ' — ' + orphans : ''}`);
const badBg = bgs.filter((b) => !fs.existsSync(path.join(ROOT, 'assets/curio', b + '.webp')));
check(!badBg.length && bgs.length === ids.length, `each set has an existing backdrop (${bgs})`);

(async () => {
  if (process.argv.includes('--live')) {
    const { Client } = require('pg');
    const url = read('.env').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^["']|["']$/g, '').trim();
    const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await db.connect();
    const r = await db.query(`select pg_get_functiondef(p.oid) d from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = 'open_pouch'
        and pg_get_function_identity_arguments(p.oid) = 'p_set text'`);
    const live = serverSets(r.rows[0].d);
    for (const id of ids) {
      check(JSON.stringify([...(live[id] ?? [])].sort()) === JSON.stringify([...clientSets[id]].sort()), `LIVE ${id}: deployed open_pouch == client`);
    }
    const owned = await db.query('select distinct curio_key from public.user_curios');
    const undrawable = owned.rows.map((x) => x.curio_key).filter((k) => !defined.has(k));
    check(!undrawable.length, `LIVE every owned curio_key is drawable${undrawable.length ? ' — ' + undrawable : ''}`);
    await db.end();
  }
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
  process.exit(fails.length ? 1 : 0);
})();
