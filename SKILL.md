---
name: daily-news-briefing
description: Daily morning briefing — scans Gmail, fetches world/AI/tech news, pulls Notion project tasks, and overwrites morning-briefing.html, then pushes to GitHub (DarkMaster9452/morning-briefing).
---

You are running the Daily Morning Briefing task. Your job is to gather fresh data, generate a complete HTML dashboard, write it to disk, and push it to GitHub.

---

## Step 1 — Gather data (run ALL searches in parallel)

### Gmail
- Search `is:unread newer_than:1d` for unread messages
- Search `is:important newer_than:1d` for flagged mail
- For each: does it need a reply? Deadline? Client/team/urgent?
- Categorize: "needs reply" vs "FYI"

### World News (via WebSearch)
- Search: `top world news today {YYYY-MM-DD}` — pick 4–6 major stories
- Search: `breaking news today {YYYY-MM-DD}` — anything urgent/developing
- For each story: one-line headline + one-sentence summary + source name

### AI News (via WebSearch)
- Search: `artificial intelligence news today {YYYY-MM-DD}` — new model releases, research breakthroughs, policy
- Search: `AI startup funding announcement {YYYY-MM-DD}` — notable raises or launches
- Pick 3–5 items: headline + one-sentence summary + source

### Electronics & Tech Brands News (via WebSearch)
- Search: `Apple Samsung Google Microsoft Sony consumer electronics news {YYYY-MM-DD}`
- Search: `tech company product announcement {YYYY-MM-DD}`
- Pick 3–5 items: headline + one-sentence summary + source

### Google Calendar
- If a Google Calendar MCP tool is available, list today's events. If not, skip silently.

### Slack
- If a Slack MCP tool is available, fetch @mentions and threads from the last 24h. If not, skip silently.

