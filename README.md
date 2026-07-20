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

- **Vehicle profile** — fuel setup (petrol/CNG/dual), ownership model
  (owned/installment/rented/target-share), auto-computed depreciation.
- **Shifts** — odometer start/end (manually, from photos with automatic
  time+reading extraction, or with live GPS tracking) — this is how the app
  tells ride-hailing km apart from personal km.
- **Trips** — manual net-earnings entry, or imported automatically from a
  weekly statement PDF and/or Earnings Activity screenshots.
- **Fuel, maintenance, expenses, reminders** — all odometer-taggable, all
  with a notes field.
- **Dashboard** — true profit (not gross), fuel economy, cash-owed-to-
  platform reconciliation, on-trip vs. dead vs. personal km, and (once other
  drivers' data exists) a you-vs-others benchmark.
- **Plan your day!** (خطّط يومك) — a heatmap of your best times to drive,
  built from your own logged history.
- **Score this offer!** (قيّم العرض) — screenshot an incoming trip request
  and get an instant profit/km and profit/hour estimate against your own
  average, before you accept.
- **Full English/Arabic UI**, switchable any time, RTL-correct.

## Requirements

- Node.js 20+ and npm
- **macOS**, currently required for two features (both degrade gracefully if
  missing, see [DOCS.md §12](./DOCS.md#12-known-gaps--honest-limitations)):
  odometer-photo OCR (uses Apple's Vision framework) and HEIC→JPEG photo
  conversion (uses `sips`). Everything else is cross-platform.
- Xcode Command Line Tools (`xcode-select --install`) — needed the first
  time odometer-photo OCR runs, so it can compile `tools/vision-ocr.swift`.

## Quick start (local, on your Mac)

```bash
npm install
npx prisma migrate dev     # creates data/app.db (SQLite) + data/uploads/
npm run dev                # http://localhost:3000
```

Open `http://localhost:3000`, set a passphrase on first launch (this is your
local login — there's no email/username in phase 1), then create your
vehicle profile under **السيارة / Vehicle**.

Production-style run on the same machine:
```bash
npm run build
npm start
```

### Environment variables

Only one, already set in `.env` (created for you, not committed):
```
DATABASE_URL="file:../data/app.db"
```

### Resetting all data

```bash
rm -rf data/app.db data/uploads
npx prisma migrate dev
```

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

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npx prisma migrate dev` | Apply/create migrations against `data/app.db` |
| `npx prisma studio` | Browse/edit the SQLite database in a GUI |

## Tech stack (short version — full detail in DOCS.md §2)

Next.js 16 + React 19 · Prisma 6 (SQLite now, Postgres-ready) · Tailwind 4 ·
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
