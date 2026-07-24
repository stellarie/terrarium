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
that roam them. Where herds linger, they carve the meadow into bare corridors and patches.

### Nothing grows out of nothing

The meadow runs on a **nutrient cycle**, and matter is conserved. Every cell holds a bank of
**soil** as well as its standing crop, and plants can only grow by *drawing that bank down* —
so the meadow is exactly as lush as the ground beneath it is fed. Everything alive pays it
back: a grazer drops part of every bite straight away, breathes matter into the ground it
walks over, and — the whole point — **hands its entire body back when it dies**. A hunter's
kill leaves offal where the mote fell. Nutrients then leach slowly sideways, so a carcass
becomes a spreading patch of richness rather than a single hot cell.

The consequence is a world that can **recover from its own poverty**. Ground grazed to bare
earth isn't dead ground; it's ground holding everything that starved on it, and it greens
again as soon as the herd moves off. Bare cells germinate in proportion to how rich the soil
under them is, so the barrens where a die-off happened are the first places to bloom.

This replaced the world's oldest quiet defect. Vegetation used to be created from nothing and
destroyed into nothing, and growth was proportional to the greenery already present — which
made a grazed-to-zero cell an *absorbing state*. Measured over 40,000 ticks, bare ground
climbed from 25% of the meadow to 54% and never turned back, biomass slid 440→149, and the
predator tier died with it. The world's best drama was a transient of its youth. It isn't
any more: bare ground now settles around 11–17% and the whole pyramid still oscillates at
80,000 ticks.

Because food is now *spatial*, a mote's **sense** gene is its whole perception radius —
"how far can I perceive the world": it follows the vegetation gradient toward the greenest
ground nearby, and (see the predators, below) it spots approaching hunters at that same
range. Selection now pushes against **space**, not just against an abundance dial.

The result is a genuine **boom and bust**: the population blooms, overgrazes the meadow
toward bare earth, crashes in a wave of starvation, and then — as the plants recover —
blooms again. A slow **seasonal cycle** breathes over the top of it, swinging plant
growth between lean winters and abundant summers and tinting the world toward day and
night.

A mote's **metabolism** gene is a real gamble, not just a tax. A faster burner spends more
energy every moment just to live — but it also **digests each bite more thoroughly**, so it
thrives where food is plentiful and starves where it's scarce. That makes a **fast-vs-slow**
split you can watch evolve: a lush **arms-race** meadow (grazers held down by predators, so
plants run rampant) breeds **greedy fast-burners**, while a starving, overgrazed
**grazer-haven** breeds **thrifty slow-burners**. It shows in the motes themselves — a thrifty
grazer renders **pale and washed-out**, a hot fast-burner **vividly saturated** — so you can
read a herd's metabolic character straight off the field.

## The predators

**Hunters** are a second creature that eats motes instead of plants — the top of the food
chain. They're faster and keener-sensed than grazers, drawn as hot-coloured arrowheads that
point where they're charging, and they stalk the nearest mote in range and strike when they
close the gap; a catch leaves a brief expanding **kill-flash**. After a kill a hunter must
**digest** before it can strike again, which gives the herd a refuge, and predator
**territoriality** keeps their numbers from running away. A hunter's **metabolism** is the
same gamble the grazers run: a fast-burner **digests each kill more thoroughly** (more energy
per mote) but pays a higher always-on burn, so the predator tier has its own thrifty-vs-greedy
optimum instead of a gene that only ever decays — though because hunters turn over slowly, that
metabolism drifts far more sluggishly than the grazers' fast, visible split. A well-fed hunter is patient, but a
**starving** one turns reckless — it flushes pale and white-hot, lunges from farther, digests
faster, and sprints to close, snatching poorer but more frequent meals. This *hunger-driven
boldness* is the predators' recovery valve: it lets a collapsed hunter tier claw its way back
instead of dying out, so a nearly-empty predator population you're watching may suddenly climb
again. Hunters also **grow old and die** — past a long prime their death-risk climbs with age — so,
unlike the near-immortal predators of earlier versions, the tier constantly **turns over**: old
hunters give way to mutated young, and you can see it, because an aging hunter is ringed with a
**darkening, weathered rim**. That turnover is what lets the predators' genes actually evolve, so the
arms race finally runs **both ways** rather than grazers escalating against a frozen foe. Grazers, in
turn, have **two ways to survive** — and a mote's genes decide which it can use.
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
  own genetic range, so the coevolutionary arms race reads on both sides at once. Watch **both**
  sets of curves climb — as the solid grazer lines escalate speed, the dashed predator lines now
  chase them, a genuine reciprocal spiral. (Earlier versions had near-immortal hunters whose curves
  sat frozen; senescence gave the tier turnover, so its genes finally move.)
