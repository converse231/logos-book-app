# Outline — Join the Quire beta

**Audience:** prospective beta testers and press.
**Watched:** live screen-share *and* recorded on a phone.
**Length:** 10 slides, ~6 minutes spoken.
**Ask:** try it, read with it for a week, tell us what breaks.

**Fact discipline:** Quire is pre-launch — `context.md` says there are no users, no waitlist,
no downloads, no funding, no press. **Zero metrics appear on any slide.** The only figures are
the ones visibly inside real screenshots, and they're framed as screenshots of the app, never
as traction. No links exist yet, so the CTA slide carries a visible `[ADD LINK]` marker.

---

| # | Type | Headline | The one idea | Asset |
|---|------|----------|--------------|-------|
| 1 | `s-title` | **Track every page you read.** | What Quire is, in one breath | `app-icon.png` in a tile · `q-waving.png` |
| 2 | `s-statement` | Reading is the one habit that keeps **no score** | The gap that makes the whole thing make sense | `q-thinking.png` |
| 3 | `s-two-col` | Trackers log the **finish**. Nobody finishes. | Existing tracking rewards the wrong moment | none — contrast columns |
| 4 | `s-art` | Treat readers like **athletes** | The positioning line, over the streak-camp art | `hero-legend.jpg` full-bleed |
| 5 | `s-cards` | Four things that make you **come back** | The gamification core: streak · XP/levels · comeback · insight | 4 cards, one per reward colour |
| 6 | `s-shot` | Your reading, with a **scoreboard** | Home screen does the motivating | `home-screenshot.jpg` in phone frame + 3 callouts |
| 7 | `s-shot` | A timer that gets **out of the way** | The session loop: start → read → rewarded | `session-screenshot.jpg` + `session-finish-screenshot.jpg`, two phones |
| 8 | `s-shot` | Proof you can **post** | Share card + library — the social surface | `shareable-image-screenshot.jpg` + `library-screenshot.jpg`, two phones |
| 9 | `s-cards` (flow) | What a week **looks like** | The loop as a diagram, not a paragraph | `.flow.loop` diagram + `q-confident.png` |
| 10 | `s-cta` | Read for a week. Tell us what **breaks.** | The ask | `q-proud.png` · `[ADD LINK]` marker |

---

## Slide notes

**1 — Title.** App icon in a rounded tile, kicker "Beta · 2026", hero
"Track every page you *read*.", subtitle uses the real tagline from `context.md`
("Before the book, there was the quire."). Q waving bottom-right.

**2 — Statement.** Accent word: *no score*. Support line: you can see your steps, your sleep,
your workouts — reading is the one daily habit with nothing keeping count.

**3 — Two column.** Left "What tracking looks like today" (log a finished book / a shelf that
judges you / nothing happens for two weeks). Right, accent-headed, "What actually needs
tracking" (the twenty minutes you read tonight / the day you didn't skip / the pace you're
holding). No competitor named — `context.md` forbids it.

**4 — Art.** Full-bleed `hero-legend.jpg` (painted night-camp scene, Q in a crown by a
campfire — real in-app streak art, not generated for this deck). Overlay statement
"Treat readers like *athletes*." Kicker: "The north star."

**5 — Cards.** Four cards, one reward colour each:
Streak (ember) · Levels with names (gold fill) · Comeback Challenge (accent fill) · Reading
Insight (plain). Copy stays feature-level, no mechanics claims beyond what's in `context.md`.

**6 — Home screenshot.** Phone frame + three callouts: streak card, the week of flame dots,
level name + XP bar. Caption states plainly that the figures are a test account.
**⚠ Personal data:** this screenshot shows a real first name and profile photo.
`context.md` flags it — crop or swap before sending to press.

**7 — Session.** Two phones: the near-empty timer, then session-complete with the fox and the
XP tile. The point is the contrast between the two screens.

**8 — Share + library.** Two phones: transparent share-card composer, and the library shelf.
Point: the reward is postable, and the shelf is the thing you're building.

**9 — Loop diagram.** `.flow.loop` — Start a session → Log the pages → Keep the streak →
**Get pulled back** (last node accent-filled). Q confident alongside.

**10 — CTA.** "Read for a week. Tell us what *breaks*." Two lines of what we want back
(what you stopped using, what made you open it again). `[ADD LINK]` marker until a
TestFlight/App Store link lands in `context.md`.

---

## [NEEDS FACT]

- **TestFlight / App Store / signup link** — slide 10 ships with a red `[ADD LINK]` marker
  until this exists in `context.md`.
- **Contact for feedback** (email or form) — same slide, same treatment.
- **Any real tester quote** — there's a `s-quote` slide type ready in `template.html`; the
  deck deliberately has no quote slide because no real quote exists yet.

