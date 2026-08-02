# CLAUDE.md — presentations

Rules for every deck built in this folder. Loaded every session.

## The format — non-negotiable

**One self-contained `.html` file per deck.** No PowerPoint. No slide framework (no reveal.js,
Slidev, Spectacle, Marp). No npm, no bundler, no build step, no dependencies. CSS and JS live
inline in the file. It opens by double-clicking. If a request seems to call for a framework,
the answer is still one HTML file.

The only external request a deck makes is the Google Fonts `<link>`, and the deck degrades
gracefully without it.

## Folder shape

```
presentations/
├── CLAUDE.md        this file
├── brand.md         the visual contract — colors, fonts, sizes, emphasis rule
├── context.md       real facts only — bio, features, numbers, links, off-limits list
├── template.html    the deck engine (nav, overview, notes, copy buttons, slide types)
└── decks/<slug>/
    ├── outline.md   written BEFORE any slide HTML
    ├── deck.html    the presentation
    └── assets/      images for THIS deck only (copied in, never linked out)
```

One folder per deck so the deck and its images ship together.

## Order of operations

1. **Read `brand.md` and `context.md` first.** Every time. Before writing anything.
2. **Never invent a fact.** No numbers, names, dates, links, quotes, or testimonials that
   aren't in `context.md`. If a slide needs one that isn't there, build the slide without it
   and put a visible `<span class="todo">[Add link]</span>` marker on it plus a `[NEEDS FACT]`
   line in `outline.md`. A plausible-looking fake metric is the worst possible outcome.
3. **Write `outline.md` before any HTML.** One line per slide: number, slide type, headline,
   the single idea, what asset it needs. Get it approved.
4. **Copy `template.html` → `decks/<slug>/deck.html`**, then edit only the markup between
   `<main class="deck">` and `</main>`, plus the `<title>`.
5. **Leave the template's CSS and JS untouched.** Improvements to the engine are supposed to
   carry over to every deck. Need a new visual? Add a *slide-type class* to `template.html`
   so every future deck gets it too — don't one-off it inside a deck.
6. **Open it in a browser and actually check it** against the checklist below.

## Content rules

- One idea per slide. If the headline needs "and", it's two slides.
- **Exactly one accent word per headline**, marked with `<em>`. Never two, never zero on a
  hero slide. (`brand.md` §6)
- Density ceilings: ≤12-word headline · ≤6 bullets · ≤12 words per bullet · ≤4 cards ·
  ≤10 lines of code.
- Stats are a **mono figure at `--fs-num` with a small label**, never a number buried in a
  sentence.
- Speaker notes on **every** slide — that's where the sentences go, not the slide.

## Asset rules

1. **Show, don't tell.** A slide about a screen gets a real screenshot of that screen, inside
   `.frame-phone` or `.frame-browser`. Never a description of a screen, never a mockup.
2. **Real logos only**, pulled from the company's actual favicon / press kit and **saved into
   the deck's `assets/`** — never hotlinked, so the deck works offline.
3. **Every logo sits in a rounded tile** (`.logo-tile`) with a border and hard shadow, like an
   app icon on a home screen. Never a bare square floating on the slide.
4. **Diagrams beat paragraphs.** A slide turning into a wall of text becomes a `.flow` diagram.
5. **Never generate images.** Not screenshots, not illustrations, not fake UI. If a deck needs
   art that doesn't exist, write the generation prompt into `outline.md` under
   `## Image prompts` and hand it to the user to produce or supply.
6. **Self-contained before sharing.** Deck folders use relative `assets/` paths, which work
   when the folder is opened locally or zipped. Before the deck gets **emailed or sent as a
   lone file**, inline every image as a base64 `data:` URI so the single `.html` works alone.

## Before calling it done

- [ ] Readable with the window shrunk to phone width (~390px) — nothing under 18px, no
      horizontal scroll, two-column layouts stack
- [ ] Background has depth (wash + dot grid + vignette), not a flat fill
- [ ] Arrows click, arrow keys / space work, `F` fullscreen, `O` overview, `S` notes
- [ ] `#/7` hash updates and a refresh lands on the same slide
- [ ] Every copy button copies and flips to "Copied ✓"
- [ ] Every image loads (no broken frames); every logo is in a rounded tile
- [ ] Speaker notes exist on every slide
- [ ] Opens correctly by double-clicking the file from the folder
- [ ] No fact on any slide that isn't in `context.md`