- A **trophic-cascade chart** plots plants, motes and hunters together — each scaled to its
  own peak, so you can watch a bloom ripple up the food chain with a lag at every tier.
- A **death-balance chart** asks *what is killing the herd right now* — a diverging band that
  swells **warm above the line when the hunters are doing the killing** (predation, an arms-race)
  and **cool below when hunger is** (starvation, a food-limited grazer-haven). It reads the actual
  causes of death, not a gene, so it tracks the regime honestly: it rides warm between crashes and
  plunges cool during an overgraze die-off, making the boom-bust visible as a colour.
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
  phase transition, once an invisible coin-flip, is impossible to miss.
- The **whole meadow's light leans with the regime**: an arms-race stokes a warm, tense,
  close-walled glow, a grazer-haven cools and dims toward a hollow blue-grey, and the shift
  eases in over a few seconds — so the world's *mood* reads at a glance, before you even
  read the HUD chip. It's pure atmosphere (a background lean plus a soft tinted vignette);
  nothing in the ecology reads it back.
- The **HUD** shows tick, motes, hunters, plant biomass, births, natural deaths, motes
  eaten, the **morph** count, the **regime**, the seasonal growth multiplier, and this
  world's **seed** — its name.

### Every world has a name

The world is **reproducible**. Each one is grown from a single number, and that number
lives in the address bar as `#s=…`, so **copying the URL hands someone the exact world
you're watching** — the same fertility map, the same founding herd, the same collapse at
the same tick. The **world seed** chip in the HUD shows it; the **new world** button mints
a fresh one and publishes it to the URL. Open the page with no seed and it picks one for
you.

That's not just a share button: it's what lets the world be *studied*. A regime you like
can be summoned on demand instead of waited for, and every headless experiment below can
run the same worlds twice.

### See the hidden landscape

The forces driving the boom and bust are mostly invisible — until you toggle the
**overlay** (the `overlay:` button, or press <kbd>O</kbd>). It cycles through three view-only
lenses painted over the meadow:

- **Fertility** — the permanent carrying-capacity bedrock as an indigo→gold heatmap, so you
  can finally see *why* the lush meadows and stubborn barrens sit where they do.
- **Grazing** — a cool→hot wash over the cells the herd has eaten in the last moment,
  revealing the live pressure that carves the corridors.
- **Soil** — the nutrient bank, spent-violet to rich-loam: the ground's memory of everything
  that has died on it. This is the one to watch after a die-off, because it glows brightest
  exactly where the meadow looks emptiest — rich soil under bare ground is a patch about to
  bloom.

Each comes with a small labelled gradient key, and neither touches the simulation — they
only read the world and paint it.

Controls: pause, sow a burst of seeds, mint a **new world** (a fresh seed, written to the
URL), cycle the overlay, and a speed slider.

## Run it

It's a static site with **no build step and no dependencies**. Either:

- Double-click `index.html`, or
- Serve the folder: `python3 -m http.server` then open http://localhost:8000

## Test it

A dependency-free headless smoke test drives the real `sim.js` for thousands of ticks
behind a shared DOM/canvas shim (`shim.js`) and runs 72 assertions — the world never throws
or empties, plants persist and evolve, the predator–prey layer stays balanced (hunters
hunt, breed and oscillate without pinning at their cap or wiping the motes out), hunters
**age and turn over** (senescence stays lethal to the ancient), the
concealment mechanic is monotone (a small, slow mote outhides a big fast one in cover, and
nobody hides on bare ground), the morph detector is honest (it calls a single broad cloud one
morph and a clean two-cluster pool two), the regime readout names each attractor correctly
with the right hysteresis, **seeded worlds are truly reproducible** (the same seed regrows a
byte-identical world, a neighbouring seed doesn't, and a shared `#s=…` link replays its world),
and the **headless renderer** works end-to-end (it drives the real `draw()` to a valid PNG).
Because it also exercises real randomness, run it a few times:

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
the morph detector's verdict, so you can see whether the mean is hiding a split — a
**regime** section that names which attractor the seed settled in and tallies how long it
spent in each, so the regime is counted rather than eyeballed, and a **matter ledger** that
tracks the world's total nutrients across veg, soil and living bodies.

That last one is the instrument this project most needed and didn't have. Total matter is
conserved by construction, so any *drift* in it is a defect by definition — the ledger prints
the split each way and a blunt verdict (`HOLDING` / `RUNNING DOWN` / `INFLATING`). For most of
the world's life it was quietly running down and nothing could see it: the population still
swung and the genes still moved, so every check reported a healthy, living system while the
meadow thinned underneath it. Now that takes one line to spot instead of a 40,000-tick probe.

```bash
node observe.js                    # or: node observe.js 50000   (custom tick count)
node observe.js 20000 --seed 3     # pin the reading to one named, repeatable world
```

It's how each build session *watches the world before touching it* — and on its first run it
revealed the ecology has **two regimes**, each world settling into either a predator arms-race
or a predator near-collapse where grazers overgraze the meadow to nothing. A later run traced
the collapse to a **prey-quality death spiral** (few hunters → overgrazed, energy-poor prey →
unprofitable kills) and added hunger-driven boldness as a recovery valve, giving the two
regimes a populated middle to travel between.

### Count the regimes — `--census`

For most of this project's life "how often does a world become an arms-race?" was a *remembered*
number, because one unseeded run visits exactly one regime and a handful of runs isn't a rate.
Now that worlds have names, it's arithmetic:

```bash
node observe.js --census            # or: node observe.js --census 48 20000
```

It runs N reproducible worlds, reports each one's settled regime, hunter tier, gene means and
flip count, then gives the verdict. Same arguments → the same table, every time, so a future
version of the world can be measured against today's. The current reading (24 worlds × 12,000
ticks): **17% settle arms-race, 83% grazer-haven — but 28% of all _ticks_ are arms-race and 11
of 24 worlds flip regime at least once.** In other words, reading only the final state badly
undercounts the predators: several worlds spend two-thirds of their life in an arms-race and
still *end* in a grazer-haven.

