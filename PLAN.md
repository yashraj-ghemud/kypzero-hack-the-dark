# KYPZERO — "HACK THE DARK"
### Master plan: story, cinematic script, 3D world, and system architecture

---

## 1. The Concept

A hackathon website that doesn't feel like a website at all. It's a **found-footage horror film you walk into**.
The entire site lives inside one continuous real-time 3D world (Three.js). There are no page loads. Every tab
(Home / Events / About / Contact) is a *location* in that world, and the camera physically travels between them
like a slow, smooth drone shot.

**Tone:** A24 horror meets hacker lore. Slow dread, soft camera moves, flickering fluorescent lights,
one real jump scare, and then a huge, beautiful, terrifying reveal.

**Palette:** void black `#050203` · blood `#b3001b` · ember `#ff3b1f` · bone `#e8dcc8` · phosphor green `#7dffb0` (server LEDs)

**Type:** Cinzel (film titles) · Special Elite (typewriter subtitles) · Share Tech Mono (HUD / terminal) · Rubik Wet Paint (graffiti in the 3D world)

---

## 2. The Lore

> **September 13, 1999 — 03:13 AM.**
> Thirteen hackers went into **Sector Zero**, an underground server facility under the city,
> to kill the Millennium Bug before it killed the world.
> At 03:13 the blast doors sealed behind them.
> None of them ever logged out.
>
> But the servers never stopped running.
> Something in there has been **compiling** for 27 years. And now it's sending invitations.

**KYPZERO** is the collective that answers the signal. Every hackathon is a "ritual".
Registering is "signing the pact". Your confirmation email is "a transmission from Sector Zero".
The giant eye at the center of the void is **THE OBSERVER**: the thing the 13 accidentally built. It watches
everything you do (it literally follows your cursor).

---

## 3. The Intro Film v2: "TAPE 13" (~64 s, skippable)

### The idea
The intro is **the last recovered camcorder tape of Team 13**. Everything is found footage: VHS tracking lines,
a running date stamp (`SEP. 13 1999 03:13:07 AM`), `▶ PLAY`, static, and then `■ NO SIGNAL`. You are not watching
the story. You are **holding the camera**, and the thing in the corridor knows it.

Horror-film rules it follows:
1. **Safety first, then take it away.** A music box, a desk, a friendly "hello?" on a monitor. Then the lullaby slows down and detunes until it dies.
2. **Show it far away before you show it close.** The figure appears under one light, 30 m away.
3. **Lights die one by one, toward you.** Each relay clunk is closer. It is under every light before it dies.
4. **The scare is not where you look.** The monitors tell you to look behind you, and there is nothing there. Then something *drips*, the camera looks **up**, and it's on the ceiling.
5. **Break the camera.** It drops on you and the camera hits the floor with a cracked lens, sideways. You can't run; you can only watch it walk up to you.
6. **Make it personal.** After the tape dies, the screen types **the viewer's real local time and weekday**: *"IT IS 11:41 PM ON A THURSDAY. YOU SHOULD BE ASLEEP."*
7. **The payoff is awe, not relief.** Thirteen of them line the corridor. Their heads snap toward you as you run past. The door opens onto the void; they are already standing on the ritual platform, and the Eye opens.

### The creature ("Marcus", member #13)
- Articulated rig: hunched spine, long neck, **arms that reach past the knees**, 4 long fingers per hand, digitigrade-ish legs.
- Lambert (non-specular) near-black skin with a veined texture. It stays a silhouette in the dark and only shows detail under your torch.
- **Face:** pale cracked skin, black sunken sockets with pin-point white eyes, blood tears, a Glasgow-smile scar, and a **jaw that unhinges** with rows of teeth.
- Poses: stand, ceiling-crawl (belly to the ceiling, head rotated 180°), crouch, walk. Head can snap, twist 90° with bone-crack audio, and jitter violently.
- 13 lighter "watchers" share the rig. Their heads track the camera with sudden snaps.

