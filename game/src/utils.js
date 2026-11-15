// VOIDPRISM — small math/geometry helpers, a seeded RNG and a generic object pool.
// No per-frame allocation happens in the game loop: pools hand out reused objects.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const randRange = (rng, a, b) => a + (b - a) * rng();
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const approach = (v, target, step) => {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
};

/** mulberry32 — a tiny, fast, deterministic PRNG. Returns a function in [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function circleHit(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
}

export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function pointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

/**
 * A preallocated object pool. `make` builds one fresh object; `reset` clears it
 * before reuse. `active` is the count of live objects, kept packed at the front
 * so iteration and swaps stay cheap.
 */
export class Pool {
  constructor(make, reset, initial = 0) {
    this.make = make;
    this.reset = reset;
    this.items = [];
    for (let i = 0; i < initial; i++) this.items.push(make());
    this.active = 0;
  }

  spawn(...args) {
    let obj;
    if (this.active < this.items.length) {
      obj = this.items[this.active];
    } else {
      obj = this.make();
      this.items.push(obj);
    }
    this.active++;
    this.reset(obj, ...args);
    return obj;
  }

  // Drop the object at index i by swapping in the last active one.
  remove(i) {
    const last = this.active - 1;
    if (i !== last) {
      const tmp = this.items[i];
      this.items[i] = this.items[last];
      this.items[last] = tmp;
    }
    this.active--;
  }

  clear() {
    this.active = 0;
  }

  forEach(fn) {
    for (let i = 0; i < this.active; i++) fn(this.items[i], i);
  }
}

/** Angle difference wrapped to [-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Deterministic hash of two ints, for cheap per-entity variation. */
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}