### Does predation drive the split? — `--split-test`

A dedicated **experiment**: does predation *drive* the hider/fleer divergence, or would grazers
diverge anyway? It runs each seed **twice** — once with hunters, once with them removed — so the
two rows are the *same world* differing only in whether predators exist:

```bash
node observe.js --split-test          # or: node observe.js --split-test 8 20000
```

The answer is clear: predation pushes the herd hard toward the fleer end (mean grazer speed
~1.5–1.9 with hunters vs ~0.8–0.9 without, and **every matched pair** moves that way), and the
fast fleer is **predation-only** — remove the predators and every world collapses to slow, cheap
hiders. (What predation does *not* do is make two lifestyles coexist *within one* world — each
world still settles on a single answer. See the journal for that open thread.)

### See it — render a frame to a PNG

A browser preview can't be composited in an automated session, so for a long time the world's
*look* went unverified. No more: the observatory ships a tiny **dependency-free rasterizer**
(`render.js`) — a real subset of the 2D canvas — that the shim can hand the actual `draw()`, so
one true frame can be encoded to a PNG (hand-rolled, no zlib) and looked at:

```bash
node observe.js --frame world.png                   # a random world
node observe.js --frame world3.png 6000 --seed 3    # world #3, the same picture every time
```

It boots a fresh world, ticks it (default 4,000), seats the regime's warm/cold mood, renders one
real `draw()`, and prints a caption (regime, tier counts, mean hue, lifestyle mix). A trailing
`1` or `2` turns on the fertility/grazing overlay. It images the **world** canvas (not the side
charts) and draws no **text**, but every colour, mote ring, hunter rim and vignette is the real
thing — the same `draw()` the browser runs.

## Deploy

Any static host works — GitHub Pages, Netlify, Vercel, Cloudflare Pages, an S3 bucket.
There is nothing to build; publish the repo root as-is.

For GitHub Pages: Settings → Pages → Source: GitHub Actions (the included `deploy.yml`
publishes the site).

## Files

| file | what it is |
|------|------------|
| `index.html` | page shell, canvas, HUD, the trait / trophic-cascade / death-balance charts, controls |
| `style.css` | dark terrarium styling |
| `sim.js` | the whole simulation (one file, heavily commented) |
| `shim.js` | shared headless DOM/canvas shim so Node can boot the real `sim.js` |
| `render.js` | dependency-free raster canvas + PNG encoder — renders the real `draw()` headlessly |
| `smoke.js` | headless smoke test — 72 assertions over thousands of real ticks |
| `observe.js` | the observatory — prints readings; `--census` measures the regimes, `--split-test` runs the predation experiment, `--frame` renders a PNG |
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
breath. Live trait, trophic-cascade and death-balance charts, a toggleable fertility/grazing/soil overlay
onto the hidden landscape, a conserved **nutrient cycle**, a 72-check headless smoke test, and a headless
**observatory** (`observe.js`) that reports the world's vital signs. Predation selects on the
**sense** gene — a mote's fear radius is its own perception, so keen grazers flee sooner and the
herd's alertness tracks how dangerous its world is.

