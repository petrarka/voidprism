// VOIDPRISM — the six enemy archetypes (plus the splitter's minis).
// Each has its own movement, telegraph and attack logic. The manager keeps a
// pooled array and assigns stable ids so player bullets can pierce correctly.

import { ENEMY_TYPES, COLORS } from './config.js';
import { Pool, TAU, clamp, angleTo } from './utils.js';
import { glowSprite } from './particles.js';

let nextId = 1;
let ENEMY_RNG = Math.random;

function makeEnemy() {
  return {
    id: 0, type: 'chaser', def: null, x: 0, y: 0, vx: 0, vy: 0,
    hp: 1, maxhp: 1, radius: 10, contact: 10, color: '#fff', glyph: 'tri',
    points: 0, rot: 0, spin: 0, t: 0, phase: 0, timer: 0, state: 'seek',
    hitFlash: 0, orbitDir: 1, seed: 0, dead: false,
  };
}

function resetEnemy(e, type, x, y, waveScale) {
  const d = ENEMY_TYPES[type];
  e.id = nextId++;
  e.type = type;
  e.def = d;
  e.x = x; e.y = y; e.vx = 0; e.vy = 0;
  e.maxhp = Math.round(d.hp * waveScale);
  e.hp = e.maxhp;
  e.radius = d.radius;
  e.contact = d.contact;
  e.color = d.color;
  e.glyph = d.glyph;
  e.points = d.points;
  e.rot = ENEMY_RNG() * TAU;
  e.spin = type === 'weaver' ? 1.6 : type === 'orbiter' ? -1.1 : 0.5;
  e.t = 0;
  e.phase = ENEMY_RNG() * TAU;
  e.timer = 1.2 + ENEMY_RNG() * 1.2;
  e.state = 'seek';
  e.hitFlash = 0;
  e.orbitDir = ENEMY_RNG() < 0.5 ? 1 : -1;
  e.seed = ENEMY_RNG() * 1000;
  e.dead = false;
  return e;
}

export class Enemies {
  constructor(rng = Math.random) {
    this.rng = rng;
    ENEMY_RNG = rng;
    this.list = new Pool(makeEnemy, resetEnemy, 80);
  }

  spawn(type, x, y, waveScale = 1) {
    return this.list.spawn(type, x, y, waveScale);
  }

  get count() { return this.list.active; }

  clear() { this.list.clear(); }

  update(dt, game) {
    const p = game.player;
    const L = this.list;
    for (let i = 0; i < L.active; i++) {
      const e = L.items[i];
      e.t += dt;
      e.rot += e.spin * dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
      this._think(e, dt, game, p);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  }

  _think(e, dt, game, p) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;

    switch (e.type) {
      case 'chaser': {
        if (e.state === 'seek') {
          const s = e.def.speed * 0.55;
          e.vx = ux * s; e.vy = uy * s;
          e.timer -= dt;
          if (e.timer <= 0) { e.state = 'wind'; e.timer = 0.45; }
        } else if (e.state === 'wind') {
          e.vx *= 0.86; e.vy *= 0.86;
          e.timer -= dt;
          if (e.timer <= 0) {
            const s = e.def.speed * 4.4;
            e.vx = ux * s; e.vy = uy * s;
            e.state = 'lunge'; e.timer = 0.30;
            game.particles.ring(e.x, e.y, e.color, e.radius, 0.3);
            game.audio.enemyShoot();
          }
        } else {
          e.timer -= dt;
          if (e.timer <= 0) { e.state = 'seek'; e.timer = 1.5 + this.rng() * 1.2; }
        }
        break;
      }
      case 'weaver': {
        e.phase += dt * 5;
        const wob = Math.sin(e.phase) * 0.95;
        const ca = Math.cos(wob), sa = Math.sin(wob);
        const wx = ux * ca - uy * sa;
        const wy = ux * sa + uy * ca;
        e.vx = wx * e.def.speed;
        e.vy = wy * e.def.speed;
        break;
      }
      case 'splitter': {
        const s = e.def.speed * 0.7;
        e.vx = ux * s + Math.cos(e.t * 2) * 20;
        e.vy = uy * s + Math.sin(e.t * 2) * 20;
        break;
      }
      case 'orbiter': {
        const want = 210;
        const radial = clamp((d - want) * 1.8, -e.def.speed, e.def.speed);
        const tx = -uy * e.orbitDir, ty = ux * e.orbitDir;
        const tang = e.def.speed * 0.9;
        e.vx = ux * radial + tx * tang;
        e.vy = uy * radial + ty * tang;
        e.timer -= dt;
        if (e.timer <= 0 && d < 620) {
          e.timer = 1.7 + this.rng() * 0.6;
          const a = angleTo(e.x, e.y, p.x, p.y);
          const sp = 260;
          game.bullets.spawnEnemy(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, 3.2, 5, 10, COLORS.cyan, 'orb');
          game.audio.enemyShoot();
          game.particles.muzzle(e.x, e.y, a, COLORS.cyan);
        }
        break;
      }
      case 'tank': {
        e.vx = ux * e.def.speed;
        e.vy = uy * e.def.speed;
        break;
      }
      case 'swarmer': {
        const wob = Math.sin(e.t * 12 + e.seed) * 0.5;
        const ca = Math.cos(wob), sa = Math.sin(wob);
        e.vx = (ux * ca - uy * sa) * e.def.speed;
        e.vy = (ux * sa + uy * ca) * e.def.speed;
        break;
      }
      case 'mini': {
        e.vx = ux * e.def.speed;
        e.vy = uy * e.def.speed;
        break;
      }
    }
  }

