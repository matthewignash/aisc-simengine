# Phase 10A — `<sim-checklist>` interactive success-criteria + export — design

**Author:** Matthew Ignash (with Claude planning support)
**Date:** 2026-04-30
**Status:** approved, ready for implementation
**Predecessor:** `docs/plans/2026-04-30-phase9-data-card-side-panel-design.md` (phase 9 in PR #6, ready to merge)

## Context

After step 8 + phase 9 shipped, the user identified three improvements to the Gas Laws topic page during live review. Two have already shipped (phase 8a content alignment + IB Understandings, phase 9 data-card slide-out). The third is the focus of phase 10: making the success-criteria column an interactive checklist that students can tick off + reflect on + export, instead of a static list.

The user's original phrasing in PR #5 review was: _"I liked when the success criteria were a checklist, maybe a side panel again that the students could reflect on and have that as an export option."_ Brainstorming clarified this into two phases:

- **Phase 10A (this doc):** ship the interactive success-criteria checklist with free-text reflection and export (.md + PDF). Inline replacement of the existing static SC column.
- **Phase 10B (separate, later):** expand interactivity to bell ringer + practice question + exit ticket, with a `<sim-reflection-export>` aggregator that pulls state from all interactive components. The 10A export pipeline becomes the foundation.

Phase 10A delivers the user's original ask in a contained, reviewable phase (~4 commits, +7 tests). 10B is a follow-up brainstorm + design + plan.

## Decisions locked during brainstorming

| Decision                  | Choice                                                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the checklist lives | Inline (replaces the static `.ib-lisc__col--sc` column in the topic page's LISC section). No new side panel; the existing inline location is where students already see the criteria.                                                                                   |
| Reflection content        | Checklist + free-text reflection textarea. Per-criterion notes, worked-example interaction, and other portfolio expansions defer to phase 10B.                                                                                                                          |
| Component scope           | Generic `<sim-checklist>` (reusable for any topic / any list). Slot-based `<li>` items, attribute-driven topic + level + label.                                                                                                                                         |
| Persistence               | localStorage, **per topic + per level** (separate state for SL vs HL). Key: `aisc-simengine:checklist:<topic>:<level>`. Restored on page load. Auto-save on toggle (immediate) and on textarea input (300ms debounce). Force-flush of pending textarea on level change. |
| Export format(s)          | Two buttons: **Download .md** (one-click `<a download>` of a markdown file) + **Save as PDF** (browser print dialog via `window.print()`). Word and one-click jsPDF rejected on bundle-weight grounds.                                                                  |
| Print scope               | Reflection only — topic title + level + date + checklist + reflection text. Whole-page print is the deferred §12 polish item, not in scope here.                                                                                                                        |
| Mount strategy            | Page authors include `<sim-checklist topic="..." level="..." label="...">` markup with slotted `<li>` items, same as the tweaks-panel and data-card conventions.                                                                                                        |
| Reset                     | Reset button with `window.confirm()` prompt. Clears state + localStorage + emits `checklist-reset` event.                                                                                                                                                               |
| DOM safety                | All synthesized DOM (shadow-DOM render + print-block synthesis) uses `createElement` + `textContent` + `appendChild`. **No `.innerHTML`** anywhere in the component. Matches the codebase's existing convention from step 6.                                            |

## Architecture

### File layout

```
packages/core/src/components/
└── sim-checklist.js               # NEW custom element

packages/core/src/index.js          # MODIFY: side-effect import after sim-coachmark.js

packages/core/src/styles/components.css  # MODIFY: ~25 lines of @media print rules at the end
                                          #         (the print-reflection-only stylesheet)

packages/core/tests/
└── sim-checklist.test.js          # NEW (~7 tests)

examples/topic-page/index.html      # MODIFY:
                                    #   - SC column <ul> → <sim-checklist topic="s1.5-gas-laws"
                                    #     level="sl" label="Success criteria"> with slotted <li>s
                                    #   - Inline script's applyLevel(level) also pushes the new
                                    #     level to all <sim-checklist> via setAttribute('level')

CHANGELOG.md                        # MODIFY: phase 10A entry
docs/architecture.md                # MODIFY: new "Phase 10A" section
```

**Bundle delta expected:** ≤ +3 kB IIFE (current: 86.09 kB after phase 9). The component is ~200 lines including markup, state, export logic, and shadow-DOM CSS.

**Smoke test untouched.** `examples/vanilla-html/index.html` is the component-level smoke surface; it doesn't have a LISC section and doesn't need a checklist.

**No changes to** `<sim-engine>`, `<sim-data-pill>`, `<sim-data-card>`, `<sim-glossary-term>`, `<sim-tweaks-panel>`, `<sim-coachmark>`, or `packages/data/`. Phase 10A is fully additive.

### Component contract — `<sim-checklist topic="…" level="…" label="…">`

| Attribute | Required | Behavior                                                                                                                                                                       |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `topic`   | required | Used in the localStorage key (`aisc-simengine:checklist:<topic>:<level>`) and as the title in exports. e.g. `topic="s1.5-gas-laws"`.                                           |
| `level`   | optional | Per-level scoping. If omitted, defaults to `default`. Topic page sets `level="sl"` initially; the inline script flips to `"hl"` via `setAttribute` when the HL toggle changes. |
| `label`   | optional | Heading text. Defaults to "Checklist". For the SC use case: `label="Success criteria"`.                                                                                        |

**Slotted content:** plain `<li>` elements. Component reads them at upgrade, captures `textContent` into an `items[]` array, then clears the host's light DOM and renders an interactive checkbox-row per item in shadow DOM.

```html
<sim-checklist topic="s1.5-gas-laws" level="sl" label="Success criteria">
  <li>Describe what happens to P when V halves at constant T and n.</li>
  <li>Calculate P, V, T, or n given the other three quantities.</li>
  <li>Explain the shape of a P–V graph at constant temperature and label its axes.</li>
</sim-checklist>
```

**Rendered structure (shadow DOM, built via createElement + textContent):**

```
<div class="sim-checklist">
  <header class="sim-checklist__head">
    <h3 class="sim-checklist__label">{label}</h3>
    <span class="sim-checklist__progress">{n} of {total} checked</span>
  </header>

  <ul class="sim-checklist__list">
    <li>
      <label>
        <input type="checkbox" data-idx="{i}" />
        <span>{item text}</span>
      </label>
    </li>
    ...
  </ul>

  <textarea class="sim-checklist__reflection"
            placeholder="Where did you get stuck? What surprised you? (optional)"
            aria-label="My reflection"></textarea>

  <div class="sim-checklist__actions">
    <button class="sim-btn" data-action="download-md">📄 Download .md</button>
    <button class="sim-btn" data-action="save-pdf">🖨 Save as PDF</button>
    <button class="sim-btn sim-btn--ghost" data-action="reset">Reset</button>
  </div>
</div>
```

**Events emitted (light-DOM, `bubbles: true, composed: true`):**

- `checklist-changed` with `detail: { topic, level, checkedCount, total, freeText }` — fires on any check toggle or textarea input (debounced 300ms). Phase 10B's `<sim-reflection-export>` aggregator will listen.
- `checklist-exported` with `detail: { topic, level, format: 'md' | 'pdf' }` — fires when an export button is clicked.
- `checklist-reset` with `detail: { topic, level }` — fires after a confirmed reset.

**Imperative API on the element:**

- `getState()` → `{ topic, level, checkedItems: number[], freeText: string }`. Phase 10B uses this.
- `exportMarkdown()` → returns the markdown string (also used internally by the .md button).
- `exportPDF()` → synthesizes the print block, sets `body.printing-reflection`, calls `window.print()`.

### Persistence model

- localStorage key: `aisc-simengine:checklist:<topic>:<level>` (per Q2 — separate state per level).
- JSON shape: `{ checkedItems: [0, 2], freeText: "..." }`.
- Loaded on `connectedCallback`. Saved synchronously on every check toggle and on textarea `input` (300ms debounce).
- `level` attribute change: **force-flush** the pending textarea debounce to the OLD key BEFORE switching to the new key. Prevents the "level switch eats unsaved typing" race.
- localStorage write/read failures wrapped in try/catch — same graceful pattern as `<sim-coachmark>`.

### Export pipeline

**Markdown** (one-click download):

```js
function exportMarkdown() {
  const state = this.getState();
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# ${this._topicTitle()} — Reflection`,
    `**Level:** ${state.level || 'default'} · **Date:** ${date}`,
    '',
    `## ${this.getAttribute('label') || 'Checklist'}`,
    '',
    ...this._items.map((text, i) => {
      const mark = state.checkedItems.includes(i) ? '[x]' : '[ ]';
      return `- ${mark} ${text}`;
    }),
  ];
  if (state.freeText.trim()) {
    lines.push('', '## My reflection', '', state.freeText);
  }
  return lines.join('\n');
}
```

Then a `Blob` + `URL.createObjectURL` + `<a download>` pattern fires the browser save dialog. The temporary anchor element is created via `document.createElement('a')` (NOT via `innerHTML`), the URL is revoked on the next tick, and the anchor is removed.

Filename: `<topic>-<level>-reflection.md` (e.g. `s1.5-gas-laws-sl-reflection.md`).

**PDF** (via browser print dialog):

The print block is synthesized via DOM methods only — `createElement`, `textContent`, `classList.add`, `appendChild`. **No `.innerHTML`.** Sketch:

```js
function _buildPrintBlock(state) {
  const container = document.createElement('div');
  container.id = 'print-reflection-output';

  // Heading
  const h1 = document.createElement('h1');
  h1.textContent = `${this._topicTitle()} — Reflection`;
  container.appendChild(h1);

  // Meta line
  const meta = document.createElement('p');
  meta.className = 'reflection-meta';
  const date = new Date().toISOString().slice(0, 10);
  meta.textContent = `Level: ${state.level || 'default'} · Date: ${date}`;
  container.appendChild(meta);

  // Section heading + checklist
  const h2 = document.createElement('h2');
  h2.textContent = this.getAttribute('label') || 'Checklist';
  container.appendChild(h2);

  const ul = document.createElement('ul');
  for (let i = 0; i < this._items.length; i++) {
    const li = document.createElement('li');
    if (state.checkedItems.includes(i)) li.classList.add('checked');
    li.textContent = this._items[i]; // safe — no HTML interpretation
    ul.appendChild(li);
  }
  container.appendChild(ul);

  // Free-text reflection
  if (state.freeText.trim()) {
    const h2b = document.createElement('h2');
    h2b.textContent = 'My reflection';
    container.appendChild(h2b);
    const div = document.createElement('div');
    div.className = 'reflection-text';
    div.textContent = state.freeText; // preserved as text; CSS white-space: pre-wrap honors newlines
    container.appendChild(div);
  }

  return container;
}

