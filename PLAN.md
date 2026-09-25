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

### Phase 1 — One Reader ✅ (branch `phase-1-reader`)

- [x] One pure view model, `apps/pilot/lib/reader-model.ts`, built from either the working record (internal) or a disclosure projection (public / affected person). The audience comes from the source, so a canonical model cannot render under a "Public" label.
- [x] One component, `apps/pilot/components/crux-reader.tsx` (CSS module), following the four questions with SAYS / SHOWS / HAPPENED / UNKNOWN in every audience view. The affected-person view puts the case first.
- [x] Home, `/author` read mode and `/live` public / affected tabs all use it (UI code: 929 lines removed, 743 added, including the new Reader).
- [x] Fixed on the way: a selected AI use missing from a projection was replaced by a *different* use's public account; it now says "not included". `/live` showed raw values and took the first claim regardless of use. A model marked "not applicable" was reported as unknown.
- [x] Tests: view-model tests across all four examples (disclosure safety, scoping, labels, drafts, the selection regression) and server-render tests. A Vitest config compiles JSX (no new dependencies).

### Phase 2 — Every journey ends in the Reader

- [ ] After discovery confirmation, open the Reader on the in-memory draft (no persistence required).
- [ ] "Download portable record" becomes a secondary action, not the only way out.
- [x] Guided authoring "See how this reads" uses the same Reader (done in Phase 1).

### Phase 3 — Information architecture and copy (plan first)

- [ ] Single front door on `/`: one example and one call to action, "Describe your own AI use".
- [ ] Move `/live`, `/test`, `/discover/runtime` under a "Lab" link.
- [ ] Remove stacked duplicate headlines on `/discover`.
- [ ] One power-ladder component used by discovery, authoring and the Reader.
- [ ] Copy pass: remove developer language from user-facing text ("first regression", "bounded hosted probe", "model identifier unknown", "review before effect", system-version refs).
- [ ] Authoring: one question per step; progressive detail stays hidden until consequence or agency requires it.

### Phase 4 — Visual system (plan first)

- [ ] Replace per-component minified style strings with one stylesheet or CSS modules; resolve colliding global class names (`.card`, `.step`, `.field`, `.boundary`, `.flow`, `.mark`, `.arrow`).
- [ ] Remove CSS left unused after Phases 0–1: `globals.css` reading-view rules (e.g. `.question-strip`, `.teaching-card`, `.claim`, `.story-*`, `.reasoning-*`, `.case-flow`) and `/live`'s orphaned rules (`.public-summary`, `.public-fact`, `.evidence-row`, `.case-step`, `.case-bottom`).
- [ ] Typeface pair via `next/font` (no new dependency) — **typeface choice needed**.
- [ ] Minimum label size of 11px (currently 26 labels at 8–10px).
- [ ] Distinctive marks for SAYS / SHOWS / HAPPENED / UNKNOWN and consistent AI / person / decision / action node styles.
- [x] Promote "AI stops here" from caption to a clear visual boundary (in the Reader; one rule everywhere: an AI step directly followed by a person).
- [ ] Favicon.

## Later / not yet scheduled

- Splitting discovery signals into separate AI uses (replaces the removed button).
- **Decide:** should the Reader show claims that target a decision or action directly (a valid target kind)? Today, as before Phase 1, only claims on the AI use, system or version are shown. No example or authoring path creates such claims yet.
- `apps/pilot/tsconfig.tsbuildinfo` and Playwright's `.playwright-mcp/` output are not git-ignored.

## Decision log

| Date | Decision |
| --- | --- |
| 2026-09-24 | Adopt "one reader, one journey" as the product direction. |
| 2026-09-24 | Remove the non-functional "signals belong to different uses" button rather than fake it. |
| 2026-09-24 | Case records remain limited to consequential uses (matches the mental model's proportionality principle). |
| 2026-09-25 | Public and affected-person Reader models are built only from `redactBundle` projections; runtime activity exists only on internal models, by construction. |
| 2026-09-25 | "AI stops here" is drawn only where an AI step is directly followed by a person step (a decision step may itself be rule- or AI-made). |
| 2026-09-25 | New UI styles use CSS modules (built into Next); the pattern for Phase 4. |
