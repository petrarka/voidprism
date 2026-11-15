// VOIDPRISM — pooled player and enemy bullets.
// Player bullets carry pierce; enemy bullets are simple glowing orbs. The bomb
// clears every enemy bullet by resetting the pool.

import { Pool, TAU } from './utils.js';
import { glowSprite } from './particles.js';

function makePBullet() {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, pierce: 0, radius: 4, color: '#fff', hitId: -1, active: true };
}

function resetPBullet(b, x, y, vx, vy, life, damage, pierce, radius, color) {
  b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.life = life;
  b.damage = damage; b.pierce = pierce; b.radius = radius; b.color = color;
  b.hitId = -1; b.active = true;
}

function makeEBullet() {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, radius: 5, damage: 10, color: '#fff', kind: 'orb', spin: 0, rot: 0 };
}

function resetEBullet(b, x, y, vx, vy, life, radius, damage, color, kind) {
  b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.life = life;
  b.radius = radius; b.damage = damage; b.color = color; b.kind = kind;
  b.rot = 0; b.spin = kind === 'shard' ? 8 : 0;
}

export class Bullets {
  constructor() {
    this.player = new Pool(makePBullet, resetPBullet, 160);
    this.enemy = new Pool(makeEBullet, resetEBullet, 220);
  }

  spawnPlayer(x, y, vx, vy, life, damage, pierce, radius, color) {
    return this.player.spawn(x, y, vx, vy, life, damage, pierce, radius, color);
  }

  spawnEnemy(x, y, vx, vy, life, radius, damage, color, kind = 'orb') {
    return this.enemy.spawn(x, y, vx, vy, life, radius, damage, color, kind);
  }

  clearEnemy() {
    this.enemy.clear();
  }

  get playerCount() { return this.player.active; }
  get enemyCount() { return this.enemy.active; }

  update(dt, w, h, margin = 60) {
    const P = this.player;
    for (let i = P.active - 1; i >= 0; i--) {
      const b = P.items[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -margin || b.x > w + margin || b.y < -margin || b.y > h + margin) P.remove(i);
    }
    const E = this.enemy;
    for (let i = E.active - 1; i >= 0; i--) {
      const b = E.items[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      if (b.life <= 0 || b.x < -margin || b.x > w + margin || b.y < -margin || b.y > h + margin) E.remove(i);
    }
  }

  render(ctx) {
    const P = this.player;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.active; i++) {
      const b = P.items[i];
      const g = glowSprite(b.color);
      ctx.globalAlpha = 1.0;
      ctx.drawImage(g, b.x - 16, b.y - 16, 32, 32);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.radius * 1.6;
      ctx.lineCap = 'round';
      const a = Math.atan2(b.vy, b.vx);
      const len = 9;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(a) * len, b.y - Math.sin(a) * len);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    const E = this.enemy;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < E.active; i++) {
      const b = E.items[i];
      const g = glowSprite(b.color);
      const s = b.radius * 6;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(g, b.x - s / 2, b.y - s / 2, s, s);
      ctx.globalAlpha = 1;
      if (b.kind === 'shard') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(0, -b.radius * 1.6);
        ctx.lineTo(b.radius * 0.8, 0);
        ctx.lineTo(0, b.radius * 1.6);
        ctx.lineTo(-b.radius * 0.8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.45, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}