## Image prompts (for the user to generate — never generated here)

### A. Half-body "peek" Q set — the priority

The deck uses `.q-peek`, which crops the existing full-body PNGs to a half-body. That works,
but purpose-drawn half-body art is better: bigger head, readable expression, and the crop line
lands where it should. Save into `assets/` as `q-peek-<pose>.png`, then set `--peek-ar:1/1` on
`.q-peek` (or per-slide with `style="--peek-ar:1/1"`).

**Shared style block — paste this in front of every pose prompt:**

> *"Flat vector cartoon fox character, half-body / waist-up crop, children's picture-book
> illustration style. Orange fur (#F0764F to #E8683F), cream-white chest, muzzle and tail tip
> (#FCF8ED), thick warm soft-black outlines (#241E19) of even weight, small soft pink cheek
> blush, simple solid black oval eyes with a single white highlight dot, small dark rounded
> nose. Absolutely no gradients, no shading, no textures, no drop shadows, no background
> scenery. Fully transparent background, PNG. Square 1:1 canvas. The character is cropped at
> roughly the waist by the bottom edge of the frame, head and shoulders filling the upper
> two-thirds, body angled slightly toward the left of frame as if leaning in from the right
> side of a screen. No text, no logos, no border."*

Then append **one** of these:

1. **`q-peek-waving.png`** — *"Pose: one arm raised in a friendly open-palm wave, other paw
   relaxed at the side, wide happy open smile, eyes cheerfully closed in upward crescents."*
2. **`q-peek-thinking.png`** — *"Pose: one paw raised to the chin in a thoughtful gesture, head
   tilted slightly, eyebrows raised, small curious closed-mouth smile, eyes looking up and to
   the side."*
3. **`q-peek-reading.png`** — *"Pose: holding an open book up in both paws at chest height, only
   the eyes and ears visible peeking over the top edge of the book, delighted expression. Book
   cover is flat marigold #F3C24C with a thin ink outline and no text."*
4. **`q-peek-proud.png`** — *"Pose: arms folded confidently across the chest, chin slightly
   lifted, warm satisfied closed-mouth smile, a small flat marigold #F3C24C five-point star
   badge on the chest."*
5. **`q-peek-cheering.png`** — *"Pose: both arms thrown straight up in celebration, mouth wide
   open in a joyful shout, eyes closed in happy crescents, ears perked upward."*
6. **`q-peek-pointing.png`** — *"Pose: one arm extended pointing to the left of frame at
   something off-screen, other paw on hip, bright encouraging open smile, eyes following the
   pointing paw."*

**Mirrored variants:** for `.q-peek.left`, generate the same pose with *"body angled slightly
toward the right of frame as if leaning in from the left side of a screen"* and save as
`q-peek-<pose>-left.png`. Don't CSS-flip — it mirrors the blush and the badge.

Slots in this deck: **1** → waving · **2** → thinking · **10** → proud.

### B. Scene art — optional

The deck is complete and correct without these.

1. **`q-athlete.png` — for slide 4.** *"Q the fox as a literary athlete: the same hand-drawn
   flat-vector cartoon fox character (orange fur, cream chest and tail tip, simple black
   outlines, no gradients), standing in a confident sprinter's finish-line pose with one arm
   raised, wearing a small race bib with an open book icon on it. Full body, front three-quarter
   view, centered, transparent background, PNG. Warm Paper & Ink palette: coral #F0764F,
   marigold #F3C24C, amber #F2913F, warm soft-black ink #241E19 outlines. Children's-picture-book
   illustration style, clean vector look, no shading gradients, no text."*

2. **`q-stopwatch.png` — for slide 7.** *"Q the fox holding a large stopwatch: same hand-drawn
   flat-vector cartoon fox (orange fur, cream chest, black ink outlines), sitting cross-legged
   with an open book on his lap and a coral-red stopwatch held up in one paw, calm focused
   expression. Full body, transparent background, PNG. Paper & Ink palette: coral #F0764F,
   marigold #F3C24C, ink #241E19. Flat vector children's-book illustration, no gradients,
   no text."*

3. **`hero-week.jpg` — optional full-bleed for slide 9.** *"Wide cinematic 21:9 painted
   illustration, warm night scene: a cozy reading nook by a window with seven small candles in
   a row on the sill, six lit and glowing amber, one unlit. Deep indigo and violet night sky
   with stars outside, warm amber lamplight inside, a stack of books and a folded blanket.
   Painterly storybook style with soft brush texture, no characters, no text. Palette: deep
   indigo #2B2350, violet, amber #F2913F, marigold #F3C24C, warm cream #FCF8ED."*
