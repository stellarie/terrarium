/*
 * Terrarium — headless DOM/canvas shim (dependency-free, Node only)
 *
 * sim.js reaches for `document`, canvases and `requestAnimationFrame` at load time,
 * so a bare `require('./sim.js')` under Node would throw. This installs just enough
 * of a browser as globals — every 2d-context method a no-op, `measureText` a zero
 * width, canvases carrying the real pixel dimensions sim.js reads, `getElementById`
 * inventing harmless stub elements on demand, and rAF a no-op so the render loop
 * never auto-runs (the harness drives step() itself).
 *
 * Both harnesses load this first so they drive byte-identical internals: smoke.js
 * (assertions — "is anything broken?") and observe.js (readings — "what is the world
 * doing?"). Requiring it for its side effect is the whole API; the return value is
 * only there for a harness that wants to poke the canvases directly.
 */
"use strict";

const gradientStub = { addColorStop() {} };  // createLinear/RadialGradient return this
const noopCtx = new Proxy({}, {
  get(_t, prop) {
    if (prop === "measureText") return () => ({ width: 0 });
    if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradientStub;
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

module.exports = { canvases, noopCtx };