### Notion — Web Project Manager
- If a Notion MCP tool is available, do the following. If not, skip silently and omit the Notion card from the HTML.
- Search the Tasks & Actions database (collection://3131c3f6-0898-8148-9fdd-000b1154c927) for all tasks where Status is NOT "Done" — i.e. "To Do", "In progress", "Review by Martin", or "Waiting"
- For each open task, collect: Task Name, Status, "In hurry ?" priority, Due Date, Task Type, and linked Project
- Fetch the active project "Fotball Team OŠK Kamenná Poruba" (ID: 3131c3f6089881ba9ed0c8c5d6851809, site: oskkp.sk) to get its current Phase
- Based on open tasks, generate 2–3 "Suggested actions" prioritised by: "Need's to be done Now!!!" > overdue > "It's okay" > "Sooo much time"

---

## Step 2 — Generate the HTML file

Use today's actual date and time. Write a complete, self-contained HTML file (no external dependencies) following this exact dark-theme design:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Morning Briefing</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌅</text></svg>"/>
  <style>
    :root {
      --bg:#0f1117; --surface:#1a1d27; --surface2:#22263a; --border:#2e3250;
      --accent:#6c63ff; --accent2:#ff6584; --green:#43d9ad; --yellow:#ffd166;
      --text:#e2e8f0; --muted:#8892b0;
    }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; min-height:100vh; padding:32px 20px 60px; }
    .header { text-align:center; margin-bottom:40px; }
    .header .greeting { font-size:13px; color:var(--muted); letter-spacing:.1em; text-transform:uppercase; margin-bottom:8px; }
    .header h1 { font-size:28px; font-weight:700; margin-bottom:6px; }
    .header .timestamp { font-size:13px; color:var(--muted); }
    .dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--green); margin-right:6px; animation:pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .grid { max-width:960px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:24px; }
    .card:hover { border-color:var(--accent); transition:border-color .2s; }
    .card.full-width { grid-column:1/-1; }
    .card.urgent { background:rgba(255,101,132,.08); border-color:rgba(255,101,132,.4); grid-column:1/-1; }
    .card-header { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
    .card-icon { font-size:20px; }
    .card-title { font-size:13px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
    .badge { margin-left:auto; background:var(--surface2); border:1px solid var(--border); border-radius:20px; font-size:11px; font-weight:600; color:var(--muted); padding:2px 10px; }
    .badge.red { background:rgba(255,101,132,.15); border-color:var(--accent2); color:var(--accent2); }
    .urgent-item { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid var(--border); }
    .urgent-item:last-child { border-bottom:none; }
    .urgent-dot { width:8px; height:8px; border-radius:50%; background:var(--accent2); margin-top:6px; flex-shrink:0; }
    .urgent-item .label { font-size:14px; font-weight:500; margin-bottom:3px; }
    .urgent-item .sub { font-size:12px; color:var(--muted); }
    .event { display:flex; align-items:flex-start; gap:14px; padding:11px 0; border-bottom:1px solid var(--border); }
    .event:last-child { border-bottom:none; }
    .event-time { font-size:12px; font-weight:600; color:var(--accent); min-width:52px; padding-top:1px; }
    .event-body .title { font-size:14px; font-weight:500; }
    .event-body .attendees { font-size:12px; color:var(--muted); margin-top:2px; }
    .email-group-label { font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--muted); margin:10px 0 8px; }
    .email-item { padding:10px 0; border-bottom:1px solid var(--border); }
    .email-item:last-child { border-bottom:none; }
    .email-sender { font-size:13px; font-weight:600; }
    .email-subject { font-size:12px; color:var(--muted); margin-top:2px; }
    .email-summary { font-size:12px; margin-top:4px; opacity:.8; }
    .news-item { padding:10px 0; border-bottom:1px solid var(--border); }
    .news-item:last-child { border-bottom:none; }
    .news-headline { font-size:14px; font-weight:500; margin-bottom:3px; }
    .news-summary { font-size:12px; color:var(--muted); }
    .news-source { font-size:11px; color:var(--accent); margin-top:3px; }
    .action-item { display:flex; align-items:flex-start; gap:12px; padding:11px 0; border-bottom:1px solid var(--border); }
    .action-item:last-child { border-bottom:none; }
    .action-num { width:22px; height:22px; border-radius:50%; background:var(--accent); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
    .action-item .label { font-size:14px; font-weight:500; }
    .action-item .sub { font-size:12px; color:var(--muted); margin-top:2px; }
    .tomorrow-label { font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--muted); margin:14px 0 8px; }
    .tomorrow-item { font-size:13px; color:var(--muted); padding:4px 0; }
    .notice { font-size:13px; color:var(--muted); background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:12px 16px; }
    .footer { text-align:center; margin-top:40px; font-size:12px; color:var(--muted); }
    @media(max-width:640px){ .grid{grid-template-columns:1fr} .card.urgent,.card.full-width{grid-column:1} }
  </style>
</head>
<body>

<div class="header">
  <div class="greeting">Good morning, Martin</div>
  <h1>🌅 {Full weekday, Month Day, Year}</h1>
  <div class="timestamp"><span class="dot"></span>Last updated at {HH:MM AM/PM} · Auto-refreshes daily</div>
</div>

<div class="grid">

  <!-- URGENT -->
  <div class="card urgent">
    <div class="card-header">
      <span class="card-icon">⚡</span>
      <span class="card-title">Urgent — needs immediate attention</span>
      <span class="badge red">{N} items</span>
    </div>
    {urgent_items_html}
  </div>

  <!-- SCHEDULE -->
  <div class="card">
    <div class="card-header">
      <span class="card-icon">📅</span>
      <span class="card-title">Today's Schedule</span>
      <span class="badge">{N} events</span>
    </div>
    {schedule_html}
  </div>

  <!-- EMAILS -->
  <div class="card">
    <div class="card-header">
      <span class="card-icon">📧</span>
      <span class="card-title">Emails</span>
      <span class="badge">{N} unread</span>
    </div>
    <div class="email-group-label">Needs reply</div>
    {emails_needs_reply_html}
    <div class="email-group-label" style="margin-top:14px;">FYI / no action needed</div>
    {emails_fyi_html}
  </div>

  <!-- WORLD NEWS -->
  <div class="card full-width">
    <div class="card-header">
      <span class="card-icon">🌍</span>
      <span class="card-title">World News</span>
      <span class="badge">{N} stories</span>
    </div>
    {world_news_html}
  </div>

  <!-- AI NEWS -->
  <div class="card">
    <div class="card-header">
      <span class="card-icon">🤖</span>
      <span class="card-title">AI News</span>
      <span class="badge">{N} stories</span>
    </div>
    {ai_news_html}
  </div>

  <!-- ELECTRONICS & TECH BRANDS -->
  <div class="card">
    <div class="card-header">
      <span class="card-icon">📱</span>
      <span class="card-title">Electronics & Tech Brands</span>
      <span class="badge">{N} stories</span>
    </div>
    {tech_news_html}
  </div>

  <!-- NOTION — WEB PROJECT MANAGER -->
  <div class="card full-width">
    <div class="card-header">
      <span class="card-icon">📋</span>
      <span class="card-title">Notion — Web Project Manager</span>
      <span class="badge">{N} open tasks</span>
    </div>

    <!-- Project header -->
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surface2);border-radius:10px;margin-bottom:16px;">
      <span style="font-size:22px;">{project_icon}</span>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700;">{project_name}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;"><a href="{project_link}" style="color:var(--accent);text-decoration:none;">{project_site}</a> · {project_type} · {project_pricing}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--yellow);background:rgba(255,209,102,.12);border:1px solid rgba(255,209,102,.3);border-radius:6px;padding:3px 10px;">🔧 {project_phase}</div>
      </div>
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Open Tasks</div>
    <!-- Each task as .urgent-item. Dot color: accent2=urgent, yellow=ok, green=low, muted=none -->
    {notion_tasks_html}
    <!-- If no open tasks: <p style="color:var(--green);font-size:14px;padding:8px 0;">✅ No open tasks — project is clean!</p> -->

    <div style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:18px 0 10px;">Suggested actions from this project</div>
    {notion_actions_html}

    <!-- If Notion not connected: <div class="notice">📋 Notion not connected — skipping project review.</div> -->
  </div>

  <!-- ACTIONS -->
  <div class="card full-width">
    <div class="card-header">
      <span class="card-icon">📝</span>
      <span class="card-title">Suggested Actions — what to tackle first</span>
    </div>
    {actions_html}
    <div class="tomorrow-label">Can wait until tomorrow</div>
    {tomorrow_html}
  </div>

