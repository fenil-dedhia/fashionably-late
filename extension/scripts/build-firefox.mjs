// Copyright 2026 Fenil Dedhia
// SPDX-License-Identifier: Apache-2.0
//
// `npm run build:firefox`  → dist-firefox/   (loadable temporary add-on)
// `npm run package:firefox` → release/fashionably-late-<version>-firefox.zip (AMO)
//
// SINGLE SOURCE TREE (owner-decisions-log Entry 62). There is exactly one
// extension source. Chrome builds via CRXJS to dist/. Firefox reuses that SAME
// build verbatim and only rewrites the manifest. We do NOT hand-maintain a
// second manifest and we do NOT fork the source: the Firefox spike proved the
// app code (modal, content scripts, storage, working-hours logic) runs unchanged
// in Firefox (`chrome.*` is aliased; promise-style `chrome.storage` works on
// Firefox ≥121). Only the manifest and packaging differ.
//
// WHY transform the BUILT manifest rather than re-derive from manifest.config.ts:
// dist/manifest.json IS the compiled product of manifest.config.ts, but the build
// also injects wired asset references the source config never contains
// (service-worker-loader.js, the hashed content-script loader, the web-accessible
// chunk names). Reading those back from the build output and copying every shared
// field verbatim is the STRONGEST anti-drift guarantee: shared fields cannot
// differ from Chrome's actual shipped manifest because they are literally the same
// bytes. We apply ONLY the four Firefox deltas on top.
//
// The four deltas (and nothing else):
//   1. drop `key`                         — Chrome-only; Firefox uses gecko.id.
//   2. background.service_worker → scripts — Firefox MV3 uses an event page, not
//                                            an MV3 service worker (Firefox bug
//                                            1573659); reliable from Firefox 121.
//   3. add browser_specific_settings.gecko — id + strict_min_version + the
//                                            no-data-collection declaration.
//   4. strip web_accessible_resources[].use_dynamic_url — Chrome-only key; Firefox
//                                            warns "unexpected property".
//
// Every check fails loudly (non-zero exit). Chrome's own packager
// (package-extension.mjs) and dist/ are never touched by this script.

import { execFileSync, execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Firefox-only config — SURFACED FOR OWNER CONFIRMATION (Entry 62) ──────────
const GECKO = {
  // PROPOSED stable AMO add-on ID. This is a NEW permanent identifier for the
  // Firefox listing, analogous to the frozen Chrome manifest `key` (Entry 30):
  // once the AMO listing exists, changing it orphans the listing + every user's
  // stored add-on identity. Email-like format per MDN
  // (^[A-Za-z0-9-._]*@[A-Za-z0-9-._]+$). CONFIRMED by owner 2026-06-04 (S21).
  id: "fashionably-late@fashionablylate.app",
  // Floor derived from the APIs/keys actually shipped (not guessed):
  //   promise-style chrome.* .............. Firefox 121
  //   event-page background.scripts (MV3) . Firefox 121
  //   options_page manifest key ........... Firefox 126
  //   data_collection_permissions key ..... Firefox 140   ← binding constraint
  // 140 is also the exact version the spike was hands-on verified on. CONFIRMED
  // by owner 2026-06-04 (S21) over the 126.0 broaden-compat alternative.
  strictMinVersion: "140.0",
  // Honest declaration: Fashionably Late collects NO data (matches PRD §11 +
  // the privacy posture). Mandatory for new AMO submissions since 2025-11-03.
  dataCollection: { required: ["none"] },
};

const EXT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = join(EXT_ROOT, "dist");
const FF_DIR = join(EXT_ROOT, "dist-firefox");
const RELEASE_DIR = join(EXT_ROOT, "release");
const ZIP = process.argv.includes("--zip");

const log = (m) => console.log(m);
const fail = (m) => {
  console.error(`\n✗ FIREFOX BUILD FAILED: ${m}\n`);
  process.exit(1);
};
const readManifest = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`could not read/parse ${p}: ${e.message}`);
  }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 1. CLEAN CHROME BUILD (shared) ───────────────────────────────────────────
