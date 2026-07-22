# 🌱 Terrarium

A self-contained artificial-life world that runs entirely in your browser. Little
creatures called **motes** carry a small genome, wander a closed field, graze the
plants growing there, spend energy, and split into mutated children when they've stored
enough. There's no score and no goal — just an energy economy and the slow pressure of
selection. Leave it running and watch the population drift.

## The living ground

Food isn't handed out at random anymore — it **grows**. The field is a meadow of
vegetation laid over a fixed **fertility map**, so some regions are naturally lush and
others stubbornly barren. Plants regrow logistically toward each patch's carrying
capacity, **spread** into neighbouring bare cells, and get **grazed down** by the motes
that roam them. Where herds linger, they carve the meadow into bare corridors and
patches; when a mote dies, its corpse fertilises the ground where it fell.

Because food is now *spatial*, a mote's **sense** gene means "how far can I perceive
good grazing": motes follow the vegetation gradient toward the greenest ground nearby.
Selection now pushes against **space**, not just against an abundance dial.

The result is a genuine **boom and bust**: the population blooms, overgrazes the meadow
toward bare earth, crashes in a wave of starvation, and then — as the plants recover —
blooms again. A slow **seasonal cycle** breathes over the top of it, swinging plant
growth between lean winters and abundant summers and tinting the world toward day and
night.

## Watch it evolve

- A **live trait chart** plots the population-average speed, size, and sense over time,
  each normalized to its full genetic range, so you can watch the gene pool drift.
- A **population & plant-biomass chart** tracks the boom and bust directly — motes
  against the green they live on.
- The **HUD** shows tick, motes, plant biomass, births, deaths, and the current seasonal
  growth multiplier.

### See the hidden landscape

The forces driving the boom and bust are mostly invisible — until you toggle the
**overlay** (the `overlay:` button, or press <kbd>O</kbd>). It cycles through two view-only
lenses painted over the meadow:

- **Fertility** — the permanent carrying-capacity bedrock as an indigo→gold heatmap, so you
  can finally see *why* the lush meadows and stubborn barrens sit where they do.
- **Grazing** — a cool→hot wash over the cells the herd has eaten in the last moment,
  revealing the live pressure that carves the corridors.

Each comes with a small labelled gradient key, and neither touches the simulation — they
only read the world and paint it.

Controls: pause, sow a burst of seeds, reseed the whole world, cycle the overlay, and a
speed slider.

## Run it

It's a static site with **no build step and no dependencies**. Either:

- Double-click `index.html`, or
- Serve the folder: `python3 -m http.server` then open http://localhost:8000

## Test it

A dependency-free headless smoke test drives the real `sim.js` for thousands of ticks
behind a tiny DOM/canvas shim and asserts the world never throws, never empties, keeps
plants alive, and actually evolves:

```bash
node smoke.js
```

## Deploy

Any static host works — GitHub Pages, Netlify, Vercel, Cloudflare Pages, an S3 bucket.
There is nothing to build; publish the repo root as-is.

For GitHub Pages: Settings → Pages → Source: GitHub Actions (the included `deploy.yml`
publishes the site).

## Files

| file | what it is |
|------|------------|
| `index.html` | page shell, canvas, HUD, two live charts, controls |
| `style.css` | dark terrarium styling |
| `sim.js` | the whole simulation (one file, heavily commented) |
| `smoke.js` | headless smoke test — DOM/canvas shim + N real ticks + assertions |
| `JOURNAL.md` | the project's memory and roadmap |

## How it's built

This project is built **autonomously by Claude, a little at a time** — a short work
session every couple of hours. Each session reads [`JOURNAL.md`](JOURNAL.md), makes one
coherent improvement to the world, verifies it, writes down what changed, and pushes.
The journal is the project's only memory between sessions.

## Status

**v1** — the living ground: motes graze a spatial, self-propagating vegetation field
grown over a fertility map, following the food gradient by sense; the economy
limit-cycles between bloom and overgrazed crash under a seasonal breath. Live trait and
population/biomass charts, a toggleable fertility/grazing overlay onto the hidden
landscape, corpse fertilisation, and a committed headless smoke test. Next up: predators —
a second species that eats motes, for a three-tier ecology. See the journal for the story.
