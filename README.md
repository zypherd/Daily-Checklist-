# Daily Checklist

A cozy cafe-themed daily checklist app — single self-contained HTML file, no
build step, no server, no dependencies. Everything (artwork, cat illustrations,
fonts fallback) is embedded directly in the file.

## Use it

Download `index.html` and open it in Chrome or Edge. That's it — it runs fully
offline and saves your tasks/check-offs in the browser's local storage.

## Host it (optional)

If this repo is pushed to GitHub, turning on **GitHub Pages** (Settings →
Pages → Deploy from branch → `main` / root) will serve `index.html` at a public
URL automatically, since GitHub Pages looks for that filename by default.

## Features

- Daily / weekly / "today only" / "upon completion" task scheduling
- Subtasks, categories with custom colors, drag-and-drop reordering
- A rose teacup that fills with latte as you complete tasks
- Illustrated cats that wander the cafe floor and hop up onto the cat tree,
  cat house, toy box, and barstools as you check things off
- Print view (multiple card sizes) for a physical checklist
- "All Tasks & Schedules" overview with inline editing

## Notes for future edits

- Data (tasks/categories/check-offs) is stored per-browser in `localStorage` —
  it does not sync between computers or browsers.
- The file is large (~4 MB) because all artwork is embedded as base64 so it
  works as a single portable file. That's intentional.
