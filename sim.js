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
  };

  // Traits plotted on the live chart, each normalized to its full genetic range
  // (the mutation clamp bounds) so three very different scales share one axis.
  const TRAITS = [
    { key: "speed", label: "speed", color: "#f4a259", lo: 0.25, hi: 2.6 },
    { key: "size",  label: "size",  color: "#7fd1c1", lo: 1.6,  hi: 6.5 },
    { key: "sense", label: "sense", color: "#a78bfa", lo: 12,   hi: 120 },
  ];

  // The economy's boom & bust: population count and total plant biomass share a
  // panel with an auto-scaled axis, so grazing pressure is legible over time.
  const COUNTS = [
    { key: "pop",  label: "motes",  color: "#e88fb0" },
    { key: "food", label: "plants", color: "#6cc08a" },
  ];

  // ---- helpers ------------------------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const wrap = (x, max) => (x < 0 ? x + max : x >= max ? x - max : x);

  function mutate(v, amt, lo, hi) {
    return clamp(v + rand(-amt, amt), lo, hi);
  }

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

  // ---- world state --------------------------------------------------------
  const world = {
    motes: [],
    veg: new Float64Array(GRID.n),      // plant density per cell
    vegNext: new Float64Array(GRID.n),  // scratch buffer for the diffusion pass
    fert: new Float64Array(GRID.n),     // static carrying capacity per cell
    tick: 0,
    born: 0,
    died: 0,
    paused: false,
    stepsPerFrame: 2,
    history: [],   // rolling samples of trait averages + counts
  };

  function seed() {
    world.fert = buildFertility();
    world.veg = new Float64Array(GRID.n);
    world.vegNext = new Float64Array(GRID.n);
    for (let i = 0; i < GRID.n; i++) world.veg[i] = world.fert[i] * CONFIG.startVegFrac;
    world.motes = [];
    world.tick = 0;
    world.born = 0;
    world.died = 0;
    world.history = [];
    for (let i = 0; i < CONFIG.startMotes; i++) {
      world.motes.push(makeMote(rand(0, W), rand(0, H)));
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
      food: Math.round(biomass()),
    });
    if (world.history.length > CONFIG.historyCap) world.history.shift();
  }

  // ---- simulation step ----------------------------------------------------
  function step() {
    world.tick++;

    // the ground lives its own life first
    growVeg();
    spreadVeg();
    sowSeeds();

    const newborns = [];
    for (let i = world.motes.length - 1; i >= 0; i--) {
      const m = world.motes[i];
      m.age++;

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

      // move
      const v = m.g.speed;
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
      }

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

    // if everyone dies, gently reseed a few so the world never stays empty
    if (world.motes.length === 0) {
      for (let i = 0; i < 6; i++) world.motes.push(makeMote(rand(0, W), rand(0, H)));
    }

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

    // motes
    for (const m of world.motes) {
      const glow = clamp(m.energy / CONFIG.reproEnergy, 0.25, 1);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.g.size, 0, TAU);
      ctx.fillStyle = `hsl(${m.g.hue.toFixed(0)} 65% ${(40 + glow * 24).toFixed(0)}%)`;
      ctx.fill();
      // a little heading whisker
      ctx.strokeStyle = `hsl(${m.g.hue.toFixed(0)} 65% 72% / 0.5)`;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + Math.cos(m.dir) * (m.g.size + 3), m.y + Math.sin(m.dir) * (m.g.size + 3));
      ctx.stroke();
    }
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

  // ---- population & plants chart ------------------------------------------
  function drawCountChart() {
    c2ctx.fillStyle = "#060a0f";
    c2ctx.fillRect(0, 0, C2W, C2H);

    const padL = 8, padR = 8, padT = 22, padB = 10;
    const plotW = C2W - padL - padR;
    const plotH = C2H - padT - padB;

    const hist = world.history;
    const cap = CONFIG.historyCap;

    // auto-scale the axis to the tallest count in view, rounded up to a tidy step
    let vmax = 1;
    for (const s of hist) {
      if (s.pop > vmax) vmax = s.pop;
      if (s.food > vmax) vmax = s.food;
    }
    const top = Math.max(50, Math.ceil(vmax / 50) * 50);

    // faint reference lines at 0, half, and the axis top
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
      for (const c of COUNTS) {
        c2ctx.strokeStyle = c.color;
        c2ctx.lineWidth = 1.5;
        c2ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const norm = clamp(hist[i][c.key] / top, 0, 1);
          const x = padL + (i / (cap - 1)) * plotW;
          const y = padT + plotH * (1 - norm);
          if (i === 0) c2ctx.moveTo(x, y); else c2ctx.lineTo(x, y);
        }
        c2ctx.stroke();
      }
    }

    // legend with current counts, plus the axis top so the scale is legible
    c2ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    c2ctx.textBaseline = "middle";
    const latest = hist.length ? hist[hist.length - 1] : null;
    let lx = padL;
    for (const c of COUNTS) {
      c2ctx.fillStyle = c.color;
      c2ctx.fillRect(lx, padT / 2 - 4, 8, 8);
      lx += 12;
      const text = `${c.label} ${latest ? latest[c.key] : "–"}`;
      c2ctx.fillStyle = "#cdd8e4";
      c2ctx.fillText(text, lx, padT / 2);
      lx += c2ctx.measureText(text).width + 16;
    }
    c2ctx.fillStyle = "#6b7d8f";
    c2ctx.fillText(hist.length <= 1 ? "gathering data…" : `top ${top}`, lx, padT / 2);
  }

  // ---- hud ----------------------------------------------------------------
  const el = {
    tick: document.getElementById("s-tick"),
    pop: document.getElementById("s-pop"),
    food: document.getElementById("s-food"),
    born: document.getElementById("s-born"),
    died: document.getElementById("s-died"),
    season: document.getElementById("s-season"),
  };
  function updateHud() {
    el.tick.textContent = world.tick;
    el.pop.textContent = world.motes.length;
    el.food.textContent = Math.round(biomass());
    el.born.textContent = world.born;
    el.died.textContent = world.died;
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

  // ---- go -----------------------------------------------------------------
  seed();
  requestAnimationFrame(frame);

  // Headless hook: when loaded under Node (the smoke test), expose the internals
  // so a DOM/canvas shim can drive real ticks. No effect in a browser.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      world, step, seed, sample, biomass, CONFIG, GRID,
      draw, drawChart, drawCountChart, updateHud,
    };
  }
})();
