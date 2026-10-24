# Makasib (مكاسب) — Driver Profit Tracker

Shows ride-hailing drivers their **true profit**, not just gross earnings:
after fuel, maintenance, depreciation, and dead kilometers. Built for the
Egypt/MENA market — multi-platform (Uber/Careem/inDrive/Bolt), cash
reconciliation, dual-fuel (petrol + CNG) tracking, Arabic UI with RTL.

Currently **phase 1**: a single-user local app (this repo), running on one
Mac, with a full data-import pipeline (statement PDFs, screenshot OCR,
odometer photos) built specifically because Uber has no public driver API.
See **[DOCS.md](./DOCS.md)** for the complete architecture, data model, every
formula the analytics engine uses, known gaps, and the phase 2/3 roadmap
(hosted multi-user app → native mobile app). This file is just the
quick-start.

## What it does

- **One Drive button** — the green button in the middle of the tab bar does
  the right thing for the moment. No shift running: start one with just the
  odometer (one tap uses the reading where the car was parked, or read it
  from a photo of the dash). Shift running: log a trip with one number and
  Cash/Card, add several at once, or jump to the screenshot import; a live
  strip above the tab bar shows time on shift, trips and earnings on every
  screen. End shift: odometer (the app suggests it), then — if you logged
  trips while driving — a single "That's all" tap to the recap.
- **Simple or Detailed** — every analysis screen opens in **Simple**: the
  profit hero, today's target, weekly goal rings, where to go now and the
  14-day bars. **Detailed** adds every breakdown (time and km splits, costs,
  benchmarks, comparison tables). Switch at the top of Home, Weeks and Plan,
  or in Settings; the choice is saved on the phone.
- **A designed look** — a deep-to-bright emerald brand gradient on the hero
  card and the Drive button, white cards with soft shadows, a colour chip per
  topic (fuel amber, maintenance violet, expenses rose, planning sky), ring
  gauges for goals, gradient bars, roomy tables, big numerals in Readex Pro
  (self-hosted, Arabic + Latin), and a hand-tuned dark mode.
- **Car cards like Uber's** — every car shows as a card with a studio-style
  render in its real colour and body type (sedan, hatchback, SUV, MPV), the
  plate, "Silver Chevrolet Optra · Automatic", the km driven since the car
  was added to Makasib (from its first logged shift or fill-up), its
  all-time profit and health — one full-width row per car.
  Colour is picked from swatches; the gearbox sits next to the model.
- **Like-for-like car comparison** — your fuel economy and maintenance cost
  are compared with other drivers of the same model *and* gearbox once at
  least three such cars have data (otherwise the same model, any gearbox,
  and the card says so). New catalogue models (e.g. Speranza A516) appear
  automatically — no re-seeding.
