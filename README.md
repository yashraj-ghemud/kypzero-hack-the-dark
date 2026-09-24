# KYPZERO — Hack The Dark

A cinematic, story-driven 3D horror website for running hackathons.
The story, shot list, world map and architecture are in **[PLAN.md](PLAN.md)**.

## Run it

```bash
npm install
npm start
```

- Site: http://localhost:3000
- Admin (control room): http://localhost:3000/admin, log in with `ADMIN_KEY` from `.env`
- Skip the intro while developing: http://localhost:3000/?skip (add `#events`, `#about` or `#contact` to land on a section)

## Turn on real emails (kypzerorg@gmail.com)

Until this is done the server runs in **dry-run** mode: registrations are saved, and emails are only printed in the terminal.

1. Sign in to **kypzerorg@gmail.com** → [myaccount.google.com/security](https://myaccount.google.com/security) → turn on **2-Step Verification**.
2. Open [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), create an app password named `kypzero`, and copy the 16-character code.
3. Paste it into `.env`:
   ```
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   ```
4. Restart the server. The terminal should print `Mail: connected as kypzerorg@gmail.com`.
5. In `/admin`, click **SEND TEST EMAIL**. It should arrive in the kypzerorg inbox.

After that, every registration sends:
- a themed confirmation (with ticket number) **to the participant**, from kypzerorg@gmail.com
- a notification with the participant's details **to kypzerorg@gmail.com**

Contact-form messages go to kypzerorg@gmail.com (reply-to = the sender), and the sender gets an auto-reply.
Gmail allows roughly 500 emails per day from a normal account.

## Managing events

In `/admin`:
- **Summon** (create), **edit**, **seal/open** and **delete** events
- Set a seat limit and a registration deadline; the site closes registration automatically when either is hit
- View, search and delete registrations; **export CSV** (all events or one event)
- Read contact messages

New events show up on the Events tab **and are engraved on the 3D monoliths** (up to 10).

## Configuration (`.env`)

| Key | Meaning |
|---|---|
| `PORT` | Server port (default 3000) |
| `SITE_URL` | Public URL, used in email footers |
| `GMAIL_USER` | Gmail account that sends mail |
| `GMAIL_APP_PASSWORD` | 16-character App Password for that account |
| `ORG_EMAIL` | Where notifications go |
| `ADMIN_KEY` | Password for `/admin` |

## Data

Stored as JSON in `data/`: `events.json`, `registrations.json`, `messages.json`. Back these files up.

## Deploying

Any Node host with a persistent disk works (Render, Railway, a VPS…). Set the `.env` values as environment variables,
point `SITE_URL` at your domain, and run `npm start`. Serverless hosts with read-only file systems (such as Vercel) won't keep the JSON data.

## Controls

Scroll, keys `1`–`4`, arrow keys, or swipe to move between locations. Click the monoliths, the Eye, and the CRT monitors.
Sound toggle is in the top right.
