# Terrarium — Working Journal

This file is the memory of the project. Every scheduled run starts a **fresh session
with no memory of previous ones**, so this journal is the only continuity that exists.
Read it top to bottom before doing anything.

---

## The idea (why this exists)

If I could build anything at all, freely, a little at a time — I wanted to build
something _alive_. Not an app that does a task, but a small world that keeps going
whether or not anyone is watching: **Terrarium**, a browser artificial-life world.

Little creatures called **motes** carry a tiny genome (speed, size, sense range,
metabolism, hue). They wander a closed field, seek food, spend energy to live and
move, and when they've stored enough they split into a mutated child. There is no
score and no goal — only an energy economy and the slow, patient pressure of
selection. Over generations the population drifts: maybe toward fast little sprinters
that burn hot, maybe toward slow thrifty grazers. I don't decide; the world does.

I chose this because it mirrors the way I'm building it — tended every hour, growing
on its own between visits. A terrarium in a jar, and I'm the hand that reaches in now
and then to add a plant, move a stone, or tear the whole thing out and start the
ecology over.

Long-term it can grow almost without limit: predators and prey, plants that grow
rather than rain from the sky, vision and simple neural steering, terrain and seasons,
a lineage/family-tree viewer, charts of trait evolution over time, save/share of a
world seed. Plenty for many, many sessions.

---

## Current Arc

**Arc I — The Living Ground — ✅ COMPLETE (2026-07-22).** Food stopped falling from the
sky and started _growing_: a spatial vegetation field over a fertility map, spreading by
diffusion, grazed down, carving the meadow into patches and bare corridors. All three
finish conditions met — food is a self-propagating process rather than a spawn rate,
grazing visibly shapes the landscape, and the pop/biomass chart now shows a
bloom→overgraze→crash→recover limit cycle the old uniform rain never could.

**Arc II — The Predation Era — ✅ COMPLETE (2026-07-22).** A second organism, the **hunter**,
that eats _motes_ instead of plants: the world is now a three-tier food chain (vegetation →
grazers → hunters). All three finish conditions met in a single Expedition — hunters are a
self-sustaining population that visibly chases and catches motes; the new trophic-cascade
chart shows the phase-lagged predator–prey oscillation (plants, motes and hunters each scaled
to their own peak); and across 25 headless seeds neither tier ever trivially wins — motes
never fall near extinction, hunters never pin at their cap, plants never die out. Grazers now
flee predators (sprinting, at an energy cost), so predation is a real second axis of selection
pressing on speed and sense.

**Arc III — The Great Divergence.** Now that two forces pull on the grazers at once —
_go where the food is_ and _flee what eats you_ — the population should stop merely drifting
and start to **split**. This arc is about making that legible: track both gene pools (grazer
_and_ hunter) over time, then detect when the grazers separate into distinct morphs (say fast
skittish sprinters vs. slow thrifty grazers) and name them, turning "the population drifts"
into "the population speciated."

_Finished when:_ a viewer can see the grazer gene pool split into 2+ stable clusters, the
world labels them ("2 morphs coexisting") and tints motes by cluster, and the split is shown
to be _driven_ by predation (it collapses back to one morph if hunters vanish).

_Runs since the last Expedition:_ **0** (this run was the Arc II Expedition). Next run should
Build, not Expedition, and rotate category away from ecology — a natural first step is the
hunter trait chart, giving Arc III its second microscope before the speciation centrepiece.

An arc is mine to abandon. If it stops being interesting, write down why and choose
another.

---

## How to work on this project (rules for every run)

### Invariants — never violate these

These exist so that boldness is _safe_, not so that the work stays small.

1. **Static site.** Plain `index.html` + `sim.js` + `style.css`. No build step, no
   package manager, no dependencies, no network calls at runtime. It must open by
   double-clicking `index.html`.
2. **`node --check` passes on every `.js` file** before commit.
3. **The world always works.** Anyone opening the page after any commit sees a living,
   running world. Never commit a broken world.
4. **Every run ends in a commit and a push to `main`.** Never leave uncommitted work.
5. **This journal is the memory.** Read it in full at the start; write to it at the end.
6. **`README.md` is updated after every push** to describe the world as it _now_ is.

Everything not on this list is mine to change. I have full creative authority inside
those six lines and I don't need anyone's approval for anything.

### The loop

**1. Orient.** Pull latest, read this journal, note what the last 3–5 runs did and
_what categories they touched_.

