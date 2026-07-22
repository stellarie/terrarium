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

Because food is now *spatial*, a mote's **sense** gene is its whole perception radius —
"how far can I perceive the world": it follows the vegetation gradient toward the greenest
ground nearby, and (see the predators, below) it spots approaching hunters at that same
range. Selection now pushes against **space**, not just against an abundance dial.

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
**territoriality** keeps their numbers from running away. A well-fed hunter is patient, but a
**starving** one turns reckless — it flushes pale and white-hot, lunges from farther, digests
faster, and sprints to close, snatching poorer but more frequent meals. This *hunger-driven
boldness* is the predators' recovery valve: it lets a collapsed hunter tier claw its way back
instead of dying out, so a nearly-empty predator population you're watching may suddenly climb
again. Grazers, in turn, **flee** — a
mote that spots a hunter within its **sense** range sprints directly away (at an energy
cost). Because keener-sensed motes spot the threat from farther and get more warning to run,
predation now selects on **sense** as well as **speed** — and it does so *conditionally*: in
a predator-rich world the herd evolves keen and twitchy, while in a world where the hunters
collapse the grazers drift blind and complacent, since nothing is left to fear.

Predators and prey settle into the classic **phase-lagged cycle**: hunters thrive and thin
the herd, then starve back as prey grows scarce, letting the motes — and the meadow beneath
them — recover, riding on top of the grazer–plant boom and bust.

## Watch it evolve

- A **live trait chart** plots the population-average speed, size, and sense over time,
  each normalized to its full genetic range, so you can watch the gene pool drift.
- A **trophic-cascade chart** plots plants, motes and hunters together — each scaled to its
  own peak, so you can watch a bloom ripple up the food chain with a lag at every tier.
- A **morph readout** in the HUD watches whether the grazers are still one gene pool or have
  **split** into two morphs. A detector clusters the live herd and reports "1" for a single
  broad cloud, or e.g. "2 · large∙small" when it finds a genuine split — it's deliberately
  strict, so it won't cry "speciation!" over a merely wide spread.
- The **HUD** shows tick, motes, hunters, plant biomass, births, natural deaths, motes
  eaten, the **morph** count, and the current seasonal growth multiplier.

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
behind a shared DOM/canvas shim (`shim.js`) and runs 24 assertions — the world never throws
or empties, plants persist and evolve, the predator–prey layer stays balanced (hunters
hunt, breed and oscillate without pinning at their cap or wiping the motes out), and the morph
detector is honest (it calls a single broad cloud one morph and a clean two-cluster pool two).
Because it uses real randomness, run it a few times:

```bash
node smoke.js
```

## Observe it

The smoke test only answers *"is anything broken?"* To ask *"what is the world actually
**doing**?"*, run the **observatory** — it boots the same real `sim.js`, ticks it 20,000 steps,
and prints readings you interpret rather than pass/fail: per-tier population min/max/mean,
safety-net firings, births/deaths/kills per 1,000 ticks, an age histogram, per-gene drift for
**both** species (with edge-of-range flags), a boredom check, coarse ASCII maps of the meadow
and its life, and a **gene-pool shape** section — each grazer gene's spread, a histogram, and
the morph detector's verdict, so you can see whether the mean is hiding a split.

```bash
node observe.js          # or: node observe.js 50000   (custom tick count)
```

It's how each build session *watches the world before touching it* — and on its first run it
revealed the ecology is **bistable**, settling per-seed into either a predator arms-race or a
predator near-collapse where grazers overgraze the meadow to nothing. A later run traced the
collapse to a **prey-quality death spiral** (few hunters → overgrazed, energy-poor prey →
unprofitable kills) and added hunger-driven boldness as a recovery valve, cutting the collapse
rate from ~⅔ of worlds to ~⅖ and giving the two regimes a populated middle to travel between.

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
| `shim.js` | shared headless DOM/canvas shim so Node can boot the real `sim.js` |
| `smoke.js` | headless smoke test — 24 assertions over thousands of real ticks |
| `observe.js` | the observatory — prints readings of what the world is doing |
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
breath. Live trait and trophic-cascade charts, a toggleable fertility/grazing overlay onto the
hidden landscape, corpse fertilisation, a 24-check headless smoke test, and a headless
**observatory** (`observe.js`) that reports the world's vital signs. Predation selects on the
**sense** gene — a mote's fear radius is its own perception, so keen grazers flee sooner and the
herd's alertness tracks how dangerous its world is.

Newest (**Arc III — The Great Divergence**): **hunger-driven boldness** gives the predator tier a
recovery valve. The world had an ugly habit — it coin-flipped at birth into a *grazer haven* where
hunters bled to a handful and stayed dead, so in ~⅔ of worlds the three-tier food chain was really
a two-tier bare-meadow swarm. Now a starving hunter turns reckless (a wider lunge, faster digestion,
a closing sprint, and a visible pale white-hot flush), snatching just enough poor meals to climb
back; across matched seed batches this cut the collapse rate from ~⅔ to ~⅖ and roughly quintupled
the median predator population, so the arms-race and grazer-haven become **phases the world travels
between** rather than a fate sealed by the founding seed. This also unblocks the arc's centrepiece:
predation can only *drive* a speciation split if predators actually persist, which they now do.

Earlier in the arc, a **morph detector** was added that clusters the live grazers and reports, live,
whether they're one gene pool or have split into two (with a strict valley test so a merely wide
spread doesn't count). On its first readings it **overturned the arc's own premise**: predator-rich
worlds keep the grazers as a *single broad cloud*, and the only genuine splits — along body
**size** — show up in predator-*collapse* worlds where the herd overpopulates and starves.
Speciation here is driven by **crowding, not predators**. See the journal for the full story.
