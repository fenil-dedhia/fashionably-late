# Fashionably Late — Product Requirements Document

**Version:** 1.0 (Free v1)
**Status:** Shipped — Chrome live on the Web Store; Firefox in AMO submission.
**Document Type:** Product Requirements Document
**Scope:** This document describes **Free v1**, the only product this repository builds: an extension-only Gmail enhancement with no backend, no OAuth, and no Google API calls, running entirely on-device. It targets Chrome (and Chromium browsers) and Firefox from a single source tree.

---

## 1. Executive Summary

Fashionably Late is a browser extension for Gmail that enhances the native "Schedule Send" feature with timezone-aware send-time recommendations. It helps users maximize email visibility by suggesting optimal delivery times in the recipient's local timezone, and prompts users when they attempt to send an email immediately while outside their own working hours.

The extension extends Gmail's existing UX rather than replacing it. When installed, the native "Schedule send" menu item is rebranded to "Schedule Send (powered by Fashionably Late)" and the modal that appears is enriched with new options, while preserving Gmail's familiar interaction patterns and its native scheduled-emails view.

Fashionably Late is privacy-first and local-first by design. All recipient-timezone detection, scheduling UI, working-hours logic, and storage run in the browser. There is no backend, no account, and no Google API dependency — recipient timezones come from a local cache or are entered by the user, and recipient identity is read from the compose window's DOM.

---

## 2. Goals and Non-Goals

### 2.1 Goals

1. Increase email open and reply rates by recommending optimal send times in the recipient's local timezone.
2. Reduce after-hours email sending that can hurt the sender's professional perception.
3. Provide a frictionless, native-feeling extension of Gmail's existing Schedule Send.
4. Maintain strong privacy through data minimization and local-first storage.

### 2.2 Non-Goals (Explicitly Out of Scope)

See Section 11 for the complete "Do Not Build" list — features deliberately excluded to prevent scope creep.

---

## 3. Target Users

**Primary persona:** Knowledge workers, salespeople, recruiters, executives, and consultants who use Gmail as their primary email client, communicate across time zones, care about how their email cadence is perceived, and send a moderate-to-high volume of outbound emails per day.

**Secondary persona:** Individual contributors and freelancers who work non-standard hours and want their emails to land during recipients' working hours regardless of when they were drafted.

---

## 4. Key Concepts and Definitions

- **Optimized Send Time:** One of two pre-defined time slots — Morning peak (9:00 AM) or Midday engagement (1:00 PM) — in the recipient's local timezone, based on open-rate and engagement research.
- **Recipient Timezone:** The timezone associated with a specific email recipient, set manually by the user when first needed and cached locally for reuse.
- **Working Hours:** User-defined working days and per-day start/end times during which the user is comfortable sending emails, configured during onboarding.
- **Working-Hours Warning:** A soft-warning modal that appears when the user attempts to send an email immediately (regular Send) while outside their configured working hours, offering to reschedule delivery to the next working window.

---

## 5. Functional Requirements

### 5.1 First-Time User Onboarding

#### 5.1.1 Purpose

Collect the user's timezone, working hours, and explicit consent. Communicate transparently why each piece of data is requested, how it is stored, and what value the user receives in return.

#### 5.1.2 Trigger

The onboarding flow opens automatically on install, and again on browser startup if it was never completed. It also opens when the user opens Gmail without having completed onboarding, and can be opened on demand from the Settings panel (§5.7). A completed-onboarding check guards every trigger, so an onboarded user is never re-prompted.

#### 5.1.3 Steps

A three-step flow.

**Step 1: Welcome, transparency, and consent.**
- Title: "Welcome to Fashionably Late".
- Brief explanation: "Fashionably Late helps your emails land at the right moment, in your recipients' time, not yours. We'll need your timezone and working hours to make that happen."
- A required consent checkbox whose label reads exactly: **"I agree to the Privacy Policy and Terms of Service, and understand how Fashionably Late uses my data."** — where "Privacy Policy" and "Terms of Service" are inline links (to `PRIVACY_POLICY_URL` / `TERMS_OF_SERVICE_URL`) opening in new tabs, with a helper line below surfacing both as "Read the …" links.
- A "Get Started" button that is **disabled until the consent checkbox is checked**. This is the consent gate: the flow cannot advance — and therefore onboarding cannot complete — without explicit consent.