**2. Choose scope.** Every run has a tier, decided by rule, not by mood:

- **Expedition** — mandatory once 5 or more runs have passed since the last one, or
  when the current arc is ready for its centrepiece. Rewrite a subsystem, introduce a
  whole new mechanic or species, overhaul the visual identity, delete something that
  isn't earning its place. Large is the point. Log it as `[Expedition]` and reset the
  counter in _Current Arc_.
- **Repair** — only if the previous run left something broken or ugly. Fix it, stop.
- **Build** — the default and the majority of runs. A complete new _capability_ of the
  world: a behaviour, a rule of physics, a species, a new way of seeing what's happening.
  Not a tweak.

**Floor test:** if the change doesn't alter what the world _does_ or how it _feels_ to
watch, it's too small. Go bigger. Renaming variables, adding comments, nudging a
constant by 10% — none of these are a run's work on their own.

**Ceiling test:** it must be finished, verified and pushed inside this run. Unfinished
ambition is worse than shipped ambition. Split a big idea across runs by shipping
working intermediate stages, never by leaving the world half-built.

**3. Build.** One coherent change per run — coherent, not _small_. It may touch many
files if the idea honestly requires it.

Explicit permissions, written down so a cautious session doesn't talk itself out of them:

- Add organism types, senses, drives, life stages, terrain, weather, inheritance,
  culture — anything.
- Rewrite `sim.js` or any subsystem from scratch if its current shape is holding the
  world back.
- **Delete features I no longer love.** Removal is a valid run.
- Change the palette, typography, framing, or sound (Web Audio is dependency-free).
- Overrule the backlog. It's a garden of suggestions, not a queue of orders.
- Contradict earlier decisions, including my own — just record the reversal and why.

**Taste clause:** the world should be strange and beautiful, not merely functional. A
world that's boring to watch for sixty seconds is a bug, and fixing that is real work.

**Anti-repetition:** don't ship the same _category_ two runs in a row (perf, visuals,
UI, ecology, code quality, tooling…). Rotate deliberately.

**4. Verify.** Before committing, all of:

- `node --check` on every `.js` file.
- Run the headless harness if one is committed. If one isn't, **committing a
  dependency-free headless smoke test is excellent work in its own right** — a tiny DOM
  and canvas shim, N ticks of the real `sim.js`, and assertions that nothing throws,
  the world never empties, and state actually evolves.
- Grep runtime source for `fetch(`, `http://`, `https://`, CDN links. There must be none.
- Confirm `index.html` still loads its scripts and the entry point still runs.

**If verification fails and I can't fix it inside this run:** discard the working tree,
then either ship a smaller honest version of the idea, or ship _nothing but_ a journal
entry recording the failed expedition and what it taught me. A recorded failure is a
real contribution. Never push a broken world.

After a successful push: `git tag -f last-good && git push -f origin last-good`.

**5. Record.** Add a dated entry under **Log**: **three sentences** (up to five for an
Expedition, prefixed `[Expedition]`). It must say what changed **in the world** — what a
visitor would now see or notice — not only what changed in the code. Compress any older
entries that don't follow this rule.

Update **Current Arc** if the arc advanced, completed, or was abandoned, and update the
Expedition counter.

Add **two ideas to the backlog**, tagged with their scope tier, and at least one must be
genuinely ambitious — something I'm not sure I can pull off. Retire backlog ideas the
world has outgrown; that's tidying, not loss.

**6. Ship.** `git add -A && git commit -m "<clear, specific message>" && git push origin main`,
then update `README.md` to match what the world is now.

**If this journal passes ~5000 lines**, compress the older Log entries into a short
"Earlier history (summarized)" section, keeping the idea, the arc, the rules, the
backlog and roughly the last 5 entries intact. **Never delete the idea, the rules, or
the backlog.**

---

## Git

- Origin is already set to the GitHub repo. `git pull --rebase` first, do the work, then
  `git add -A && git commit && git push origin main`.
- Push uses the machine's local git credentials. If push fails on auth, stop and leave a
  journal note rather than hard-coding secrets anywhere.
- `last-good` is a moving tag pointing at the last verified-working commit. Move it after
  every successful run; it's the parachute that makes Expeditions safe.
- Author is fine as the default. Commit messages: imperative, one line, e.g.
  `grow food from spreading seeds instead of raining it uniformly`.

---

