# 🌅 Morning Briefing Dashboard

A personalized, daily morning briefing dashboard designed to organize and streamline your day. The dashboard serves as a central hub for daily routines, tasks, and information, keeping everything accessible from one unified interface.

## 🌟 Features

- **🔒 Secure Access**: Protected by Google OAuth, restricting access strictly to authorized user(s).
- **⚡ Quick Links**: One-click access to frequently used applications like Notion, GitHub, Vercel, Figma, Gmail, Calendar, and ChatGPT.
- **🎯 Productivity Tools**:
  - **Daily Focus**: Set your top priority for the day.
  - **Scratchpad**: Quick notes and ideas that persist across sessions.
  - **Habit Tracker**: Daily checklist for routines (water, exercise, reading, etc.).
  - **Pomodoro Timer**: Built-in 25-minute focus sprints with 5-minute break cycles.
- **📊 Real-time Information**:
  - Live Weather updates based on location (powered by Open-Meteo).
  - Name Days (Meniny) tracking for Slovak calendar.
  - Live Currency rates (EUR/USD, CZK, GBP) and Crypto tracker (BTC, ETH).
- **📰 Daily Feed & Integrations**:
  - Daily highlights for World, AI, and Tech/Web Dev news.
  - Display for Notion projects, ongoing tasks, calendar events, and incoming emails.
  - AI-assisted daily suggestions tailored to ongoing tasks.

## 🛠️ Setup & Configuration

To set up the authentication and run this dashboard on your own domain:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services → Credentials**.
3. Create an **OAuth 2.0 Client ID** (Web application).
4. Add your domain (e.g., `https://darkmaster9452.github.io` or `http://localhost`) to the **Authorized JavaScript origins**.
5. Copy the generated Client ID.
6. Open `index.html` and replace the `GOOGLE_CLIENT_ID` constant with your Client ID.
7. Update the `ALLOWED_EMAIL` constant with your Google account email to restrict access manually.

## 🚀 Technologies Used

- **HTML5 / CSS3 / Vanilla JavaScript**: Lightweight, zero-dependency frontend with custom CSS themes and grid layout.
- **Google Identity Services**: Fast and secure authentication.
- **LocalStorage API**: Persistent state management for daily focus, scratchpad notes, and habits tracking without a backend database.
- **External Data APIs**: Open-Meteo API for weather, Frankfurter API for fiat currency, CoinGecko API for cryptocurrency.

## 🤖 Claude Automation

This dashboard is designed to be auto-updated and maintained via Claude, making sure the daily briefings, news cards, tasks, and suggestions represent the latest snapshot of your activities.
