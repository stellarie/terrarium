# 🌱 Terrarium

A self-contained artificial-life world that runs entirely in your browser, with a
three-tier food chain: a living meadow, soft **motes** that graze it, and hot-coloured
**hunters** that chase and eat the motes. Each creature carries a small genome and lives on
an energy economy — grazers seek the greenest ground, and survive a hunter one of two ways:
**fleers** (fast, keen) outrun it in the open, while **hiders** (small, slow) freeze and
vanish into dense vegetation. A third gene, **sociability**, decides how a mote holds itself
among its neighbours — and because the hunter homes on the *densest* prey, the herd learns
that a crowd is a killing ground and evolves to keep its distance (see *The wary herd*). There's
no score and no goal, just selection: leave it running and watch plants, grazers and predators
rise and fall against one another.

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

**Speed**, likewise, is a tradeoff rather than a free ratchet. A fast body is **superlinearly
expensive** to run — a "sprint drag" that costs nothing at ordinary speeds but climbs with the
*square* of the excess once a mote is built for real velocity — so the arms race settles at an
interior optimum instead of slamming its ceiling. Predation still rewards being fast, but each
extra notch of top-end speed now costs more than the last, and the herd stops just short of the
limit. There's a second edge to it: because slow prey are easier to catch, worlds that push their
grazers slowest sometimes tip the whole herd into **hiding** instead of fleeing — the same
fleer-or-hider choice, decided at the scale of an entire world.

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

## The wary herd

Motes also feel their **neighbours**. A heritable **sociability** gene decides how a mote holds
itself in a crowd: steer *toward* the local knot of grazers, or *away* from it. It began as an
experiment in safety-in-numbers — but the world overturned the idea. Because a hunter homes on the
**nearest** prey, a dense crowd is a killing ground, not a shelter: grouping raises your chance of
being the one caught faster than any confusion of numbers lowers it. So under predation the herd
evolves the opposite instinct — **wariness**, keeping its distance from the crowds that draw the
cull — and relaxes back toward indifference only when the hunters thin. You can read it three ways:
a **`herd` chip** in the HUD names the whole herd's temperament at a glance — `wary −0.45` in cool
blue, `sociable` in warm orange, `neutral` in grey — deepening and cooling as a cull presses and
easing back toward neutral in a lull, exactly the way the regime chip reads the predation cycle. Up
close, each mote trails a **heading whisker tinted by its sociability** (cool blue for a wary loner,
warm orange for a joiner, pale for the neutral middle), and the herd's densest knots wear a soft
**shimmer** — the very crowds the hunters pick apart, so you can watch them fray as the herd turns
wary and pool again in a lull. It is a quiet trait in the herd's raw texture (food and flight still
pack the motes together), but a strong one at the gene: another axis, set by the predators, for the
population to move along.

## Watch it evolve

- A **live trait chart** plots the population-average speed, size, sense, **metabolism**, and
  **sociability** over time for **both** species — grazers as solid lines, hunters as dashed
  lines — each normalized to its own genetic range, so the coevolutionary arms race reads on
  both sides at once. Watch **both** sets of curves climb — as the solid grazer lines escalate
  speed, the dashed predator lines now chase them, a genuine reciprocal spiral. The **gold
  metabo line** leans toward greedy (~1.1) in a predator-heavy arms-race and toward thrifty
  (~0.75) in a grazer-haven — you can now *watch* the herd's metabolic character shift with the
  predation cycle, not just read it off individual motes. And the **cool blue social line**
  dives as predation pressure builds and relaxes in a lull — you can watch the herd *learn to
  keep its distance* as a curve, not just read it on the HUD chip. (Earlier versions had
  near-immortal hunters whose curves sat frozen; senescence gave the tier turnover, so its
  genes finally move.)
- A **trophic-cascade chart** plots plants, motes and hunters together — each scaled to its
  own peak, so you can watch a bloom ripple up the food chain with a lag at every tier.
