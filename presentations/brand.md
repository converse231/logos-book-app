# brand.md — the visual contract

Every deck in `decks/` follows this file. Change a value here, change every deck.
The values below are the **live CSS variables** in `template.html` — the names match exactly,
so a find-and-replace in `template.html`'s `:root` block is the whole restyle.

Brand source: Quire's in-app **Paper & Ink** design system (`theme/tokens.ts`). The deck is
supposed to look like the app, on purpose.

---

## 1. Colors (CSS variables)

```css
:root {
  /* substrate */
  --bg:        #F6EEDF;   /* warm oat paper — the page */
  --bg-card:   #FCF8ED;   /* warm cream — cards, frames, code blocks (never stark white) */
  --bg-inset:  #F0E6D3;   /* inset cream — wells, thumbnails, muted tiles */

  /* ink */
  --text:      #241E19;   /* warm soft-black — body text AND borders AND hard shadows */
  --muted:     #6E6250;   /* warm secondary — kickers, captions, notes */
  --faint:     #9A8E79;   /* warm tertiary — slide numbers, dividers */

  /* accents — one meaning each, never swapped */
  --accent:    #F0764F;   /* coral — THE emphasis colour, CTAs, active state */
  --ember:     #D9730F;   /* amber — streaks / momentum (readable-on-light tone) */
  --gold:      #C8892C;   /* marigold — XP, levels, achievement (readable tone) */
  --gold-fill: #F3C24C;   /* bright marigold — for FILLS only, ink text on top */
  --lilac:     #8257C7;   /* violet — celebration / level-up */
  --danger:    #B4271B;   /* deep crimson — warnings only. NEVER reuse --accent for danger. */

  /* on-fill */
  --on-accent: #241E19;   /* INK text on coral fills — the Paper & Ink signature. Not white. */
}
```

**Rules**

- `--accent` is coral and coral only. Streak = `--ember`, XP/levels = `--gold`, celebration =
  `--lilac`. One reward type, one colour — don't decorate with them.
- Text on a coral or gold fill is **ink**, never white.
- No gradients on the substrate. No glass, no blur, no glow halos. (See §4.)

---

## 2. Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Schibsted+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

```css
--font-display: 'Fraunces', Georgia, serif;                    /* HERO moments only */
--font-ui:      'Schibsted Grotesk', system-ui, sans-serif;    /* headings + body + UI */
--font-mono:    'JetBrains Mono', ui-monospace, monospace;     /* all numbers + code + labels */
```

| Font | Use it for | Never |
|---|---|---|
| **Fraunces** (serif) | Slide titles, section headers, one-big-statement, quotes, closing line | Small labels, body copy, anything under 18px |
| **Schibsted Grotesk** | Body, bullets, card text, buttons. UPPERCASE + letter-spacing for structural labels | Big numerics |
| **JetBrains Mono** | Every figure, stat, counter, slide number, code, kicker labels. `font-variant-numeric: tabular-nums` on figures | Prose |

Fonts load from Google. **Offline note:** a deck opened with no network falls back to
Georgia / system-ui / monospace and still reads fine — the layout doesn't shift because every
size is set on the container, not the glyphs. If a deck must be pixel-identical offline, ask
for the fonts to be inlined as base64 `@font-face`.

---

## 3. Text sizes — presentation sizing, not website sizing

Every size is a `clamp(floor, viewport, ceiling)`. The **floor is the phone-recording floor**:
nothing in a deck is ever smaller than 12px, and nothing carrying meaning is smaller than 18px.

```css
--fs-hero:  clamp(46px, 7.4vw, 136px);  /* title slide, one-big-statement */
--fs-h1:    clamp(34px, 5.0vw, 88px);   /* slide headline */
--fs-h2:    clamp(26px, 3.4vw, 56px);   /* sub-head, card title, quote */
--fs-lead:  clamp(20px, 2.3vw, 38px);   /* lead paragraph, bullets */
--fs-body:  clamp(18px, 1.75vw, 30px);  /* body — the absolute floor for real content */
--fs-label: clamp(12px, 0.95vw, 18px);  /* UPPERCASE mono kickers only */
--fs-mono:  clamp(15px, 1.35vw, 24px);  /* code blocks */
--fs-num:   clamp(40px, 5.2vw, 92px);   /* stat figures */
```

**Line-length caps — short lines or it isn't a slide:**

```css
--measure-hero:  18ch;   /* headlines wrap after ~3 words */
--measure-head:  26ch;
--measure-body:  38ch;   /* body copy never exceeds this */
```

**Density budget per slide** (hard limits — over budget means split the slide):

- ≤ 12 words in a headline
- ≤ 6 bullets, ≤ 12 words each
- ≤ 4 cards in a card grid
- ≤ 10 lines in a code block

---

## 4. Background with depth

Flat single-colour is banned. `template.html` layers three things behind every slide, all
token-driven:

1. **Gradient wash** — two very faint radial pools: coral at 8% top-left, marigold at 7%
   bottom-right, over `--bg`. Warms the paper without becoming a gradient background.
2. **Dot-journal grid** — 46px cells, ~2.4px dots at 6% ink. Same grid as the app's
   `ScreenBackground`. This is the texture that makes it read as paper.
