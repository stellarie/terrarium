/*
 * Terrarium — the headless rasterizer (dependency-free, Node only)
 *
 * For thirteen straight runs the journal confessed the same blind spot: every colour,
 * ring, rim and vignette the world draws was "logic-correct, look unknown", because the
 * only preview is a browser pane that won't composite in an autonomous session. This
 * module ends that. It implements enough of a real `CanvasRenderingContext2D` — a pixel
 * buffer with fillRect / arc / fill / stroke / transforms / radial gradients / alpha
 * compositing and CSS colour parsing — that the shim can point sim.js's *actual* draw()
 * at it (not a parallel copy) and paint true pixels, then hand-encodes them as a PNG.
 *
 * So `node observe.js --frame out.png` boots the real world, ticks it, calls the real
 * draw(), and writes an image a human — or a future session — can finally *look at*.
 * It is honest by construction: it runs the same draw() the browser runs. What it does
 * NOT render is text (fillText is a no-op — labels and the flip banner's words are
 * absent) and antialiasing (edges are hard); everything that carries the world's *state*
 * — where the life is, whether the light leans warm or cold, each mote's hue / saturation
 * / lifestyle ring, each hunter's flush and age-rim — is real.
 *
 * No dependencies: the PNG uses hand-rolled CRC32 + Adler32 + stored (uncompressed)
 * DEFLATE blocks, so the whole encoder is a few dozen lines and needs no zlib.
 */
"use strict";