- A **death-balance chart** asks *what is killing the herd right now* — a diverging band that
  swells **warm above the line when the hunters are doing the killing** (top-down, predation)
  and **cool below when hunger is** (bottom-up, starvation). It reads the actual causes of
  death, not a gene, so it tracks the predation cycle honestly: it rides warm while predators
  press the herd and plunges cool during an overgraze die-off, making the boom-bust a colour.
- **Every death leaves a mark, coloured by its cause**, so the whole mortality of the food
  chain reads on the meadow itself — not just in a chart. A **warm ring** bursts where a hunter
  *caught* a mote (predation, sudden); a **cool dot** softly winks out where one *starved*
  (hunger, a quiet giving-out); and a **grey ring** dissipates where an old hunter finally
  *made way* (senescence). Under each mark, a **warm-loam bloom** briefly brightens the ground —
  the body returning to the soil — then fades slowly over the next hundred ticks. Predation is
  by far the loudest, but in an overgrazed die-off the cool starvation dots swell with their loamy
  soil blooms, the steady grey sprinkle of aging hunters is the predator tier visibly **turning
  over**, and in both cases the ground briefly warms where the dead returned, the nutrient cycle
  made visible at a glance without toggling any overlay.
- Every mote is **ringed by its lifestyle** — leaf-green for a committed hider (small, slow),
  amber for a committed fleer (fast), fading toward the ambiguous middle — so the hider/fleer
  divergence predation drives is visible on the field, in every world, at a glance.
- A **morph readout** in the HUD watches whether the grazers are still one gene pool or have
  **split** into two morphs. A detector clusters the live herd and reports "1" for a single
  broad cloud, or e.g. "2 · swift∙slow" when it finds a genuine split — it's deliberately
  strict, so it won't cry "speciation!" over a merely wide spread.
- A **regime readout** names, live, where the world sits in its predator–prey **cycle**:
  predation **surging** (the cull intensifying, coloured red) above the world's own
  baseline, **ebbing** (the herd's reprieve, coloured teal) below it, or **steady** between.
  The baseline is **detrended** — a slope is fit to the world's own history and projected
  forward — so a young world whose predators are simply *establishing* (a slow secular
  climb over its first tens of thousands of ticks) reads **building ↑** rather than a false
  perpetual "surge," and only a genuine departure *from that trend* reads surge or ebb. A
  steadily thinning tier reads **thinning ↓** the same way. It self-calibrates to each
  world, so it carries information whether a world runs 15 hunters or 90. In the rare world
  where the predators genuinely *fail*, it reads **collapsed** outright, and a banner fades
  across the field the moment a tier collapses or claws back — reserved for that dramatic
  event, not the ordinary turn of the cycle.
  (This replaced an older "which of two attractors" readout: the world used to be
  genuinely bistable — predators often starved out — but the nutrient cycle fixed that, and
  a census now shows a *single* persistent-predation attractor, so the honest question is
  "how hard is predation pressing *right now*," not "which of two worlds is this.")
- The **whole meadow's light breathes with the cycle**: a surge stokes a warm, tense,
  close-walled glow, an ebb cools toward a hollow blue-grey, a collapse goes coldest of all,
  and the shift eases in over a few seconds — so the world's *mood* reads at a glance, before
  you even read the HUD chip. It's pure atmosphere (a background lean plus a soft tinted
  vignette); nothing in the ecology reads it back.