  // Find the index of a live enemy overlapping a circle; returns -1 if none.
  // Used by the game for bullet and orbital collisions.
  hitTest(x, y, r) {
    const L = this.list;
    for (let i = 0; i < L.active; i++) {
      const e = L.items[i];
      const rr = e.radius + r;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= rr * rr) return i;
    }
    return -1;
  }

  render(ctx) {
    const L = this.list;
    for (let i = 0; i < L.active; i++) {
      const e = L.items[i];
      drawEnemy(ctx, e);
    }
  }
}

export function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  // Additive glow.
  ctx.globalCompositeOperation = 'lighter';
  const g = glowSprite(e.color);
  const gs = e.radius * (e.state === 'wind' ? 7.5 : 5.6);
  ctx.globalAlpha = e.state === 'wind' ? 0.85 : 0.58;
  ctx.drawImage(g, -gs / 2, -gs / 2, gs, gs);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // Telegraph ring before a chaser lunge / orbiter shot charge.
  if (e.state === 'wind') {
    const k = 1 - e.timer / 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 10 - k * 6, 0, TAU);
    ctx.strokeStyle = e.color;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(e.t * 40);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.rotate(e.rot);
  const r = e.radius;
  const fill = e.hitFlash > 0 ? '#ffffff' : hexA(e.color, 0.16);
  const stroke = e.hitFlash > 0 ? '#ffffff' : e.color;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = e.type === 'tank' ? 3.4 : 2.2;

  switch (e.glyph) {
    case 'tri': {
      ctx.beginPath();
      ctx.moveTo(r * 1.25, 0);
      ctx.lineTo(-r * 0.8, r * 0.9);
      ctx.lineTo(-r * 0.8, -r * 0.9);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.3); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.3); ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'hex': {
      polygon(ctx, 6, r * 1.15);
      ctx.fill(); ctx.stroke();
      // inner split line
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0);
      ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
      break;
    }
    case 'pent': {
      polygon(ctx, 5, r * 1.2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, TAU);
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : e.color;
      ctx.fill();
      break;
    }
    case 'octo': {
      polygon(ctx, 8, r);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, TAU);
      ctx.strokeStyle = e.color; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
      break;
    }
    case 'circle':
    default: {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill(); ctx.stroke();
      break;
    }
  }
  ctx.restore();

  // Tank health pip.
  if (e.type === 'tank' && e.hp < e.maxhp) {
    const w = e.radius * 2;
    ctx.save();
    ctx.translate(e.x - w / 2, e.y - e.radius - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = e.color;
    ctx.fillRect(0, 0, w * (e.hp / e.maxhp), 3);
    ctx.restore();
  }
}

function polygon(ctx, sides, r) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hexA(hex, a) {
  if (hex[0] !== '#' || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}