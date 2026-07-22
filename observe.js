/*
 * Terrarium — the observatory (dependency-free, Node only)
 *
 * smoke.js asks "is anything broken?" and answers pass/fail. This asks the other
 * question — "what is the world *doing*?" — and answers with numbers you have to
 * read and judge. It boots the real sim.js through the shared headless shim, ticks
 * it for a long run, and prints the step-2 report the loop requires: per-tier
 * population curves, safety-net firings, per-1k flow rates, an age distribution,
 * per-gene drift for *both* species with edge-pinning flags, a boredom check
 * (tick ~1k vs the end), and coarse ASCII density maps of the meadow and its life.
 *
 * It reports; it does not assert. A number that looks wrong is a finding, not a
 * failure — read it and decide. This is the microscope invariant 7 demands, and
 * without it no run can honestly claim to have *watched* the world before touching it.
 *
 * Run:  node observe.js [ticks]     (default 20000 ≈ 8+ seasonal cycles)
 * Exit: 0 = a clean reading; 1 = the sim threw or NaN leaked (a real defect).
 */
"use strict";

require("./shim.js");
const sim = require("./sim.js");
const { world, step, seed, biomass, CONFIG, GRID, classifyMorphs, hideability } = sim;

const ARGS = process.argv.slice(2);
const W = 960, H = 540;

// A dedicated experiment (not the normal single-world report): does PREDATION drive
// the hider/fleer divergence? Run N worlds with hunters against N with hunters removed,
// and compare the grazer strategy each evolves. Fires on `node observe.js --split-test`.
if (ARGS.includes("--split-test") || ARGS.includes("--divergence")) {
  const nums = ARGS.filter((a) => !a.startsWith("--")).map((x) => parseInt(x, 10)).filter((x) => x > 0);
  splitTest(nums[0] || 6, nums[1] || 15000);
  process.exit(0);
}

const TICKS = Math.max(1000, parseInt(process.argv[2], 10) || 20000);

// The mutation clamps from sim.js — the *true* range each gene can drift within, so
// "pinned at the edge" means pinned at a clamp, not merely at a founder bound. Keep
// these in sync with makeGenome / makeHunterGenome if those ranges ever change.
const GENES = ["speed", "size", "sense", "metabo", "hue"];
const RANGE = {
  mote:   { speed: [0.25, 2.6], size: [1.6, 6.5], sense: [12, 120], metabo: [0.6, 1.8], hue: [0, 359] },
  hunter: { speed: [0.6, 3.2],  size: [2.4, 9],   sense: [24, 170], metabo: [0.55, 1.8], hue: [0, 45] },
};
const MC = 48, MR = 16;   // ASCII map dimensions (declared here so the hoisted map fns can read it)

// ---- helpers ----------------------------------------------------------------
const finite = (x) => typeof x === "number" && Number.isFinite(x);
const fmt = (x, d = 2) => (finite(x) ? x.toFixed(d) : "NaN");
const pad = (s, n) => String(s).padStart(n);

function geneAverages(pop) {
  const out = {};
  const n = pop.length || 1;
  for (const k of GENES) {
    let s = 0;
    for (const c of pop) s += c.g[k];
    out[k] = s / n;
  }
  out.n = pop.length;
  return out;
}

// A running min/max/mean/std accumulator for a per-tick scalar.
function meter() {
  return { min: Infinity, max: -Infinity, sum: 0, sumsq: 0, n: 0,
    push(x) { if (x < this.min) this.min = x; if (x > this.max) this.max = x;
              this.sum += x; this.sumsq += x * x; this.n++; },
    mean() { return this.n ? this.sum / this.n : 0; },
    std() { const m = this.mean(); return Math.sqrt(Math.max(0, this.sumsq / this.n - m * m)); },
    cv() { const m = this.mean(); return m ? (100 * this.std()) / m : 0; } };
}

// ---- run --------------------------------------------------------------------
seed();
const founders = { mote: geneAverages(world.motes), hunter: geneAverages(world.hunters) };

const mPop = meter(), hPop = meter(), bio = meter();
let moteZeroTicks = 0, hunterEmptyTicks = 0;
let hunterEpisodes = 0, curEmpty = 0, longestEmpty = 0;   // hunter extinction stretches
let prevHunters = world.hunters.length;
let earlySnap = null;           // boredom check: a window around tick ~1000
// regime census: how long the live readout spent in each attractor, and how often
// it tipped between them (the bistability, finally counted rather than eyeballed)
const regimeTicks = { settling: 0, "arms-race": 0, "grazer-haven": 0 };
let recoveringTicks = 0, regimeFlips = 0, prevRegime = "settling";
let threw = null;