- The **HUD** shows tick, motes, hunters, plant biomass, births, and deaths **split by
  cause** — **eaten** (predation), **starved** (hunger), and **aged** (hunters lost to old
  age, so the tier's turnover is a number you can watch climb) — plus the **morph** count,
  the **herd** temperament (mean sociability: `wary` / `neutral` / `sociable`, colour-matched
  to the whiskers), the **regime**, the seasonal growth multiplier, and this world's **seed** — its name.

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
behind a shared DOM/canvas shim (`shim.js`) and runs 101 assertions — the world never throws
or empties, plants persist and evolve, the predator–prey layer stays balanced (hunters
hunt, breed and oscillate without pinning at their cap or wiping the motes out), hunters
**age and turn over** (senescence stays lethal to the ancient), the
concealment mechanic is monotone (a small, slow mote outhides a big fast one in cover, and
nobody hides on bare ground), the morph detector is honest (it calls a single broad cloud one
morph and a clean two-cluster pool two), the regime readout names each predation-cycle phase
correctly (surge / steady / ebb / collapsed) with the right hysteresis **and detrends its
baseline** (a steadily climbing tier reads "steady/building," not a false "surge," while a real
spike above the trend still reads "surge"), **seeded worlds are truly reproducible** (the same seed regrows a
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
**regime** section that names where the world sits in its predation cycle and tallies how
long it spent surging, steady, ebbing or collapsed, and a **matter ledger** that
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
revealed the ecology once had **two regimes**, each world settling into either a predator
arms-race or a predator near-collapse where grazers overgraze the meadow to nothing. A later
run traced the collapse to a **prey-quality death spiral** (few hunters → overgrazed,
energy-poor prey → unprofitable kills) and added hunger-driven boldness as a recovery valve —
and finally the **nutrient cycle** fixed the underlying poverty, so the collapse regime all but
vanished and the world became a *single* persistent-predation attractor (see the census below).

### Count the predation — `--census`

The world used to be genuinely **bistable**, so "how often does a world become an arms-race?"
was a real question — and a *remembered* number, because one unseeded run visits exactly one
regime and a handful of runs isn't a rate. Now that worlds have names it's arithmetic — and the
answer overturned the question. A 24-world census reads a **single mode**: nearly every world is
a persistent arms-race of varying intensity, with genuine predator collapse a rare tail. So the
census was re-pointed at what actually varies now — *how intensely* a world is predated, *how
much* predation oscillates over its boom-bust cycle, and *how often* predators genuinely fail:

```bash
node observe.js --census            # or: node observe.js --census 48 20000
```

It runs N reproducible worlds and reports each one's predation intensity (mean/max hunters), its
within-world oscillation (a CV%), its collapse fraction, and its mean sense, then gives the
verdict. Same arguments → the same table, every time, so a future version of the world can be
measured against today's. The current reading (24 worlds × 12,000 ticks): a **median of ~70
hunters/world** (range ~8–82, one mode with a thin low tail — **not two wells**), and genuine
predator collapse in only **1 of 24 worlds**. "Bistable" was retired: the world is one
attractor now, and reading it as two was reading a world that was quietly dying.

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
hiders. It also reports the **sociability** axis the same paired way, and the result is just as
clean: **every matched pair evolves a warier herd with hunters** (mean sociability negative with
predators, ~neutral without) — so the "predation → wariness" story is a reproducible A/B, not a
remembered one. (What predation does *not* do is make two lifestyles coexist *within one* world —
each world still settles on a single answer. See the journal for that open thread.)

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
| `smoke.js` | headless smoke test — 101 assertions over thousands of real ticks |
| `observe.js` | the observatory — prints readings; `--census` measures predation across worlds, `--split-test` runs the predation experiment, `--frame` renders a PNG |
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
onto the hidden landscape, a conserved **nutrient cycle**, a 101-check headless smoke test, and a headless
**observatory** (`observe.js`) that reports the world's vital signs. Predation selects on the
**sense** gene — a mote's fear radius is its own perception, so keen grazers flee sooner and the
herd's alertness tracks how dangerous its world is. Hunters now carry **home ranges** — each tracks
its personal kill centroid and leans toward it, carving emergent patrol corridors out of the shared
landscape.

Newest: **the dead feed the ground, and now you can see it.** Each death always called `enrich()` to
return body matter to the soil — the nutrient cycle's conservation law, invisible unless you toggled the
soil overlay. Now every death simultaneously pushes a **warm-loam bloom** under its cause-coded mark:
a soft expanding disc in the soil palette (rich amber-brown, the colour of the soil overlay at its
fullest) that expands gently and fades over ~100 ticks, persisting long after the death mark above it
has gone. Three deaths, three paces:
a predation kill-flash fades in ~22 ticks (violent, brief); a starvation dot lingers ~55 ticks
(a quiet giving-out); a senescence ring ~40 ticks. In each case the warm-loam bloom beneath outlasts
the mark, so the ground brightens where something died and slowly returns to neutral — the nutrient
return visible without any overlay. **101 checks** (+2: soil bloom lifetime ≥ 3× kill-flash; starvation
mark lifetime between the two).

Before that: **the predation stalemate has a circuit-breaker.** When the hunter population is large and
the mote population tiny, the world could get stuck in a degenerate loop: hunters ate every prey
cohort within ~18 ticks, the 0→6 reseed net fired, the prey hit 0, 6 motes returned, and the cycle
repeated for thousands of ticks. A secondary safety net now breaks this stalemate — if mote
population stays at or below 10 for **400 consecutive ticks**, 8 motes are added. The delay
distinguishes a genuine crisis from an ordinary deep trough. Two new counters (`world.lowPopTicks`,
`world.nearExtinctEvents`) track when it fires; `observe.js` SAFETY NETS reports them; and two
deterministic `smoke.js` assertions prove the trigger works.

Before that (two runs back): **metabolism now has a history on the chart.** The `metabo` gene — thrifty in a grazer-haven,
greedy in an arms-race — joins the trait chart as a fifth grazer line, drawn in warm gold. Before, a
visitor could read the herd's metabolic character from individual motes (a thrifty mote renders pale,
a fast-burner vivid) but couldn't watch it *evolve* — couldn't see the line lean toward ~1.1 as
predation builds and ease back toward ~0.75 as the hunters thin. Now the gold curve traces it across
the world's history alongside speed, size, sense, and sociability.

Before that (two runs back): **the alarm glows name their hunter.** Each kill-site danger aura — the faint warm glow marking
where a mote was recently caught — is now tinted with that **hunter's own hue** (its heritable colour
gene, always in the warm red-to-amber range). Where one hunter's patrol zone dominates, the alarm
layer glows that individual's shade; where two hunters' territories overlap, the glow shows a mottled
mix of both. What used to be a featureless warm wash is now a colour-coded map of which hunter has
been active where. (Also fixed: after a prey crash, kills slow to near-zero and the alarm ring buffer
would stop refreshing — entries aged past their expiry but sat in the ring uncleared, caught by the
smoke test. A per-tick trim now evicts expired entries as they age out, keeping the ring clean.)

