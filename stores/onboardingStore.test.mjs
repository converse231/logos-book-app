// Self-check for firstIncompleteStep — the resume router. Plain node, no
// framework: `node stores/onboardingStore.test.mjs`.
//
// Kept as a copy of the logic rather than an import because the store module
// pulls in react-native/AsyncStorage, which won't load outside Metro. If you
// change firstIncompleteStep, change it here too — the assertions below are the
// spec, and they encode the case that caused the original bug (an authenticated
// reader with a blank funnel must never be treated as "done").
import assert from 'node:assert/strict';

const MIN_GENRES = 2;

function firstIncompleteStep(s) {
  if (s.birthYear == null) return s.genres.length === 0 && !s.username ? 0 : 1;
  if (s.genres.length < MIN_GENRES) return 2;
  if (!s.goalSet) return 3;
  if (!s.username.trim()) return 4;
  return 5;
}

const blank = { birthYear: null, genres: [], goalSet: false, username: '' };
const full = { birthYear: 1990, genres: ['Fantasy', 'Sci-Fi'], goalSet: true, username: 'Alex' };

// Untouched funnel → the welcome screen, not the age gate.
assert.equal(firstIncompleteStep(blank), 0);

// Partial answers but no birth year → the age gate, not back to welcome.
assert.equal(firstIncompleteStep({ ...blank, username: 'Alex' }), 1);
assert.equal(firstIncompleteStep({ ...blank, genres: ['Fantasy'] }), 1);

// Each gap routes to its own screen.
assert.equal(firstIncompleteStep({ ...full, genres: [] }), 2);
assert.equal(firstIncompleteStep({ ...full, genres: ['Fantasy'] }), 2, 'one genre is below the minimum');
assert.equal(firstIncompleteStep({ ...full, goalSet: false }), 3);
assert.equal(firstIncompleteStep({ ...full, username: '' }), 4);
assert.equal(firstIncompleteStep({ ...full, username: '   ' }), 4, 'whitespace is not a name');

// Everything answered → the account step, the only thing left.
assert.equal(firstIncompleteStep(full), 5);

// Earlier gaps win over later ones: never skip a screen to reach the account.
assert.equal(firstIncompleteStep({ ...blank, goalSet: true }), 0);
assert.equal(
  firstIncompleteStep({ birthYear: 1990, genres: [], goalSet: true, username: 'Alex' }),
  2,
  'a missing genre pick must not be skipped just because later answers exist'
);

console.log('firstIncompleteStep: all checks passed');
