# Firefox viability spike — Gmail Schedule-Send recipe

**Question being answered:** Does Fashionably Late's core mechanism — UI-automating
Gmail's native Schedule Send via *synthetic* DOM events (the `gmail-recipe.ts`
single-point-of-failure) — actually drive end-to-end in **Firefox**, the way it was
verified to in Chrome? Everything else about a Firefox port (build target,
architecture, AMO submission) is gated on a YES here.

This is a **throwaway** spike. No committed Chrome source was changed. The test
artifact is a transformed copy of the Chrome `dist/` at `extension/dist-firefox/`
(gitignored).

## How the spike build was produced (reproducible)

1. `npm --prefix extension run build` (normal Chrome build → `dist/`).
2. `cp -r dist dist-firefox`, then transform `dist-firefox/manifest.json`:
   - drop `key` (Chrome-only),
   - `background.service_worker` → `background.scripts: ["service-worker-loader.js"]`
     (Firefox stable uses an event-page background, not an MV3 service worker),
   - add `browser_specific_settings.gecko` (`id`, `strict_min_version: "140.0"`,
     `data_collection_permissions.required: ["none"]`).
3. `web-ext lint --self-hosted` → **0 errors** (loads); warnings are Android-only
   min-version + 2 `innerHTML` notes in the timezone picker (AMO-review items for
   the real port, not blockers, not on the schedule-send path).

The app source is unchanged: it calls `chrome.*`, which Firefox aliases, and uses
promise-style `chrome.storage` (Firefox ≥121 supports promises on `chrome.*`).

## Test protocol (run in Firefox)

### 0. Load
- Firefox → `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**
  → select `extension/dist-firefox/manifest.json`.
- ✅ Expect: onboarding tab opens automatically. Complete it (own timezone, a
  pinned zone or two, working hours).
- If onboarding does NOT open: click **Inspect** on the add-on in about:debugging
  to open the background console; note any errors. (Background-script wiring is the
  first thing that can differ from Chrome.)

### 1. Relabel (§5.2)
- Open `mail.google.com`, click **Compose**, add a real recipient (yourself is
  fine), a subject, and a line of body text.
- Click the **▾** next to the Send button.
- ✅ Expect: the menu item reads **“Schedule send (powered by Fashionably Late)”**.

### 2. Enhanced modal (§5.3)
- Click that item.
- ✅ Expect: **Fashionably Late's** Shadow-DOM modal opens (recipient dropdown +
  Quick Options + Optimize-for-X), NOT Gmail's plain native picker.

### 3. THE CRITICAL STEP — does the send actually schedule?
- In the modal: pick the recipient, pick/confirm a timezone if prompted, choose a
  Quick Option (or the custom "Pick date & time" path), and confirm.
- ✅ Expect: the modal hands off to Gmail and Gmail shows its native
  **“Scheduled”** confirmation; the message appears in Gmail's **Scheduled**
  folder at the expected time.
- ❌ If the message does NOT land in Scheduled (or Gmail's menu/picker ignores the
  click): this is the spike failing. Capture the page console (F12) + background
  console errors and which sub-step stalled. The likely culprit is Gmail rejecting
  synthetic/untrusted events or different selector timing in Firefox.

### 4. Working-hours guard (§5.5.1) — secondary
- Set working hours so "now" is outside them (Settings), compose a new mail, hit
  **regular Send**.
- ✅ Expect: the 3-choice warning modal (Proceed / Snap / Cancel).

## Result — PASS (owner-verified live, 2026-06-04)

- [x] Step 0 load + onboarding: works
- [x] Step 1 relabel: works
- [x] Step 2 enhanced modal: works
- [x] **Step 3 real scheduled send (the gate): WORKS — lands in Gmail Scheduled**
- [x] Step 4 working-hours warning: works

**Verdict:** ☑ **Recipe works in Firefox → proceed to real port.** The synthetic-event
Gmail Schedule-Send automation that was Chrome-verified drives identically in Firefox;
no per-browser variant of `gmail-recipe.ts` needed (at least at this Gmail revision).

Only friction observed: a benign `about:debugging` warning —
`web_accessible_resources.0.use_dynamic_url: An unexpected property` (CRXJS emits the
Chrome-only `use_dynamic_url: false`; Firefox ignores it). Stripped from the spike
manifest; the real Firefox build target must omit `use_dynamic_url`.

### Step-2 second-pillar confirmation (owner-verified live, 2026-06-04, Session 21)
- [x] **(a) Recipient read (`compose-recipients.ts`):** WORKS — Optimize-for-X
  dropdown populated from the compose To/CC chips in Firefox. (Was "assumed" after
  the spike; now hands-on **verified**.)
- [x] **(b) On-install injection:** WORKS — reload with a Gmail tab already open,
  content script re-attached without a manual refresh.
- [x] **Bonus — multi-compose safety net (≥2 composes → native handoff):** WORKS,
  identical to Chrome's designed behaviour.

Both Gmail-DOM single-points-of-failure (`gmail-recipe.ts`, `compose-recipients.ts`)
and the multi-compose guard are now Firefox-verified. Packaging gate cleared.

### Carry-forward items for the real port (not spike blockers)
- Manifest divergences are confined to: drop `key`; `background.service_worker` →
  `background.scripts` (event page); add `browser_specific_settings.gecko`
  (id + `strict_min_version` + `data_collection_permissions: {required:["none"]}`);
  strip `use_dynamic_url` from `web_accessible_resources`.
- 2× `UNSAFE_VAR_ASSIGNMENT` (innerHTML) in `TimezonePicker` — AMO human review may
  ask about these; pre-empt by documenting they're static/sanitized, or refactor.
- AMO requires a reproducible-build source submission for bundled code.
- Decide the build architecture (single source + Firefox target vs. the deferred
  options) before wiring a committed `build:firefox`.