Before that: **each hunter has a home range.** Every predator tracks `homeX, homeY` — an exponential
moving average of where it has made kills. After each catch the centroid shifts toward the kill site,
and every tick the hunter leans gently back toward it, so a corridor where this hunter kills often
becomes the core of its personal patrol range. Applied even while chasing, the pull builds a geographic
habit: the hunter subtly prefers prey near its territory. A faint cross-hair at each centroid makes the
emerging territories visible — watch them slowly separate from one another as habits harden. The kill-
site alarm was simultaneously widened (12→96 sites, ~52 ticks of history instead of ~6) so the alarm
glows can accumulate into a real spatial footprint: territory cores glow warm, refugia stay dark. The
observatory gained a **territory map** — an ASCII density grid of home centroids and a nearest-neighbour
statistic against the uniform-random baseline. Two new smoke checks guard centroid validity. (Expedition
tier — the arc's first spatial predation-pressure gradient.)

Before that: **the hunting grounds have a memory.** When a hunter catches a mote, the kill site is logged
in a rolling ring buffer (`world.killLog`). For the next several hundred ticks, grazers steer *away*
from those coordinates — a collective, heritable spatial memory of danger. The field also glows: each
active kill site emits a faint warm-red aura that fades over time, so the meadow itself shows which
ground has been hot lately, cooling slowly from ember-red to invisible as the fear subsides. Hunting
grounds warm where hunters are active and cool where the herd has pushed them away.

Before that: **the meadow is smooth.** The living ground used to render as a hard-edged 15px tile
mosaic — solid green squares beside sharp black barrens. The vegetation draw path now samples
every 5px and **bilinearly interpolates** between surrounding cell centres, so lush patches
blend into grazed corridors through a soft gradient, the seasonal green→olive pulse ripples
across the field as a wave, and the herd's grazing pressure carves visible gradients into the
grass rather than toggling individual squares on/off. The discrete 64×36 ecology grid is
untouched — only the draw path changed.

Before that: **the wariness axis has a history now.** The `social` gene — the strongest-drifting
gene in the world — joins the trait chart as a fourth grazer line (cool blue, normalized over
its [−1, 1.2] clamp). A visitor who opens the page can now watch the herd's wariness *evolve*
as a curve: the line starts near zero with the founding generation, then dives toward −0.5 as
predation pressure builds and the herd learns to space out, and eases back toward neutral in a
lull. The chip reads the herd's temperament *now*; the chart reads how it got there.

Before that: **the herd's temperament is legible at a glance.** A **`herd` chip** in the HUD
names the whole herd's mean sociability, worded and colour-matched to the per-mote whiskers —
`wary −0.45` in cool blue, `sociable` in warm orange, `neutral` in grey — and `observe.js
--split-test` reports sociability **paired by seed** (3/3 worlds evolve a warier herd with
hunters than without). See *The wary herd* above.

Before that: **the herd learned to keep its distance.** A sixth heritable gene, **sociability**, and
the motes began reacting to *each other* for the first time. It started as an experiment in
safety-in-numbers, and the world refuted it: because a hunter homes on the **nearest** prey, a dense
crowd is a killing ground, not a shelter. So the herd evolves the mirror instinct — **wariness**,
spacing out from the crowds that draw the cull under predation and relaxing back only when the hunters
thin. It's a strong axis at the gene though a quiet one in the herd's raw texture (food and flight
still pack the motes together). See *The wary herd* above for the full picture.

Before that: **the regime readout stopped crying wolf.** Every fresh world spends its first tens of
thousands of ticks with its predator tier *establishing* — a slow, steady climb — and the readout
used to mistake that climb for a perpetual **surge**, leaning the whole meadow's light warm through
minutes of ordinary establishment, because a rising series always sits above its own trailing
average. The baseline is now **detrended**: a slope is fit to the world's own history and projected
forward, so an establishing tier reads **building ↑** (a new, honest state that fires through 40–60%
of a young world's ticks), a receding one reads **thinning ↓**, and only a genuine departure *from
the trend* reads surge or ebb. The bias is measurably gone — the recent-vs-baseline offset now
centres on zero, and a world's down-phases (ebb) are no longer masked by the establishment climb.
The mood tint breathes evenly around the cycle instead of stuck warm; a real boom still warms it,
a real bust still cools it.

Before that: **death is legible now.** For all its talk of an energy economy, the world hid its
dying: a mote simply *vanished*, and the only visible death was the warm kill-flash where a
hunter made a catch. Starvation and — since the hunters were given senescence — the constant
**turnover** of the predator tier happened off-camera, legible only in a chart. No longer:
**every death leaves a fading mark coloured by its cause.** A **warm ring** still bursts where
a mote is *caught* (predation), but now a **cool dot** softly winks out where one *starves*
(hunger), and a **grey ring** dissipates where an old hunter finally *makes way* (senescence).
Predation is the loudest by far (~90% of mote deaths) — but an overgrazed die-off now shows as a
scatter of cool starvation dots, and the steady grey sprinkle of aging hunters is the predator
tier visibly renewing itself. The HUD's single vague "died" tally was split to match — **eaten**,
**starved**, and a new **aged** count — so the mortality the death-balance chart *graphs* now
also plays out, in colour, on the meadow itself.

Earlier still: **the world's light breathes with its cycle now.** For a dozen sessions the regime readout
named which of *two* attractors a world had tipped into — a predator **arms-race** or a
**grazer-haven** collapse. That was honest while the world was quietly dying, because predators often
starved out and a grazer-haven was a real second attractor. The nutrient cycle fixed the dying — and a
24-world census then showed the two wells had become **one**: nearly every world is a persistent
arms-race of varying intensity (median ~70 hunters, one mode with a thin low tail), so the readout had
collapsed to saying the same word about 96% of worlds — dead as information, and the mood tint sat one
warm colour forever. So it was **re-pointed at what actually varies**: where a world sits in its
predator–prey *cycle*. The HUD chip now reads predation **surging** (the cull intensifying), **ebbing**
(the herd's reprieve), or **steady**, judged against that world's own baseline so it works whether a
world runs 15 hunters or 90 — and the whole meadow's light now **warms and cools with the boom-bust**
instead of holding one hue. The rare world where predators genuinely fail still reads **collapsed**
outright, with a banner reserved for that dramatic moment. "Bistable" was retired; the census now
measures predation *intensity* and *collapse rate*, not a two-attractor lottery that no longer exists.

Before that: **the world stopped running down.** Vegetation used to grow out of nothing, at a rate
proportional to the greenery already there — so ground grazed to zero could never recover on its own,
and nothing the herd ate was ever returned. Measured over 40,000 ticks, that was a one-way ratchet:
bare ground climbed **25% → 54%** of the meadow, biomass slid **440 → 149**, and the predator tier
starved out with it (its births fell to *zero* per 1,000 ticks — not because the hunt failed, but
because a kill on a starved meadow isn't worth breeding on). Every population still swung and every
gene still drifted, so the world *looked* alive the whole time it was dying.

Now matter is **conserved**. Plants draw nutrients from a soil bank, and grazers and hunters return
them by feeding, breathing and dying, so a barren is just ground holding everything that starved on
it — and it blooms again. Bare ground now settles at **11–17%** and the whole pyramid still oscillates
at **80,000 ticks**, where the predator tier used to be dead by 30,000. The re-run census made the
scale of the old sickness plain: the predator tier now runs a **median ~70 hunters/world** where the
dying world's census had scattered thin — the "grazer-haven dominance" this project described for a
dozen sessions was the world dying, not the world's nature. A new **soil overlay** shows the nutrient
bank, and `observe.js` gained a **matter ledger** so the defect can never hide again.

Before that: **every world has a name.** The whole simulation draws its randomness from one
seedable generator, so a world is **reproducible**: the same number regrows the same meadow, herd
and collapse, tick for tick. The seed rides in the URL (`#s=…`) and is shown in the HUD, so a world
you like is one copied link away from permanent — and the same machinery gave the project the
instrument it had been missing for a dozen sessions. `node observe.js --census` runs a batch of
named worlds and *measures* them, turning a figure that used to be remembered into one that's
counted. (Its first verdict — 17% arms-race, 83% grazer-haven — was later shown to be a **dying
world** read mid-decay; on the healed world the census reads a single persistent-predation
attractor, and it was re-pointed to measure predation *intensity* rather than a two-attractor
lottery. See the top of this section.) The predation experiment (`--split-test`) is **paired** by
seed too, so its verdict rests on the same world with and without hunters rather than on lucky draws.

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
herd rather than splitting it — each world settles at a single predation intensity, and that intensity
picks a single lifestyle (a fiercely-predated world fills with fast fleers; a rare predator-collapse
world relaxes to slow hiders), so genuine two-morph coexistence *within one world* remains the arc's
open problem (the divergence is real and predation-driven, but it lives *between* worlds). Landing true
coexistence — sustaining both lifestyles under one sky — is the next Expedition.

Earlier in the arc: a **live regime readout** (now re-pointed at the world's predation *cycle* — see
the top of this section) and its **mood tint**; **hunger-driven boldness** gave the predator tier a
recovery valve (a starving hunter turns reckless and flushes pale white-hot), cutting the collapse rate
from ~⅔ to ~⅖; and a **morph detector** clusters the live grazers with a strict valley test. That
detector first **overturned the arc's premise** — splits are driven by **crowding, not predators** — a
refutation this run's concealment experiment independently confirms. See the journal for the full story.