### The environment (Sector Zero corridor)
Sickly green fluorescent light, wet tiles, a **blood drag trail** running the full length of the corridor to the blast door,
bloody **handprints** on the door, a **pool of blood** under an abandoned workstation (desk, 2 CRTs, keyboard, an office
chair **that keeps spinning by itself**), a wall of scratched **tally marks** ("DAY 9876 — LET US OUT"), a **3×3 CRT monitor wall**,
ceiling pipes, graffiti (THEY'RE STILL CODING, 13, DON'T LOOK BACK, HACK OR BE HACKED, IT COMPILES IN BLOOD, WAKE UP, RUN),
server racks with blinking LEDs, and a red EXIT sign over the door.

### Shot list

| Time | Act | What you see | Camera | Sound |
|---|---|---|---|---|
| 0.0 | **0 · TAPE** | Full-screen static. `▶ PLAY`, `SP · TAPE 13/13`, date stamp. Centre text types: *TAPE 13 OF 13 / RECOVERED FROM SECTOR ZERO — 2026* | handheld | tape motor clunk, hiss |
| 2.4 | | Static tears away with VHS tracking: a desk, a CRT, a chair slowly spinning in half-dead light | | a **music box lullaby** starts, drone |
| 3.0 | | *"The last recording of Team 13."* | | |
| 4.0 | **I · SAFETY** | The desk CRT types by itself: `hello?` … `is someone there?` | lingering on the desk | keyboard clicks from nowhere |
| 5.4 | | *"Thirteen of us came down here to kill the Millennium Bug."* | pans to the corridor | |
| 7.4 | | Walk. Blood drag trail on the floor leads ahead. | dolly with footstep bob | |
| 9.3 | | *"That was nine thousand, eight hundred and seventy-six days ago."* | looks right at the tally-mark wall | |
| 13.0 | | *"The servers won't let us leave."* The **CRT wall** boots tile by tile, each showing an **eye** that follows you. | turns toward the wall | CRT power-on whines |
| 15.0 | | All nine tiles: **WHO IS FILMING?** | | static burst |
| 16.2 | | The lullaby **slows down and detunes**, tiles die one by one | back to the corridor | music box bends and dies |
| 19.0 | **II · LIGHTS OUT** | **A figure** stands under a tube light 28 m away | still | rumble, heartbeat 68 |
| 20.0 | | *"...Marcus? Is that you?"* | | |
| 21.6 | | Its head **tilts 90°**. | | bone crack |
| 22.6 | | **The lights die one by one toward you.** It stands under each one before it dies. A single inverted frame. | frozen | relay clunk ×6, heartbeat 120 |
| 26.4 | | The last light dies, then your torch. **Pitch black.** | handheld sway doubles | only your breathing |
| 27.4 | | The torch flickers back. The corridor is empty. | | |
| 28.2 | | **Every monitor slams on: LOOK BEHIND YOU** | | screen static burst |
| 28.8 | | *look behind you* (whisper) | | whisper pans |
| 29.6 | | **The slow turn.** 3.4 seconds. The chair behind you is spinning again. | yaw 0 → π | breathing speeds up, chair creak |
| 33.9 | | Nothing there. A **drip**. | | drip |
| 34.4 | | **The camera looks up.** It is on the ceiling above you, upside down, head turned backwards toward you. | tilt up | |
| 36.0 | | Its eyes flare and it **skitters** across the ceiling | | bone cracks, clicking limbs |
| 37.0 | **III · THE FLOOR** | **It drops on you.** The camera hits the floor sideways; **the lens cracks**. | bounce to the floor, roll 75° | scream, thud, glass |
| 38.3 | | From the floor you watch it **walk toward you** | locked, dutch angle | footsteps, heartbeat 130 |
| 41.8 | | It **crouches**. Its head tilts to match your broken camera. | | |
| 42.9 | | It **lunges into the lens.** The jaw unhinges, the head jitters, eyes blaze. | FOV punch 60 → 42 | **SCREAM**, sub drop, glitch, red |
| 44.0 | | Tape dies: `■ NO SIGNAL`, static, black | | tape-stop whine |
| 45.6 | **IV · THE INVITATION** | Black. It types **the viewer's real time**: *IT IS 11:41 PM ON A THURSDAY.* | | typing |
| 48.6 | | *YOU SHOULD BE ASLEEP.* | | |
| 51.2 | | **YOU WERE INVITED.** | | |
| 53.6 | | The camera reboots `● REC`. **Red emergency light.** Thirteen figures line the corridor, facing the walls. The monitors say **RUN**. | | alarm, static |
| 54.4 | | **The run.** As you pass each figure, **its head snaps toward you.** | sprint −14 → −97, FOV → 84, shake | bone cracks, rising drone |
| 57.2 | | The blast door, covered in handprints, grinds open | | metal |
| 58.7 | **V · THE OBSERVER** | **White-out** into the void: blood sea, red moon, monoliths, cable tree | glide to the bridge | |
| 58.95 | | The 13 now stand around the ritual platform with their backs to you, facing the sky | | |
| 60.9 | | The **Eye** opens: half, pause, fully | | deep boom |
| 63.3 | | All 13 heads **turn around at once** to look at you | | crack chorus |
| 64.0 | | **KYPZERO / HACK THE DARK**. The site is live. The 13 stay on the platform, and their heads follow you forever. | | ambient |

