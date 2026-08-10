/*
 * Terrarium — headless smoke test (dependency-free, Node only)
 *
 * The file:// preview pane pins a stale snapshot of the JS, so we can't trust an
 * eyeball to catch a broken world. This harness shims just enough DOM + canvas to
 * load the *real* sim.js, drives it for thousands of ticks, and asserts the world
 * never throws, never empties, keeps plants alive, and actually evolves.
 *
 * Run:  node smoke.js
 * Exit: 0 = the world lives; 1 = something is wrong (message printed).
 */

"use strict";

// ---- load the shared headless shim, then the real simulation ----------------
// shim.js installs document/canvas/rAF as globals (see it for the details); it must
// be required before sim.js, which reaches for them at load time. observe.js loads
// the exact same shim, so both harnesses drive byte-identical internals.
require("./shim.js");
const sim = require("./sim.js");
const { world, step, seed, biomass, CONFIG, GRID,
        draw, drawChart, drawCountChart, drawArmsChart, updateHud,
        classifyMorphs, classifyRegime, regimeMood, predationShare } = sim;

// ---- assertions --------------------------------------------------------------
let failures = 0;
function check(cond, msg) {
  if (!cond) { console.error("  ✗ " + msg); failures++; }
  else console.log("  ✓ " + msg);
}
const finite = (x) => typeof x === "number" && Number.isFinite(x);

// ---- run --------------------------------------------------------------------
const TICKS = 7200; // three full seasonal cycles
seed();

const startGenes = world.motes.map((m) => ({ ...m.g }));
let minPop = Infinity, maxPop = 0;
let minBio = Infinity, maxBio = 0;
let minHunt = Infinity, maxHunt = 0;
let hunterExtinctTicks = 0;      // ticks with zero hunters — should be rare
let hunterCapTicks = 0;          // ticks pinned at the cap — a brief touch is fine, a
                                 // long plateau there is the "unchecked runaway" we forbid
let threw = null;

const t0 = Date.now();
try {
  for (let t = 0; t < TICKS; t++) {
    step();
    const p = world.motes.length;
    if (p < minPop) minPop = p;
    if (p > maxPop) maxPop = p;
    const hn = world.hunters.length;
    if (hn < minHunt) minHunt = hn;
    if (hn > maxHunt) maxHunt = hn;
    if (hn === 0) hunterExtinctTicks++;
    if (hn >= CONFIG.hunterMaxPop) hunterCapTicks++;
    const b = biomass();
    if (b < minBio) minBio = b;
    if (b > maxBio) maxBio = b;
    if (t % 1200 === 0 || t === TICKS - 1) {
      console.log(
        `  t=${String(t + 1).padStart(4)}  motes=${String(p).padStart(4)}  ` +
        `hunters=${String(hn).padStart(3)}  biomass=${b.toFixed(0).padStart(4)}  ` +
        `born=${world.born}  died=${world.died}  eaten=${world.eaten}`
      );
    }
  }
} catch (e) {
  threw = e;
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\nran ${TICKS} ticks in ${secs}s over a ${GRID.cols}×${GRID.rows} grid\n`);

// nothing threw
check(!threw, threw ? `sim threw: ${threw && threw.stack}` : "no exception across the whole run");

// the world never empties and never runaway-explodes
check(minPop >= 1, `population never hit zero (min ${minPop})`);
check(maxPop <= CONFIG.maxPop, `population stayed under the cap (max ${maxPop} ≤ ${CONFIG.maxPop})`);

// plants persist and are grazed — a living, spatial food supply
check(minBio > 0, `vegetation never fully died (min biomass ${minBio.toFixed(1)})`);
check(minBio < maxBio * 0.9, `plant biomass genuinely fluctuates (${minBio.toFixed(0)}–${maxBio.toFixed(0)})`);

// the second tier — hunters must actually hunt, breed, and persist as a species
check(world.eaten > 0, `hunters caught motes (${world.eaten} eaten over the run)`);
check(world.hunterBorn > 0, `hunters reproduced from kills (${world.hunterBorn} pups born)`);
check(maxHunt > 0, `a hunter population existed (peak ${maxHunt})`);
check(maxHunt > minHunt, `hunter population oscillated, not flat (${minHunt}–${maxHunt})`);
// (senescence turnover is checked deterministically at the end — a stochastic run can't
//  guarantee a natural aged death, but the mechanism must always be wired and lethal)
check(
  hunterExtinctTicks < TICKS * 0.25,
  `hunters were self-sustaining, rarely extinct (${hunterExtinctTicks}/${TICKS} ticks empty)`
);
// neither tier trivially wins: prey stay well clear of extinction, and predators
// never sit plastered against their cap (a brief founding-boom touch is allowed)
check(minPop >= 10, `predators never nearly wiped the motes out (min motes ${minPop} ≥ 10)`);
check(
  hunterCapTicks < TICKS * 0.15,
  `hunters weren't pinned at the cap (${hunterCapTicks}/${TICKS} ticks at ${CONFIG.hunterMaxPop})`
);

// state actually evolves: population swung, and the gene pool drifted
check(maxPop > minPop, `population varied over time (${minPop}–${maxPop})`);
const endGenes = world.motes.map((m) => m.g);
const avg = (arr, k) => arr.reduce((s, g) => s + g[k], 0) / (arr.length || 1);
const drift = Math.abs(avg(endGenes, "speed") - avg(startGenes, "speed")) +
              Math.abs(avg(endGenes, "sense") - avg(startGenes, "sense"));
check(drift > 0.01, `gene pool drifted from the founders (Δ ${drift.toFixed(3)})`);