const t0 = Date.now();
try {
  for (let t = 1; t <= TICKS; t++) {
    step();
    const p = world.motes.length, hn = world.hunters.length, b = biomass();
    mPop.push(p); hPop.push(hn); bio.push(b);
    if (p <= 6) moteZeroTicks++;                 // the mote reseed net fires from 0→6
    if (hn === 0) { hunterEmptyTicks++; curEmpty++; }
    else { if (curEmpty > longestEmpty) longestEmpty = curEmpty; curEmpty = 0; }
    if (prevHunters > 0 && hn === 0) hunterEpisodes++;   // a fresh extinction stretch begins
    prevHunters = hn;

    const rs = world.regime.state;                       // step() refreshes this each sample
    regimeTicks[rs] = (regimeTicks[rs] || 0) + 1;
    if (rs === "grazer-haven" && world.regime.trend === "recovering") recoveringTicks++;
    if ((rs === "arms-race" || rs === "grazer-haven") &&
        (prevRegime === "arms-race" || prevRegime === "grazer-haven") && rs !== prevRegime) regimeFlips++;
    prevRegime = rs;

    if (t === 1000) {
      earlySnap = { pop: p, hunters: hn, bio: b,
                    mote: geneAverages(world.motes), hunter: geneAverages(world.hunters) };
    }
  }
} catch (e) { threw = e; }
if (curEmpty > longestEmpty) longestEmpty = curEmpty;
const secs = ((Date.now() - t0) / 1000).toFixed(1);

// ---- integrity --------------------------------------------------------------
let nanFlags = [];
const cleanCreature = (m) => finite(m.x) && finite(m.y) && finite(m.energy) &&
  GENES.every((k) => finite(m.g[k]));
if (!world.motes.every(cleanCreature)) nanFlags.push("motes");
if (!world.hunters.every(cleanCreature)) nanFlags.push("hunters");
for (let i = 0; i < world.veg.length; i++) {
  if (!finite(world.veg[i]) || world.veg[i] < 0) { nanFlags.push("veg grid"); break; }
}

// ---- report -----------------------------------------------------------------
const line = (s = "") => console.log(s);
line();
line("═══════════════════════════════════════════════════════════════════════");
line("  TERRARIUM OBSERVATORY");
line(`  ${TICKS} ticks in ${secs}s · grid ${GRID.cols}×${GRID.rows} · seasons ×0.4–×1.6 / ${CONFIG.seasonPeriod}t`);
line("═══════════════════════════════════════════════════════════════════════");

line("\n[1] INTEGRITY");
line(`    exceptions : ${threw ? "THREW — " + (threw.stack || threw) : "none"}`);
line(`    NaN / neg  : ${nanFlags.length ? "DIRTY in " + nanFlags.join(", ") : "clean (motes, hunters, veg grid)"}`);

line("\n[2] POPULATIONS  (every tick over the whole run)");
line("    tier       min      max     mean     CV%   motion");
const motion = (m) => (m.cv() > 12 ? "oscillates" : m.cv() > 4 ? "wobbles" : "FLAT");
const popRow = (name, m, d = 0) =>
  line(`    ${name.padEnd(8)} ${pad(m.min.toFixed(d), 6)}   ${pad(m.max.toFixed(d), 6)}   ${pad(m.mean().toFixed(d), 6)}   ${pad(m.cv().toFixed(0), 5)}   ${motion(m)}`);
popRow("plants", bio, 0);   // plants = total biomass, not a count
popRow("motes", mPop, 0);
popRow("hunters", hPop, 0);
line("    (plants = total vegetation biomass; motes/hunters = head counts)");

line("\n[3] SAFETY NETS  (how often the world had to be rescued)");
line(`    mote reseed floor : min pop ${mPop.min}, ${moteZeroTicks} tick(s) at/under the 0→6 net`);
line(`    hunter extinction : ${hunterEpisodes} episode(s), ${hunterEmptyTicks} empty tick(s), longest ${longestEmpty}`);
line(`    reseed thresholds : hunters re-drift when motes ≥ ${CONFIG.hunterReseedPrey}; motes reseed 6 from 0`);

