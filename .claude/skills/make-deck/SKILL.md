---
name: make-deck
description: Builds a single self-contained HTML presentation in presentations/decks/<slug>/ using the Quire deck engine and brand. Use when the user says "make a deck", "build a deck", "build a presentation", "make slides", "slides for X", "a deck about X", "pitch deck", "presentation for X", "turn this into slides", "update the deck", "add a slide", or "restyle the deck". Never uses PowerPoint, a slide framework, npm, or a build step — always one .html file.
---

# make-deck

One self-contained `.html` file per deck. No framework, no npm, no build step. CSS and JS live
inline. It has to open by double-clicking.

## Checklist

1. **Read `presentations/brand.md` and `presentations/context.md` first — every time.**
   Never invent a fact, number, date, link, or quote. Everything comes from `context.md`. If a
   slide needs something that isn't there, build the slide without it, put a visible
   `<span class="todo">[Add link]</span>` on it, and list it under `[NEEDS FACT]` in the
   outline. A plausible-looking fake metric is the worst possible outcome.
   Also obey `context.md`'s **off-limits** list.

2. **Ask for title, audience, and roughly how many slides** (plus: live or recorded?). Then
   write `presentations/decks/<slug>/outline.md` — a table with one row per slide: number,
   slide type, headline, the single idea, the asset it needs. **Get the outline approved before
   writing any slide HTML.**

3. **Create the deck folder and copy the engine:**
   ```
   presentations/decks/<slug>/{outline.md, deck.html, assets/}
   cp presentations/template.html presentations/decks/<slug>/deck.html
   ```
   Then edit only the `<title>` and the markup between `<main class="deck">` and `</main>`.

4. **Get the real assets into `assets/`.** Real screenshots for anything visual — from
   `assets/screenshots/`, or ask the user to capture one. Real logos from the company's actual
   favicon/press kit, **downloaded into `assets/`**, never hotlinked.
   **Never generate an image.** If art doesn't exist, write a generation prompt into
   `outline.md` under `## Image prompts` and hand it to the user.

5. **Compose with the existing slide-type classes** — `s-title` · `s-section` · `s-agenda` ·
   `s-statement` · `s-bullets` · `s-two-col` · `s-cards` · `s-quote` · `s-code` · `s-shot` ·
   `s-art` · `s-cta` · `s-closing`, plus `.logo-tile` `.card` `.grid` `.flow` `.stat` `.pill`
   `.btn` `.frame-phone` `.frame-browser` `.callouts` `.code` `.q`.
   Rules that make it look designed instead of generated:
   - Exactly **one** `<em>` accent word per headline. Never two, never zero on a hero slide.
   - One idea per slide. ≤12-word headline · ≤6 bullets · ≤4 cards · ≤10 lines of code.
   - Screenshots go in `.frame-phone` / `.frame-browser`; logos go in `.logo-tile`.
   - Wall of text → make it a `.flow` diagram.
   - Speaker notes in `<aside class="notes">` on **every** slide.

6. **Leave the template's CSS and `<script>` byte-for-byte untouched.** Engine improvements are
   supposed to reach every deck. Need a new visual? Add the class to `presentations/template.html`
   so future decks get it too — never one-off it inside a deck.

7. **Open it in a browser and check it** — then run the checklist in `presentations/CLAUDE.md`:
   phone-width readability, background depth, arrows / keys / `F` / `O` / `S`, the `#/7` hash,
   every copy button, every image, double-click-to-open.

## Other jobs

- **Restyle everything:** edit the `:root` block in `presentations/template.html`
  (see `brand.md` §8). Existing decks each hold their own copy — paste the new block over
  theirs to bring them along.
- **Ship a deck by email:** inline every image as a base64 `data:` URI first, so the lone
  `.html` file still works.