// no NaN / Inf leaked into any mote, hunter, or the grid
const cleanCreature = (m) => finite(m.x) && finite(m.y) && finite(m.energy) &&
  finite(m.g.speed) && finite(m.g.size) && finite(m.g.sense);
let clean = world.motes.every(cleanCreature) && world.hunters.every(cleanCreature);
for (let i = 0; i < world.veg.length && clean; i++) if (!finite(world.veg[i]) || world.veg[i] < 0) clean = false;
check(clean, "no NaN/negative values in motes, hunters, or the vegetation grid");

// the view-only grazing-pressure field stays sane and actually records something
let grazeClean = true, gmax = 0;
for (let i = 0; i < world.graze.length; i++) {
  const g = world.graze[i];
  if (!finite(g) || g < 0) grazeClean = false;
  if (g > gmax) gmax = g;
}
check(grazeClean, "grazing-pressure field stayed finite and non-negative");
check(gmax > 0, `grazing pressure was recorded for the overlay (peak ${gmax.toFixed(2)})`);

// history is being recorded for the charts
check(world.history.length > 10, `history buffer filled for the charts (${world.history.length} samples)`);

// the trait chart now tracks BOTH gene pools: every sample carries the hunter gene
// means (finite when hunters exist, null when the tier is empty), so the dashed
// predator curves have data to draw and a collapse leaves a gap, not a false plunge.
{
  let hFinite = 0, hNull = 0, hBad = false;
  for (const s of world.history) {
    if (!("hspeed" in s) || !("hsize" in s) || !("hsense" in s)) { hBad = true; break; }
    const anyNull = s.hspeed === null || s.hsize === null || s.hsense === null;
    if (anyNull) {
      // null is only legal when the whole tier is genuinely empty that sample
      if (!(s.hspeed === null && s.hsize === null && s.hsense === null)) hBad = true;
      hNull++;
    } else {
      if (!finite(s.hspeed) || !finite(s.hsize) || !finite(s.hsense)) hBad = true;
      // within the hunter clamp ranges
      if (s.hspeed < 0.6 || s.hspeed > 3.2 || s.hsense < 24 || s.hsense > 170) hBad = true;
      hFinite++;
    }
  }
  check(!hBad, "hunter gene means recorded for the trait chart (finite in range, all-null only when empty)");
  check(hFinite > 0, `hunter curves have real data to plot (${hFinite} samples with hunters, ${hNull} empty)`);
}

// social axis on the trait chart: every history sample carries a finite, in-range social mean
{
  const SOCIAL_LO = -1.0, SOCIAL_HI = 1.2;
  let sBad = false;
  for (const s of world.history) {
    if (!("social" in s) || !finite(s.social) || s.social < SOCIAL_LO || s.social > SOCIAL_HI)
      sBad = true;
  }
  check(!sBad, `social gene mean recorded in every history sample (in [${SOCIAL_LO}, ${SOCIAL_HI}])`);
}

// metabo axis on the trait chart: every history sample carries a finite, in-range metabo mean
{
  const METABO_LO = 0.60, METABO_HI = 1.80;
  let mBad = false;
  for (const s of world.history) {
    if (!("metabo" in s) || !finite(s.metabo) || s.metabo < METABO_LO || s.metabo > METABO_HI)
      mBad = true;
  }
  check(!mBad, `metabo gene mean recorded in every history sample (in [${METABO_LO}, ${METABO_HI}])`);
}

// kill-site alarm: after a run with predation, the kill log has entries; each entry
// has finite, in-canvas-bounds coords and a valid tick; log never exceeds its cap.
{
  check(world.killLog.length > 0,
    `kill log populated after a run with predation (${world.killLog.length} sites)`);
  check(world.killLog.length <= CONFIG.alarmSites,
    `kill log stays within its cap (${world.killLog.length} ≤ ${CONFIG.alarmSites})`);
  const W = 960, H = 540;
  let kBad = false;
  for (const s of world.killLog) {
    if (!finite(s.x) || !finite(s.y) || !finite(s.tick)) { kBad = true; break; }
    if (s.x < 0 || s.x >= W || s.y < 0 || s.y >= H)     { kBad = true; break; }
    if (s.tick < 0 || s.tick > world.tick)                { kBad = true; break; }
  }
  check(!kBad, "kill log entries have valid, in-bounds coords and ticks");
  // each kill log entry carries the killer's hue — used to tint the alarm glow per-hunter
  const hueBad = world.killLog.filter(s => !finite(s.hue) || s.hue < 0 || s.hue > 45);
  check(hueBad.length === 0,
    `kill log entries carry a valid hunter hue in [0,45] (${hueBad.length} bad of ${world.killLog.length})`);
  // every active site has a freshness strictly in (0,1] — no stale or future sites leaked through
  const stale = world.killLog.filter(s => {
    const age = world.tick - s.tick;
    return age >= CONFIG.alarmDuration || age < 0;
  });
  check(stale.length === 0,
    `kill log has no stale or future-dated sites (${stale.length} bad of ${world.killLog.length})`);
}

// hunter home ranges: every hunter must have a finite, in-bounds kill centroid
{
  let homeBad = null;
  for (const h of world.hunters) {
    if (!finite(h.homeX) || !finite(h.homeY))
      { homeBad = `homeX=${h.homeX} homeY=${h.homeY}`; break; }
  }
  check(!homeBad, homeBad
    ? `hunter home centroid leaked NaN: ${homeBad}`
    : `all ${world.hunters.length} hunter home centroids are finite`);
  let homeBounds = null;
  for (const h of world.hunters) {
    if (h.homeX < 0 || h.homeX >= 960 || h.homeY < 0 || h.homeY >= 540)
      { homeBounds = `homeX=${h.homeX.toFixed(1)} homeY=${h.homeY.toFixed(1)}`; break; }
  }
  check(!homeBounds, homeBounds
    ? `hunter home centroid out of canvas: ${homeBounds}`
    : `all ${world.hunters.length} hunter home centroids are within canvas bounds`);
}