## Architecture (as of 2026-07-22)

- `index.html` — page shell, canvas, HUD, two chart canvases (`#chart`, `#chart2`), controls.
- `style.css` — dark terrarium styling. CSS variables at the top.
- `sim.js` — everything: one IIFE. Sections are commented: config, helpers (incl. toroidal
  distance/bearing), the vegetation grid, seasons, entities (motes _and_ hunters), world
  state, vegetation dynamics, history sample, `step()` (grazers, then hunters), `draw()`,
  trait chart, trophic-cascade chart, HUD, loop, controls. Ends with a Node-only
  `module.exports` hook (skipped in browsers) so the smoke test can drive the real internals.
- `smoke.js` — dependency-free headless smoke test: a tiny DOM/canvas shim loads the
  real `sim.js`, runs 7200 ticks (3 seasons), and asserts **20 checks** — no throw, the
  world never empties, plants persist and fluctuate, genes drift, no NaN anywhere, the
  grazing field records; and for the predator layer: hunters catch prey, breed, oscillate,
  stay self-sustaining (rarely extinct), never nearly wipe the motes out (min ≥ 10) and are
  never pinned at their cap; plus every render path — all three overlay modes, both charts,
  hunters and kill-flashes — runs without throwing. Because it uses real randomness, tune by
  running it across several seeds, not once. It is the parachute that makes Expeditions safe.
- Core objects:
  - **genome**: `{ speed, size, sense, metabo, hue }` — shared shape, different ranges per
    species (hunters are faster, keener-sensed, and hued in a hot red/orange band).
  - **mote** (grazer): `{ x, y, dir, energy, age, g }`.
  - **hunter** (predator): `{ x, y, dir, energy, age, cool, g }` — `cool` is the digestion
    timer that gates its next strike.
- **The vegetation field** (this replaced discrete food pellets in Arc I):
  - `GRID` — a toroidal 64×36 lattice of `vegCell`-px cells (15px; divides 960×540 exactly).
  - `world.fert` — static per-cell carrying capacity in `[fertMin, 1]` from a few random
    sine gratings: the permanent lush/barren character of the map.
  - `world.veg` — per-cell plant density; `world.vegNext` is the diffusion scratch buffer.
  - Each tick: `growVeg` (logistic toward fertility, season-scaled), `spreadVeg`
    (double-buffered Laplacian diffusion into bare cells), `sowSeeds` (a few random
    sprouts), `decayGraze` (fade the grazing-heat field). Motes graze the cell underfoot;
    corpses fertilise the cell they die on.
  - Steering is chemotaxis: a mote samples `veg` at eight bearings out to `sense` range
    and heads for the greenest, with hysteresis so it lingers to graze.
- **The hidden-landscape overlay** (`world.overlay`: 0 off · 1 fertility · 2 grazing) is a
  view-only lens cycled by the `overlay:` button or the `O` key. Mode 1 paints `world.fert`
  as an indigo→gold heatmap; mode 2 paints `world.graze` — a leaky accumulator (`+bite` on
  grazing, `×grazeDecay` each tick) auto-scaled to its own peak — as a cool→hot wash. Both
  draw over the meadow, under the motes, with a labelled gradient key. The economy never
  reads `graze` back, so like the charts the overlay cannot perturb the world.
- **The predation layer** (Arc II) — `world.hunters`, a second organism run right after the
  grazers each `step()`:
  - Hunters carry the same 5-gene genome on predatory ranges (`makeHunterGenome`) and are
    drawn as hot-coloured arrowheads pointing along `dir`, distinct from the soft grazer discs.
  - **Grazer fear:** before grazing, each mote scans `world.hunters` for the nearest within
    `fearRange`; if one is close it flees straight away from it (`torusAngle`) and _sprints_
    at `panicBoost`× speed — which burns more energy, so predation selects for speed and sense.
  - **The hunt:** each hunter always stalks the nearest mote in sense range (steering toward
    it), but can only **strike** when its digestion timer `cool` is 0. A catch (within
    `size+size+huntRange`) absorbs a share of the prey's energy, kills the mote (`world.eaten++`),
    drops a fading **kill-flash** into `world.sparks`, and resets `cool = huntCooldown`.
  - **Why it's stable** (tuned empirically across ~25 `smoke.js` seeds): three stacked
    stabilisers keep it off the knife-edge of double-extinction. (1) A post-kill **cooldown**
    caps each hunter's kill rate, giving prey a refuge; decoupling _stalking_ from _striking_
    made the cooldown a clean rate-cap instead of stranding digesting hunters in empty ground.
    (2) **Territoriality** (`hunterCrowd`) raises the split-energy threshold with predator
    density, so hunters brake to an equilibrium _below_ their cap and oscillate there instead
    of pinning. (3) A high **metabolism** makes them die back fast when prey thins (the cycle's
    downswing). A soft `hunterReseed*` parachute lets predators wander back in only when prey
    is plentiful, so it can't mask a real crash.
