---
sidebar_position: 5
title: Privacy & Analytics
slug: /privacy
description: What this site measures — cookieless, first-party, no personal data sold or shared.
---

# Privacy & Analytics

This page is live proof of the collector: **this docs site runs it**, reporting
as its own site id. It is also the template to adapt for any site that uses the
collector — the canonical copy lives in
[`docs/privacy-template.md`](https://github.com/your-org/deno-kv-analytics/blob/main/docs/privacy-template.md)
in the repo. It is written for visitors, not for developers: it claims only what
the code actually does, which is what lets a site run it with no consent banner.
If you extend the collector, re-read this and keep the two in step.

## What is measured

Per page view, stored only as running daily counts:

- **Page path** and **referrer host** (e.g. `google.com`) — not the full URL.
- **Browser, OS, device type** — from the server-side User-Agent, no version
  fingerprint.
- **Language** and **timezone** — coarse locale hint instead of IP geolocation.
- **Viewport bucket** (`<640`, `640–1024`, `>1024`) — layout only.
- **Campaign tags** (`utm_source` / `utm_medium` / `utm_campaign`) when present.
- **Outbound-link / download clicks** — destination host or file name.
- **Whether the page saw any interaction**, and how soon after load, as one of
  three coarse buckets. No mouse coordinates, no movement, no event trace — only
  that a real (browser-trusted) interaction happened. It is used to tell humans
  from automation.

Individual visits are never stored as rows, so a single page view cannot be
reconstructed, and no measurement can be joined to another (e.g. path ×
country).

## Visitor & session counting

To count visitors and sessions **without cookies**, your browser keeps a random,
non-personal id in `localStorage`. It never leaves the browser — only a "first
visit today" / "new session" flag is sent, never the id. Clearing browser
storage resets it.

## Opting out

The beacon is a plain image request. Block it with any content blocker, disable
JavaScript for this site, or clear `localStorage` — the site works fully either
way. No consent banner is needed, since nothing personal is stored locally or
server-side.