const per1k = (x) => ((x / TICKS) * 1000).toFixed(1);
line("\n[4] FLOW  (per 1000 ticks · totals in parens)");
line(`    mote births    : ${pad(per1k(world.born), 6)}  (${world.born})`);
line(`    mote starved   : ${pad(per1k(world.died), 6)}  (${world.died})`);
line(`    motes eaten    : ${pad(per1k(world.eaten), 6)}  (${world.eaten})`);
line(`    hunter births  : ${pad(per1k(world.hunterBorn), 6)}  (${world.hunterBorn})`);
line(`    hunter deaths  : ${pad(per1k(world.hunterDied), 6)}  (${world.hunterDied})`);
const totMoteLoss = world.died + world.eaten;
line(`    mote deaths split: ${totMoteLoss ? Math.round((100 * world.eaten) / totMoteLoss) : 0}% predation / ${totMoteLoss ? Math.round((100 * world.died) / totMoteLoss) : 0}% starvation`);

line("\n[5] AGE  (ticks lived, sampled at the final tick)");
ageReport("motes", world.motes);
ageReport("hunters", world.hunters);

line("\n[6] TRAIT DRIFT  (founder avg → final avg · [clamp range] · ⚑ = pinned at an edge)");
driftReport("motes", world.motes, founders.mote, RANGE.mote);
driftReport("hunters", world.hunters, founders.hunter, RANGE.hunter);

line("\n[7] BOREDOM CHECK  (window near tick 1000 vs the final tick — is it still a live system?)");
boredomReport();

line("\n[8] SPATIAL  (coarse density, 48×16 over the 960×540 torus)");
vegMap();
lifeMap();

line("\n[9] GENE-POOL SHAPE  (the mean hides the shape — has the grazer pool SPLIT?)");
shapeReport();

line("\n[10] REGIME  (which bistable attractor this seed settled in — the live, hysteretic readout)");
regimeReport();

line();
line(threw ? "READING ABORTED — the sim threw (see [1])." :
     nanFlags.length ? "READING SUSPECT — NaN/negative leaked (see [1])." :
     "READING COMPLETE — judge the numbers above.");
line();

// ---- report sections --------------------------------------------------------
function ageReport(name, pop) {
  if (!pop.length) { line(`    ${name.padEnd(8)} (none alive)`); return; }
  const ages = pop.map((c) => c.age).sort((a, b) => a - b);
  const mean = ages.reduce((s, a) => s + a, 0) / ages.length;
  const median = ages[ages.length >> 1];
  const buckets = [50, 100, 200, 400, 800, Infinity];
  const labels = ["<50", "<100", "<200", "<400", "<800", "800+"];
  const counts = new Array(buckets.length).fill(0);
  for (const a of ages) counts[buckets.findIndex((b) => a < b)]++;
  const bars = counts.map((c, i) => {
    const w = Math.round((c / ages.length) * 24);
    return `      ${labels[i].padEnd(5)} ${"█".repeat(w).padEnd(24)} ${c}`;
  });
  line(`    ${name.padEnd(8)} n=${pop.length}  mean ${mean.toFixed(0)}  median ${median}  oldest ${ages[ages.length - 1]}`);
  for (const b of bars) line(b);
}

function driftReport(name, pop, founder, range) {
  line(`    ${name}:`);
  if (!pop.length) { line("      (none alive to read)"); return; }
  const now = geneAverages(pop);
  for (const k of GENES) {
    const [lo, hi] = range[k];
    const span = hi - lo || 1;
    const a = founder[k], b = now[k];
    const near = 0.02 * span;
    const pin = b <= lo + near ? " ⚑LO" : b >= hi - near ? " ⚑HI" : "";
    const arrow = b > a + span * 0.01 ? "↑" : b < a - span * 0.01 ? "↓" : "·";
    line(`      ${k.padEnd(7)} ${pad(fmt(a), 7)} → ${pad(fmt(b), 7)} ${arrow}   [${fmt(lo)} .. ${fmt(hi)}]${pin}`);
  }
}

