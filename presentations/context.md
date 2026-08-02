# context.md — the facts

**Every fact, name, number, and link on a slide comes from this file.** If it isn't here, it
does not go on a slide. No estimates, no "industry average", no placeholder metrics that look
real. If a slide needs a number that isn't here, the slide gets built without the number and
flagged in the outline as `[NEEDS FACT]`.

_Last updated: 2026-07-31_

---

## Who / how to attribute

- Present as **Quire**, the product. No founder name, no personal bio, no headshot on slides.
- No "we" claims about team size or funding — neither exists on a slide.

## What Quire is

- A **gamified reading tracker** for iPhone and Android.
- Tagline: **"Before the book, there was the quire. Track every page you read."**
- A *quire* is a gathering of folded pages — the thing a book is made from before it's a book.
- Emotional north star: make readers feel like **literary athletes**.
- The pitch in one line: gamification isn't bolted onto the tracker — **the gamification is the
  product**.

## What it actually does (safe to show — all of this is built and in the screenshots)

- **Live reading sessions.** Start a timer, read, stop. Pages logged, minutes logged, pages/hour
  calculated. The timer screen is deliberately near-empty — the book title, the clock, and a
  pause button.
- **Streaks.** Consecutive reading days, with a grace window so one bad night doesn't wipe a
  month. Home shows the week as a row of flame dots.
- **XP and levels.** Every session earns XP. Levels carry a **name** you keep — e.g.
  *Chapter Chaser* at level 3. The level name is the identity, not the number.
- **Comeback Challenge.** When a streak breaks, the app offers a short, timed challenge to
  rebuild it instead of just showing a zero.
- **Reading Insights.** Occasional, variable-reward observations about your own reading
  (a page milestone, a best-ever session, the pace you're on for a book).
- **Personal bests**, badges/achievements, and escalating milestone celebrations.
- **Library.** Shelf of everything, filtered by Reading / TBR / Finished / Want. Add books by
  search or barcode scan. Progress per book. Ratings and written reviews.
- **Discover.** NYT bestseller lists, plus a mood-based recommender that suggests books from
  how you say you feel like reading. **Attribution required whenever a bestseller list is
  shown on screen: "Data provided by The New York Times."**
- **Shareable cards.** A session or a review exports as a transparent PNG sized for a story.
- **Audiobooks** are first-class: they log minutes instead of pages.

## Numbers

**There are none yet — Quire is pre-launch.** No users, no waitlist count, no downloads, no
revenue, no funding, no press. Do not put a metric on a slide.

The only figures allowed on a slide are the ones **visibly inside a real screenshot** (e.g. the
`3 DAY STREAK`, `1,784 XP · Level 3`, `380 PAGES` in `home-screenshot.jpg`). Those are demo data
from a test account and must be presented as what they are — a screenshot of the app — never
quoted as traction.

## Links

**None yet.** No App Store link, no TestFlight link, no website, no socials, no contact email
approved for slides.

Any call-to-action slide therefore ends on a **spoken** ask, with a visible
`[ADD LINK]` marker so it can't ship half-finished by accident. Fill this section in and the
CTA slide gets rebuilt properly.

## Off-limits — never on a slide

- **No backend or tech stack.** No Supabase, no Postgres, no edge functions, no React Native /
  Expo, no SQL, no schema, no code from this repo.
- **No internal roadmap language.** Never the phase codenames (F0–F5, B0–B6), never "Phase 2",
  never a dated launch commitment.
- **No unshipped features** presented as if they exist. Specifically not-yet-live and therefore
  off-slide: push notifications, lock-screen / Dynamic Island live activity, native Apple/Google
  sign-in, and paid tiers.
- **No pricing or monetization.** Not free, not paid, not "will be free" — the topic doesn't
  appear.
- **No competitor names** and no comparison charts.
- **No personal data from screenshots.** `home-screenshot.jpg` contains a real first name and
  profile photo — crop, cover, or swap it before that screenshot goes in front of press.
  (Currently used as-is; ask before shipping externally.)
- **No AI-generated fake screenshots or fake UI.** Every screen shown is a real capture from
  the real app. If a screen doesn't exist yet, the slide gets a diagram instead.

## Voice

Warm, plain, a little wry. Short sentences. Concrete nouns.

Say: *streak*, *pages*, *session*, *level name*, *comeback*.
Don't say: *engagement*, *leverage*, *seamless*, *revolutionize*, *ecosystem*, *game-changer*,
*unlock your potential*.

## Assets on hand

Real app screenshots (in `decks/*/assets/`, sourced from repo `assets/screenshots/`):
`home` · `library` · `book-detail` · `discover` · `pre-session` · `session` · `session-finish` ·
`shareable-image` (×2).

Mascot: **Q the fox**, 14 hand-drawn expressions in repo `assets/q-expressions/`.
Streak hero art: `hero-start` · `hero-perfectWeek` · `hero-legend` (wide, painted, night-camp
scenes — good as full-bleed slide art).
App icon: `app-icon.png`.

**Images are never AI-generated for a deck.** If a deck needs art that doesn't exist, write a
generation prompt into the outline and hand it to the user to produce — never invent it inline.