// concealment (Arc III): a mote hides from hunters only when it is small AND slow AND
// standing on dense vegetation — the trade-off that lets predation split the herd into
// hiders and fleers. Test the mechanic deterministically by planting motes on a cell
// whose density we set by hand, so it can't flake on the live world's randomness.
const { concealment, hideability, cellIndex } = sim;
const at = (x, y, g) => ({ x, y, g });
const coverCell = cellIndex(120, 120);
const savedVeg = world.veg[coverCell];
world.veg[coverCell] = 1;                        // lush cover under (120,120)
const hider  = at(120, 120, { speed: 0.6, size: 2.0, sense: 20, metabo: 0.7 });
const middle = at(120, 120, { speed: 1.6, size: 3.4, sense: 45, metabo: 1.0 });
const fleer  = at(120, 120, { speed: 2.4, size: 5.5, sense: 100, metabo: 1.2 });
check(hideability(hider.g) > 0.8, `hideability rates a small, slow genome a hider (${hideability(hider.g).toFixed(2)})`);
check(hideability(fleer.g) < 0.05, `hideability rates a big, fast genome a pure fleer (${hideability(fleer.g).toFixed(2)})`);
check(concealment(hider) > concealment(middle) && concealment(middle) > concealment(fleer),
      `in cover, a hider outhides the middling, which outhides a fleer (${concealment(hider).toFixed(2)} > ${concealment(middle).toFixed(2)} > ${concealment(fleer).toFixed(2)})`);
world.veg[coverCell] = 0;                         // bare ground: nobody hides
check(concealment(hider) === 0, `on bare ground even a perfect hider has zero cover (${concealment(hider)})`);
world.veg[coverCell] = savedVeg;                  // restore so nothing downstream is perturbed

// sociability (Arc III): the SIGNED `social` gene bends a mote's steering toward the
// local crowd (>0) or away from it (<0, wary). Prove the sign semantics deterministically:
// plant three neighbours to one side, then read senseFlock's steer for a wary vs a sociable
// focal genome — it must point away from the crowd for one and toward it for the other.
const { rebuildFlock, senseFlock } = sim;
const savedMotes = world.motes;
world.motes = [                                   // a little crowd 15px to the +x side of (100,100)
  { x: 115, y: 100, g: { social: 0 } },
  { x: 115, y: 110, g: { social: 0 } },
  { x: 115, y: 90,  g: { social: 0 } },
];
rebuildFlock();
const waryS = senseFlock({ x: 100, y: 100, g: { social: -0.8 } });
const warySx = waryS.sx, waryCrowd = waryS.crowd;
const socS = senseFlock({ x: 100, y: 100, g: { social: 0.8 } });
const socSx = socS.sx;
world.motes = savedMotes;                          // restore before anything downstream reads it
check(waryCrowd === 3, `the neighbour query counts the local crowd (${waryCrowd} of 3)`);
check(warySx < 0 && socSx > 0,
      `a wary genome steers AWAY from the crowd and a sociable one TOWARD it (${warySx.toFixed(2)} vs +${socSx.toFixed(2)})`);
// and the live world's `social` stays a finite, in-range, non-degenerate axis after the run
let socMin = Infinity, socMax = -Infinity, socSum = 0, socBad = false;
for (const m of world.motes) {
  const s = m.g.social;
  if (!(typeof s === "number" && Number.isFinite(s)) || s < -1.0 || s > 1.2) socBad = true;
  if (s < socMin) socMin = s; if (s > socMax) socMax = s; socSum += s;
}
check(!socBad, "every mote's social gene stayed finite and inside its [-1, 1.2] clamp");
check(world.motes.length === 0 || socMax > socMin,
      `the social gene carries real variance to select on (${socMin.toFixed(2)}..${socMax.toFixed(2)})`);

// the metabolism tradeoff: a fast-burner digests each bite more thoroughly (higher
// intake multiplier) while paying a linearly higher always-on burn, so metabolism finds
// a food-dependent interior optimum instead of sliding to its floor. Assert the intake
// gain's SHAPE deterministically — it decides whether the axis is live or dead, and must
// be (a) neutral at metabo=1 so the tuned economy is preserved, (b) monotone increasing,
// and (c) concave (diminishing returns), which is what balances the linear cost interior.
const { metaboIntakeMult } = sim;
check(Math.abs(metaboIntakeMult(1) - 1) < 1e-9,
      `metabolism intake is neutral at metabo=1 (${metaboIntakeMult(1).toFixed(4)})`);
check(metaboIntakeMult(0.6) < metaboIntakeMult(1) && metaboIntakeMult(1) < metaboIntakeMult(1.8),
      `metabolism intake rises with metabo (${metaboIntakeMult(0.6).toFixed(2)} < ${metaboIntakeMult(1).toFixed(2)} < ${metaboIntakeMult(1.8).toFixed(2)})`);
check((metaboIntakeMult(1.0) - metaboIntakeMult(0.6)) > (metaboIntakeMult(1.8) - metaboIntakeMult(1.4)),
      `metabolism intake is concave — diminishing returns (the interior-optimum guarantee)`);

