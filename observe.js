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
const { world, step, seed, biomass, CONFIG, GRID } = sim;

const TICKS = Math.max(1000, parseInt(process.argv[2], 10) || 20000);
const W = 960, H = 540;

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

process.exit(threw || nanFlags.length ? 1 : 0);