- **Vehicle profile** — fuel setup (petrol/CNG/dual), ownership model
  (owned/installment/rented/target-share), and depreciation you control: a
  **resale-per-km** model by default (only the extra resale loss your km
  cause, not the age loss you'd carry anyway), the old use-up-the-car model,
  or your own figure — with an **On/Off switch** that removes depreciation
  from every profit number when you don't want it counted.
- **Uber pay weeks** — everything weekly runs Monday 04:00 → Monday 03:59,
  exactly like your Uber statement, for every platform and for trips typed by
  hand. The dashboard shows the week's progress and when it closes; a
  "your week closed" recap appears on Monday.
- **Weeks** — one screen per pay week: true/cash profit, earnings, time
  split (with a rider / to pickup / waiting), km split (paid / pickup /
  cruising / personal), day-by-day, earnings by hour, best trip, best day,
  best hour, which trip lengths pay, top pickup and drop-off areas, cash vs
  card, costs — and comparisons against last week, your best week, and the
  same point last week, with up to two years of history and a vertical week
  picker (filter by month, year, or jump to a date).
- **Shifts** — odometer start/end (manually, from photos with automatic
  time+reading extraction, or with live GPS tracking) — this is how the app
  tells ride-hailing km apart from personal km.
- **Trips** — a batch entry built for the end of a shift (earnings first,
  then tip, trip km, km to the rider, minutes, cash/card, time — each row
  pre-filled from the last), a one-field quick-add while driving that also
  saves where you are as the drop-off, or automatic import from a weekly
  statement PDF and/or Earnings Activity screenshots. Pickup and drop-off
  coordinates are read back from the shift's GPS track.
- **End of shift in three steps** — close the shift (with the app's best
  guess at the end odometer), confirm the trips you logged while driving with
  one tap (or add the missing ones / import screenshots), see the recap.
- **Fuel** — every fill-up, plus an all-time summary: total litres/m³, total
  spent, a consumption gauge measured full-to-full, spend split by fuel type,
  and fuel as a share of net earnings. A **price-hike scenario** card answers
  "if petrol goes up 2 EGP, what does that cost me per km, per week, per
  hour?" from this car's own measured consumption.
- **Maintenance with service life** — each item takes a service interval
  ("lasts for X km"), so a 4,100 EGP brake job good for 50,000 km is charged
  at 0.08 EGP/km instead of blowing a hole in one week's profit. Progress
  bars show how much of each part's interval is used up, green → amber →
  red, and a superseded item retires automatically so an interval is never
  charged twice.
- **"Time to change" alerts on Home** — a part with a service interval turns
  amber at 80% of its life and red at 90%, and stays on Home until you tap
  **I changed it**. That logs the new part (odometer, cost and interval
  pre-filled from last time), so its bar restarts at 0% and the alert clears.
  The same button sits on worn parts on the Maintenance page.
- **Reminders, mostly free** — any service logged with an odometer reading
  and an interval generates its own reminder (brakes fitted at 246,170 with
  a 50,000 km interval ⇒ due at 296,170). Derived, not stored: edit the
  service entry and the due point moves with it. Manual reminders (licence,
  insurance) still work alongside them.
- **Expenses in one tap** — chips for wash / mobile data / parking / toll /
  fine, pre-filled with the last amount actually paid for that item, from
  the dashboard or the Expenses page. Plus a summary of what running costs
  take out of earnings.
- **Today's target** — the one forward-looking screen: what today has to
  earn to clear break-even (cost/hour × planned hours + fixed daily cost),
  and what those hours normally earn you, with an hours stepper that moves
  every figure. Built from this driver's own history, median not mean.
- **Dashboard** — true profit (not gross) and cash profit side by side, fuel
  economy, on-trip vs. dead vs. personal km **priced in EGP at your own
  cost/km** (dead km is the one cost a driver can cut tonight), and (once
  other drivers' data exists) a you-vs-others benchmark.
- **Plan your day!** (خطّط يومك) — a heatmap of your best times to drive,
  built from your own logged history.
- **Score this offer!** (قيّم العرض) — screenshot an incoming trip request
  and get an instant profit/km and profit/hour estimate against your own
  average, before you accept.
- **Where to go now** — the dashboard ranks your pickup areas for this hour
  on this kind of day (weekday / weekend) from your own last 8 weeks, with
  what each paid per trip and per minute, and names the best coming hour.
- **Bonuses and quests, without typing them** — there is no driver API from
  Uber to read them, so Makasib takes promotions, quests and boosts from the
  weekly statement PDF you already import (kept apart from tips). A running
  quest is entered once a week — from a screenshot, by typing the tiers, or
  one tap on "Same as last week" — and Makasib counts your trips toward it,
  shows the next tier and whether it's worth chasing at your usual pace.
- **Proof of income** — a printable A4 statement (Arabic or English) by
  calendar month: income, tips and bonuses, running costs, net, trips and
  days worked, by platform, with your name and a reference number — for a
  bank, a landlord or a visa. Print or save as PDF from the phone.
- **Phone notifications** — turn them on in Settings (on iPhone, after
  adding Makasib to the Home Screen). A part at 90% of its life, papers about
  to expire, last week's profit on Monday morning, today's target reached, a
  quest a few trips from the next tier, fuel use creeping up, breaks after 4,
  10 and 12 hours, and the day's best hour coming up. Each sent once, quiet
  from 11 pm to 8 am except long-shift warnings; pick topics, send a test.
  The server signs its own pushes — no outside account needed.
- **Car fund** — the week's maintenance wear (your cost per km × km driven)
  to put aside, the next part due with what it cost last time and roughly
  how many weeks away, and everything due in the next eight weeks.
- **Fuel warnings and gas savings** — when the last two full tanks used 12%+
  more than your usual, the Fuel page says so and lists what to check; a
  dual-fuel car sees what natural gas has saved, per 100 km and in total.
- **Papers in one tap** — car and driving licence, insurance, a monthly
  fines check, criminal record certificate, fire extinguisher: tap one,
  type the expiry date from the card, done.
- **Your accept rule** — on Score this offer: a minimum fare per km counting
  the pickup and a pickup limit, suggested from your own costs and profit per
  hour, with a cheat sheet of minimum fares for common trip lengths. Every
  scored offer also says what your rule decides.
- **Months & years** — the year's profit against the same months last year,
  profit by month, best and weakest month, and a month-by-month table.
- **Keep or sell?** — on each car: what another year of it should earn, what
  it loses in value, repairs due within the year, whether maintenance per km
  is rising — a keep / watch / price-it verdict with the reasons.
- **Platform scorecard** — type your rating, acceptance and cancellation
  once a week (per platform) and see the trend week on week.
- **Why shifts end** — tap a reason when closing a shift (target hit, tired,
  slow, traffic, car, personal); Weeks shows the pattern over eight weeks.
- **Week export** — any pay week as a CSV (one row per trip) for your own
  archive or to check against the Uber statement.
- **Addresses on the map** — trips imported from screenshots carry an
  address but no position; Makasib looks each new label up once on
  OpenStreetMap (switchable off in Settings) so they count in "Where to go".
- **Phone-first UI** — bottom tab bar with the Drive button in the middle,
  big numbers, light and dark themes (per device, or follow the phone).
- **Not in scope, on purpose** — cash settlement with Uber (what a cash trip
  collected vs. what Uber keeps). Uber's Wallet already does that exactly;
  Makasib only tracks your net earnings and the car's costs.
- **Full English/Arabic UI**, switchable any time, RTL-correct.

The driver-facing user manual (Egyptian Arabic, printable) lives at
[`public/manual-ar.html`](./public/manual-ar.html) — served at
`/manual-ar.html` when the app is running. Keep it in step with the UI: it
is the only documentation an actual driver ever reads.

## Tests

```bash
npm run db:sync   # upgrade a database to the current schema without dropping anything
npm test          # vitest: pay-week boundaries, depreciation, weekly zones/best trip, OCR parsers, GPS lookup, geocoding
npm run typecheck
```

## Requirements

- Node.js 20+ and npm
- **macOS**, currently required for two features (both degrade gracefully if
  missing, see [DOCS.md §12](./DOCS.md#12-known-gaps--honest-limitations)):
  odometer-photo OCR (uses Apple's Vision framework) and HEIC→JPEG photo
  conversion (uses `sips`). Everything else is cross-platform.
- Xcode Command Line Tools (`xcode-select --install`) — needed the first
  time odometer-photo OCR runs, so it can compile `tools/vision-ocr.swift`.

## Quick start (local, on your Mac)

Requirements: Node 20 or newer. Everything else comes from `npm ci`.

```bash
git clone <this repo> && cd <repo>
npm ci                      # installs the EXACT versions in package-lock.json (Prisma 7, Next 16.2)
cp .env.example .env        # DATABASE_URL="file:./data/app.db"  → the database lives at ./data/app.db
npm run db:sync             # creates data/app.db (or upgrades an existing one) — never drops anything
npm run dev                 # http://localhost:3000
```

> Use `npm ci`, not `npm install`, so you get the versions this code was
> tested with. The project is on **Prisma 7**: the database URL lives in
> `prisma.config.ts` / `.env` (not in `schema.prisma`), and `lib/db.ts`
> opens SQLite through the `better-sqlite3` adapter.

### Running it with your own existing database

Your real data is a single SQLite file. To run this version on it:

1. **Back it up first.** Copy the original `app.db` somewhere safe and never
   point the app at the only copy.
2. Put a copy at `./data/app.db` inside the repo (create the `data` folder if
   it is missing — it is gitignored).
3. Make sure `.env` says `DATABASE_URL="file:./data/app.db"` (that path is
   relative to the `prisma/` folder, which is why it starts with `../`).
4. Run `npm run db:sync`. It backs the file up, adds the new columns and
   tables this version needs, keeps every column that already exists, records
   the migrations, and converts Prisma-6-era dates to the Prisma 7 format
   (without that, weekly filters show nothing on an older database).
5. `npm run dev`.

**Never run `prisma db push` against a database that has data.** It compares
the live database with the schema and *drops* any column the schema does not
list — that is exactly how a copied production database lost its
colour/transmission values once. `db:sync` and `prisma migrate deploy` only
ever add.

If a `db:sync` ever reports a problem, run `npx prisma migrate status` and
send the output; nothing has been changed at that point.

## Running it on your iPhone (for real-world UAT)

The Mac is the server; the iPhone is just a browser pointed at it over
Wi-Fi. Two setups depending on whether you need GPS tracking.

### A. Everything except GPS tracking (plain HTTP)

1. On the Mac:
   ```bash
   npm run build
   caffeinate -i npm start     # caffeinate keeps the Mac from sleeping mid-shift
   ```
2. Note the **Network** URL it prints, e.g. `http://192.168.1.10:3000`
   (same command works for `npm run dev` too, just less optimized).
3. If macOS shows a firewall prompt asking to allow incoming connections for
   `node`, click **Allow**.
4. On the iPhone, **same Wi-Fi network** as the Mac: open that URL in
   Safari, log in.
5. Tap **Share → Add to Home Screen**. Thanks to `public/manifest.webmanifest`,
   it installs as a standalone app (own icon, no browser chrome). Camera
   fields (odometer/receipt photos) open the camera directly.

This covers everything: shifts, trips, screenshot/statement import,
odometer OCR, the dashboard, Plan your day — all of it. Only the **live GPS
tracker** on an active shift needs step B, because browsers refuse
`navigator.geolocation` outside of a secure context.

### B. Enabling GPS tracking too (HTTPS via a local self-signed cert)

One-time setup on the Mac:
```bash
brew install mkcert
mkcert -install
mkcert 192.168.1.10          # use your Mac's actual LAN IP from step A.2
```
This creates `192.168.1.10.pem` and `192.168.1.10-key.pem` in the current
directory, and a local root CA that only your Mac trusts so far.

Run a TLS-terminating proxy in front of the Next.js server (which keeps
serving plain HTTP on 3000 — the proxy just wraps it):
```bash
npx local-ssl-proxy --source 3443 --target 3000 \
  --cert 192.168.1.10.pem --key 192.168.1.10-key.pem
```

Trust the certificate on the iPhone (one-time):
1. AirDrop `$(mkcert -CAROOT)/rootCA.pem` to the phone (or email it to
   yourself and open it there).
2. Install the profile: **Settings → General → VPN & Device Management** →
   tap the downloaded profile → Install.
3. **Settings → General → About → Certificate Trust Settings** → enable full
   trust for the mkcert root certificate.

Now use `https://192.168.1.10:3443` on the phone and **Add to Home Screen**
again from that URL (a separate install from the http:// one). The GPS
toggle on an active shift will work, and the browser will ask for location
permission the first time.

> Both `mkcert` and `local-ssl-proxy` are dev-only tooling for phase-1 UAT on
> your own network. None of this is needed once phase 2 hosts the app on a
> real domain with a real TLS certificate.

## Hosting it online for live testing (free tier)

Phase 1 runs on a Mac; to test on real trips from the car you want it on
the public internet with HTTPS (which also makes GPS tracking work on the
phone without the mkcert dance). The cheapest honest setup, all free tiers:

| Piece | Service | Why |
|---|---|---|
| App (Next.js) | **Vercel Hobby** | Zero-config for Next.js, fast cold starts, HTTPS. Hobby is for non-commercial use — fine for testing; move to Pro ($20/mo) when you start charging. |
| Database | **Neon** (Postgres, free) | 0.5 GB, scales to zero when idle, works with Prisma out of the box. (Supabase free also works but pauses after 7 idle days.) |
| Photos | the server's `/tmp` | Odometer/receipt photos are optional evidence and auto-purged anyway; on Vercel set `UPLOAD_DIR=/tmp/uploads`. Odometer OCR now reads the photo on the phone, so it keeps working. |

Steps (one-time, ~20 minutes):

1. **Switch Prisma to Postgres.** In `prisma/schema.prisma` change
   `provider = "sqlite"` to `provider = "postgresql"`; in `lib/db.ts` swap
   the better-sqlite3 adapter for `@prisma/adapter-pg` (`npm i
   @prisma/adapter-pg pg`; `new PrismaPg({ connectionString })`). Delete
   the `prisma/migrations` folder (it is SQLite dialect) and run
   `npx prisma migrate dev --name init` once against your Neon URL to
   generate Postgres migrations. Commit them.
2. **Neon:** create a project → copy the pooled connection string.
3. **Vercel:** import the GitHub repo. Environment variables:
   `DATABASE_URL` (Neon), `UPLOAD_DIR=/tmp/uploads`. Build command stays
   `next build`; `postinstall` already runs `prisma generate`. Add
   `npx prisma migrate deploy && next build` as the build command so the
   schema is applied on every deploy.
4. Open the URL on your phone, set the passphrase, **Add to Home Screen**
   (it is a PWA), and start a shift.

What degrades on Linux hosting: Apple Vision odometer OCR falls back to
tesseract (worse on LCD dashboards — type the reading if it misreads), and
HEIC photos are not converted (set the iPhone camera to **Most Compatible**
so it shoots JPEG). Everything else — imports, GPS, weeks, analytics — is
unchanged. Full detail in DOCS.md §13.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npx prisma migrate dev` | Apply/create migrations against `data/app.db` |
| `npx prisma studio` | Browse/edit the SQLite database in a GUI |

## Tech stack (short version — full detail in DOCS.md §2)

Next.js 16 + React 19 · Prisma 7 (SQLite via better-sqlite3 now, Postgres via @prisma/adapter-pg later) · Tailwind 4 ·
tesseract.js + Apple Vision for OCR · custom en/ar i18n with RTL.

## Contributing / working on this codebase

Single-maintainer project right now. Before changing anything non-trivial,
read **[DOCS.md](./DOCS.md)** — in particular §5 (the "net-first" money
model is intentional and non-obvious), §6 (any new import source must go
through `lib/importApply.ts`'s dedupe logic), and §12 (known gaps, so you
don't re-discover them the hard way).

No automated test suite yet (§12) — verify changes by running the app and,
for the OCR/parsing libraries under `lib/`, importing them directly in a
throwaway Node script against real sample screenshots/PDFs (they're pure
functions with no DB dependency).

## License

Private project, not yet licensed for redistribution.