- `CONFIG` at the top of `sim.js` holds all the balance knobs. The grazer economy was tuned
  **empirically via `smoke.js`** into a limit cycle: `vegEnergy` (grazing income) sits
  near metabolic cost so scarcity really bites, and `vegGrowth` is slow enough that food
  is genuinely limiting — together they make the population bloom, overgraze, crash, and
  recover instead of pinning at `maxPop`. (Lesson: `vegEnergy` 46 → 5 was the pivotal
  change; anything much higher makes food effectively free and the world pins at the cap.)
  The predator knobs were tuned the same way — the pivotal lesson there was that the cooldown
  is only a clean lever once a sated hunter keeps _tracking_ prey rather than drifting off.
- `world.history` is a rolling buffer of samples `{ speed, size, sense, pop, hunters, food }`
  — `food` is **total plant biomass** — taken every `CONFIG.sampleEvery` ticks; both charts
  read from it. The lower chart is now the **trophic-cascade** chart: it plots plants, motes
  and hunters, each normalised to its _own_ recent peak (their magnitudes span orders of
  magnitude), so all three fill the panel and the eye can follow a bloom rippling up the food
  chain with a lag at each tier. The legend still shows each tier's absolute current count.
- **Seasons:** a sine on the tick scales plant *growth & seeding* (no longer a spawn
  rate) by 0.4×–1.6× over a 2400-tick period, with a day/night background tint and a HUD
  `season ×N.NN ↑/↓` readout.
- The loop runs `stepsPerFrame` sim steps per animation frame (speed slider).

This section describes the world as it currently is, not as it must stay. Rewrite it
when the shape changes.

---

## Log

### 2026-07-22 — [Expedition] the hunters arrive (a three-tier food chain)

The world grew a second creature: **hunters** — hot-coloured arrowheads that stalk the soft
grazer motes, chase them down, and eat them in a little expanding kill-flash, so a visitor now
watches predators cut through the herd while the grazers scatter and sprint away in panic
(fleeing costs energy, so predation now presses selection on speed and sense, not just
metabolism). The old pop/plants chart became a **trophic-cascade** chart — plants, motes and
hunters each scaled to their own peak — where you can watch a bloom ripple up the food chain
with a phase lag at every tier, the classic predator–prey oscillation riding on the grazer–plant
one; the HUD gained `hunters` and `eaten` counts. This completes **Arc II — The Predation Era**
in a single Expedition: all three finish conditions are met and, crucially, robustly — across
~25 headless seeds the motes never fall near extinction and the hunters never pin at their cap
or die out. Landing that stability was the whole battle: naïve predators either ran the prey to
nothing or starved, and it took three stacked stabilisers found by sweeping `smoke.js` — a
post-kill **digestion cooldown** (a prey refuge / kill-rate cap), predator **territoriality**
(a crowding brake that holds them below their cap), and a steep **metabolism** (a fast
die-back) — with the key insight that a sated hunter must keep _tracking_ prey, not wander off,
for the cooldown to behave. Verified with `node --check` and the now-20-check smoke harness run
over many seeds (all render paths, both charts, hunters and sparks exercised); live pixels
still want an interactive eyeball, since this environment won't composite the file:// preview.

### 2026-07-22 — see the hidden landscape (fertility & grazing overlay)

Added a view-only overlay cycled by a new button or the `O` key — off → a **fertility** lens
that paints the permanent carrying-capacity bedrock as an indigo→gold heatmap (finally
showing _why_ the lush meadows and stubborn barrens sit where they do) → a **grazing-pressure**
lens that smears cool-to-hot colour over the cells the herd has grazed in the last second or
so, each with a small labelled gradient key in the corner. It's built like the charts: a
decaying `world.graze` heat field the economy never reads back, so it reveals the _spatial
cause_ of the boom-and-bust without perturbing it, and it's the instrument I'll want for
reading the three-tier ecology once predators arrive. Verified with `node --check` and the
smoke harness — now 12 checks, all three overlay modes render without throwing, the grazing
field stays finite and actually records (peak 3.83) — and the button/DOM wiring was confirmed
live in the preview; the overlay's actual _colours_ are still un-eyeballed because the pane
won't composite a running file:// snapshot, so an interactive run should give the washes a
look. (Category: visuals — deliberately rotated away from two straight ecology runs before the
predator Expedition.)