**After the intro:** if you go idle, the creature can **appear floating in the void next to you** for a second, then glitch away.
Returning visitors can **skip** at any moment; `?skip` jumps straight into the world.

---

## 4. The World Map (every tab is a place)

```
         [ THE OBSERVER — giant eye in the sky ]           (0, 26, -330)
                          ▲
   ☾ red moon             │          ▲ radio tower (CONTACT)   (0, -14→58, -262)
                          │
 [ EVENTS ]  monoliths ◄──┼──► cable tree + CRTs [ ABOUT ]
 (-38,0,-180)       ritual sigil platform        (44,0,-186)
                    (0,0,-160)
                          │  stone bridge with candles
                          │
                   ║ blast door ║  (z = -104)
                   ║  corridor  ║  (intro only)
```

| Tab | Location | What's there | Interaction |
|---|---|---|---|
| **HOME** | End of the bridge, facing the Eye | Giant eye, blood sea reflecting its glow, red moon, sigil platform | Eye follows your cursor, blinks, dilates on hover; click it and it reacts |
| **EVENTS** | The Monolith Circle | Floating black monoliths. **Each event you add in admin is engraved on a monolith** (title, date, status) | Click a monolith to open that event; HTML "case file" cards on the side |
| **ABOUT** | The Cable Tree | Twisted cable trunk rising out of the sea, old CRT monitors hanging from it showing static and messages (HELP, LET US OUT…) | Click a CRT for a glitch burst |
| **CONTACT** | The Signal Tower | Lattice radio tower emitting expanding red rings under the moon | "Send a signal" contact form |

**Navigation:** nav tabs · mouse wheel · keys 1–4 / arrows · touch swipe.
Camera travels on a curved spline with an FOV "breath", a glitch pulse, and a whoosh.

---

## 5. Interaction & Motion Design

- **Custom cursor**: dot + lagging ring + ember particle trail; grows and shows labels (ENTER / OPEN) over clickable things, including 3D objects.
- **Flashlight**: a real 3D spotlight attached to the camera aims where your mouse is. A DOM darkness vignette also follows the cursor.
- **Found-footage HUD**: blinking `● REC`, running timecode, live camera coordinates, signal bars.
- **Post-processing**: bloom, film grain, vignette, chromatic aberration, scanlines, glitch blocks, red tint, flash and blackout, all animated by the story.
- **Micro-motion**: handheld camera sway, mouse parallax, footstep bob, flickering tubes, blinking LEDs, swinging cables and CRTs, bobbing monoliths, rotating sigil, candle flames.
- **UI motion**: panels wipe in with clip-path and staggered reveals, text scrambles, magnetic buttons, 3D tilt on event cards, glitch headings.
- **Creepy extras**: the tab title changes to *"come back…"* when you leave; if you sit idle the Eye blinks and something whispers *"we can see you"*; there's a message in the dev console.
- **Sound**: 100% synthesized with WebAudio (no files): drone, heartbeat, whispers, buzz, stinger, alarm, door, boom, whoosh, UI ticks. Mute toggle is remembered.

