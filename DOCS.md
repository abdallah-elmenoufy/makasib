# Makasib (مكاسب) — Project Documentation

Full technical reference for the codebase: architecture, data model, business
logic, ingestion pipeline, known gaps, and the phased roadmap. The README is
the quick-start; this file is "so no developer (including future-you) has to
re-derive anything from the source."

Working name: **Makasib** ("gains/profits" in Arabic). Not final — alternatives
considered: Rabih (رابح, "the one who profits"), Hesbetak (حسبتك, "your
calculation" — echoes the Egyptian phrase "اعمل حسبتك"), Meshwar (مشوار,
rejected — means "trip," not "profit").

---

## 1. What this is and who it's for

A profitability tracker for ride-hailing drivers (Uber/Careem/inDrive/Bolt),
built first for personal use in Egypt and aimed at the wider MENA market. The
product thesis: **drivers know their gross earnings but not their true
profit** — after fuel, maintenance, depreciation, and dead kilometers, many
are breaking even or losing money without realizing it. The app's entire
value proposition is making that number visible and trustworthy.

Non-goals (deliberately out of scope for now): official Uber API integration
(Uber doesn't grant this to individual drivers — see §5), multi-tenant
hosting, payment processing, anything beyond a single driver/vehicle per
install.

### Phased plan
1. **Phase 1 (current)** — local single-user app, runs on the owner's Mac,
   passphrase auth, SQLite. *Done, in active daily-use UAT.*
2. **Phase 2** — hosted web app: Postgres (Supabase), Google/Microsoft OAuth,
   multi-user. See §9.
3. **Phase 3** — native mobile app (React Native/Expo), sold to drivers in
   Egypt/MENA, Arabic-first. Background GPS, on-device OCR, Android
   notification-based auto trip capture. See §9.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19 | Single codebase for pages + API routes; same API layer will serve the future mobile app |
| Language | TypeScript | Whole stack, incl. Prisma schema → typed client |
| Database | SQLite (Prisma 6 ORM) | Zero-config for phase 1; schema is 100% portable to Postgres (no SQLite-only features used) — see §9 |
| Styling | Tailwind CSS 4 | |
| Auth (phase 1) | Passphrase (bcryptjs) + signed session cookie (jose, HS256 JWT) | No external dependency for a single-user local app |
| i18n | Custom (`lib/i18n/`) | Full English + Arabic dictionaries, RTL support; a library was unnecessary for ~150 keys |
| OCR (screenshots) | tesseract.js (client-side, WASM) | Runs in-browser, no server dependency, works cross-platform |
| OCR (odometer/LCD) | Apple Vision (`tools/vision-ocr.swift`), tesseract fallback | Tesseract cannot read 7-segment dashboard LCDs at all (verified); Vision reads them reliably. **macOS-only** — see §8 |
| PDF parsing | `pdf-parse` (pdfjs-based) | Extracts the Uber weekly statement's text layer |
| HEIC conversion | macOS `sips` (shelled out) | Browsers can't decode iPhone's default photo format; **macOS-only** — see §8 |
| EXIF reading | `exifr` | Pulls the photo-taken timestamp for shift start/end times |

---

## 3. Directory structure

```
app/
├── app/
│   ├── (app)/                 # authenticated section (redirects to /login if not)
│   │   ├── page.tsx           # Dashboard
│   │   ├── plan/              # "Plan your day!" statistics module
│   │   ├── shifts/            # shift start/end (manual + GPS tracker)
│   │   ├── trips/             # trip list + manual entry
│   │   ├── fuel/              # fuel-up log
│   │   ├── maintenance/       # maintenance log
│   │   ├── expenses/          # non-maintenance running costs
│   │   ├── reminders/         # date/km-based service reminders
│   │   ├── vehicle/           # vehicle profile & cost model
│   │   ├── import/            # 4-tab data ingestion (see §6)
│   │   ├── settings/          # locale, passphrase, photo retention
│   │   └── layout.tsx         # auth gate + <Nav>
│   ├── login/                 # passphrase setup/login (outside the auth gate)
│   └── api/                   # all backend routes — see §4
├── components/                # shared client components (Nav, ui.tsx primitives, GpsTracker, PhotoInput, useCrud hook)
├── lib/                       # all business logic — framework-agnostic, mostly pure functions
│   ├── db.ts                  # Prisma client singleton
│   ├── auth.ts                # passphrase hash, session cookie
│   ├── crud.ts                # generic entity config + body coercion (drives /api/[entity])
│   ├── analytics.ts           # the profit-calculation engine
│   ├── depreciation.ts        # auto-depreciation formula
│   ├── planner.ts             # "Plan your day!" statistics
│   ├── uberStatement.ts       # weekly statement PDF parser
│   ├── earningsActivity.ts    # Earnings Activity screenshot OCR parser
│   ├── tripRequest.ts         # trip-request card OCR parser
│   ├── importApply.ts         # dedupe/merge logic shared by all import sources
│   ├── ocr.ts                 # client-side tesseract.js + server Vision helpers
│   ├── purge.ts               # photo retention/cleanup
│   ├── format.ts               # locale-aware number/date/currency formatting
│   └── i18n/                  # messages.ts (en+ar dictionaries), server.ts (cookie-based locale)
├── prisma/
│   ├── schema.prisma
│   └── migrations/            # SQLite-dialect migrations (see §9 before moving to Postgres)
├── tools/
│   └── vision-ocr.swift       # compiled lazily by /api/ocr on first call
├── public/
│   ├── manifest.webmanifest   # PWA — Add to Home Screen
│   └── icon.svg
└── data/                      # gitignored: app.db (SQLite) + uploads/ (photos)
```

---

## 4. API routes (`app/api/`)

All routes (except `/api/auth`, `/api/locale`) require an authenticated
session — enforced by `requireAuth()` from `lib/auth.ts`, which throws a
`Response(401)` caught by each handler.

| Route | Purpose |
|---|---|
| `GET/POST /api/auth` | `{action: "setup"\|"login"\|"change"\|"logout"}` — passphrase flows |
| `POST /api/locale` | Set UI language cookie (no auth — usable from the login screen) |
| `GET/POST /api/[entity]`, `GET/PATCH/DELETE /api/[entity]/[id]` | Generic CRUD over the `ENTITIES` map in `lib/crud.ts` (vehicles, shifts, trips, tips, fuelups, maintenance, expenses, reminders) |
| `GET /api/analytics?vehicleId&period` | Runs `getAnalytics()` — the dashboard's data source |
| `GET /api/plan?vehicleId` | Runs `getPlan()` — the "Plan your day!" data source |
| `POST /api/upload` | Saves a photo to `data/uploads/`; converts HEIC→JPEG via `sips`; triggers the lazy photo-purge check |
| `GET /api/files/[name]` | Serves an uploaded photo (path-traversal-safe via `path.basename`) |
| `GET /api/ocr/[name]` | Runs Apple Vision OCR on an uploaded file; compiles `vision-ocr` on first call |
| `POST /api/import` | Generic CSV import (any platform's export, column-mapped in the UI) |
| `POST /api/import/statement` | Parses an uploaded Uber weekly-statement PDF |
| `POST /api/import/activity` | Accepts client-OCR'd Earnings Activity trips (already reviewed by the user) |
| `POST /api/import/requests` | Accepts client-OCR'd trip-request cards, enriches existing trips with pickup km/address |
| `POST /api/track` | Appends a batch of GPS points to a shift's track, recomputes `gpsKm` |
| `GET/POST /api/settings` | Locale, per-platform commission % (legacy, unused post net-first — see §7), photo retention days |

### The generic CRUD system (`lib/crud.ts`)

Rather than hand-writing eight near-identical CRUD route files, one dynamic
route (`app/api/[entity]/route.ts` + `[id]/route.ts`) reads a config map:

```ts
ENTITIES = {
  vehicles: { model: "vehicle", fields: {...}, required: [...], orderBy: {...} },
  shifts:   { model: "shift",   fields: {...}, required: [...], orderBy: {...} },
  ...
}
```

`coerceBody()` type-coerces the JSON body per field (`string`/`number`/`int`/
`date`/`boolean`) and decides what an **empty value** means:
- if the field is in `required[]` → omitted (so Prisma's default/existing
  value stands — you can't null out `vehicleId`);
- otherwise → explicit `null` (so clearing an optional field, e.g. a manual
  depreciation override, actually clears it in the DB).

This distinction was a real bug once (see git history, "clear-field fix") —
**any new entity/field added to `crud.ts` must be placed in `required[]`
correctly, or clearing it either no-ops or throws.**

Trip creation has one special case: if no `shiftId` is given, `matchTripToShift()`
auto-attaches the trip to whichever shift's time window contains it.

---

## 5. Data model (`prisma/schema.prisma`)

All money is **EGP**, all distances **km**. Every model relevant to a
vehicle has `notes: String?` per the product requirement that manual entries
always allow free-text notes.

| Model | Role | Notable fields |
|---|---|---|
| `Setting` | Key-value store | `passphraseHash`, session JWT secret, `commissionPcts` (JSON, legacy), `photoRetentionDays` |
| `Vehicle` | One profile per car | `fuelSetup` (PETROL/CNG/DUAL), `ownership` (OWNED/INSTALLMENT/RENTED/TARGET — drives the cost model), `purchasePrice`/`estimatedValue` (feed auto-depreciation), `depreciationPerKm` (manual override — null lets the auto engine run) |
| `Shift` | One driving session | `startOdometer`/`endOdometer` (the km-split anchor), `startPhoto`/`endPhoto`, `gpsKm` + `track` (JSON `[[epochMs,lat,lng],…]` from in-app GPS tracking) |
| `Trip` | One ride-hailing trip | `fare`/`commission` (see net-first note below), `paymentType` (CASH/CARD — drives cash reconciliation), `pickupKm`/`pickupMin` (from trip-request cards), `pickupAddress`/`dropoffAddress` (Google place labels from screenshots), `source` (MANUAL/CSV/STATEMENT/OCR) |
| `CashTip` | A cash tip not tied to a specific trip | |
| `FuelUp` | One fill-up | `fuelType` (PETROL_80/92/95/CNG), `fullTank` (full-to-full pairs drive the L/100km calculation) |
| `Maintenance` | One service event | `category` enum-by-convention (OIL, TIRES, CNG_SERVICE, …) |
| `Expense` | Non-maintenance running cost | `isWork` (personal expenses excluded from true profit) |
| `Reminder` | Service reminder | `dueDate`/`dueOdometer`, `repeatKm`/`repeatMonths` for recurring reminders |

### The "net-first" money model — important, non-obvious

Early versions had the app estimate the platform's commission from a
per-platform default %. **This was removed.** Uber (and every platform)
already shows the driver their **net earnings** on every trip/screenshot/
statement — there is no need to estimate a fee.

So: `Trip.fare` and `Trip.commission` are **not** "gross fare" and "platform
cut" in the naive sense. They're populated so that `fare - commission` always
equals the driver's net earnings, and `commission` only carries meaning for
**cash trips**, where it represents *cash-in-hand vs. cash-owed-to-Uber*:

- **Cash trip:** `fare = cashCollected`, `commission = cashCollected - earnings`.
  A positive commission means the driver is holding money that belongs to the
  platform (deducted from the next payout). Uber's own Wallet already shows
  this authoritatively (real payout cycle, tolls, refunds, promotions) —
  Makasib doesn't attempt to reproduce it as a dashboard panel; see §16.
- **Card trip:** `fare = earnings`, `commission = 0` — the money already
  arrived net, nothing to reconcile.

`DEFAULT_COMMISSION_PCT` in `lib/analytics.ts` is now all zeros and only
exists so `tripCommission()` doesn't need a second code path for
manually-entered trips missing an explicit commission. **Do not resurrect a
nonzero default** — it would silently invent numbers Uber never charged.

---

## 6. Data ingestion — four sources, one merge pipeline

No official Uber driver API exists for individuals (see §8), so the app
supports four ways to get trip data in, all converging on the same
dedupe/merge logic in `lib/importApply.ts`:

### 6.1 Manual entry (`/trips`, `/fuel`, etc.)
Net-first form: "Your earnings (net)" + "Cash collected" (only shown for cash
trips) — exactly the two numbers the platform itself shows the driver.

### 6.2 Shift-from-photos (`/import`, default tab)
Drop the shift's start and end odometer photos. Pipeline per photo:
1. Upload → HEIC converted to JPEG server-side (`sips`).
2. EXIF `DateTimeOriginal`/`CreateDate` → shift start/end time (falls back to
   file `lastModified` if EXIF is stripped, which the UI flags for review).
3. Odometer digits: **Apple Vision first** (`serverOdometerCandidates()`
   in `lib/ocr.ts`, hits `/api/ocr/[name]`), **tesseract.js fallback** if
   Vision is unavailable (non-Mac server) or finds nothing. The client tries
   all 4 rotations for the tesseract path since dashboard photos are often
   sideways with EXIF orientation lost in HEIC conversion.
4. Everything is editable before save — OCR is a prefill, never silent truth.

### 6.3 Screenshots OCR (`/import`, "ocr" tab)
Drag-and-drop **any number of screenshots at once**; reading starts
automatically (no button — see conversation history "one-gesture" requirement).
Each image is OCR'd (tesseract.js) and classified:
- **Looks like a trip-request card** (`looksLikeTripRequest()` in
  `lib/tripRequest.ts` — detects the "(x km) away" pickup line) → parsed for
  fare, cash/card, pickup km/min, trip km, product, clock, pickup/dropoff
  address. These **enrich** existing trips (matched by net amount ± clock
  tie-break, `/api/import/requests`) rather than creating new rows, since a
  request card alone has no date.
- **Otherwise** → treated as an Earnings Activity screen
  (`lib/earningsActivity.ts`), parsed into one row per trip card: date, time,
  earnings, cash collected, product, duration, distance, pickup/dropoff
  address. Shown in an editable preview table before import.

**Orphan-row handling (important):** if OCR misses a card's earnings line,
the *next* card's detail line used to silently overwrite the previous
(incomplete) trip — a real bug found in UAT. Fixed: a detail line arriving
when the current card is already complete starts a **new orphan row** with
`earnings: NaN`, shown in amber with an empty amount field for the user to
fill in, rather than corrupting or dropping data.

### 6.4 Weekly statement PDF (`/import`, "pdf" tab)
`lib/uberStatement.ts` parses the text layer of the PDF Uber generates at
drivers.uber.com → Documents. Handles a real quirk: `pdf-parse` emits literal
NUL characters inside times (`"4 00 AM"`) — stripped before parsing.
Classifies each transaction row as `trip`/`tip`/`fee`/`bonus`/`transfer`/
`other` by product-name pattern. Tips and bonuses are matched to trips by
event time (`applyTip()`); fees become `Expense` rows (`applyFee()`).

### 6.5 The merge/dedupe layer (`lib/importApply.ts`)
`applyTrips()` is the single chokepoint all trip-bearing imports go through:
for each incoming trip, it looks for an existing trip within a **±5 minute
window** with a matching net amount. If found, it **merges** missing fields
(distance, notes, pickup/dropoff address) into the existing row instead of
creating a duplicate — this is what makes it safe to import the same PDF
statement twice, or import a statement and then later import screenshots of
the same trips (distances flow in from the screenshots, financials from the
statement). If no match, a new `Trip` is created and auto-matched to its
covering shift.

**Anyone adding a fifth import source must call `applyTrips()`/`applyTip()`/
`applyFee()` rather than writing directly to the DB.**

---

## 7. The analytics engine (`lib/analytics.ts`)

`getAnalytics(vehicleId, period)` — `period` is `"today"|"week"|"month"|"all"`
— returns everything the dashboard renders. Key derivations:

- **Fuel economy** (`fuelEconomy()`): computed only across **consecutive
  full-tank fill-ups**, per fuel group (petrol vs. CNG, since a dual-fuel car
  can't cleanly attribute km to one fuel otherwise). Gives L/100km, km/unit,
  and cost/km. Non-full-tank fill-ups still count toward total spend but not
  the consumption ratio.
- **Depreciation** (`lib/depreciation.ts`, `estimateDepPerKm()`): **automatic
  by default.** Declining-balance method — 15%/year of current value
  (`ANNUAL_DEPRECIATION_RATE = 0.15`), current value = driver's
  `estimatedValue` if set, else `purchasePrice` aged from the model year and
  floored at 30% of purchase (`VALUE_FLOOR_RATIO`) so a working car never
  depreciates to zero. Divided by the vehicle's own **observed annualized
  km** (`annualizedKm()` — extrapolated from odometer history once ≥14 days
  of data exist; falls back to `FALLBACK_ANNUAL_KM = 30,000` before that).
  `Vehicle.depreciationPerKm` is a manual override — **leaving it empty is
  the intended default state**, not a missing value.
- **Km split**: `shiftKm` (odometer end − start, summed over completed
  shifts) → split into `tripKm` (sum of trip distances) and `deadKm`
  (`shiftKm − tripKm`, floored at 0). `deadKm` further splits into
  `pickupKm` (sum of `Trip.pickupKm`, from request-card imports, capped at
  `deadKm`) and `cruisingKm` (the remainder) — only shown once pickup data
  exists. `personalKm` is the odometer span **between** shifts (i.e. driving
  the app never saw a shift for).
- **No cash-reconciliation panel, by design**: an earlier version summed
  `commission` per platform into a "you owe / platform owes you" dashboard
  card. Removed 2026-07-20 — it duplicated what Uber's own Wallet already
  computes authoritatively (real payout cycle, tolls, refunds, promotions),
  and a period-scoped approximation could only ever diverge from that real
  number, confusing drivers rather than helping them. `Trip.commission`
  itself is untouched (see §5's net-first note) — only the summary panel
  is gone. See §16 for the fuller reasoning.
- **Cost amortization**: fuel and maintenance cost-per-km are computed
  **all-time**, not per selected period, so a single expensive week doesn't
  distort that week's apparent profitability — costs are smoothed, only
  earnings are period-scoped. Fuel uses the rate measured across complete
  full-to-full tank windows (falling back to all-time spend ÷ all-time km
  before two full tanks exist). Maintenance charges each item with a service
  interval (`Maintenance.lifetimeKm`) over that interval — but **only the
  newest record per category**, so replacing a part supersedes the one it
  replaced instead of stacking on top of it (`lib/maintenance.ts`,
  `maintenanceRatePerKm`). Items with no interval keep all-time averaging.
  Without the supersede rule the rate grows without bound as history
  accumulates: five 8,000 km oil changes would read 5 × 0.19 = 0.94 EGP/km
  instead of 0.19, shrinking every profit figure in the app with it.
- **14-day trend**: independent of the period selector, always the trailing
  14 days, used for the dashboard's daily profit chart.

---

## 8. "Plan your day!" (`lib/planner.ts`, `/plan`)

Reads every logged shift and trip to answer **when** to drive (not yet
**where** — see gap below).

- **Heatmap**: weekday × hour grid of EGP/hour. Shift hours are distributed
  fractionally into their overlapping hour buckets (`hoursGrid`); trip
  earnings (net + tips) land in the bucket of their start hour. A cell only
  gets a rate once it clears `MIN_HOURS_FOR_RATE = 1` hour of logged
  presence — prevents a single 10-minute trip from producing a misleading
  "best hour."
- **Top slots**: best 5 day-hour buckets by EGP/hour, gated at
  `MIN_TRIPS_FOR_SLOT = 3` trips.
- **Wait between trips**: median minutes from one trip's start to the next
  **within the same shift** (`tripsByShift` grouping), bucketed by hour of
  day — the "how busy is it right now" proxy.
- **Seasons**: Ramadan (hijri — hardcoded date ranges in `RAMADAN[]`,
  **currently only populated through 2028; must be extended by hand
  thereafter**), summer holidays (Jun 15–Sep 30), school days (everything
  else).
- **Honest confidence**: `enoughData` flag (≥30 trips, ≥8 shifts) gates a
  "still learning" banner in the UI — the module never presents thin-sample
  noise as a confident recommendation.

**Known gap — where, not just when:** no current ingestion source reliably
carries structured GPS coordinates for trip pickup/dropoff (screenshots give
*address label strings*, e.g. "First 6th of October", which are stored on
`Trip.pickupAddress`/`dropoffAddress` but not yet geocoded or clustered into
zones). The in-shift GPS tracker (§ below) captures raw coordinate tracks
per shift but doesn't yet attribute them to specific trips. Turning this
into a "best zones" map is planned for phase 2/3 (geocode the address
strings, or use the mobile app's live GPS at trip-match time) — see §9.

---

## 9. GPS tracking (`components/GpsTracker.tsx`, `/api/track`)

Foreground-only (a browser tab can't track location while backgrounded or
the screen is off — this is a phase-1 web limitation, not a design choice;
the native mobile app will do this properly with background location).

- `navigator.geolocation.watchPosition`, points kept only when moved ≥20m or
  ≥30s elapsed since the last kept point (bandwidth/storage thinning).
- Requests a Screen Wake Lock (best-effort — not all browsers support it) so
  the phone doesn't sleep mid-shift.
- Batches points to `/api/track` every 30s; the server appends to
  `Shift.track` (JSON array) and recomputes `Shift.gpsKm` via a
  glitch-filtered haversine sum (drops segments implying >150 km/h or >2 km
  single jumps — GPS noise, not real driving).
- Requires HTTPS (`window.isSecureContext`) except on `localhost` — see the
  README's iPhone UAT section for the local mkcert workaround.

---

## 10. Photo retention (`lib/purge.ts`)

**Trip screenshots are never stored at all** — they're OCR'd client-side and
discarded; only the extracted data reaches the server. Only odometer/receipt
photos touch disk (`data/uploads/`, referenced by filename from `Shift`/
`FuelUp`/`Maintenance`).

Those are purged automatically after `Setting.photoRetentionDays`
(1–30, default 30, enforced both directions in `getRetentionDays()`/
`setRetentionDays()` — **30 is a hard ceiling**, configurable downward in
Settings). A lazy scheduler (`maybePurgeUploads()`) piggybacks on normal
traffic (upload and analytics requests) and runs at most once per 6 hours —
there's no cron; if the app isn't used for a while, purging simply waits
until the next request. Purging deletes the file and nulls the DB's
reference to it; it never touches the numeric data already extracted from
the photo.

---

## 11. Auth & i18n

- **Auth**: `lib/auth.ts`. A single passphrase (bcryptjs hash in `Setting`),
  session = HS256 JWT (`jose`) in an httpOnly cookie (`up_session`, 30-day
  expiry). The JWT signing secret is itself generated once and stored in
  `Setting` (`sessionSecret`) — not an env var, so it survives across
  `npm run dev` restarts without configuration. This is single-user-only by
  construction; phase 2's OAuth migration replaces this file's contents but
  keeps its `requireAuth()`/`isAuthed()` call sites unchanged as a stable
  interface for the rest of the app.
- **i18n**: `lib/i18n/messages.ts` holds parallel `en`/`ar` dictionaries
  keyed identically (e.g. `"db.trueProfit"`); `translate(locale, key, vars)`
  does `{n}`-style interpolation. Locale is a cookie (`locale`), read
  server-side in `lib/i18n/server.ts` for the root `<html lang dir>` and
  client-side via `I18nProvider`/`useI18n()`. **Every new UI string needs
  both an `en` and `ar` entry** — there's no fallback-to-English-with-missing-
  translation warning; a missing `ar` key silently falls back to English at
  render time (see `translate()`), which is a soft gap worth a lint rule
  later.

---

## 12. Known gaps / honest limitations

- **No automated test suite.** The scaffold was created with `--no-eslint`
  and nothing has added tests since. Verification so far has been manual
  (build + typecheck + ad-hoc Node scripts importing the pure `lib/*.ts`
  functions directly, run against real screenshots/PDFs during UAT — see git
  history commit messages for what was checked). Recommend adding Vitest and
  porting those ad-hoc scripts into a real `__tests__` suite before phase 2,
  especially for `uberStatement.ts`, `earningsActivity.ts`, `tripRequest.ts`,
  and `analytics.ts` — they're pure functions and cheap to test properly.
- **macOS-only server dependencies.** Apple Vision OCR (`tools/vision-ocr.swift`)
  and HEIC→JPEG conversion (`sips`) both shell out to macOS-only tools. Phase
  1 runs on the owner's Mac, so this is fine today, but **moving the server
  to Linux (Supabase/Vercel/any cloud host) breaks both** — odometer OCR
  would silently fall back to tesseract (much worse on LCDs) and HEIC photos
  would fail to convert (broken previews, no OCR). Before/during the phase-2
  hosting migration, replace both: HEIC via `sharp` + `libheif`, and Vision
  OCR via a cloud OCR API or a fine-tuned model — **do not deploy phase 2
  without addressing this**, it's a silent quality regression, not a crash.
- **No official Uber driver API access.** By design — see §6, this is why
  four alternate ingestion paths exist instead.
- **Ramadan date table is finite** (`lib/planner.ts`, hardcoded through
  2028) — needs manual extension.
- **GPS tracking is foreground-only** on the web (see §9) — a real
  limitation until the mobile app exists.
- **`commissionPcts` setting is vestigial.** Kept in `Setting`/`/api/settings`
  for backward compatibility with existing rows but no longer read
  meaningfully by the net-first analytics engine (`DEFAULT_COMMISSION_PCT`
  is all zeros). Fine to remove entirely in a future cleanup pass.
- ~~Single vehicle/single user~~ — **built 2026-07-21.** Multi-car support:
  `VehicleProvider` (`components/VehicleProvider.tsx`) holds the driver's
  cars + sticky "default car" (`Setting.defaultVehicleId`) in a single React
  context shared by every page, so switching cars anywhere (the Nav
  dropdown, or picking a different car when starting a shift) applies
  everywhere until switched again. `/cars` (`lib/vehicleSummary.ts`) lists
  every car as an asset — current odometer, km driven, depreciation so far,
  all-time true profit — with archive-not-delete once a car has any
  history. `getProfileAnalytics()` (`lib/analytics.ts`) aggregates profit
  across the whole profile (dashboard's "All cars" toggle); `lib/carInsights.ts`
  surfaces a lean set of honest, data-gated suggestions (best performer,
  idle car, ROI/payback, negative true profit) — still single-user, just no
  longer single-vehicle.

---

## 13. Roadmap

### Phase 2 — hosted web app
1. **Database**: migrate `schema.prisma`'s `datasource` from `sqlite` to
   `postgresql`, point at Supabase. Since Prisma migration SQL is
   provider-specific, the existing `prisma/migrations/*` (SQLite dialect)
   **cannot be replayed against Postgres** — for a fresh Postgres database,
   delete the migrations folder and run `prisma migrate dev --name init`
   once against the new `DATABASE_URL` to generate Postgres-dialect
   migrations from the current schema. No data migration is needed *if*
   phase 2 starts with a clean Postgres database (the SQLite file was always
   personal UAT data, never meant to be carried forward as-is) — if carrying
   forward matters, export via `prisma db seed`-style script or a one-off
   pg-compatible dump.
2. **Auth**: replace `lib/auth.ts`'s passphrase/JWT with real OAuth (Google/
   Microsoft) — likely via Supabase Auth directly, or NextAuth/Auth.js
   sitting in front of the same Prisma models. Multi-user requires adding a
   `userId` foreign key to `Vehicle` (and cascading) — currently there is no
   user model at all.
3. **Server dependencies**: replace `sips` (HEIC) and Vision OCR (§12)
   before cutting over — this is the one gap that actively breaks if
   ignored, not just a missing feature.
4. **Database hosting** (researched 2026-07-18): Supabase remains the right
   default — it bundles Postgres + Auth + Storage + RLS in one place, which
   matters more than raw price for a small team shipping fast. Free tier:
   2 projects, 500MB DB, 1GB storage, 5GB bandwidth, but **pauses after 7
   days idle** (fine for active development, not for a "sleeping" demo).
   Paid: $25/mo flat (Pro), no scale-to-zero — you pay for the instance
   24/7. **Neon** is the pure-Postgres alternative worth knowing about: 10x
   cheaper entry ($19/mo Launch vs. $25 Pro) and true scale-to-zero
   (compute auto-suspends after 5 min idle), but no bundled Auth/Storage/RLS
   — you'd wire NextAuth + S3-compatible storage yourself. Reasonable
   trigger to reconsider: if usage is spiky (most users driving only certain
   hours) rather than steady, Neon's scale-to-zero could meaningfully
   undercut Supabase's always-on Pro compute. **Railway** is not a
   database-specialist product (generic managed Postgres, no branching, no
   serverless-tuned pooler) — skip it for this app. At current expected
   scale (single-driver rows, text + small JSON GPS tracks, no photo
   retention beyond 30 days per §10) database size stays tiny for a long
   time; the real cost driver later is bandwidth/egress if the multi-driver
   aggregated-stats feature (see backlog) starts serving heavier read
   traffic — budget for that when it's scheduled, not now.
5. **Web UI hosting**: Vercel is the natural fit for Next.js (built by the
   same team, zero-config deploys, 6,000 free build minutes vs. Netlify's
   300) — **but Vercel's free tier explicitly prohibits commercial use**,
   which this product is headed toward (§ Phase 3 sells to drivers). Since
   this app will eventually charge money, budget for **Vercel Pro ($20/mo
   per seat)** once monetized, or launch straight onto Netlify instead
   (flat $20/mo for the whole team, commercial use allowed even on its free
   tier, solid — if slightly less polished — Next.js support via
   `@netlify/next`). Either way, Supabase Storage replaces local
   `data/uploads/` for photos once hosted.

### Phase 3 — mobile app
- React Native/Expo, reusing the same REST API under `app/api/` unchanged.
- **Background GPS** (the web version's biggest limitation, §9).
- **On-device OCR**: Apple Vision on iOS, ML Kit on Android — replaces both
  tesseract.js and the server-side Vision helper; also removes the
  macOS-server dependency entirely for phase 3 users.
- **Android notification-based auto trip capture** (reads Uber's own
  notifications — iOS forbids this by platform policy; not possible there).
- Arabic-first UI (translations already complete from phase 1).
- Sold as a subscription to Egypt/MENA drivers — see the product-strategy
  discussion in project chat history for market-fit suggestions (multi-
  platform support, cash-heavy bookkeeping, CNG/dual-fuel tracking,
  rental/fleet-owner dashboards, local payment rails).

### Near-term feature backlog (not yet scheduled to a phase)
- Geocode/cluster `Trip.pickupAddress`/`dropoffAddress` into named zones for
  a "best zones to drive" panel in Plan-your-day (§8's known gap).
- Attribute in-shift GPS tracks (§9) to individual trips for a true
  pickup-vs-cruising map, not just an address-label proxy.
- ~~Multi-driver aggregated stats~~ — **built 2026-07-18** as
  `lib/benchmark.ts` (real cross-vehicle average, honestly reports
  `driverCount: 0` until phase 2 has more than one driver's data — see §15).
  Remaining work is purely "have more drivers" — no more code needed.
- Remove the vestigial `commissionPcts` setting (§12).
- ~~Vehicle switcher UI~~ — **built 2026-07-21** (§12).
- Automated test suite (§12).
- **Airport pickup alerts** (researched 2026-07-18, not built): the idea —
  alert drivers when a flight is landing at CAI/HBE so they can position for
  pickups, the way Egyptian drivers already do manually via FlightRadar24 —
  is sound, but **no adequate free flight-tracking API exists** for it.
  OpenSky Network is free but explicitly **non-commercial-licensed** (a
  dealbreaker for a product headed toward paid subscriptions) and its
  ADS-B coverage outside Europe/North America depends on volunteer ground
  receivers, with no guarantee of reliable Cairo coverage. Aviationstack's
  free tier is 100 calls/month — exhausted in under a day of polling one
  airport. The realistic path, if revisited: **AeroDataBox** via RapidAPI,
  paid tiers from ~$5–15/mo for the call volume a single-airport polling job
  would need — cheap, but not free, so it doesn't meet the condition this
  was gated on. Uber's own in-app airport-timing alerts (which the user
  already gets) also reduce the marginal value of duplicating this. Revisit
  only if the budget bar changes or a genuinely free/generous aviation API
  appears.

---

## 14. Development history (commit-level)

| Date | Commit | What shipped |
|---|---|---|
| 2026-07-14 | `5e667c0` | `create-next-app` scaffold |
| 2026-07-14 | `0703ef0` | Phase-1 core: schema, auth, all CRUD pages, dashboard, i18n |
| 2026-07-14 | `7f4d7e8` | Statement PDF import, Earnings Activity screenshot OCR, odometer OCR (v1) |
| 2026-07-15 | `529321e` | Net-first money model, trip-request card OCR (pickup km), input-contrast fix |
| 2026-07-16 | `14f33a9` | Auto depreciation, drag-drop screenshot import, "Plan your day!" module |
| 2026-07-16 | `e5d8ac2` | Shift-from-photos import (EXIF+OCR), GPS tracking, PWA manifest, clear-field bug fix |
| 2026-07-16 | `f06a139` | Real-shift UAT fixes: orphan-row OCR handling, address capture, HEIC support |
| 2026-07-16 | `3f99aa6` | Apple Vision odometer OCR (replaces unreliable tesseract-on-LCD), configurable photo retention |

For the *why* behind any of these, the commit messages are written in full
prose and are the fastest way to recover intent without re-reading this
whole document.

---

## 15. Live offer scoring & driver benchmark (added 2026-07-18)

Two features added directly from competitive research (Gridwise/Solo/Para/
rutera comparison) plus the product owner's own request — see git history for
the exact commit.

### Offer scoring (`/score`, `lib/offerScore.ts`)
Modeled on rutera's "read the offer screen automatically, show real $/mile
before accepting" — the closest existing competitor to this exact idea.
**Phase-1 constraint, stated honestly in-app**: this is a screenshot-and-check
flow, not a live overlay — a plain web app can't read another app's screen
without switching to it (that's a native-app-only capability; see phase 3).
The driver screenshots the incoming request card the instant it appears,
switches to Makasib, and picks that photo; the existing `lib/tripRequest.ts`
parser (built for the batch OCR import) extracts fare/pickup/trip km+min;
`scoreOffer()` computes an estimated profit/km and profit/hour for *this one
offer*, using the driver's own historical cost/km (`getAnalytics().rates`)
and comparing against their own historical `perHour`/`perKm` — never a
generic or invented number. The verdict (`good`/`ok`/`bad`) is driven by
profit/**hour** (time is the scarcer resource for a driver), and stays
`unknown` — honestly — until the driver has logged enough history to have a
baseline at all.

Speed matters: Uber's accept countdown is ~15 seconds and the whole
screenshot→switch-app→pick-photo→OCR round trip has to fit inside it. Two
mitigations: `warmupOcr()` (`lib/ocr.ts`) fires on page mount so tesseract's
worker/model is already downloaded before a photo is ever picked, and every
field is live-editable with no submit step — the score recomputes instantly
as OCR lands or gets corrected. **Phase 3 (native mobile) is where this
becomes genuinely instant** — an accessibility-service/overlay reading the
request card with zero app-switching, closing the gap with rutera's real UX.

### Driver benchmark (`lib/benchmark.ts`, dashboard card)
"You vs. other drivers," Gridwise-style. Built as a **real** cross-vehicle
aggregation — averages every *other* active `Vehicle`'s own `perHour`/
`perKm` for the period — never fabricated comparison numbers. In today's
single-install deployment there's no other vehicle to compare against, so it
honestly reports `driverCount: 0` and the dashboard shows "not enough other
drivers yet" rather than inventing a benchmark. The instant a second
vehicle's data exists in the same database — a local test vehicle now, or
real other drivers once phase 2 hosts multiple users — the comparison
activates with **zero code changes**; this was written to generalize, not to
be rebuilt later.

---

## 16. Going commercial: legal, payments, and pricing (researched 2026-07-20)

Notes from a product-strategy discussion, not legal or tax advice — get a
real accountant/lawyer before the first paid customer. Captured here so the
reasoning survives past the conversation it came from.

### Legal setup (Egypt)
- Minimum to legally invoice a customer: a **سجل تجاري** (commercial
  registry) + tax card as a sole proprietor/freelancer. VAT (14%)
  registration is required once revenue crosses the threshold. Egypt's
  e-invoice system (ETA) increasingly expects registered invoices even for
  small businesses — worth confirming with an accountant before launch, not
  after.
- An LLC is only worth the extra cost/paperwork if outside investment is
  the goal, or if a paid **Apple Developer** organization account is needed
  (requires a D-U-N-S number, which individuals don't have).
- Egypt's Personal Data Protection Law (151/2020) applies the moment the
  app hosts *other people's* financial + location data — a real privacy
  policy and documented lawful basis become necessary, not just the
  Phase-1 personal-use posture this document assumes elsewhere.

### Payments / subscriptions
- **Paymob** is the strongest fit for this market: cards, Meeza, and
  Egyptian mobile wallets (Vodafone Cash, Etisalat Cash, Orange Cash) —
  wallet support matters because many drivers won't have a credit card.
  Paymob also has a tokenization/subscription API for genuine recurring
  billing in EGP.
- **Fawry** has huge reach (payable at any kiosk) but suits one-off /
  reference-code payments better than clean auto-renewing subscriptions.
- Stripe doesn't support Egyptian merchant accounts directly. Global
  subscription platforms (Paddle, Lemon Squeezy) can act as
  merchant-of-record for international cards but don't solve the
  wallet-payment gap that matters most for this audience. **Paymob is the
  practical default**, possibly alongside Fawry as a secondary option for
  drivers who prefer paying cash at a kiosk.

### What the app needs before it can charge anyone
All of this sits on top of the Phase 2 hosting migration already scoped in
§13 — commercializing isn't a separate track, it's Phase 2 plus:
1. A `Subscription`/`Plan` model tied to a real per-user `userId` (today's
   single-passphrase auth has no user model at all — see §13's Phase 2
   auth step).
2. A webhook endpoint (e.g. `/api/webhooks/paymob`) to receive
   renewal/payment events and update subscription status — needs a public
   HTTPS host reachable by the payment gateway, so it can't run against a
   local Mac dev server; this falls out naturally once hosted on
   Vercel/Netlify per §13.
3. A `requireActiveSubscription()` gate sitting alongside the existing
   `requireAuth()` in `lib/auth.ts`, with a grace period for failed/late
   renewals rather than an instant hard lockout.

### Pricing shape
Driver income is weekly and cash-heavy, so **weekly billing** (roughly
EGP 20–40/week) likely converts better than a monthly plan — it mirrors
Uber's own payout cadence, which is the cash rhythm drivers already think
in. Pair it with a free trial and a free/paid split (free = manual entry
and the dashboard; paid = OCR screenshot import, offer scoring, and
Plan-your-day) so the paywall is felt as "unlock the time-saving features"
rather than "pay to use anything at all."

### Distribution
Makasib is already a PWA (`public/manifest.webmanifest`, "Add to Home
Screen") — sellable today with no app-store gatekeeper and no Apple/Google
cut, since that cut only applies to purchases made through the native
store/in-app-purchase flow, not a web-based subscription reached via
Safari/Chrome. The Phase 3 native app (React Native/Expo, §13) only
becomes necessary for background GPS or Android notification-based auto
trip capture — and it brings Apple Developer Program ($99/yr) + Google
Play ($25 one-time) + store review, plus their revenue cut if subscriptions
are sold through the store rather than routed externally.
