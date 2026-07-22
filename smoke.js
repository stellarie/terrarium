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

// ---- a tiny DOM + canvas shim ------------------------------------------------
// Every 2d-context method is a no-op; measureText returns a zero width. Canvases
// carry the real pixel dimensions sim.js reads. getElementById invents elements
// on demand (buttons, HUD spans, the speed input) with harmless stubs.
const noopCtx = new Proxy({}, {
  get(_t, prop) {
    if (prop === "measureText") return () => ({ width: 0 });
    return () => {};
  },
  set() { return true; },
});

const canvases = {
  world: { width: 960, height: 540 },
  chart: { width: 960, height: 140 },
  chart2: { width: 960, height: 120 },
};
for (const c of Object.values(canvases)) c.getContext = () => noopCtx;

const stubEl = () => ({ addEventListener() {}, textContent: "", value: "2", style: {} });
const cache = {};

global.document = {
  getElementById(id) {
    if (canvases[id]) return canvases[id];
    return cache[id] || (cache[id] = stubEl());
  },
  addEventListener() {},   // the sim attaches a keydown handler for the overlay
};
global.requestAnimationFrame = () => 0; // never auto-runs the render loop; we drive step()

// ---- load the real simulation -----------------------------------------------
const sim = require("./sim.js");
const { world, step, seed, biomass, CONFIG, GRID,
        draw, drawChart, drawCountChart, updateHud } = sim;

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
