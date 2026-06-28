# LVRS Trading Journal

A self-contained trading journal for the **LVRS strategy** (Levels · Volume · Regime · Structure). Logs trades, runs the BE-at-1R simulation engine, and surfaces edge analytics.

---

## Features

| View | What it does |
|---|---|
| **Dashboard** | Equity curve, R-distribution, metric cards, recent trades, setup performance |
| **Routine** | Pre-market checklist with readiness ring + session reflection |
| **Trade Log** | Full journal table with filters (period, result, setup, symbol) + slide-out detail drawer |
| **Calendar** | Daily P&L heatmap by month with week totals |
| **Analytics** | Edge by setup, expectancy by ADX regime, psychology diverging bars, P&L by day of week |
| **Settings** | Live-recalculate all trades when you change risk %, TP targets, BE-at-1R level, or ADX thresholds |

**LVRS simulation engine** — applies the BE-at-1R rule automatically:
- Max TP reached < BE-at-R → result is **−1R (Loss)**
- Max TP reached ≥ BE-at-R but below TP → result is **0R (Break-even)**
- Max TP reached ≥ TP → result is **Win**, runner split applied for strong PB+Break setups

**Entry checklist** validates each trade live (Standard Pullback vs Pullback + Breakout, DI condition, RSI condition, entry distance %).

**Excel / CSV import & export** — matches the LVRS spreadsheet column structure.

---

## Option A — Desktop app (.exe)

The app ships as a native Windows desktop app built with [Tauri](https://tauri.app) (~3 MB, uses system WebView2).

**Prerequisites:** [Rust](https://rustup.rs) · [Node.js](https://nodejs.org) · WebView2 (pre-installed on Windows 10/11 via Edge)

```bash
npm install -g @tauri-apps/cli
cd path/to/LVRS-trading-journal
tauri build --no-bundle
```

The exe lands at `src-tauri/target/release/lvrs-trading-journal.exe`. Copy it anywhere and run.

---

## Option B — Browser (local server)

The app uses a native ES module (`xlsx-io.js`) for import/export, which browsers block on `file://`. Serve the `web/` folder:

```bash
cd web/
python -m http.server 8000
```

Then open: `http://localhost:8000/`

> **VS Code:** right-click `web/index.html` → *Open with Live Server*

---

## File structure

```
web/
  LVRS Trading Journal.dc.html   ← entire app (~1530 lines: HTML + CSS + React component)
  support.js                     ← dc-runtime: loads React 18 from CDN, mounts component
  xlsx-io.js                     ← dependency-free XLSX and CSV read/write (ES module)
  index.html                     ← entry point (redirects to the .dc.html)

src-tauri/                       ← Tauri desktop wrapper
  tauri.conf.json
  Cargo.toml
  src/
  icons/
```

No `node_modules` in the web app itself. The only network request at runtime is React 18 from `unpkg.com`.

---

## Getting started

The journal starts empty. Import your trades via **↧ Import** (`.xlsx` or `.csv`) or log them one-by-one with **＋ Log trade**.

---

## Strategy parameters (Settings view)

| Parameter | Default | What it controls |
|---|---|---|
| Initial equity | $10,000 | Base for all risk $ calculations |
| Standard pullback risk | 0.5% | Risk per Standard Pullback trade |
| PB+Break risk | 1.0% | Risk per Pullback+Breakout trade |
| Standard base TP | 2R | Target for Standard Pullback |
| PB+Break base TP / TP1 | 3R | Base target and failed-runner close level |
| Strong runner TP2 | 6R | Runner target when DI spread ≥ 15 and RSI condition met |
| Runner position | 30% | Share of position riding to TP2 |
| BE-at-1R | 1R | Move SL to BE when price hits this R |
| ADX weak / building / healthy | 20 / 25 / 40 | Regime classification thresholds |
| Strong DI difference min | 15 | Minimum DI+ vs DI− spread for strong PB+Break |

---

## Tech

- **React 18** (CDN via dc-runtime — no local install)
- **IBM Plex Sans + IBM Plex Mono** (Google Fonts)
- **dc-runtime** (`support.js`) — reads `<x-dc>` template, evaluates `{{ }}` bindings, re-renders on state change
- **Tauri 2** — desktop wrapper using system WebView2
