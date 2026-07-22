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

  // ---- tunables -----------------------------------------------------------
  const CONFIG = {
    startMotes: 40,
    reproEnergy: 160,        // energy needed to split
    reproCost: 90,           // energy handed to the child
    baseMetabolism: 0.06,    // energy burned per tick at rest
    startEnergy: 90,
    maxPop: 600,
    sampleEvery: 30,         // ticks between history samples
    historyCap: 240,         // how many samples the charts keep
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
    fertMin: 0.28,           // poorest ground's carrying capacity (richest is 1.0)
    corpseVeg: 0.6,          // vegetation a dead mote returns to the cell it fell on
    startVegFrac: 0.7,       // initial vegetation as a fraction of each cell's fertility
    grazeDecay: 0.99,        // grazing-pressure heat fades ~1%/tick so the overlay shows
                             // *recent* eating; view-only, nothing in the economy reads it

    // The Predation Era — hunters, a second organism that eats motes, not plants.
    // The whole trophic pyramid balances here: hunters must be able to catch and
    // profit from grazers, yet be costly enough that they can't run the prey to
    // extinction. Tuned empirically with smoke.js into a phase-lagged limit cycle.
    hunterStart: 12,          // predators seeded at world start — enough to blunt the
                              // founding prey boom instead of chasing it from behind
    hunterMaxPop: 75,         // a roomy ceiling the herd rarely touches — the real limit is
                              // satiation + metabolism, so hunters oscillate, not pin here
    hunterMetabolism: 0.1,    // base energy burned per tick — hunters are costly to run, so
                              // they die back when prey thins (the cycle's downswing)
    hunterStartEnergy: 120,
    hunterReproEnergy: 285,   // energy needed to split (a slowish numerical response damps
                              // the boom so predators can't overshoot the prey to nothing)
    hunterReproCost: 140,     // energy handed to the pup
    hunterCrowd: 1.6,         // territoriality: the split threshold rises steeply with
                              // predator density, so hunters brake to an equilibrium well
                              // below the cap and oscillate there instead of pinning at it
    huntRange: 6,             // extra px added to (predator+prey radius) to land a catch
    huntCooldown: 40,         // ticks a hunter must digest after a kill before it can strike
                              // again — a Type-II satiation that caps the total harvest, so
                              // prey keep a refuge and predators self-limit below their cap
    huntAssimilation: 0.35,   // fraction of the prey's stored energy the hunter absorbs
    huntBonus: 18,            // flat energy per kill on top of the assimilated share
    hunterCorpseVeg: 0.85,    // a fallen hunter feeds more plants than a mote does
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

    // Hunger-driven boldness — the recovery valve for a collapsing predator tier.
    // observe.js showed the world is bistable: ~half of seeds fall into a "grazer
    // haven" where hunters bleed to a handful, motes overpopulate, and the meadow is
    // grazed bare — so prey are energy-poor and kills stop paying, a death spiral the
    // tier never climbs out of. Catches are AMBUSH-limited (a panicking mote outruns
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

    sparkFade: 0.045,         // per-tick fade of a kill-flash marker (view only)

    // Regime readout — naming, live, which of the two bistable attractors the world
    // is currently in. observe.js showed the ecology is bistable (a predator arms-race
    // vs. a grazer-haven collapse) but that fact was invisible in the running world:
    // you had to read raw hunter counts to know which one you were watching. A Schmitt
    // trigger on the recent mean hunter count (asymmetric thresholds → hysteresis, so it
    // won't flicker in the ambiguous middle band) plus a trend test that catches a tier
    // clawing back turns the invisible lottery into a labelled, narrated phase transition.
    regimeWindow: 24,         // history samples (~720 ticks) the readout averages over
    regimeArmsOn: 22,         // mean hunters at/above which the world reads "arms-race"
    regimeHavenOn: 12,        // mean hunters at/below which it reads "grazer-haven"
    regimeFlashTicks: 150,    // how long the on-canvas transition banner lingers after a flip
  };

  // Traits plotted on the live chart, each normalized to its full genetic range
  // (the mutation clamp bounds) so three very different scales share one axis.
  const TRAITS = [
    { key: "speed", label: "speed", color: "#f4a259", lo: 0.25, hi: 2.6 },
    { key: "size",  label: "size",  color: "#7fd1c1", lo: 1.6,  hi: 6.5 },
    { key: "sense", label: "sense", color: "#a78bfa", lo: 12,   hi: 120 },
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

  // ---- helpers ------------------------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);
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
      };
    }
    return {
      speed: mutate(parent.speed, 0.18, 0.25, 2.6),
      size: mutate(parent.size, 0.4, 1.6, 6.5),
      sense: mutate(parent.sense, 8, 12, 120),
      metabo: mutate(parent.metabo, 0.12, 0.6, 1.8),
      hue: mutate(parent.hue, 12, 0, 359),
    };
  }

  function makeMote(x, y, genome) {
    return {
      x, y,
      dir: rand(0, TAU),
      energy: CONFIG.startEnergy,
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
      age: 0,
      cool: 0,               // digestion timer; >0 means sated and not hunting
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
    graze: new Float64Array(GRID.n),    // decaying record of recent grazing (view only)
    tick: 0,
    born: 0,
    died: 0,                            // motes lost to starvation (predation is `eaten`)
    eaten: 0,                           // motes caught by hunters
    hunterBorn: 0,
    hunterDied: 0,
    paused: false,
    stepsPerFrame: 2,
    overlay: 0,    // hidden-landscape lens: 0 off · 1 fertility map · 2 grazing pressure
    history: [],   // rolling samples of trait averages + counts
    morphs: { k: 1, n: 0, gene: null, n0: 0, n1: 0, sep: 0 }, // live morph readout
    _morphPendK: 1, // hysteresis: proposed k awaiting confirmation
    _morphPendN: 0, // consecutive samples agreeing on the proposed k
    // which bistable attractor the world is in, read live off the history buffer
    regime: { state: "settling", trend: "steady", label: "settling — reading the world…",
              hmean: 0, flash: 0, flashText: "" },
  };

  function seed() {
    world.fert = buildFertility();
    world.veg = new Float64Array(GRID.n);
    world.vegNext = new Float64Array(GRID.n);
    world.graze = new Float64Array(GRID.n);
    for (let i = 0; i < GRID.n; i++) world.veg[i] = world.fert[i] * CONFIG.startVegFrac;
    world.motes = [];
    world.hunters = [];
    world.sparks = [];
    world.tick = 0;
    world.born = 0;
    world.died = 0;
    world.eaten = 0;
    world.hunterBorn = 0;
    world.hunterDied = 0;
    world.history = [];
    world.morphs = { k: 1, n: 0, gene: null, n0: 0, n1: 0, sep: 0 };
    world._morphPendK = 1;
    world._morphPendN = 0;
    world.regime = { state: "settling", trend: "steady", label: "settling — reading the world…",
                     hmean: 0, flash: 0, flashText: "" };
    for (let i = 0; i < CONFIG.startMotes; i++) {
      world.motes.push(makeMote(rand(0, W), rand(0, H)));
    }
    for (let i = 0; i < CONFIG.hunterStart; i++) {
      world.hunters.push(makeHunter(rand(0, W), rand(0, H)));
    }
  }

  // ---- vegetation dynamics ------------------------------------------------
  // Logistic regrowth toward each cell's fertility, scaled by the season. Bare
  // cells (0) can't regrow on their own — they must be seeded or spread into.
  function growVeg() {
    const veg = world.veg, fert = world.fert;
    const g = CONFIG.vegGrowth * seasonGrow();
    for (let i = 0; i < veg.length; i++) {
      const v = veg[i];
      let nv = v + g * v * (fert[i] - v);   // >fert (e.g. from a corpse) decays back
      if (nv < 0) nv = 0;
      veg[i] = nv;
    }
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
    const veg = world.veg, fert = world.fert;
    while (s > 0) {
      if (s >= 1 || Math.random() < s) {
        const i = (Math.random() * veg.length) | 0;
        const start = CONFIG.vegSeedAmount * fert[i];
        if (veg[i] < start) veg[i] = start;
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
    { key: "speed",  lo: 0.25, hi: 2.6,  hiName: "swift",  loName: "slow"    },
    { key: "size",   lo: 1.6,  hi: 6.5,  hiName: "large",  loName: "small"   },
    { key: "sense",  lo: 12,   hi: 120,  hiName: "keen",   loName: "dull"    },
    { key: "metabo", lo: 0.6,  hi: 1.8,  hiName: "greedy", loName: "thrifty" },
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
  // Which of the two bistable attractors is the world in right now? A pure reading
  // off the history buffer's recent hunter counts. The base state is a Schmitt
  // trigger — enter "arms-race" only once the mean rises to regimeArmsOn, drop to
  // "grazer-haven" only once it falls to regimeHavenOn, and in the ambiguous band
  // between them HOLD the previous state (that hysteresis is what stops the readout
  // strobing on a marginal seed). A separate trend test compares the window's first
  // half to its second so a predator tier clawing back out of collapse reads as
  // "recovering" and a thriving one sliding down reads as "destabilising". Nothing in
  // the economy ever reads world.regime back — it is pure narration, like the charts.
  function classifyRegime(history, prev) {
    if (!history || history.length < 8) {
      return { state: "settling", trend: "steady", label: "settling — reading the world…", hmean: 0 };
    }
    const win = Math.min(CONFIG.regimeWindow, history.length);
    const s = history.slice(history.length - win);
    let sum = 0;
    for (let i = 0; i < win; i++) sum += s[i].hunters;
    const hmean = sum / win;

    // trend: mean of the window's first half vs its second half
    const half = Math.max(1, win >> 1);
    let early = 0, late = 0;
    for (let i = 0; i < half; i++) early += s[i].hunters;
    for (let i = win - half; i < win; i++) late += s[i].hunters;
    const hEarly = early / half, hLate = late / half;
    const slope = hLate - hEarly;
    const thr = Math.max(2, hEarly * 0.25);       // ignore small wobble; demand a real move
    const trend = slope > thr ? "recovering" : slope < -thr ? "declining" : "steady";

    // base state with hysteresis (a Schmitt trigger on the mean hunter count)
    let state;
    if (hmean >= CONFIG.regimeArmsOn) state = "arms-race";
    else if (hmean <= CONFIG.regimeHavenOn) state = "grazer-haven";
    else if (prev === "arms-race" || prev === "grazer-haven") state = prev;
    else state = hmean >= (CONFIG.regimeArmsOn + CONFIG.regimeHavenOn) / 2 ? "arms-race" : "grazer-haven";

    const label = state === "arms-race"
      ? (trend === "declining" ? "arms-race — thriving, but destabilising ↓" : "arms-race — predators thriving")
      : (trend === "recovering" ? "grazer-haven — predators clawing back ↑" : "grazer-haven — predators failing");
    return { state, trend, label, hmean };
  }

  // ---- history sample -----------------------------------------------------
  // One rolling sample records both the gene-pool shape (for the trait chart)
  // and the raw population/biomass counts (for the boom-and-bust chart).
  function sample() {
    const n = world.motes.length;
    let speed = 0, size = 0, sense = 0;
    for (const m of world.motes) {
      speed += m.g.speed;
      size += m.g.size;
      sense += m.g.sense;
    }
    const inv = n > 0 ? 1 / n : 0;
    world.history.push({
      speed: speed * inv,
      size: size * inv,
      sense: sense * inv,
      pop: n,
      hunters: world.hunters.length,
      food: Math.round(biomass()),
    });
    if (world.history.length > CONFIG.historyCap) world.history.shift();

    // update the morph readout on the same cadence, with light hysteresis so the
    // HUD doesn't flicker between 1 and 2 on a marginal sample: a change in morph
    // count must persist for three samples (~90 ticks) before it's committed.
    const cls = classifyMorphs(world.motes);
    if (cls.k === world._morphPendK) world._morphPendN++;
    else { world._morphPendK = cls.k; world._morphPendN = 1; }
    if (world._morphPendN >= 3 || cls.k === world.morphs.k) world.morphs = cls;

    // update the live regime readout on the same cadence. When the base attractor
    // flips between the two concrete states, arm a transition banner (a settling→state
    // transition isn't a flip — the world was never in the other attractor to leave).
    const rg = classifyRegime(world.history, world.regime.state);
    const both = (a, b) => (a === "arms-race" || a === "grazer-haven") &&
                           (b === "arms-race" || b === "grazer-haven");
    if (both(rg.state, world.regime.state) && rg.state !== world.regime.state) {
      world.regime.flash = CONFIG.regimeFlashTicks;
      world.regime.flashText = rg.state === "arms-race"
        ? "→ arms-race — the predators surge back"
        : "→ grazer-haven — the predators are failing";
    }
    world.regime.state = rg.state;
    world.regime.trend = rg.trend;
    world.regime.label = rg.label;
    world.regime.hmean = rg.hmean;
  }

  // ---- simulation step ----------------------------------------------------
  function step() {
    world.tick++;

    // the ground lives its own life first
    growVeg();
    spreadVeg();
    sowSeeds();
    decayGraze();

    const newborns = [];
    for (let i = world.motes.length - 1; i >= 0; i--) {
      const m = world.motes[i];
      m.age++;

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
          m.dir = torusAngle(thx, thy, m.x, m.y);   // bearing away from the hunter
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
        else if (Math.random() < 0.08) m.dir += rand(-0.6, 0.6); // idle wander
      }

      // move — a bolting mote sprints (and pays for it in the burn below); a hiding
      // mote barely twitches, so it stays put in its cover and pays almost nothing
      const v = hiding ? m.g.speed * CONFIG.coverFreezeSpeed
                       : m.g.speed * (threat ? CONFIG.panicBoost : 1);
      m.x = wrap(m.x + Math.cos(m.dir) * v, W);
      m.y = wrap(m.y + Math.sin(m.dir) * v, H);

      // burn energy: bigger + faster costs more
      const cost = CONFIG.baseMetabolism * m.g.metabo * (1 + m.g.size * 0.15 + v * 0.4);
      m.energy -= cost;

      // graze the cell underfoot
      const ci = cellIndex(m.x, m.y);
      const avail = world.veg[ci];
      if (avail > 0) {
        const bite = avail < CONFIG.vegGrazeRate ? avail : CONFIG.vegGrazeRate;
        world.veg[ci] = avail - bite;
        m.energy += bite * CONFIG.vegEnergy;
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
        newborns.push(child);
        world.born++;
      }

      // death — the corpse fertilises the ground where it fell
      if (m.energy <= 0) {
        world.motes.splice(i, 1);
        world.died++;
        const di = cellIndex(m.x, m.y);
        world.veg[di] = clamp(world.veg[di] + CONFIG.corpseVeg, 0, 1.2);
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
      } else if (Math.random() < 0.06) {
        h.dir += rand(-0.5, 0.5); // prowl
      }

      // move — a starving hunter puts on a closing sprint (which costs more energy
      // below, via v: reckless is expensive, so a bold hunter that misses dies faster)
      const v = h.g.speed * (1 + CONFIG.hunterBoldSprint * bold);
      h.x = wrap(h.x + Math.cos(h.dir) * v, W);
      h.y = wrap(h.y + Math.sin(h.dir) * v, H);

      // burn energy — hunters are expensive to run
      h.energy -= CONFIG.hunterMetabolism * h.g.metabo * (1 + h.g.size * 0.1 + v * 0.4);

      // strike: if digestion is done and the target is now within a body-length, eat it
      if (best >= 0 && h.cool <= 0) {
        const prey = world.motes[best];
        // cover shrinks the catch window too: even once a hunter closes, a hidden mote
        // is hard to pin down in the veg, so hiding protects the last body-length as well
        const shield = 1 - (prey._cover || 0) * CONFIG.coverStrikeShield;
        const cr = (h.g.size + prey.g.size + CONFIG.huntRange + CONFIG.hunterBoldReach * bold) * shield;
        if (torusD2(h.x, h.y, prey.x, prey.y) < cr * cr) {
          h.energy += (prey.energy > 0 ? prey.energy : 0) * CONFIG.huntAssimilation + CONFIG.huntBonus;
          h.cool = CONFIG.huntCooldown;   // digest before the next strike
          world.motes.splice(best, 1);
          world.eaten++;
          if (world.sparks.length < 240) world.sparks.push({ x: prey.x, y: prey.y, life: 1 });
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
        newHunters.push(pup);
        world.hunterBorn++;
      }

      // death — a fallen hunter feeds the plants where it dropped
      if (h.energy <= 0) {
        world.hunters.splice(i, 1);
        world.hunterDied++;
        const di = cellIndex(h.x, h.y);
        world.veg[di] = clamp(world.veg[di] + CONFIG.hunterCorpseVeg, 0, 1.2);
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
    // seasonal base: cool and dark in winter, a touch warmer at high summer
    const p = (seasonWave() + 1) / 2; // 0 = deep winter, 1 = high summer
    ctx.fillStyle = `rgb(${6 + 6 * p | 0}, ${9 + 5 * p | 0}, ${13 + 5 * p | 0})`;
    ctx.fillRect(0, 0, W, H);

    // the living ground — each vegetated cell tinted by its density, the whole
    // meadow shifting from olive in winter toward green in summer
    const cell = CONFIG.vegCell, cols = GRID.cols, rows = GRID.rows;
    const hueBase = 80 + p * 34;
    const veg = world.veg;
    for (let y = 0; y < rows; y++) {
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        const d = veg[row + x];
        if (d <= 0.02) continue;
        const t = d > 1 ? 1 : d;
        ctx.fillStyle = `hsl(${(hueBase - t * 8).toFixed(0)} ${(30 + t * 36).toFixed(0)}% ${(6 + t * 40).toFixed(0)}%)`;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    // an optional lens on the hidden landscape, painted over the meadow
    drawOverlay();

    // motes — each ringed by its lifestyle so the two anti-predator strategies are
    // visible at a glance: a committed hider (small, slow) wears a cool leaf-green halo
    // and melts into the meadow; a committed fleer (fast) wears a hot amber halo and
    // reads as alert and exposed; the mediocre middle is faintly, muddily ringed.
    for (const m of world.motes) {
      const glow = clamp(m.energy / CONFIG.reproEnergy, 0.25, 1);
      const H = hideability(m.g);                       // 1 = hider, 0 = fleer
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.g.size, 0, TAU);
      ctx.fillStyle = `hsl(${m.g.hue.toFixed(0)} 65% ${(40 + glow * 24).toFixed(0)}%)`;
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
      // a little heading whisker
      ctx.strokeStyle = `hsl(${m.g.hue.toFixed(0)} 65% 72% / 0.5)`;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + Math.cos(m.dir) * (m.g.size + 3), m.y + Math.sin(m.dir) * (m.g.size + 3));
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
      ctx.restore();
    }

    // kill-flashes — a brief expanding ring where a mote was caught, so predation
    // is legible even when the world is running fast
    for (const sp of world.sparks) {
      const r = (1 - sp.life) * 13 + 3;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, TAU);
      ctx.strokeStyle = `rgba(255,${(90 + 130 * sp.life) | 0},${(70 * sp.life) | 0},${(sp.life * 0.85).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // regime-transition banner — when the world tips from one attractor to the other,
    // a labelled marker fades across the top so the phase change is impossible to miss
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
      ctx.fillStyle = world.regime.state === "arms-race" ? "#ff8a6b" : "#7fe0a0";
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
    }

    // legend with current averages
    cctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    cctx.textBaseline = "middle";
    const latest = hist.length ? hist[hist.length - 1] : null;
    let lx = padL;
    for (const t of TRAITS) {
      cctx.fillStyle = t.color;
      cctx.fillRect(lx, padT / 2 - 4, 8, 8);
      lx += 12;
      const raw = latest ? latest[t.key] : null;
      const val = raw === null ? "–" : raw.toFixed(raw >= 10 ? 0 : 2);
      const text = `${t.label} ${val}`;
      cctx.fillStyle = "#cdd8e4";
      cctx.fillText(text, lx, padT / 2);
      lx += cctx.measureText(text).width + 16;
    }
    if (hist.length <= 1) {
      cctx.fillStyle = "#6b7d8f";
      cctx.fillText("gathering data…", lx, padT / 2);
    }
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

  // ---- hud ----------------------------------------------------------------
  const el = {
    tick: document.getElementById("s-tick"),
    pop: document.getElementById("s-pop"),
    hunters: document.getElementById("s-hunt"),
    food: document.getElementById("s-food"),
    born: document.getElementById("s-born"),
    died: document.getElementById("s-died"),
    eaten: document.getElementById("s-eaten"),
    morphs: document.getElementById("s-morphs"),
    regime: document.getElementById("s-regime"),
    season: document.getElementById("s-season"),
  };
  // short "high∙low" caption for the axis a morph split runs along
  const morphAxisLabel = (key) => {
    const g = MORPH_GENES.find((x) => x.key === key);
    return g ? `${g.hiName}∙${g.loName}` : key;
  };
  // compact, colour-coded HUD text for the current regime: red when predators rule,
  // green when the grazers have the run of the meadow, amber while a tier claws back.
  function regimeDisplay(r) {
    if (r.state === "settling") return { text: "settling…", color: "#8ba3b8" };
    if (r.state === "arms-race") return { text: r.trend === "declining" ? "arms-race ↓" : "arms-race", color: "#ff6b6b" };
    if (r.trend === "recovering") return { text: "recovering ↑", color: "#e0b04a" };
    return { text: "grazer-haven", color: "#6cc08a" };
  }
  function updateHud() {
    el.tick.textContent = world.tick;
    el.pop.textContent = world.motes.length;
    el.hunters.textContent = world.hunters.length;
    el.food.textContent = Math.round(biomass());
    el.born.textContent = world.born;
    el.died.textContent = world.died;
    el.eaten.textContent = world.eaten;
    // morph readout: "1" for a single cloud, "2 · keen∙dull" when the pool has split
    const mo = world.morphs;
    el.morphs.textContent = mo.k >= 2 && mo.gene ? `${mo.k} · ${morphAxisLabel(mo.gene)}` : String(mo.k);
    // regime readout: which bistable attractor the world is in, colour-coded, with
    // the full sentence tucked into the tooltip for anyone who hovers it
    if (el.regime) {
      const rd = regimeDisplay(world.regime);
      el.regime.textContent = rd.text;
      el.regime.style.color = rd.color;
      el.regime.title = world.regime.label;
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
      const i = (Math.random() * world.veg.length) | 0;
      const start = 0.6 * world.fert[i];
      if (world.veg[i] < start) world.veg[i] = start;
    }
  });
  document.getElementById("btn-reset").addEventListener("click", seed);
  document.getElementById("speed").addEventListener("input", (e) => {
    world.stepsPerFrame = parseInt(e.target.value, 10);
  });

  // cycle the hidden-landscape overlay: off → fertility → grazing → off
  const overlayNames = ["off", "fertility", "grazing"];
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

  // ---- go -----------------------------------------------------------------
  seed();
  requestAnimationFrame(frame);

  // Headless hook: when loaded under Node (the smoke test), expose the internals
  // so a DOM/canvas shim can drive real ticks. No effect in a browser.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      world, step, seed, sample, biomass, CONFIG, GRID,
      draw, drawChart, drawCountChart, updateHud,
      classifyMorphs, MORPH_GENES, classifyRegime,
      concealment, hideability, cellIndex,
    };
  }
})();