function boredomReport() {
  if (!earlySnap) { line("    (run too short for an early window)"); return; }
  const lateMote = geneAverages(world.motes), lateHunt = geneAverages(world.hunters);
  const rows = [
    ["motes", earlySnap.pop, world.motes.length, 0],
    ["hunters", earlySnap.hunters, world.hunters.length, 0],
    ["biomass", earlySnap.bio, biomass(), 0],
    ["mote.speed", earlySnap.mote.speed, lateMote.speed, 2],
    ["mote.sense", earlySnap.mote.sense, lateMote.sense, 1],
    ["mote.metabo", earlySnap.mote.metabo, lateMote.metabo, 2],
    ["hunt.speed", earlySnap.hunter.speed, lateHunt.speed, 2],
    ["hunt.sense", earlySnap.hunter.sense, lateHunt.sense, 1],
  ];
  line("    metric        @1000       final        Δ");
  let moved = 0, gauged = 0;
  for (const [nm, e, l, d] of rows) {
    const delta = l - e;
    const rel = Math.abs(e) > 1e-6 ? Math.abs(delta) / Math.abs(e) : 0;
    if (nm.startsWith("mote.") || nm.startsWith("hunt.")) { gauged++; if (rel > 0.08) moved++; }
    line(`    ${nm.padEnd(12)} ${pad(fmt(e, d), 8)}   ${pad(fmt(l, d), 8)}   ${pad((delta >= 0 ? "+" : "") + fmt(delta, d), 8)}`);
  }
  const popMoved = mPop.cv() > 12 || hPop.cv() > 12 || bio.cv() > 12;
  line(`    verdict: ${popMoved ? "populations still swing" : "populations nearly static"}; ` +
       `genes ${moved}/${gauged} shifted >8% between 1k and end ` +
       `→ ${(popMoved || moved > 0) ? "a live, moving system" : "⚠ possible fixed point (boredom risk)"}`);
}

// Downsample a per-cell / per-creature field into a coarse ASCII grid.
function vegMap() {
  const acc = new Float64Array(MC * MR), cnt = new Float64Array(MC * MR);
  const { cols, rows } = GRID;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const mx = Math.min(MC - 1, (cx / cols * MC) | 0);
      const my = Math.min(MR - 1, (cy / rows * MR) | 0);
      acc[my * MC + mx] += world.veg[cy * cols + cx];
      cnt[my * MC + mx]++;
    }
  }
  const ramp = " .:-=+*#%@";
  let mx = 0;
  for (let i = 0; i < acc.length; i++) { const v = acc[i] / (cnt[i] || 1); if (v > mx) mx = v; }
  line(`    vegetation density  (max cell mean ${fmt(mx)}; ramp "${ramp}")`);
  for (let y = 0; y < MR; y++) {
    let s = "    ";
    for (let x = 0; x < MC; x++) {
      const v = acc[y * MC + x] / (cnt[y * MC + x] || 1);
      const q = mx > 0 ? v / mx : 0;
      s += ramp[Math.min(ramp.length - 1, (q * ramp.length) | 0)];
    }
    line(s);
  }
}

function lifeMap() {
  const mote = new Int32Array(MC * MR), hunt = new Int32Array(MC * MR);
  for (const m of world.motes) mote[binCell(m.x, m.y)]++;
  for (const h of world.hunters) hunt[binCell(h.x, h.y)]++;
  let mx = 0;
  for (let i = 0; i < mote.length; i++) if (mote[i] > mx) mx = mote[i];
  const ramp = " .:oO@";
  line(`    life  (motes: "${ramp}" by density, max ${mx}/cell;  H = a hunter present)`);
  for (let y = 0; y < MR; y++) {
    let s = "    ";
    for (let x = 0; x < MC; x++) {
      const i = y * MC + x;
      if (hunt[i] > 0) s += "H";
      else { const q = mx > 0 ? mote[i] / mx : 0; s += ramp[Math.min(ramp.length - 1, Math.ceil(q * (ramp.length - 1)))]; }
    }
    line(s);
  }
}

function binCell(x, y) {
  const mx = Math.min(MC - 1, Math.max(0, (x / W * MC) | 0));
  const my = Math.min(MR - 1, Math.max(0, (y / H * MR) | 0));
  return my * MC + mx;
}

