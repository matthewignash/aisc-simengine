# Gas-laws Background Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "How we got here — and where you will see it" section to the Gas Laws topic page with HL/SL adaptive prose covering the four gas laws' history, the Karlsruhe Congress 1860 international-mindedness anchor, a TOK note (HL only), and real-world examples.

**Architecture:** Content addition only. New `<section class="topic-background">` between sections 5 (Topic introduction) and 6 (Key concept) in `examples/topic-page/index.html`, with two `data-variant` blocks (SL ~250 words, HL ~500 words). One new CSS rule in `components.css` for `.topic-background`. One new glossary entry (`mendeleev`) in `packages/data/src/glossary.json`. No JS changes — the existing `applyLevel(level)` function already toggles `[data-variant]` blocks.

**Tech Stack:** Plain HTML + CSS + JSON. No new components, no JS, no new dependencies, no tests.

**Companion design doc:** `docs/plans/2026-05-02-gas-laws-background-section-design.md` (commit `1a05698` on main). Read for the verbatim prose blocks.

---

## Repo state at start

- `main` HEAD: post-PR-#12 (topic-page print stylesheet merged) + PR #13 awaiting review (mobile-panel responsive — orthogonal; this work branches off main regardless of PR #13 status). Plus the design doc commit `1a05698`.
- Baseline tests: **184** (178 core + 6 data) — assumes PR #13 has NOT yet merged. If PR #13 has merged, baseline is **188**. Either way, the test count is unchanged by this work.
- Worktree path: `.worktrees/gas-laws-background-section/` on branch `gas-laws-background-section`.

## Standards (carried from prior phases)

- Conventional commits.
- No git config edits. Use env vars on each commit:
  - `GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com"`
  - `GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com"`
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer on every commit.
- No `git add -A`. Stage files by name.
- No emojis in UI labels or commit messages.

---

## Single commit — `feat(examples): add gas-laws background + international-mindedness section`

5 files, ~120 lines added.

### Task 1 — Add the new HTML section to the topic page

**File:** `examples/topic-page/index.html`