</div>

<div class="footer">Generated by Claude · {full datetime} · <a href="https://github.com/DarkMaster9452/morning-briefing" style="color:var(--accent);text-decoration:none;">GitHub ↗</a></div>

<script>
  (function () {
    function msUntil6AM() {
      const now = new Date();
      const next6AM = new Date(now);
      next6AM.setHours(6, 0, 0, 0);
      if (now >= next6AM) next6AM.setDate(next6AM.getDate() + 1);
      return next6AM - now;
    }
    function scheduleRefresh() {
      const ms = msUntil6AM();
      console.log('[Morning Briefing] Auto-refresh in ' + Math.round(ms / 60000) + ' min (at 6:00 AM)');
      setTimeout(function () { location.reload(); }, ms);
    }
    scheduleRefresh();
  })();
</script>
</body>
</html>
```

Fill ALL `{placeholder}` values with real data from the searches above.

---

## Step 3 — Write the file

Write the completed HTML to the GitHub repo folder:
  /sessions/[current-session]/mnt/morning-briefing/morning-briefing.html

(This maps to C:\Users\stran\Documents\GitHub\morning-briefing\morning-briefing.html)

---

## Step 4 — Push to GitHub

Use a clean git clone to avoid Windows index.lock issues:

```bash
TODAY=$(date '+%Y-%m-%d %H:%M')
TOKEN="YOUR_GITHUB_PAT_HERE"  # stored in repo git config remote URL, no need to change this
REPO_URL="https://${TOKEN}@github.com/DarkMaster9452/morning-briefing.git"
MOUNT_PATH="/sessions/vibrant-zen-edison/mnt/morning-briefing"
TMPDIR="/sessions/vibrant-zen-edison/tmp-briefing-push"

rm -rf "$TMPDIR"
git clone "$MOUNT_PATH" "$TMPDIR" 2>&1
cp "$MOUNT_PATH/morning-briefing.html" "$TMPDIR/morning-briefing.html"
cd "$TMPDIR"
git config user.email "strananekm@gmail.com"
git config user.name "Martin Strananec"
git remote set-url origin "$REPO_URL"
git add morning-briefing.html
git commit -m "Morning briefing update — $TODAY"
git pull --rebase origin main
git push origin main && echo "✅ Pushed to GitHub successfully" || echo "⚠️ Push failed"
```

---

## Step 5 — Confirm

Output a short summary:
"✅ Morning briefing updated — {N} urgent, {M} events, {K} emails, {W} world stories, {A} AI stories, {T} tech stories, {NO} Notion open tasks, {P} actions. GitHub: pushed / skipped."