// The distribution the mean throws away. For each grazer gene: mean, spread (sd),
// a 24-bin histogram over its clamp range so a split shows as two humps with a
// valley, and a bimodality coefficient (BC > 0.555 hints at a non-unimodal shape).
// Then the morph detector's verdict — which requires a genuine valley, not just BC.
function shapeReport() {
  const pop = world.motes;
  if (!pop.length) { line("    (no grazers alive to read)"); return; }
  const genes = ["speed", "size", "sense", "metabo"];
  const ramp = " .:-=+*#%@";
  line(`    grazer gene distributions (final tick, n=${pop.length})`);
  line("    gene      mean      sd     BC     shape (histogram over the clamp range)");
  for (const k of genes) {
    const vals = pop.map((m) => m.g[k]);
    const n = vals.length;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    let m2 = 0, m3 = 0, m4 = 0;
    for (const x of vals) { const e = x - mean; const e2 = e * e; m2 += e2; m3 += e2 * e; m4 += e2 * e2; }
    m2 /= n; m3 /= n; m4 /= n;
    const sd = Math.sqrt(m2);
    const skew = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
    const kurt = m2 > 0 ? m4 / (m2 * m2) : 0;             // non-excess kurtosis
    const bc = kurt > 0 ? (skew * skew + 1) / kurt : 0;   // Sarle's bimodality coeff
    const [lo, hi] = RANGE.mote[k];
    const B = 24, bins = new Array(B).fill(0);
    for (const x of vals) { let b = ((x - lo) / (hi - lo) * B) | 0; if (b < 0) b = 0; if (b >= B) b = B - 1; bins[b]++; }
    const bmax = Math.max(1, ...bins);
    const spark = bins.map((c) => ramp[Math.min(9, Math.round((c / bmax) * 9))]).join("");
    const flag = bc > 0.555 ? " ⚑" : "  ";
    line(`    ${k.padEnd(7)} ${pad(fmt(mean), 7)} ${pad(fmt(sd), 7)} ${pad(fmt(bc), 6)}${flag} [${spark}]`);
  }
  const mo = classifyMorphs(pop);
  const verdict = mo.k >= 2 && mo.gene
    ? `${mo.k} MORPHS coexisting, split along ${mo.gene} (${mo.n0} vs ${mo.n1}, sep ${fmt(mo.sep)})`
    : "ONE broad cloud — no genuine split";
  line(`    morph detector: ${verdict}`);
  line("    (⚑ = BC>0.555, a hint of non-unimodality; the detector needs a real valley, not just skew)");
}

// The bistability, named and counted. A single unseeded run only visits ONE of the
// two attractors, so this says *which* one (no more decoding hunter counts by hand)
// and how long the readout held each state — a run that flips is the interesting one.
function regimeReport() {
  const r = world.regime;
  const pct = (n) => ((100 * n) / TICKS).toFixed(0);
  line(`    settled in : ${r.label}`);
  line(`    hunters    : mean ${fmt(r.hmean, 1)} over the last ${CONFIG.regimeWindow} history samples`);
  line(`    time in    : arms-race ${pad(pct(regimeTicks["arms-race"]), 3)}%  ·  ` +
       `grazer-haven ${pad(pct(regimeTicks["grazer-haven"]), 3)}%  ·  settling ${pad(pct(regimeTicks.settling), 3)}%`);
  line(`    recovering : ${pad(pct(recoveringTicks), 3)}% of ticks (a predator tier visibly clawing back)`);
  line(`    phase flips: ${regimeFlips} (attractor → attractor over the run)`);
}

process.exit(threw || nanFlags.length ? 1 : 0);

// ---- the predation-divergence experiment ------------------------------------
// Run one world to a settled state and read the grazers' evolved anti-predator
// strategy: mean genes, and the *tactic mix* — what fraction became hiders (high
// hideability: small + slow, vanish into cover) vs fleers (low: fast, outrun in the
// open). hideability is the very axis draw() tints motes by, so this measures exactly
// what a viewer sees. Throws are caught so one sick seed can't abort the whole sweep.
function runOneWorld(ticks) {
  let threw = null;
  try { seed(); for (let t = 0; t < ticks; t++) step(); }
  catch (e) { threw = e; }
  const pop = world.motes, n = pop.length || 1;
  let sp = 0, sz = 0, se = 0, Hs = 0, hid = 0, fle = 0;
  for (const m of pop) {
    sp += m.g.speed; sz += m.g.size; se += m.g.sense;
    const Hh = hideability(m.g); Hs += Hh;
    if (Hh > 0.55) hid++; else if (Hh < 0.20) fle++;
  }
  const cls = classifyMorphs(pop);
  return { threw, n: pop.length, speed: sp / n, size: sz / n, sense: se / n,
           H: Hs / n, hiderPct: (100 * hid) / n, fleerPct: (100 * fle) / n,
           k: cls.k, gene: cls.gene, hunters: world.hunters.length };
}

