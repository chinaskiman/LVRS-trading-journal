# LVRS Trading Journal

A self-contained trading journal for the **LVRS strategy** (Levels · Volume · Regime · Structure). Logs trades, runs the BE-at-1R simulation engine, and surfaces edge analytics — no build step, no backend, no dependencies to install.

![Dashboard](https://img.shields.io/badge/views-6-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

| View | What it does |
|---|---|
| **Dashboard** | Equity curve, R-distribution, metric cards, recent trades, setup performance |
| **Routine** | Pre-market checklist with readiness ring + session reflection |
| **Trade Log** | Full journal table with filters (period, result, setup, symbol) + slide-out detail drawer |
| **Calendar** | Daily P&L heatmap by month with week totals |
| **Analytics** | Edge by setup, expectancy by ADX regime, psychology diverging bars, P&L by day of week |
| **Settings** | Live-recalculate all 18 seed trades when you change risk %, TP targets, BE-at-1R level, or ADX thresholds |

**LVRS simulation engine** — applies the BE-at-1R rule automatically:
- Max TP reached < BE-at-R → result is **−1R (Loss)**
- Max TP reached ≥ BE-at-R but below TP → result is **0R (Break-even)**
- Max TP reached ≥ TP → result is **Win**, runner split applied for strong PB+Break setups

**Entry checklist** validates each trade against your setup rules live as you log it (Standard Pullback vs Pullback + Breakout, DI condition, RSI condition, entry distance %).

**Excel / CSV import & export** — matches the LVRS spreadsheet column structure.

---

## Running locally

The app uses a native ES module (`xlsx-io.js`) for import/export, which browsers block on `file://`. Serve it from a local HTTP server:

```bash
# Python (built-in)
cd "path/to/LVRS-trading-journal"
python -m http.server 8000
```

Then open: `http://localhost:8000/LVRS%20Trading%20Journal.dc.html`

> **VS Code users:** right-click the `.dc.html` file → *Open with Live Server* works too.

---

## File structure

```
LVRS Trading Journal.dc.html   ← entire app (HTML + CSS + React component, ~1550 lines)
support.js                     ← dc-runtime: loads React 18 from CDN, mounts component
xlsx-io.js                     ← dependency-free XLSX and CSV read/write (ES module)
```

No `node_modules`, no bundler, no framework CLI. The only network request at runtime is React 18 from `unpkg.com` (loaded by `support.js`).

---

## Seed data

18 EURUSD trades (May–Jun 2026) are pre-loaded so the app is useful immediately. Import your own trades via **↧ Import** (`.xlsx` or `.csv`) or log them one-by-one with **＋ Log trade**. The seed data is replaced on import.

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

- **React 18** (loaded from CDN via dc-runtime — no local install)
- **IBM Plex Sans + IBM Plex Mono** (Google Fonts)
- **dc-runtime** (`support.js`) — minimal custom runtime that reads the `<x-dc>` template, evaluates `{{ }}` bindings, and re-renders on state changes
- Zero npm packages, zero build step