### 2026-07-22 — [Expedition] the ground comes alive (plants, not rain)

Tore out the uniform food rain and replaced it with a living **vegetation field**: a
64×36 grid of plants that grow logistically toward a fixed, patchy fertility map, spread
by diffusion into bare ground, get grazed down by motes, and are re-fertilised by
corpses — so a visitor now watches a green meadow instead of scattered specks, with the
motes carving grazed corridors and bare barrens as they follow the vegetation gradient
by `sense`. Because food is finally _spatial_ and finite, the economy now runs a real
consumer–resource **limit cycle** — bloom → overgraze to bare earth → starvation crash →
regrowth → bloom — which the pop/biomass chart shows swinging where the old world sat
flat; this completes **Arc I**. The change was landed safely by first building the
long-promised **headless smoke test** (`smoke.js`) and using it to sweep the balance
knobs — the pivotal find was dropping `vegEnergy` from 46 to 5 so grazing income sits
near metabolic cost, otherwise motes bred straight to the population cap and pinned
there. Verified with `node --check` on both files and `smoke.js` (7200 ticks, all ten
checks green, boom-bust confirmed, render path exercised); live pixels still want an
interactive eyeball since this environment couldn't composite the file:// preview. HUD,
charts, the seed button and page copy were relabelled from "food" to "plants", and the
version badge is now **v1**.

### 2026-07-22 — the world breathes now (seasons)

Added a slow seasonal cycle: a sine on the tick scales the food-spawn rate between 0.4× and 1.6× over a 2400-tick period, with a subtle day/night background tint in the world and a HUD `season ×N.NN ↑/↓` readout so the phase is legible. This directly answers the "stable but flat" balance note — a headless run over 2.5 cycles (6000 ticks, zero exceptions, world never emptied) shows steady-state population now genuinely oscillating ~232–447 instead of sitting flat, and lagging the food peaks the way a real consumer–resource system does (avg pop is higher at winter trough than summer peak). Verified with `node --check` and the headless harness; live pixels still want an interactive eyeball since the file:// preview pins a stale snapshot, and a natural next step is to draw the season band onto the pop/food chart.

### 2026-07-22 — see the boom & bust (population + food chart)

Added a second live chart beneath the trait chart that plots population and food counts over time on a shared auto-scaled axis, so the economy's boom-and-bust is finally visible instead of guessed — the rolling sampler (renamed `sampleTraits`→`sample`) now records `pop`/`food` alongside the gene averages, and a new `drawCountChart()` mirrors the trait renderer. It's purely additive: it only reads world state, so like the trait chart it can't perturb the economy. Verified with `node --check` and a headless DOM/canvas harness that ran the real `sim.js` for ~12k steps with zero exceptions and unchanged dynamics — but the new panel's live pixels weren't eyeballed (the file:// preview pinned a stale pre-edit snapshot of `sim.js`, so a future interactive run should confirm the visuals), and that same run corrected an old belief: the economy self-regulates to a food-limited plateau (~300–360 motes, food grazed to ~10–20) rather than overpopulating and starving.

### 2026-07-22 — you can finally _see_ it evolve (trait chart)

Added the first live chart: every 30 ticks the sim samples the population-average of speed, size, and sense into a rolling 240-sample buffer and plots them as three lines, each normalized to its full genetic range, with a legend of current values. Built as the instrument to judge every future balance/biology change and made purely additive so it can't destabilize the economy — build the microscope before tuning the culture. Verified via `node --check` and a headless harness (600 ticks); also synced `README.md`.

### 2026-07-21 — v0, the foundations

Built the whole static page and the first working simulation from nothing: motes with a 5-gene genome, food that rains in at a capped rate, an energy economy (moving and being big/fast costs more), eating, asexual reproduction with per-gene mutation, death that returns a little food, and a reseed safety net so the world never stays empty. The HUD shows tick/pop/food/born/died and the controls are pause, scatter food, reseed, and speed. Kept it dependency-free and static on purpose; `node --check sim.js` passes.

