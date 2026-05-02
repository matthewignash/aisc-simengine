# Gas-laws Example Pictures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 photographs (one per gas law) to the "Where you will see these laws" subsection of the Gas Laws background section, sourced from Wikimedia Commons, self-hosted in `examples/topic-page/img/`, with proper attribution captions.

**Architecture:** Pure content + CSS addition. The existing 2× `<ul>` (one per `data-variant` block) becomes 2× `<div class="topic-background__figures">` containing 4 `<figure>` elements each. Same images shared between SL and HL views (browser cache makes the duplicated `<img src>` references load once per file). New CSS for the figure grid layout, mobile single-column stack, and print 2×2 grid.

**Tech Stack:** Plain HTML + CSS + JPG image binaries. WebFetch / WebSearch to browse Wikimedia Commons. No JS, no new components, no new tests.

**Companion design doc:** `docs/plans/2026-05-02-gas-laws-example-pictures-design.md` (commit `ff935f7` on main). Read for the verbatim markup pattern, CSS, and image-sourcing rules.

---

## Repo state at start

- Working branch: `gas-laws-background-section` (the existing branch from PR #14, which has commit `2bd0595` adding the prose section).
- Worktree: `.worktrees/gas-laws-background-section/` (already exists from PR #14's implementer run).
- Baseline tests: **184** (178 core + 6 data) — unchanged by this work.
- This plan adds **one new commit on top of `2bd0595`**, extending PR #14's scope.

## Standards (carried from prior phases)

- Conventional commits.
- No git config edits. Use env vars on each commit:
  - `GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com"`
  - `GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com"`
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer on every commit.
- No `git add -A`. Stage files by name (including the new image binaries).
- No emojis in UI labels or commit messages.
- All synthesized DOM remains createElement + textContent (this commit doesn't touch JS, but the convention applies to any future test code).

---

## Single commit — `feat(examples): add Wikimedia photos to gas-laws background figures`

8 files: 4 new JPGs + CREDITS.md + 2 source modifications + 1 CHANGELOG modification. ~80 lines of HTML/CSS plus ~600 KB of image binaries.

### Task 1 — Source 4 photos from Wikimedia Commons

**Tool requirements:** WebFetch and/or WebSearch are required. The implementer browses Wikimedia Commons for each subject, picks a license-clean photo, captures the metadata, and downloads.

**For each of the 4 laws, search Wikimedia Commons and pick ONE photograph:**

| Law        | Subject                           | Search hints                                                                                                               |
| ---------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Boyle      | Scuba diver underwater            | Search "scuba diver" or "scuba diving". Pick a clear, recognizable diver against blue water.                               |
| Charles    | Hot-air balloon in flight         | Search "hot air balloon". Cappadocia or Albuquerque festival shots are common; pick a single well-lit balloon against sky. |
| Gay-Lussac | Pressure cooker (modern stovetop) | Search "pressure cooker". Pick a clean studio shot of a stovetop pressure cooker.                                          |
| Avogadro   | Propane / LPG tank or cylinder    | Search "propane tank" or "LPG cylinder". Goal: show a recognizable container of compressed gas.                            |

**For each chosen image, capture these 5 fields:**

1. Original Wikimedia file URL (the direct image URL — `https://upload.wikimedia.org/...`)
2. Original filename (as shown on Wikimedia, e.g. `Scuba_diver.jpg`)
3. Creator (display name from the file's Wikimedia page, e.g. "Jane Doe")
4. License type — must be one of: `CC-BY-SA-4.0`, `CC-BY-SA-3.0`, `CC-BY-SA-2.5`, `CC-BY-4.0`, `CC-BY-3.0`, `PD-self`, `PD-USGov`, or another fully-permissive license. **Reject** images with `CC-BY-NC` (non-commercial), `CC-BY-ND` (no-derivatives), or no clear license.
5. Wikimedia source-page URL (the file's description page, e.g. `https://commons.wikimedia.org/wiki/File:Scuba_diver.jpg`)

**If the implementer cannot find a license-clean photo on the first try, search again with different keywords. Placeholder images, hotlinked images, or images with unclear licensing are NOT acceptable.**

**Implementer's WebFetch / WebSearch usage:**

```text
1. WebSearch "site:commons.wikimedia.org scuba diver" → get a few promising file pages.
2. WebFetch each file page → read the license box, creator field, and downloadable image URL.
3. Pick the best match (recognizable subject, clean license, decent resolution).
4. WebFetch the image URL itself → save the binary to disk.
```

If WebFetch can't save binary content directly, use a Bash `curl -o` invocation to download:

```bash
curl -L -o examples/topic-page/img/boyle-scuba.jpg "<wikimedia-image-url>"
```

**Resize check:** if the source image is much larger than 600 × 400 px, resize it before committing. Most schools' classroom devices are still on slow networks; ~150 KB per image is the target.

```bash
# Optional resize via ImageMagick (if installed):
convert "examples/topic-page/img/boyle-scuba.jpg" -resize "600x400^" -gravity center -extent 600x400 -quality 80 "examples/topic-page/img/boyle-scuba.jpg"
```

If ImageMagick isn't available, the implementer can leave the image at its native resolution as long as the file is under ~500 KB.

### Task 2 — Create `examples/topic-page/img/CREDITS.md`

**File:** `examples/topic-page/img/CREDITS.md` (NEW)

Create with this exact shape (substitute the `<...>` placeholders with the real metadata captured in Task 1):

```markdown
# Image credits — Gas Laws topic page

All images in this folder are sourced from Wikimedia Commons under licenses that
permit redistribution with attribution. Each image is credited to its creator
and links back to the Wikimedia source page.

## boyle-scuba.jpg

- **Subject:** Scuba diver underwater (illustrates Boyle's law: pressure
  decreases on ascent, lung volume expands).
- **Creator:** <creator-name>
- **License:** <license-type>
- **Source:** <wikimedia-source-page-url>
- **Original filename:** <original-wikimedia-filename>

## charles-balloon.jpg

- **Subject:** Hot-air balloon in flight (illustrates Charles's law: heated air
  occupies a larger volume at constant pressure).
- **Creator:** <creator-name>
- **License:** <license-type>
- **Source:** <wikimedia-source-page-url>
- **Original filename:** <original-wikimedia-filename>

## gay-lussac-cooker.jpg

- **Subject:** Stovetop pressure cooker (illustrates Gay-Lussac's law: pressure
  rises with temperature at constant volume).
- **Creator:** <creator-name>
- **License:** <license-type>
- **Source:** <wikimedia-source-page-url>
- **Original filename:** <original-wikimedia-filename>

## avogadro-propane.jpg

- **Subject:** Propane / LPG tank (illustrates Avogadro's law: a fixed volume
  holds a measured amount of gas).
- **Creator:** <creator-name>
- **License:** <license-type>
- **Source:** <wikimedia-source-page-url>
- **Original filename:** <original-wikimedia-filename>
```

### Task 3 — Replace the SL `<ul>` with the figure grid

**File:** `examples/topic-page/index.html`

Find the existing SL "Where you will see these laws" block — inside the `<div data-variant="default-sl">` block of the new `<section class="topic-background">` from PR #14:

```html
<h3>Where you will see these laws</h3>
<ul>
  <li><strong>Boyle</strong> — scuba diving (divers must exhale on the way up).</li>
  <li><strong>Charles</strong> — hot-air balloons.</li>
  <li><strong>Gay-Lussac</strong> — pressure cookers; aerosol cans warming up.</li>
  <li>
    <strong>Avogadro</strong> — counting molecules by measuring volumes (mole-to-volume
    conversions).
  </li>
</ul>
```

Replace it with this `<div class="topic-background__figures">` block. Substitute `<creator>`, `<license>`, and `<source-url>` with the metadata captured in Task 1:

```html
<h3>Where you will see these laws</h3>
<div class="topic-background__figures">
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
      <strong>Boyle's law</strong> — scuba diving (divers must exhale on the way up).
      <small class="attribution">
        Photo: <em>&lt;creator&gt;</em>, &lt;license&gt; via
        <a href="&lt;source-url&gt;">Wikimedia Commons</a>.
      </small>
    </figcaption>
  </figure>
  <figure>
    <img
      src="img/charles-balloon.jpg"
      alt="Hot-air balloon in flight against an open sky"
      width="600"
      height="400"
      loading="lazy"
      decoding="async"
    />
    <figcaption>
      <strong>Charles's law</strong> — hot-air balloons.
      <small class="attribution">
        Photo: <em>&lt;creator&gt;</em>, &lt;license&gt; via
        <a href="&lt;source-url&gt;">Wikimedia Commons</a>.
      </small>
    </figcaption>
  </figure>
  <figure>
    <img
      src="img/gay-lussac-cooker.jpg"
      alt="Stovetop pressure cooker on a kitchen burner"
      width="600"
      height="400"
      loading="lazy"
      decoding="async"
    />
    <figcaption>
      <strong>Gay-Lussac's law</strong> — pressure cookers; aerosol cans warming up.
      <small class="attribution">
        Photo: <em>&lt;creator&gt;</em>, &lt;license&gt; via
        <a href="&lt;source-url&gt;">Wikimedia Commons</a>.
      </small>
    </figcaption>
  </figure>
  <figure>
    <img
      src="img/avogadro-propane.jpg"
      alt="Propane gas cylinder against a neutral background"
      width="600"
      height="400"
      loading="lazy"
      decoding="async"
    />
    <figcaption>
      <strong>Avogadro's law</strong> — counting molecules by measuring volumes (mole-to-volume
      conversions).
      <small class="attribution">
        Photo: <em>&lt;creator&gt;</em>, &lt;license&gt; via
        <a href="&lt;source-url&gt;">Wikimedia Commons</a>.
      </small>
    </figcaption>
  </figure>
</div>
```

### Task 4 — Replace the HL `<ul>` with the figure grid

**File:** `examples/topic-page/index.html`

Find the existing HL "Where you will see these laws" block — inside the `<div data-variant="default-hl">` block:

```html
<h3>Where you will see these laws</h3>
<ul>
  <li>
    <strong>Boyle's law</strong> — scuba divers must exhale on ascent (lung volume expands as
    pressure drops); medical syringes; aerosol cans.
  </li>
  <li>
    <strong>Charles's law</strong> — hot-air balloons rise because heated air occupies a larger
    volume at the same pressure; bread dough rises in the oven as trapped CO₂ expands.
  </li>
  <li>
    <strong>Gay-Lussac's law</strong> — pressure cookers, the compression stroke of an internal
    combustion engine, the "do not heat" warning on every aerosol can.
  </li>
  <li>
    <strong>Avogadro's law</strong> — the basis of gas-phase stoichiometry (mole ratios equal volume
    ratios at the same T and P) and the molar volume of 22.7 dm³ mol⁻¹ at IB-standard STP.
  </li>
</ul>
```

Replace with the analogous figure grid. Same `<img>` references as the SL block (browser cache means each file loads once); only the caption text differs (HL captions match the existing HL bullets verbatim):

```html
<h3>Where you will see these laws</h3>
<div class="topic-background__figures">
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
        Photo: <em>&lt;creator&gt;</em>, &lt;license&gt; via
        <a href="&lt;source-url&gt;">Wikimedia Commons</a>.
      </small>
    </figcaption>
  </figure>
  <figure>
    <img
      src="img/charles-balloon.jpg"
      alt="Hot-air balloon in flight against an open sky"
      width="600"
      height="400"
      loading="lazy"
      decoding="async"
    />
    <figcaption>
      <strong>Charles's law</strong> — hot-air balloons rise because heated air occupies a larger
      volume at the same pressure; bread dough rises in the oven as trapped CO₂ expands.
      <small class="attribution">
        Photo: <em>&lt;creator&gt;</em>, &lt;license&gt; via
        <a href="&lt;source-url&gt;">Wikimedia Commons</a>.
      </small>
    </figcaption>
  </figure>
  <figure>
    <img
      src="img/gay-lussac-cooker.jpg"
      alt="Stovetop pressure cooker on a kitchen burner"
      width="600"
      height="400"
      loading="lazy"
      decoding="async"
    />
    <figcaption>
      <strong>Gay-Lussac's law</strong> — pressure cookers, the compression stroke of an internal
      combustion engine, the "do not heat" warning on every aerosol can.
      <small class="attribution">
        Photo: <em>&lt;creator&gt;</em>, &lt;license&gt; via
        <a href="&lt;source-url&gt;">Wikimedia Commons</a>.
      </small>
    </figcaption>
  </figure>
  <figure>
    <img
      src="img/avogadro-propane.jpg"
      alt="Propane gas cylinder against a neutral background"
      width="600"
      height="400"
      loading="lazy"
      decoding="async"
    />
    <figcaption>
      <strong>Avogadro's law</strong> — the basis of gas-phase stoichiometry (mole ratios equal
      volume ratios at the same T and P) and the molar volume of 22.7 dm³ mol⁻¹ at IB-standard STP.
      <small class="attribution">
        Photo: <em>&lt;creator&gt;</em>, &lt;license&gt; via
        <a href="&lt;source-url&gt;">Wikimedia Commons</a>.
      </small>
    </figcaption>
  </figure>
</div>
```

**Critical:** the `<img>` `width` and `height` attributes must match the actual dimensions of the downloaded files (or be left as 600/400 if the implementer resized to that target). Wrong values cause CLS on page load. If the source images aren't exactly 600×400, the implementer should either (a) resize to 600×400 in Task 1, or (b) update the `width`/`height` attributes here to match the actual dimensions.

### Task 5 — Add the figure-grid CSS rules

**File:** `packages/core/src/styles/components.css`

Find the existing `.topic-background ul` rule (added in commit `2bd0595` from PR #14). Append these new rules immediately after the `.topic-background ul` block, still inside the `.topic-background` rule region:

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

### Task 6 — Extend the CHANGELOG entry

**File:** `CHANGELOG.md`

Find the existing `### Gas-laws background section (post-10B)` subsection (added in commit `2bd0595`). At the end of its bullet list (before the next subsection or the `### Notes` footer), append one new bullet:

```markdown
- **Figures added:** four photographs (one per gas law) sourced from Wikimedia Commons under CC-BY-SA / CC-BY / public-domain licenses, self-hosted in `examples/topic-page/img/`. Each figure has descriptive alt text, a caption matching the existing law description, and an inline attribution line pointing to the Wikimedia source. The full attribution record (creator, license, source URL per image) lives in `examples/topic-page/img/CREDITS.md`. Layout: 4-column desktop grid; single-column stack at ≤720 px; 2×2 print grid with image height capped at 2 inches.
```

### Task 7 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean (the new HTML may need prettier reformatting; that's fine).
- lint: 0 errors, no new warnings.
- test: **184 unchanged** (no test changes; existing 178 core + 6 data still pass).
- build: green; bundle delta ≤ +2 kB IIFE for the CSS additions; image binaries don't ship in the JS bundle.

Stage exactly these 8 files (4 binaries + 4 source files):

```bash
git add \
  examples/topic-page/img/boyle-scuba.jpg \
  examples/topic-page/img/charles-balloon.jpg \
  examples/topic-page/img/gay-lussac-cooker.jpg \
  examples/topic-page/img/avogadro-propane.jpg \
  examples/topic-page/img/CREDITS.md \
  examples/topic-page/index.html \
  packages/core/src/styles/components.css \
  CHANGELOG.md
```

Commit with env-var attribution and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(examples): add Wikimedia photos to gas-laws background figures

Adds four photographs (one per gas law) to the "Where you will
see these laws" subsection of the gas-laws background section
introduced in the previous commit. Each example bullet becomes
a <figure> with image on top + caption + a small attribution
line below. Same images shared between SL and HL views (browser
cache makes the duplicated <img src> references load once per
file).

Image sources (all Wikimedia Commons, license-clean):

  - boyle-scuba.jpg — scuba diver underwater (Boyle's law)
  - charles-balloon.jpg — hot-air balloon in flight (Charles's law)
  - gay-lussac-cooker.jpg — stovetop pressure cooker (Gay-Lussac)
  - avogadro-propane.jpg — propane / LPG tank (Avogadro)

Per-figure attribution: <small class="attribution"> line under
each caption with creator + license type + Wikimedia source link.
Canonical record in examples/topic-page/img/CREDITS.md (creator,
license, source URL per image).

Image specs: JPG, ~600×400, ~150 KB each, total ~600 KB. JPG
format for universal browser support and clean print rendering.
loading="lazy" + decoding="async" on each img tag for performance.

CSS additions to packages/core/src/styles/components.css:

  - .topic-background__figures grid: 4 columns desktop, 1 column
    at ≤720 px, 2×2 in print mode with image height capped at 2 in
    and break-inside: avoid per figure.
  - figure styling: aspect-ratio 3/2 on screen, 4/3 in print;
    object-fit: cover for consistent thumbnail sizing.
  - attribution line: monospace, smaller font, muted color.

The reflection-only print mode (Save your work → Save as PDF) is
unaffected — the existing body:not(.printing-reflection) gating
on the new print rules ensures only the whole-page handout mode
renders the figures.

No tests required (content addition). Test count unchanged at 184.
Bundle delta: ≤ +2 kB IIFE for the CSS; image files are not
included in the JS bundle.

Phase 10B+ polish — extends PR #14's gas-laws background section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH from inside the implementer. The controller pushes after final review.

---

## Final verification

After the commit lands, run the pipeline once more from the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

All green expected.

**Manual visual check (the real test):** start a static server from the worktree root:

```bash
python3 -m http.server 8765
```

Open http://localhost:8765/examples/topic-page/index.html in Chrome. Verify:

1. Scroll to the "Where you will see these laws" subsection of the gas-laws background section.
2. Default level (SL): four figures in a desktop grid, each with image + caption + attribution line.
3. All four images load (no broken-image icons). Click on one to confirm it opens the local file (right-click → Open in new tab).
4. Each figure has visible alt text (test by hovering, or by disabling images in DevTools Network tab → "Block request URL" on each `.jpg`).
5. Each figure has an attribution line in monospace style, pointing to the Wikimedia source.
6. Flip the HL toggle. Same 4 images appear; captions update to the longer HL prose.
7. DevTools mobile emulation (iPhone SE 375 × 667): figures stack into a single column.
8. Cmd+P (Chrome print preview):
   - Whole-page handout mode (no reflection panel open): figures appear in 2×2 grid, capped at ~2 inches tall, no figure breaks across pages.
   - Open Save your work → Save as PDF: reflection-only export does NOT include the figures (existing print mode is unaffected).

**Push the (already-pushed) PR #14 branch:**

```bash
# Branch is already pushed from PR #14's prior implementer run.
# This new commit just gets pushed on top:
git push origin gas-laws-background-section
```

CI re-runs on the existing PR #14 with the new commit included. Diff grows from "+175 lines" to "+255 lines + 4 image binaries."

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (0 errors, 0 new warnings).
3. `pnpm test` — **184 passing** unchanged.
4. `pnpm build` clean. Bundle delta ≤ +2 kB IIFE.
5. Manual visual check matches the 8-point list above.
6. `examples/topic-page/img/CREDITS.md` lists all four images with creator + license + source URL.
7. CI green on PR #14 (now including the new commit); merged to `main`.
