# Promo poster — image-gen prompt

For a Teka-Muna-style beta announcement poster. **The phone screens are generated blank on
purpose** — composite the real screenshots in afterwards (`assets/screenshots/`). Never let an
image model draw the app UI: it fabricates fake screens, which `context.md` forbids and which
looks obviously AI-made.

Same reason the URL pill is generated empty: no link exists yet, and models garble URLs.

---

## Prompt (paste into ChatGPT image gen)

> Create a vertical **4:5 portrait** promotional poster (1080 × 1350) for a mobile app called
> **Quire**. Flat vector illustration, warm and premium, in a "soft-brutalism / paper-and-ink"
> style: thick warm-black outlines, softly rounded corners, and **hard offset drop shadows with
> no blur** (solid ink-coloured shadows offset down-right by about 6px on every card, pill and
> frame). Absolutely no gradients on the background, no glass, no glow, no neon.
>
> **BACKGROUND.** Warm oat-paper cream (#F6EEDF) filling the whole canvas, with a faint
> dot-journal grid across it — small warm-black dots at about 6% opacity on a 46px square grid.
> In the **upper right corner**, a large flat **marigold (#F3C24C) fan of folded paper pages**
> radiating outward from off-canvas like a sunburst — overlapping angular page shapes with thin
> warm-black outlines, evoking a "quire" (a gathering of folded pages). It should read as a warm
> sun made of paper. In the **lower third**, a wide flat band of deep warm coral (#F0764F)
> spanning the full width, with a slightly wavy top edge and a thin warm-black outline, sitting
> behind the phones.
>
> **LAYOUT, top to bottom:**
>
> 1. **Top centre:** a rounded-square app-icon tile (about 110px) with a thick warm-black border,
>    a hard offset shadow, and a cream fill, containing a simple flat coral open-book mark.
> 2. **Headline, centred, very large:** an elegant high-contrast serif reading
>    **"Track every page"** on line one and **"you read."** on line two — line one in warm
>    soft-black (#241E19), line two in coral (#F0764F). Tight leading, generous size, it should
>    dominate the upper half.
> 3. **Subtitle, centred, smaller, clean geometric sans, warm grey-brown (#6E6250), max three
>    lines:** "Quire is a gamified reading tracker. Streaks, levels and personal bests for the
>    one habit that never kept score."
> 4. **Middle:** **three iPhone mockups** in a row — the centre phone larger and pushed forward,
>    the two side phones slightly smaller, lower and angled a few degrees outward. Realistic
>    modern iPhone bodies with thin warm-black outlines and hard offset ink shadows.
>    **CRITICAL: every phone screen must be completely EMPTY — a flat plain warm-cream
>    (#FCF8ED) rectangle with rounded corners. No app interface, no icons, no text, no status
>    bar, no buttons, nothing drawn on the screens at all.** They are blank placeholders.
> 5. **Below the phones, centred, extremely large bold sans in cream (#FCF8ED) on the coral
>    band:** the words **"NOW IN BETA"**.
> 6. **Bottom:** small centred cream text reading "Try it and tell us what breaks:" and beneath
>    it a wide **empty** rounded-pill button in cream with a thick warm-black outline and hard
>    offset shadow — **leave the pill completely blank, no text or icon inside it.**
>
> **MASCOT — a friendly cartoon fox named Q**, in flat vector children's-picture-book style:
> orange fur (#F0764F to #E8683F), cream-white chest, muzzle and tail tip (#FCF8ED), thick warm
> soft-black outlines (#241E19) of even weight, soft pink cheek blush, solid black oval eyes with
> a single white highlight dot, small dark rounded nose. No gradients, no shading, no texture.
> Place the fox **twice**:
> - **Upper left**, cropped by the left edge of the canvas, half-body, leaning into frame holding
>   an open book against her chest, looking up and to the right toward the headline with a warm
>   delighted expression.
> - **Lower right**, cropped by the bottom-right corner, head and shoulders only, larger, peeking
>   up over the coral band with a proud closed-mouth smile, one paw resting on the edge.
>
> **COLOUR PALETTE — use only these:** warm oat paper #F6EEDF, warm cream #FCF8ED, warm
> soft-black ink #241E19, coral #F0764F, marigold #F3C24C, amber #F2913F, soft violet #9A7BD6
> (tiny accents only). Warm, cosy, editorial. Text on coral fills is warm soft-black, never white,
> except the large "NOW IN BETA" which is cream.
>
> **DO NOT:** do not draw any user interface, app screen content, charts, or fake screenshots;
> do not put text inside the bottom pill; do not add any URL, domain, handle, logo of any real
> company, star rating, download count, review, or statistic; no gradients on the background; no
> glass or blur effects; no drop shadows with soft blur; no photorealism; no stock-photo people;
> no extra text beyond exactly what is specified above.

---

## After generating

1. Composite the real screenshots into the three blank screens —
   `assets/screenshots/session-screenshot.jpg` (left), `home-screenshot.jpg` (centre),
   `session-finish-screenshot.jpg` (right). Centre gets the hero screen.
   **Crop or cover the name and profile photo in `home-screenshot.jpg` first** (`context.md`).
2. Add the real beta link into the empty pill once one exists.
3. If the generated headline text is malformed, regenerate with the text zones left blank and
   set the type yourself — it will look sharper anyway.

## Variants

- **Square (1:1, feed):** same prompt, change to "square 1:1 poster (1080 × 1080)", drop the
  subtitle to two lines, and use **two** phones instead of three.
- **Story (9:16):** change to "vertical 9:16 poster (1080 × 1920)", stack a single large centred
  phone, and move the upper-left fox to directly beneath the headline.

---

# Page 2 — features + QR

Carousel slide 2. Same canvas, palette and furniture as page 1 so the pair reads as a set; the
paper-fan moves to the opposite corner so it rhymes rather than repeats.

**Two things are generated blank on purpose:**

- **The QR code.** Image models draw QR-shaped noise that will never scan. The prompt asks for
  an empty framed square; generate the real code separately (see below) and paste it in.
- **Nothing else can be faked either** — no app screenshots, no metrics, no link text.

**Text warning:** this layout carries ~12 short strings. Image models garble text at that volume.
The full-width rows make each string larger and more legible than the old grid did, but expect to
re-set the type yourself — or use the text-free variant at the bottom.

**Why rows, not a grid:** six cards in two columns gave each feature an icon, a title and two
lines of body inside a ~200px-wide box. Nothing had room. Full-width rows give each feature the
whole poster width, so the title can be large and the supporting line stays to one short phrase.
Four primary features + a secondary pill strip beats six equal-weight cards.

---

## Prompt (paste into ChatGPT image gen)

> Create a vertical **4:5 portrait** poster (1080 × 1350) — slide two of a two-part social
> carousel for a mobile app called **Quire**. Flat vector illustration in a "soft-brutalism /
> paper-and-ink" style: thick warm-black outlines, softly rounded corners, and **hard offset drop
> shadows with no blur** (solid ink-coloured shadows offset down-right about 6px on every card and
> tile). No gradients on the background, no glass, no glow, no neon, no photorealism.
>
> **BACKGROUND.** Warm oat-paper cream (#F6EEDF) across the whole canvas with a faint
> dot-journal grid — small warm-black dots at about 6% opacity on a 46px square grid. In the
> **upper LEFT corner**, a flat **marigold (#F3C24C) fan of folded paper pages** radiating from
> off-canvas like a sunburst: overlapping angular page shapes with thin warm-black outlines.
> Across the **bottom fifth**, a flat deep-coral (#F0764F) band spanning the full width with a
> slightly wavy top edge and a thin warm-black outline.
>
> **LAYOUT, top to bottom:**
>
> **SPACING — this is the most important instruction. The layout must feel calm, airy and
> uncrowded.** Keep a generous outer margin of at least 70px on the left and right of every
> element. Leave large, obvious vertical gaps between the header, the feature rows and the bottom
> card. Type is large and confident; **whitespace is preferred over fitting more in.** Do not
> compress or crowd elements to fill space.
>
> **LAYOUT, top to bottom:**
>
> 1. **Header, centred, occupying the top quarter:** a small uppercase warm-grey-brown label
>    reading **"WHAT'S INSIDE"**, and generously below it a large elegant high-contrast serif
>    headline in warm soft-black reading **"Reading, but it"** on line one and **"keeps score."**
>    on line two — with **"keeps score"** in coral (#F0764F).
> 2. **Middle — exactly FOUR full-width horizontal feature rows, stacked vertically in a single
>    column.** Not a grid, not two columns. Each row is a wide warm-cream (#FCF8ED) rounded
>    rectangle spanning nearly the full width of the poster, with a thick warm-black outline and
>    a hard offset ink shadow, and a comfortable gap between each row.
>    Inside each row, arranged horizontally: on the **left**, a **large rounded-square icon tile**
>    (about 110 × 110px) with a thin warm-black outline and small hard shadow, containing one
>    simple flat line icon; to the **right of the tile**, generously spaced, two lines of text —
>    a **large bold title** in warm soft-black, and beneath it **one short line** of smaller
>    warm-grey-brown text. Vertically centre the tile and the text within the row.
>    The four rows, top to bottom:
>    - **Coral (#F0764F) tile, stopwatch icon** — "Live sessions" — "Time it. Log the pages."
>    - **Amber (#F2913F) tile, flame icon** — "Streaks" — "Read daily. Keep the flame."
>    - **Marigold (#F3C24C) tile, star-badge icon** — "XP and levels" — "Earn a title worth
>      keeping."
>    - **Violet (#9A7BD6) tile, circular-arrow icon** — "Comeback" — "Miss a day? Win it back."
> 3. **Directly beneath the rows, a single centred line of three small pill-shaped chips**, each
>    a warm-cream rounded pill with a thin warm-black outline, containing small uppercase
>    warm-grey-brown text: **"LIBRARY"**, **"DISCOVER"**, **"SHARE CARDS"**. Small and quiet —
>    these are secondary to the four rows above.
> 4. **Bottom, on the coral band — a centred wide warm-cream rounded card** with a thick
>    warm-black outline and hard offset shadow, generously padded, laid out as two columns: on
>    the **left**, a **perfectly plain, completely EMPTY white square** with a thin warm-black
>    outline and rounded corners, about 240 × 240px — **critical: leave this square totally blank
>    and white, do not draw a QR code, do not draw any pattern, dots, squares, pixels or markings
>    inside it whatsoever**; on the **right**, stacked text: a small uppercase warm-grey-brown
>    label reading "SCAN TO JOIN" and beneath it a bold warm-soft-black line reading "The beta is
>    open."
>
> **MASCOT — a friendly cartoon fox named Q**, flat vector children's-picture-book style: orange
> fur (#F0764F to #E8683F), cream-white chest, muzzle and tail tip (#FCF8ED), thick warm
> soft-black outlines (#241E19) of even weight, soft pink cheek blush, solid black oval eyes with
> a single white highlight dot, small dark rounded nose. No gradients, no shading, no texture.
> Place her **once, in the bottom-right corner**, cropped by the right edge of the canvas, head
> and one shoulder only, peeking up from behind the coral band with a bright encouraging
> expression. **She must not overlap or cover any feature row or any text.**
>
> **DECORATION.** Keep the marigold paper fan in the upper left **modest — no wider than about a
> fifth of the poster** — so it frames the header without competing with it.
>
> **COLOUR PALETTE — use only these:** warm oat paper #F6EEDF, warm cream #FCF8ED, warm
> soft-black ink #241E19, coral #F0764F, marigold #F3C24C, amber #F2913F, soft violet #9A7BD6.
> Text on coral or marigold fills is warm soft-black, never white.
>
> **DO NOT:** do not use a two-column or grid arrangement for the features; do not add a fifth or
> sixth feature row; do not crowd or compress the layout; do not draw a QR code or any pattern
> inside the white square; do not draw any app interface, phone, screenshot or chart; do not add
> any URL, domain, handle, email, real company logo, star rating, download count, price, review or
> statistic; no gradients on the background; no blur or glass; no soft-blurred drop shadows; no
> stock-photo people; no text beyond exactly what is specified above.

---

## Making the actual QR code

The QR needs a **real destination URL, which does not exist yet** (`context.md` — no links
approved). Get the TestFlight / Play beta / landing URL first; a QR to a dead link is worse than
no QR.

Then generate it on-brand:

- Foreground modules **`#241E19`** (warm ink), background **`#FCF8ED`** (warm cream) or
  transparent. Never pure black on pure white — it will look pasted-on next to the palette.
- **Error correction level H**, so you can drop the Quire app icon in the centre without breaking
  the scan. Keep the logo under ~25% of the code's width.
- Quiet zone: leave at least 4 modules of empty margin, which the white square already gives you.
- Export at **1024px** minimum so it stays crisp at print size.
- **Test it** by scanning from the exported poster at final size, on both iOS and Android, before
  posting.

## Text-free variant

If the generated card text comes out malformed, regenerate with this appended to the prompt, and
set all type yourself in Figma/Canva:

> **OVERRIDE:** render the six feature cards and the bottom card with their icon tiles and
> shapes only — **no text anywhere in the image at all**, including the headline and labels.
> Leave clean empty space where the text would sit.
