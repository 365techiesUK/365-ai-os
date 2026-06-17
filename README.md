# 365 Techies AI OS — prototype

A real, runnable **browser "desktop"** where customers sign up, get their own saved
profile, and use a built-in **AI assistant** powered by Claude. Think of it as a
tiny operating system that lives in the browser — draggable windows, a taskbar, a
Start menu, and apps (AI Assistant, Notes, Settings, About).

This is a **working prototype**, not finished production software. It proves the
concept end-to-end and is the foundation for a real product.

---

## What works today

- **Sign up / sign in** with email + password (passwords are hashed with scrypt; never stored in plain text).
- **Per-user profile**, saved server-side: your display name, accent colour, wallpaper, notes, tasks, chat history, and which windows you had open (position/size/maximised) — all restored next time you log in.
- **Windowed desktop**: open/close/minimise/**maximise**, drag, **resize**, **edge-snap** (half-screen / maximise), focus ring, taskbar, Start menu.
- **Apps**: AI Assistant, Notes, Tasks, Calculator (safe evaluator, no `eval`), Image Viewer, **Off-Grid** (live Victron VRM dashboard), Settings, Get Help, About.
- **Off-grid power monitoring** — a built-in Victron **VRM** dashboard (battery charge, solar, DC/AC loads, inverter, tanks). Live when `VRM_API_TOKEN` + `VRM_SITE_ID` are set; honest demo data otherwise. Ask the assistant to "open off-grid".
- **Command palette** (`Ctrl`/`⌘`+`K`) and keyboard shortcuts.
- **Agentic AI Assistant** wired to Claude (model `claude-opus-4-8`) via the official Anthropic SDK — it can actually *operate* the desktop (notes, tasks, accent, wallpaper, open/close apps) via tool-use, then shows what it did as action chips + toasts. Runs in a clearly-labelled **demo mode** (same tools via a command matcher) until you add an API key.
- **Lead capture → HubSpot** from a built-in contact form (see below).
- **Installable PWA** with offline shell (service worker; API calls are always live, never cached).

---

## Run it (one-time setup)

You'll need [Node.js](https://nodejs.org/) (v18 or newer).

```bash
cd 365-ai-os
npm install
cp .env.example .env        # then open .env and (optionally) add your ANTHROPIC_API_KEY
npm start
```

Then open **http://localhost:4000** and create an account.

- **No API key?** The desktop, login, profile, Notes and Settings all work; the AI
  Assistant replies in demo mode.
- **To switch the AI on:** put your key from <https://console.anthropic.com/> into
  `.env` as `ANTHROPIC_API_KEY=...` and restart (`npm start`). The console will
  print `AI: LIVE`.

> The server never logs or transmits your key anywhere except to Anthropic's API.
> You add it; the assistant uses it. There are **real per-use costs** to the Claude API.

---

## How it's built

| Piece | What |
|---|---|
| `server.js` | Node + Express. Auth, sessions (httpOnly cookie), a JSON-file data store, an `/api/ai` endpoint that calls Claude with the official `@anthropic-ai/sdk`, and `/api/lead` for contact-form enquiries. |
| `lib/hubspot.js` | Creates/updates a HubSpot contact by email (standard CRM properties only, no deps). |
| `public/` | The desktop UI — `index.html`, `os.css`, `os.js` (vanilla JS window manager + apps), plus `contact.html` (a standalone enquiry form). No build step. |
| `data.json` | Auto-created on first sign-up. Holds users + per-user state. Git-ignored. |

---

## Capture website enquiries into HubSpot

The form at **`/contact.html`** (and the embeddable snippet below) posts to **`POST /api/lead`**,
which upserts a **HubSpot contact** by email. It uses only HubSpot's *standard* default
contact properties (`email`, `firstname`, `lastname`, `phone`, `company`, `message`,
`lifecyclestage=lead`, `hs_lead_status=NEW`) — nothing custom needs to exist in your portal.

**Turn it on — pick one:**

**Option A — Forms API (easiest; no app, no token, no Super Admin).** Works on free HubSpot.
1. In HubSpot: **Marketing → Forms → Create form**, add fields **First name, Last name, Email, Phone, Message**, and publish.
2. Find your **Portal ID** (Hub ID — the number in the account menu / URL) and the form's **GUID** (in the form's embed/share code, or the editor URL).
3. Put both in `.env` (neither is secret) and restart:
   ```
   HUBSPOT_PORTAL_ID=12345678
   HUBSPOT_FORM_GUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

**Option B — Private App token.** Needs Super Admin.
1. **Settings → Integrations → Private Apps → Create a private app** (newer accounts: **Development → Legacy apps**).
2. Scopes **`crm.objects.contacts.read`** + **`crm.objects.contacts.write`**.
3. Copy the **access token** (`pat-…`) into `.env` as `HUBSPOT_PRIVATE_APP_TOKEN=...` and restart.

With neither configured the endpoint runs in **demo mode**: it validates and logs the enquiry
to the console but does **not** send it to HubSpot — so you can test the form safely first.
The startup banner prints which mode is active (`HubSpot: LIVE (Forms API)` / `(Private App token)` / `DEMO`).

Built-in protections: a hidden **honeypot** field drops bots, enquiries are **rate-limited**
per connection, and inputs are length-capped and sanitised.

**Embed on the public website** (static site, different origin): drop the form markup on a
page, point it at the deployed server, and allow that origin to post:

```html
<!-- on the website -->
<script>window.LEAD_ENDPOINT = "https://your-deployed-ai-os.example.com/api/lead";</script>
<!-- ...then the form from public/contact.html (or the standalone /contact.html via an iframe) -->
```

```bash
# in the server's .env
LEAD_ALLOWED_ORIGINS=https://www.365techies.co.uk,https://365techies.co.uk
```

---

## Deploy

It's a standard Node/Express server — host it anywhere that runs **Node 18+**.

**Docker** (`Dockerfile` + `.dockerignore` included):
```bash
docker build -t 365-ai-os .
docker run -p 4000:4000 --env-file .env 365-ai-os
```

**Render.com** — the included `render.yaml` is a one-click blueprint: connect the repo,
then enter your secrets (`ANTHROPIC_API_KEY`, `HUBSPOT_*`, `LEAD_ALLOWED_ORIGINS`) in the
dashboard. Health check is `/api/health`.

**Heroku-style hosts** — a `Procfile` (`web: node server.js`) is included.

The host provides `PORT` (read automatically). Set **`NODE_ENV=production`** so session
cookies are sent `Secure` (HTTPS only).

> ⚠️ **Persistence:** state lives in a JSON file (`data.json`). On containers / Render-free
> the filesystem is **ephemeral**, so accounts reset on redeploy. For real use, attach a
> persistent disk or move to a database (see below).

---

## ⚠️ Prototype limits (the honest bit)

This is a demo to build on, **not** something to put real customers on as-is:

- **Data store is a JSON file**, not a real database — fine for a few test users, not for scale.
- **Security is basic**: scrypt-hashed passwords, httpOnly session cookies, input
  validation, per-connection rate-limiting and per-user AI quotas are in place — but
  there's no email verification, password reset, CSRF hardening, or account lockout yet.
- **No HTTPS / hosting** here — it runs locally. Real customers need a proper host
  (a VPS, or a platform like Render/Fly/Vercel), HTTPS, and security hardening.
- **GDPR**: holding customer accounts means real data-protection responsibilities
  (privacy policy, lawful basis, deletion, breach process) before going live.

## The path to a real product

1. Swap the JSON store for a database (e.g. SQLite → Postgres).
2. Add email verification, password reset, rate-limiting and proper session security.
3. Deploy to an app host with HTTPS; put the Claude key in the host's secret manager.
4. Add the GDPR + privacy pieces.
5. Grow the app set (more "apps" in the desktop), per-customer AI tools, billing.

This prototype is deliberately structured so each of those is an upgrade, not a rewrite.

Built by **365 Techies** — friendly IT support, Bournemouth & Dorset.