// the PREDATOR side of the same tradeoff (huntMetaboMult scales the assimilated share of a
// kill): a fast-burning hunter digests prey more thoroughly while paying a linearly higher
// burn, so the hunter metabo gene gets its own interior optimum instead of decaying to floor
// as the pure cost it used to be. Same shape guarantees as the grazer gain: (a) neutral at
// metabo=1 so the tuned pyramid at the ~1.0 operating point is preserved, (b) monotone
// increasing (the selection gradient points toward greedy where kills are plentiful), and
// (c) concave, so the linear burn balances it at an interior point rather than the ceiling.
const { huntMetaboMult } = sim;
check(Math.abs(huntMetaboMult(1) - 1) < 1e-9,
      `hunter kill-digestion is neutral at metabo=1 (${huntMetaboMult(1).toFixed(4)})`);
check(huntMetaboMult(0.55) < huntMetaboMult(1) && huntMetaboMult(1) < huntMetaboMult(1.8),
      `hunter kill-digestion rises with metabo (${huntMetaboMult(0.55).toFixed(2)} < ${huntMetaboMult(1).toFixed(2)} < ${huntMetaboMult(1.8).toFixed(2)})`);
check((huntMetaboMult(1.0) - huntMetaboMult(0.55)) > (huntMetaboMult(1.8) - huntMetaboMult(1.35)),
      `hunter kill-digestion is concave — diminishing returns (the interior-optimum guarantee)`);
check(huntMetaboMult(0.55) > 0,
      `hunter kill-digestion stays positive across the clamp range (no negative income)`);

// the SPRINT DRAG: the superlinear cost that finally gives speed an interior optimum
// instead of the 2.60-clamp pin it used to slam. Assert its shape deterministically — it
// must be (a) exactly zero at/below the threshold so normal grazers pay nothing new and
// the tuned low-mid economy is byte-preserved, (b) non-negative everywhere, (c) monotone
// increasing above the threshold, and (d) CONVEX (accelerating) — a linear cost could never
// out-climb the linearly-rewarded speed gene, so only an accelerating one bends the arms
// race back to an interior point. This shape is the whole reason the fix works.
const { sprintDrag } = sim;
const df = CONFIG.speedDragFrom;
check(sprintDrag(df) === 0 && sprintDrag(df - 0.3) === 0 && sprintDrag(0.5) === 0,
      `sprint drag is exactly zero at/below the threshold (speed ≤ ${df} pays nothing new)`);
check(sprintDrag(df + 0.2) > 0 && sprintDrag(2.6) > 0,
      `sprint drag is positive above the threshold (a fast build costs extra)`);
check(sprintDrag(df + 0.2) < sprintDrag(df + 0.4) && sprintDrag(df + 0.4) < sprintDrag(df + 0.6),
      `sprint drag rises monotonically with speed above the threshold`);
check((sprintDrag(df + 0.6) - sprintDrag(df + 0.4)) > (sprintDrag(df + 0.4) - sprintDrag(df + 0.2)),
      `sprint drag is convex — each extra notch of top speed costs more than the last (the interior-optimum guarantee)`);

// the death-balance chart's metric must be HONEST — it counts the actual deaths, so
// an all-predation window reads 1, an all-starvation window reads 0, a 50/50 window
// reads 0.5, an empty window reads null (band breaks, never lies), and it pools ONLY
// the trailing `win` samples. Deterministic synthetic history, so it can't flake.
const shHist = [
  { de: 9, dd: 1 }, { de: 8, dd: 2 },     // (older samples, must be ignored by a win=3 pool)
  { de: 0, dd: 5 }, { de: 0, dd: 3 }, { de: 0, dd: 2 },  // last 3: pure starvation
];
check(predationShare([{ de: 4, dd: 0 }], 0, 10) === 1,
      `predation share reads 1 when only hunters kill`);
check(predationShare([{ de: 0, dd: 4 }], 0, 10) === 0,
      `predation share reads 0 when only hunger kills`);
check(predationShare([{ de: 3, dd: 3 }], 0, 10) === 0.5,
      `predation share reads 0.5 on an even split`);
check(predationShare([{ de: 0, dd: 0 }], 0, 10) === null,
      `predation share is null when nothing died (the band breaks, not lies)`);
check(predationShare(shHist, shHist.length - 1, 3) === 0,
      `predation share pools only the trailing window (older predation-heavy samples ignored)`);
check(Math.abs(predationShare([{ de: 6, dd: 2 }, { de: 2, dd: 0 }], 1, 10) - 0.8) < 1e-9,
      `predation share pools counts across the window (8 predation / 10 total = 0.8)`);

// the morph detector must be HONEST: one broad cloud reads as one morph (a naive
// 2-means would always split), a genuinely two-cluster pool reads as two. Test both
// with deterministic synthetic pools so this check never flakes on real randomness.
let _s = 987654321;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const jit = (c, w) => c + (rnd() - 0.5) * w;
const uniPool = [];
for (let i = 0; i < 300; i++) uniPool.push({ g: { speed: jit(1.3, 0.4), size: jit(3.2, 0.8), sense: jit(45, 16), metabo: jit(1.0, 0.2), social: jit(0.0, 0.3) } });
const biPool = [];
for (let i = 0; i < 150; i++) biPool.push({ g: { speed: jit(0.6, 0.1), size: jit(2.1, 0.2), sense: jit(22, 5), metabo: jit(0.7, 0.06), social: jit(-0.4, 0.1) } });
for (let i = 0; i < 150; i++) biPool.push({ g: { speed: jit(2.3, 0.1), size: jit(5.0, 0.2), sense: jit(105, 5), metabo: jit(1.5, 0.06), social: jit(0.5, 0.1) } });
const cUni = classifyMorphs(uniPool);
const cBi = classifyMorphs(biPool);
check(cUni.k === 1, `morph detector calls a single broad cloud ONE morph (k=${cUni.k})`);
check(cBi.k === 2, `morph detector splits a clean two-cluster pool into TWO (k=${cBi.k}${cBi.gene ? " along " + cBi.gene : ""})`);
const cLive = classifyMorphs(world.motes);
check(cLive.k === 1 || cLive.k === 2, `morph detector returns a sane verdict on the live pool (k=${cLive.k})`);
check(world.morphs && world.morphs.k >= 1, `live morph readout is populated for the HUD (k=${world.morphs && world.morphs.k})`);

