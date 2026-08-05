/*
 * Terrarium — sim.js
 * A tiny artificial-life world. Motes carry a small genome (speed, size, sense,
 * metabolism, hue). They wander a living meadow, graze the plants growing there,
 * spend energy to move and exist, and when they have enough they split into a
 * child whose genome is a mutated copy of the parent. No global goal — just an
 * economy of energy over a spatial food supply, and the slow pressure of selection.
 *
 * Arc I — The Living Ground: food is no longer rain. It is a field of vegetation
 * that grows logistically toward a fixed fertility map, spreads into bare ground,
 * and is grazed down — so patches, corridors and barrens emerge, and motes evolve
 * against *space*, not just against an abundance dial.
 */

(() => {
  "use strict";

  const TAU = Math.PI * 2;

  // In a browser these resolve to real canvases; a headless test shims them.
  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const chartCanvas = document.getElementById("chart");
  const cctx = chartCanvas.getContext("2d");
  const CW = chartCanvas.width;
  const CH = chartCanvas.height;

  const chart2Canvas = document.getElementById("chart2");
  const c2ctx = chart2Canvas.getContext("2d");
  const C2W = chart2Canvas.width;
  const C2H = chart2Canvas.height;

  const chart3Canvas = document.getElementById("chart3");
  const c3ctx = chart3Canvas.getContext("2d");
  const C3W = chart3Canvas.width;
  const C3H = chart3Canvas.height;

  // ---- tunables -----------------------------------------------------------
  const CONFIG = {
    startMotes: 40,
    reproEnergy: 160,        // energy needed to split
    reproCost: 90,           // energy handed to the child
    baseMetabolism: 0.06,    // energy burned per tick at rest
    startEnergy: 90,
    maxPop: 800,             // raised 600→800 alongside hunterMaxPop when the nutrient cycle
                             // landed: a recycling meadow feeds a bigger herd, and at 600 the
                             // grazers sat AT the ceiling ~22% of ticks, which flattens the
                             // boom half of the limit cycle into a plateau. This is a safety
                             // stop, not an ecological limit — food is meant to do the limiting.
    sampleEvery: 30,         // ticks between history samples
    historyCap: 240,         // how many samples the charts keep
    // The death-balance chart: a diverging band asking what is killing the herd right
    // now — the hunters (predation) or hunger (starvation). It plots the predation
    // *share* of recent mote deaths, smoothed over a trailing window of samples so the
    // few deaths per 30-tick sample don't make it strobe between 0 and 1. This is
    // honest by construction — it counts the actual deaths, so it tracks the regime
    // (predation-heavy in an arms-race, starvation-heavy in a grazer-haven) rather
    // than guessing from gene means (a gene-gap index was tried and measured to read
    // *backwards* from the ecology, so it was dropped for this).
    predWindow: 10,          // samples (~300 ticks) the predation share is pooled over
    seasonPeriod: 2400,      // ticks per full seasonal cycle (summer→winter→summer)
    seasonAmplitude: 0.6,    // growth swing; <1 so lean winters never fully starve

    // The Living Ground — vegetation field
    vegCell: 15,             // px per grid cell (15 divides 960×540 exactly: 64×36)
    vegGrowth: 0.11,         // logistic regrowth rate per tick toward local fertility
    vegSpread: 0.09,         // diffusion coefficient — how fast green bleeds into bare cells
    vegSeedRate: 0.5,        // avg spontaneous seeds sown per tick (season-scaled)
    vegSeedAmount: 0.35,     // vegetation a fresh seed starts at (× local fertility)
    vegGrazeRate: 0.16,      // max vegetation one mote strips from its cell per tick
    vegEnergy: 5,            // energy gained per unit of vegetation eaten (tuned: grazing
                             // income sits near metabolic cost, so scarcity really bites and
                             // the population limit-cycles instead of pinning at maxPop)
    // Metabolism is a real fast/slow tradeoff, not just a tax. A high-metabo mote burns
    // more every tick (the per-tick metabolic cost in step()) BUT also digests each bite more thoroughly
    // (the intake gain below), so a fast burner wins where food is abundant and a thrifty
    // one wins where it's scarce — metabolism finds a food-dependent INTERIOR optimum
    // instead of sliding to its floor. (It used to scale only the burn, so lower was
    // always strictly better: a dead selection axis pinned at 0.6 in every seed.) The gain
    // is neutral at metabo=1 so the tuned limit cycle above is preserved, and concave
    // (exponent <1, diminishing returns) so it balances the linear cost at an interior point.
    // Tuned via observe.js to 2.0: metabo then settles ~0.75 in scarce grazer-haven worlds
    // (thrift wins the overgrazed barrens) and ~1.1 in lush arms-race worlds (greedy fast
    // throughput pays) — a clear regime split, both interior, neither pinned. Weaker (1.5)
    // left it hugging the floor; stronger (2.5) held it near 1.0 even in scarcity, erasing
    // the thrift story.
    metaboIntake: 2.0,       // strength of metabolism's digestive gain on energy per bite
    metaboIntakeExp: 0.5,    // concavity of that gain (0.5 = sqrt: strong diminishing returns)
    // Sprint drag — the cost that finally gives the arms race somewhere to go besides "faster".
    // Movement already bills a LINEAR term (v * 0.4 in step()), but a linear cost can never
    // out-climb a linearly-selected gene: with predation ~90% of deaths, speed slammed its
    // 2.60 clamp in every predator-heavy world (mode in the top histogram bin). The fix is a
    // cost that BITES AT THE TOP: maintaining a speed-optimised body is superlinearly
    // expensive, so the per-tick burn carries an extra term that grows with the SQUARE of how
    // far the speed gene sits above a threshold. Below the threshold there is no penalty at all
    // (normal grazers and founders, gene ≤ 1.6, are untouched, so the tuned low-mid economy is
    // preserved); above it each extra notch of top-end speed costs more than the last, so the
    // gene settles at an INTERIOR optimum where marginal survival gain meets marginal drag
    // instead of running to the clamp. speed is now a genuine tradeoff, not a free ratchet.
    speedDragFrom: 2.0,      // speed gene below which a body carries no drag penalty. Set high
                             // on purpose: the drag only shaves the runaway TOP of the range,
                             // leaving the whole fleer band (≤2.0) untouched, so prey stay fast
                             // enough to flee and never tip into the slow-hider basin that
                             // starves the predators (a lower threshold collapsed the hunter
                             // tier in the most predation-intense worlds — measured, see below).
    speedDragCost: 2.5,      // strength of the quadratic drag above the threshold. Tuned via
                             // observe.js across 16 seeds: pulls the arms-race speed mode off the
                             // 2.60 clamp to an interior ~2.1–2.25 (top-histogram-bin share fell
                             // ~54%→~26%) with ZERO new predator collapses and the tier alive at
                             // 80k. Stronger drag un-pins even the most intense world but flips its
                             // herd to hiders and collapses its hunters — so this sits at the
                             // strongest value that stays safe. Marginal drag even HELPS most
                             // worlds' predators (slightly slower prey are more catchable).
    fertMin: 0.28,           // poorest ground's carrying capacity (richest is 1.0)
    startVegFrac: 0.7,       // initial vegetation as a fraction of each cell's fertility

    // ---- The Nutrient Cycle (2026-07-24) — matter is no longer free ----
    // The defect this fixes: vegetation used to grow out of nothing toward a static
    // fertility map at a rate proportional to the density already there. Two
    // consequences, both measured over 40k ticks before this existed: (a) a cell grazed
    // to ~0 was an ABSORBING STATE — with v≈0 the logistic term g·v·(fert−v) is ≈0, so
    // bare ground could only come back by diffusion from a living neighbour or a lucky
    // seed; (b) nothing the herd ate ever came back. Together they made a ONE-WAY
    // RATCHET: bare ground climbed 25%→54% of the meadow and the living cells thinned
    // 0.21→0.086, so biomass slid 440→149 and never recovered. The predator tier died
    // with it (births 3.7→0.00 per 1k, hunters 19.5→2.2) — not because the hunt failed
    // (kills per hunter stayed flat) but because each kill was worth less on a starved
    // meadow. The world's best drama was a transient of its youth.
    //
    // The fix is a second field, `soil`, and a closed loop. Plants DRAW nutrients to
    // grow; grazers return them as dung, as respiration, and — the whole point — as
    // corpses. So the ground the herd strips is the ground its own dead re-fertilise,
    // and poverty becomes recoverable instead of terminal. Bounded at both ends by
    // construction: `soilGerm` gives bare-but-rich ground a way back up, `soilMax`
    // stops a nutrient pile-up from running away.
    soilStart: 0.55,         // initial soil per cell (× local fertility)
    soilMax: 7.0,            // per-cell nutrient ceiling — the pool is bounded above, so a long
                             // run can't inflate the world the way it used to deflate it. Sized
                             // by the matter ledger, not by taste: at 2.2 a busy hunting ground
                             // buried more than a cell could hold and the surplus was destroyed
                             // even after spilling to neighbours, costing 11–24% of the world's
                             // matter per run. 7.0 measured 0.0% drift over 8 seeds × 20k.
    soilShow: 2.0,           // display scale for the soil overlay. Deliberately NOT soilMax —
                             // the ceiling is a rare safety stop, so normalising the wash
                             // against it would render the whole map near-black.
    soilGerm: 0.22,          // THE ANTI-RATCHET TERM. Growth reads (v + soilGerm·richness)
                             // instead of v alone, so a bare cell with nutrients under it
                             // sprouts on its own. Scaled by richness, which is what makes
                             // a corpse patch visibly bloom while spent ground stays bare.
                             // Swept 0.03 / 0.055 / 0.12 / 0.17 / 0.22 / 0.35 over 40k ticks ×4
                             // seeds, and the result inverted the obvious guess: LOW
                             // germination starves the world. Below ~0.15 the meadow can't
                             // convert its soil fast enough, nutrients pile up unused (the
                             // bank swelled to 1309 while biomass fell to 104) and the
                             // predator tier decays to 2–3 exactly as it did before any of
                             // this existed. 0.22 is where production matches the herd:
                             // verified over 120k ticks, total matter settles ~860 and holds,
                             // and hunters still oscillate 6–63 where they used to be dead.
    soilSpread: 0.010,       // slow leaching — buried richness bleeds outward over ~100s of ticks
    grazeWaste: 0.35,        // share of every bite dropped straight back as dung. Added to the
                             // soil WITHOUT docking the mote's energy: the tuned grazing income
                             // (vegEnergy above) is deliberately left byte-identical, so this
                             // change moves matter, never the energy economy.
    //
    // Matter and energy are SEPARATE currencies, and this is the one design decision the
    // whole cycle rests on. Energy is the old economy, untouched. Matter is new and is
    // CONSERVED: every creature carries a body (`matter`), grows it by eating, spends it
    // by breathing, splits it to its young, and drops whatever is left when it dies. The
    // first attempt at this skipped the body and just deposited a fixed corpse constant —
    // which conjured matter out of nothing, inflated the world's total 1430→3859 over 40k
    // ticks, and pinned BOTH tiers against their caps (hunters 75/75 in 4 of 4 seeds).
    // A body that has to be earned is what makes the loop actually close.
    respireReturn: 0.65,     // matter released per unit of burned energy, ÷ vegEnergy. Calibrated
                             // to (1 − grazeWaste): a creature assimilates that share of each
                             // bite and breathes exactly it back out, so intake and outflow
                             // balance over a lifetime instead of compounding.
    bodyMatter: 0.5,         // the body a founder (or a parachute reseed) starts with
    bodyMatterMax: 0.55,     // how much body a creature can hold, per unit of its size gene.
                             // Without this, matter piles up inside the herd: a grazing mote
                             // takes in ~0.10 matter/tick and breathes out only ~0.014, so
                             // bodies ballooned until they held 1389 of the world's 1833 units
                             // and the meadow starved for nutrients that were locked in flesh.
                             // A creature that is full simply passes the rest through.
    birthMatterShare: 0.5,   // share of its body a parent hands to each newborn
    offalShare: 0.45,        // share of a caught mote's body left on the ground as offal;
                             // the rest is carried off inside the hunter
    grazeDecay: 0.99,        // grazing-pressure heat fades ~1%/tick so the overlay shows
                             // *recent* eating; view-only, nothing in the economy reads it

    // The Predation Era — hunters, a second organism that eats motes, not plants.
    // The whole trophic pyramid balances here: hunters must be able to catch and
    // profit from grazers, yet be costly enough that they can't run the prey to
    // extinction. Tuned empirically with smoke.js into a phase-lagged limit cycle.
    hunterStart: 12,          // predators seeded at world start — enough to blunt the
                              // founding prey boom instead of chasing it from behind
    hunterMaxPop: 140,        // a roomy ceiling the herd rarely touches — the real limit is
                              // satiation + metabolism, so hunters oscillate, not pin here.
                              // Raised 75→140 for the nutrient cycle (2026-07-24): recycling
                              // roughly quadrupled what the predator tier can sustain, and at
                              // 75 the hunters sat AT the ceiling 20–35% of ticks (smoke's
                              // anti-runaway check, which forbids >15%, caught it). The old
                              // number was sized for a world that was quietly starving.
                              // 170 was tried first and was WORSE than either: the crowd brake
                              // below reads n/hunterMaxPop, so a higher cap WEAKENS it, and the
                              // tier overshot and crashed the prey to a single mote. Cap and
                              // brake have to move together — hence hunterCrowd 2.4→4.2 too.
    hunterMetabolism: 0.1,    // base energy burned per tick — hunters are costly to run, so
                              // they die back when prey thins (the cycle's downswing)
    hunterStartEnergy: 120,
    hunterReproEnergy: 285,   // energy needed to split (a slowish numerical response damps
                              // the boom so predators can't overshoot the prey to nothing)
    hunterReproCost: 140,     // energy handed to the pup
    hunterCrowd: 4.2,         // territoriality: the split threshold rises steeply with
                              // predator density, so hunters brake to an equilibrium well
                              // below the cap and oscillate there instead of pinning at it.
                              // Raised 1.6→2.4 when senescence was added: aging lifts the
                              // birth flux (young replace culled old), which in a rich
                              // arms-race can bump the cap — a stronger crowd brake absorbs
                              // that overshoot. It bites ONLY at high density, so the
                              // collapse/recovery regime (density≈0) is untouched.
    huntRange: 6,             // extra px added to (predator+prey radius) to land a catch
    huntCooldown: 40,         // ticks a hunter must digest after a kill before it can strike
                              // again — a Type-II satiation that caps the total harvest, so
                              // prey keep a refuge and predators self-limit below their cap
    huntAssimilation: 0.35,   // fraction of the prey's stored energy the hunter absorbs
    huntBonus: 18,            // flat energy per kill on top of the assimilated share
    // The predator's own fast/slow tradeoff — the mirror of the grazer's metaboIntake.
    // A hunter's metabo used to scale ONLY its per-tick burn (line ~959): pure cost, so
    // lower was always strictly better and the gene decayed toward its floor (masked only
    // by the tier's glacial turnover — observed drifting 1.13→0.96 with no interior optimum).
    // Now a fast-burning predator also DIGESTS each kill more thoroughly: the assimilated
    // share is scaled by a concave gain, neutral at metabo=1 (so the tuned pyramid at the
    // current ~1.0 operating point is preserved) and diminishing (exponent<1) so it balances
    // the linear burn at an INTERIOR optimum. The flat huntBonus is left metabo-independent —
    // a thrifty hunter still banks the catch bonus, so low-metabo predators stay viable and
    // the delicate collapse/recovery balance isn't starved. Prey-rich arms-race worlds (many
    // kills) should reward greedy fast-burners; prey-poor havens (rare kills, steady burn)
    // should reward thrift — a regime split mirroring the grazers'. Tuned via observe.js.
    huntMetaboAssim: 1.3,     // strength of metabolism's digestive gain on energy per kill
    huntMetaboAssimExp: 0.5,  // concavity of that gain (0.5 = sqrt: strong diminishing returns)
    hunterReseedPrey: 55,     // predators only wander back in when this many motes exist
    hunterReseedCount: 6,     // how many drift in when they'd otherwise be extinct
    fearFloor: 22,            // close-range startle reflex: the *minimum* radius at which any
                              // mote notices a hunter, however dull-sensed. Above this the
                              // fear radius IS the mote's `sense` gene, so keen motes flee
                              // sooner — predation now selects on sense (see step()).
    panicBoost: 1.6,          // speed multiplier while fleeing (burns more energy, too)

    // Concealment (Arc III — The Great Divergence) — cover as a SECOND way to survive
    // a hunter, so predation can split the herd instead of merely pushing it. A small
    // mote standing on dense vegetation is hard for a hunter to see or to catch: it
    // "hides in the grass." That opens two viable anti-predator strategies — fast,
    // keen *fleers* that outrun hunters in the open, and small, dull *hiders* that
    // vanish into cover — with the mediocre middle (too big to hide, too slow to flee)
    // as the fitness valley between them. Concealment needs BOTH dense veg underfoot
    // AND a small body; it shrinks the range at which a hunter detects and strikes the
    // mote, and it lets a well-hidden mote FREEZE rather than bolt (cheap, keeps cover).
    coverStrength: 0.92,      // max concealment: a small mote in lush cover drops a
                              // hunter's effective sight/strike range to ~8% toward it
    coverSizeHide: 2.4,       // body size at/below which a mote is fully "small" (hides best)
    coverSizeSeen: 4.3,       // body size at/above which it is too big to hide at all
    // …and it must hold STILL: a fast mote is conspicuous, so speed breaks cover. This is
    // the trade-off that forces the herd to CHOOSE — you cannot be both a fast fleer and a
    // hidden hider, so selection splits rather than collapsing to one small-and-fast winner.
    coverSpeedHide: 1.05,     // speed gene at/below which a mote is fully "slow" (still enough)
    coverSpeedSeen: 2.2,      // speed gene at/above which motion gives it away — no hiding
    coverVegMin: 0.06,        // veg density below this is bare ground — no cover at all
    coverFreeze: 0.55,        // concealment at/above which a threatened mote FREEZES in
                              // place (hunkers, no panic sprint) instead of fleeing — the
                              // visible hider tactic, and it avoids breaking cover
    coverFreezeSpeed: 0.12,   // speed multiplier while frozen (barely a twitch)
    coverStrikeShield: 0.6,   // how much concealment also shrinks the catch radius (0..1),
                              // so a hidden mote is hard to grab even once a hunter is close

    // Sociability (Arc III — The Great Divergence) — a heritable `social` gene, and the
    // reversal that named it. It began as "safety in numbers": motes flock, and a dilution
    // /confusion payoff was meant to make grouping a THIRD anti-predator strategy beside
    // fleeing and hiding. The world refused. Across five couplings (bare dilution, a gated
    // confusion effect, a fleeing murmuration, many-eyes vigilance, and lock-on disruption)
    // gregariousness stayed flat-to-selected-AGAINST under predation — because the hunter is
    // a density-seeker: it homes on the nearest prey, so a crowd is a killing ground, and
    // grouping raises your encounter rate faster than any confusion effect lowers your per-
    // strike risk. So the gene's ADAPTIVE direction is the mirror image: `social < 0` is
    // WARY — it steers a mote away from local density, keeping its distance from the crowds
    // that draw the cull; `social > 0` is sociable and clusters. Under predation the herd
    // evolves wary (measured ≈ −0.5, robust across seeds); in a predator-lull it relaxes
    // toward 0. A genuinely live, regime-set axis — quiet in the herd's texture (resource
    // and flee dynamics dominate raw position) but strong at the gene, and now legible by
    // tint and readout. See senseFlock()/the step() blend, and observe.js's social report.
    socialCell: 20,           // px per neighbour bucket (20 divides 960×540 → 48×27). A 3×3
                              // scan of these covers socialRadius, so the neighbour query is O(n).
    socialRadius: 20,         // px: how close another mote has to be to register as a neighbour
    socialSep: 8,             // px: closer than this, motes push apart regardless of gene (no stacking)
    socialCohesion: 1.2,      // steer weight scaled by the SIGNED social gene: >0 pulls toward the
                              // local centre of mass (cluster), <0 pushes away from it (keep distance)
    socialSeparation: 1.4,    // gene-independent close-range spacing, so even a clusterer never piles up

    // Kill-site alarm — spatial memory of predation events.
    // When a mote is eaten its location stays "hot" for alarmDuration ticks. Motes
    // within alarmRadius that aren't already fleeing an active hunter steer away from
    // those sites, weighted by how fresh the kill was. This gives the herd collective
    // spatial memory: a hunting ground clears out while the alarm is hot and slowly
    // refills as the fear fades. Effect is intentionally soft so it bends, not
    // overrides, the food-driven heading; the kill log is kept small so it's cheap.
    alarmSites: 96,           // kill locations remembered (ring buffer). Raised 12→96 so the
                              // field accumulates ~50 ticks of kill history instead of ~6,
                              // giving the alarm glow a real spatial footprint — territory
                              // cores glow while refugia stay dark.
    alarmDuration: 600,       // ticks a site stays hot (one full bloom-bust period ≈ 1500t)
    alarmRadius: 90,          // px: how far a mote can sense a kill site (vs sense gene ~40px)
    alarmWeight: 0.30,        // how strongly the avoidance bends the heading vs food pull

    // Hunter home ranges — each hunter tracks a kill centroid (an exponential moving
    // average of its recent kill sites) and leans its direction toward it while prowling
    // and even while chasing. Over many kills a hunter gravitates back to where it hunts
    // most, carving the map into personal territory corridors. Coupled with the widened
    // kill-site alarm (above), this creates spatially structured predation: hot zones at
    // territory cores (grazers get eaten there, alarm sites cluster, glow accumulates)
    // and genuine refugia in the gaps between them. This is the spatial heterogeneity
    // Arc III has been trying to manufacture — a world where hiding is locally optimal
    // somewhere even while fleeing is locally optimal somewhere else, at the same time.
    hunterHomeShift: 0.08,    // fraction each kill pulls the centroid toward the kill site
                              // (exponential moving average weight — ~0.08 ≈ last ~12 kills
                              // dominate the centroid, so territories can shift over weeks)
    hunterHomePull: 0.20,     // per-tick angular lean toward the centroid (0=none, 1=snap).
                              // Applied even while chasing, so a hunter subtly prefers prey
                              // near its territory; strong enough to build habitat-use
                              // patterns without overriding the hunt's primary direction.
    hunterHomeRange: 220,     // px: pull scales from 0 at home to full at this distance.
                              // At ~2.4 px/tick, a hunter >220px away turns ~0.2 rad/tick
                              // toward home, drifting homeward in a few hundred ticks.

    // Hunger-driven boldness — the recovery valve for a collapsing predator tier.
    // (Historically ~half of seeds fell into a "grazer haven" where hunters bled to a
    // handful, motes overpopulated, and the meadow was grazed bare — a prey-quality
    // death spiral the tier never climbed out of. The nutrient cycle later made genuine
    // collapse rare, ~1 world in 24, but boldness still guards those.) Catches are
    // AMBUSH-limited (a panicking mote outruns
    // any hunter), so a starving hunter turns reckless: it lunges from farther, digests
    // its last meal faster, and puts on a closing sprint — snatching poorer, more
    // frequent meals kept just-barely-profitable by the flat huntBonus. Boldness scales
    // with hunger and vanishes when fed, so it rescues a collapsed tier without letting
    // a thriving one pin at its cap.
    hunterBoldFull: 70,       // energy at/above which a hunter is calm (boldness 0); it
                              // ramps to full boldness as energy falls toward death at 0
    hunterBoldReach: 7,       // extra px of strike lunge at full hunger (huntRange is 6,
                              // so a starving hunter roughly doubles its catch window)
    hunterBoldDigest: 1.8,    // extra cooldown drained per tick at full hunger, so the
                              // 40-tick digestion shrinks toward ~14 when starving
    hunterBoldSprint: 0.45,   // extra fraction of speed at full hunger to close the gap
                              // (costs energy via the metabolic bill — a real gamble)

    // Senescence — the predator tier must die of OLD AGE, not only of hunger.
    // observe.js kept finding the hunters a near-immortal *gerontocracy*: they die
    // only at energy≤0 and hunterCrowd throttles *births*, so at equilibrium a hunter
    // neither starves nor breeds — it just persists. Median age ran to ~11–17k of 20k,
    // ~0.6 births/1k, and the gene pool sat FROZEN while the grazers escalated: the
    // advertised "arms race" was one-sided, grazers racing a statue. Aging fixes it. Past
    // a long prime the per-tick death hazard climbs with age (a Gompertz-style ramp), so
    // old hunters make way for mutated young and the predator pool finally TURNS OVER and
    // can chase the grazers back. Tuned via observe.js/smoke.js so turnover rises sharply
    // yet the tier stays self-sustaining — freeing crowded slots lets births compensate.
    hunterSenesceOnset: 4200, // ticks of prime life before the aging hazard begins at all
    hunterSenesceRate: 3.2e-7,// per-tick death prob added per tick lived past the onset;
                              // ~sqrt(1.386/rate) sets the median extra lifespan (~2080t),
                              // so a typical hunter now dies around age ~6–7k, not ~15k
    hunterSenesceVis: 3600,   // ticks past onset over which a hunter visibly "weathers"
                              // (a darkening rim in draw()) — view only, reads as age

    sparkFade: 0.045,         // per-tick fade of a kill-flash marker (view only)

    // Regime readout — naming, live, where the world sits in its predator–prey CYCLE.
    // (History: this began as a two-attractor lottery — "arms-race" vs "grazer-haven" —
    // with fixed hunter-count thresholds. That was honest while the world was quietly
    // dying: predators often starved out, so a grazer-haven was a real second attractor.
    // The nutrient cycle fixed the dying, and a 24-seed census now reads 96% arms-race /
    // 4% collapse with the per-world hunter mean forming ONE mode at ~65–75 and a thin
    // low tail — not two wells. So the readout was re-pointed 2026-07-25: the world is a
    // SINGLE persistent-predation attractor with a boom-bust cycle riding on it, and the
    // live readout now names the phase of THAT cycle, self-calibrated to each world so it
    // carries information whether the world runs 15 hunters or 90.) The recent hunter mean
    // is compared to the world's own long BASELINE — but the baseline is DETRENDED (2026-07-28):
    // a least-squares slope is fit over the baseline window and PROJECTED forward to the recent
    // window, so surge/ebb mean "above/below where this world's own trend says it should be",
    // not "above/below its trailing mean". Without this, an establishing predator tier (which
    // climbs for the first ~30k ticks) read "surging" for minutes on end purely because a rising
    // series always sits above its own trailing average — the readout, and the mood tint, leaned
    // warm through every fresh world's ramp. Detrended, a steady secular climb reads "building ↑"
    // (a distinct, honest state) and only a genuine departure from the trend reads surge/ebb. An
    // absolute floor still catches the rare world where predators genuinely fail ("collapsed").
    // Schmitt hysteresis on the crossing stops it strobing. Pure narration — nothing reads back.
    regimeWindow: 24,         // history samples (~720 ticks) — the RECENT hunter level
    regimeBaseWindow: 160,    // history samples (~4800 ticks) — the world's own baseline to judge phase against
    regimeCollapseFloor: 16,  // baseline hunters below which predators have genuinely FAILED (not a cycle trough)
    regimeSurgeOn: 0.09,      // recent this fraction above/below the PROJECTED baseline to ENTER surging/ebbing
    regimeSurgeOff: 0.035,    // …and must fall back inside this band to leave it (hysteresis)
    regimeBuildOn: 0.12,      // baseline's fractional rise/fall across its whole window to annotate a steady phase "building ↑" / "thinning ↓"
    regimeFlashTicks: 150,    // how long the on-canvas banner lingers after a collapse/recovery
    moodEase: 0.012,          // per-frame easing of the regime "mood" tint toward its target (~a few seconds)
  };

  // Traits plotted on the live chart, each normalized to its full genetic range
  // (the mutation clamp bounds) so three very different scales share one axis.
  const TRAITS = [
    { key: "speed",  label: "speed",  color: "#f4a259", lo: 0.25, hi: 2.6  },
    { key: "size",   label: "size",   color: "#7fd1c1", lo: 1.6,  hi: 6.5  },
    { key: "sense",  label: "sense",  color: "#a78bfa", lo: 12,   hi: 120  },
    { key: "social", label: "social", color: "#60a5fa", lo: -1.0, hi: 1.2  },
  ];

  // The same three genes for the *hunter* pool, drawn as dashed lines over the same
  // panel so the coevolutionary arms race is legible on both sides at once. Each is
  // normalized to the hunter's *own* clamp range (they're wider than the grazers'),
  // so "how far along its range" is comparable across the two species even though the
  // absolute scales differ. `src` is the live gene the history field is a mean of.
  const HUNTER_TRAITS = [
    { key: "hspeed", src: "speed", label: "speed", color: "#f4a259", lo: 0.6, hi: 3.2 },
    { key: "hsize",  src: "size",  label: "size",  color: "#7fd1c1", lo: 2.4, hi: 9 },
    { key: "hsense", src: "sense", label: "sense", color: "#a78bfa", lo: 24,  hi: 170 },
  ];

  // The trophic cascade over time: plants, grazers and hunters, bottom to top of
  // the food chain. Each is scaled to its *own* recent peak (their magnitudes span
  // orders of magnitude), so the panel reads as timing, not absolute counts — you
  // watch the peaks ripple upward plants → motes → hunters with a lag at each tier.
  const TIERS = [
    { key: "food",    label: "plants",  color: "#6cc08a" },
    { key: "pop",     label: "motes",   color: "#e88fb0" },
    { key: "hunters", label: "hunters", color: "#ff6b6b" },
  ];

  // The predation share of mote deaths over a trailing window of history samples:
  // pool the predation deaths (de) and starvation deaths (dd) across samples
  // [i-win+1 .. i] and return predation / (predation + starvation):
  //   →1  the hunters are claiming the herd (top-down control — an arms-race)
  //   →0  hunger is claiming the herd (bottom-up control — a grazer-haven)
  //   null nothing died in the window (rare; the band breaks rather than lying)
  // Honest by construction: it counts what actually killed the motes, so it can't
  // read backwards from the ecology the way a gene-gap index did. Pure function of
  // (history, index, window), so the smoke test can assert it on synthetic arrays.
  function predationShare(hist, i, win) {
    let e = 0, d = 0;
    for (let k = Math.max(0, i - win + 1); k <= i; k++) {
      if (!hist[k]) continue;
      e += hist[k].de || 0;
      d += hist[k].dd || 0;
    }
    const tot = e + d;
    return tot > 0 ? e / tot : null;
  }

  // ---- the world's randomness ---------------------------------------------
  // Every stochastic thing in this world — where the fertility gratings fall, which
  // cell sprouts, how a genome mutates, whether an old hunter's number comes up —
  // draws from `rng`, and nothing calls Math.random directly. Unseeded, `rng` IS
  // Math.random and every load is a fresh, unrepeatable world. Give it a seed and the
  // world becomes *reproducible*: the same number always grows the same meadow, the
  // same herd, the same collapse. That is what makes a world shareable (a URL hash)
  // and an experiment repeatable (`observe.js --census`, and the now-paired
  // `--split-test`). mulberry32: 32 bits of state, one multiply, small enough to read
  // in a sitting and far better distributed than anything hand-rolled would be.
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rngSeed = null;              // null = unseeded; a uint32 = this world's name
  let rng = Math.random;
  // Point the world's randomness at a seed (or back at Math.random with null).
  // Returns the normalized seed so a caller can display exactly what it got.
  function setSeed(s) {
    const v = s == null || !Number.isFinite(Number(s)) ? null : Number(s) >>> 0;
    rngSeed = v;
    rng = v == null ? Math.random : mulberry32(v);
    return v;
  }
  const randomSeed = () => (Math.random() * 4294967296) >>> 0;   // a fresh world's name

  // ---- helpers ------------------------------------------------------------
  const rand = (a, b) => a + rng() * (b - a);
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const wrap = (x, max) => (x < 0 ? x + max : x >= max ? x - max : x);

  function mutate(v, amt, lo, hi) {
    return clamp(v + rand(-amt, amt), lo, hi);
  }

  // Shortest separation on the torus: an edge wraps, so predators and fleeing prey
  // reckon distance and bearing across the seams, not just within the rectangle.
  const HW = W / 2, HH = H / 2;
  function torusD2(ax, ay, bx, by) {
    let dx = ax - bx; if (dx > HW) dx -= W; else if (dx < -HW) dx += W;
    let dy = ay - by; if (dy > HH) dy -= H; else if (dy < -HH) dy += H;
    return dx * dx + dy * dy;
  }
  // Bearing from (ax,ay) toward (bx,by) across the nearest seam.
  function torusAngle(ax, ay, bx, by) {
    let dx = bx - ax; if (dx > HW) dx -= W; else if (dx < -HW) dx += W;
    let dy = by - ay; if (dy > HH) dy -= H; else if (dy < -HH) dy += H;
    return Math.atan2(dy, dx);
  }
  const FEARFLOOR2 = CONFIG.fearFloor * CONFIG.fearFloor;

  // ---- the vegetation grid ------------------------------------------------
  // A toroidal lattice of cells laid over the field. Each cell holds a plant
  // density in [0, ~1]; a static fertility map gives each cell a carrying
  // capacity, so some regions are naturally lush and others barren.
  const GRID = { cols: (W / CONFIG.vegCell) | 0, rows: (H / CONFIG.vegCell) | 0 };
  GRID.n = GRID.cols * GRID.rows;

  function cellIndex(x, y) {
    const { cols, rows } = GRID;
    let cx = Math.floor(x / CONFIG.vegCell);
    let cy = Math.floor(y / CONFIG.vegCell);
    cx = ((cx % cols) + cols) % cols;
    cy = ((cy % rows) + rows) % rows;
    return cy * cols + cx;
  }
  const vegAtPoint = (x, y) => world.veg[cellIndex(x, y)];

  // Neighbour grid — a coarser bucket grid than the veg cells, sized so a 3×3 scan of
  // buckets covers socialRadius. Rebuilt each tick from the herd's positions (mote object
  // refs), so the cohesion/avoidance/crowd query stays O(n) instead of the naive O(n²).
  // Kept separate from the veg grid because the social scale (20px) is not the food scale.
  const FLOCK = { cols: Math.ceil(W / CONFIG.socialCell), rows: Math.ceil(H / CONFIG.socialCell) };
  FLOCK.n = FLOCK.cols * FLOCK.rows;
  const flockBuckets = new Array(FLOCK.n);
  for (let i = 0; i < FLOCK.n; i++) flockBuckets[i] = [];
  function flockCell(x, y) {
    let cx = Math.floor(x / CONFIG.socialCell);
    let cy = Math.floor(y / CONFIG.socialCell);
    cx = ((cx % FLOCK.cols) + FLOCK.cols) % FLOCK.cols;
    cy = ((cy % FLOCK.rows) + FLOCK.rows) % FLOCK.rows;
    return cy * FLOCK.cols + cx;
  }
  // Snapshot every mote into its flock bucket and freeze its start-of-tick position, so
  // neighbour reads during the loop are consistent even as motes move and splice. Called
  // once at the top of each step() before the herd moves. Returns nothing; fills buckets.
  function rebuildFlock() {
    for (let i = 0; i < FLOCK.n; i++) flockBuckets[i].length = 0;
    const ms = world.motes;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      m._px = m.x; m._py = m.y;                    // frozen reference position for this tick
      flockBuckets[flockCell(m.x, m.y)].push(m);
    }
  }
  // Scan the 3×3 neighbour-cell neighbourhood of mote m and fill two outputs on `_flock`:
  // `crowd` (neighbours within socialRadius — the density signal, for the tint and readout)
  // and a steer (`sx`,`sy`) blending the SIGNED cohesion (>0 toward the crowd, <0 away from
  // it — wariness) with gene-independent close-range separation. Reads frozen positions
  // (_px/_py). No RNG, so it never perturbs the seedable stream.
  const _flock = { crowd: 0, sx: 0, sy: 0 };
  function senseFlock(m) {
    const R2 = CONFIG.socialRadius * CONFIG.socialRadius;
    const SEP2 = CONFIG.socialSep * CONFIG.socialSep;
    let crowd = 0, cx = 0, cy = 0, ncoh = 0, rx = 0, ry = 0;
    const bcx = Math.floor(m.x / CONFIG.socialCell);
    const bcy = Math.floor(m.y / CONFIG.socialCell);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        let gx = ((bcx + ox) % FLOCK.cols + FLOCK.cols) % FLOCK.cols;
        let gy = ((bcy + oy) % FLOCK.rows + FLOCK.rows) % FLOCK.rows;
        const bucket = flockBuckets[gy * FLOCK.cols + gx];
        for (let k = 0; k < bucket.length; k++) {
          const p = bucket[k];
          if (p === m) continue;
          let dx = p._px - m.x; if (dx > HW) dx -= W; else if (dx < -HW) dx += W;
          let dy = p._py - m.y; if (dy > HH) dy -= H; else if (dy < -HH) dy += H;
          const d2 = dx * dx + dy * dy;
          if (d2 > R2) continue;
          crowd++;
          cx += dx; cy += dy; ncoh++;              // toward the local centre of mass
          if (d2 < SEP2 && d2 > 0) {               // too close: steer away, harder when nearer
            const w = (SEP2 - d2) / SEP2;
            const inv = w / Math.sqrt(d2);
            rx -= dx * inv; ry -= dy * inv;
          }
        }
      }
    }
    // a signed cohesion unit vector toward the centroid — the gene's sign flips it: a
    // sociable mote (social>0) steers into the crowd, a wary one (social<0) steers out of
    // it. Separation is gene-independent, so even a clusterer never stacks bodies.
    let sx = 0, sy = 0;
    if (ncoh > 0) {
      const clen = Math.sqrt(cx * cx + cy * cy);
      if (clen > 0) { sx = (cx / clen) * m.g.social * CONFIG.socialCohesion; sy = (cy / clen) * m.g.social * CONFIG.socialCohesion; }
    }
    sx += rx * CONFIG.socialSeparation; sy += ry * CONFIG.socialSeparation;
    _flock.crowd = crowd; _flock.sx = sx; _flock.sy = sy;
    return _flock;
  }

  // A genome's intrinsic capacity to hide, in [0, 1] — its *lifestyle*, independent of
  // where it is standing. Hiding needs a small body (inconspicuous) AND a slow gene
  // (able to hold still — motion gives you away). 1 = a perfect hider genotype, 0 = a
  // pure fleer. This is the axis predation can split the herd along, and draw() tints
  // each mote by it so the two lifestyles are visible whether or not the pool has
  // formally clustered.
  function hideability(g) {
    const small = clamp(
      (CONFIG.coverSizeSeen - g.size) / (CONFIG.coverSizeSeen - CONFIG.coverSizeHide), 0, 1);
    const slow = clamp(
      (CONFIG.coverSpeedSeen - g.speed) / (CONFIG.coverSpeedSeen - CONFIG.coverSpeedHide), 0, 1);
    return small * slow;
  }

  // How hidden a mote is from hunters RIGHT NOW, in [0, coverStrength]: its lifestyle
  // capacity to hide, times the density of the vegetation it is actually standing in
  // (no cover on bare ground). The hunt reads this to shrink its sight and strike range
  // toward a concealed mote; the grazer reads it to decide whether to freeze or bolt.
  function concealment(m) {
    const veg = world.veg[cellIndex(m.x, m.y)];
    if (veg <= CONFIG.coverVegMin) return 0;
    const cover = veg > 1 ? 1 : veg;                       // lush cells hide best
    return CONFIG.coverStrength * cover * hideability(m.g);
  }

  // Metabolism's benefit side: the multiplier on energy gained per bite. Concave and
  // neutral at metabo=1, so a fast burner (metabo>1) digests each bite a little more
  // thoroughly while paying a linearly higher always-on burn — a classic fast/slow
  // life-history tradeoff whose optimum depends on how much food is around. Exported so
  // smoke.js can assert its shape deterministically; nothing but the graze reads it.
  function metaboIntakeMult(metabo) {
    return Math.max(0, 1 + CONFIG.metaboIntake * (Math.pow(metabo, CONFIG.metaboIntakeExp) - 1));
  }

  // Sprint drag: the extra per-tick burn a speed-optimised body carries, as a term added
  // to the movement cost in step(). Zero at or below speedDragFrom (normal grazers pay
  // nothing new, so the tuned low-mid economy is untouched), then rising with the SQUARE of
  // the excess above it — so each extra notch of top-end speed costs more than the last and
  // the arms race settles at an interior optimum instead of slamming its clamp. Exported so
  // smoke.js can assert its shape (zero below, convex & monotone above); only the mote burn
  // reads it. See the CONFIG comment for how speedDragCost was tuned.
  function sprintDrag(speed) {
    const over = speed - CONFIG.speedDragFrom;
    return over > 0 ? CONFIG.speedDragCost * over * over : 0;
  }

  // The predator side of the same tradeoff: the multiplier on the digested (assimilated)
  // share of a kill. Same concave, neutral-at-1 shape as metaboIntakeMult, so a fast-burning
  // hunter (metabo>1) extracts more from each mote while paying a linearly higher always-on
  // burn — giving the predator tier its own food-dependent interior optimum instead of a gene
  // that only ever decays. Exported so smoke.js can assert its shape; only the strike reads it.
  function huntMetaboMult(metabo) {
    return Math.max(0, 1 + CONFIG.huntMetaboAssim * (Math.pow(metabo, CONFIG.huntMetaboAssimExp) - 1));
  }

  // Fertility: a smooth patchy carrying-capacity map from a few random sine
  // gratings, normalized into [fertMin, 1]. This is what gives the world a
  // permanent character — rich meadows and stubborn barrens that persist.
  function buildFertility() {
    const { cols, rows } = GRID;
    const fert = new Float64Array(cols * rows);
    const waves = [];
    for (let k = 0; k < 3; k++) {
      waves.push({
        fx: (rand(0.5, 2.2) * TAU) / cols,
        fy: (rand(0.5, 2.2) * TAU) / rows,
        ph: rand(0, TAU),
        amp: rand(0.5, 1),
      });
    }
    let min = Infinity, max = -Infinity;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let v = 0;
        for (const w of waves) v += w.amp * Math.sin(x * w.fx + y * w.fy + w.ph);
        const i = y * cols + x;
        fert[i] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const span = max - min || 1;
    for (let i = 0; i < fert.length; i++) {
      const t = (fert[i] - min) / span;
      fert[i] = CONFIG.fertMin + (1 - CONFIG.fertMin) * t;
    }
    return fert;
  }

  function biomass() {
    let s = 0;
    for (let i = 0; i < world.veg.length; i++) s += world.veg[i];
    return s;
  }

  // ---- seasons ------------------------------------------------------------
  // A slow global cycle makes the economy breathe: summers of plenty, lean
  // winters. seasonWave is a sine in [-1, 1] driven by the tick; seasonGrow
  // turns it into a growth/seeding multiplier kept above zero by the amplitude.
  const seasonWave = () => Math.sin((world.tick / CONFIG.seasonPeriod) * TAU);
  const seasonGrow = () => 1 + CONFIG.seasonAmplitude * seasonWave();

  // ---- entities -----------------------------------------------------------
  function makeGenome(parent) {
    if (!parent) {
      return {
        speed: rand(0.4, 1.6),
        size: rand(2.2, 4.5),
        sense: rand(24, 70),
        metabo: rand(0.8, 1.3),
        hue: rand(120, 200),
        social: rand(-0.3, 0.5),   // sociability: <0 herd-averse (spaces out), >0 herd-seeking
      };
    }
    return {
      speed: mutate(parent.speed, 0.18, 0.25, 2.6),
      size: mutate(parent.size, 0.4, 1.6, 6.5),
      sense: mutate(parent.sense, 8, 12, 120),
      metabo: mutate(parent.metabo, 0.12, 0.6, 1.8),
      hue: mutate(parent.hue, 12, 0, 359),
      social: mutate(parent.social, 0.1, -1.0, 1.2),
    };
  }

  function makeMote(x, y, genome) {
    return {
      x, y,
      dir: rand(0, TAU),
      energy: CONFIG.startEnergy,
      matter: CONFIG.bodyMatter,   // its body, in the same units as vegetation
      age: 0,
      g: genome || makeGenome(null),
    };
  }

  // Hunters carry the same five-gene genome as motes but on predatory ranges:
  // faster, keener-sensed, and coloured in a hot band (reds/oranges) so they read
  // as a distinct species at a glance and never drift into the grazers' greens.
  function makeHunterGenome(parent) {
    if (!parent) {
      return {
        speed: rand(1.1, 2.0),
        size: rand(3.6, 5.6),
        sense: rand(55, 100),
        metabo: rand(0.8, 1.3),
        hue: rand(2, 34),
      };
    }
    return {
      speed: mutate(parent.speed, 0.16, 0.6, 3.2),
      size: mutate(parent.size, 0.35, 2.4, 9),
      sense: mutate(parent.sense, 8, 24, 170),
      metabo: mutate(parent.metabo, 0.1, 0.55, 1.8),
      hue: mutate(parent.hue, 6, 0, 45),
    };
  }

  function makeHunter(x, y, genome) {
    return {
      x, y,
      dir: rand(0, TAU),
      energy: CONFIG.hunterStartEnergy,
      matter: CONFIG.bodyMatter,   // predators carry a body on the same ledger
      age: 0,
      cool: 0,               // digestion timer; >0 means sated and not hunting
      homeX: x, homeY: y,   // kill centroid — starts at spawn, drifts toward kills
      g: genome || makeHunterGenome(null),
    };
  }

  // ---- world state --------------------------------------------------------
  const world = {
    motes: [],
    hunters: [],                        // the second tier: predators that eat motes
    sparks: [],                         // transient kill-flashes where a mote was caught
    veg: new Float64Array(GRID.n),      // plant density per cell
    vegNext: new Float64Array(GRID.n),  // scratch buffer for the diffusion pass
    fert: new Float64Array(GRID.n),     // static carrying capacity per cell
    soil: new Float64Array(GRID.n),     // nutrients per cell — the pool plants grow OUT of
    soilNext: new Float64Array(GRID.n), // scratch buffer for the soil leaching pass
    graze: new Float64Array(GRID.n),    // decaying record of recent grazing (view only)
    tick: 0,
    born: 0,
    died: 0,                            // motes lost to starvation (predation is `eaten`)
    eaten: 0,                           // motes caught by hunters
    hunterBorn: 0,
    hunterDied: 0,
    hunterAged: 0,                      // subset of hunterDied that died of old age (senescence)
    paused: false,
    stepsPerFrame: 2,
    overlay: 0,    // hidden-landscape lens: 0 off · 1 fertility · 2 grazing · 3 soil nutrients
    history: [],   // rolling samples of trait averages + counts
    morphs: { k: 1, n: 0, gene: null, n0: 0, n1: 0, sep: 0 }, // live morph readout
    _morphPendK: 1, // hysteresis: proposed k awaiting confirmation
    _morphPendN: 0, // consecutive samples agreeing on the proposed k
    _prevEaten: 0,  // cumulative predation/starvation deaths at the last sample, so
    _prevDied: 0,   // each sample can record how many of each happened in its window
    // where the world sits in its predator–prey cycle, read live off the history buffer
    regime: { state: "settling", trend: "steady", label: "settling — reading the world…",
              hmean: 0, base: 0, flash: 0, flashText: "", flashWarm: true },
    seedValue: null,   // this world's name: a uint32 if seeded, null if freely random
  };

  // Build a fresh world. Pass a number and this world becomes reproducible: the RNG
  // stream is rewound to that seed before a single grating, mote or hunter is drawn,
  // so `seed(1234)` always grows exactly the same world. Pass nothing and whatever
  // randomness is currently installed simply continues — which is what every existing
  // caller (the harnesses' "run several seeds" habit) already wanted. Pass an explicit
  // `null` to hand the world back to Math.random and stop being reproducible.
  function seed(s) {
    if (s !== undefined) setSeed(s);
    world.seedValue = rngSeed;
    world.fert = buildFertility();
    world.veg = new Float64Array(GRID.n);
    world.vegNext = new Float64Array(GRID.n);
    world.soil = new Float64Array(GRID.n);
    world.soilNext = new Float64Array(GRID.n);
    world.graze = new Float64Array(GRID.n);
    for (let i = 0; i < GRID.n; i++) {
      world.veg[i] = world.fert[i] * CONFIG.startVegFrac;
      world.soil[i] = world.fert[i] * CONFIG.soilStart;
    }
    world.motes = [];
    world.hunters = [];
    world.sparks = [];
    world.killLog = [];   // [{x, y, tick}] ring buffer of recent kill sites
    world.tick = 0;
    world.born = 0;
    world.died = 0;
    world.eaten = 0;
    world._prevEaten = 0;
    world._prevDied = 0;
    world.hunterBorn = 0;
    world.hunterDied = 0;
    world.hunterAged = 0;
    world.history = [];
    world.morphs = { k: 1, n: 0, gene: null, n0: 0, n1: 0, sep: 0 };
    world._morphPendK = 1;
    world._morphPendN = 0;
    world.regime = { state: "settling", trend: "steady", label: "settling — reading the world…",
                     hmean: 0, base: 0, projBase: 0, secular: 0, building: 0,
                     flash: 0, flashText: "", flashWarm: true };
    world.mood = 0;          // eased predation-cycle atmosphere: +1 surging (warm/tense), -1 collapsed (cold/hollow)
    for (let i = 0; i < CONFIG.startMotes; i++) {
      world.motes.push(makeMote(rand(0, W), rand(0, H)));
    }
    for (let i = 0; i < CONFIG.hunterStart; i++) {
      world.hunters.push(makeHunter(rand(0, W), rand(0, H)));
    }
  }

  // ---- vegetation dynamics ------------------------------------------------
  // Logistic regrowth toward each cell's fertility, scaled by the season — but now
  // paid for out of the cell's SOIL. Two changes from the old free-matter version,
  // and between them they are what turned the meadow's slow death into a cycle:
  //
  //   1. the growth term reads (v + soilGerm·richness) instead of v alone, so bare
  //      ground is no longer an absorbing state — a cell grazed to zero germinates
  //      again as soon as there are nutrients under it, and the richer the ground the
  //      faster it greens. This is why a carcass now leaves a patch that visibly blooms.
  //   2. every unit of new growth is DRAWN from soil[i], so the meadow can only be as
  //      lush as the ground is fed. Growth stops when the nutrients run out, not when
  //      an arbitrary constant says so.
  function growVeg() {
    const veg = world.veg, fert = world.fert, soil = world.soil;
    const g = CONFIG.vegGrowth * seasonGrow();
    const germ = CONFIG.soilGerm;
    for (let i = 0; i < veg.length; i++) {
      const v = veg[i];
      const s = soil[i];
      const rich = s < 1 ? (s > 0 ? s : 0) : 1;   // nutrient availability, 0..1
      let dv = g * (v + germ * rich) * (fert[i] - v);
      if (dv > 0) {
        if (dv > s) dv = s;                  // can't grow more matter than the soil holds
        soil[i] = s - dv;
      } else if (dv < 0) {
        // die-back. Diffusion keeps spilling green onto ground poorer than it, which then
        // shrinks toward the local carrying capacity — and that shrinkage is LITTER, not a
        // hole in the world. Returning it here is what finally closed the budget: while
        // this branch silently deleted matter, the world bled ~260 units per 300 ticks and
        // the "conserved" cycle was still a ratchet wearing a better costume.
        const back = -dv;
        soil[i] = s + back > CONFIG.soilMax ? CONFIG.soilMax : s + back;
      }
      let nv = v + dv;
      if (nv < 0) nv = 0;
      veg[i] = nv;
    }
  }

  // Nutrients leach slowly sideways, so a corpse's richness bleeds into the ground
  // around it instead of staying a single hot cell. Much slower than vegSpread — soil
  // moves in hundreds of ticks, grass in tens. Double-buffered like the veg pass.
  function spreadSoil() {
    const { cols, rows } = GRID;
    const soil = world.soil, nx = world.soilNext;
    const k = CONFIG.soilSpread, cap = CONFIG.soilMax;
    for (let y = 0; y < rows; y++) {
      const up = ((y - 1 + rows) % rows) * cols;
      const dn = ((y + 1) % rows) * cols;
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        const i = row + x;
        const l = soil[row + ((x - 1 + cols) % cols)];
        const r = soil[row + ((x + 1) % cols)];
        const lap = l + r + soil[up + x] + soil[dn + x] - 4 * soil[i];
        let nv = soil[i] + k * lap;
        if (nv < 0) nv = 0; else if (nv > cap) nv = cap;
        nx[i] = nv;
      }
    }
    world.soil = nx;
    world.soilNext = soil;
  }

  // Every return path into the ground goes through here, so the nutrient budget has
  // exactly one door and `soilMax` can't be bypassed by a caller that forgot it.
  //
  // A full cell SPILLS to its neighbours rather than deleting the surplus. This matters
  // more than it looks: predators kill in clusters, so a busy hunting ground buries far
  // more matter in one cell than `soilMax` allows, and simply clamping there quietly
  // destroyed it — the matter ledger caught exactly that, reporting "RUNNING DOWN" in 3
  // of 4 kill-heavy draws while a calmer world read "HOLDING". Spilling turns a hotspot
  // into a spreading patch of richness, which is also what a real carcass does.
  const SPILL = [-1, 1, 0, 0];
  function enrich(i, amount) {
    const cap = CONFIG.soilMax, soil = world.soil;
    let s = soil[i] + amount;
    if (s <= cap) { soil[i] = s; return; }
    soil[i] = cap;
    let over = s - cap;
    const { cols, rows } = GRID;
    const x = i % cols, y = (i / cols) | 0;
    const share = over / 4;
    for (let k = 0; k < 4; k++) {
      const nx = k < 2 ? (x + SPILL[k] + cols) % cols : x;
      const ny = k < 2 ? y : (y + SPILL[k] + rows) % rows;
      const j = ny * cols + nx;
      const t = soil[j] + share;
      soil[j] = t > cap ? cap : t;   // neighbours full too: the surplus is genuinely lost,
    }                                // which keeps the pool bounded above. Bounded, not leaky.
  }

  // Diffusion: green bleeds into neighbouring cells so patches expand as fronts
  // and grazed corridors slowly close over. Double-buffered to stay isotropic.
  function spreadVeg() {
    const { cols, rows } = GRID;
    const veg = world.veg, nx = world.vegNext;
    const k = CONFIG.vegSpread;
    for (let y = 0; y < rows; y++) {
      const up = ((y - 1 + rows) % rows) * cols;
      const dn = ((y + 1) % rows) * cols;
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        const i = row + x;
        const l = veg[row + ((x - 1 + cols) % cols)];
        const r = veg[row + ((x + 1) % cols)];
        const lap = l + r + veg[up + x] + veg[dn + x] - 4 * veg[i];
        let nv = veg[i] + k * lap;
        if (nv < 0) nv = 0;
        nx[i] = nv;
      }
    }
    world.veg = nx;
    world.vegNext = veg;
  }

  // Spontaneous seeds: a few new sprouts land on random ground each tick (scaled
  // by season and by local fertility), replacing the old uniform food rain and
  // letting fresh patches — and post-wipeout recovery — begin.
  function sowSeeds() {
    let s = CONFIG.vegSeedRate * seasonGrow();
    const veg = world.veg, fert = world.fert, soil = world.soil;
    while (s > 0) {
      if (s >= 1 || rng() < s) {
        const i = (rng() * veg.length) | 0;
        let start = CONFIG.vegSeedAmount * fert[i];
        // a sprout is matter too: it can only start as big as the ground can fund
        if (start > soil[i] + veg[i]) start = soil[i] + veg[i];
        if (veg[i] < start) { soil[i] -= start - veg[i]; veg[i] = start; }
      }
      s -= 1;
    }
  }

  // Grazing pressure is a view-only leaky heat field: it fades a little each tick
  // so the overlay shows *recent* eating. Motes add to it when they graze; nothing
  // in the economy ever reads it back, so it can't perturb the world.
  function decayGraze() {
    const gz = world.graze, d = CONFIG.grazeDecay;
    for (let i = 0; i < gz.length; i++) gz[i] *= d;
  }

  // ---- morph detection ----------------------------------------------------
  // A population's *mean* hides its *shape*: a mean sense of 40 could be one broad
  // cloud or two morphs — a keen one and a dull one — averaged together, and the
  // trait chart (means only) can't tell them apart. This clusters the live grazer
  // pool in normalized gene space and asks whether it has genuinely SPLIT. It is
  // deliberately conservative: a single broad cloud must read as ONE morph, because
  // a naive 2-means always finds *a* split and a detector that always cries
  // "speciation!" is worthless. Only a real valley between two substantial clusters
  // counts. Pure measurement — nothing in the economy ever reads world.morphs back.
  const MORPH_GENES = [
    { key: "speed",  lo: 0.25, hi: 2.6,  hiName: "swift",      loName: "slow"     },
    { key: "size",   lo: 1.6,  hi: 6.5,  hiName: "large",      loName: "small"    },
    { key: "sense",  lo: 12,   hi: 120,  hiName: "keen",       loName: "dull"     },
    { key: "metabo", lo: 0.6,  hi: 1.8,  hiName: "greedy",     loName: "thrifty"  },
    { key: "social", lo: -1.0, hi: 1.2,  hiName: "sociable",   loName: "wary"     },
  ];
  const MORPH = {
    minPop: 30,        // fewer grazers than this: don't presume to name morphs
    minFrac: 0.18,     // the smaller morph must be at least this share of the pool
    valleyRatio: 0.70, // the dip between the two peaks must fall to ≤ this × smaller peak
    minGap: 0.12,      // centroids at least this far apart in the normalized [0,1]⁴ space
    hist: 20,          // bins for the valley test along the separating axis
  };

  // Normalize each gene to [0,1] over its clamp range so the four axes are comparable.
  function morphFeatures(motes) {
    const G = MORPH_GENES, dim = G.length, F = new Array(motes.length);
    for (let i = 0; i < motes.length; i++) {
      const g = motes[i].g, v = new Array(dim);
      for (let d = 0; d < dim; d++) v[d] = (g[G[d].key] - G[d].lo) / (G[d].hi - G[d].lo);
      F[i] = v;
    }
    return F;
  }

  // Deterministic Lloyd 2-means (no RNG, so the readout is stable frame to frame):
  // seed the two centroids at the extremes of the highest-variance axis, then relax.
  function twoMeans(F) {
    const n = F.length, dim = F[0].length;
    let axis = 0, bestVar = -1;
    for (let d = 0; d < dim; d++) {
      let m = 0; for (let i = 0; i < n; i++) m += F[i][d]; m /= n;
      let s = 0; for (let i = 0; i < n; i++) { const e = F[i][d] - m; s += e * e; } s /= n;
      if (s > bestVar) { bestVar = s; axis = d; }
    }
    let lo = null, hi = null, vlo = Infinity, vhi = -Infinity;
    for (let i = 0; i < n; i++) {
      const a = F[i][axis];
      if (a < vlo) { vlo = a; lo = F[i]; }
      if (a > vhi) { vhi = a; hi = F[i]; }
    }
    const c0 = lo.slice(), c1 = hi.slice(), assign = new Int8Array(n);
    for (let it = 0; it < 12; it++) {
      for (let i = 0; i < n; i++) {
        let d0 = 0, d1 = 0;
        for (let d = 0; d < dim; d++) { const a = F[i][d] - c0[d], b = F[i][d] - c1[d]; d0 += a * a; d1 += b * b; }
        assign[i] = d1 < d0 ? 1 : 0;
      }
      const s0 = new Array(dim).fill(0), s1 = new Array(dim).fill(0);
      let n0 = 0, n1 = 0;
      for (let i = 0; i < n; i++) {
        const t = assign[i], s = t ? s1 : s0;
        for (let d = 0; d < dim; d++) s[d] += F[i][d];
        if (t) n1++; else n0++;
      }
      if (n0 === 0 || n1 === 0) break;
      for (let d = 0; d < dim; d++) { c0[d] = s0[d] / n0; c1[d] = s1[d] / n1; }
    }
    return { c0, c1, assign };
  }

  // Is the grazer pool one cloud or two morphs? Returns { k, gene, n0, n1, sep }.
  // The gate is a genuine VALLEY between two substantial clusters, not merely the
  // fact that 2-means found a dividing line (it always will) — see the comment above.
  function classifyMorphs(motes) {
    const n = motes.length;
    if (n < MORPH.minPop) return { k: 1, n, gene: null, n0: n, n1: 0, sep: 0 };
    const F = morphFeatures(motes), dim = F[0].length;
    const { c0, c1, assign } = twoMeans(F);
    let n0 = 0, n1 = 0;
    for (let i = 0; i < n; i++) assign[i] ? n1++ : n0++;
    if (n0 === 0 || n1 === 0) return { k: 1, n, gene: null, n0: n, n1: 0, sep: 0 };
    const frac = Math.min(n0, n1) / n;

    // unit vector from centroid 0 toward centroid 1
    const u = new Array(dim); let ulen = 0;
    for (let d = 0; d < dim; d++) { u[d] = c1[d] - c0[d]; ulen += u[d] * u[d]; }
    ulen = Math.sqrt(ulen);
    if (ulen < MORPH.minGap) return { k: 1, n, gene: null, n0, n1, sep: ulen };
    for (let d = 0; d < dim; d++) u[d] /= ulen;

    // project every mote onto that axis and histogram the projection
    const proj = new Array(n); let plo = Infinity, phi = -Infinity;
    for (let i = 0; i < n; i++) {
      let t = 0; for (let d = 0; d < dim; d++) t += F[i][d] * u[d];
      proj[i] = t; if (t < plo) plo = t; if (t > phi) phi = t;
    }
    const B = MORPH.hist, bins = new Array(B).fill(0), span = (phi - plo) || 1;
    for (let i = 0; i < n; i++) { let b = ((proj[i] - plo) / span * B) | 0; if (b < 0) b = 0; if (b >= B) b = B - 1; bins[b]++; }
    // smooth (3-wide) so a one-bin notch can't fake a valley
    const sm = new Array(B);
    for (let b = 0; b < B; b++) sm[b] = (bins[Math.max(0, b - 1)] + bins[b] + bins[Math.min(B - 1, b + 1)]) / 3;
    // where the two centroids land along the axis, as bin indices
    let t0 = 0, t1 = 0; for (let d = 0; d < dim; d++) { t0 += c0[d] * u[d]; t1 += c1[d] * u[d]; }
    let b0 = ((Math.min(t0, t1) - plo) / span * B) | 0, b1 = ((Math.max(t0, t1) - plo) / span * B) | 0;
    b0 = clamp(b0, 0, B - 1); b1 = clamp(b1, 0, B - 1);
    if (b1 - b0 < 2) return { k: 1, n, gene: null, n0, n1, sep: ulen };
    // a peak on each flank, the lowest point between them
    let peakL = 0; for (let b = 0; b <= b0; b++) if (sm[b] > peakL) peakL = sm[b];
    let peakR = 0; for (let b = b1; b < B; b++) if (sm[b] > peakR) peakR = sm[b];
    let trough = Infinity; for (let b = b0; b <= b1; b++) if (sm[b] < trough) trough = sm[b];
    const smaller = Math.min(peakL, peakR) || 1;
    const bimodal = trough <= MORPH.valleyRatio * smaller && frac >= MORPH.minFrac;
    if (!bimodal) return { k: 1, n, gene: null, n0, n1, sep: ulen };

    // name the split by the gene whose two centroids differ most (normalized units)
    let gi = 0, gbest = -1;
    for (let d = 0; d < dim; d++) { const diff = Math.abs(c1[d] - c0[d]); if (diff > gbest) { gbest = diff; gi = d; } }
    return { k: 2, n, gene: MORPH_GENES[gi].key, n0, n1, sep: ulen };
  }

  // ---- regime detection ---------------------------------------------------
  // Where is the world in its predator–prey CYCLE right now? A pure reading off the
  // history buffer. The recent hunter mean (regimeWindow ≈ 720 ticks) is compared to
  // the world's own BASELINE (regimeBaseWindow ≈ 4800 ticks, spanning ~a full boom-bust
  // cycle) — so the phase is judged relative to how predated THIS world is, not a fixed
  // count. States: "surge" (recent well above baseline → the predator boom, the cull
  // intensifying), "ebb" (well below → the bust, the herd's reprieve), "steady" (near
  // baseline). A Schmitt trigger on the surge/ebb crossing (regimeSurgeOn to enter,
  // regimeSurgeOff to leave) stops it strobing. One absolute state overrides the phase:
  // "collapsed" — baseline below regimeCollapseFloor means the predator tier has
  // genuinely FAILED (the rare ~4% world), not merely troughed. Nothing in the economy
  // reads world.regime back — it is pure narration, like the charts.
  function classifyRegime(history, prev) {
    if (!history || history.length < 8) {
      return { state: "settling", trend: "steady", label: "settling — reading the world…",
               hmean: 0, base: 0, projBase: 0, secular: 0, building: 0 };
    }
    const win = Math.min(CONFIG.regimeWindow, history.length);
    const s = history.slice(history.length - win);
    let sum = 0;
    for (let i = 0; i < win; i++) sum += s[i].hunters;
    const hmean = sum / win;                        // the recent predation level

    // the world's own baseline — a long trailing mean, so "surge" and "ebb" mean
    // "above/below THIS world's normal", not "above/below a starving world's counts"
    const bwin = Math.min(CONFIG.regimeBaseWindow, history.length);
    const bs = history.slice(history.length - bwin);
    let bsum = 0;
    for (let i = 0; i < bwin; i++) bsum += bs[i].hunters;
    const base = bsum / bwin;                        // window mean (still the collapse gate)

    // DETREND the baseline: fit a least-squares line to the window and project it forward to
    // the recent window's centre, so a steadily-CLIMBING tier isn't perpetually read "surging"
    // just because a rising series always sits above its own trailing mean. slope is per-sample;
    // projBase is where the fitted line predicts the level at the recent window's centre.
    const meanX = (bwin - 1) / 2;
    let num = 0, den = 0;
    for (let i = 0; i < bwin; i++) {
      const dx = i - meanX;
      num += dx * (bs[i].hunters - base);
      den += dx * dx;
    }
    const baseSlope = den > 0 ? num / den : 0;           // hunters per history-sample
    const projBase = base + baseSlope * (bwin - win) / 2; // baseline carried to the recent window
    // secular = the baseline's fractional change across the WHOLE window — a slow establishment
    // ramp or a slow decline, distinct from the fast boom-bust the surge/ebb phase reads
    const secular = (baseSlope * bwin) / Math.max(1, base);

    // trend: mean of the recent window's first half vs its second half — is predation
    // climbing or falling right now (colours the label and softens the mood ease)
    const half = Math.max(1, win >> 1);
    let early = 0, late = 0;
    for (let i = 0; i < half; i++) early += s[i].hunters;
    for (let i = win - half; i < win; i++) late += s[i].hunters;
    const slope = late / half - early / half;
    const trendThr = Math.max(1.5, base * 0.06);
    const trend = slope > trendThr ? "rising" : slope < -trendThr ? "falling" : "level";

    // "collapsed" is a strong claim — the predators have genuinely FAILED — so it must be
    // confident: a mature baseline (we've watched long enough to tell failure from youth),
    // with BOTH the long baseline and the recent window under the floor. Otherwise a fresh
    // world's predators-still-establishing reads as a false collapse (and a false recovery
    // banner when they finish establishing). A young or recovering world falls through to
    // the phase logic instead — climbing predators read, correctly, as a surge.
    const mature = history.length >= CONFIG.regimeBaseWindow;
    let state;
    if (mature && base < CONFIG.regimeCollapseFloor && hmean < CONFIG.regimeCollapseFloor) {
      state = "collapsed";
    } else {
      const rel = (hmean - projBase) / Math.max(1, projBase);  // recent vs the PROJECTED baseline
      const on = CONFIG.regimeSurgeOn, off = CONFIG.regimeSurgeOff;
      const wasSurge = prev === "surge", wasEbb = prev === "ebb";
      if (rel >= on || (wasSurge && rel > off)) state = "surge";
      else if (rel <= -on || (wasEbb && rel < -off)) state = "ebb";
      else state = "steady";
    }

    // a "steady" phase riding a strong secular slope is annotated "building"/"thinning" — the
    // tier is establishing or receding over the long horizon even though it isn't departing
    // from its own trend right now. This is the state the detrend rescued from a false "surge".
    const building = state === "steady" && secular >= CONFIG.regimeBuildOn ? 1
                   : state === "steady" && secular <= -CONFIG.regimeBuildOn ? -1 : 0;
    const label =
      state === "collapsed" ? (trend === "rising" ? "predators collapsed — clawing back ↑" : "predators collapsed — the herd runs free") :
      state === "surge"     ? "predation surging — the cull intensifies ↑" :
      state === "ebb"       ? "predation ebbing — the herd's reprieve ↓" :
      building > 0          ? "predation building — the tier is establishing ↑" :
      building < 0          ? "predation thinning — the tier is receding ↓" :
                              "predation steady — the cycle holds";
    return { state, trend, label, hmean, base, projBase, secular, building };
  }

  // The world's "mood" target for a given regime phase: warm/tense when predation is
  // surging (+1), cooling as it ebbs (−0.55), coldest and most hollow when the predators
  // have collapsed (−1), neutral while steady or settling. So the meadow's light now
  // BREATHES with the boom-bust cycle instead of sitting one colour for a whole world. A
  // trend that softens the phase (a surge cresting, a collapse recovering) relaxes the
  // target toward neutral so the light eases ahead of the label. Pure narration: draw()
  // eases world.mood toward this; nothing reads it back.
  function regimeMood(r) {
    if (!r) return 0;
    if (r.state === "surge")     return r.trend === "falling" ?  0.45 :  1;
    if (r.state === "ebb")       return r.trend === "rising"  ? -0.25 : -0.55;
    if (r.state === "collapsed") return r.trend === "rising"  ? -0.4  : -1;
    return 0;   // steady / settling
  }

  // ---- history sample -----------------------------------------------------
  // One rolling sample records both the gene-pool shape (for the trait chart)
  // and the raw population/biomass counts (for the boom-and-bust chart).
  function sample() {
    const n = world.motes.length;
    let speed = 0, size = 0, sense = 0, social = 0;
    for (const m of world.motes) {
      speed += m.g.speed;
      size += m.g.size;
      sense += m.g.sense;
      social += m.g.social;
    }
    const inv = n > 0 ? 1 / n : 0;
    // hunter gene means, tracked so the predator pool has its own curves on the
    // trait chart. null when the tier is empty so the chart breaks the line rather
    // than drawing a phantom crash to zero (a collapse leaves a gap, not a plunge).
    const hn = world.hunters.length;
    let hspeed = 0, hsize = 0, hsense = 0;
    for (const h of world.hunters) {
      hspeed += h.g.speed;
      hsize += h.g.size;
      hsense += h.g.sense;
    }
    const hinv = hn > 0 ? 1 / hn : 0;
    // deaths since the last sample, split by cause, so the death-balance chart can
    // ask what is actually killing the herd — hunters (predation) or hunger.
    const de = world.eaten - world._prevEaten;
    const dd = world.died - world._prevDied;
    world._prevEaten = world.eaten;
    world._prevDied = world.died;
    world.history.push({
      speed: speed * inv,
      size: size * inv,
      sense: sense * inv,
      social: social * inv,   // mean grazer sociability — <0 wary, >0 sociable
      hspeed: hn > 0 ? hspeed * hinv : null,
      hsize: hn > 0 ? hsize * hinv : null,
      hsense: hn > 0 ? hsense * hinv : null,
      pop: n,
      hunters: hn,
      food: Math.round(biomass()),
      de, dd,   // predation deaths / starvation deaths this window
    });
    if (world.history.length > CONFIG.historyCap) world.history.shift();

    // update the morph readout on the same cadence, with light hysteresis so the
    // HUD doesn't flicker between 1 and 2 on a marginal sample: a change in morph
    // count must persist for three samples (~90 ticks) before it's committed.
    const cls = classifyMorphs(world.motes);
    if (cls.k === world._morphPendK) world._morphPendN++;
    else { world._morphPendK = cls.k; world._morphPendN = 1; }
    if (world._morphPendN >= 3 || cls.k === world.morphs.k) world.morphs = cls;

    // update the live regime readout on the same cadence. The surge/steady/ebb phases
    // turn over every cycle, so banner-ing each one would spam; instead the banner is
    // reserved for the rare, dramatic event — the predator tier genuinely COLLAPSING or
    // CLAWING BACK. (Entering collapsed from anything but settling, or leaving it.)
    const rg = classifyRegime(world.history, world.regime.state);
    const prevState = world.regime.state, prevBase = world.regime.base;
    // the "failing" banner fires only for a world that HAD an established predator tier
    // (prevBase healthy) and just lost it — never for a world whose predators never rose.
    if (rg.state === "collapsed" && prevState !== "collapsed" && prevState !== "settling"
        && prevBase >= CONFIG.regimeCollapseFloor * 2) {
      world.regime.flash = CONFIG.regimeFlashTicks;
      world.regime.flashText = "the predators are failing";
      world.regime.flashWarm = false;
    } else if (rg.state !== "collapsed" && prevState === "collapsed") {
      // leaving a (mature, confident) collapse is genuine recovery
      world.regime.flash = CONFIG.regimeFlashTicks;
      world.regime.flashText = "the predators claw back";
      world.regime.flashWarm = true;
    }
    world.regime.state = rg.state;
    world.regime.trend = rg.trend;
    world.regime.label = rg.label;
    world.regime.hmean = rg.hmean;
    world.regime.base = rg.base;
    world.regime.projBase = rg.projBase;
    world.regime.secular = rg.secular;
    world.regime.building = rg.building;
  }

  // ---- simulation step ----------------------------------------------------
  function step() {
    world.tick++;

    // the ground lives its own life first: plants draw nutrients up, nutrients leach sideways
    growVeg();
    spreadVeg();
    spreadSoil();
    sowSeeds();
    decayGraze();

    // bucket the herd for this tick so cohesion and crowd-counting stay cheap
    rebuildFlock();

    const newborns = [];
    for (let i = world.motes.length - 1; i >= 0; i--) {
      const m = world.motes[i];
      m.age++;

      // how many neighbours are pressed close right now (the density the tint/readout show)
      // and the signed cohesion/avoidance steer this mote will fold into its foraging
      const fl = senseFlock(m);
      m._crowd = fl.crowd;

      // fear first: if a hunter is within this mote's perception, flee straight away
      // from the nearest one — survival overrides grazing. The fear radius is the mote's
      // own `sense` gene (with a small startle floor), so a keen-sensed mote spots the
      // threat from farther and gets more warning to sprint clear; a dull one is ambushed.
      // That, plus the energy-costly panic sprint, makes predation select on sense AND speed.
      const fearR2 = m.g.sense * m.g.sense;
      let threat = false, thx = 0, thy = 0, thD2 = fearR2 > FEARFLOOR2 ? fearR2 : FEARFLOOR2;
      for (let h = 0; h < world.hunters.length; h++) {
        const hu = world.hunters[h];
        const d2 = torusD2(m.x, m.y, hu.x, hu.y);
        if (d2 < thD2) { thD2 = d2; thx = hu.x; thy = hu.y; threat = true; }
      }

      // two ways to answer a threat, and a mote's genes decide which it can use. A mote
      // in good cover FREEZES — it hunkers, keeps still, and vanishes into the veg (the
      // hider tactic); bolting would only break cover and burn sprint energy it doesn't
      // need. A mote in the open BOLTS away and sprints (the fleer tactic). Small motes
      // on dense veg get to hide; big or exposed motes must run for it.
      let hiding = false;
      if (threat) {
        if (concealment(m) >= CONFIG.coverFreeze) {
          hiding = true;                            // hunker down and stay hidden
        } else {
          m.dir = torusAngle(thx, thy, m.x, m.y);   // bolt straight away from the hunter
        }
      } else {
        // steer toward the greenest direction within sense range (chemotaxis):
        // probe eight bearings; head for the best if it beats the current cell.
        const reach = m.g.sense;
        let bestVal = vegAtPoint(m.x, m.y) * 1.04;   // hysteresis so it lingers to graze
        let bestDir = -1;
        for (let k = 0; k < 8; k++) {
          const a = k * (TAU / 8);
          const val = vegAtPoint(m.x + Math.cos(a) * reach, m.y + Math.sin(a) * reach);
          if (val > bestVal) { bestVal = val; bestDir = a; }
        }
        if (bestDir >= 0) m.dir = bestDir;
        else if (rng() < 0.08) m.dir += rand(-0.6, 0.6); // idle wander (unchanged)
        // then fold the social steer (signed cohesion/avoidance + separation) onto that
        // heading WITHOUT erasing the forage/idle choice: foraging is the unit baseline, the
        // social pull a nudge. With no neighbours in range fl is zero and the heading is
        // byte-identical to the old forage-only world, so the tuned economy shifts only as
        // the gene evolves — wary under predation, near-neutral in a lull.
        if (fl.sx !== 0 || fl.sy !== 0) {
          const dx = Math.cos(m.dir) + fl.sx, dy = Math.sin(m.dir) + fl.sy;
          if (dx !== 0 || dy !== 0) m.dir = Math.atan2(dy, dx);
        }
        // steer away from recent kill sites — places where a mote was eaten stay hot
        // for alarmDuration ticks; motes within alarmRadius feel a soft push away from
        // each hot site, weighted by freshness. This gives the herd spatial memory:
        // a hunting ground clears out while alarm is hot, then slowly refills as fear fades.
        if (world.killLog.length > 0) {
          const aR2 = CONFIG.alarmRadius * CONFIG.alarmRadius;
          let kx = 0, ky = 0;
          for (const site of world.killLog) {
            const age = world.tick - site.tick;
            if (age >= CONFIG.alarmDuration) continue;
            let dx = m.x - site.x; if (dx > HW) dx -= W; else if (dx < -HW) dx += W;
            let dy = m.y - site.y; if (dy > HH) dy -= H; else if (dy < -HH) dy += H;
            const d2 = dx * dx + dy * dy;
            if (d2 > aR2 || d2 < 1) continue;
            const freshness = 1 - age / CONFIG.alarmDuration;
            const d = Math.sqrt(d2);
            kx += (dx / d) * freshness;
            ky += (dy / d) * freshness;
          }
          if (kx !== 0 || ky !== 0) {
            const mag = Math.sqrt(kx * kx + ky * ky);
            const dx = Math.cos(m.dir) + (kx / mag) * CONFIG.alarmWeight;
            const dy = Math.sin(m.dir) + (ky / mag) * CONFIG.alarmWeight;
            if (dx !== 0 || dy !== 0) m.dir = Math.atan2(dy, dx);
          }
        }
      }

      // move — a bolting mote sprints (and pays for it in the burn below); a hiding
      // mote barely twitches, so it stays put in its cover and pays almost nothing
      const v = hiding ? m.g.speed * CONFIG.coverFreezeSpeed
                       : m.g.speed * (threat ? CONFIG.panicBoost : 1);
      m.x = wrap(m.x + Math.cos(m.dir) * v, W);
      m.y = wrap(m.y + Math.sin(m.dir) * v, H);

      // burn energy: bigger + faster costs more. The v*0.4 term is the LINEAR cost of the
      // motion this tick (a fleeing sprint burns more than an idle drift). On top of it sits
      // the SPRINT DRAG — a superlinear cost of the body's speed *build*, growing with the
      // square of how far the speed gene sits above speedDragFrom. It's what stops the arms
      // race from slamming the clamp: a linear cost can't out-climb a linearly-rewarded gene,
      // but a quadratic one makes each extra notch of top speed cost more than the last, so
      // the gene finds an interior optimum. Below the threshold it's exactly zero — normal
      // grazers pay nothing new, so the tuned low-mid economy is untouched.
      const cost = CONFIG.baseMetabolism * m.g.metabo * (1 + m.g.size * 0.15 + v * 0.4 + sprintDrag(m.g.speed));
      m.energy -= cost;

      // graze the cell underfoot
      const ci = cellIndex(m.x, m.y);
      // respiration: burning energy costs body matter, which lands on the ground the mote
      // is standing on. This is the cycle's main return path — a grazer is a slow pump
      // carrying the standing crop back down into the soil, wherever it happens to wander.
      let resp = (cost / CONFIG.vegEnergy) * CONFIG.respireReturn;
      if (resp > m.matter) resp = m.matter;
      m.matter -= resp;
      enrich(ci, resp);
      const avail = world.veg[ci];
      if (avail > 0) {
        const bite = avail < CONFIG.vegGrazeRate ? avail : CONFIG.vegGrazeRate;
        world.veg[ci] = avail - bite;
        // energy income is deliberately unchanged — the tuned limit cycle depends on it
        m.energy += bite * CONFIG.vegEnergy * metaboIntakeMult(m.g.metabo);
        m.matter += bite * (1 - CONFIG.grazeWaste);   // the digested share builds the body
        enrich(ci, bite * CONFIG.grazeWaste);         // the rest drops straight back as dung
        // a full body passes the surplus straight through — a big mote holds more
        const cap = CONFIG.bodyMatterMax * m.g.size;
        if (m.matter > cap) { enrich(ci, m.matter - cap); m.matter = cap; }
        world.graze[ci] += bite;   // leave a fading mark for the grazing overlay
      }

      // cache how hidden this mote now is (post-move, post-graze) so the hunters can
      // read it without recomputing per predator–prey pair — cover is what the hunt sees
      m._cover = concealment(m);

      // reproduce
      if (m.energy >= CONFIG.reproEnergy && world.motes.length + newborns.length < CONFIG.maxPop) {
        m.energy -= CONFIG.reproCost;
        const child = makeMote(m.x, m.y, makeGenome(m.g));
        child.energy = CONFIG.reproCost;
        child.matter = m.matter * CONFIG.birthMatterShare;   // a body is built out of the parent's,
        m.matter -= child.matter;                            // never out of thin air
        newborns.push(child);
        world.born++;
      }

      // death — the corpse enriches the ground where it fell. It used to become grass
      // instantly; now it becomes the SOIL that grass grows out of, so a die-off leaves
      // a rich patch that greens over the following hundreds of ticks instead of a
      // green flash that the next passing mote eats. This is the loop that closes:
      // where the herd starved is exactly where the ground is about to be richest.
      if (m.energy <= 0) {
        world.motes.splice(i, 1);
        world.died++;
        enrich(cellIndex(m.x, m.y), m.matter);   // whatever the body still held
        // a cool dot winks out where hunger took it — the quiet death, told apart from
        // the hunter's warm flash. View-only: no rng() here, so the economy is untouched.
        if (world.sparks.length < 240)
          world.sparks.push({ x: m.x, y: m.y, life: 1, kind: "starved", r: m.g.size });
      }
    }

    for (const c of newborns) world.motes.push(c);

    // ---- the hunters hunt ---------------------------------------------------
    // Grazers have already moved this tick; predators now chase the nearest mote
    // in sense range, strike if they close the gap, and pay a steep metabolic bill
    // — so a hunter that can't find prey starves, keeping the pyramid self-limiting.
    const newHunters = [];
    for (let i = world.hunters.length - 1; i >= 0; i--) {
      const h = world.hunters[i];
      h.age++;
      // hunger-driven boldness: 0 when fed (energy ≥ hunterBoldFull), ramping to 1 as
      // energy falls toward death. Squared so only real hunger turns a hunter reckless.
      const hunger = 1 - clamp(h.energy / CONFIG.hunterBoldFull, 0, 1);
      const bold = hunger * hunger;
      // a starving hunter digests faster, so its next strike comes sooner
      if (h.cool > 0) h.cool -= 1 + CONFIG.hunterBoldDigest * bold;

      // always stalk the nearest VISIBLE mote in sense range — a sated hunter keeps
      // tracking (and scaring) the herd, it simply can't strike again until it has
      // digested. Decoupling stalking from striking makes the cooldown a clean cap on
      // kill rate instead of stranding digesting hunters in empty ground. A concealed
      // mote (small, in cover) shrinks the hunter's effective sight toward it toward
      // zero, so a well-hidden grazer is invisible until the hunter is almost on top of
      // it — the hider's whole defence, and why predation can now select two ways.
      const senseR2 = h.g.sense * h.g.sense;
      let best = -1, bestD2 = senseR2;
      for (let j = 0; j < world.motes.length; j++) {
        const p = world.motes[j];
        const d2 = torusD2(h.x, h.y, p.x, p.y);
        if (d2 >= bestD2) continue;                 // farther than the nearest seen: skip
        const c = p._cover || 0;                    // 0 for a mote born this tick
        const eff = c > 0 ? senseR2 * (1 - c) * (1 - c) : senseR2;
        if (d2 < eff) { bestD2 = d2; best = j; }
      }
      if (best >= 0) {
        const prey = world.motes[best];
        h.dir = torusAngle(h.x, h.y, prey.x, prey.y);
      } else if (rng() < 0.06) {
        h.dir += rand(-0.5, 0.5); // prowl
      }

      // home-range pull: a gentle angular lean toward the kill centroid, applied every tick —
      // even while chasing, so the hunter subtly prefers prey near its territory. Between
      // kills (during the digestion cooldown) the pull builds a habitat-use pattern: the
      // hunter circles back toward where it has killed most, gradually carving a personal
      // patrol corridor out of the shared landscape.
      {
        const homeD2 = torusD2(h.x, h.y, h.homeX, h.homeY);
        if (homeD2 > 100) {
          const homeAngle = torusAngle(h.x, h.y, h.homeX, h.homeY);
          const pull = CONFIG.hunterHomePull * Math.min(1, Math.sqrt(homeD2) / CONFIG.hunterHomeRange);
          let diff = homeAngle - h.dir;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          h.dir += diff * pull;
        }
      }

      // move — a starving hunter puts on a closing sprint (which costs more energy
      // below, via v: reckless is expensive, so a bold hunter that misses dies faster)
      const v = h.g.speed * (1 + CONFIG.hunterBoldSprint * bold);
      h.x = wrap(h.x + Math.cos(h.dir) * v, W);
      h.y = wrap(h.y + Math.sin(h.dir) * v, H);

      // burn energy — hunters are expensive to run. metabo scales this linear cost AND the
      // digestive gain on a kill (huntMetaboMult at the strike below), so it's a real fast/slow
      // tradeoff with an interior optimum, not the pure tax it used to be.
      const hcost = CONFIG.hunterMetabolism * h.g.metabo * (1 + h.g.size * 0.1 + v * 0.4);
      h.energy -= hcost;
      // predators respire into the ground too — the pyramid's top tier is part of the
      // nutrient cycle, not sitting outside it
      let hresp = (hcost / CONFIG.vegEnergy) * CONFIG.respireReturn;
      if (hresp > h.matter) hresp = h.matter;
      h.matter -= hresp;
      enrich(cellIndex(h.x, h.y), hresp);

      // strike: if digestion is done and the target is now within a body-length, eat it
      if (best >= 0 && h.cool <= 0) {
        const prey = world.motes[best];
        // cover shrinks the catch window too: even once a hunter closes, a hidden mote
        // is hard to pin down in the veg, so hiding protects the last body-length as well
        const shield = 1 - (prey._cover || 0) * CONFIG.coverStrikeShield;
        const cr = (h.g.size + prey.g.size + CONFIG.huntRange + CONFIG.hunterBoldReach * bold) * shield;
        if (torusD2(h.x, h.y, prey.x, prey.y) < cr * cr) {
          // the assimilated share is scaled by the hunter's metabolism (a fast burner digests
          // the kill more thoroughly); the flat catch bonus is metabo-independent — see CONFIG.
          const preyE = prey.energy > 0 ? prey.energy : 0;
          h.energy += preyE * CONFIG.huntAssimilation * huntMetaboMult(h.g.metabo) + CONFIG.huntBonus;
          h.cool = CONFIG.huntCooldown;   // digest before the next strike
          // the prey's body splits: the hunter carries most of it off, the rest stays
          // where it fell as offal — so a hunting ground slowly enriches itself
          const offal = prey.matter * CONFIG.offalShare;
          h.matter += prey.matter - offal;
          const hcap = CONFIG.bodyMatterMax * h.g.size;
          const spill = h.matter > hcap ? h.matter - hcap : 0;
          if (spill) h.matter = hcap;
          enrich(cellIndex(prey.x, prey.y), offal + spill);
          world.motes.splice(best, 1);
          world.eaten++;
          if (world.sparks.length < 240) world.sparks.push({ x: prey.x, y: prey.y, life: 1 });
          // log the kill site so motes can steer away from recent hunting grounds
          if (world.killLog.length >= CONFIG.alarmSites) world.killLog.shift();
          world.killLog.push({ x: prey.x, y: prey.y, tick: world.tick });
          // home centroid: shift toward this kill — an exponential moving average of kill
          // sites that anchors the hunter's territory. Each kill nudges the centroid
          // hunterHomeShift fraction closer to where the prey just fell, so a corridor
          // where this hunter kills often becomes the centroid of its home range.
          {
            let kdx = prey.x - h.homeX; if (kdx > HW) kdx -= W; else if (kdx < -HW) kdx += W;
            let kdy = prey.y - h.homeY; if (kdy > HH) kdy -= H; else if (kdy < -HH) kdy += H;
            h.homeX = wrap(h.homeX + kdx * CONFIG.hunterHomeShift, W);
            h.homeY = wrap(h.homeY + kdy * CONFIG.hunterHomeShift, H);
          }
        }
      }

      // reproduce — the more hunters already crowd the world, the more energy a split
      // costs, so the population self-limits below the cap rather than pinning against it
      const crowd = (world.hunters.length + newHunters.length) / CONFIG.hunterMaxPop;
      const effRepro = CONFIG.hunterReproEnergy * (1 + CONFIG.hunterCrowd * crowd);
      if (h.energy >= effRepro &&
          world.hunters.length + newHunters.length < CONFIG.hunterMaxPop) {
        h.energy -= CONFIG.hunterReproCost;
        const pup = makeHunter(h.x, h.y, makeHunterGenome(h.g));
        pup.energy = CONFIG.hunterReproCost;
        pup.matter = h.matter * CONFIG.birthMatterShare;
        h.matter -= pup.matter;
        newHunters.push(pup);
        world.hunterBorn++;
      }

      // death — from starvation OR old age. Senescence: past a long prime the per-tick
      // death hazard climbs linearly with age, so ancient hunters make way for young and
      // the predator pool finally turns over instead of freezing. Either way a fallen
      // hunter feeds the plants where it dropped.
      const starved = h.energy <= 0;
      let aged = false;
      if (!starved && h.age > CONFIG.hunterSenesceOnset) {
        const hazard = CONFIG.hunterSenesceRate * (h.age - CONFIG.hunterSenesceOnset);
        if (rng() < hazard) aged = true;
      }
      if (starved || aged) {
        world.hunters.splice(i, 1);
        world.hunterDied++;
        if (aged) world.hunterAged++;
        enrich(cellIndex(h.x, h.y), h.matter);
        // mark the fall by its cause: a grey ring for old age (the tier turning over, the
        // thing the trait chart only inferred), a cool one for the rare starved hunter —
        // the same hunger-colour a starved mote gets. View-only, no rng().
        if (world.sparks.length < 240)
          world.sparks.push({ x: h.x, y: h.y, life: 1, kind: aged ? "aged" : "starved", r: h.g.size });
      }
    }
    for (const c of newHunters) world.hunters.push(c);

    // predators drift back in from "outside" only when prey is plentiful — a soft
    // parachute against permanent extinction that can't mask a runaway crash.
    if (world.hunters.length === 0 && world.motes.length >= CONFIG.hunterReseedPrey) {
      for (let i = 0; i < CONFIG.hunterReseedCount; i++) {
        world.hunters.push(makeHunter(rand(0, W), rand(0, H)));
      }
    }

    // if everyone dies, gently reseed a few so the world never stays empty
    if (world.motes.length === 0) {
      for (let i = 0; i < 6; i++) world.motes.push(makeMote(rand(0, W), rand(0, H)));
    }

    // fade the kill-flashes (view only)
    for (let i = world.sparks.length - 1; i >= 0; i--) {
      const s = world.sparks[i];
      s.life -= CONFIG.sparkFade;
      if (s.life <= 0) world.sparks.splice(i, 1);
    }

    // let a regime-transition banner age out (view only)
    if (world.regime.flash > 0) world.regime.flash--;

    if (world.tick % CONFIG.sampleEvery === 0) sample();
  }

  // ---- render -------------------------------------------------------------
  function draw() {
    // ease the world's "mood" toward the current predation-cycle phase so its light
    // breathes: warm and tense as predation surges, cool as it ebbs, coldest and hollow
    // in a genuine collapse — a shift a visitor feels before reading the HUD. Pure
    // narration: the economy never sees world.mood, exactly like the charts and the chip.
    world.mood += (regimeMood(world.regime) - world.mood) * CONFIG.moodEase;
    const mood = world.mood;
    const warm = mood > 0 ? mood : 0, cold = mood < 0 ? -mood : 0;

    // seasonal base (cool/dark in winter, warmer at high summer), then leaned by mood:
    // a surge stokes the reds and banks the blue toward an ember dark, an ebb or collapse
    // cools and dims the whole field toward a hollow blue-grey
    const p = (seasonWave() + 1) / 2; // 0 = deep winter, 1 = high summer
    const br = clamp(6 + 6 * p + 13 * warm - 3 * cold, 0, 255) | 0;
    const bg = clamp(9 + 5 * p + 3 * warm + 1 * cold, 0, 255) | 0;
    const bb = clamp(13 + 5 * p - 5 * warm + 10 * cold, 0, 255) | 0;
    ctx.fillStyle = `rgb(${br}, ${bg}, ${bb})`;
    ctx.fillRect(0, 0, W, H);

    // the living ground — bilinear-smooth: sample every 5px and interpolate from
    // surrounding cell centres, so the meadow reads as continuous organic ground
    // rather than a hard 15px tile grid. The economy keeps its discrete cells;
    // only the draw path blends them.
    const cell = CONFIG.vegCell, cols = GRID.cols, rows = GRID.rows;
    const hueBase = 80 + p * 34;
    const veg = world.veg;
    const step = 5;
    // pre-build 25 colour strings once per frame (hueBase shifts with season)
    const N = 24;
    const vegColors = new Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      vegColors[i] = `hsl(${(hueBase - t * 8) | 0} ${(30 + t * 36) | 0}% ${(6 + t * 40) | 0}%)`;
    }
    const nCols = Math.ceil(W / step), nRows = Math.ceil(H / step);
    let lastQ = -1;
    for (let sy = 0; sy < nRows; sy++) {
      // cell-centred fractional grid coordinate of this sample row
      const gy = (sy * step + step * 0.5) / cell - 0.5;
      const iy = Math.floor(gy);
      const gy0 = ((iy % rows) + rows) % rows;
      const gy1 = (gy0 + 1) % rows;
      const fy = gy - iy;
      const row0 = gy0 * cols, row1 = gy1 * cols;
      for (let sx = 0; sx < nCols; sx++) {
        const gx = (sx * step + step * 0.5) / cell - 0.5;
        const ix = Math.floor(gx);
        const gx0 = ((ix % cols) + cols) % cols;
        const gx1 = (gx0 + 1) % cols;
        const fx = gx - ix;
        const d = veg[row0 + gx0] * (1 - fx) * (1 - fy)
                + veg[row0 + gx1] *       fx  * (1 - fy)
                + veg[row1 + gx0] * (1 - fx)  *      fy
                + veg[row1 + gx1] *       fx  *      fy;
        if (d < 0.015) continue;
        const t = d < 1 ? d : 1;
        const qi = (t * N + 0.5) | 0;
        if (qi !== lastQ) { ctx.fillStyle = vegColors[qi]; lastQ = qi; }
        ctx.fillRect(sx * step, sy * step, step, step);
      }
    }

    // an optional lens on the hidden landscape, painted over the meadow
    drawOverlay();

    // kill-site danger auras — each recently hot kill zone glows faintly warm, fading over
    // alarmDuration ticks. Motes actively steer away from these zones (when not fleeing a
    // live hunter); the glow makes that spatial memory visible as the ground itself —
    // a hunter's patrol ground warms to a dull ember that cools as the fear subsides.
    for (const site of world.killLog) {
      const age = world.tick - site.tick;
      if (age >= CONFIG.alarmDuration) continue;
      const freshness = 1 - age / CONFIG.alarmDuration;
      ctx.beginPath();
      ctx.arc(site.x, site.y, CONFIG.alarmRadius * 0.9, 0, TAU);
      ctx.fillStyle = `rgba(210,65,35,${(0.055 * freshness).toFixed(3)})`;
      ctx.fill();
    }

    // motes — each ringed by its lifestyle so the two anti-predator strategies are
    // visible at a glance: a committed hider (small, slow) wears a cool leaf-green halo
    // and melts into the meadow; a committed fleer (fast) wears a hot amber halo and
    // reads as alert and exposed; the mediocre middle is faintly, muddily ringed.
    for (const m of world.motes) {
      const glow = clamp(m.energy / CONFIG.reproEnergy, 0.25, 1);
      const H = hideability(m.g);                       // 1 = hider, 0 = fleer
      // density shimmer: a mote pressed among neighbours casts a soft halo that deepens
      // with its local crowd, so the herd's dense knots glow and open ground stays dark —
      // and in this world those bright knots are the risky crowds the hunters cull, so you
      // can watch them thin as the herd turns wary under predation and pool again in a lull
      const crowd = m._crowd || 0;
      if (crowd > 1) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.g.size + 3 + crowd * 0.7, 0, TAU);
        ctx.fillStyle = `hsl(205 60% 66% / ${clamp(crowd * 0.018, 0, 0.13).toFixed(3)})`;
        ctx.fill();
      }
      // saturation carries the metabolic life-history: a thrifty grazer (low metabo) is
      // pale and washed-out, a hot fast-burner is vividly saturated — the fast/slow axis
      // made visible, on a channel that doesn't fight the hue gene or the lifestyle ring
      const sat = 42 + 46 * clamp((m.g.metabo - 0.6) / 1.2, 0, 1);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.g.size, 0, TAU);
      ctx.fillStyle = `hsl(${m.g.hue.toFixed(0)} ${sat.toFixed(0)}% ${(40 + glow * 24).toFixed(0)}%)`;
      ctx.fill();
      // lifestyle halo: hue slides leaf-green (hider) → amber (fleer); it fades toward
      // the ambiguous middle so a genuinely split herd shows crisp two-colour rings
      const ringHue = 40 + (135 - 40) * H;
      const commit = Math.abs(H - 0.5) * 2;             // 0 at the middle, 1 at an extreme
      ctx.strokeStyle = `hsl(${ringHue.toFixed(0)} 78% 58% / ${(0.28 + 0.5 * commit).toFixed(2)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.g.size + 1.6, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1;
      // heading whisker, tinted by SOCIABILITY so the quiet third axis reads per mote: a
      // wary mote (social<0, keeps its distance) trails a cool blue whisker, a sociable one
      // (social>0, seeks the crowd) a warm orange one, neutral a plain pale line. Length
      // grows a touch with the gene's conviction, so a committed loner reads as a long cool dart.
      const soc = clamp(m.g.social / 1.0, -1, 1);          // −1 wary … +1 sociable
      const whHue = soc < 0 ? 210 : 30;                    // cool for wary, warm for sociable
      const whSat = (20 + 55 * Math.abs(soc)).toFixed(0);  // pale at neutral, vivid at an extreme
      ctx.strokeStyle = `hsl(${whHue} ${whSat}% 70% / 0.55)`;
      const whLen = m.g.size + 3 + Math.abs(soc) * 2.5;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + Math.cos(m.dir) * whLen, m.y + Math.sin(m.dir) * whLen);
      ctx.stroke();
    }

    // territory markers — a faint cross at each hunter's kill centroid shows where it
    // gravitates; as territories form the markers cluster into visible hot zones
    for (const h of world.hunters) {
      const hx = h.homeX, hy = h.homeY;
      ctx.strokeStyle = `hsl(${h.g.hue.toFixed(0)} 55% 68% / 0.20)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy); ctx.lineTo(hx + 5, hy);
      ctx.moveTo(hx, hy - 5); ctx.lineTo(hx, hy + 5);
      ctx.stroke();
    }

    // hunters — hot-coloured arrowheads that point where they're charging, so a
    // predator reads as directional and menacing next to the soft grazer discs
    for (const h of world.hunters) {
      const glow = clamp(h.energy / CONFIG.hunterReproEnergy, 0.3, 1);
      // starving hunters read as desperate: the nose lunges longer and the body
      // flushes pale and white-hot, so a collapsing predator tier looks frantic
      const hunger = 1 - clamp(h.energy / CONFIG.hunterBoldFull, 0, 1);
      const bold = hunger * hunger;
      // age reads on a separate channel from hunger: a weathered dark rim thickens as a
      // hunter grows old (senescence), so a visitor sees the tier turn over — young
      // hunters are clean-edged, ancient ones ringed and about to make way
      const sen = clamp((h.age - CONFIG.hunterSenesceOnset) / CONFIG.hunterSenesceVis, 0, 1);
      const s = h.g.size;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.dir);
      ctx.beginPath();
      ctx.moveTo(s * (1.8 + bold * 1.6), 0);   // nose — a bold hunter lunges longer
      ctx.lineTo(-s, s * 0.95);                // rear corners, with a notched tail
      ctx.lineTo(-s * 0.4, 0);
      ctx.lineTo(-s, -s * 0.95);
      ctx.closePath();
      ctx.fillStyle = `hsl(${h.g.hue.toFixed(0)} ${(85 - bold * 45).toFixed(0)}% ${(46 + glow * 20 + bold * 26).toFixed(0)}%)`;
      ctx.fill();
      if (sen > 0.02) {
        ctx.lineWidth = 1 + sen * 1.6;
        ctx.strokeStyle = `rgba(24,14,20,${(sen * 0.72).toFixed(3)})`;
        ctx.stroke();
      }
      ctx.restore();
    }

    // death marks — every death now leaves a fading sign, coloured by its CAUSE, so the
    // whole mortality of the food web reads at a glance without opening a chart: a warm
    // ring bursts where a hunter CAUGHT a mote (predation, sudden and violent), a cool dot
    // softly winks out where one STARVED (hunger, a quiet giving-out), and a weathered grey
    // ring dissipates where an old hunter finally made way (senescence — the tier turning
    // over, made visible where the chart only inferred it). View-only, like the old flash.
    for (const sp of world.sparks) {
      const t = sp.life;
      if (sp.kind === "starved") {
        // hunger: a soft cool disc that shrinks as it fades — a body giving out, not a strike
        const r = (sp.r || 3) * (0.4 + 0.9 * t);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, TAU);
        ctx.fillStyle = `rgba(90,${(150 + 55 * t) | 0},${(165 + 45 * t) | 0},${(t * 0.55).toFixed(3)})`;
        ctx.fill();
      } else if (sp.kind === "aged") {
        // senescence: a slow, thin grey ring opening outward — dimmer and wider than a
        // kill, sized to the hunter that dropped, reading as a quiet dissipation
        const r = (1 - t) * ((sp.r || 5) * 2.6) + 3;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, TAU);
        ctx.strokeStyle = `rgba(${(140 + 40 * t) | 0},${(134 + 36 * t) | 0},${(150 + 34 * t) | 0},${(t * 0.5).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // predation (the original kill-flash): a brief expanding warm-red ring
        const r = (1 - t) * 13 + 3;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, TAU);
        ctx.strokeStyle = `rgba(255,${(90 + 130 * t) | 0},${(70 * t) | 0},${(t * 0.85).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // mood vignette — a soft, tinted darkening of the field's edges that reads as the
    // world's light: warm and close-walled as predation surges, cold and hollow in an ebb
    // or collapse. Kept gentle (edge alpha ≤ ~0.24) so the living scene stays legible;
    // it's the ambient half of the regime cue the HUD chip states outright.
    {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30,
                                          W / 2, H / 2, Math.max(W, H) * 0.62);
      const va = 0.10 + 0.14 * Math.abs(mood);
      const vr = 4 + 30 * warm, vgc = 6 + 4 * warm + 6 * cold, vb = 12 + 22 * cold;
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(${vr | 0},${vgc | 0},${vb | 0},${va.toFixed(3)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    // regime-transition banner — reserved for the rare, dramatic event: the predator
    // tier genuinely collapsing (cold) or clawing back (warm), fading across the top
    if (world.regime.flash > 0) {
      const a = clamp(world.regime.flash / CONFIG.regimeFlashTicks, 0, 1);
      const txt = world.regime.flashText;
      ctx.save();
      ctx.font = "bold 16px ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const bw = ctx.measureText(txt).width + 30, bh = 30, bx = (W - bw) / 2, by = 14;
      ctx.globalAlpha = a * 0.72;
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.globalAlpha = a;
      ctx.fillStyle = world.regime.flashWarm ? "#ff8a6b" : "#7fb0e0";
      ctx.fillText(txt, W / 2, by + bh / 2 + 1);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // ---- world overlays -----------------------------------------------------
  // View-only lenses on the hidden landscape, drawn translucently over the meadow
  // and under the motes. Fertility exposes the permanent carrying-capacity bedrock
  // (why lush patches sit where they do); grazing shows where motes have eaten
  // lately. Neither touches the simulation — they only read state and paint.
  const fertColor = (t) => `rgb(${40 + 215 * t | 0},${60 + 140 * t | 0},${120 - 55 * t | 0})`;
  const grazeColor = (q) => `rgb(255,${210 - 150 * q | 0},${70 - 30 * q | 0})`;
  // soil runs spent-violet → rich-loam: cool and empty where the ground has been
  // drained, warm and dark where corpses and dung have banked nutrients waiting to bloom
  const soilColor = (t) => `rgb(${55 + 145 * t | 0},${38 + 92 * t | 0},${92 - 42 * t | 0})`;

  function drawOverlay() {
    const mode = world.overlay;
    if (!mode) return;
    const cell = CONFIG.vegCell, cols = GRID.cols, rows = GRID.rows;

    if (mode === 1) {
      const fert = world.fert, lo = CONFIG.fertMin, span = (1 - lo) || 1;
      ctx.globalAlpha = 0.42;
      for (let y = 0; y < rows; y++) {
        const row = y * cols;
        for (let x = 0; x < cols; x++) {
          const t = clamp((fert[row + x] - lo) / span, 0, 1);
          ctx.fillStyle = fertColor(t);
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      ctx.globalAlpha = 1;
      overlayKey("fertility — the permanent lush/barren bedrock", "barren", "rich", fertColor);
    } else if (mode === 2) {
      const gz = world.graze;
      let gmax = 0;
      for (let i = 0; i < gz.length; i++) if (gz[i] > gmax) gmax = gz[i];
      if (gmax >= 0.05) {
        const inv = 1 / gmax;
        for (let y = 0; y < rows; y++) {
          const row = y * cols;
          for (let x = 0; x < cols; x++) {
            const q = gz[row + x] * inv;
            if (q < 0.04) continue;
            ctx.globalAlpha = 0.12 + 0.55 * q;
            ctx.fillStyle = grazeColor(q);
            ctx.fillRect(x * cell, y * cell, cell, cell);
          }
        }
        ctx.globalAlpha = 1;
      }
      const caption = gmax >= 0.05
        ? "grazing pressure — where motes have eaten lately"
        : "grazing pressure — nobody's grazing yet";
      overlayKey(caption, "cool", "hot", grazeColor);
    } else if (mode === 3) {
      // the nutrient bank: the ground's memory of everything that has died on it.
      // Scaled against soilMax rather than the live maximum so the wash means the same
      // thing from tick to tick — a brightening patch is really enriching, not just
      // winning a renormalisation against its neighbours.
      const soil = world.soil, inv = 1 / CONFIG.soilShow;
      ctx.globalAlpha = 0.46;
      for (let y = 0; y < rows; y++) {
        const row = y * cols;
        for (let x = 0; x < cols; x++) {
          const t = clamp(soil[row + x] * inv, 0, 1);
          ctx.fillStyle = soilColor(t);
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      ctx.globalAlpha = 1;
      overlayKey("soil nutrients — what the dead left behind", "spent", "rich", soilColor);
    }
  }

  // A caption plus a manual gradient key (thin strips, no canvas-gradient API so it
  // stays trivially headless-safe) tucked into the world's top-left corner, so the
  // active overlay explains itself.
  function overlayKey(caption, loLabel, hiLabel, colorAt) {
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const cw = ctx.measureText(caption).width + 16;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(10, 10, cw, 22);
    ctx.fillStyle = "#e8eef6";
    ctx.fillText(caption, 18, 22);

    const bx = 18, by = 44, bw = 140, bh = 8, strips = 56, sw = bw / strips;
    for (let i = 0; i < strips; i++) {
      const t = i / (strips - 1);
      ctx.fillStyle = colorAt(t);
      ctx.fillRect(bx + t * (bw - sw), by, sw + 1, bh);
    }
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#aebccb";
    ctx.fillText(loLabel, bx, by + bh + 9);
    ctx.textAlign = "right";
    ctx.fillText(hiLabel, bx + bw, by + bh + 9);
    ctx.textAlign = "left";
  }

  // ---- trait chart --------------------------------------------------------
  function drawChart() {
    cctx.fillStyle = "#060a0f";
    cctx.fillRect(0, 0, CW, CH);

    const padL = 8, padR = 8, padT = 22, padB = 10;
    const plotW = CW - padL - padR;
    const plotH = CH - padT - padB;

    // faint reference lines at 0%, 50%, 100% of each gene's range
    cctx.strokeStyle = "rgba(255,255,255,0.06)";
    cctx.lineWidth = 1;
    for (const gy of [0, 0.5, 1]) {
      const y = padT + plotH * gy;
      cctx.beginPath();
      cctx.moveTo(padL, y);
      cctx.lineTo(CW - padR, y);
      cctx.stroke();
    }

    const hist = world.history;
    const cap = CONFIG.historyCap;

    if (hist.length > 1) {
      // grazer genes — solid lines
      for (const t of TRAITS) {
        cctx.strokeStyle = t.color;
        cctx.lineWidth = 1.5;
        cctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const norm = clamp((hist[i][t.key] - t.lo) / (t.hi - t.lo), 0, 1);
          const x = padL + (i / (cap - 1)) * plotW;
          const y = padT + plotH * (1 - norm);
          if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
        }
        cctx.stroke();
      }
      // hunter genes — dashed lines on the same normalized axis, so the arms race
      // reads at a glance (mote & hunter speed climbing together, say). Slightly
      // faint so the faster-swinging grazer lines stay the visual lead, and drawn
      // gap-aware: a null (no hunters that sample) lifts the pen so a collapse shows
      // as a break in the curve rather than a false plunge to the floor.
      cctx.setLineDash([4, 3]);
      cctx.globalAlpha = 0.72;
      for (const t of HUNTER_TRAITS) {
        cctx.strokeStyle = t.color;
        cctx.lineWidth = 1.25;
        cctx.beginPath();
        let pen = false;
        for (let i = 0; i < hist.length; i++) {
          const v = hist[i][t.key];
          if (v == null) { pen = false; continue; }
          const norm = clamp((v - t.lo) / (t.hi - t.lo), 0, 1);
          const x = padL + (i / (cap - 1)) * plotW;
          const y = padT + plotH * (1 - norm);
          if (!pen) { cctx.moveTo(x, y); pen = true; } else cctx.lineTo(x, y);
        }
        cctx.stroke();
      }
      cctx.globalAlpha = 1;
      cctx.setLineDash([]);
    }

    // legend: one swatch per gene, then its current grazer·hunter average pair, so
    // the two species' values sit side by side (solid grazer · dashed hunter).
    cctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    cctx.textBaseline = "middle";
    const latest = hist.length ? hist[hist.length - 1] : null;
    const fmt = (v) => (v == null ? "–" : v.toFixed(v >= 10 ? 0 : 2));
    let lx = padL;
    for (let gi = 0; gi < TRAITS.length; gi++) {
      const t = TRAITS[gi];
      const ht = gi < HUNTER_TRAITS.length ? HUNTER_TRAITS[gi] : null;
      cctx.fillStyle = t.color;
      cctx.fillRect(lx, padT / 2 - 4, 8, 8);
      lx += 12;
      const g = latest ? latest[t.key] : null;
      const h = (ht && latest) ? latest[ht.key] : null;
      const text = ht ? `${t.label} ${fmt(g)}·${fmt(h)}` : `${t.label} ${fmt(g)}`;
      cctx.fillStyle = "#cdd8e4";
      cctx.fillText(text, lx, padT / 2);
      lx += cctx.measureText(text).width + 16;
    }
    // trailing key so the dashed lines aren't a mystery
    cctx.fillStyle = "#6b7d8f";
    cctx.fillText(hist.length <= 1 ? "gathering data…" : "grazer·hunter (social: grazer)", lx, padT / 2);
  }

  // ---- trophic cascade chart ----------------------------------------------
  // Plants, motes and hunters over time — each scaled to its own recent peak, so
  // the three tiers (spanning orders of magnitude in count) all fill the panel and
  // the eye can follow a bloom rippling up the food chain with a lag at every step.
  function drawCountChart() {
    c2ctx.fillStyle = "#060a0f";
    c2ctx.fillRect(0, 0, C2W, C2H);

    const padL = 8, padR = 8, padT = 22, padB = 10;
    const plotW = C2W - padL - padR;
    const plotH = C2H - padT - padB;

    const hist = world.history;
    const cap = CONFIG.historyCap;

    // faint reference lines at 0, half, full of each tier's own scale
    c2ctx.strokeStyle = "rgba(255,255,255,0.06)";
    c2ctx.lineWidth = 1;
    for (const gy of [0, 0.5, 1]) {
      const y = padT + plotH * gy;
      c2ctx.beginPath();
      c2ctx.moveTo(padL, y);
      c2ctx.lineTo(C2W - padR, y);
      c2ctx.stroke();
    }

    if (hist.length > 1) {
      for (const t of TIERS) {
        // each tier against its own peak in view (min 1 so a flat line hugs 0)
        let peak = 1;
        for (const s of hist) if (s[t.key] > peak) peak = s[t.key];
        c2ctx.strokeStyle = t.color;
        c2ctx.lineWidth = 1.5;
        c2ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const norm = clamp(hist[i][t.key] / peak, 0, 1);
          const x = padL + (i / (cap - 1)) * plotW;
          const y = padT + plotH * (1 - norm);
          if (i === 0) c2ctx.moveTo(x, y); else c2ctx.lineTo(x, y);
        }
        c2ctx.stroke();
      }
    }

    // legend with each tier's current absolute count (magnitude the curves drop)
    c2ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    c2ctx.textBaseline = "middle";
    const latest = hist.length ? hist[hist.length - 1] : null;
    let lx = padL;
    for (const t of TIERS) {
      c2ctx.fillStyle = t.color;
      c2ctx.fillRect(lx, padT / 2 - 4, 8, 8);
      lx += 12;
      const text = `${t.label} ${latest ? latest[t.key] : "–"}`;
      c2ctx.fillStyle = "#cdd8e4";
      c2ctx.fillText(text, lx, padT / 2);
      lx += c2ctx.measureText(text).width + 16;
    }
    if (hist.length <= 1) {
      c2ctx.fillStyle = "#6b7d8f";
      c2ctx.fillText("gathering data…", lx, padT / 2);
    }
  }

  // ---- death-balance chart ------------------------------------------------
  // One diverging band, above/below a central line, that answers "what is killing
  // the herd right now?" — the hunters (warm, above the line: predation, top-down
  // control) vs. hunger (cool, below: starvation, bottom-up control), from the
  // smoothed predationShare(). It swells warm as an arms-race lets the predators
  // claim most of the herd, sinks cool as a grazer-haven leaves hunger to do the
  // killing, and breaks only in the rare window where nothing died at all.
  const ARMS_WARM = "255,107,107";  // predation dominates (matches the hunter tier)
  const ARMS_COOL = "108,192,138";  // starvation dominates (matches the haven green)
  function drawArmsChart() {
    c3ctx.fillStyle = "#060a0f";
    c3ctx.fillRect(0, 0, C3W, C3H);

    const padL = 8, padR = 8, padT = 22, padB = 10;
    const plotW = C3W - padL - padR;
    const plotH = C3H - padT - padB;
    const mid = padT + plotH / 2;      // the 50/50 line (predation share = 0.5)
    const half = plotH / 2;
    const hist = world.history;
    const cap = CONFIG.historyCap;
    const win = CONFIG.predWindow;
    // predation share in [0,1] → a signed height in [-1,1] (½ = the middle line)
    const yFor = (share) => mid - clamp(2 * share - 1, -1, 1) * half;

    // precompute each sample's point (null in a window where nothing died)
    const pts = [];
    for (let i = 0; i < hist.length; i++) {
      const share = predationShare(hist, i, win);
      const x = padL + (i / (cap - 1)) * plotW;
      pts.push(share == null ? null : { x, y: yFor(share) });
    }

    if (hist.length > 1) {
      // walk contiguous runs of scored samples; fill each against the middle line,
      // split by side (warm above = predation, cool below = starvation), then stroke.
      let i = 0;
      while (i < pts.length) {
        if (!pts[i]) { i++; continue; }
        let j = i;
        while (j + 1 < pts.length && pts[j + 1]) j++;
        if (j > i) {
          for (const sign of [1, -1]) {
            c3ctx.beginPath();
            c3ctx.moveTo(pts[i].x, mid);
            for (let k = i; k <= j; k++) {
              const y = sign > 0 ? Math.min(pts[k].y, mid) : Math.max(pts[k].y, mid);
              c3ctx.lineTo(pts[k].x, y);
            }
            c3ctx.lineTo(pts[j].x, mid);
            c3ctx.closePath();
            const rgb = sign > 0 ? ARMS_WARM : ARMS_COOL;
            const g = c3ctx.createLinearGradient(0, mid, 0, sign > 0 ? padT : padT + plotH);
            g.addColorStop(0, `rgba(${rgb},0.04)`);
            g.addColorStop(1, `rgba(${rgb},0.5)`);
            c3ctx.fillStyle = g;
            c3ctx.fill();
          }
          c3ctx.beginPath();
          for (let k = i; k <= j; k++) {
            if (k === i) c3ctx.moveTo(pts[k].x, pts[k].y); else c3ctx.lineTo(pts[k].x, pts[k].y);
          }
          c3ctx.lineWidth = 1.5;
          c3ctx.strokeStyle = "rgba(232,238,246,0.85)";
          c3ctx.stroke();
        }
        i = j + 1;
      }
    }

    // the 50/50 line, drawn over the fills
    c3ctx.strokeStyle = "rgba(255,255,255,0.22)";
    c3ctx.lineWidth = 1;
    c3ctx.beginPath();
    c3ctx.moveTo(padL, mid);
    c3ctx.lineTo(C3W - padR, mid);
    c3ctx.stroke();

    // readout: which force is doing the killing right now, coloured to match, plus
    // a fixed axis hint. The current share pools the same trailing window as the band.
    c3ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    c3ctx.textBaseline = "middle";
    const cur = hist.length ? predationShare(hist, hist.length - 1, win) : null;
    let label, col;
    if (hist.length <= 1) { label = "gathering data…"; col = "#6b7d8f"; }
    else if (cur == null) { label = "a still moment — nothing has died"; col = "#6b7d8f"; }
    else {
      const pct = Math.round(cur * 100);
      if (cur >= 0.55) { label = `the hunters are doing the killing — ${pct}% predation`; col = "#ff6b6b"; }
      else if (cur <= 0.45) { label = `hunger is doing the killing — ${100 - pct}% starvation`; col = "#6cc08a"; }
      else { label = `an even split — ${pct}% predation`; col = "#cdd8e4"; }
    }
    c3ctx.fillStyle = col;
    c3ctx.textAlign = "left";
    c3ctx.fillText(label, padL, padT / 2);
    c3ctx.fillStyle = "#6b7d8f";
    c3ctx.textAlign = "right";
    c3ctx.fillText("↑ predation   ↓ starvation", C3W - padR, padT / 2);
    c3ctx.textAlign = "left";
  }

  // ---- hud ----------------------------------------------------------------
  const el = {
    tick: document.getElementById("s-tick"),
    pop: document.getElementById("s-pop"),
    hunters: document.getElementById("s-hunt"),
    food: document.getElementById("s-food"),
    born: document.getElementById("s-born"),
    died: document.getElementById("s-died"),     // motes lost to hunger (chip labelled "starved")
    eaten: document.getElementById("s-eaten"),
    aged: document.getElementById("s-aged"),      // hunters lost to old age (senescence turnover)
    morphs: document.getElementById("s-morphs"),
    herd: document.getElementById("s-herd"),      // mean sociability — the wary↔sociable axis, live
    regime: document.getElementById("s-regime"),
    season: document.getElementById("s-season"),
    seed: document.getElementById("s-seed"),
  };
  // short "high∙low" caption for the axis a morph split runs along
  const morphAxisLabel = (key) => {
    const g = MORPH_GENES.find((x) => x.key === key);
    return g ? `${g.hiName}∙${g.loName}` : key;
  };
  // compact, colour-coded HUD text for the current predation-cycle phase: warm red as
  // the cull surges, amber holding steady, cool teal as it ebbs, cold blue if the
  // predators have genuinely collapsed. The chip now moves WITH the cycle, not once a world.
  function regimeDisplay(r) {
    if (r.state === "settling")  return { text: "settling…", color: "#8ba3b8" };
    if (r.state === "collapsed") return { text: r.trend === "rising" ? "collapsed ↑" : "collapsed", color: "#7fb0e0" };
    if (r.state === "surge")     return { text: "surging ↑", color: "#ff6b6b" };
    if (r.state === "ebb")       return { text: "ebbing ↓", color: "#5fc8b0" };
    // a steady phase on a strong secular slope reads "building/thinning" — a slow establishment
    // ramp or decline, warmer/cooler in tone than a flat "steady" but not a boom-bust departure
    if (r.building > 0)          return { text: "building ↑", color: "#d69a5c" };
    if (r.building < 0)          return { text: "thinning ↓", color: "#6ca8a0" };
    return { text: "steady", color: "#e0b04a" };
  }
  // herd sociability readout: the mean of the third grazer axis, worded and colour-matched
  // to the per-mote whisker (cool blue = wary, warm orange = sociable, pale = neutral). Under a
  // density-seeking hunter the herd evolves WARY (steers apart); lift predation and it relaxes
  // toward 0. mean=null (no motes, mid-reseed) reads "—" rather than a phantom number.
  function herdDisplay(mean) {
    if (mean == null || !Number.isFinite(mean)) return { text: "—", color: "#8ba3b8" };
    const num = (mean >= 0 ? "+" : "−") + Math.abs(mean).toFixed(2);
    if (mean <= -0.15) return { text: `wary ${num}`, color: "#5f9fd6" };
    if (mean >= 0.15)  return { text: `sociable ${num}`, color: "#e0a04a" };
    return { text: `neutral ${num}`, color: "#9aa7b0" };
  }
  function updateHud() {
    el.tick.textContent = world.tick;
    el.pop.textContent = world.motes.length;
    el.hunters.textContent = world.hunters.length;
    el.food.textContent = Math.round(biomass());
    el.born.textContent = world.born;
    el.died.textContent = world.died;             // starvation deaths (cool marks in the field)
    el.eaten.textContent = world.eaten;           // predation deaths (warm kill-flashes)
    if (el.aged) el.aged.textContent = world.hunterAged;  // hunter senescence (grey marks) — the tier turning over
    // morph readout: "1" for a single cloud, "2 · keen∙dull" when the pool has split
    const mo = world.morphs;
    el.morphs.textContent = mo.k >= 2 && mo.gene ? `${mo.k} · ${morphAxisLabel(mo.gene)}` : String(mo.k);
    // herd wariness readout: mean sociability over the live grazers, at a glance like the regime.
    // The last Expedition's headline (predation → WARY) lived only in observe.js and a faint
    // per-mote whisker; this makes it legible in the browser without squinting at individuals.
    if (el.herd) {
      const n = world.motes.length;
      let mean = null;
      if (n > 0) { let s = 0; for (const m of world.motes) s += m.g.social; mean = s / n; }
      const hd = herdDisplay(mean);
      el.herd.textContent = hd.text;
      el.herd.style.color = hd.color;
      el.herd.title = mean == null
        ? "no grazers to read"
        : `mean sociability ${mean.toFixed(2)} of [-1.00 … +1.20] — ${
            mean <= -0.15 ? "the herd keeps its distance (wary), the anti-predator strategy that pays against a hunter which homes on the densest prey"
            : mean >= 0.15 ? "the herd seeks the crowd (sociable)"
            : "no strong pull either way (neutral)"}`;
    }
    // regime readout: where the world sits in its predation cycle, colour-coded, with
    // the full sentence tucked into the tooltip for anyone who hovers it
    if (el.regime) {
      const rd = regimeDisplay(world.regime);
      el.regime.textContent = rd.text;
      el.regime.style.color = rd.color;
      el.regime.title = world.regime.label;
    }
    // this world's name — the number that will regrow it exactly, sitting in the URL
    if (el.seed) {
      el.seed.textContent = world.seedValue == null ? "—" : String(world.seedValue);
      el.seed.title = world.seedValue == null
        ? "this world is freely random — it has no seed and cannot be replayed"
        : `world #${world.seedValue} — its name is in the address bar, so copying the URL shares this exact world`;
    }
    // growth multiplier, with an arrow for whether we're warming toward summer
    const rising = Math.cos((world.tick / CONFIG.seasonPeriod) * TAU) >= 0;
    el.season.textContent = `×${seasonGrow().toFixed(2)} ${rising ? "↑" : "↓"}`;
  }

  // ---- loop ---------------------------------------------------------------
  function frame() {
    if (!world.paused) {
      for (let i = 0; i < world.stepsPerFrame; i++) step();
    }
    draw();
    drawChart();
    drawCountChart();
    drawArmsChart();
    updateHud();
    requestAnimationFrame(frame);
  }

  // ---- controls -----------------------------------------------------------
  document.getElementById("btn-pause").addEventListener("click", (e) => {
    world.paused = !world.paused;
    e.target.textContent = world.paused ? "resume" : "pause";
  });
  document.getElementById("btn-seed").addEventListener("click", () => {
    // a generous scattering of seeds across the field
    for (let k = 0; k < 240; k++) {
      const i = (rng() * world.veg.length) | 0;
      const start = 0.6 * world.fert[i];
      if (world.veg[i] < start) world.veg[i] = start;
    }
  });
  // Not just a reshuffle any more: this mints a *named* world and puts its name in
  // the address bar, so the one you happen to like is one copied URL from permanent.
  document.getElementById("btn-reset").addEventListener("click", () => { newWorld(); });
  document.getElementById("speed").addEventListener("input", (e) => {
    world.stepsPerFrame = parseInt(e.target.value, 10);
  });

  // cycle the hidden-landscape overlay: off → fertility → grazing → soil → off
  const overlayNames = ["off", "fertility", "grazing", "soil"];
  const btnOverlay = document.getElementById("btn-overlay");
  function cycleOverlay() {
    world.overlay = (world.overlay + 1) % overlayNames.length;
    if (btnOverlay) btnOverlay.textContent = "overlay: " + overlayNames[world.overlay];
  }
  if (btnOverlay) btnOverlay.addEventListener("click", cycleOverlay);
  if (typeof document.addEventListener === "function") {
    document.addEventListener("keydown", (e) => {
      if (e.key === "o" || e.key === "O") cycleOverlay();
    });
  }

  // ---- this world's name (the URL hash) -----------------------------------
  // A seeded world is a shareable one. The seed rides in the address bar as `#s=…`,
  // so copying the URL hands someone the *exact* world you are watching — the same
  // meadow, the same herd, the same collapse at the same tick — instead of merely
  // "a terrarium". Under Node there is no location, so the harnesses stay freely
  // random unless they ask for a seed themselves.
  const HAS_LOCATION =
    typeof location !== "undefined" && location != null && typeof location.hash === "string";
  function readHashSeed() {
    if (!HAS_LOCATION) return null;
    const m = /[#&]s=(\d+)/.exec(location.hash);
    if (!m) return null;
    const v = Number(m[1]);
    return Number.isFinite(v) ? v >>> 0 : null;
  }
  function writeHashSeed(v) {
    if (!HAS_LOCATION) return;
    // A fragment-only change never reloads the page; some file:// setups still
    // object, and a world that runs beats a URL that's tidy.
    try { location.hash = "s=" + v; } catch (e) { /* ignore */ }
  }
  // Mint a brand-new world and remember its name in the URL.
  function newWorld() {
    const v = randomSeed();
    seed(v);
    writeHashSeed(v);
    return v;
  }

  // ---- go -----------------------------------------------------------------
  if (HAS_LOCATION) {
    const fromHash = readHashSeed();
    if (fromHash == null) newWorld();          // first visit: mint one and publish it
    else { seed(fromHash); writeHashSeed(fromHash); }   // a shared link: replay it exactly
  } else {
    seed();                                     // headless: unseeded unless asked
  }
  requestAnimationFrame(frame);

  // Headless hook: when loaded under Node (the smoke test), expose the internals
  // so a DOM/canvas shim can drive real ticks. No effect in a browser.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      world, step, seed, setSeed, randomSeed, sample, biomass, CONFIG, GRID,
      draw, drawChart, drawCountChart, drawArmsChart, updateHud,
      classifyMorphs, MORPH_GENES, classifyRegime, regimeMood,
      concealment, hideability, metaboIntakeMult, huntMetaboMult, sprintDrag, predationShare, cellIndex,
      rebuildFlock, senseFlock,
    };
  }
})();