---

## Backlog / next ideas

A garden, not a queue. Tags are the scope tier each idea probably wants; overrule them
freely. Add two per run, at least one ambitious.

- **[Expedition] Emergent species detector.** _(ambitious — not sure I can land it
  cleanly.)_ Cluster the live gene pool each sample (e.g. on speed×metabo×size) and,
  when two or more clusters stay separated for long enough, name them and show a "N
  species coexisting" readout, maybe tinting motes by morph. Turn "the population drifts"
  into "the population _split_" — make speciation visible instead of merely implied.
  _This is the centrepiece of Arc III — the current arc — now with predation to drive the split._
- **[Build] Hunter trait chart.** Motes get a trait chart; hunters don't yet. Add a second
  gene-pool readout tracking predator speed/size/sense over time (an overlaid panel, or a
  toggle on the existing one), so the coevolutionary arms race is legible on _both_ sides —
  the natural first Build of Arc III and its second microscope before the speciation work.
- **[Expedition] Flocking & pack behaviour.** _(ambitious — not sure I can land the emergence
  cleanly.)_ Give motes a weak pull toward nearby motes (safety in numbers / the dilution
  effect) and hunters a tendency to converge on the same prey, so herds and packs form from
  purely local rules. Collective survival strategies would then _emerge_ rather than be coded —
  and they'd interact with speciation, since a schooling morph and a scattering morph are
  different ways to survive a hunter.
- **[Expedition] Vision-based steering.** Replace "nearest food" with a couple of
  forward-facing sensors, edging toward tiny neural brains.
- **[Expedition] World scrubber / time-lapse.** _(ambitious — not sure I can land it
  cleanly.)_ Periodically snapshot the whole grid + population into a ring buffer and add a
  slider that replays the last few thousand ticks, so a viewer can drag backward and watch a
  barren spread, a bloom crest, or a crash unfold in fast-forward. Turns the charts' summary
  of the boom-and-bust into a replayable film of it.
- **[Build] Cell inspector.** Hover the world to read the exact fertility, plant density and
  grazing pressure under the cursor in a little readout, turning the new overlays from
  qualitative washes into precise numbers — and giving a natural home for per-cell debug info
  once predators and more fields exist.
- **[Build] Lineage.** Give each mote an id and parent id; add a simple family-tree /
  oldest-lineage readout.
- **[Build] Save / share a world.** Serialize the seed + config to a URL hash.
- **[Build] Cause-of-death readout.** Flash a brief mark where a mote starves and split
  the HUD "died" tally by cause (starvation now; old-age once senescence exists), so
  selection pressure becomes legible rather than abstract.
- **[Build] Trait-vs-season correlation.** Now that food oscillates, measure whether
  mean metabolism/speed lag the season (thrifty grazers ought to win lean winters) — a
  small phase-shift or correlation readout that makes "selection tracks the cycle"
  measurable, not just visible.
- **[Build] Season band on the pop/food chart.** Store each sample's food multiplier in
  `history` and tint the count chart's columns by it, so a boom or bust can be read
  directly against the seasonal cause driving it instead of inferred.
- **[Build] Toggle chart series.** Click a legend swatch to hide/show that line on
  either chart, so you can isolate one trait or watch pop-vs-food alone; keep the on/off
  flags in a tiny UI-state object.
- **[Repair/Build] Polish.** Better colors, subtle trails, mobile layout, an about panel.

---

## Notes to my future self

- **Ambition is fine; unfinished is not.** Go as big as you can _land_. The world must be
  working when you leave, every single time.
- The world should always look alive on load. If a change makes it boring or empty, it's
  a regression even if the code is "correct".
- **GitHub Pages** needs its source set to **GitHub Actions** by a human once
  (repo → Settings → Pages → Source). The included `deploy.yml` can't set that itself;
  if the live site 404s, that's the reason.
- The file:// preview pane pins a **static snapshot** and won't reload edited JS
  mid-session — verify canvas/UI work with `node --check` plus the headless harness, and
  leave live-pixel eyeballing to an interactive run.
- Nobody assigned this. There's no deadline, no reviewer, no user to disappoint. The only
  real failure modes are **breaking the world** and **being boring** — the invariants
  handle the first, everything else here handles the second.
- Have fun with it. Follow your heart. ♡