// The centrepiece proof for Arc III: is the grazers' hider/fleer divergence DRIVEN by
// predation? Compare N worlds with hunters against N with hunters removed entirely (none
// seeded, none allowed to drift back). If predation is the cause, the fast *fleer*
// lifestyle — being built to outrun a predator — should appear ONLY when predators exist,
// and the strategy should vary far more across predator worlds (the arms-race / grazer-
// haven bistability picking different answers) than across the relaxed predator-free ones.
// Unpaired (there is no seeded RNG yet — see the backlog), so read the SPREAD across seeds,
// never a single row.
function splitTest(seeds, ticks) {
  const pz = (s, w) => String(s).padStart(w);
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "NaN");
  const bar = "─".repeat(71);
  console.log("\n" + "═".repeat(71));
  console.log("  TERRARIUM — PREDATION-DIVERGENCE TEST");
  console.log(`  ${seeds} worlds × ${ticks} ticks per condition · unpaired (read the spread, not a row)`);
  console.log("  Q: does predation DRIVE the hider↔fleer split, or would grazers diverge anyway?");
  console.log("═".repeat(71));

  const baseStart = CONFIG.hunterStart, baseReseed = CONFIG.hunterReseedPrey;
  const conditions = [
    { name: "WITH HUNTERS  (the world as shipped)", setup() {} },
    { name: "NO HUNTERS  (predators removed, none reseeded)",
      setup() { CONFIG.hunterStart = 0; CONFIG.hunterReseedPrey = 1e9; } },
  ];
  const summary = {};
  for (const cond of conditions) {
    CONFIG.hunterStart = baseStart; CONFIG.hunterReseedPrey = baseReseed;  // reset to baseline
    cond.setup();
    console.log(`\n  ${cond.name}`);
    console.log("  seed   n   speed  size  sense    H   hider%  fleer%  morphs   hunters");
    const rows = [];
    for (let s = 0; s < seeds; s++) {
      const r = runOneWorld(ticks);
      rows.push(r);
      const morph = r.k >= 2 ? `2·${r.gene || "?"}` : "1";
      console.log(`  ${pz(s + 1, 3)} ${pz(r.n, 5)}  ${pz(f2(r.speed), 5)} ${pz(f2(r.size), 5)} ` +
        `${pz(f2(r.sense), 5)} ${pz(f2(r.H), 5)}  ${pz(r.hiderPct.toFixed(0), 5)}  ${pz(r.fleerPct.toFixed(0), 5)}  ` +
        `${morph.padEnd(6)}  ${pz(r.hunters, 5)}${r.threw ? "  THREW" : ""}`);
    }
    const spd = rows.map((r) => r.speed);
    const mean = (f) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
    summary[cond.name] = {
      rows, spdMin: Math.min(...spd), spdMax: Math.max(...spd),
      meanSpeed: mean((r) => r.speed), meanH: mean((r) => r.H),
      morph2: rows.filter((r) => r.k >= 2).length,
    };
    const su = summary[cond.name];
    console.log(`  → mean speed ${f2(su.meanSpeed)} (range ${f2(su.spdMin)}–${f2(su.spdMax)})  ·  ` +
      `mean hideability ${f2(su.meanH)}  ·  within-world 2-morph ${su.morph2}/${seeds}`);
  }
  CONFIG.hunterStart = baseStart; CONFIG.hunterReseedPrey = baseReseed;  // restore

  const wH = summary[conditions[0].name], nH = summary[conditions[1].name];
  console.log("\n  " + bar);
  console.log("  VERDICT");
  console.log(`   • predation & flee-speed: mean grazer speed ${f2(wH.meanSpeed)} WITH hunters ` +
    `vs ${f2(nH.meanSpeed)} without — ${wH.meanSpeed > nH.meanSpeed + 0.15 ?
      "predators push the herd toward the FLEER end (built to run); remove them and it relaxes to slow, cheap hiders" :
      "no clear speed signal this sweep (short run? add ticks/seeds)"}.`);
  console.log(`   • predation & hiding: mean hideability ${f2(wH.meanH)} WITH vs ${f2(nH.meanH)} without — ` +
    `${nH.meanH > wH.meanH + 0.05 ? "without a predator to outrun, grazers default to the small-slow hider genotype" :
      "similar"}.`);
  console.log(`   • predation & COEXISTENCE (the arc's hypothesis): within-world 2-morph splits ` +
    `${wH.morph2}/${seeds} WITH vs ${nH.morph2}/${seeds} without — ${wH.morph2 > nH.morph2 ?
      "splits need predators (arc supported!)" :
      "predation does NOT drive coexistence; splits appear WITHOUT it (crowding-driven) — the arc's premise stays refuted"}.`);
  console.log("  " + bar + "\n");
}
