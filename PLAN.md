# CRUX plan

**Updated:** 24 September 2026
**Direction agreed:** one reader, one journey.

## Why

A usability and design review (24 September 2026) found that the product's core ideas are strong and its visual foundation is good, but the app has no single journey:

- four entry points (`/`, `/discover`, `/author`, `/live`) and three separate implementations of the audience reading views;
- the best expression of the mental model — the four questions with SAYS / SHOWS / HAPPENED — is buried inside `/author`, while the home page omits the grammar entirely;
- discovery ends at a dead end: a confirmed record cannot be read as a public or affected-person view without downloading and re-uploading JSON;
- "what power does AI have?" is expressed three different ways (Suggest/Recommend/Decide/Act; five influence checkboxes plus five agency options; "AI does / AI does not").

See [product mental model](docs/PRODUCT_MENTAL_MODEL.md) for the north star this plan serves.

## Target experience

```text
Home ── one worked example, rendered by the shared Reader
  │
  └─ "Describe your own AI use"
        ├─ from a repository  (discovery → confirm)
        └─ from scratch       (guided authoring)
                 │
                 ▼
     The same Reader, showing *their* record,
     with Internal / Public / Affected-person views
```

Principles:

- **One Reader** renders every record, everywhere, using the four questions and SAYS / SHOWS / HAPPENED / UNKNOWN.
- **One power vocabulary**: Suggest → Recommend → Decide → Act, plus "before anything happens…".
- **Every journey ends in the Reader.** Seeing your own record through someone else's eyes is the payoff.
- Technical surfaces (`/live`, `/test`, `/discover/runtime`) move to a secondary "Lab" area.

## Phases

### Phase 0 — Hygiene ✅ (branch `phase-0-cleanup`)

- [x] Delete orphaned components: `mental-model-workbench`, `organisational-workbench`, `pilot-workbench`, `learning-case-picker`, and the newly orphaned `authority-summary` (2,119 lines).
- [x] Remove the duplicate "What happened in this particular case?" form (rendered by both `authority-editor` and question 04 of the guided editor).
- [x] Discovery: "Not sure yet" now acknowledges uncertainty; the no-op "These signals belong to different uses" button is removed until splitting exists.
- [x] Shared plain-language labels in `apps/pilot/lib/labels.ts` (authority, influence, evidence kind, action control), with tests. Readers no longer see raw values such as `human` or `system_configuration`.
- [x] Visible keyboard focus styles.
- [x] Commit `pnpm-lock.yaml`; CI installs with `--frozen-lockfile`.

### Phase 1 — One Reader (plan before building; >50 lines)

- [ ] Extract a single `CruxReader` with one view model built from either the canonical bundle (internal) or a disclosure projection (public / affected person) — the disclosure boundary must stay intact.
- [ ] Sections follow the four questions and use SAYS / SHOWS / HAPPENED / UNKNOWN in every audience view (the public view currently shows evidence without the claim it supports).
- [ ] Replace the home, `/author` read mode and `/live` reading views with it.
- [ ] Tests: the Reader renders only projection fields for public and affected-person views.

### Phase 2 — Every journey ends in the Reader

- [ ] After discovery confirmation, open the Reader on the in-memory draft (no persistence required).
- [ ] "Download portable record" becomes a secondary action, not the only way out.
- [ ] Guided authoring "See how this reads" uses the same Reader.

### Phase 3 — Information architecture and copy (plan first)

- [ ] Single front door on `/`: one example and one call to action, "Describe your own AI use".
- [ ] Move `/live`, `/test`, `/discover/runtime` under a "Lab" link.
- [ ] Remove stacked duplicate headlines on `/discover`.
- [ ] One power-ladder component used by discovery, authoring and the Reader.
- [ ] Copy pass: remove developer language from user-facing text ("first regression", "bounded hosted probe", "model identifier unknown", "review before effect", system-version refs).
- [ ] Authoring: one question per step; progressive detail stays hidden until consequence or agency requires it.

### Phase 4 — Visual system (plan first)

- [ ] Replace per-component minified style strings with one stylesheet or CSS modules; resolve colliding global class names (`.card`, `.step`, `.field`, `.boundary`, `.flow`, `.mark`, `.arrow`).
- [ ] Remove CSS left unused after Phase 0 (e.g. `.question-strip`, `.teaching-card`, `.claim`).
- [ ] Typeface pair via `next/font` (no new dependency) — **typeface choice needed**.
- [ ] Minimum label size of 11px (currently 26 labels at 8–10px).
- [ ] Distinctive marks for SAYS / SHOWS / HAPPENED / UNKNOWN and consistent AI / person / decision / action node styles.
- [ ] Promote "AI stops here" from caption to a clear visual boundary.
- [ ] Favicon.

## Later / not yet scheduled

- Splitting discovery signals into separate AI uses (replaces the removed button).
- Collapse the minified single-line JSX in `audience-workbench` once the Reader replaces it.
- `apps/pilot/tsconfig.tsbuildinfo` and Playwright's `.playwright-mcp/` output are not git-ignored.

## Decision log

| Date | Decision |
| --- | --- |
| 2026-09-24 | Adopt "one reader, one journey" as the product direction. |
| 2026-09-24 | Remove the non-functional "signals belong to different uses" button rather than fake it. |
| 2026-09-24 | Case records remain limited to consequential uses (matches the mental model's proportionality principle). |