> **Your data, your control:**
> - This information stays on your device, we don't have servers.
> - We never share your data with third parties.
> - You can edit, export, or delete everything in Settings at any time.
>
> **What you get in return:**
> - Send emails at the right moment for each recipient, learned once and remembered.
> - Avoid sending after-hours emails that hurt your professional brand.
> - Your data stays on your device, no account, no tracking.

**Step 2: Set up your timezones.**
- The extension pre-fills the user's own timezone from the **browser** (`Intl.DateTimeFormat().resolvedOptions().timeZone`), labelled "Detected from your browser". The user can confirm or override it (an override is recorded as source `manual`). The browser timezone is the source because it reflects the OS timezone, which auto-updates as the user travels — the current working context the extension schedules against. The user's own timezone is the visually primary block.
- **Pinned Timezones:** the user picks up to **5** timezones to surface first in every timezone picker (a "Pinned" section above "All timezones"). Onboarding pre-selects 5 defaults (PST/EST/GMT/CET/IST → `America/Los_Angeles`, `America/New_York`, `Europe/London`, `Europe/Berlin`, `Asia/Kolkata`), shown as removable chips with an add-picker. The 5-pin cap is enforced in the UI; at the cap the message reads "Maximum 5 pinned timezones. Remove one to add another, or remove all." Pinned timezones are stored as canonical IANA ids on the local state.
- **Back reverts edits:** a step's settings commit only on **Continue**; **Back** restores the step's on-entry state, so accidentally clearing the pre-selected pins then going Back does not lose them. (A hard refresh resumes from the persisted draft per §5.1.4.)
- **Migration discipline:** existing/upgraded users are NOT silently pinned — the defaults pre-check only in the onboarding draft; committed state defaults to empty; pinning is always an explicit act.
- Copy for the own-timezone block: "This is the timezone we'll use when you don't specify one explicitly. You can change it any time in Settings."

**Step 3: Working hours.**
- The extension presents an interface for configuring working days and per-day start/end times.
- Default values: Monday through Friday, 9:00 AM to 5:00 PM.
- The user can toggle individual days on or off and customize times per day. Per-day working hours are the single send-time window the product reasons about (see §5.5).
- A "Finish Setup" button completes onboarding. On completion the user is returned to their nearest open Gmail tab (the onboarding tab simply closes if no Gmail tab is open).

#### 5.1.4 Acceptance Criteria

- The user cannot complete onboarding without explicit consent. Enforced at Step 1: the "Get Started" button is disabled until the consent checkbox is checked.
- All collected data is stored in the browser's local extension storage, not transmitted to any server.
- Onboarding can be resumed mid-flow if interrupted.
- After onboarding, the user lands in Gmail with the extension fully active; the success screen's "Return to Gmail" action focuses the nearest open Gmail tab. An already-open Gmail tab activates the integrations immediately, with no refresh.

---

### 5.2 Compose Window Integration

#### 5.2.1 Visual Changes

When the user opens a Gmail compose window with Fashionably Late installed:

1. The native "Send" button's dropdown caret continues to function, but the label inside the dropdown menu changes from "Schedule send" to "Schedule Send (powered by Fashionably Late)" (implemented as `SCHEDULE_SEND_LABEL` in `extension/src/lib/constants.ts`). This is the single branded surface in compose (§8.1).
2. No other visual changes are made to the compose window itself.

#### 5.2.2 Click Behavior

When the user clicks "Schedule Send (powered by Fashionably Late)", the Fashionably Late-enhanced modal appears (Section 5.3) instead of Gmail's native scheduling modal.

#### 5.2.3 Fallback Behavior

If the extension fails to load or encounters an error, Gmail's native Schedule Send must continue to function normally. The extension must never block or interfere with native Gmail functionality. With two or more compose windows open, the extension hands off to Gmail's native scheduler rather than risk mis-targeting.

---

### 5.3 Enhanced Schedule Send Modal

The modal renders in a Shadow DOM and preserves the visual style and dimensions of Gmail's native scheduling modal while adding the enhancements below.

