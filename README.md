# 🌱 Terrarium

A self-contained artificial-life world that runs entirely in your browser, with a
three-tier food chain: a living meadow, soft **motes** that graze it, and hot-coloured
**hunters** that chase and eat the motes. Each creature carries a small genome and lives on
an energy economy — grazers seek the greenest ground and flee predators; hunters stalk the
herd and strike. There's no score and no goal, just selection: leave it running and watch
plants, grazers and predators rise and fall against one another.

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

## The predators

**Hunters** are a second creature that eats motes instead of plants — the top of the food
chain. They're faster and keener-sensed than grazers, drawn as hot-coloured arrowheads that
point where they're charging, and they stalk the nearest mote in range and strike when they
close the gap; a catch leaves a brief expanding **kill-flash**. After a kill a hunter must
**digest** before it can strike again, which gives the herd a refuge, and predator
**territoriality** keeps their numbers from running away. Grazers, in turn, **flee** — a
mote that senses a nearby hunter sprints directly away (at an energy cost), so predation
becomes a second pressure of selection, pushing grazers toward speed and sharper senses.

Predators and prey settle into the classic **phase-lagged cycle**: hunters thrive and thin
the herd, then starve back as prey grows scarce, letting the motes — and the meadow beneath
them — recover, riding on top of the grazer–plant boom and bust.

## Watch it evolve

- A **live trait chart** plots the population-average speed, size, and sense over time,
  each normalized to its full genetic range, so you can watch the gene pool drift.
- A **trophic-cascade chart** plots plants, motes and hunters together — each scaled to its
  own peak, so you can watch a bloom ripple up the food chain with a lag at every tier.
- The **HUD** shows tick, motes, hunters, plant biomass, births, natural deaths, motes
  eaten, and the current seasonal growth multiplier.

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
behind a tiny DOM/canvas shim and runs 20 assertions — the world never throws or empties,
plants persist and evolve, and the predator–prey layer stays balanced (hunters hunt, breed
and oscillate without pinning at their cap or wiping the motes out). Because it uses real
randomness, run it a few times:

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
| `index.html` | page shell, canvas, HUD, the trait & trophic-cascade charts, controls |
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

**v2 — The Predation Era.** A three-tier food chain: motes graze a spatial, self-propagating
vegetation field grown over a fertility map, following the food gradient by sense; **hunters**
chase and eat the motes; and grazers flee. The two cycles interlock into a phase-lagged
predator–prey oscillation riding on the grazer–plant boom and bust, all under a seasonal
breath — balanced to be robust, so neither tier trivially wins. Live trait and trophic-cascade
charts, a toggleable fertility/grazing overlay onto the hidden landscape, corpse fertilisation,
and a committed 20-check headless smoke test. Next up (**Arc III — The Great Divergence**):
make speciation visible as the grazers split into distinct morphs under predation. See the
journal for the story.
