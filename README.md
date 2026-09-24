# KYPZERO — Hack The Dark

A cinematic, story-driven 3D horror website for running hackathons.
The story, shot list, world map and architecture are in **[PLAN.md](PLAN.md)**.

## Run it

```bash
npm install
cp .env.example .env   # then fill in the values
npm start
```

- Site: http://localhost:3000
- Admin (control room): http://localhost:3000/admin, log in with `ADMIN_KEY` from `.env`
- Skip the intro while developing: http://localhost:3000/?skip (add `#events`, `#about` or `#contact` to land on a section)

## Going live on Render (free)

The repo deploys as a Render **web service**: build `npm ci`, start `npm start`, health check `/healthz`.
Render's free plan wipes files on every restart and blocks email (SMTP) ports, so two free services handle data and email.

### 1. MongoDB Atlas (permanent data)
1. Sign up at [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) and create a free **M0** cluster.
2. **Database Access** → add a database user with a password.
3. **Network Access** → add IP `0.0.0.0/0` (Render's IPs change).
4. **Connect** → Drivers → copy the `mongodb+srv://...` string, put the user's password in it, and set it as `MONGODB_URI`.

On first start the three starter events from `data/events.json` are copied into the database once.
Without `MONGODB_URI` on Render, the site still runs, but the registration and contact forms are paused so nothing is silently lost.

### 2. Brevo (email over HTTPS, 300 emails/day free)
1. Sign up at [brevo.com](https://www.brevo.com) with **kypzerorg@gmail.com**.
2. **Senders, domains & dedicated IPs** → Senders → add and verify `kypzerorg@gmail.com`.
3. **SMTP & API** → API keys → create a key and set it as `BREVO_API_KEY`.
4. In `/admin`, click **SEND TEST EMAIL**.

## Email when running locally (Gmail)

Locally you can use Gmail instead of Brevo:

1. On **kypzerorg@gmail.com**, turn on **2-Step Verification** at [myaccount.google.com/security](https://myaccount.google.com/security).
2. Create an app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) and paste it into `.env` as `GMAIL_APP_PASSWORD`.
3. Restart and use **SEND TEST EMAIL** in `/admin`.

If neither key is set, emails are only printed in the terminal (dry-run).
Every registration sends a themed confirmation with a ticket number to the participant, and a notification to kypzerorg@gmail.com.

## Managing events

In `/admin`:
- **Summon** (create), **edit**, **seal/open** and **delete** events
- Set a seat limit and a registration deadline; the site closes registration automatically when either is hit
- View, search and delete registrations; **export CSV** (all events or one event)
- Read contact messages

New events show up on the Events tab **and are engraved on the 3D monoliths** (up to 10).

## Configuration (`.env` locally, Environment tab on Render)

| Key | Meaning |
|---|---|
| `PORT` | Server port (Render sets this itself) |
| `SITE_URL` | Public URL, used in email footers |
| `GMAIL_USER` | Address emails are sent from |
| `ORG_EMAIL` | Where notifications go |
| `BREVO_API_KEY` | Brevo API key (email over HTTPS) |
| `GMAIL_APP_PASSWORD` | Gmail App Password (email over SMTP) |
| `MONGODB_URI` | MongoDB connection string; empty = JSON files in `data/` |
| `ADMIN_KEY` | Password for `/admin` |

Never commit `.env`; it is in `.gitignore`.

## Controls

Scroll, keys `1`–`4`, arrow keys, or swipe to move between locations. Click the monoliths, the Eye, and the CRT monitors.
Sound toggle is in the top right.