function exportPDF() {
  const state = this.getState();
  const newBlock = this._buildPrintBlock(state);

  // Replace any prior print block
  const old = document.getElementById('print-reflection-output');
  if (old) old.replaceWith(newBlock);
  else document.body.appendChild(newBlock);

  document.body.classList.add('printing-reflection');
  window.print();
  // Cleanup happens via the afterprint listener
}
```

`afterprint` listener (registered once in `connectedCallback`) clears `body.printing-reflection`. The synthesized div is left in the DOM; on next export, it's swapped out with `replaceWith`.

## CSS additions

**Shadow-DOM stylesheet** (~80 lines, internal to component): all standard tokens, no new color additions. Adopted via constructable stylesheet, same pattern as every prior component.

**Global `components.css`** gains ~25 lines of `@media print` rules at the end:

```css
@media print {
  body.printing-reflection > *:not(#print-reflection-output) {
    display: none !important;
  }
  body.printing-reflection #print-reflection-output {
    display: block !important;
  }
}
#print-reflection-output {
  display: none; /* hidden in screen mode; shown only via print stylesheet */
}
#print-reflection-output h1 {
  font-size: 20pt;
  margin: 0 0 16pt;
}
#print-reflection-output h2 {
  font-size: 14pt;
  margin: 16pt 0 8pt;
}
#print-reflection-output ul {
  list-style: none;
  padding: 0;
}
#print-reflection-output ul li {
  padding: 4pt 0;
  font-size: 11pt;
}
#print-reflection-output ul li::before {
  content: '[ ] ';
  font-family: monospace;
}
#print-reflection-output ul li.checked::before {
  content: '[x] ';
}
#print-reflection-output .reflection-meta {
  color: #555;
  font-size: 10pt;
  margin-bottom: 12pt;
}
#print-reflection-output .reflection-text {
  font-size: 11pt;
  line-height: 1.5;
  white-space: pre-wrap;
}
```

All design tokens used in the shadow-DOM CSS verified defined in `tokens.css`: `--ib-white`, `--ib-ink-{100,200,300,500,700}`, `--ib-navy-{050,600,800}`, `--font-sans`, `--font-mono`, `--fs-{13,14,18}`, `--sp-{2,3,4}`, `--r-md`, `--focus-ring`. No undefined-token gaps.

## Lifecycle behaviors

```
[component mount via connectedCallback]
  - read slotted <li> items, capture their textContent into items[] array
  - clear the host's light DOM (remove the original <li>s)
  - render shadow-DOM structure (header / list / textarea / actions) via createElement
  - load state from localStorage key `aisc-simengine:checklist:<topic>:<level>`
  - apply state: check the right boxes; populate the textarea
  - update progress indicator: "X of Y checked"
  - register event listeners on shadow-DOM elements (checkboxes, textarea, buttons)
  - register `window.addEventListener('afterprint', this._afterPrint)`

