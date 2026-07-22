# 🌱 Terrarium

A self-contained artificial-life world that runs entirely in your browser, with a
three-tier food chain: a living meadow, soft **motes** that graze it, and hot-coloured
**hunters** that chase and eat the motes. Each creature carries a small genome and lives on
an energy economy — grazers seek the greenest ground, and survive a hunter one of two ways:
**fleers** (fast, keen) outrun it in the open, while **hiders** (small, slow) freeze and
vanish into dense vegetation. There's no score and no goal, just selection: leave it running
and watch plants, grazers and predators rise and fall against one another.

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
again. Grazers, in turn, have **two ways to survive** — and a mote's genes decide which it can use.
A **fleer** (fast, keen) spots a hunter within its **sense** range and sprints directly away
at an energy cost; because keener, faster motes spot the threat sooner and outrun it,
predation selects on **sense** and **speed**. A **hider** (small, slow) does the opposite:
standing on dense vegetation it is hard for a hunter to see or to catch, so when a predator
nears it **freezes** and melts into the meadow rather than bolting. The trade-off that makes
this a real choice is that **speed breaks cover** — a moving body is conspicuous — so a mote
cannot be both a fleer and a hider; it must specialise. Each mote wears a **halo of its
lifestyle**: leaf-green for a hider, amber for a fleer. Which one a world evolves is set by
its predators — a fierce **arms-race** world fills with fast amber fleers, while a
**grazer-haven** where the hunters have thinned fills with slow green hiders lurking in cover;
remove the predators entirely and the whole herd relaxes into cheap, slow hiders. In answer,
the hunters **coevolve keener eyes** to find prey that hide.

Predators and prey settle into the classic **phase-lagged cycle**: hunters thrive and thin
the herd, then starve back as prey grows scarce, letting the motes — and the meadow beneath
them — recover, riding on top of the grazer–plant boom and bust.

## Watch it evolve

- A **live trait chart** plots the population-average speed, size, and sense over time for
  **both** species — grazers as solid lines, hunters as dashed lines — each normalized to its
  own genetic range, so the coevolutionary arms race reads on both sides at once. Watch the
  dashed predator curves sit nearly flat (hunters are long-lived and rarely breed, so selection
  barely bites) while the solid grazer curves climb the speed ceiling.
- A **trophic-cascade chart** plots plants, motes and hunters together — each scaled to its
  own peak, so you can watch a bloom ripple up the food chain with a lag at every tier.
- Every mote is **ringed by its lifestyle** — leaf-green for a committed hider (small, slow),
  amber for a committed fleer (fast), fading toward the ambiguous middle — so the hider/fleer
  divergence predation drives is visible on the field, in every world, at a glance.
- A **morph readout** in the HUD watches whether the grazers are still one gene pool or have
  **split** into two morphs. A detector clusters the live herd and reports "1" for a single
  broad cloud, or e.g. "2 · swift∙slow" when it finds a genuine split — it's deliberately
  strict, so it won't cry "speciation!" over a merely wide spread.
- A **regime readout** names, live, which of the world's two attractors you're watching:
  **arms-race** (predators thriving, coloured red) or **grazer-haven** (predators failing,
  coloured green), with **recovering ↑** when a collapsed hunter tier is clawing back. It's
  hysteretic, so it won't strobe on a marginal seed, and when the world *tips* from one
  attractor to the other a labelled banner fades across the top of the field — so the
  bistable phase transition, once invisible, is impossible to miss.
- The **HUD** shows tick, motes, hunters, plant biomass, births, natural deaths, motes
  eaten, the **morph** count, the **regime**, and the current seasonal growth multiplier.

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
behind a shared DOM/canvas shim (`shim.js`) and runs 34 assertions — the world never throws
or empties, plants persist and evolve, the predator–prey layer stays balanced (hunters
hunt, breed and oscillate without pinning at their cap or wiping the motes out), the
concealment mechanic is monotone (a small, slow mote outhides a big fast one in cover, and
nobody hides on bare ground), the morph detector is honest (it calls a single broad cloud one
morph and a clean two-cluster pool two), and the regime readout names each attractor correctly
with the right hysteresis. Because it uses real randomness, run it a few times:

```bash
node smoke.js
```

## Observe it