**No-recipient guard.** The modal's primary **Schedule** action is hard-disabled (greyed + keyboard-inert, with a short red hint) when the compose has **zero tokenized To/CC recipients at the moment the modal opens** — checked once via the `readComposeRecipients()` snapshot. In this state the exit button reads **"Go back"**; the user adds a recipient and reopens. This prevents handing a recipient-less send to Gmail, whose native "specify at least one recipient" error would otherwise render behind the top-of-stack modal.

**Dismiss-on-hand-off-failure.** On a successful schedule the modal closes seamlessly (no native-menu flash). If the Gmail hand-off fails or stalls, the modal and backdrop are torn down promptly so Gmail's own surface is visible rather than occluded (fail-toward-native, §5.2.3).

#### 5.3.1 Header

- Title: "When do you want to send this email?"
- A subtitle below the title displays the user's currently applied timezone: "Times shown in [Timezone Abbreviation] ([City/Region])." For example, "Times shown in EDT (New York)."

#### 5.3.2 Quick Options

Preset options matching Gmail's native pattern:
- When the user has scheduled at least once via Fashionably Late, a **"Last scheduled time"** row appears at the top (mirroring Gmail's own dialog; PRD §8.1 native feel). The time is the one Fashionably Late itself last scheduled, stored locally (§7.2 `lastScheduled`).
- Tomorrow morning (8:00 AM, user's timezone)
- Tomorrow afternoon (1:00 PM, user's timezone)
- Next Monday morning (8:00 AM, user's timezone)

These dates and times update dynamically based on the current day of the week.

#### 5.3.3 Pick Custom

A standard date and time picker for custom scheduling, labelled "Pick custom". Selected time is always in the user's timezone, clearly labeled (with the timezone abbreviation retained).

**Interaction model — select-then-confirm.** Choosing a Quick Option, the "Last scheduled time" row, or entering a custom date+time only *selects* it (visually highlighted; modal stays open). Nothing is scheduled until the user clicks the single primary **"Schedule"** button, which is disabled until a choice is made and which both schedules and closes the modal.

#### 5.3.4 Optimize Section

Inside the enhanced modal, below the standard options, an **"Optimize delivery for [recipient dropdown]"** section lets the user target a specific recipient's local timezone. Items (a)–(m) are the authoritative specification.

**(a) Section presence and initial state.** The section is visible whenever a compose has at least one To/CC recipient. The leading checkbox starts **unchecked** on modal open — Optimize-for-X is opt-in per send.

**(b) Recipient dropdown — population from compose DOM.** Auto-populated from the Gmail compose **To: and CC:** fields. **BCC is excluded** (preserves the BCC privacy contract; §11). No autocomplete enrichment beyond what Gmail already rendered into the compose chips.

**(c) Per-entry labelling.** Each entry shows the recipient's display name (or email when never-emailed, per (e)). The To-vs-CC field of origin is read and carried internally (load-bearing for the BCC-exclusion contract in (b)) but is not rendered.

**(d) Default selection.**
- **Single recipient across To+CC:** that recipient is pre-selected; the Optimize checkbox still starts unchecked (engagement is explicit).
- **Multiple recipients:** the dropdown shows the placeholder **"Choose recipient…"**; the modal's Schedule button stays disabled until the user explicitly selects one recipient to optimize for.

**(e) Display names.** Display names come from Gmail's compose DOM (whatever Gmail's own autocomplete rendered into the chip). Recipients with Gmail history: name appears. Never-emailed recipients: only the email appears. There is **no fallback name resolution** of any kind.

**(f) Timing dropdown — two options.** Labelled **"Optimize timing for"**, with exactly two options:
- **"Morning peak (9:00 AM their time)"** — default.
- **"Midday engagement (1:00 PM their time)"**.

**(g) Timing tooltip.** A small info icon opens the tooltip: *"Morning typically sees the highest open rate. Midday catches recipients between meetings."*

**(h) Timezone resolution — Case A (recipient already in cache).** A confirmation line appears dynamically: *"We'll send this at 9:00 AM in PDT (Los Angeles). That's 12:00 PM your time."* The user reviews → clicks **Schedule** → the native Gmail Schedule Send mechanism fires at the resolved time.

**(i) Timezone resolution — Case B (cache miss → inline timezone picker).** When the user checks the Optimize checkbox and the recipient is not in the cache, an inline timezone picker appears within the Optimize section:
- Picker text: *"What timezone is [Sarah Chen / email] in?"* (name where available per (e); else email.)
- Timezone dropdown placeholder: **"Choose their timezone"**.
- **Default selection: none** (placeholder only — explicitly not pre-selected to the user's own timezone, because the feature exists for cross-timezone optimization and a same-timezone default would let users click through with a meaningless optimization).
- The Schedule button stays disabled until a timezone is explicitly selected.
- When the user picks a timezone, the (h) confirmation line updates in real time showing both recipient time and user time.
- A **"Remember for future emails to [name/email]"** checkbox sits directly below the timezone dropdown, **default checked** — cache persistence is the normal path.

**(j) Cache TTL for manual selections — indefinite.** Manual timezone selections are explicit user-entered data and do not expire. They persist until the user clears them via the Settings panel (§5.7.2 "Recipient Timezone Cache").

**(k) Shared timezone picker component (binding architectural constraint).** The timezone dropdown used in this inline picker (item i) **must be the same component implementation** used by onboarding (§5.1.3, Step 2) — to prevent silent drift between the two pickers. The shared component is a **searchable combobox over a curated timezone dataset** (`src/lib/timezone/curated-timezones.ts`), not a raw IANA list. It shows friendly offset-labelled groups (e.g. "(UTC+5:30) India, Sri Lanka — Mumbai, Delhi, Bengaluru, Colombo (IST)"), matches a typed city/country/abbreviation/legacy-IANA-name/offset, and emits a canonical IANA id on selection. All-caps queries match abbreviations case-sensitively ("IST" → India/Israel, not "Istanbul"). It renders the user's **Pinned Timezones** in a "Pinned" section above "All timezones".

**(l) No "I don't know" hint or fallback heuristic.** If the user doesn't know the recipient's timezone, the correct behaviour is to not use Optimize-for-X for this send — uncheck the Optimize checkbox and use Quick Options instead. The product does not engineer a workaround that would pollute the cache with low-quality data.

**(m) Multi-recipient unselected state.** When multiple recipients exist in To+CC and none is selected, the section shows the "Choose recipient…" placeholder and the checkbox is unchecked; if the user checks the checkbox without selecting a recipient, Schedule stays disabled. The timing sub-panel (timing dropdown + tooltip + cache-miss picker + confirmation line) is **gated on a selected recipient** — it does not appear on checkbox-engage alone, enforcing a clear "who → when" order. Single-recipient composes auto-select (per (d)), so the panel appears immediately on engage in that case.

**Schedule button mechanism.** Clicking Schedule commits the chosen time as a **real, native Gmail scheduled send** via a DOM-automation recipe (`extension/src/lib/schedule/gmail-recipe.ts`; Quick Options ride Gmail's preset rows, custom and Optimize-computed times ride Gmail's "Pick date & time" path). This preserves the native Scheduled label (§5.6) and keeps email content on-device. The Gmail API does not expose programmatic scheduled-send creation (verified in `research/scheduled-send-api-spike.md`), which is why the extension drives Gmail's own UI.

---

### 5.4 Recipient Timezone Detection

#### 5.4.1 Resolution Logic

When a recipient is selected for optimization, the extension resolves their timezone with a two-step cascade — the first to return a valid IANA timezone wins. There are no Google API calls; everything is on-device.

**Step 1: Local cache lookup.** Query local extension storage for a record matching the recipient's email address. If found, use the cached timezone.

**Step 2: Manual selection.** If not cached, present the inline timezone picker described in §5.3.4 (i). Once the user selects a timezone, persist it in the local cache so the prompt does not appear again for this recipient.

The resolver contract is `{ source: "cache" | "manual_needed" }`, purely on-device.

#### 5.4.2 Caching

- Resolved timezones are cached in local extension storage with the schema: `{ email: string, name: string | null, timezone: string (IANA), source: "cache" | "manual", resolvedAt: timestamp }`.
- The user can view, edit, and clear cached recipient timezones in the Settings panel (§5.7).

---

### 5.5 Working Hours Warning

Per-day working hours (§5.1.3) are the single send-time window the product reasons about. A **soft-warning** modal fires **only on regular Send** (§5.5.1) when the current time is outside working hours — an immediate off-hours send is plausibly unintended. The Schedule Send modal (§5.3) raises **no** warning: deliberately scheduling off-hours to land in a recipient's window is exactly what the product is for. Times produced by Optimize-for-X are likewise never warned on (the warning gate is architecturally bypassed for them).

#### 5.5.1 Trigger

The warning appears when the user clicks the regular **"Send"** button (or presses ⌘/Ctrl+Enter) and the current time is outside their configured working hours.

This is enforced by a capture-phase, compose-scoped interceptor that watches the **whole Send gesture** (pointer/mouse events on the Send button *and* the keyboard shortcut) and blocks it only when the working-hours check returns a real violation for the current time. An in-hours Send is never touched (§5.2.3). Every non-violation, ambiguous, or failure path **falls toward sending** (no cached config, calc throw, or modal mount/render throw → the email sends; a 30-second watchdog guarantees the guard can never permanently wedge Send). With two or more composes open, the guard deliberately does not intercept (the multi-compose native-handoff case, §5.2.3).

#### 5.5.2 Modal Content

The modal mirrors the visual style of Gmail's native modals. It names the specific violation in present-tense plain language (e.g. "It's 3:33 AM — past your working hours.") and offers exactly three explicit choices:

- **Primary — "Reschedule to [Next Working Day, Time]":** converts the immediate Send into a native Schedule Send at the snapped time (§5.5.3).
- **Secondary — "Send now anyway":** sends immediately, overriding the warning just this once.
- **Tertiary — "Cancel":** dismisses the warning; the compose is untouched and nothing is sent.

Nothing is ever auto-applied — an explicit choice every time is the point of the pattern. Every time shown carries its timezone abbreviation adjacent (§8.4).

#### 5.5.3 Calculation Logic

The snap target is the **next working window**: the soonest upcoming configured working day (searching the chosen date forward), at that day's working-hours start time. If the chosen day is itself a configured working day and the chosen time is before that day's start, the snap is to the same day at its start. Rule boundaries are inclusive (scheduling exactly at a day's start/end is allowed). Every working-hours snap is strictly in the future. If zero working days are configured, the working-hours window is inactive and the warning never fires.

---

### 5.6 Scheduled Emails View (Native Gmail Integration)

Fashionably Late does **not** build a separate dashboard for scheduled emails. Instead, it leverages Gmail's native "Scheduled" label, which already provides:

- A list view of all scheduled emails.
- The ability to click into a scheduled email to view its content.
- A native "Cancel send" button on each scheduled email.
- The ability to edit a scheduled email and reschedule it.

The native Scheduled label continues to function exactly as it does today; Fashionably Late keeps no local scheduled-message records (Gmail tracks the scheduled email itself) and adds no visual marker to it (reinforcing §8.1 and §11.18).

---

### 5.7 Settings and Preferences Panel

#### 5.7.1 Access

Accessible via three access points, all of which open the extension's options page:
- The Fashionably Late toolbar icon.
- A "Settings" link inside the Schedule Send modal's overflow menu.
- A direct link from the onboarding completion screen.

#### 5.7.2 Sections

Seven sections:

**Profile and Timezone** — the user's own timezone, overridable via the shared `TimezonePicker`.

**Pinned Timezones** — view / add / remove / **reorder** the user's pinned zones (up to 5; §5.1.3 Step 2). Reorder is drag-and-drop + a grip handle, with arrow-key reordering for accessibility. Reuses the shared `PinnedTimezonesEditor` (the same control as onboarding Step 2). Pinned **order is authoritative** and surfaces in that order in every picker; a reorder live-updates an already-open Schedule Send modal.

**Working Hours** — per-day toggle + start/end times + "Reset to defaults" (with confirmation). Edits autosave only when valid.

**Feature Toggles** — exactly two: "Recipient optimized scheduling" (`recipientOptimization` → controls Optimize-section visibility) and "Auto-reschedule prompt outside working hours" (`autoRescheduleOnOutsideHours` → controls the §5.5.1 regular-Send guard). Both are wired to their consumers.

**Recipient Timezone Cache** — a searchable list of recipients whose timezones have been cached; per-row edit (preserves `resolvedAt`) and delete; bulk "Clear all" (with confirmation); a friendly empty state. The only `source` in Free v1 is `manual`.

**Privacy and Data** — **Export My Data** downloads all locally stored data as an on-device JSON file. **Delete My Data** requires typing "delete" to confirm, then irreversibly wipes all stored keys and shows a terminal screen. Both actions are local-only (no backend, no revoke language). Links to the Privacy Policy and Terms of Service.

**About** — extension version (from the live manifest), a "Built by" link, and a support contact.

---

## 6. Non-Functional Requirements

### 6.1 Privacy Compliance

#### 6.1.1 Principles

- **Data minimization:** Collect only what is necessary to power a feature. No behavioral analytics, no email content scraping, no recipient profiling.
- **Local-first storage:** All user preferences, working hours, timezone, recipient cache, and feature toggles are stored in the browser's local extension storage. Nothing is transmitted to any server — there is no Fashionably Late backend.
- **Explicit consent:** Users must check a consent box during onboarding before any data is collected.
- **Right to access:** Users can export all their data as a JSON file from the Settings panel.
- **Right to erasure:** Users can delete all their local data from the Settings panel. The action is irreversible and is confirmed before it runs.
- **No third-party data sharing:** No analytics services, no advertising trackers, no third-party CDNs that could leak data.
- **Privacy Policy and Terms of Service:** Both documents are linked at install time, during onboarding, and in the Settings panel. Both are written in plain language.

#### 6.1.2 Lawful Basis for Processing

- Local data: legitimate interest (the user installed the extension to receive its features). No personal data leaves the device.

### 6.2 Performance

- The extension must not increase Gmail's initial load time by more than 200 milliseconds (measured at the 95th percentile).
- The Schedule Send modal logic should only do work when the user opens a compose window / the scheduling flow.
- The Settings panel must render within 100 milliseconds of being opened.

### 6.3 Accessibility

- All UI components comply with WCAG 2.1 Level AA.
- All interactive elements are keyboard navigable.
- All form fields have associated labels.
- Color contrast ratios meet WCAG AA thresholds.
- Screen reader support: all custom UI components include appropriate ARIA roles, labels, and live regions where applicable.
- Focus indicators are clearly visible.

### 6.4 Browser Compatibility

- Primary target: Google Chrome (latest stable and one version prior).
- Secondary targets: Microsoft Edge and Brave (both Chromium-based, work without modification).
- **Firefox is supported** via addons.mozilla.org, built from the same single source tree as Chrome with a Firefox-specific manifest (the divergence is four manifest deltas; the app source is shared).
- Safari is not supported.

### 6.5 Security

- The extension uses Manifest V3.
- The extension requests a minimal permission surface: `storage` and `scripting`, with host access to `https://mail.google.com/*` only. No identity, tabs, or broad host permissions.
- No remote code is ever loaded or injected; all executed code is bundled in the package.
- Content Security Policy restricts inline scripts and external resource loads.
- No secrets (API keys, tokens) exist in the product — there is no backend and no OAuth.

### 6.6 Graceful Degradation

- If a recipient's timezone is unknown, the flow falls back to manual selection (and the user can simply not use Optimize-for-X for that send).
- On any failure in the scheduling or Send-guard paths, the extension fails toward Gmail's native behaviour (native Schedule Send, or letting the Send proceed) — see §5.2.3 / §5.5.1.
- The extension must never block, break, or visually disrupt native Gmail functionality.

---

## 7. Technical Architecture

The extension is local-first by design — all recipient-timezone detection, scheduling UI, working-hours logic, and storage run in the browser.

### 7.1 Client-Side Components

1. **Service worker:** owns onboarding launch and the on-device recipient-timezone resolver (cache → manual). On install it injects the content script into already-open Gmail tabs (MV3 static `content_scripts` only fire on later loads). No OAuth, no Google API.
2. **Content script:** injected into the Gmail tab. Detects compose windows, relabels the Schedule Send menu item, renders the Fashionably Late modal (in a Shadow DOM), reads compose recipients, and runs the §5.5.1 regular-Send guard.
3. **Settings page:** a standalone page reached via the extension's options page.
4. **Onboarding page:** a standalone page shown on first install.

### 7.2 Local Storage Schema

All local data is stored in the browser's extension storage, tagged with a `schemaVersion` (currently **4**; `SCHEMA_VERSION` in `extension/src/lib/constants.ts`). Shape (once consent exists; the `consent` object is `null` until onboarding completes):

```
{
  "schemaVersion": 4,
  "user": {
    "email": "string (unused in Free v1 — no identity; kept for schema stability)",
    "timezone": "string (IANA)",
    "timezoneSource": "browser | manual",
    "onboardingCompletedAt": "timestamp"
  },
  "workingHours": {
    "monday": { "enabled": true, "start": "09:00", "end": "17:00" },
    "tuesday": { ... },
    ...
  },
  "pinnedTimezones": ["string (IANA)"],
  "lastScheduled": "{ display, gmailDate, gmailTime } | null",
  "featureToggles": {
    "recipientOptimization": true,
    "autoRescheduleOnOutsideHours": true,
    // The three below are inert (kept for schema stability, not wired):
    "unscheduleOnReply": true,
    "scheduleConfirmationToast": true,
    "alwaysScheduleOutsideHours": false
  },
  "recipientCache": [
    {
      "email": "string",
      "name": "string | null",
      "timezone": "string (IANA)",
      "source": "cache | manual",
      "resolvedAt": "timestamp"
    }
  ],
  "consent": {
    "privacyPolicyVersion": "string (covers both Privacy Policy and Terms of Service)",
    "consentedAt": "timestamp"
  }
}
```

Migrations are handled in `getState()`: additive fields resolve via default-merge; the v3→v4 bump removed the obsolete `absoluteEarliest`/`absoluteLatest` working-hours keys and writes the cleaned record back. `lastScheduled` stores only pre-formatted time strings — never email content. The implemented state type is named `OutboxIQState` (a frozen internal identifier, deliberately not renamed with the brand).

### 7.3 Third-Party API Dependencies

**None.** Free v1 makes no third-party API calls. The extension drives Gmail's native UI directly via the DOM; it does not use the Gmail API, Calendar API, People API, or any Google API, and has no backend or Pub/Sub. Recipient timezones come from the local cache or manual user entry, and recipient identity is read from the compose window's DOM.

---

## 8. UX Principles and Design Guidelines

### 8.1 Native Feel Over Branded Feel

Fashionably Late should look like a natural extension of Gmail, not a third-party plugin. Use Gmail's design language, system fonts, and color palette. The only place Fashionably Late branding appears prominently is in the Settings panel and the onboarding flow. Inside the compose window and the Schedule Send modal, the visual treatment matches Gmail's native components as closely as possible.

### 8.2 Progressive Disclosure

Show the minimum interface needed for the task at hand. Advanced options (recipient timezone override, custom timing) appear only when relevant. The Schedule Send modal opens with quick presets visible and the optimization controls revealed progressively (the timing sub-panel appears only after a recipient is chosen).

### 8.3 Sensible Defaults, Easy Overrides

Pre-select the most likely choice (the single recipient in the To field, 9:00 AM morning peak, the user's detected timezone), but make every default a single click away from being changed.

### 8.4 Always Show Timezone

Anywhere a time is displayed, the timezone must appear immediately adjacent. No exceptions. This includes the Schedule Send modal header, the recipient optimization line, and the working-hours warning.

### 8.5 Explain the Why

Whenever the extension asks for data or makes a recommendation, a one-line explanation accompanies it. This builds trust. Examples: "We use this to send emails in your timezone by default."

### 8.6 Reversibility

Every action has an undo or cancel path. Scheduled emails can be canceled or edited via Gmail's native UI (and Gmail's own native scheduled-send toast provides the immediate undo affordance). Destructive actions in Settings (clear cache, delete data) require explicit confirmation.

### 8.7 Minimal Cognitive Load

One decision at a time. The onboarding flow breaks setup into separate steps rather than presenting one overwhelming form. The Schedule Send modal does not pile recipient selection, timing, and timezone into a single overwhelming view; each concern is presented clearly.

### 8.8 Trust Signals

Privacy commitments are visible, not buried. The onboarding flow presents the privacy rationale immediately above the consent gate (§5.1.3). The Settings panel has a Privacy and Data section, not a single fine-print link. A "Your data stays on your device" line appears near data inputs where appropriate.

### 8.9 Keyboard Accessibility

All interactive elements are keyboard reachable. The Schedule Send modal supports Tab for navigation, Enter to confirm, and Escape to cancel.

### 8.10 Empty States with Personality

First-time users see a friendly walkthrough, not a blank screen. The recipient timezone cache view, when empty, displays helpful copy like "No recipient timezones cached yet. They'll appear here as you optimize emails for specific recipients."

---

## 9. Success Metrics

Success metrics for v1 are tracked **qualitatively** through user feedback from the developer and a small set of test users. **No telemetry is collected.** The targets below are aspirational benchmarks for what a successful v1 looks like — they are not measured by instrumented analytics.

- **Activation rate:** Percentage of installs that complete onboarding within 7 days. Target: 70 percent or higher.
- **Feature adoption:** Percentage of activated users who schedule at least one email per week. Target: 50 percent or higher.
- **Optimization usage:** Percentage of scheduled emails that use the recipient-optimized scheduling feature (vs. just preset times). Target: 30 percent or higher.
- **Working-hours acceptance:** Percentage of users who accept the reschedule prompt (vs. send anyway) when triggered. Target: 60 percent or higher.
- **Retention:** Percentage of installs still active after 30 days. Target: 40 percent or higher.

---

## 10. Open Questions for Future Versions

These are intentionally deferred and should not be addressed in v1:

1. Should the two time slots become user-configurable in a later version?
2. Should holiday awareness be added later by reading from the user's calendar?
3. Should the extension extend to other email clients (Outlook, Apple Mail) as a cross-client product?

---

## 11. Out of Scope: Do Not Build (v1)

The following features and behaviors must **not** be implemented. This list exists to prevent scope creep and to ensure downstream tools do not infer or add unrequested functionality.

1. **Manual delivery approval** workflows where the user must approve each scheduled email before send.
2. **Email tracking, read receipts, or pixel-based open detection.** Fashionably Late does not track whether recipients have opened emails.
3. **Cross-user recipient behavior analytics** or any form of engagement scoring built from aggregated user data.
4. **AI-generated email content, subject line suggestions, tone analysis, or message rewriting** of any kind.
5. **CRM integrations** (Salesforce, HubSpot, Pipedrive, etc.).
6. **Mass email, newsletter, or campaign features.** Fashionably Late is for one-to-few personal and professional emails, not bulk outreach.
7. **Email templates or snippet management.**
8. **A/B testing of send times.**
9. **Cross-account simultaneous orchestration.** Each Gmail account is treated independently. No multi-account dashboards or unified inboxes.
10. **White-labeling or custom branding** for end users or third parties.
11. **Mobile app companion.** The extension is desktop-only. No iOS or Android app.
12. **Custom domains or custom SMTP support.** Gmail accounts only.
13. **Analytics dashboards** showing open rates, click rates, engagement metrics, or recipient profiles.
14. **Reading email body content** beyond what is required for compose-window injection. The extension must not parse, store, or transmit email body text.
15. **Notification preferences panel** with granular per-event notification toggles.
16. **Multi-account support** within a single browser profile. Users who want Fashionably Late on multiple Gmail accounts can use separate browser profiles.
17. **Holiday awareness** that detects public holidays or out-of-office events on the target send date.
18. **Separate scheduled emails dashboard.** Use Gmail's native Scheduled label, do not build a parallel view.
19. **Safari or other non-Chromium browser support.** (Chrome/Chromium and Firefox are supported; Safari and other engines are not.)
20. **Behavioral analytics, usage telemetry, or any data collection.**

---

## 12. Glossary

- **Compose window:** The Gmail interface for drafting a new email.
- **IANA timezone:** Standard timezone identifier (e.g., `America/New_York`, `Europe/Berlin`).
- **Service worker:** A background script that runs independently of any visible Gmail tab, used for long-lived tasks in a Manifest V3 extension.
