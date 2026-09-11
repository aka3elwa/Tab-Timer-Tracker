# Tab Timer Tracker⏱️

A lightweight, privacy-first Chrome Extension (Manifest V3) designed for domain-specific active time tracking, idle detection, and session archiving.

---

## Features

- **Targeted Tracking:** Track active time only on your chosen domain or keyword.
- **Smart User Idle Detection:** Pauses counting and updates toolbar badges to `IDLE` when you step away (customizable: 30s, 1m, 2m, 5m, or Off).
- **Dynamic Badge Status:**
  - `ON` (Green) — Actively focused and tracking.
  - `IDLE` (Amber) — Open on target domain but inactive.
  - `⏸` (Amber) — Manually paused.
  - `OFF` (Grey) — Target domain not currently open.
  - Flashes current session time on the badge for 5 seconds every 15 minutes.
- **Session History & Archiving:** Save individual work sessions or let it auto-archive to local history when resetting.
- **Midnight Auto-Reset:** Optional rollover setting that clears the daily counter at 00:00:00.
- **Zero Telemetry:** All data is kept 100% locally via `chrome.storage.local`. No analytics, no remote servers, no third-party tracking.

---

## Installation (Unpacked)

1. Download this repository as a `.zip` and extract it.
2. Open Google Chrome (or any Chromium browser like Brave or Edge).
3. Navigate to `chrome://extensions`.
4. Enable **Developer mode** using the toggle in the top-right corner.
5. Click **Load unpacked** in the top-left corner.
6. Select the extracted project folder.

---

## License

MIT License. Free to use, modify, and distribute.