// the regime readout names the phase of the world's predator–prey CYCLE, judged by the
// recent hunter mean RELATIVE to the world's own long baseline — DETRENDED (2026-07-28): the
// baseline is a fitted slope projected forward, so surge/ebb mean "above/below where this
// world's own trend predicts", not "above/below its trailing mean". Deterministic synthetic
// history windows (~200 samples so the recent and baseline windows genuinely differ) prove
// each phase; each sample only needs a `hunters` count, so this can't flake on randomness.
const hist = (n, fn) => Array.from({ length: n }, (_, i) => ({ hunters: fn(i) }));
const rSteady = classifyRegime(hist(200, () => 70), "steady");
const rSurge = classifyRegime(hist(200, (i) => (i < 176 ? 55 : 90)), "steady");   // recent 90 vs base ~59
const rEbb = classifyRegime(hist(200, (i) => (i < 176 ? 75 : 45)), "steady");     // recent 45 vs base ~71
const rCollapse = classifyRegime(hist(200, () => 8), "surge");                     // base 8 < floor 16
const rRecover = classifyRegime(hist(200, (i) => (i < 176 ? 5 : 8 + (i - 175) * 0.25)), "collapsed"); // dead tier, recent creeping up but still sub-floor
const rWeak = classifyRegime(hist(200, () => 20), "steady");                       // 20 > floor: alive, not collapsed
check(rSteady.state === "steady", `regime reads a level tier "steady" (recent ${rSteady.hmean.toFixed(0)} ≈ base ${rSteady.base.toFixed(0)})`);
check(rSurge.state === "surge", `regime reads predation above its baseline as "surge" (recent ${rSurge.hmean.toFixed(0)} vs base ${rSurge.base.toFixed(0)})`);
check(rEbb.state === "ebb", `regime reads predation below its baseline as "ebb" (recent ${rEbb.hmean.toFixed(0)} vs base ${rEbb.base.toFixed(0)})`);
check(rCollapse.state === "collapsed", `regime names a genuinely failed predator tier "collapsed" (base ${rCollapse.base.toFixed(1)})`);
check(rRecover.state === "collapsed" && rRecover.trend === "rising", `regime flags a collapsed tier clawing back (state=${rRecover.state}, trend=${rRecover.trend})`);
check(rWeak.state !== "collapsed", `the collapse floor discriminates a thin-but-alive tier (base ${rWeak.base.toFixed(0)}) from a genuine collapse → ${rWeak.state}`);
// hysteresis: a recent level just inside the on-band (above the PROJECTED baseline) HOLDS a
// prior surge but does NOT by itself pull a steady world into one — the Schmitt gap in action.
// (Recent stepped to 78 over a flat 70 baseline: the detrend absorbs part of the step, so this
// lands mid-band ~0.057, comfortably between regimeSurgeOff 0.035 and regimeSurgeOn 0.09.)
const near = hist(200, (i) => (i < 176 ? 70 : 78));
check(classifyRegime(near, "surge").state === "surge" && classifyRegime(near, "steady").state === "steady",
      "regime hysteresis holds a prior surge in the ambiguous band but won't trigger one from steady");
// THE DETREND, proven: a tier climbing on a steady secular ramp (no boom-bust) must read
// "steady", NOT "surge" — even though its recent mean sits far above its trailing MEAN (which
// is exactly what the old readout mistook for a perpetual surge through every world's ramp).
const rRamp = classifyRegime(hist(200, (i) => 30 + i * 0.3), "steady");
check(rRamp.state === "steady" && rRamp.hmean > rRamp.base * 1.2,
      `detrend: a pure climbing ramp reads "steady" though recent ${rRamp.hmean.toFixed(0)} ≫ trailing-mean ${rRamp.base.toFixed(0)} (old readout would say surge) → ${rRamp.state}`);
check(rRamp.building > 0, `detrend: a climbing ramp is annotated "building" (secular +${(100 * rRamp.secular).toFixed(0)}%/window)`);
const rDrop = classifyRegime(hist(200, (i) => 90 - i * 0.3), "steady");
check(rDrop.state === "steady" && rDrop.building < 0,
      `detrend: a steadily receding tier reads "steady/thinning", not "ebb" (secular ${(100 * rDrop.secular).toFixed(0)}%/window) → ${rDrop.state}`);
// but the detrend must NOT go blind to a genuine departure: a spike ABOVE the ramp still surges.
const rRampSpike = classifyRegime(hist(200, (i) => (30 + i * 0.3) + (i >= 176 ? 22 : 0)), "steady");
check(rRampSpike.state === "surge",
      `detrend still catches a real departure: a spike above the climbing trend reads "surge" → ${rRampSpike.state}`);
