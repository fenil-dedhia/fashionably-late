# Fashionably Late

> **Schedule emails at their perfect time.**

Your emails arrive when your recipients are actually reading — scheduled in Gmail at the right local time for them, never outside your own working hours.

Fashionably late works for parties. It works for email, too. If you work across timezones and keep doing the mental math on when to hit send, this free Chrome extension helps you schedule emails in Gmail at the right local time for your recipient, automatically. It **enhances** Gmail's own **Schedule Send** rather than replacing it — native feel, not a branded rebuild: the "Schedule send" option becomes "Schedule send (powered by Fashionably Late)", the familiar modal gains a few timezone-aware options, and Gmail's own interactions and native **Scheduled** label are preserved. Privacy-first by design.

## What it does

- **The right local time for your recipient.** No more working out what 2 p.m. your time means for someone three zones away. When you schedule an email, Fashionably Late reads the recipients from your compose window, lets you pick the one you're writing to, and offers a research-backed morning or midday slot in *their* local timezone — so your message arrives during their working day instead of getting buried overnight. **Pick someone's timezone once and it's remembered**, so you never re-pick it for the same person.
- **A friendly timezone picker.** A searchable, plain-language timezone selector — find a zone by city, country, abbreviation, or UTC offset — with a **Pinned** section so the handful of zones you work across most often sit right at the top, a single tap away.
- **A working-hours guard that stays out of your way.** Fashionably Late double-checks before a regular Send goes out past the working hours you set — with three clear choices: send anyway, snap to your working hours, or cancel. **Scheduling a message for later is always fine and never warns** — deliberately timing an email for a recipient's window is exactly what the product is for. You stay in control either way.
- **A full settings panel.** Manage your own timezone, pinned timezones, working hours, the locally-cached recipient timezones, and feature toggles — all editable after onboarding.
- **Accessible by design.** Built to WCAG AA standards, with full keyboard support.

## Privacy & data

Fashionably Late is **local by default, private by design.** It runs entirely in your browser, and nothing about your email ever leaves your device. There's no account to create and no inbox to connect.

- **Stored entirely on your device** in the browser (`chrome.storage.local`). There is no Fashionably Late server, account, or backend.
- **No Google sign-in and no Gmail API.** It reads only the recipients in your compose window to suggest good send times — never your message content. Recipient timezones come from a local cache or are entered by you. The only permissions it requests are local storage and access to `mail.google.com` (so it can work inside Gmail).
- **No tracking, no telemetry, no analytics.** It never tracks opens or builds engagement profiles, and collects no usage data.
- **You stay in control of your data.** Edit, export, or delete everything from Settings at any time.

> **A note on the name.** This project was developed under the working name **"OutboxIQ"** before being renamed **"Fashionably Late"** ahead of launch. If you come across "OutboxIQ" in commit history, older notes, or some internal identifiers, it's the same product.

## Status

Fashionably Late (Free) will be listed on the Chrome Web Store very soon.

## Repository layout

- [`extension/`](./extension) — the Chrome extension (Manifest V3). The whole product, running entirely in your browser.
- [`Fashionably_Late_PRD.md`](./Fashionably_Late_PRD.md) — the full product requirements document and source of truth.
- [`notes/`](./notes) — design history and owner decisions log.

This repository is the **Free version** of Fashionably Late — the canonical, open-source, public codebase. A paid Premium tier (with a server-side component) is **out of scope of this project**; if it is ever built, it will be a separate, private project with its own Chrome Web Store listing, not part of this repo.

## Tech stack

TypeScript + React + Vite (with `@crxjs/vite-plugin`), Manifest V3.

## License

Fashionably Late is licensed under the **Apache License, Version 2.0** — see [`LICENSE`](./LICENSE) for the full text and [`NOTICE`](./NOTICE) for the copyright notice. You're free to use, modify, fork, and commercialize the code under the terms of that license.

For commercial inquiries beyond what Apache 2.0 already permits (custom support, indemnification beyond Apache's terms, co-branded distribution, etc.), see [`docs/COMMERCIAL.md`](./docs/COMMERCIAL.md).