The smoke test only answers *"is anything broken?"* To ask *"what is the world actually
**doing**?"*, run the **observatory** — it boots the same real `sim.js`, ticks it 20,000 steps,
and prints readings you interpret rather than pass/fail: per-tier population min/max/mean,
safety-net firings, births/deaths/kills per 1,000 ticks, an age histogram, per-gene drift for
**both** species (with edge-of-range flags), a boredom check, coarse ASCII maps of the meadow
and its life, a **gene-pool shape** section — each grazer gene's spread, a histogram, and
the morph detector's verdict, so you can see whether the mean is hiding a split — and a
**regime** section that names which attractor the seed settled in and tallies how long it
spent in each, so the bistability is counted rather than eyeballed.

```bash
node observe.js          # or: node observe.js 50000   (custom tick count)
```

It's how each build session *watches the world before touching it* — and on its first run it
revealed the ecology is **bistable**, settling per-seed into either a predator arms-race or a
predator near-collapse where grazers overgraze the meadow to nothing. A later run traced the
collapse to a **prey-quality death spiral** (few hunters → overgrazed, energy-poor prey →
unprofitable kills) and added hunger-driven boldness as a recovery valve, cutting the collapse
rate from ~⅔ of worlds to ~⅖ and giving the two regimes a populated middle to travel between.

The observatory also runs a dedicated **experiment**: does predation *drive* the hider/fleer
divergence, or would grazers diverge anyway? It runs a batch of worlds with hunters against a
batch with the hunters removed and reports the strategy each evolves:

```bash
node observe.js --split-test          # or: node observe.js --split-test 8 20000
```

The answer is clear: predation pushes the herd hard toward the fleer end (mean grazer speed
~1.9 with hunters vs ~0.9 without), and the fast fleer is **predation-only** — remove the
predators and every world collapses to slow, cheap hiders. (What predation does *not* do is
make two lifestyles coexist *within one* world — the bistability keeps each world on a single
answer. See the journal for that open thread.)

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
| `smoke.js` | headless smoke test — 34 assertions over thousands of real ticks |
| `observe.js` | the observatory — prints readings, and `--split-test` runs the predation experiment |
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
hidden landscape, corpse fertilisation, a 30-check headless smoke test, and a headless
**observatory** (`observe.js`) that reports the world's vital signs. Predation selects on the
**sense** gene — a mote's fear radius is its own perception, so keen grazers flee sooner and the
herd's alertness tracks how dangerous its world is.

Newest (**Arc III — The Great Divergence**): **concealment, and two ways to survive a hunter.**
Grazers used to have exactly one answer to a predator — flee — so the whole herd converged on it.
Now a **small, slow** mote on **dense vegetation** can instead **hide**: it freezes and vanishes
into cover, shrinking a hunter's sight and reach toward it toward zero. Because **speed breaks
cover**, a mote cannot be both a fast fleer and a hidden hider — it must specialise — and every
mote now wears a **halo of its lifestyle** (leaf-green hider ↔ amber fleer), so the divergence is
visible on the field. A new headless experiment (`observe.js --split-test`) proves predation
*drives* the choice: worlds **with** hunters push the herd toward fast fleers (mean speed ~1.9)
while worlds **without** collapse to slow hiders (~0.9), and the fleer lifestyle appears only where
predators exist. The hunters answer by **coevolving keener eyes** to find prey that hide.

The honest result: predation now clearly *sets the grazers' lifestyle*, but it still **unifies** the
herd rather than splitting it — the world's arms-race/grazer-haven **bistability** makes each world
pick a single lifestyle, so genuine two-morph coexistence *within one world* remains the arc's open
problem (the divergence is real and predation-driven, but it lives *between* worlds). Landing true
coexistence — straddling the bistability — is the next Expedition.

Earlier in the arc: a **live regime readout** names which attractor a world is in (red arms-race /
green grazer-haven, **recovering ↑** when a collapsed tier claws back) and banners the moment it
tips; **hunger-driven boldness** gave the predator tier a recovery valve (a starving hunter turns
reckless and flushes pale white-hot), cutting the collapse rate from ~⅔ to ~⅖; and a **morph
detector** clusters the live grazers with a strict valley test. That detector first **overturned the
arc's premise** — splits are driven by **crowding, not predators** — a refutation this run's
concealment experiment independently confirms. See the journal for the full story.