check(classifyRegime([{ hunters: 5 }], "settling").state === "settling", "regime reads 'settling' until it has enough history");
const knownRegime = ["settling", "surge", "steady", "ebb", "collapsed"].includes(world.regime.state);
check(knownRegime && typeof world.regime.label === "string" && world.regime.label.length > 0,
      `live regime readout is populated for the HUD (${world.regime.state})`);

// the regime "mood" tint must lean the right way so the meadow's light BREATHES with the
// cycle: surging is warm (+), ebbing cool (−), collapsed coldest (−1), steady/settling
// neutral (0), and a softening trend (a surge cresting, a collapse recovering) relaxes
// the target toward neutral yet keeps its sign. Pure function, so it can't flake.
const mSurge = regimeMood({ state: "surge", trend: "steady" });
const mEbb = regimeMood({ state: "ebb", trend: "steady" });
const mColl = regimeMood({ state: "collapsed", trend: "steady" });
check(mSurge === 1 && mEbb < 0 && mColl === -1 && regimeMood({ state: "steady" }) === 0 && regimeMood(null) === 0,
      `regime mood signs the cycle right (surge ${mSurge}, ebb ${mEbb}, collapsed ${mColl}, steady 0)`);
check(regimeMood({ state: "surge", trend: "falling" }) === 0.45 &&
      regimeMood({ state: "collapsed", trend: "rising" }) === -0.4 &&
      regimeMood({ state: "surge", trend: "falling" }) > 0 && regimeMood({ state: "collapsed", trend: "rising" }) < 0,
      "a softening trend relaxes the mood toward neutral (a cresting surge, a recovering collapse) yet keeps its sign");
// and the eased tint must actually converge toward its target across frames — this also
// drives the leaned background + vignette through the shimmed gradient stub, so a throw
// in the new draw path fails here, not just silently in a browser.
world.mood = 0; world.regime = { state: "surge", trend: "steady", base: 70, flash: 0, flashText: "", flashWarm: true, label: "x" };
for (let i = 0; i < 500; i++) draw();
const moodWarm = world.mood;
world.regime.state = "collapsed";
for (let i = 0; i < 500; i++) draw();
check(moodWarm > 0.6 && world.mood < -0.6,
      `mood eases toward the live cycle phase (surge → ${moodWarm.toFixed(2)}, then collapsed → ${world.mood.toFixed(2)})`);

// the render path (unexercised by step()) doesn't throw — including every overlay
// mode (off / fertility / grazing) against the shimmed canvas
let renderThrew = null;
try {
  // one death mark of EACH cause — predation, starvation, senescence, AND the new soil
  // bloom — so all four render branches run; soil blooms are drawn first (under marks)
  world.sparks.push({ x: 100, y: 100, life: 0.5, fade: 0.045 });           // predation
  world.sparks.push({ x: 120, y: 120, life: 0.6, kind: "starved", r: 3, fade: 0.018 }); // hunger
  world.sparks.push({ x: 140, y: 140, life: 0.7, kind: "aged", r: 6, fade: 0.025 });    // senescence
  world.sparks.push({ x: 160, y: 160, life: 0.8, kind: "soil", r: 4, fade: 0.010 });    // soil bloom
  for (const ov of [0, 1, 2]) { world.overlay = ov; draw(); }
  world.overlay = 0;
  drawChart(); drawCountChart(); drawArmsChart(); updateHud();
} catch (e) { renderThrew = e; }
check(!renderThrew, renderThrew ? `render threw: ${renderThrew && renderThrew.stack}` : "draw (all overlays + all 4 spark kinds incl. soil bloom) / charts / hud render without throwing");
// per-cause spark fade rates: a soil bloom (CONFIG.sparkFadeSoil) decays slower than a
// kill-flash (CONFIG.sparkFade), which decays slower than nothing new. The decay uses
// s.fade ?? CONFIG.sparkFade so an old-style spark (no fade field) still works.
{
  const lifetimePred    = 1 / CONFIG.sparkFade;        // ~22 ticks
  const lifetimeSoil    = 1 / CONFIG.sparkFadeSoil;    // ~100 ticks
  const lifetimeStarved = 1 / CONFIG.sparkFadeStarved; // ~55 ticks
  check(lifetimeSoil > lifetimePred * 3,
        `soil bloom lifetime (${lifetimeSoil.toFixed(0)}t) is at least 3× kill-flash lifetime (${lifetimePred.toFixed(0)}t)`);
  check(lifetimeStarved > lifetimePred && lifetimeStarved < lifetimeSoil,
        `starvation mark lifetime (${lifetimeStarved.toFixed(0)}t) lies between kill-flash and soil bloom`);
}
// the HUD gained an `aged` chip so hunter senescence (the tier turning over) is counted,
// not just marked. The shim invents a stub for any id, so presence proves nothing —
// assert sim.js actually WROTE world.hunterAged into it on the updateHud() just above.
check(String(document.getElementById("s-aged").textContent) === String(world.hunterAged),
      `HUD 'aged' chip carries the hunter old-age toll (${document.getElementById("s-aged").textContent} == ${world.hunterAged})`);

