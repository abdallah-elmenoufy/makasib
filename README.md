# Mekasib (مكاسب) — Driver Profit Tracker

Shows ride-hailing drivers their **true profit**, not just gross earnings: after
platform commission, fuel, maintenance, depreciation, expenses, and rental/target
costs. Built for the Egypt/MENA market (multi-platform, cash reconciliation,
dual-fuel CNG+petrol, Arabic RTL).

## Run locally

```bash
npm install
npx prisma migrate dev   # creates data/app.db (SQLite)
npm run dev              # http://localhost:3000
```

First launch asks you to set a passphrase (local auth). Production build:
`npm run build && npm start`.

## How the core model works

- **Vehicle profile** — fuel setup (petrol / CNG / dual), ownership model
  (owned / installment / rented / target-share), which drives the cost engine.
- **Shifts** — start/end odometer + optional dashboard photo + notes. Km inside
  a shift = ride-hailing driving; the odometer gap **between** shifts = personal
  driving. Within a shift, km on trips vs. dead km comes from trip distances.
- **Trips** — manual entry or CSV import (any platform's export via column
  mapping). Each trip auto-matches to the shift whose time window contains it.
  Cash/card and commission tracked per trip (default commission % per platform
  in Settings).
- **Fuel-ups** — liters (80/92/95) or m³ (CNG) with odometer. Consecutive
  full-tank fill-ups give L/100km, km per unit, and fuel cost/km.
- **Maintenance / Expenses / Cash tips** — all odometer-taggable, all with notes.
- **Reminders** — by date and/or odometer, optionally repeating (e.g. oil every
  5,000 km); overdue/due-soon surfaced on the dashboard.
- **Cash reconciliation** — commission you owe platforms on cash trips vs. what
  platforms owe you on card trips, per platform.

True profit = (fares − commission + tips) − fuel·km − maintenance·km −
depreciation·km − work expenses − rental/owner share. Fuel and maintenance are
amortized per-km from all-time totals, so a single expensive week doesn't
distort one shift.

## Stack & roadmap

Next.js 16 (App Router) · Prisma 6 + SQLite (swap `datasource` to Postgres for
cloud phase) · Tailwind 4 · passphrase auth via signed session cookie (swap for
Google/Microsoft OAuth in phase 2) · custom lightweight i18n (en/ar with RTL)
in `lib/i18n/` — all UI strings already translated.

Phases: **1 (this)** local Mac app → **2** hosted web app + OAuth + Postgres
(Supabase) → **3** mobile app (React Native/Expo) reusing the same REST API
under `app/api/`.

## Reset all data

Delete `data/app.db` and `data/uploads/`, then `npx prisma migrate dev`.