[user toggles a checkbox]
  - update internal state (checkedItems array)
  - update progress text
  - save to localStorage (synchronous; tiny payload)
  - dispatch checklist-changed event

[user types in the reflection textarea]
  - debounce 300ms
  - on debounce: save to localStorage; dispatch checklist-changed

[user clicks "Download .md"]
  - exportMarkdown() generates the markdown string
  - create Blob with type 'text/markdown'
  - create temporary <a download="<topic>-<level>-reflection.md"> via createElement
  - programmatic .click() to trigger download
  - URL.revokeObjectURL on the next tick; remove the temporary anchor
  - dispatch checklist-exported { format: 'md' }

[user clicks "Save as PDF"]
  - synthesize the print block via _buildPrintBlock (createElement + textContent)
  - replace any prior #print-reflection-output via element.replaceWith
  - body.classList.add('printing-reflection')
  - window.print() (browser opens its native print dialog)
  - on afterprint event: body.classList.remove('printing-reflection')
  - dispatch checklist-exported { format: 'pdf' }

[user clicks "Reset"]
  - confirm() dialog: "Clear all checks and reflection text? This cannot be undone."
  - if confirmed:
      - uncheck all checkboxes
      - clear the textarea
      - remove the localStorage key
      - dispatch checklist-reset event

