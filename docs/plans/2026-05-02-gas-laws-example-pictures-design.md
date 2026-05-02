# Gas-laws example pictures — design

**Date:** 2026-05-02
**Predecessors:** Gas-laws background section (PR #14, awaiting review/merge — this work extends PR #14's branch).
**Companion plan:** `docs/plans/2026-05-02-gas-laws-example-pictures-implementation.md` (forthcoming).

---

## Goal

Add a picture for each of the four real-world examples in the Gas Laws "Where you will see these laws" subsection. One image per law, shared across SL and HL views. Photos sourced from Wikimedia Commons with verified clean licenses (CC-BY-SA / CC-BY / public domain), self-hosted in `examples/topic-page/img/`. Each figure has alt text, a caption that combines the law description with the picture context, and a small attribution line.

This is purely a content + visual polish addition. No JS changes, no new components, no new tests.

---

## Locked decisions

| Decision           | Choice                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image source       | Wikimedia Commons (free licenses, attribution given on each figure)                                                                                                                         |
| Image style        | Photographs (not illustrations / SVGs / icons)                                                                                                                                              |
| Figure layout      | Each `<li>` becomes a `<figure>` with image on top + caption below                                                                                                                          |
| Figure count       | 4 total (one per law); same images shared between SL and HL views                                                                                                                           |
| File hosting       | Self-hosted in `examples/topic-page/img/`. JPG, ~600×400, ~150 KB each.                                                                                                                     |
| Markup duplication | Figure markup duplicated in both `data-variant` blocks (browser cache makes the duplicated `<img src>` load once)                                                                           |
| HL/SL caption text | SL captions match the existing 4 SL bullets; HL captions match the existing HL bullets (so SL gets shorter prose, HL gets richer prose mentioning secondary examples)                       |
| Mobile breakpoint  | 720 px (reuses the project's existing breakpoint) — single-column stack                                                                                                                     |
| Print mode         | Whole-page handout: 2×2 grid, image cap 2 inches tall, `break-inside: avoid` per figure. Reflection-only print mode unaffected (the existing `body.printing-reflection` gating handles it). |
| Test coverage      | None (content addition only). Existing tests unchanged.                                                                                                                                     |
| PR strategy        | Extend PR #14's branch (`gas-laws-background-section`) — same shipping unit                                                                                                                 |

---

## Image sourcing

| Law        | Subject                           | Filename                | Notes for the implementer                                                                                                                         |
| ---------- | --------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boyle      | Scuba diver underwater            | `boyle-scuba.jpg`       | Search Wikimedia Commons "scuba diver"; pick a clear, recognizable diver against blue water. CC-BY-SA / CC-BY / PD only.                          |
| Charles    | Hot-air balloon in flight         | `charles-balloon.jpg`   | Search "hot air balloon"; pick a single well-lit balloon against sky. Cappadocia and Albuquerque festivals are common sources.                    |
| Gay-Lussac | Pressure cooker (modern stovetop) | `gay-lussac-cooker.jpg` | Search "pressure cooker"; pick a clean studio shot. CC-BY-SA from contributor uploads.                                                            |
| Avogadro   | Propane / LPG tank                | `avogadro-propane.jpg`  | Search "propane tank" or "LPG cylinder". The "amount of gas" is what the picture shows: a fixed volume holding a measured mass of compressed gas. |

The implementer subagent will need WebFetch / WebSearch to browse Wikimedia Commons and select specific images. For each download, capture:

- Original Wikimedia file URL
- Original filename
- Creator (display name as shown on the file's page)
- License type (e.g., `CC-BY-SA-4.0`, `CC-BY-3.0`, `PD-self`)
- Wikimedia source-page URL

These five fields go into the per-figure attribution caption AND into a new `examples/topic-page/img/CREDITS.md` file (the canonical record). If the implementer cannot find a suitable license-clean photo on a first try, they should try a different image; placeholder/hotlinked images are NOT acceptable.

**Image specs:** JPG, ~600 × ~400 px (3:2 or 4:3 aspect ratio), quality 80, target ~150 KB each. Total assets: ~600 KB. Plain JPG (not WebP) for universal browser support and clean print rendering.

---

## Markup pattern

The existing `<ul>` in "Where you will see these laws" gets replaced (in both `data-variant` blocks) with a `<div class="topic-background__figures">` containing 4 `<figure>` elements. Each figure:

```html
<figure>
  <img
    src="img/boyle-scuba.jpg"
    alt="Scuba diver swimming underwater in clear blue water"
    width="600"
    height="400"
    loading="lazy"
    decoding="async"
  />
  <figcaption>
    <strong>Boyle's law</strong> — scuba divers must exhale on ascent (lung volume expands as
    pressure drops); medical syringes; aerosol cans.
    <small class="attribution">
      Photo: <em>&lt;creator-name&gt;</em>, CC-BY-SA-4.0 via
      <a href="&lt;wikimedia-commons-source-url&gt;">Wikimedia Commons</a>.
    </small>
  </figcaption>
</figure>
```

**Per-image attribute requirements:**

- `src` — relative path to local file (`img/<filename>`).
- `alt` — descriptive of what the photo shows (NOT redundant with the caption text). ~10 words. e.g. "Scuba diver swimming underwater in clear blue water" not "scuba diver".
- `width` / `height` — explicit, matching the source file dimensions (prevents CLS during page load).
- `loading="lazy"` — defers fetch until scrolled into view.
- `decoding="async"` — non-blocking decode.

**Per-caption requirements:**

- `<strong>` for the law name (matches the existing bullet pattern).
- The existing law description text from the SL or HL bullet (verbatim).
- `<small class="attribution">` line with creator + license + Wikimedia source link.

**Variant duplication:**

The full `<div class="topic-background__figures">` block appears once inside `<div data-variant="default-sl">` and once inside `<div data-variant="default-hl">`. Same `<img src>` references; the captions differ (SL captions match SL bullets, HL captions match HL bullets). Browser HTTP cache makes the duplicated `<img>` references load each file only once.

---

## CSS additions

Append to `packages/core/src/styles/components.css`, after the existing `.topic-background ul` rule (in the same `.topic-background` rule block):

```css
.topic-background__figures {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-4, 16px);
  margin: var(--sp-3, 12px) 0;
}
.topic-background__figures figure {
  margin: 0;
  display: flex;
  flex-direction: column;
}
.topic-background__figures img {
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: var(--r-sm, 4px);
  background: var(--ib-ink-100, #f4f4f4);
}
.topic-background__figures figcaption {
  margin-top: var(--sp-2, 8px);
  font-size: var(--fs-14, 14px);
  line-height: 1.5;
}
.topic-background__figures .attribution {
  display: block;
  margin-top: var(--sp-1, 4px);
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-12, 12px);
  color: var(--ib-ink-500, #6b7280);
}

@media (max-width: 720px) {
  .topic-background__figures {
    grid-template-columns: 1fr;
  }
}

@media print {
  body:not(.printing-reflection) .topic-background__figures {
    grid-template-columns: 1fr 1fr;
    gap: 8pt;
  }
  body:not(.printing-reflection) .topic-background__figures figure {
    break-inside: avoid;
  }
  body:not(.printing-reflection) .topic-background__figures img {
    aspect-ratio: 4 / 3;
    max-height: 2in;
  }
}
```

**Print mode rationale:**

- 2×2 grid (vs. 4×1 desktop) is more compact for paper.
- 2-inch image cap prevents figures from dominating the handout page.
- `break-inside: avoid` keeps each figure together (image + caption + attribution don't split across page boundaries).
- The reflection-only print mode (Save your work → Save as PDF) is unaffected — `body:not(.printing-reflection)` gating ensures these whole-page rules don't fire when the reflection-only mode is active.

---

## Files touched

| File                                            | Change                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `examples/topic-page/img/boyle-scuba.jpg`       | NEW — Wikimedia download                                                                                 |
| `examples/topic-page/img/charles-balloon.jpg`   | NEW — Wikimedia download                                                                                 |
| `examples/topic-page/img/gay-lussac-cooker.jpg` | NEW — Wikimedia download                                                                                 |
| `examples/topic-page/img/avogadro-propane.jpg`  | NEW — Wikimedia download                                                                                 |
| `examples/topic-page/img/CREDITS.md`            | NEW — canonical attribution record (creator, license, source URL per image)                              |
| `examples/topic-page/index.html`                | MODIFY — replace 2× `<ul>` with `<div class="topic-background__figures">` (one per `data-variant` block) |
| `packages/core/src/styles/components.css`       | MODIFY — append `.topic-background__figures` rules                                                       |
| `CHANGELOG.md`                                  | MODIFY — extend the "Gas-laws background section" subsection with a "+ figures" note                     |

8 files, ~80 lines of HTML/CSS plus 4 image binaries (~600 KB total).

**Commit:** one new commit on top of `2bd0595` on the existing `gas-laws-background-section` branch. PR #14 grows in scope.

---

## Manual verification additions

Add to the existing PR #14 manual checklist:

- [ ] All four images load (no broken-image icons).
- [ ] Each image has visible alt text (test by disabling images in DevTools).
- [ ] Each figure has a visible attribution line in monospace style under the caption.
- [ ] Desktop: 4-column grid.
- [ ] Tablet/mobile (≤720 px): single-column stack.
- [ ] Cmd+P: figures appear in 2×2 grid, each capped at ~2 inches tall, no figure breaks across pages.
- [ ] Save your work → Save as PDF: figures absent from the reflection-only export.
- [ ] CREDITS.md lists all four images with creator + license + source URL.

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — **184 unchanged** (no test changes).
4. `pnpm build` clean. Bundle delta ≤ +2 kB IIFE for the CSS additions; image files don't ship in the JS bundle.
5. Manual verification matches the checklist above.
6. CI green; PR #14 merged.

---

## Out of scope (deferred)

- Image lightbox / zoom on click — the figures are inline reading material, not a gallery.
- Image lazy-loading polyfill for very old browsers — `loading="lazy"` is widely supported.
- WebP / AVIF formats — JPG covers all browsers and prints cleanly.
- Animation / hover effects on figures — keep the visual quiet.
- Localized image alt text or captions — same multilingual deferral as PR #14.
- Adding figures to other topic-page sections (worked example, practice question, etc.) — gas-laws background only for now.

---

## Risks + mitigations

| Risk                                                                                     | Mitigation                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wikimedia images unavailable / poor quality                                              | Implementer searches Wikimedia Commons for each subject; rejects placeholder/poor-quality images; tries different keywords if first search fails. CREDITS.md documents the chosen images so a future review can verify license cleanliness. |
| License attribution incorrect or missing                                                 | Per-figure `<small class="attribution">` line + canonical CREDITS.md entry. The implementer must capture creator + license + source URL for each of the 4 images BEFORE committing.                                                         |
| Image quality at print resolution                                                        | 600×400 JPG renders ~3 inches wide on screen and ~2 inches max in print mode. Acceptable resolution for inline content (not magazine spreads). Print stylesheet caps height to prevent over-large rendering.                                |
| Bundle / repo size grows from images                                                     | ~600 KB total is small relative to the existing repo. Images live in `examples/` (not packaged in the npm bundle). When `@TBD/simengine` publishes, the example folder is excluded from `files` in package.json.                            |
| Future contributors add images without proper attribution                                | CREDITS.md becomes the canonical record. Architecture.md or a CONTRIBUTING note can codify the convention.                                                                                                                                  |
| Browser caching: same `<img src>` in both SL+HL variants → does the browser fetch twice? | No — same URL, single HTTP request. The duplicated markup is purely an HTML-source convenience; runtime fetches are once-per-image.                                                                                                         |

---

## Why a single PR (extending PR #14)

PR #14 ships the prose; this work ships the pictures that complete the prose. Single shipping unit, single review thread. The user reviews "background section + pictures" as one feature.

The cost: PR #14's diff grows from +175 lines to +255 lines + 4 image binaries. Easy to scan because the picture work is contained to one new commit on top of the existing prose commit.
