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
        draw, drawChart, drawCountChart, updateHud, classifyMorphs, classifyRegime } = sim;

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

// the morph detector must be HONEST: one broad cloud reads as one morph (a naive
// 2-means would always split), a genuinely two-cluster pool reads as two. Test both
// with deterministic synthetic pools so this check never flakes on real randomness.
let _s = 987654321;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const jit = (c, w) => c + (rnd() - 0.5) * w;
const uniPool = [];
for (let i = 0; i < 300; i++) uniPool.push({ g: { speed: jit(1.3, 0.4), size: jit(3.2, 0.8), sense: jit(45, 16), metabo: jit(1.0, 0.2) } });
const biPool = [];
for (let i = 0; i < 150; i++) biPool.push({ g: { speed: jit(0.6, 0.1), size: jit(2.1, 0.2), sense: jit(22, 5), metabo: jit(0.7, 0.06) } });
for (let i = 0; i < 150; i++) biPool.push({ g: { speed: jit(2.3, 0.1), size: jit(5.0, 0.2), sense: jit(105, 5), metabo: jit(1.5, 0.06) } });
const cUni = classifyMorphs(uniPool);
const cBi = classifyMorphs(biPool);
check(cUni.k === 1, `morph detector calls a single broad cloud ONE morph (k=${cUni.k})`);
check(cBi.k === 2, `morph detector splits a clean two-cluster pool into TWO (k=${cBi.k}${cBi.gene ? " along " + cBi.gene : ""})`);
const cLive = classifyMorphs(world.motes);
check(cLive.k === 1 || cLive.k === 2, `morph detector returns a sane verdict on the live pool (k=${cLive.k})`);
check(world.morphs && world.morphs.k >= 1, `live morph readout is populated for the HUD (k=${world.morphs && world.morphs.k})`);

// the regime readout must name the right attractor on deterministic synthetic history
// windows (each sample only needs a `hunters` count), and its hysteresis must hold the
// prior state in the ambiguous middle band. Synthetic so this can't flake on randomness.
const hist = (fn) => Array.from({ length: 24 }, (_, i) => ({ hunters: fn(i) }));
const rCollapse = classifyRegime(hist(() => 7), "grazer-haven");
const rArms = classifyRegime(hist(() => 45), "grazer-haven");
const rRecover = classifyRegime(hist((i) => 6 + i * 0.6), "grazer-haven");
const rDecline = classifyRegime(hist((i) => 55 - i * 1.3), "arms-race");
const midHist = hist(() => 17);
check(rCollapse.state === "grazer-haven", `regime names a starved predator tier "grazer-haven" (hmean ${rCollapse.hmean.toFixed(1)})`);
check(rArms.state === "arms-race", `regime names a dense predator tier "arms-race" (hmean ${rArms.hmean.toFixed(1)})`);
check(rRecover.state === "grazer-haven" && rRecover.trend === "recovering", `regime flags a climbing tier as recovering (state=${rRecover.state}, trend=${rRecover.trend})`);
check(rDecline.state === "arms-race" && rDecline.trend === "declining", `regime flags a sliding tier as declining (state=${rDecline.state}, trend=${rDecline.trend})`);
check(classifyRegime(midHist, "arms-race").state === "arms-race" &&
      classifyRegime(midHist, "grazer-haven").state === "grazer-haven",
      "regime hysteresis holds the prior attractor in the ambiguous middle band");
check(classifyRegime([{ hunters: 5 }], "settling").state === "settling", "regime reads 'settling' until it has enough history");
const knownRegime = ["settling", "arms-race", "grazer-haven"].includes(world.regime.state);
check(knownRegime && typeof world.regime.label === "string" && world.regime.label.length > 0,
      `live regime readout is populated for the HUD (${world.regime.state})`);

// the render path (unexercised by step()) doesn't throw — including every overlay
// mode (off / fertility / grazing) against the shimmed canvas
let renderThrew = null;
try {
  world.sparks.push({ x: 100, y: 100, life: 0.5 }); // ensure the kill-flash branch runs
  for (const ov of [0, 1, 2]) { world.overlay = ov; draw(); }
  world.overlay = 0;
  drawChart(); drawCountChart(); updateHud();
} catch (e) { renderThrew = e; }
check(!renderThrew, renderThrew ? `render threw: ${renderThrew && renderThrew.stack}` : "draw (all overlays) / charts / hud render without throwing");

// ---- verdict ----------------------------------------------------------------
if (failures) {
  console.error(`\nSMOKE TEST FAILED — ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nSMOKE TEST PASSED — the world lives.");
