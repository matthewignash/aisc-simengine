# Gas-laws background section — design

**Date:** 2026-05-02
**Predecessors:** Phase 10A v2 (PR #8), a11y polish (PR #9), Phase 10B (PR #10), bell-ringer paper-only (PR #11), topic-page print stylesheet (PR #12), mobile-panel responsive (PR #13 awaiting review).
**Companion plan:** `docs/plans/2026-05-02-gas-laws-background-section-implementation.md` (forthcoming).

---

## Goal

Add a new "How we got here — and where you will see it" section to the Gas Laws topic page. Provides historical context for the four laws (Boyle, Charles, Gay-Lussac, Avogadro), real-world applications, and IB international-mindedness content (Karlsruhe Congress 1860). HL students get a TOK note on how scientific consensus emerges across cultures; SL students get a distilled version of the same lesson in plain prose.

This is a content addition, not a structural change. One new HTML section in `examples/topic-page/index.html`, one new CSS rule in `components.css`, one new glossary entry in the data package.

---

## Locked decisions

| Decision                        | Choice                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Placement                       | New `<section class="topic-background">` between Topic introduction (5) and Key concept (6)                                             |
| HL/SL adaptation                | Same `data-variant="default-sl"` / `default-hl"` pattern as the existing topic-intro                                                    |
| Depth                           | Deep (per user choice) — biographical paragraphs + multiple examples + TOK link                                                         |
| Word target                     | HL ~500 words, SL ~250 words                                                                                                            |
| Section title                   | "How we got here — and where you will see it"                                                                                           |
| Subsection structure            | (1) framing, (2) four people / four pieces, (3) Karlsruhe 1860, (4) TOK note (HL only), (5) where you will see it (real-world examples) |
| International-mindedness anchor | Karlsruhe Congress 1860 (first international chemistry conference)                                                                      |
| TOK link (HL only)              | "The data didn't change in 50 years; what changed was the social context."                                                              |
| Glossary additions              | One new entry: `mendeleev` (referenced in the HL paragraph)                                                                             |
| CSS                             | New `.topic-background` rule modeled on `.topic-intro` (vertical rhythm + left accent)                                                  |

---

## Architecture

Standard topic-page section. Two `data-variant` blocks. The existing `applyLevel(level)` function in the inline `<script>` already toggles `[data-variant]` blocks via `el.hidden = !visible` — no JS changes needed; the new section participates automatically.

```
<section class="topic-background">
  <h2>How we got here — and where you will see it</h2>
  <div data-variant="default-sl">…SL content…</div>
  <div data-variant="default-hl">…HL content…</div>
</section>
```

---

## SL content (~250 words)

```html
<div data-variant="default-sl">
  <p>
    The equation <code>PV = nRT</code> did not appear all at once. Four scientists, working between
    1662 and 1811, each found one of the proportionalities. About 50 years later, an international
    meeting stitched their work together into the modern picture.
  </p>

  <h3>Four people, four pieces</h3>
  <ul>
    <li>
      <strong>Robert Boyle</strong> (1662, Anglo-Irish) — pressure and volume are inversely related
      at constant temperature.
    </li>
    <li>
      <strong>Jacques Charles</strong> (1787, French) — volume rises with temperature at constant
      pressure. He never published; his countryman Gay-Lussac printed the law in 1802 and named it
      after him.
    </li>
    <li>
      <strong>Joseph Louis Gay-Lussac</strong> (1809, French) — pressure rises with temperature at
      constant volume.
    </li>
    <li>
      <strong>Amedeo Avogadro</strong> (1811, Italian) — equal volumes of different gases at the
      same temperature and pressure contain the same number of molecules.
    </li>
  </ul>

  <h3>Karlsruhe, 1860 — science across borders</h3>
  <p>
    Avogadro's idea was ignored for 50 years. In 1860 the first international chemistry conference
    was held in Karlsruhe, Germany. About 140 chemists from across Europe attended. The Italian
    chemist
    <strong>Stanislao Cannizzaro</strong> handed out a pamphlet re-presenting Avogadro's argument,
    and the room was finally convinced. Scientific ideas do not always win on first publication —
    sometimes they need a community to agree.
  </p>

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
</div>
```

---

## HL content (~500 words)

```html
<div data-variant="default-hl">
  <p>
    The equation <code>PV = nRT</code> is a synthesis. Four scientists working across roughly 150
    years each contributed one of its proportionalities, and a fifth international gathering finally
    stitched their work together into the modern molecular picture you will use today.
  </p>

  <h3>Four people, four pieces</h3>
  <p>
    <strong>Robert Boyle</strong> (1627–1691, Anglo-Irish), working with the instrument-maker Robert
    Hooke at Oxford, used a J-shaped glass tube and a column of mercury to show in 1662 that
    pressure and volume of a trapped gas are inversely related at constant temperature. Boyle was a
    founding member of the Royal Society and an early advocate of the experimental method. The
    French physicist Edme Mariotte independently published the same result in 1676, which is why the
    law is called <em>Mariotte's law</em> in French-speaking countries.
  </p>
  <p>
    <strong>Jacques Charles</strong> (1746–1823, French) was a physicist and aeronaut who in 1783
    made the first manned flight in a hydrogen balloon. Around 1787 he established that volume
    increases linearly with temperature at constant pressure, but he never published the result. His
    countryman <strong>Joseph Louis Gay-Lussac</strong> (1778–1850) printed the law in 1802 and
    named it after Charles. Gay-Lussac then went further: in 1809 he showed that pressure rises
    linearly with temperature at constant volume — the law that bears his own name. He, too, made
    high-altitude balloon ascents to study the atmosphere directly.
  </p>
  <p>
    <strong>Amedeo Avogadro</strong> (1776–1856, Italian) hypothesised in 1811 that equal volumes of
    gases at the same temperature and pressure contain equal numbers of <em>molecules</em> —
    distinct from atoms. The idea was almost universally ignored for fifty years.
  </p>

  <h3>Karlsruhe, 1860 — science as an international project</h3>
  <p>
    Avogadro's molecular hypothesis was rescued at the
    <strong>Karlsruhe Congress</strong>, the first international chemistry conference, where about
    140 chemists from across Europe — French, German, British, Italian, Russian, Scandinavian —
    gathered to settle competing systems of atomic weights. The Sicilian chemist
    <strong>Stanislao Cannizzaro</strong> distributed a pamphlet re-presenting Avogadro's argument.
    A young
    <sim-glossary-term ref="mendeleev">Dmitri Mendeleev</sim-glossary-term>
    attended; he later said the Karlsruhe meeting was the moment the periodic table became
    thinkable. Avogadro's idea — published, ignored, then re-discovered through international
    dialogue — supplies the
    <code>n</code> in <code>PV = nRT</code>.
  </p>

  <h3>A theory-of-knowledge note</h3>
  <p>
    The data did not change between 1811 and 1860. What changed was the social context: an
    international meeting, a clear written argument, and a receptive audience. Scientific consensus
    is not just about being right — it is about being heard.
  </p>

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
      <strong>Avogadro's law</strong> — the basis of gas-phase stoichiometry (mole ratios equal
      volume ratios at the same T and P) and the molar volume of 22.7 dm³ mol⁻¹ at IB-standard STP.
    </li>
  </ul>
</div>
```

---

## CSS

Append to `packages/core/src/styles/components.css`, near the existing `.topic-intro` rule:

```css
/* Topic background — historical context, real-world relevance, IB
   international mindedness. Mirrors .topic-intro for vertical rhythm but
   with a slightly different left-accent color to signal "context" vs.
   "concept exposition". */
.topic-background {
  margin: var(--sp-5, 20px) 0;
  padding-left: var(--sp-4, 16px);
  border-left: 4px solid var(--ib-amber-500, #f59e0b);
  font-size: var(--fs-16, 16px);
  line-height: 1.6;
}
.topic-background h3 {
  margin-top: var(--sp-4, 16px);
  font-size: var(--fs-16, 16px);
  font-weight: 600;
}
.topic-background ul {
  margin: var(--sp-2, 8px) 0;
  padding-left: var(--sp-5, 20px);
}
```

If `--ib-amber-500` is not defined in `tokens.css`, the fallback `#f59e0b` (amber-500) renders fine. We can add the token in a follow-up if we want amber as a topic-page accent across sections.

---

## Glossary entry

Append to `packages/data/src/glossary.json`:

```json
"mendeleev": {
  "term": "Dmitri Mendeleev",
  "definition": "Russian chemist (1834–1907) who attended the Karlsruhe Congress in 1860 as a young researcher. He later credited the meeting as the turning point that made the modern periodic table thinkable; he published the first version in 1869."
}
```

The `<sim-glossary-term ref="mendeleev">` reference in the HL prose triggers the existing glossary tooltip mechanism.

---

## Files touched

| File                                      | Change                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `examples/topic-page/index.html`          | Insert new `<section class="topic-background">` between sections 5 and 6 |
| `packages/core/src/styles/components.css` | Append `.topic-background` rules                                         |
| `packages/data/src/glossary.json`         | Append `mendeleev` entry                                                 |
| `CHANGELOG.md`                            | One subsection note                                                      |
| `docs/architecture.md`                    | Short paragraph (optional)                                               |

5 files, ~120 lines added (mostly the SL + HL prose blocks). Single commit, single PR.

No new tests required (content addition only). Existing tests continue to pass.

---

## Manual verification

Open `examples/topic-page/index.html` in Chrome:

1. Scroll past the Topic introduction. New section visible with heading "How we got here — and where you will see it".
2. Default level is SL — confirm SL prose visible (the bulleted list of four scientists, the Karlsruhe paragraph, the four real-world example bullets).
3. Flip the HL toggle. SL content disappears; HL content appears (longer biographical paragraphs, TOK note, two examples per law).
4. Hover over "Dmitri Mendeleev" in the HL prose — glossary tooltip appears with the new definition.
5. Cmd+P (print preview) — the section appears in the handout for whichever level is active. (This is automatic — the existing `data-variant + [hidden]` pattern already gates print output.)
6. The reflection-only print mode (Save your work → Save as PDF) is unaffected.

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — **188 passing** (no test changes; existing count unchanged).
4. `pnpm build` clean. Bundle delta < +1 kB IIFE (new HTML in `index.html` doesn't ship in the JS bundle; only the new CSS rule + the new glossary entry contribute).
5. Manual check matches the 6-point list above.
6. CI green; PR merged.

---

## Out of scope (deferred)

- Adding more glossary entries beyond `mendeleev` (e.g. `karlsruhe-congress`, `cannizzaro`). Could be done in a follow-up if useful for cross-topic linking.
- Adding the `--ib-amber-500` token to `tokens.css`. The hex fallback works fine; tokenizing is a paint-bikeshed for a follow-up.
- Adding a TOK section to other topic pages (this section is Gas-Laws-specific until other topics adopt the same pattern).
- Translation / multilingual variants. The IB attracts students worldwide; a future polish phase could add `lang` attribution or alternate-language variants.

## Risks + mitigations

| Risk                                                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section makes the page significantly longer; might overwhelm on phone             | Mobile-panel responsive (PR #13) handles overlay panels. The new section is just inline content; users can scroll past. The HL/SL toggle keeps each individual user's view at appropriate depth.                                                                                                                                                                    |
| Biographical claims need to be factually accurate (dates, nationalities, details) | Drafted from well-attested historical record: Boyle (Royal Society biographies), Charles (encyclopedic sources), Gay-Lussac (Crosland's _Gay-Lussac: Scientist and Bourgeois_), Avogadro (Morselli's biography), Karlsruhe (de Milt's _The Congress at Karlsruhe_, J. Chem. Educ. 1951). The page already cites the IB Chemistry Guide 2025 as a source convention. |
| TOK note may feel too philosophical for some students                             | TOK is part of the IB diploma; this is appropriate for HL. SL gets the same lesson distilled into one plain sentence.                                                                                                                                                                                                                                               |
| Print mode renders the active variant only                                        | Existing `[hidden]` + `[hidden] { display: none }` handles this automatically; no new print rules needed.                                                                                                                                                                                                                                                           |
| New section's amber border conflicts with topic-intro's existing styling          | Topic-intro uses navy accents; topic-background uses amber. Visually distinct, supports the "context vs. concept" distinction.                                                                                                                                                                                                                                      |

This section establishes a pattern other topic pages can adopt: a single "How we got here / where you will see it" section per topic, with HL/SL adaptation, international-mindedness anchoring on a specific historical event, and a TOK note for HL.
