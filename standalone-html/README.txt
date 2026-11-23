================================================================
STR SCORES — STANDALONE HTML WEBSITE PACKAGE
================================================================

Thank you for exporting STR SCORES Standalone Web Edition!
This package contains clean, dependency-free HTML5, CSS3, and modular JavaScript files ready to upload to any static website host without compilation or build steps.

PACKAGE STRUCTURE
-----------------
/index.html                    Main SPA entry point (responsive mobile, tablet, desktop)
/README.txt                    Instructions & deployment guide
/css/styles.css                Complete responsive Obsidian Dark & Light stylesheet
/js/config.js                  Brand identity, asset paths, I18N (EN/AR), public Firebase config
/js/data.js                    32 Simulator clubs, Player Cards catalog, Leagues, Trivia & Games data
/js/api.js                     Real live-score feeds (ESPN Soccer API, TheSportsDB, Reddit/Gaming feeds)
/js/simulator.js               7-Mode Football Match Simulator (0-90+ min, 2D pitch, VAR, Pens, Brackets)
/js/games.js                   10 Playable Football Mini-Games & Player Cards Pack Opener
/js/firebase-sync.js           Optional Firebase Auth & Firestore Cloud Sync module (v10.14.1 CDN)
/js/app.js                     Main SPA router, Scores, News, Community/Chat, Fantasy XI, STR VOTE & Profile
/assets/images/                Local logo, stadium hero banner, news & gaming artwork, supporter avatar

HOW TO RUN LOCALLY
------------------
Option 1 (Recommended — enables ES modules & Firebase Auth/Firestore):
  Open a terminal inside this folder and run any static server:
    python3 -m http.server 8080
    # OR:
    npx serve .
  Then open http://localhost:8080 in Chrome, Safari, Edge, or mobile browser.

Option 2 (Quick Local Preview):
  Double-click index.html to open it directly in your browser. Live Scores, Match Simulator,
  Mini-Games, Player Cards, Fantasy XI, and Local Mode work immediately using localStorage.
  (Note: Browsers block ES module Firebase sync on file:// protocol; use HTTP/HTTPS for cloud sync.)

HOW TO DEPLOY TO STATIC HOSTING
-------------------------------
Upload the ENTIRE contents of this folder (keeping index.html at the root) to:
- Netlify Drop / Netlify Sites
- Vercel Static Deployment
- GitHub Pages
- Cloudflare Pages
- Firebase Hosting
- Apache / Nginx / cPanel public_html

OPTIONAL AI ANALYST BACKEND
---------------------------
The STR AI Analyst page never stores private API keys in static HTML/JS.
To connect it to your STR SCORES Node/Express server (/api/ai/analyze):
  1. Open the "STR AI Analyst" tab inside the website.
  2. Enter your running STR SCORES server URL (e.g. https://your-domain.com) and click Save Backend URL.
  When served directly from the STR SCORES Express server (/standalone), it auto-connects automatically.

REAL DATA FEEDS PRESERVED
-------------------------
- Live Scores & Standings: ESPN Soccer API & TheSportsDB
- Player Registry: TheSportsDB Verified Players API
- Football & Gaming News: ESPN Soccer News & Gaming Community RSS/JSON feeds
- Real-Time Auth, Chat, Friends & Polls: Firebase Authentication & Firestore
================================================================