// the HUD gained a 'herd' chip: the live mean sociability, WORDED (wary / neutral /
// sociable) and signed, so a browser visitor reads the wary↔sociable axis at a glance the
// way they read the regime — the last Expedition's headline gene, previously legible only
// headlessly. The shim invents a stub for any id, so presence proves nothing — drive all
// three worded branches (and the empty-herd "—") through the REAL updateHud and read the
// chip back, proving sim writes the correct word AND number, not just that an element exists.
{
  const herdEl = document.getElementById("s-herd");
  const realMotes = world.motes;
  const synth = (soc, n) => Array.from({ length: n }, () => ({ g: { social: soc } }));
  const cases = [
    { motes: synth(-0.50, 10), want: "wary −0.50" },     // ≤ −0.15 → wary, unicode-minus number
    { motes: synth(0.00, 10),  want: "neutral +0.00" },        // in the neutral band
    { motes: synth(0.50, 10),  want: "sociable +0.50" },       // ≥ +0.15 → sociable
    { motes: [],               want: "—" },               // no grazers → em-dash
  ];
  let herdBad = null;
  for (const c of cases) {
    world.motes = c.motes;
    updateHud();
    if (String(herdEl.textContent) !== c.want) herdBad = `got "${herdEl.textContent}", want "${c.want}"`;
  }
  world.motes = realMotes;
  updateHud();
  check(!herdBad, herdBad ? `HUD 'herd' chip wrong: ${herdBad}`
    : "HUD 'herd' chip words the mean sociability correctly (wary / neutral / sociable / — signed)");
}

// senescence must stay LIVE and lethal to the ancient — the fix for the hunter
// gerontocracy. A single stochastic run can't guarantee a natural old-age death (a hard
// collapse can starve every hunter before its prime ends), so prove the mechanism
// deterministically: drop in one well-fed hunter so old its per-tick hazard exceeds 1,
// step once, and confirm the old-age toll ticks up. Guards against a future edit quietly
// re-freezing the predator pool by disabling turnover.
const agedBefore = world.hunterAged;
world.hunters.push({
  x: 480, y: 270, dir: 0, energy: 200, cool: 0,
  age: CONFIG.hunterSenesceOnset + 10_000_000,   // hazard = rate·Δage ≫ 1 → certain death
  homeX: 480, homeY: 270,
  g: { speed: 1.5, size: 4, sense: 70, metabo: 1, hue: 20 },
});
step();
check(world.hunterAged > agedBefore,
      `senescence is live — an ancient hunter died of old age on cue (aged toll ${agedBefore}→${world.hunterAged})`);

// the sustained near-extinction net: the 0→6 reseed fires only at exact 0, but the
// world can sit at 1–10 motes for hundreds of ticks as hunters eat every reseed.
// After moteNearExtinctTicks consecutive ticks ≤ moteNearExtinctFloor a cohort is added.
// Prove the mechanism deterministically: prime the counter to one tick below the trigger,
// ensure pop ≤ floor, call step() — the net must fire and nearExtinctEvents must tick up.
{
  const savedMotes   = world.motes;
  const savedLowTick = world.lowPopTicks;
  const savedEvents  = world.nearExtinctEvents;
  world.motes = [];  // will hit 0 → 0→6 net fires first, then near-extinction check sees pop=6 ≤ floor
  world.lowPopTicks = CONFIG.moteNearExtinctTicks - 1;  // one tick below the trigger
  const evBefore = world.nearExtinctEvents;
  step();
  const fired = world.nearExtinctEvents > evBefore;
  world.motes = savedMotes;
  world.lowPopTicks = savedLowTick;
  world.nearExtinctEvents = savedEvents;
  check(fired, `near-extinction net fires after ${CONFIG.moteNearExtinctTicks} consecutive ticks ≤ ${CONFIG.moteNearExtinctFloor} (nearExtinctEvents ticked up)`);
  check(finite(world.nearExtinctEvents) && world.nearExtinctEvents >= 0,
        `world.nearExtinctEvents is a non-negative finite count (${world.nearExtinctEvents})`);
}

// ---- the rasterizer (render.js) — the instrument that ended the pixel-blindness ----
// It must keep working: a future edit that breaks colour parsing, a primitive, or the
// PNG container would blind every later run again. Test the primitives draw() actually
// uses on real pixels, then drive the real draw() to a PNG end-to-end in a subprocess.
const { RasterCtx, encodePNG, parseColor } = require("./render.js");

// parseColor — the four CSS forms draw() emits on the world canvas
const pcHex = parseColor("#ff8a6b");
check(pcHex[0] === 255 && pcHex[1] === 138 && pcHex[2] === 107 && pcHex[3] === 1,
      "render: parseColor reads #rrggbb");
const pcRgba = parseColor("rgba(10, 20, 30, 0.5)");
check(pcRgba[0] === 10 && pcRgba[2] === 30 && pcRgba[3] === 0.5,
      "render: parseColor reads rgba() with alpha");
const pcHsl = parseColor("hsl(120 100% 50%)");       // pure green
check(pcHsl[0] === 0 && pcHsl[1] === 255 && pcHsl[2] === 0,
      "render: parseColor reads hsl() → rgb");
const pcHslA = parseColor("hsl(0 100% 50% / 0.4)");  // red at 40% alpha (mote-ring form)
check(pcHslA[0] === 255 && pcHslA[1] === 0 && Math.abs(pcHslA[3] - 0.4) < 1e-9,
      "render: parseColor reads hsl(... / a)");

