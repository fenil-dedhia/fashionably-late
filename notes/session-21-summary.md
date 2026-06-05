# Session 21 — Web Store go-live CTAs + Firefox/AMO port (scope amendment)

> Two distinct workstreams. (1) Landing-page CTA go-live now that Chrome is LIVE
> on the Web Store. (2) A **scope amendment** + build work: Firefox was lifted off
> the §11 "Do Not Build" list and a single-source Firefox/AMO build target was
> added. Extension **source code unchanged** (no `extension/src/` edits); test
> count **376**, `SCHEMA_VERSION` **4**, version **1.0.0** all unchanged. The
> Firefox port reuses the same build verbatim and only rewrites the manifest.

## §a — Chrome went live; landing-page CTAs swapped

Chrome extension published: `jlbgbihbkikcbcndpkccijbmmlhljcol`. Landing page
(`docs/index.html`) updated:
- Hero + footer CTAs: the pending "Coming soon to the Chrome Web Store" `<span>`s
  → live `<a>` links to the Web Store listing (new tab). Removed the dead
  `.fl-btn-pending` CSS + footer override.
- README **Status** now "live on the Chrome Web Store" with an install link.
- CTA styling: "Get it for Chrome" made the **white (ghost)** button so it stands
  out from the dark-teal "View source on GitHub" (restores the light/dark pair);
  buttons stay side by side. Footer swapped to match.
- Icon: clock glyph → **monochrome Chrome logo** (`currentColor`, same as the
  GitHub mark), scoped to **15px** via `.fl-chrome-mark` (GitHub icon stays 19px).
- Copy: "The right local time" section body — "the one you're writing to" → "the
  one whose timing matters most"; dropped "research-backed".

Commits: `9991535`, `93c219a`, `01456dd`, `b416930`, `49a4984`, `203f328`.

## §b — Firefox/AMO port: the spike, then the greenlight

**Spike (owner-verified live, Firefox + owner's Gmail).** The gating question was
whether Gmail's synthetic-event Schedule-Send recipe (`gmail-recipe.ts`, a
documented single point of failure) drives in Firefox. Produced a throwaway
Firefox-loadable build (transformed copy of the Chrome `dist/`), `web-ext lint`
0 errors. Owner ran the protocol (`research/firefox-spike.md`):
- ✅ Load + onboarding, relabel, enhanced modal, **real scheduled send lands in
  Gmail Scheduled** (the gate), working-hours warning.
- ✅ Step-2 gate: **recipient read** (`compose-recipients.ts`, the *other* SPOF)
  populates from To/CC; **on-install injection** re-attaches without refresh;
  **multi-compose** safety net hands off to native — all identical to Chrome.

Result: **viable**. The app source ran unchanged; only the manifest/packaging
differ. The entire divergence is **four manifest deltas**.

## §c — Scope amendment (doc work first, authorizing the build)

Firefox was a locked PRD item (§11.19 + §6.4, framed permanent). Lifted with
Entry-4 discipline (originals preserved, amendments appended):
- **owner-decisions-log Entry 62** — records: reversal of a "permanent" lock; why
  justified now (§6.4's sole reason "different extension APIs" measured small +
  known); honest proof scope (one build / owner account / owner machine / this
  Gmail revision — Entry-17 standard); the architecture decision (single source +
  Firefox build target) and the **rejected counterfactual** (duplicating
  `extension/` — rejected because it forks the now-shared SPOF).
- **PRD §6.4 + §11.19** amended: Firefox **only** lifted; **Safari + other
  non-Chromium stay out of scope.**

Commit: `c002b63`.

## §d — The single-source Firefox build target

`extension/scripts/build-firefox.mjs` + npm scripts `build:firefox` (→
`dist-firefox/`) and `package:firefox` (→
`release/fashionably-late-<version>-firefox.zip`). Design:
- **Transforms the compiled `dist/manifest.json`** (the product of
  `manifest.config.ts`) — NOT a hand-maintained second manifest. Shared fields are
  copied verbatim, so they **cannot drift**; an executable anti-drift assert
  compares every shared field to Chrome's manifest and fails loudly on mismatch.
- The **four deltas, and nothing else**: drop `key`; `background.service_worker`
  → event-page `background.scripts`; add `browser_specific_settings.gecko`
  (id + `strict_min_version` + `data_collection_permissions:{required:["none"]}`);
  strip Chrome-only `use_dynamic_url`.
- Reuses the Chrome packager's fail-loud verification conventions
  (SW-loader sanity, zip-root checks, no junk). **Chrome `dist/` never mutated.**
- **No fork of `gmail-recipe.ts` or any hot path** — a Firefox conditional there
  is a gating decision, not an inline change (Entry 23 discipline).

**Verification:** `web-ext lint --self-hosted` **0 errors** (3 non-blocking
warnings: Android-only min-version, 2× `innerHTML` in `TimezonePicker`). **Chrome
regression green:** build + **376 tests** + `npm run package` all pass; `dist/`
keeps `key` + `service_worker`. eslint/prettier clean (added `dist-firefox` to
both ignore lists).

Commit: `83bcad2`.

## §e — Awaiting owner confirmation (before first AMO upload)

Surfaced, not silently baked (tracked in PRE_LAUNCH_CHECKLIST.md → Firefox/AMO):
- **`gecko.id` = `fashionably-late@fashionablylate.app`** — a NEW permanent AMO
  identifier (analogous to the frozen Chrome `key`, Entry 30). Used in the spike;
  needs explicit sign-off.
- **`strict_min_version` = `140.0`** — derived from shipped keys (binding:
  `data_collection_permissions` needs FF 140; also the spike-verified version).
  Relax to `126.0` only to cover FF 126–139.

## §f — AMO submission punch list (tracked, NOT folded in)

- **2× `innerHTML` warnings in `TimezonePicker`** — AMO human review may flag.
  Almost certainly benign (renders our own curated dataset). `TimezonePicker` is
  **shared** with Chrome (onboarding + Optimize-for-X, Entry 40), so any fix ships
  to Chrome and needs a Chrome regression check — **isolate as its own change.**
- **AMO reproducible-build requirement** — deterministic build + reviewer build
  instructions (mind the CRXJS/Vite 8/Rolldown hashed-chunk toolchain).
- AMO listing mechanics (account, copy/screenshots reusable from Chrome, support
  email, privacy URL, no-data-collection disclosure matching the manifest key).

## §g — Files changed

- `docs/index.html`, `README.md` — Chrome go-live CTAs + copy.
- `Fashionably_Late_PRD.md`, `notes/owner-decisions-log.md` — Firefox scope lift.
- `extension/scripts/build-firefox.mjs` (new), `extension/package.json`,
  `extension/eslint.config.js`, `extension/.gitignore` — build target.
- `PRE_LAUNCH_CHECKLIST.md`, `research/firefox-spike.md` — tracking + spike record.
- No `extension/src/` changes.

## §h — Owner-decisions-log entries this session

**Entry 62** — Firefox/AMO port greenlit; §11.19 + §6.4 Firefox ban lifted.

## §i — What's left for the Firefox port

Owner-parallel + a small isolated code task: (1) confirm `gecko.id` +
`strict_min_version`; (2) the `innerHTML` cleanup as its own Chrome-checked
change; (3) reproducible-build + reviewer instructions; (4) AMO account + listing
+ submission. The build target itself is **done and verified**.