Newest: **the world stopped running down.** Vegetation used to grow out of nothing, at a rate
proportional to the greenery already there — so ground grazed to zero could never recover on its own,
and nothing the herd ate was ever returned. Measured over 40,000 ticks, that was a one-way ratchet:
bare ground climbed **25% → 54%** of the meadow, biomass slid **440 → 149**, and the predator tier
starved out with it (its births fell to *zero* per 1,000 ticks — not because the hunt failed, but
because a kill on a starved meadow isn't worth breeding on). Every population still swung and every
gene still drifted, so the world *looked* alive the whole time it was dying.

Now matter is **conserved**. Plants draw nutrients from a soil bank, and grazers and hunters return
them by feeding, breathing and dying, so a barren is just ground holding everything that starved on
it — and it blooms again. Bare ground now settles at **11–17%** and the whole pyramid still oscillates
at **80,000 ticks**, where the predator tier used to be dead by 30,000. The re-run census makes the
scale of the old sickness plain: **96% of worlds now settle into a predator arms-race, against 17%
before** — the "grazer-haven dominance" this project described for a dozen sessions was the world
dying, not the world's nature. A new **soil overlay** shows the nutrient bank, and `observe.js` gained
a **matter ledger** so the defect can never hide again.

Before that: **every world has a name.** The whole simulation draws its randomness from one
seedable generator, so a world is **reproducible**: the same number regrows the same meadow, herd
and collapse, tick for tick. The seed rides in the URL (`#s=…`) and is shown in the HUD, so a world
you like is one copied link away from permanent — and the same machinery gave the project the
instrument it had been missing for a dozen sessions. `node observe.js --census` runs a batch of
named worlds and *counts* which regime each settles in, turning a figure that used to be
remembered into one that's measured: **17% of worlds settle into a predator arms-race, 83% into a
grazer-haven — yet 28% of all ticks are arms-race, and 11 of 24 worlds flip between them.** Reading
only a world's final state, it turns out, badly undercounts the predators. The predation experiment
(`--split-test`) is now **paired** by seed too, so its verdict rests on the same world with and
without hunters rather than on a spread of lucky draws.

Also: **the predator has a metabolism, not just a metabolic bill.** The grazers' fast/slow
metabolism was already a real tradeoff, but a hunter's metabo scaled only its burn — pure cost —
so the gene had nowhere to go but its floor, decaying every run. Now a fast-burning hunter
**digests each kill more thoroughly** (the assimilated share of a caught mote scales with the
hunter's metabolism), mirroring the grazers, so the predator tier gets its own thrifty-vs-greedy
interior optimum and the metabolic arms race runs on **both** trophic tiers. The honest limit,
which the observatory made plain: the predator tier turns over ~130× slower than the grazers, so
this gene converges *glacially* — it's a **structural** fix (the axis is correct and two-sided now,
and it stops sliding to the floor) rather than the fast, watchable split the grazers show.

Also: **the world can finally be seen headlessly.** For a long stretch every visual change shipped
"logic-correct, look unknown" — an autonomous session has no composited browser to eyeball. That's over:
a dependency-free **rasterizer** (`render.js`) implements a real subset of the 2D canvas, so the shim can
hand the *actual* `draw()` a pixel buffer and `node observe.js --frame world.png` encodes one true frame to
a hand-rolled PNG. The world is now inspectable from the same `draw()` the browser runs — and looking at it
immediately surfaced honest work (the meadow renders as a blocky 15px mosaic; the warm/cold mood tint reads
only faintly under a full meadow), now on the roadmap.

Also: **the hunters grow old.** The observatory kept catching the predator tier as a near-immortal
**gerontocracy** — hunters had no age-linked mortality, so they neither bred nor died at equilibrium
and their genes sat frozen while the grazers escalated: a one-sided "arms race" against a statue. Now
hunters have **senescence** — past a long prime the death-risk climbs with age — so the tier **turns
over** (median hunter age dropped roughly 11k→3k ticks, ~95% of hunter deaths now old age) and its
genes finally **move**: in an arms-race world hunter speed now climbs to chase the grazers (1.35→2.41
in one pass, where it used to sit flat) — a genuine reciprocal spiral. Aging hunters wear a darkening,
weathered rim, so you can watch the tier renew itself on the field.

Also in **Arc III — The Great Divergence**: **concealment, and two ways to survive a hunter.**
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
herd rather than splitting it — the world's arms-race/grazer-haven **regime split** makes each world
pick a single lifestyle, so genuine two-morph coexistence *within one world* remains the arc's open
problem (the divergence is real and predation-driven, but it lives *between* worlds). Landing true
coexistence — straddling that regime split — is the next Expedition.

Earlier in the arc: a **live regime readout** names which attractor a world is in (red arms-race /
green grazer-haven, **recovering ↑** when a collapsed tier claws back) and banners the moment it
tips; **hunger-driven boldness** gave the predator tier a recovery valve (a starving hunter turns
reckless and flushes pale white-hot), cutting the collapse rate from ~⅔ to ~⅖; and a **morph
detector** clusters the live grazers with a strict valley test. That detector first **overturned the
arc's premise** — splits are driven by **crowding, not predators** — a refutation this run's
concealment experiment independently confirms. See the journal for the full story.