// RasterCtx paints the exact primitives draw() uses, onto real pixels
const rc = new RasterCtx(40, 30);
const px = (x, y, k) => rc.buf[(y * rc.width + x) * 3 + k];
rc.fillStyle = "rgb(20, 40, 60)"; rc.fillRect(0, 0, 40, 30);
check(px(5, 5, 0) === 20 && px(5, 5, 2) === 60, "render: fillRect lays a solid background");
rc.fillStyle = "hsl(0 100% 50%)";                     // an opaque red disc, like a mote body
rc.beginPath(); rc.arc(20, 15, 6, 0, Math.PI * 2); rc.fill();
check(px(20, 15, 0) === 255 && px(20, 15, 1) === 0, "render: arc+fill paints a filled disc");
check(px(0, 0, 0) === 20, "render: the disc doesn't bleed to the far corner");
let rThrew = null;
try {                                                 // a translucent ring, like a lifestyle halo
  rc.strokeStyle = "hsl(120 80% 58% / 0.6)"; rc.lineWidth = 2;
  rc.beginPath(); rc.arc(20, 15, 10, 0, Math.PI * 2); rc.stroke();
} catch (e) { rThrew = e; }
check(!rThrew, "render: stroke paints a ring without throwing");
let xThrew = null;
try {                                                 // the transformed hunter-arrowhead path
  rc.save(); rc.translate(20, 15); rc.rotate(0.6);
  rc.beginPath(); rc.moveTo(6, 0); rc.lineTo(-4, 3); rc.lineTo(-4, -3); rc.closePath();
  rc.fillStyle = "hsl(20 90% 55%)"; rc.fill(); rc.restore();
} catch (e) { xThrew = e; }
check(!xThrew, "render: save/translate/rotate + polygon fill (a hunter) doesn't throw");

// encodePNG — a structurally valid PNG container
const png = encodePNG(rc.width, rc.height, rc.buf);
check(Buffer.isBuffer(png) && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4E &&
      png[3] === 0x47 && png.length > rc.width * rc.height * 3,
      "render: encodePNG emits a PNG with the right signature");

// end-to-end: the REAL draw() renders through the rasterizer to a PNG on disk
const cp = require("child_process"), os = require("os"), pathmod = require("path"), fsmod = require("fs");
const tmpPng = pathmod.join(os.tmpdir(), `terrarium-smoke-frame-${process.pid}.png`);
let frameOK = false;
try {
  cp.execFileSync(process.execPath, ["observe.js", "--frame", tmpPng, "200"], { stdio: "ignore" });
  const head = fsmod.readFileSync(tmpPng);
  frameOK = head.length > 8 && head[0] === 0x89 && head[1] === 0x50;
  fsmod.unlinkSync(tmpPng);
} catch (e) { frameOK = false; }
check(frameOK, "render: `observe.js --frame` drives the real draw() to a PNG end-to-end");

// ---- reproducibility: a named world regrows exactly --------------------------
// The point of the seeded RNG (2026-07-23) is that `seed(N)` rewinds the world's
// randomness, so the same number always grows the same world. If that ever drifts,
// every census table, every paired split-test and every shared URL quietly becomes a
// lie — so it is asserted by construction rather than hoped for. Runs last, because
// it deliberately rebuilds the world several times.
function worldFingerprint() {
  let g = 0;
  for (const m of world.motes) g += m.g.speed + m.g.size * 3 + m.g.sense * 7 + m.g.metabo * 11 + m.x + m.y * 2;
  for (const h of world.hunters) g += h.g.speed * 13 + h.g.sense * 17 + h.x + h.y * 2;
  let v = 0;
  for (let i = 0; i < world.veg.length; i++) v += world.veg[i] * (1 + (i % 7));
  return [world.motes.length, world.hunters.length, world.born, world.died, world.eaten,
          Math.round(g * 1e6), Math.round(v * 1e6)].join("|");
}
const DTICKS = 900;   // long enough for grazing, breeding, hunting and deaths to bite
seed(20260723); for (let t = 0; t < DTICKS; t++) step();
const fpA = worldFingerprint();
check(world.seedValue === 20260723, "a seeded world reports its own name (world.seedValue)");
seed(20260723); for (let t = 0; t < DTICKS; t++) step();
check(worldFingerprint() === fpA,
      "reproducible: the same seed regrows a byte-identical world after 900 ticks");
seed(20260724); for (let t = 0; t < DTICKS; t++) step();
check(worldFingerprint() !== fpA,
      "the seed is actually used: a neighbouring seed grows a different world");
seed(null);
check(world.seedValue === null, "seed(null) hands the world back to free randomness");
seed(); for (let t = 0; t < 120; t++) step();
const u1 = worldFingerprint();
seed(); for (let t = 0; t < 120; t++) step();
check(worldFingerprint() !== u1,
      "unseeded, two fresh worlds differ — Math.random is genuinely back in charge");

// The HUD chip that shows a world its own name.
seed(4242);
updateHud();
check(document.getElementById("s-seed").textContent === "4242",
      "the HUD names the world (`s-seed` chip carries the seed)");

// The browser boot path — a world's name travels in the URL hash. This can't run in
// this process (sim.js read `location` once, at load), and the file:// preview pane
// drops the fragment when it opens a page, so it's proved the same way the rasterizer
// is: a subprocess that installs a fake `location` *before* requiring the sim.
{
  const boot = (hash, expr) => {
    try {
      return cp.execFileSync(process.execPath, ["-e",
        `global.location={hash:${JSON.stringify(hash)}};require('./shim.js');` +
        `const s=require('./sim.js');process.stdout.write(String(${expr}));`],
        { cwd: __dirname }).toString();
    } catch (e) { return "THREW"; }
  };
  check(boot("#s=777", "s.world.seedValue") === "777",
        "a shared link replays its world — `#s=777` boots the world seeded 777");
  const minted = boot("", "s.world.seedValue + '|' + location.hash");
  const [sv, hash] = minted.split("|");
  check(/^\d+$/.test(sv) && hash === "s=" + sv,
        "a first visit mints a world and publishes its name into the URL hash");
}

// ---- verdict ----------------------------------------------------------------
if (failures) {
  console.error(`\nSMOKE TEST FAILED — ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nSMOKE TEST PASSED — the world lives.");