// ---- CSS colour parsing -----------------------------------------------------

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  s = s / 100;
  l = l / 100;
  if (s === 0) { const g = Math.round(l * 255); return [g, g, g]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    t = (t % 1 + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}

// Parse the CSS colour strings sim.js actually emits on the world canvas:
//   #rrggbb / #rgb,  rgb(...), rgba(...),  hsl(h s% l%), hsl(h s% l% / a), hsl(h, s%, l%)
// Returns [r, g, b, a] with r/g/b in 0..255 and a in 0..1, or null for non-strings.
function parseColor(css) {
  if (typeof css !== "string") return null; // a gradient object — handled by the caller
  css = css.trim();
  if (css[0] === "#") {
    let h = css.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = css.match(/-?\d*\.?\d+/g);
  if (!m) return [0, 0, 0, 1];
  const v = m.map(Number);
  if (css.startsWith("hsl")) {
    const a = v.length > 3 ? v[3] : 1;
    const rgb = hslToRgb(v[0], v[1], v[2]);
    return [rgb[0], rgb[1], rgb[2], a];
  }
  // rgb() / rgba()
  return [v[0] | 0, v[1] | 0, v[2] | 0, v.length > 3 ? v[3] : 1];
}

// ---- gradients --------------------------------------------------------------

function Gradient(kind, coords) {
  this.kind = kind;      // "linear" | "radial"
  this.coords = coords;  // linear: [x0,y0,x1,y1]; radial: [x0,y0,r0,x1,y1,r1]
  this.stops = [];
}
Gradient.prototype.addColorStop = function (pos, color) {
  this.stops.push({ pos, rgba: parseColor(color) || [0, 0, 0, 1] });
  this.stops.sort((a, b) => a.pos - b.pos);
};
Gradient.prototype.sample = function (px, py) {
  const s = this.stops;
  if (!s.length) return [0, 0, 0, 0];
  let t;
  if (this.kind === "radial") {
    // sim only ever uses concentric radial gradients (same centre); parametrise by
    // radius between the inner and outer circle, which is exactly the vignette's intent.
    const [, , r0, x1, y1, r1] = this.coords;
    const d = Math.hypot(px - x1, py - y1);
    t = (r1 - r0) ? (d - r0) / (r1 - r0) : 1;
  } else {
    const [x0, y0, x1, y1] = this.coords;
    const dx = x1 - x0, dy = y1 - y0, dd = dx * dx + dy * dy;
    t = dd ? ((px - x0) * dx + (py - y0) * dy) / dd : 0;
  }
  if (t <= s[0].pos) return s[0].rgba;
  if (t >= s[s.length - 1].pos) return s[s.length - 1].rgba;
  for (let i = 1; i < s.length; i++) {
    if (t <= s[i].pos) {
      const a = s[i - 1], b = s[i];
      const f = (t - a.pos) / ((b.pos - a.pos) || 1);
      return [
        a.rgba[0] + (b.rgba[0] - a.rgba[0]) * f,
        a.rgba[1] + (b.rgba[1] - a.rgba[1]) * f,
        a.rgba[2] + (b.rgba[2] - a.rgba[2]) * f,
        a.rgba[3] + (b.rgba[3] - a.rgba[3]) * f,
      ];
    }
  }
  return s[s.length - 1].rgba;
};

// ---- the raster 2D context --------------------------------------------------

function RasterCtx(width, height) {
  this.width = width;
  this.height = height;
  this.buf = new Uint8ClampedArray(width * height * 3); // opaque RGB, row-major
  // paintable state (canvas resets these via property assignment in draw())
  this.fillStyle = "#000";
  this.strokeStyle = "#000";
  this.lineWidth = 1;
  this.globalAlpha = 1;
  this.font = "";
  this.textAlign = "left";
  this.textBaseline = "alphabetic";
  // affine transform: device = (a*x + c*y + e, b*x + d*y + f)
  this._m = [1, 0, 0, 1, 0, 0];
  this._stack = [];
  this._sub = [];      // current path: array of subpaths, each { pts:[{x,y}], closed }
  // stroke coverage scratch — stamp-id trick avoids clearing a 500k buffer per stroke
  this._cid = 0;
  this._cstamp = new Int32Array(width * height).fill(-1);
  this._cval = new Float32Array(width * height);
  this._ctouched = [];
}

RasterCtx.prototype.getBuffer = function () { return this.buf; };

// -- state stack & transforms --
RasterCtx.prototype.save = function () {
  this._stack.push({
    fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth,
    globalAlpha: this.globalAlpha, font: this.font, textAlign: this.textAlign,
    textBaseline: this.textBaseline, m: this._m.slice(),
  });
};
RasterCtx.prototype.restore = function () {
  const s = this._stack.pop();
  if (!s) return;
  this.fillStyle = s.fillStyle; this.strokeStyle = s.strokeStyle; this.lineWidth = s.lineWidth;
  this.globalAlpha = s.globalAlpha; this.font = s.font; this.textAlign = s.textAlign;
  this.textBaseline = s.textBaseline; this._m = s.m;
};
RasterCtx.prototype.translate = function (tx, ty) {
  const m = this._m;
  m[4] += m[0] * tx + m[2] * ty;
  m[5] += m[1] * tx + m[3] * ty;
};
RasterCtx.prototype.rotate = function (r) {
  const m = this._m, cos = Math.cos(r), sin = Math.sin(r);
  const a = m[0], b = m[1], c = m[2], d = m[3];
  m[0] = a * cos + c * sin;
  m[1] = b * cos + d * sin;
  m[2] = a * -sin + c * cos;
  m[3] = b * -sin + d * cos;
};
RasterCtx.prototype.scale = function (sx, sy) {
  const m = this._m;
  m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy;
};
RasterCtx.prototype._tp = function (x, y) {
  const m = this._m;
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
};

// -- path building (points stored in device space, as canvas does) --
RasterCtx.prototype.beginPath = function () { this._sub = []; };
RasterCtx.prototype.moveTo = function (x, y) { this._sub.push({ pts: [this._tp(x, y)], closed: false }); };
RasterCtx.prototype.lineTo = function (x, y) {
  if (!this._sub.length) this.moveTo(x, y);
  else this._sub[this._sub.length - 1].pts.push(this._tp(x, y));
};
RasterCtx.prototype.closePath = function () {
  if (this._sub.length) this._sub[this._sub.length - 1].closed = true;
};
RasterCtx.prototype.arc = function (cx, cy, r, a0, a1) {
  // approximate as a polyline; 40 segments is smooth at the disc sizes used here
  const seg = 40, sub = { pts: [], closed: false };
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * (i / seg);
    sub.pts.push(this._tp(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  this._sub.push(sub);
};
RasterCtx.prototype.rect = function (x, y, w, h) {
  this._sub.push({
    pts: [this._tp(x, y), this._tp(x + w, y), this._tp(x + w, y + h), this._tp(x, y + h)],
    closed: true,
  });
};

// -- pixel op: blend one source over the opaque buffer --
RasterCtx.prototype._blend = function (x, y, r, g, b, a) {
  if (a <= 0) return;
  if (a > 1) a = 1;
  if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
  const i = (y * this.width + x) * 3, ia = 1 - a, buf = this.buf;
  buf[i] = r * a + buf[i] * ia;
  buf[i + 1] = g * a + buf[i + 1] * ia;
  buf[i + 2] = b * a + buf[i + 2] * ia;
};

// -- fillRect: axis-aligned fast path (all of draw()'s fillRects are untransformed),
//    honouring a solid colour or a gradient fillStyle, times globalAlpha --
RasterCtx.prototype.fillRect = function (x, y, w, h) {
  const m = this._m;
  const grad = this.fillStyle instanceof Gradient ? this.fillStyle : null;
  const col = grad ? null : parseColor(this.fillStyle);
  const ga = this.globalAlpha;
  if (m[1] === 0 && m[2] === 0) {
    // axis-aligned (translate/scale only)
    let x0 = m[0] * x + m[4], y0 = m[3] * y + m[5];
    let x1 = m[0] * (x + w) + m[4], y1 = m[3] * (y + h) + m[5];
    if (x1 < x0) { const t = x0; x0 = x1; x1 = t; }
    if (y1 < y0) { const t = y0; y0 = y1; y1 = t; }
    const ix0 = Math.max(0, Math.round(x0)), ix1 = Math.min(this.width, Math.round(x1));
    const iy0 = Math.max(0, Math.round(y0)), iy1 = Math.min(this.height, Math.round(y1));
    for (let py = iy0; py < iy1; py++) {
      for (let px = ix0; px < ix1; px++) {
        if (grad) { const c = grad.sample(px + 0.5, py + 0.5); this._blend(px, py, c[0], c[1], c[2], c[3] * ga); }
        else this._blend(px, py, col[0], col[1], col[2], col[3] * ga);
      }
    }
  } else {
    // general (rotated) rect — fill as a polygon
    const p = [this._tp(x, y), this._tp(x + w, y), this._tp(x + w, y + h), this._tp(x, y + h)];
    this._fillPolys([{ pts: p, closed: true }], col, grad, ga);
  }
};

// -- fill(): scanline-fill the current path (even-odd), solid colour × globalAlpha --
RasterCtx.prototype.fill = function () {
  this._fillPolys(this._sub, parseColor(this.fillStyle), null, this.globalAlpha);
};

RasterCtx.prototype._fillPolys = function (subs, col, grad, ga) {
  if (!subs.length) return;
  let ymin = Infinity, ymax = -Infinity;
  for (const s of subs) for (const p of s.pts) { if (p.y < ymin) ymin = p.y; if (p.y > ymax) ymax = p.y; }
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(this.height - 1, Math.ceil(ymax));
  const xs = [];
  for (let py = y0; py <= y1; py++) {
    const yc = py + 0.5;
    xs.length = 0;
    for (const s of subs) {
      const pts = s.pts, n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n]; // closed for fill
        const ay = a.y, by = b.y;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          xs.push(a.x + (yc - ay) / (by - ay) * (b.x - a.x));
        }
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const sx = Math.max(0, Math.round(xs[k])), ex = Math.min(this.width, Math.round(xs[k + 1]));
      for (let px = sx; px < ex; px++) {
        if (grad) { const c = grad.sample(px + 0.5, yc); this._blend(px, py, c[0], c[1], c[2], c[3] * ga); }
        else this._blend(px, py, col[0], col[1], col[2], col[3] * ga);
      }
    }
  }
};

// -- stroke(): draw each subpath as thick line segments. A per-call coverage stamp
//    dedups overlapping segment ends so a translucent ring doesn't over-darken. --
RasterCtx.prototype._stamp = function (px, py, cov) {
  if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
  const i = py * this.width + px;
  if (this._cstamp[i] !== this._cid) { this._cstamp[i] = this._cid; this._cval[i] = cov; this._ctouched.push(i); }
  else if (cov > this._cval[i]) this._cval[i] = cov;
};
RasterCtx.prototype.stroke = function () {
  const col = parseColor(this.strokeStyle);
  const ga = this.globalAlpha;
  const rad = Math.max(0.5, this.lineWidth / 2);
  const ri = Math.ceil(rad), r2 = rad * rad;
  this._cid++;
  this._ctouched.length = 0;
  for (const s of this._sub) {
    const pts = s.pts, n = pts.length;
    const last = s.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(len * 2));
      for (let t = 0; t <= steps; t++) {
        const cx = a.x + dx * (t / steps), cy = a.y + dy * (t / steps);
        const bx = Math.round(cx), by = Math.round(cy);
        for (let oy = -ri; oy <= ri; oy++) {
          for (let ox = -ri; ox <= ri; ox++) {
            if (ox * ox + oy * oy <= r2) this._stamp(bx + ox, by + oy, 1);
          }
        }
      }
    }
  }
  const touched = this._ctouched;
  for (let k = 0; k < touched.length; k++) {
    const i = touched[k];
    this._blend(i % this.width, (i / this.width) | 0, col[0], col[1], col[2], col[3] * ga);
  }
};