// Never transform a stale/dev-corrupted dist (CLAUDE.md gotcha). Rebuild fresh;
// `npm run build` also runs tsc as the typecheck gate.
log("→ [1/4] Clean build (rm -rf dist && npm run build)…");
rmSync(DIST_DIR, { recursive: true, force: true });
try {
  execSync("npm run build", { cwd: EXT_ROOT, stdio: "inherit" });
} catch {
  fail("`npm run build` failed (typecheck or bundle error).");
}
const srcManifestPath = join(DIST_DIR, "manifest.json");
if (!existsSync(srcManifestPath))
  fail("build did not produce dist/manifest.json.");

// MV3 entry-basename sanity (CLAUDE.md gotcha): the loader must import the SW
// chunk, NOT the content-script chunk. Firefox runs this loader as its event
// page, so the same invariant is load-bearing here.
const swLoaderPath = join(DIST_DIR, "service-worker-loader.js");
if (!existsSync(swLoaderPath))
  fail(
    "dist/service-worker-loader.js missing — MV3 background entry did not build.",
  );
const swLoader = readFileSync(swLoaderPath, "utf8");
if (!/service-worker/.test(swLoader) || /content-script/.test(swLoader))
  fail(
    "service-worker-loader.js does not import the service-worker chunk (CLAUDE.md gotcha).",
  );

const src = readManifest(srcManifestPath);

// ── 2. STAGE dist/ → dist-firefox/ (work on a copy; dist/ stays Chrome's) ─────
log("→ [2/4] Copying dist/ → dist-firefox/…");
rmSync(FF_DIR, { recursive: true, force: true });
mkdirSync(FF_DIR, { recursive: true });
cpSync(DIST_DIR, FF_DIR, { recursive: true });
try {
  execSync(`find "${FF_DIR}" -name '.DS_Store' -type f -delete`, {
    stdio: "ignore",
  });
} catch {
  /* ignore */
}

// ── 3. APPLY THE FOUR DELTAS (and nothing else) ──────────────────────────────
log("→ [3/4] Rewriting manifest for Firefox (4 deltas)…");
const ff = JSON.parse(JSON.stringify(src)); // deep copy of the Chrome manifest

// (1) drop Chrome-only key
delete ff.key;

// (2) service worker → event page. Derive the loader filename from the source
//     manifest so a CRXJS rename is followed automatically, never hardcoded.
const loader = src.background?.service_worker;
if (!loader)
  fail("source manifest has no background.service_worker to convert.");
ff.background = { scripts: [loader], type: src.background.type ?? "module" };

// (3) gecko block
ff.browser_specific_settings = {
  gecko: {
    id: GECKO.id,
    strict_min_version: GECKO.strictMinVersion,
    data_collection_permissions: GECKO.dataCollection,
  },
};

// (4) strip Chrome-only use_dynamic_url from each web-accessible-resources entry
for (const r of ff.web_accessible_resources ?? []) delete r.use_dynamic_url;

const ffManifestPath = join(FF_DIR, "manifest.json");
writeFileSync(ffManifestPath, JSON.stringify(ff, null, 2) + "\n", "utf8");

// ── 4. (optional) ZIP for AMO ────────────────────────────────────────────────
let zipPath = null;
if (ZIP) {
  const version = ff.version;
  if (!version) fail("manifest has no version — cannot name the zip.");
  mkdirSync(RELEASE_DIR, { recursive: true });
  zipPath = join(RELEASE_DIR, `fashionably-late-${version}-firefox.zip`);
  rmSync(zipPath, { force: true });
  log(
    `→ [4/4] Zipping dist-firefox/ → release/fashionably-late-${version}-firefox.zip…`,
  );
  try {
    execFileSync(
      "zip",
      ["-r", "-X", "-q", zipPath, ".", "-x", "*.DS_Store", "-x", "__MACOSX*"],
      { cwd: FF_DIR, stdio: "inherit" },
    );
  } catch {
    fail("`zip` invocation failed.");
  }
  if (!existsSync(zipPath)) fail("zip was not created.");
} else {
  log("→ [4/4] Skipping zip (pass --zip for an AMO release zip).");
}

// ── VERIFICATION (fail loudly) ───────────────────────────────────────────────
log("\n── Verification ─────────────────────────────────────────────");

