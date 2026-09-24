# KYPZERO — Hack The Dark

A cinematic, story-driven 3D horror website for running hackathons.
The story, shot list, world map and architecture are in **[PLAN.md](PLAN.md)**.

**Live:** https://kypzero.pages.dev · **Admin:** https://kypzero.pages.dev/admin

## Stack

- **Frontend:** Three.js + GSAP, no bundler (`public/`)
- **Backend:** Cloudflare Pages Functions with Hono (`functions/api/[[path]].js`)
- **Database:** Cloudflare D1 (SQLite), schema and starter events in `migrations/`
- **Email:** Brevo HTTPS API, sending as kypzerorg@gmail.com

Everything runs on Cloudflare's free plan: no server to keep awake, no card needed.

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in ADMIN_KEY (and BREVO_API_KEY to send real emails)
npm run dev
```

- Site: http://localhost:3000
- Admin: http://localhost:3000/admin, log in with `ADMIN_KEY` from `.dev.vars`
- Skip the intro while developing: http://localhost:3000/?skip (add `#events`, `#about` or `#contact` to land on a section)

Local data lives in a local copy of the database under `.wrangler/`, separate from production.

## Deploying

**Automatic:** every push to `main` runs `.github/workflows/deploy.yml`, which builds, applies new database migrations, and deploys to Cloudflare Pages.
It uses the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

**Manual:** with those two values in your environment, run `npm run deploy`.

## Configuration

Public settings are in `wrangler.toml` under `[vars]`: `MAIL_FROM`, `ORG_EMAIL`, `SITE_URL`, `TIMEZONE`, `TZ_OFFSET`.
Event dates are entered as local times in that timezone (India by default).

Secrets are never committed. In production they are Cloudflare Pages secrets:

```bash
npx wrangler pages secret put ADMIN_KEY --project-name kypzero
npx wrangler pages secret put BREVO_API_KEY --project-name kypzero
```

Locally they go in `.dev.vars` (ignored by git).

## Email (Brevo)

Every registration sends a themed confirmation with a ticket number to the participant, plus a notification to kypzerorg@gmail.com.
Contact messages go to kypzerorg@gmail.com and the sender gets an auto-reply. The free plan allows 300 emails per day.

If Brevo has **Authorised IPs** turned on, emails from your own computer during local development are rejected. Production (Cloudflare) is not affected.
Without `BREVO_API_KEY`, emails are only logged (dry-run).

## Managing events

In `/admin`:
- **Summon** (create), **edit**, **seal/open** and **delete** events
- Set a seat limit and a registration deadline; registration closes automatically when either is hit
- View, search and delete registrations; **export CSV** (all events or one event)
- Read contact messages

New events show up on the Events tab **and are engraved on the 3D monoliths** (up to 10).

## Database

```bash
npx wrangler d1 execute kypzero --remote --command "SELECT name, email, college FROM registrations"
```

To change the schema, add a new file in `migrations/` (e.g. `0002_something.sql`); the deploy applies it.

## Controls

Scroll, keys `1`–`4`, arrow keys, or swipe to move between locations. Click the monoliths, the Eye, and the CRT monitors.
Sound toggle is in the top right.
