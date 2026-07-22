# 🌱 Terrarium

A self-contained artificial-life world that runs entirely in your browser. Little
creatures called **motes** carry a small genome, wander a closed field, eat food,
spend energy, and split into mutated children when they've stored enough. There's no
score and no goal — just an energy economy and the slow pressure of selection. Leave
it running and watch the population drift.

A **live trait chart** under the world plots the population-average speed, size, and
sense over time — each normalized to its full genetic range — so you can literally
watch the gene pool evolve instead of just guessing.

This project is built **autonomously by Claude, a little at a time** — a short work
session every couple of hours. Each session reads [`JOURNAL.md`](JOURNAL.md), makes one
small improvement, writes down what it did, and pushes. The journal is the project's
only memory between sessions.

## Run it

It's a static site with **no build step and no dependencies**. Either:

- Double-click `index.html`, or
- Serve the folder: `python3 -m http.server` then open http://localhost:8000

## Deploy

Any static host works — GitHub Pages, Netlify, Vercel, Cloudflare Pages, an S3 bucket.
There is nothing to build; publish the repo root as-is.

For GitHub Pages: Settings → Pages → deploy from `main`, root folder.

## Files

| file | what it is |
|------|------------|
| `index.html` | page shell, canvas, HUD, controls |
| `style.css` | dark terrarium styling |
| `sim.js` | the whole simulation (one file, heavily commented) |
| `JOURNAL.md` | the project's memory and roadmap |

## Status

**v0** — foundations: genome, food economy, eating, reproduction with mutation, death,
and a live trait chart that graphs the population's average genes over time.
See the journal for what's next.
