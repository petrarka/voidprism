// VOIDPRISM — the wave director (edge spawns, boss waves) and rare pickups.

import { waveSpawns, isBossWave, BOSS_HP, COLORS } from './config.js';
import { Pool, randRange, TAU, dist2 } from './utils.js';
import { glowSprite } from './particles.js';

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

export class WaveDirector {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.queue = [];
    this.timer = 0;
    this.active = false;
    this.bossWave = false;
    this.bossSpawned = false;
    this.interval = 0.55;
  }

  startWave(n) {
    this.wave = n;
    this.queue.length = 0;
    this.timer = 0.5;
    this.active = true;
    this.bossSpawned = false;
    this.bossWave = isBossWave(n);
    const rng = this.game.rng;
    const scale = 1 + (n - 1) * 0.11;

    if (this.bossWave) {
      const hp = Math.round(BOSS_HP * (1 + (n / 5 - 1) * 0.85));
      this.game.boss.spawn(this.game.width / 2, 120, hp);
      this.bossSpawned = true;
      // A little escort.
      for (let i = 0; i < 3 + Math.floor(n / 5); i++) this.queue.push({ type: 'swarmer' });
      this.interval = 1.2;
    } else {
      const groups = waveSpawns(n);
      const list = [];
      for (const g of groups) for (let i = 0; i < g.count; i++) list.push(g.type);
      shuffle(list, rng);
      // Swarmers arrive in tight clusters, so pull a few together.
      for (const type of list) this.queue.push({ type });
      this.interval = Math.max(0.22, 0.62 - n * 0.02);
    }
    this.scale = scale;
    this.game.announceWave(n, this.bossWave);
  }

  update(dt) {
    if (!this.active) return;
    const game = this.game;

    // Release queued spawns on a timer.
    this.timer -= dt;
    while (this.queue.length > 0 && this.timer <= 0) {
      const item = this.queue.shift();
      this._spawn(item.type);
      this.timer += this.interval;
      // Swarmers burst out together.
      if (item.type === 'swarmer') {
        const extra = Math.min(this.queue.length, 4);
        for (let i = 0; i < extra && this.queue[0] && this.queue[0].type === 'swarmer'; i++) {
          this._spawn(this.queue.shift().type);
        }
      }
    }

    // Clear condition.
    let cleared = false;
    if (this.bossWave) {
      cleared = this.bossSpawned && !game.boss.active;
    } else {
      cleared = this.queue.length === 0 && game.enemies.count === 0;
    }
    if (cleared) {
      this.active = false;
      game.onWaveCleared();
    }
  }

  _spawn(type) {
    const game = this.game;
    const edge = Math.floor(game.rng() * 4);
    const m = 40;
    let x, y;
    if (edge === 0) { x = randRange(game.rng, m, game.width - m); y = -m; }
    else if (edge === 1) { x = game.width + m; y = randRange(game.rng, m, game.height - m); }
    else if (edge === 2) { x = randRange(game.rng, m, game.width - m); y = game.height + m; }
    else { x = -m; y = randRange(game.rng, m, game.height - m); }
    game.enemies.spawn(type, x, y, this.scale);
  }
}

// ------------------------------------------------------------------ pickups

function makePickup() {
  return { x: 0, y: 0, type: 'bomb', life: 0, bob: 0, vx: 0, vy: 0 };
}

function resetPickup(p, x, y, type) {
  p.x = x; p.y = y; p.type = type; p.life = 12; p.bob = Math.random() * TAU;
  p.vx = 0; p.vy = 0;
}

export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = new Pool(makePickup, resetPickup, 20);
    this.spawned = 0;
  }

  clear() { this.list.clear(); }

  maybeDrop(x, y) {
    this.spawned++;
    // Rare: roughly one pickup every ~18 kills, alternating bomb/repair.
    const chance = 0.055;
    if (this.game.rng() < chance) {
      const type = this.spawned % 3 === 0 ? 'repair' : 'bomb';
      this.list.spawn(x, y, type);
    }
  }

  update(dt, player) {
    const L = this.list;
    for (let i = L.active - 1; i >= 0; i--) {
      const p = L.items[i];
      p.life -= dt;
      p.bob += dt * 3;
      if (p.life <= 0) { L.remove(i); continue; }
      const dx = player.x - p.x, dy = player.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < player.magnet) {
        const pull = 520 * (1 - d / player.magnet) + 120;
        p.vx += (dx / d) * pull * dt;
        p.vy += (dy / d) * pull * dt;
      }
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (d < player.radius + 16) {
        this._collect(p, player);
        L.remove(i);
      }
    }
  }

  _collect(p, player) {
    const game = this.game;
    if (p.type === 'bomb') {
      player.bombs = Math.min(player.maxBombs, player.bombs + 1);
      game.particles.popup(p.x, p.y - 10, '+1 BOMB', COLORS.yellow, 15);
      game.particles.pickupBurst(p.x, p.y, COLORS.yellow);
    } else {
      player.heal(28);
      game.particles.popup(p.x, p.y - 10, 'REPAIR', COLORS.green, 15);
      game.particles.pickupBurst(p.x, p.y, COLORS.green);
    }
    game.audio.pickup();
  }

  render(ctx) {
    const L = this.list;
    for (let i = 0; i < L.active; i++) {
      const p = L.items[i];
      const bob = Math.sin(p.bob) * 3;
      const color = p.type === 'bomb' ? COLORS.yellow : COLORS.green;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.globalCompositeOperation = 'lighter';
      const g = glowSprite(color);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(g, -26, -26, 52, 52);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.rotate(Math.sin(p.bob * 0.7) * 0.2);
      ctx.fillStyle = 'rgba(6,8,18,0.9)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      if (p.type === 'bomb') {
        ctx.beginPath();
        ctx.arc(0, 1, 5, 0, TAU);
        ctx.fill();
        ctx.fillRect(-1.5, -9, 3, 5);
      } else {
        ctx.fillRect(-2.5, -7, 5, 14);
        ctx.fillRect(-7, -2.5, 14, 5);
      }
      ctx.restore();
      // Blink when about to expire.
      if (p.life < 3) {
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(p.life * 20);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 16, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}