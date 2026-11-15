// VOIDPRISM — particles, floating score popups, screen shake and glow sprites.
// Glow is a pre-rendered radial-gradient canvas per colour, blitted with
// globalCompositeOperation 'lighter' — never a per-object shadowBlur.

import { Pool, TAU, randRange, clamp } from './utils.js';

const glowCache = new Map();

/** A cached radial-gradient sprite for a colour, used additively for the neon look. */
export function glowSprite(color) {
  let c = glowCache.get(color);
  if (c) return c;
  const size = 128;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, hexAlpha(color, 0.55));
  grad.addColorStop(1, hexAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(color, c);
  return c;
}

/** '#rrggbb' + alpha -> 'rgba(r,g,b,a)'. Falls back to the input if not hex. */
function hexAlpha(hex, a) {
  if (hex[0] !== '#' || (hex.length !== 7 && hex.length !== 4)) return hex;
  let r, g, b;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${a})`;
}

function makeParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2,
    color: '#fff', kind: 'dot', drag: 2, grav: 0, rot: 0, spin: 0, glow: true,
  };
}

function resetParticle(p, x, y, vx, vy, life, size, color, kind, drag, grav, spin, glow) {
  p.x = x; p.y = y; p.vx = vx; p.vy = vy;
  p.life = life; p.maxLife = life; p.size = size; p.color = color;
  p.kind = kind; p.drag = drag; p.grav = grav; p.spin = spin;
  p.rot = Math.random() * TAU; p.glow = glow;
}

function makePopup() {
  return { x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 16 };
}

export class Particles {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.list = new Pool(makeParticle, resetParticle, 300);
    this.popups = new Pool(makePopup, (p, x, y, text, color, size) => {
      p.x = x; p.y = y; p.vy = -34; p.life = 0.9; p.maxLife = 0.9;
      p.text = text; p.color = color; p.size = size;
    }, 40);
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
  }

  addShake(amount) {
    this.shake = Math.min(34, this.shake + amount);
  }

  addFlash(amount, color = '#ffffff') {
    this.flash = Math.min(1, this.flash + amount);
    this.flashColor = color;
  }

  _dir() {
    const a = this.rng() * TAU;
    return [Math.cos(a), Math.sin(a)];
  }

  burst(x, y, color, count, speed, size, life) {
    for (let i = 0; i < count; i++) {
      const [dx, dy] = this._dir();
      const s = speed * (0.35 + this.rng() * 0.9);
      this.list.spawn(
        x, y, dx * s, dy * s,
        life * (0.6 + this.rng() * 0.8), size * (0.5 + this.rng()),
        color, 'dot', 2.4, 0, 0, true,
      );
    }
  }

  sparks(x, y, color, count, speed, angle, spread, size, life) {
    for (let i = 0; i < count; i++) {
      const a = angle + (this.rng() - 0.5) * spread;
      const s = speed * (0.4 + this.rng());
      this.list.spawn(
        x, y, Math.cos(a) * s, Math.sin(a) * s,
        life * (0.6 + this.rng() * 0.7), size * (0.6 + this.rng()),
        color, 'spark', 3.2, 0, 0, true,
      );
    }
  }

  muzzle(x, y, angle, color) {
    for (let i = 0; i < 5; i++) {
      const a = angle + (this.rng() - 0.5) * 0.6;
      const s = 180 + this.rng() * 260;
      this.list.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.12 + this.rng() * 0.1,
        2 + this.rng() * 3, color, 'spark', 6, 0, 0, true);
    }
  }

  hit(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
      const [dx, dy] = this._dir();
      const s = 60 + this.rng() * 200;
      this.list.spawn(x, y, dx * s, dy * s, 0.2 + this.rng() * 0.25,
        1.5 + this.rng() * 2.5, color, 'dot', 4, 0, 0, true);
    }
  }

  explode(x, y, color, big = false) {
    const n = big ? 42 : 20;
    this.burst(x, y, color, n, big ? 380 : 230, big ? 4 : 2.8, big ? 0.9 : 0.6);
    this.burst(x, y, '#ffffff', big ? 14 : 7, big ? 300 : 180, 2, 0.35);
    // expanding ring
    this.list.spawn(x, y, 0, 0, big ? 0.6 : 0.4, big ? 10 : 6, color, 'ring', 0, 0, 0, true);
    this.addShake(big ? 16 : 6);
  }

  ring(x, y, color, size = 8, life = 0.5) {
    this.list.spawn(x, y, 0, 0, life, size, color, 'ring', 0, 0, 0, true);
  }

  dashTrail(x, y, color) {
    this.list.spawn(x, y, (this.rng() - 0.5) * 40, (this.rng() - 0.5) * 40,
      0.35, 10, color, 'dot', 2, 0, 0, true);
    this.list.spawn(x, y, 0, 0, 0.3, 5, color, 'dot', 2, 0, 0, true);
  }

  pickupBurst(x, y, color) {
    this.burst(x, y, color, 12, 140, 2, 0.5);
    this.ring(x, y, color, 6, 0.45);
  }

  popup(x, y, text, color, size = 16) {
    this.popups.spawn(x, y, text, color, size);
  }

  update(dt) {
    const L = this.list;
    for (let i = L.active - 1; i >= 0; i--) {
      const p = L.items[i];
      p.life -= dt;
      if (p.life <= 0) { L.remove(i); continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.kind === 'ring') p.size += 260 * dt;
    }
    const P = this.popups;
    for (let i = P.active - 1; i >= 0; i--) {
      const p = P.items[i];
      p.life -= dt;
      if (p.life <= 0) { P.remove(i); continue; }
      p.y += p.vy * dt;
      p.vy *= Math.max(0, 1 - 2.2 * dt);
    }
    this.shake = Math.max(0, this.shake - 60 * dt);
    this.flash = Math.max(0, this.flash - 3.4 * dt);
  }

  render(ctx) {
    const L = this.list;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < L.active; i++) {
      const p = L.items[i];
      const t = p.life / p.maxLife;
      if (p.kind === 'ring') {
        ctx.globalAlpha = t * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + 3 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.stroke();
        continue;
      }
      if (p.glow) {
        const g = glowSprite(p.color);
        const s = p.size * 6 * (0.5 + t);
        ctx.globalAlpha = clamp(t, 0, 1) * 0.85;
        ctx.drawImage(g, p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = clamp(t, 0, 1);
      ctx.fillStyle = p.color;
      if (p.kind === 'spark') {
        const len = Math.min(18, Math.hypot(p.vx, p.vy) * 0.03 + 3);
        const a = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.fillRect(-len, -p.size * 0.4, len * 2, p.size * 0.8);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.8), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    // Floating score popups, drawn crisply (normal blending).
    const P = this.popups;
    if (P.active > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < P.active; i++) {
        const p = P.items[i];
        const t = p.life / p.maxLife;
        ctx.globalAlpha = clamp(t * 1.6, 0, 1);
        ctx.font = `700 ${p.size}px ui-monospace, Menlo, monospace`;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(p.text, p.x + 1.5, p.y + 1.5);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.restore();
    }
  }

  renderFlash(ctx, w, h) {
    if (this.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.flash * 0.5;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}