---

## 6. Registration Flow ("Signing the Pact")

1. Events tab → click **REGISTER** on a case file (or click the monolith).
2. Modal shows event details plus the form: **Name, Email, Phone, College** and a consent checkbox (*"I understand there is no turning back"*).
3. Client-side validation, then `POST /api/register`.
4. Server validates, checks the deadline, seats, and duplicates, saves the registration, and generates a ticket (`KZ-XXXXXX`).
5. **Email sent from `kypzerorg@gmail.com`** (Gmail SMTP via Nodemailer):
   - To the participant: themed confirmation with ticket, event, date, venue.
   - To `kypzerorg@gmail.com`: a notification with the participant's details.
6. UI shows **PACT SEALED** with the ticket; the Eye blinks; a choir chord plays.

Contact form → `POST /api/contact` → email to `kypzerorg@gmail.com` (reply-to = sender) plus an auto-reply.

---

## 7. Admin ("The Control Room") — `/admin`

- Protected by `ADMIN_KEY` from `.env`.
- Create, edit, and delete events; open or seal registrations.
- Fields: title, tagline, description, date/time, registration deadline, venue, mode, prize, team size, seat limit, tags, status.
- View all registrations, filter by event, search, delete, **export CSV**.
- Mail status banner (live or dry-run) plus a **Send test email** button.
- New events appear instantly on the site **and on the 3D monoliths**.

---

## 8. Architecture

```
hakc/
├── server.js              Express API + static hosting + Nodemailer
├── .env                   GMAIL_USER, GMAIL_APP_PASSWORD, ADMIN_KEY, PORT
├── data/                  JSON storage (events, registrations, messages)
└── public/
    ├── index.html         the experience
    ├── admin.html         control room
    ├── css/style.css      site styles
    ├── css/admin.css
    └── js/
        ├── main.js        bootstrap, gate
        ├── world.js       Three.js world: corridor, figure, door, void, eye, monoliths, tree, tower, camera rig
        ├── shaders.js     eye, blood sea, sky, CRT static, particles, horror post-FX
        ├── textures.js    procedural canvas textures (concrete, tiles, racks, graffiti, sigil, monolith faces, moon)
        ├── intro.js       the GSAP cinematic timeline (section 3)
        ├── audio.js       WebAudio synth engine
        ├── cursor.js      custom cursor + ember trail
        ├── ui.js          navigation, panels, events, modal, forms, subtitles, HUD
        └── admin.js
```

- **Frontend:** Three.js + GSAP, served from `node_modules` with an import map, so there's no build step. All textures and sounds are procedural, so there are zero asset downloads.
- **Backend:** Cloudflare Pages Functions (Hono) with a D1 (SQLite) database; email through the Brevo HTTPS API. Without a Brevo key, emails are logged instead of sent (dry-run).
- **API:**
  - `GET  /api/events`, `GET /api/events/:id`, `GET /api/stats`
  - `POST /api/register`, `POST /api/contact` (validated, rate-limited, honeypot)
  - `GET  /api/admin/check`, `POST/PUT/DELETE /api/admin/events[/:id]`
  - `GET  /api/admin/registrations[.csv]`, `DELETE /api/admin/registrations/:id`, `POST /api/admin/test-mail`

## 9. Performance & Accessibility

- Pixel ratio capped (1.5 desktop, 1 on low-power/mobile); no shadow maps; instanced meshes for racks, LEDs, ribs, debris.
- Shaders are precompiled before the intro so the door reveal doesn't stutter; lights are dimmed rather than removed, so shaders never recompile.
- Skip button during the intro, a warning on the gate, and a mute toggle. Panels are real HTML (selectable, accessible forms).
- If WebGL fails, the site still works with a CSS background.