[level attribute changes via setAttribute('level', newLevel)]
  - attributeChangedCallback handles 'level':
      - flush pending textarea debounce to the OLD key
      - load state from new key
      - re-render check states + textarea
      - update progress indicator

[disconnectedCallback]
  - clear pending textarea debounce timer
  - remove window 'afterprint' listener
  - reset _initialized = false (consistent with prior components)
```

### Subtle interactions called out

**"Level switch eats unsaved typing":** the textarea has a 300ms debounce. If a user types and immediately flips HL/SL within 300ms, the unsaved typing might not flush before the level attribute change loads from the new key. **Defense:** force-flush in `attributeChangedCallback('level', ...)` before switching keys.

**`afterprint` cancel-vs-confirm:** modern browsers fire `afterprint` when the print dialog closes regardless of whether the user printed or canceled. Cleanup runs in either case.

**Component upgrade timing on the topic page:** the inline script calls `applyLevel(initialLevel)` early — before custom-element microtasks have drained. At that moment `<sim-checklist>` may not yet be upgraded. The `setAttribute('level', initialLevel)` call still works (HTMLElement attributes persist across upgrade), and when the component upgrades, its `attributeChangedCallback` runs with the already-set value — same pattern that worked for `<sim-engine>` in step 8.

## Tests

7 new tests in `packages/core/tests/sim-checklist.test.js`. Pipeline target: **143 → 150**.

| #   | Test                                                                | Coverage                                                                                                                                         |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | renders slotted `<li>`s as interactive checkbox rows                | Mount with 3 slotted `<li>`s → shadow DOM has 3 checkboxes + 3 spans with the original text. Light-DOM `<li>`s gone.                             |
| 2   | progress indicator updates on check toggle                          | Toggle 2 of 3 → header shows "2 of 3 checked".                                                                                                   |
| 3   | state persists to localStorage on toggle                            | Toggle box 1 → localStorage key `aisc-simengine:checklist:s1.5-gas-laws:sl` contains `{ checkedItems: [1], freeText: '' }`.                      |
| 4   | state restores from localStorage on mount                           | Pre-populate localStorage with `{ checkedItems: [0, 2], freeText: 'sample' }` → mount → boxes 0+2 checked, textarea shows "sample".              |
| 5   | level attribute change loads state from the new key                 | Mount with `level="sl"`, set state. `setAttribute('level', 'hl')` → textarea + checks reset to fresh HL state.                                   |
| 6   | Download .md generates correct markdown payload                     | Spy on `URL.createObjectURL` + `Blob`; click button; assert blob text contains topic header, level, "## Success criteria", proper `[x]` / `[ ]`. |
| 7   | Reset clears state, localStorage, and emits `checklist-reset` event | Set checked + textarea state. Stub `window.confirm` → `true`. Click Reset. Verify all boxes unchecked, textarea empty, key removed, event fired. |

**Test patterns inherited from prior phases:**

- `beforeEach(() => document.body.replaceChildren())` for isolation.
- `vi.spyOn(...)` for `URL.createObjectURL` / `URL.revokeObjectURL` / `window.confirm` with `afterEach` restore (matches the clipboard descriptor pattern from step 6 commit 5).
- `await Promise.resolve()` after `appendChild` to drain `customElements.define` queueMicrotask.
- localStorage manipulated directly in tests; `localStorage.clear()` in `beforeEach` for isolation.

**Not tested in 10A** (manual visual verification only):

- The `window.print()` flow — happy-dom is unreliable for `afterprint` simulation; this is E2E territory.
- Print stylesheet visual correctness — manual browser check in exit criteria.
- 300ms textarea debounce timing — testing the platform's `setTimeout`, not our logic.

## Sequencing — 4 commits

| #   | Commit                                                                             | Files                                                                                                                                          | Cum tests |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | `feat(core): <sim-checklist> custom element`                                       | `sim-checklist.js`, `sim-checklist.test.js`, `index.js` (side-effect import), `components.css` (print stylesheet ~25 lines at end)             | 143 → 150 |
| 2   | `feat(examples): topic-page replaces static success-criteria with <sim-checklist>` | `examples/topic-page/index.html` (LISC SC column → `<sim-checklist>`; inline script's `applyLevel` also pushes new level to all checklist els) | 150       |
| 3   | `docs: phase 10A — interactive success-checklist + export`                         | `CHANGELOG.md`, `docs/architecture.md`                                                                                                         | 150       |

Why combine the component, tests, side-effect import, and global print CSS into commit 1: they're tightly coupled. The component dispatches its export buttons; the print CSS is what makes the PDF flow visually correct; tests need the component imported. Splitting would leave the pipeline broken between sub-commits.

End state: 150 tests passing. Topic page's success-criteria column is interactive. Students can check items, type a reflection, download .md or save as PDF.

## Phase 10A exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (no new warnings beyond the pre-existing 6).
3. `pnpm test` — **150 tests** passing (was 143 after phase 9).
4. `pnpm build` produces ESM + IIFE bundles. Bundle delta ≤ +3 kB IIFE.
5. `examples/topic-page/index.html` (after `pnpm build`) opens in a browser and shows:
   - LISC section: LI column unchanged + SC column rendered as `<sim-checklist>` with header ("Success criteria · 0 of 3 checked"), 3 checkboxes, reflection textarea, 3 buttons (Download .md / Save as PDF / Reset).
   - Toggling a checkbox updates the "X of 3 checked" progress text live.
   - Typing in the textarea, then reloading, retains the text.
   - Flipping HL/SL → checkboxes and textarea swap to per-level state. Unsaved typing survives the swap.
   - "Download .md" → browser downloads `s1.5-gas-laws-sl-reflection.md` (or `-hl-`) with topic header, date, level, `[x]` / `[ ]` checklist, and `## My reflection` (omitted if empty).
   - "Save as PDF" → native print dialog opens. Preview shows ONLY the reflection block. After dismissing, page returns to normal.
   - "Reset" → confirmation prompt. Confirming clears state + localStorage.
   - localStorage key visible in DevTools at `aisc-simengine:checklist:s1.5-gas-laws:sl` (or `:hl`).
6. CI green on PR; merged to `main`.

### What you will NOT have at end of phase 10A (and that is correct)

- Bell ringer / practice question / exit ticket interactivity — these come in phase 10B with `<sim-text-response>` and `<sim-practice-question>`.
- Aggregated whole-topic reflection portfolio export — phase 10A's .md/PDF cover only the success-criteria checklist + free-text. Phase 10B refactors export into `<sim-reflection-export>`.
- Whole-topic-page print stylesheet (spec §12 polish) — only reflection-only print is implemented.
- Mobile/tablet responsive tweaks for narrow viewports — defer to a polish phase.
- Animated check transitions, fancy progress bar — current uses simple "X of Y" text and native checkbox styling.
- The two follow-up tasks from step 6 (still queued): `<sim-engine>` public API; `<sim-coachmark>` `<slot>` reinstatement.
