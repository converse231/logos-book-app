// One runnable check for the ladder: the ordering is the whole logic, so it's the
// thing worth pinning. Mirrors lib/sessionCelebration.ts's table.
import assert from 'node:assert';
import fs from 'node:fs';

const src = fs.readFileSync('lib/sessionCelebration.ts', 'utf8');
const keys = [...src.matchAll(/key: '([\w-]+)'/g)].map((m) => m[1]);
assert.deepStrictEqual(keys, [
  'finished-book','personal-best','achievement','marathon','big',
  'audiobook','late-night','solid','everyday',
], 'ladder order changed');

// Re-derive the rules from the same table shape to exercise precedence.
const MIN = 60;
const L = [
  ['finished-book', c => c.finishedBook],
  ['personal-best', c => c.isPersonalBest],
  ['achievement',   c => c.badgeCount > 0],
  ['marathon',      c => c.durationSeconds >= 60*MIN || (c.pagesRead ?? 0) >= 40],
  ['big',           c => c.durationSeconds >= 30*MIN || (c.pagesRead ?? 0) >= 20],
  ['audiobook',     c => c.isAudiobook],
  ['late-night',    c => c.localHour >= 22 || c.localHour < 5],
  ['solid',         c => c.durationSeconds >= 10*MIN || (c.pagesRead ?? 0) >= 8],
  ['everyday',      () => true],
];
const pick = (o) => L.find(([, w]) => w({
  finishedBook:false, isPersonalBest:false, badgeCount:0,
  durationSeconds:0, pagesRead:0, isAudiobook:false, localHour:14, ...o,
}))[0];

const cases = [
  ['finishing beats everything',      {finishedBook:true, isPersonalBest:true, badgeCount:2}, 'finished-book'],
  ['PB on a 2-minute session',        {isPersonalBest:true, durationSeconds:120},             'personal-best'],
  ['badge beats a marathon',          {badgeCount:1, durationSeconds:90*MIN},                 'achievement'],
  ['90 min at midnight is a marathon',{durationSeconds:90*MIN, localHour:0},                  'marathon'],
  ['40 pages fast is a marathon',     {pagesRead:40, durationSeconds:5*MIN},                  'marathon'],
  ['20 pages is big',                 {pagesRead:20},                                          'big'],
  ['short audiobook',                 {isAudiobook:true, pagesRead:null, durationSeconds:5*MIN}, 'audiobook'],
  ['short session at 23:00',          {durationSeconds:6*MIN, localHour:23},                  'late-night'],
  ['8 pages midday',                  {pagesRead:8},                                           'solid'],
  ['4-page check-in',                 {pagesRead:4, durationSeconds:3*MIN},                   'everyday'],
];
for (const [name, ctx, want] of cases) {
  const got = pick(ctx);
  assert.strictEqual(got, want, `${name}: expected ${want}, got ${got}`);
  console.log('  ok  ' + name.padEnd(34) + '-> ' + got);
}
console.log('\n' + cases.length + ' cases passed, ladder order pinned');
