/*
 * Terrarium — sim.js
 * A tiny artificial-life world. Motes have a small genome (speed, size, sense,
 * metabolism, hue). They wander, eat food, spend energy, and when they have
 * enough they split into a child whose genome is a mutated copy of the parent.
 * No global goal — just an economy of energy and the slow pressure of selection.
 *
 * v0: the foundations. Deliberately simple so future sessions have room to grow.
 */

(() => {
  "use strict";

  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const chartCanvas = document.getElementById("chart");
  const cctx = chartCanvas.getContext("2d");
  const CW = chartCanvas.width;
  const CH = chartCanvas.height;

  // ---- tunables -----------------------------------------------------------
  const CONFIG = {
    startMotes: 40,
    startFood: 220,
    foodEnergy: 26,
    foodSpawnPerTick: 1.4,   // average new food pellets per tick
    maxFood: 500,
    reproEnergy: 160,        // energy needed to split
    reproCost: 90,           // energy handed to the child
    baseMetabolism: 0.06,    // energy burned per tick at rest
    startEnergy: 90,
    maxPop: 600,
    sampleEvery: 30,         // ticks between trait-history samples
    historyCap: 240,         // how many samples the trait chart keeps
  };

  // Traits plotted on the live chart, each normalized to its full genetic range
  // (the mutation clamp bounds) so three very different scales share one axis.
  const TRAITS = [
    { key: "speed", label: "speed", color: "#f4a259", lo: 0.25, hi: 2.6 },
    { key: "size",  label: "size",  color: "#7fd1c1", lo: 1.6,  hi: 6.5 },
    { key: "sense", label: "sense", color: "#a78bfa", lo: 12,   hi: 120 },
  ];

  // ---- helpers ------------------------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const wrap = (x, max) => (x < 0 ? x + max : x >= max ? x - max : x);

  function mutate(v, amt, lo, hi) {
    return clamp(v + rand(-amt, amt), lo, hi);
  }

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
      dir: rand(0, Math.PI * 2),
      energy: CONFIG.startEnergy,
      age: 0,
      g: genome || makeGenome(null),
    };
  }

  function makeFood() {
    return { x: rand(0, W), y: rand(0, H), e: CONFIG.foodEnergy };
  }

  // ---- world state --------------------------------------------------------
  const world = {
    motes: [],
    food: [],
    tick: 0,
    born: 0,
    died: 0,
    paused: false,
    stepsPerFrame: 2,
    history: [],   // rolling samples of population-average traits
  };

  function seed() {
    world.motes = [];
    world.food = [];
    world.tick = 0;
    world.born = 0;
    world.died = 0;
    world.history = [];
    for (let i = 0; i < CONFIG.startMotes; i++) {
      world.motes.push(makeMote(rand(0, W), rand(0, H)));
    }
    for (let i = 0; i < CONFIG.startFood; i++) {
      world.food.push(makeFood());
    }
  }

  // ---- simulation step ----------------------------------------------------
  function nearestFood(m) {
    let best = null;
    let bestD = m.g.sense * m.g.sense;
    for (const f of world.food) {
      const dx = f.x - m.x;
      const dy = f.y - m.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  function sampleTraits() {
    const n = world.motes.length;
    if (n === 0) return;
    let speed = 0, size = 0, sense = 0;
    for (const m of world.motes) {
      speed += m.g.speed;
      size += m.g.size;
      sense += m.g.sense;
    }
    world.history.push({ speed: speed / n, size: size / n, sense: sense / n });
    if (world.history.length > CONFIG.historyCap) world.history.shift();
  }

  function step() {
    world.tick++;

    // spawn food
    let toSpawn = CONFIG.foodSpawnPerTick;
    while (toSpawn > 0 && world.food.length < CONFIG.maxFood) {
      if (toSpawn >= 1 || Math.random() < toSpawn) world.food.push(makeFood());
      toSpawn -= 1;
    }

    const newborns = [];
    for (let i = world.motes.length - 1; i >= 0; i--) {
      const m = world.motes[i];
      m.age++;

      // steer toward nearest food in sense range
      const target = nearestFood(m);
      if (target) {
        m.dir = Math.atan2(target.y - m.y, target.x - m.x);
      } else if (Math.random() < 0.06) {
        m.dir += rand(-0.6, 0.6); // idle wander
      }

      // move
      const v = m.g.speed;
      m.x = wrap(m.x + Math.cos(m.dir) * v, W);
      m.y = wrap(m.y + Math.sin(m.dir) * v, H);

      // burn energy: bigger + faster costs more
      const cost = CONFIG.baseMetabolism * m.g.metabo * (1 + m.g.size * 0.15 + v * 0.4);
      m.energy -= cost;

      // eat
      const r = m.g.size + 3;
      for (let j = world.food.length - 1; j >= 0; j--) {
        const f = world.food[j];
        const dx = f.x - m.x;
        const dy = f.y - m.y;
        if (dx * dx + dy * dy < r * r) {
          m.energy += f.e;
          world.food.splice(j, 1);
        }
      }

      // reproduce
      if (m.energy >= CONFIG.reproEnergy && world.motes.length + newborns.length < CONFIG.maxPop) {
        m.energy -= CONFIG.reproCost;
        const child = makeMote(m.x, m.y, makeGenome(m.g));
        child.energy = CONFIG.reproCost;
        newborns.push(child);
        world.born++;
      }

      // death
      if (m.energy <= 0) {
        world.motes.splice(i, 1);
        world.died++;
        // a died mote returns a little food to the world
        if (world.food.length < CONFIG.maxFood) {
          world.food.push({ x: m.x, y: m.y, e: CONFIG.foodEnergy * 0.6 });
        }
      }
    }

    for (const c of newborns) world.motes.push(c);

    // if everyone dies, gently reseed a few so the world never stays empty
    if (world.motes.length === 0) {
      for (let i = 0; i < 6; i++) world.motes.push(makeMote(rand(0, W), rand(0, H)));
    }

    // record the shape of the gene pool for the live chart
    if (world.tick % CONFIG.sampleEvery === 0) sampleTraits();
  }

  // ---- render -------------------------------------------------------------
  function draw() {
    ctx.fillStyle = "#060a0f";
    ctx.fillRect(0, 0, W, H);

    // food
    ctx.fillStyle = "#3a5a46";
    for (const f of world.food) {
      ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
    }

    // motes
    for (const m of world.motes) {
      const glow = clamp(m.energy / CONFIG.reproEnergy, 0.25, 1);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.g.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${m.g.hue.toFixed(0)} 65% ${(38 + glow * 24).toFixed(0)}%)`;
      ctx.fill();
      // a little heading whisker
      ctx.strokeStyle = `hsl(${m.g.hue.toFixed(0)} 65% 70% / 0.5)`;
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

  // ---- hud ----------------------------------------------------------------
  const el = {
    tick: document.getElementById("s-tick"),
    pop: document.getElementById("s-pop"),
    food: document.getElementById("s-food"),
    born: document.getElementById("s-born"),
    died: document.getElementById("s-died"),
  };
  function updateHud() {
    el.tick.textContent = world.tick;
    el.pop.textContent = world.motes.length;
    el.food.textContent = world.food.length;
    el.born.textContent = world.born;
    el.died.textContent = world.died;
  }

  // ---- loop ---------------------------------------------------------------
  function frame() {
    if (!world.paused) {
      for (let i = 0; i < world.stepsPerFrame; i++) step();
    }
    draw();
    drawChart();
    updateHud();
    requestAnimationFrame(frame);
  }

  // ---- controls -----------------------------------------------------------
  document.getElementById("btn-pause").addEventListener("click", (e) => {
    world.paused = !world.paused;
    e.target.textContent = world.paused ? "resume" : "pause";
  });
  document.getElementById("btn-seed").addEventListener("click", () => {
    for (let i = 0; i < 120 && world.food.length < CONFIG.maxFood; i++) world.food.push(makeFood());
  });
  document.getElementById("btn-reset").addEventListener("click", seed);
  document.getElementById("speed").addEventListener("input", (e) => {
    world.stepsPerFrame = parseInt(e.target.value, 10);
  });

  // ---- go -----------------------------------------------------------------
  seed();
  requestAnimationFrame(frame);
})();
