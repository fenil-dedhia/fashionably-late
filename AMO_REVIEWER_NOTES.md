# Fashionably Late — notes for the addons.mozilla.org (AMO) reviewer

This add-on is built from a bundled, minified source tree, so AMO requires source
plus exact build steps a reviewer can run to reproduce the uploaded package. This
file provides them, plus context on the items an automated scan flags.

The full source is public and Apache-2.0 licensed:
<https://github.com/fenil-dedhia/fashionably-late>. The uploaded Firefox package is
produced from the `extension/` directory of that repo.

## What the extension does (one sentence)

Fashionably Late enhances Gmail's **native** "Schedule send": it relabels the menu
item, opens an enriched scheduling dialog, and suggests send times in the
recipient's local timezone — so email arrives during their working day. It runs
entirely on-device.

## Permissions — why each is needed

- **`storage`** — persist the user's own settings (timezone, working hours, pinned
  timezones, a local recipient-timezone cache) in `chrome.storage.local`. Never
  leaves the device.
- **`scripting`** — so the background event page can inject the content script into
  a Gmail tab that was *already open* at install/update time (the static
  `content_scripts` declaration only fires on subsequent loads). No remote code is
  ever injected; the injected script is the bundled `content-script` asset.
- **Host `https://mail.google.com/*`** (only) — the content script runs inside
  Gmail to enhance its compose/Schedule-Send UI. No other host is requested.

## Data collection — none

`browser_specific_settings.gecko.data_collection_permissions` is declared as
`{ "required": ["none"] }`, and that is accurate:

- **No network requests.** The add-on makes no `fetch`/XHR, has no backend, no
  analytics, no telemetry, no third-party scripts.
- **No Google sign-in, no Gmail API, no OAuth.** Recipient timezones come from a
  local cache or are entered by the user. Recipient *identity* shown in the picker
  is read from the chips Gmail already rendered in the compose window (To/CC only;
  BCC excluded). Message **content** is never read, stored, or transmitted.
- All data is the user's own settings, stored locally, and is exportable/erasable
  from the add-on's Settings → Privacy & data.

## Reproducing the uploaded package

Built and verified with **Node 24.15.0** and **npm 11.12.1** on macOS. Use a
matching Node major (24.x) for an identical result.

```bash
git clone https://github.com/fenil-dedhia/fashionably-late
cd fashionably-late/extension
npm ci                      # exact dependency versions from package-lock.json
npm run package:firefox     # clean build + Firefox manifest deltas + zip
# → release/fashionably-late-<version>-firefox.zip  (this is the uploaded file)
```

`npm run package:firefox` runs `scripts/build-firefox.mjs`, which: (1) does a clean
`npm run build` (TypeScript typecheck + Vite/CRXJS production bundle), (2) copies
`dist/` → `dist-firefox/`, (3) applies the **only** four Firefox-specific manifest
changes versus the Chrome build, and (4) zips the result. The four changes are:

1. remove the Chrome-only top-level `key`;
2. `background.service_worker` → event-page `background.scripts`
   (Firefox MV3 uses an event page, not a service worker);
3. add `browser_specific_settings.gecko` (id, `strict_min_version`,
   `data_collection_permissions`);
4. remove the Chrome-only `use_dynamic_url` from `web_accessible_resources`.

The script asserts that **every other manifest field is byte-identical to the
Chrome build** and fails loudly otherwise, so the Firefox and Chrome manifests
cannot silently diverge.

**Determinism:** two clean builds from the same source + lockfile produce a
byte-identical output tree (content-hashed chunk filenames are stable). Differences
across machines, if any, come only from a different Node/npm version — pin to 24.x.

## Automated-scan items you may see (and why they're benign)

- **`UNSAFE_VAR_ASSIGNMENT` — "Unsafe assignment to innerHTML" (×2), in the
  `TimezonePicker-*.js` chunk.** These are **internal to the bundled React DOM
  library**, not extension-authored code. They are React DOM's own implementation
  details: its `<script>`-element creation helper (`a.innerHTML =
  "<script></script>"`) and its `dangerouslySetInnerHTML` code path (`e.innerHTML =
  r.__html`). The extension's own source contains **no** `innerHTML` or
  `dangerouslySetInnerHTML` and never passes user- or page-controlled data into
  either. (Verifiable: `grep -rn "innerHTML\|dangerouslySetInnerHTML"
  extension/src` returns only `document.body.innerHTML = ""` inside test files,
  which are not shipped.) The large chunk is named after `TimezonePicker` only
  because that React component is its entry point; React + React DOM are bundled
  into it.

- **`KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` (Android min-version note).**
  This is a desktop Gmail product; Firefox for Android is not a target. The
  `strict_min_version` (140.0) is set for desktop.

## Contact

Fenil Dedhia — fenil.h.dedhia@gmail.com. Privacy policy:
<https://fashionablylate.app/legal/privacy>.