// (a) The four deltas applied correctly.
if ("key" in ff) fail("Firefox manifest STILL has a Chrome `key`.");
if (ff.background.service_worker)
  fail("Firefox manifest STILL has background.service_worker.");
if (!eq(ff.background.scripts, [loader]))
  fail(
    `background.scripts is not ["${loader}"] (got ${JSON.stringify(ff.background.scripts)}).`,
  );
if (!ff.browser_specific_settings?.gecko?.id) fail("gecko.id missing.");
if (
  !eq(ff.browser_specific_settings.gecko.data_collection_permissions, {
    required: ["none"],
  })
)
  fail("data_collection_permissions is not { required: ['none'] }.");
for (const r of ff.web_accessible_resources ?? [])
  if ("use_dynamic_url" in r)
    fail("use_dynamic_url still present in web_accessible_resources.");
log(
  "✓ Four deltas applied: no key, event-page background, gecko block, no use_dynamic_url.",
);

// (b) ANTI-DRIFT — every shared field is byte-identical to Chrome's manifest.
//     This is the single-source guarantee made executable.
for (const field of [
  "manifest_version",
  "name",
  "version",
  "description",
  "permissions",
  "host_permissions",
  "content_scripts",
  "icons",
  "action",
  "options_page",
]) {
  if (!eq(ff[field], src[field]))
    fail(`shared field "${field}" drifted from the Chrome manifest.`);
}
// web_accessible_resources may differ ONLY by the stripped use_dynamic_url.
const stripWAR = (m) =>
  (m.web_accessible_resources ?? []).map((r) => {
    const rest = { ...r };
    delete rest.use_dynamic_url;
    return rest;
  });
if (!eq(stripWAR(ff), stripWAR(src)))
  fail(
    "web_accessible_resources drifted from Chrome beyond the use_dynamic_url strip.",
  );
log(
  "✓ Anti-drift: permissions, host, name, version, content_scripts, WAR resources all match Chrome.",
);

// (c) §11 invariant — Firefox build must request the exact same minimal surface.
if (!eq(ff.permissions, ["storage", "scripting"]))
  fail(
    `permissions are not ["storage","scripting"] (got ${JSON.stringify(ff.permissions)}).`,
  );
if (!eq(ff.host_permissions, ["https://mail.google.com/*"]))
  fail(
    `host_permissions are not ["https://mail.google.com/*"] (got ${JSON.stringify(ff.host_permissions)}).`,
  );
log(
  "✓ §11 surface: permissions [storage, scripting], host mail.google.com only — same as Chrome.",
);

// (d) Chrome dist/ untouched (still has its key + service_worker).
const distNow = readManifest(srcManifestPath);
if (!distNow.key || !distNow.background?.service_worker)
  fail("dist/ (Chrome) was mutated — it must keep its key + service_worker.");
log("✓ Chrome dist/ untouched (keeps key + service_worker).");

// (e) zip sanity (when zipped): manifest at root, no junk.
if (ZIP) {
  let entries;
  try {
    entries = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    fail("could not list zip contents with `unzip -Z1`.");
  }
  if (!entries.includes("manifest.json"))
    fail("manifest.json is NOT at the zip root.");
  const bad = entries.find(
    (e) =>
      e === "node_modules" ||
      e.startsWith("node_modules/") ||
      e.endsWith(".pem") ||
      e === "dist" ||
      e.startsWith("dist/") ||
      e.includes("/dist/") ||
      e === ".DS_Store" ||
      e.endsWith("/.DS_Store") ||
      e.startsWith("__MACOSX"),
  );
  if (bad) fail(`zip contains a forbidden entry: ${bad}`);
  log(
    "✓ Zip: manifest.json at root; no node_modules, no .pem, no nested dist/, no macOS junk.",
  );
}

log("\n─────────────────────────────────────────────────────────────");
log(`✓ Firefox build ready: ${ZIP ? zipPath : FF_DIR}`);
log(
  `  gecko.id ${GECKO.id} · strict_min_version ${GECKO.strictMinVersion} · data collection: none`,
);
if (ZIP) log(`  AMO zip: ${(statSync(zipPath).size / 1024).toFixed(1)} KB`);
log("─────────────────────────────────────────────────────────────\n");