// -- text & misc: no-ops / stubs (text isn't rendered; see the header) --
RasterCtx.prototype.measureText = function (t) { return { width: (t ? t.length : 0) * 7 }; };
RasterCtx.prototype.fillText = function () {};
RasterCtx.prototype.strokeText = function () {};
RasterCtx.prototype.setLineDash = function () {};
RasterCtx.prototype.clip = function () {};
RasterCtx.prototype.createLinearGradient = function (x0, y0, x1, y1) { return new Gradient("linear", [x0, y0, x1, y1]); };
RasterCtx.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return new Gradient("radial", [x0, y0, r0, x1, y1, r1]); };

// ---- PNG encoding (hand-rolled, dependency-free) ----------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function adler32(buf) {
  let a = 1, b = 0; const MOD = 65521;
  for (let i = 0; i < buf.length; i++) { a = (a + buf[i]) % MOD; b = (b + a) % MOD; }
  return ((b << 16) | a) >>> 0;
}
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b; }
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  return Buffer.concat([u32(data.length), body, u32(crc32(body))]);
}

// Encode an RGB pixel buffer (length width*height*3) as a PNG using stored DEFLATE
// blocks, so no zlib is needed. Returns a Buffer.
function encodePNG(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1)); // one filter byte per row (0 = None)
  for (let y = 0; y < height; y++) {
    const src = y * stride, dst = y * (stride + 1);
    raw[dst] = 0;
    for (let x = 0; x < stride; x++) raw[dst + 1 + x] = rgb[src + x];
  }
  // zlib wrapper + stored blocks
  const parts = [Buffer.from([0x78, 0x01])];
  let off = 0;
  while (off < raw.length) {
    const len = Math.min(65535, raw.length - off);
    const final = (off + len >= raw.length) ? 1 : 0;
    parts.push(Buffer.from([final, len & 255, (len >> 8) & 255, (~len) & 255, ((~len) >> 8) & 255]));
    parts.push(raw.subarray(off, off + len));
    off += len;
  }
  parts.push(u32(adler32(raw)));
  const idat = Buffer.concat(parts);

  const ihdr = Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { RasterCtx, encodePNG, parseColor, hslToRgb };
