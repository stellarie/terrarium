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

// the regime "mood" tint must lean the right way: an arms-race is warm (+), a
// grazer-haven cold (−), settling neutral (0), and a softening trend relaxes each
// toward neutral. Pure function of the regime, so this can't flake on randomness.
const mArms = regimeMood({ state: "arms-race", trend: "steady" });
const mHaven = regimeMood({ state: "grazer-haven", trend: "steady" });
check(mArms === 1 && mHaven === -1 && regimeMood({ state: "settling" }) === 0 && regimeMood(null) === 0,
      `regime mood signs the attractors right (arms ${mArms}, haven ${mHaven}, settling 0)`);
check(regimeMood({ state: "arms-race", trend: "declining" }) === 0.45 &&
      regimeMood({ state: "grazer-haven", trend: "recovering" }) === -0.35 &&
      mArms > 0 && mHaven < 0,
      "a softening trend relaxes the mood toward neutral (declining/recovering) yet keeps its sign");
// and the eased tint must actually converge toward its target across frames — this
// also drives the leaned background + vignette through the shimmed gradient stub, so
// a throw in the new draw path fails here, not just silently in a browser.
world.mood = 0; world.regime = { state: "arms-race", trend: "steady", flash: 0, flashText: "", label: "x" };
for (let i = 0; i < 500; i++) draw();
const moodWarm = world.mood;
world.regime.state = "grazer-haven";
for (let i = 0; i < 500; i++) draw();
check(moodWarm > 0.6 && world.mood < -0.6,
      `mood eases toward the live regime (arms-race → ${moodWarm.toFixed(2)}, then grazer-haven → ${world.mood.toFixed(2)})`);

// the render path (unexercised by step()) doesn't throw — including every overlay
// mode (off / fertility / grazing) against the shimmed canvas
let renderThrew = null;
try {
  world.sparks.push({ x: 100, y: 100, life: 0.5 }); // ensure the kill-flash branch runs
  for (const ov of [0, 1, 2]) { world.overlay = ov; draw(); }
  world.overlay = 0;
  drawChart(); drawCountChart(); drawArmsChart(); updateHud();
} catch (e) { renderThrew = e; }
check(!renderThrew, renderThrew ? `render threw: ${renderThrew && renderThrew.stack}` : "draw (all overlays) / charts / hud render without throwing");

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
  g: { speed: 1.5, size: 4, sense: 70, metabo: 1, hue: 20 },
});
step();
check(world.hunterAged > agedBefore,
      `senescence is live — an ancient hunter died of old age on cue (aged toll ${agedBefore}→${world.hunterAged})`);

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

// ---- verdict ----------------------------------------------------------------
if (failures) {
  console.error(`\nSMOKE TEST FAILED — ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nSMOKE TEST PASSED — the world lives.");