3. **Vignette** — a soft inset radial darkening the outer edges ~5%, so the slide content
   sits in a pool of light.

```css
--wash-a:    rgba(240,118,79,0.08);
--wash-b:    rgba(243,194,60,0.07);
--grid-dot:  rgba(36,30,25,0.06);
--grid-size: 46px;
--vignette:  rgba(36,30,25,0.05);
```

---

## 5. Structure — borders, radii, shadows

Soft-brutalism: thick ink borders, **rounded** corners, **hard offset** shadows (no blur).

```css
--bw:        2px;      /* standard border */
--bw-thick:  3px;      /* hero surfaces, primary buttons */
--r-sm:      10px;     /* chips, pills */
--r-md:      14px;     /* buttons, inputs, small tiles */
--r-lg:      18px;     /* logo tiles, medium surfaces */
--r-card:    20px;     /* the standard card */
--r-xl:      26px;     /* hero cards, phone/browser frames */

--shadow-sm:   2px 3px 0 var(--text);
--shadow-card: 4px 4px 0 var(--text);
--shadow-lg:   6px 6px 0 var(--text);
/* hero only — hard offset PLUS a whisper of warm ambient depth */
--shadow-hero: 6px 6px 0 var(--text), 0 18px 28px -14px rgba(36,30,25,0.30);
```

Interactive things **press into** their shadow on hover: `translate(2px,2px)` and halve the
offset. Nothing lifts up, nothing glows.

---

## 6. The one emphasis rule

> **Exactly one accent-coloured word per headline. Never two. Never zero on a hero slide.**

```html
<h1>Reading is the one habit that keeps <em>no score</em></h1>
```

`<em>` inside a headline is the accent marker (`color: var(--accent)`, not italic).

Corollaries that keep decks from looking auto-generated:

- One idea per slide. If it needs "and", it's two slides.
- A stat is a **figure in mono at `--fs-num`** with a small label under it — not a sentence
  with a number inside it.
- Never bold for emphasis inside body copy. Emphasis is the accent word, and it's used once.
- Never two competing accent colours on one slide. Pick the one that matches the meaning.

---

## 7. Mascot — Q the fox

Q appears at **emotional beats only** (one per 3–4 slides, max), never as decoration on a data
slide. Files live in each deck's `assets/`, pulled from `assets/q-expressions/`.

| Expression | Beat |
|---|---|
| `q-waving` | Opening / title |
| `q-thinking` | Problem framing |
| `q-happy` / `q-surprised` | Reward, session complete |
| `q-confident` | Comeback, resilience |
| `q-proud` / `q-levelup` | Closing, achievement |
| `q-concerned` | Risk / streak-at-risk |
| `q-reading` / `q-shrug` | Quiet or empty-state moments |

Q is `decorative` (`alt=""` + `aria-hidden`) whenever adjacent text already carries the
meaning.

**Q leans into frame — she is never a full body floating in white space.** Use `.q-peek`:
a half-body crop anchored to the slide edge, like a mascot leaning in from off-screen.

```html
<section class="slide s-title has-peek">
  <div class="wrap stagger"> … </div>
  <img class="q-peek" src="assets/q-waving.png" alt="" aria-hidden="true">
</section>
```

- `.q-peek` sits on the **right** edge; add `.left` (plus `peek-left` on the slide) to flip it.
- `has-peek` on the slide reserves the gutter so text never runs under her.
- The crop is `--peek-ar`. **Visible fraction of the art = (art aspect ratio) ÷ `--peek-ar`.**
  The source PNGs are 1024×1536 (2:3, aspect `0.667`), so the `1/1` default shows the top
  **67%** — ears down to the lower torso. Want head-and-shoulders only? `3/2` → 44%.
  Already-half-body art? `2/3` → the whole thing.
  **If the Q art is ever redrawn at a different aspect ratio, re-derive this number** — it is
  the one value in the system tied to the artwork's proportions.
- `--peek-bleed` pulls her past the slide edge so the frame crops her, rather than her floating
  inside the PNG's own transparent margin.
- Hidden below 1000px — the gutter costs too much width once columns stack.
- Inline `.q` (`clamp(90px, 11vw, 210px)`) still exists for the rare centered closing slide,
  but `.q-peek` is the default treatment.

---

## 8. Restyling everything at once

Open `template.html`, find the `:root { }` block at the top of the `<style>`. Every deck copies
that block, so:

- **New brand colour** → change `--accent` (and `--on-accent` if the new accent is dark: ink
  text needs a light fill, white text needs a dark one).
- **Dark deck** → swap the substrate + ink block for Quire's dark tokens: `--bg:#1B1712`,
  `--bg-card:#241E17`, `--bg-inset:#2F2718`, `--text:#F4EFE3`, `--muted:#B3AA98`,
  `--faint:#7E7566`, `--accent:#F6875D`, `--on-accent:#201A13`, and set the border/shadow
  colour var `--ink:#000` (borders stay `#4A4030`).
- **Bigger everything** → raise the three numbers in each `--fs-*` clamp proportionally.
- **Different type** → change `--font-display` / `--font-ui` / `--font-mono` and the one
  Google Fonts `<link>`.

Decks already built keep their own copy of `:root`, so restyling an existing deck means
pasting the new block over its old one. New decks pick it up automatically from `template.html`.