Find the existing `</section>` that closes section 5 (Topic introduction), at approximately line 137 (the line right after the `default-hl` div's closing `</div>`). Insert this new section IMMEDIATELY AFTER that closing `</section>` and BEFORE the `<!-- 6. Key concept -->` comment:

```html
<!-- 5.5 Background, real-world relevance, IB international mindedness -->
<section class="topic-background">
  <h2>How we got here — and where you will see it</h2>

  <div data-variant="default-sl">
    <p>
      The equation <code>PV = nRT</code> did not appear all at once. Four scientists, working
      between 1662 and 1811, each found one of the proportionalities. About 50 years later, an
      international meeting stitched their work together into the modern picture.
    </p>

    <h3>Four people, four pieces</h3>
    <ul>
      <li>
        <strong>Robert Boyle</strong> (1662, Anglo-Irish) — pressure and volume are inversely
        related at constant temperature.
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
      chemist <strong>Stanislao Cannizzaro</strong> handed out a pamphlet re-presenting Avogadro's
      argument, and the room was finally convinced. Scientific ideas do not always win on first
      publication — sometimes they need a community to agree.
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

  <div data-variant="default-hl">
    <p>
      The equation <code>PV = nRT</code> is a synthesis. Four scientists working across roughly 150
      years each contributed one of its proportionalities, and a fifth international gathering
      finally stitched their work together into the modern molecular picture you will use today.
    </p>

    <h3>Four people, four pieces</h3>
    <p>
      <strong>Robert Boyle</strong> (1627–1691, Anglo-Irish), working with the instrument-maker
      Robert Hooke at Oxford, used a J-shaped glass tube and a column of mercury to show in 1662
      that pressure and volume of a trapped gas are inversely related at constant temperature. Boyle
      was a founding member of the Royal Society and an early advocate of the experimental method.
      The French physicist Edme Mariotte independently published the same result in 1676, which is
      why the law is called <em>Mariotte's law</em> in French-speaking countries.
    </p>
    <p>
      <strong>Jacques Charles</strong> (1746–1823, French) was a physicist and aeronaut who in 1783
      made the first manned flight in a hydrogen balloon. Around 1787 he established that volume
      increases linearly with temperature at constant pressure, but he never published the result.
      His countryman <strong>Joseph Louis Gay-Lussac</strong> (1778–1850) printed the law in 1802
      and named it after Charles. Gay-Lussac then went further: in 1809 he showed that pressure
      rises linearly with temperature at constant volume — the law that bears his own name. He, too,
      made high-altitude balloon ascents to study the atmosphere directly.
    </p>
    <p>
      <strong>Amedeo Avogadro</strong> (1776–1856, Italian) hypothesised in 1811 that equal volumes
      of gases at the same temperature and pressure contain equal numbers of <em>molecules</em> —
      distinct from atoms. The idea was almost universally ignored for fifty years.
    </p>

    <h3>Karlsruhe, 1860 — science as an international project</h3>
    <p>
      Avogadro's molecular hypothesis was rescued at the
      <strong>Karlsruhe Congress</strong>, the first international chemistry conference, where about
      140 chemists from across Europe — French, German, British, Italian, Russian, Scandinavian —
      gathered to settle competing systems of atomic weights. The Sicilian chemist
      <strong>Stanislao Cannizzaro</strong> distributed a pamphlet re-presenting Avogadro's
      argument. A young
      <sim-glossary-term ref="mendeleev">Dmitri Mendeleev</sim-glossary-term>
      attended; he later said the Karlsruhe meeting was the moment the periodic table became
      thinkable. Avogadro's idea — published, ignored, then re-discovered through international
      dialogue — supplies the <code>n</code> in <code>PV = nRT</code>.
    </p>

    <h3>A theory-of-knowledge note</h3>
    <p>
      The data did not change between 1811 and 1860. What changed was the social context: an
      international meeting, a clear written argument, and a receptive audience. Scientific
      consensus is not just about being right — it is about being heard.
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
        volume ratios at the same T and P) and the molar volume of 22.7 dm³ mol⁻¹ at IB-standard
        STP.
      </li>
    </ul>
  </div>
</section>
```

**Verify placement:** open the file, confirm the new section sits between the closing `</section>` of section 5 and the `<!-- 6. Key concept -->` comment of section 6. The blank line gap between sections matches the existing convention.

### Task 2 — Add the `.topic-background` CSS rule

**File:** `packages/core/src/styles/components.css`

Find the existing `.topic-intro` rule (search for `\.topic-intro\s*\{`). Append a new rule block IMMEDIATELY AFTER the topic-intro block (before whatever comes next):

```css
/* Topic background — historical context, real-world relevance, IB
   international mindedness. Mirrors .topic-intro for vertical rhythm but
   with a different left-accent color (amber) to signal "context" vs.
   "concept exposition" (.topic-intro uses navy). */
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

The `--ib-amber-500` token may not exist in `tokens.css`; the hex fallback `#f59e0b` is the standard amber-500 color and renders fine in both light and dark modes.

### Task 3 — Add the `mendeleev` glossary entry

**File:** `packages/data/src/glossary.json`

The file currently has the shape:

```json
{
  "terms": {
    "pressure": { "term": "...", "definition": "..." },
    "ideal-gas": { "term": "...", "definition": "..." },
    "van-der-waals": { "term": "...", "definition": "..." },
    "kinetic-energy": { "term": "...", "definition": "..." }
  }
}
```

Add a new key `"mendeleev"` to the `terms` object. Place it AFTER the existing `"kinetic-energy"` entry. The closing `}` of `kinetic-energy` needs a comma added; then insert the new entry. End result:

```json
{
  "terms": {
    "pressure": {
      "term": "pressure",
      "definition": "The force that gas particles apply to the walls of their container, divided by the area of those walls. Measured in pascals (Pa) or kilopascals (kPa)."
    },
    "ideal-gas": {
      "term": "ideal gas",
      "definition": "A theoretical gas whose particles have no volume of their own and don't attract each other. Real gases approximate this at low pressure and high temperature."
    },
    "van-der-waals": {
      "term": "van der Waals equation",
      "definition": "An equation that improves on PV = nRT for real gases by adding two correction terms: one for the volume of the particles themselves, and one for the attractive forces between them."
    },
    "kinetic-energy": {
      "term": "kinetic energy",
      "definition": "The energy a particle has due to its motion. Higher temperature means higher average kinetic energy."
    },
    "mendeleev": {
      "term": "Dmitri Mendeleev",
      "definition": "Russian chemist (1834–1907) who attended the Karlsruhe Congress in 1860 as a young researcher. He later credited the meeting as the turning point that made the modern periodic table thinkable; he published the first version in 1869."
    }
  }
}
```

**Verify** the JSON parses (no trailing comma after the new entry; comma added after the now-not-last `"kinetic-energy"` entry). After saving, run `pnpm test --filter @TBD/simengine-data` to confirm the data package still passes its 6 tests.

### Task 4 — Add CHANGELOG entry

**File:** `CHANGELOG.md`

Find the existing `### Mobile-panel responsive (post-10B)` subsection (just added in PR #13's plan). After its end and BEFORE the `### Notes` footer, insert:

```markdown
### Gas-laws background section (post-10B)

- New "How we got here — and where you will see it" section on the Gas Laws topic page (`examples/topic-page/index.html`), inserted between Topic introduction (5) and Key concept (6). Provides historical context for the four gas laws (Boyle, Charles, Gay-Lussac, Avogadro), the Karlsruhe Congress 1860 as an IB international-mindedness anchor, real-world examples, and (HL only) a TOK note on how scientific consensus emerges across cultures.
- HL/SL adaptive via the existing `data-variant` mechanism. SL ~250 words; HL ~500 words. The existing `applyLevel(level)` function in the inline `<script>` already handles the toggle.
- New `.topic-background` CSS rule in `components.css` modeled on `.topic-intro` with an amber left-accent border (vs. navy for topic-intro) to signal "context" vs. "concept exposition."
- New `mendeleev` entry in `packages/data/src/glossary.json` referenced by `<sim-glossary-term ref="mendeleev">` in the HL prose.
- No new tests, no new components, no JS changes. Bundle bytes minimally impacted (one new CSS rule + one new glossary entry).
```

### Task 5 — Add architecture.md note (optional but encouraged)

**File:** `docs/architecture.md`

Find the existing `## Mobile-panel responsive` section. After its end, append:

```markdown
## Topic-page background sections

The Gas Laws topic page now includes a "topic-background" section between the topic introduction and the key concept. The pattern: a new `<section class="topic-background">` with two `data-variant` blocks (SL + HL) for level-adaptive prose. The existing `applyLevel(level)` function in the inline page script handles the toggle automatically — any future topic page can adopt the same shape with no JS changes.

The section is intended for historical context, real-world applications, and IB international-mindedness content. The `.topic-background` CSS rule uses an amber left-accent border, distinguishing it visually from the navy-accented `.topic-intro` (concept exposition). Future topic pages adopting this pattern should target the same convention so the visual rhythm carries across the curriculum.

For HL prose, a brief TOK (theory of knowledge) note is appropriate when the historical narrative supports it. SL prose distills the same lesson into one accessible sentence.
```

### Task 6 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean (the new HTML may need prettier reformatting; that's fine).
- lint: 0 errors, no new warnings (no JS changes; lint won't have anything new to flag).
- test: **unchanged** from baseline (184 if pre-PR-#13, 188 if post-PR-#13). No test changes.
- build: green; bundle bytes minimally impacted.

Stage exactly these 5 files:

```bash
git add \
  examples/topic-page/index.html \
  packages/core/src/styles/components.css \
  packages/data/src/glossary.json \
  CHANGELOG.md \
  docs/architecture.md
```

Commit with env-var attribution and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(examples): add gas-laws background + international-mindedness section

New "How we got here — and where you will see it" section on the
Gas Laws topic page, between the Topic introduction and Key
concept sections. Provides:

  - Historical context for the four gas laws and the scientists
    behind them: Boyle (1662, Anglo-Irish), Charles (1787, French),
    Gay-Lussac (1809, French), Avogadro (1811, Italian).
  - The Karlsruhe Congress 1860 as the IB international-mindedness
    anchor — first international chemistry conference, ~140
    chemists from across Europe, Cannizzaro's revival of Avogadro's
    50-year-old molecular hypothesis, Mendeleev's attendance.
  - A theory-of-knowledge note (HL only) on how scientific
    consensus emerges across cultures: "the data didn't change in
    50 years; what changed was the social context."
  - Real-world examples for each law (scuba diving, hot-air
    balloons, pressure cookers, gas-phase stoichiometry).

Implementation:

  - HL/SL adaptive via the existing data-variant mechanism.
    SL ~250 words; HL ~500 words. No JS changes — applyLevel(level)
    already toggles [data-variant] blocks.
  - New .topic-background CSS rule in components.css modeled on
    .topic-intro with an amber left-accent (vs. navy for
    topic-intro), signaling "context" vs. "concept exposition."
  - New mendeleev entry in packages/data/src/glossary.json,
    referenced by <sim-glossary-term ref="mendeleev"> in the HL
    prose.

No new components, no new tests, no JS changes. Test count
unchanged. Bundle bytes minimally impacted.

The pattern (a topic-background section with HL/SL data-variant
blocks, amber accent, historical + real-world + TOK content) is
intended as a template other topic pages can adopt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH from inside the implementer; the controller pushes after final review.

---

## Final verification

After the commit lands, run the pipeline once more:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

All green expected.

**Manual verification (Chrome):** start a static server from the worktree root:

```bash
python3 -m http.server 8765
```

Open http://localhost:8765/examples/topic-page/index.html. Verify:

1. Scroll past the Topic introduction. New section visible with heading "How we got here — and where you will see it".
2. Default level is SL — the SL prose is shown (bulleted list of four scientists, Karlsruhe paragraph, four real-world example bullets).
3. Flip the HL toggle in the sticky header. SL content disappears; HL content appears (longer biographical paragraphs, TOK note, two examples per law).
4. Hover over "Dmitri Mendeleev" in the HL prose. Glossary tooltip appears with the new definition.
5. Cmd+P (print preview). The currently-active variant (SL or HL) appears in the handout. Other variant is hidden via the existing `[hidden]` mechanism.
6. Save your work → Save as PDF. Reflection-only print mode unaffected.
7. On phone-width viewport (DevTools mobile emulation, e.g. iPhone SE 375 × 667): section reads cleanly, amber left-accent border visible, lists wrap appropriately.

**Push the branch + open PR:**

```bash
git push -u origin gas-laws-background-section
gh pr create --base main --head gas-laws-background-section \
  --title "Add gas-laws background + international-mindedness section" \
  --body "[generated body]"
```

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (0 errors, 0 new warnings).
3. `pnpm test` — baseline unchanged (184 or 188 depending on PR #13 status).
4. `pnpm build` clean.
5. Manual verification matches the 7-point list above.
6. CI green; PR merged.

---

## Out of scope (deferred)

- Adding more glossary entries (`karlsruhe-congress`, `cannizzaro`, `boyle`, etc.) — could come later.
- Adding `--ib-amber-500` to `tokens.css` — hex fallback works fine.
- Adopting the topic-background pattern on other topic pages — gas laws is the template; other topics adopt later.
- Multilingual / `lang`-attributed alternate prose — future polish.
