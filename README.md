# 🌅 My Dashboard

A personal dashboard with four core widgets — page title, NASDAQ-style goal ticker, day ring, and a To Do List (today + plan tomorrow) — plus a **Run Coach** that pulls sleep from Google Fit and runs from Strava, and asks Claude for a daily training note.

## 🌟 Features

- **Goal Ticker** — cycles through today's pending goals every 5s with a slide animation, LED scan-lines, and live `done/total` counter.
- **Day Ring** — a circular progress ring filling from 8 AM → midnight with a 9-stop sun-cycle palette, phase label (Morning / Midday / Afternoon / Evening / Bedtime) and remaining-time readout.
- **To Do List** — TODAY card with streak pill, segmented progress bar, inline edit, drag-reorder, ⚡ queue flag, push-remaining-to-tomorrow, and a PLAN TOMORROW card (read-only checkboxes until 6 AM, otherwise identical).
- **Run Coach (10K in a month)** — three live tiles (last-night sleep, 7-day km, last run) + Claude-generated "today's plan" note explicitly tuned for healthy progression (no pushing through bad sleep, ≤ 10% weekly volume jumps, one hard session/week max).
- **Day boundary at 6 AM**, not midnight — late-night logging still counts as the same day.
- **Local-first state** — all goals live in `localStorage`, no server DB.

## 🛠️ Setup & Configuration

### 1. Google OAuth (login + Gmail/Calendar/Fit scopes)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add your domain (e.g. `https://morning-briefing.vercel.app`) to **Authorized JavaScript origins** and `https://your-domain/api/auth/google` to **Authorized redirect URIs**.
4. In **APIs & Services → Library**, enable: Gmail API, Google Calendar API, Fitness API.
5. Copy the Client ID and replace `GOOGLE_CLIENT_ID` in `index.html`. Update `ALLOWED_EMAIL` to your Google account.
6. After deploy, visit `/api/auth/google-redirect` once to grant scopes (Gmail, Calendar, Fitness sleep + activity). Paste the resulting `GOOGLE_REFRESH_TOKEN` into Vercel env vars.

### 2. Strava (run data)

1. Go to <https://www.strava.com/settings/api>.
2. Click **Create App**. Use any name (e.g. `morning-briefing`), set **Authorization Callback Domain** to your Vercel host (e.g. `morning-briefing.vercel.app` — no scheme, no path).
3. Copy **Client ID** and **Client Secret** → add to Vercel env vars as `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`.
4. After deploy, visit `/api/auth/strava-redirect` once. Approve the scopes (`read,activity:read_all,profile:read_all`). Paste the resulting `STRAVA_REFRESH_TOKEN` into Vercel env vars.

### 3. Amazfit / Zepp sleep via Google Fit bridge

Zepp has no public API. The workaround is to mirror your watch's sleep data into Google Fit, then read it from there using the OAuth scope already wired up above.

1. Install **Health Connect** on your phone (Google's standardized health-data store).
2. Open **Zepp app → Profile → Settings → Add Accounts → Google Fit / Health Connect → grant sleep + activity write access**.
3. Open **Google Fit → settings → ensure Health Connect sync is on**.
4. Wear your watch overnight as usual. Sleep sessions sync to Google Fit within a few hours of waking.

### 4. Claude API (the coach)

1. Get an API key at <https://console.anthropic.com/>.
2. Add to Vercel env vars as `ANTHROPIC_API_KEY`.
3. Coach uses `claude-haiku-4-5` with a 400-token cap per call to keep costs low.

### 🔐 Required Vercel env vars

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client — verifies ID tokens server-side. |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret for refresh-token exchange. |
| `GOOGLE_REFRESH_TOKEN` | Long-lived token from `/api/auth/google-redirect`. |
| `ALLOWED_EMAIL` | The single Google account allowed to read protected `/api/*`. |
| `STRAVA_CLIENT_ID` | Strava OAuth app. |
| `STRAVA_CLIENT_SECRET` | Strava OAuth app. |
| `STRAVA_REFRESH_TOKEN` | Long-lived Strava token from `/api/auth/strava-redirect`. |
| `ANTHROPIC_API_KEY` | Used by `/api/coach` (Claude Haiku 4.5). |
| `BASE_URL` | e.g. `https://morning-briefing.vercel.app` — used to build OAuth redirect URIs. |
| `ALLOWED_ORIGINS` (optional) | Comma-separated extra origins for CORS (same-origin always allowed). |

Without these, the relevant endpoints return `401`.

## 🧠 Coach prompt — what it actually does

When you hit **🧠 Get today's coach note**, the server:

1. Calls `/api/strava` (last 30d activities) and `/api/sleep` (last 7 nights from Google Fit) using the same Authorization header you sent.
2. Compresses the data into a short JSON context (last-night sleep, weekly km, longest run, last run, recent 8 runs with HR / pace).
3. Asks `claude-haiku-4-5` with hard rules: **rest or short walk if sleep < 6h**, ≤ 10% weekly volume jumps, one hard session per week max, walk-run intervals while longest < 5 km, easy after a hard day, restart conservatively after a 4-day break.
4. Returns a ≤ 90-word plain-English paragraph with a 3-6 word headline.

The model never sees your raw refresh tokens — only the derived metrics.

## 🚀 Technologies

- HTML5 / CSS3 / vanilla JS — no build step, no npm, no external CSS.
- Google Identity Services for sign-in.
- Server-side ID-token verification (`api/_auth.js`) gates every personal endpoint.
- Vercel serverless functions for the API layer.
- Strava API, Google Fitness API, Anthropic API.
