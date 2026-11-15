// VOIDPRISM — the boss ("the Warden"): a large shape that cycles radial bursts,
// spirals and charges, with a visible health bar.

import { COLORS } from './config.js';
import { TAU, clamp, angleTo } from './utils.js';
import { glowSprite } from './particles.js';

const PATTERNS = ['radial', 'spiral', 'charge'];

export class Boss {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.hp = 1; this.maxhp = 1; this.radius = 70; this.contact = 30;
    this.t = 0; this.rot = 0; this.hitFlash = 0;
    this.mode = 'radial'; this.modeTimer = 0; this.patternIndex = 0;
    this.attackTimer = 0; this.spiralAngle = 0; this.state = 'idle';
    this.chargeDirX = 0; this.chargeDirY = 0;
    this.name = 'THE WARDEN';
    this.dying = false;
  }

  spawn(x, y, hp) {
    this.active = true;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.maxhp = hp; this.hp = hp;
    this.radius = 70;
    this.t = 0; this.rot = 0; this.hitFlash = 0;
    this.mode = 'radial'; this.patternIndex = 0;
    this.modeTimer = 3.6; this.attackTimer = 0.8; this.spiralAngle = 0;
    this.state = 'idle';
    this.dying = false;
  }

  clear() { this.active = false; }

  get hpFrac() { return clamp(this.hp / this.maxhp, 0, 1); }

  update(dt, game) {
    if (!this.active || this.dying) return;
    this.t += dt;
    this.rot += 0.6 * dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    const p = game.player;

    // Gentle drift toward a point orbiting the arena centre.
    const cx = game.width / 2, cy = game.height / 2;
    const tx = cx + Math.cos(this.t * 0.35) * (game.width * 0.22);
    const ty = cy + Math.sin(this.t * 0.5) * (game.height * 0.2);
    this.vx += (tx - this.x) * 0.6 * dt;
    this.vy += (ty - this.y) * 0.6 * dt;
    this.vx *= 1 - 1.6 * dt;
    this.vy *= 1 - 1.6 * dt;

    if (this.state === 'charge') {
      this.vx = this.chargeDirX * 760;
      this.vy = this.chargeDirY * 760;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Mode cycling.
    this.modeTimer -= dt;
    if (this.modeTimer <= 0) {
      this.patternIndex = (this.patternIndex + 1) % PATTERNS.length;
      this.mode = PATTERNS[this.patternIndex];
      this.modeTimer = this.mode === 'charge' ? 3.0 : 4.0;
      this.attackTimer = this.mode === 'spiral' ? 0 : 0.5;
      this.state = 'idle';
    }

    this.attackTimer -= dt;
    if (this.mode === 'radial') {
      if (this.attackTimer <= 0) {
        this.attackTimer = 1.15;
        this._radial(game, 18, 250, this.rot);
        game.audio.enemyShoot();
      }
    } else if (this.mode === 'spiral') {
      if (this.attackTimer <= 0) {
        this.attackTimer = 0.055;
        this.spiralAngle += 0.42;
        const sp = 230;
        for (let k = 0; k < 2; k++) {
          const a = this.spiralAngle + k * Math.PI;
          game.bullets.spawnEnemy(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp, 4.5, 5, 11, COLORS.magenta, 'orb');
        }
        if (game.rng() < 0.3) game.audio.enemyShoot();
      }
    } else if (this.mode === 'charge') {
      if (this.state === 'idle') {
        this.state = 'wind';
        this.attackTimer = 0.65;
        this.chargeDirX = 0; this.chargeDirY = 0;
      } else if (this.state === 'wind') {
        this.vx *= 0.8; this.vy *= 0.8;
        const a = angleTo(this.x, this.y, p.x, p.y);
        this.chargeDirX = Math.cos(a); this.chargeDirY = Math.sin(a);
        if (this.attackTimer <= 0) {
          this.state = 'charge';
          this.attackTimer = 0.55;
          game.particles.ring(this.x, this.y, COLORS.red, this.radius, 0.4);
          game.audio.dash();
        }
      } else if (this.state === 'charge') {
        if (this.attackTimer <= 0) { this.state = 'idle'; this.attackTimer = 1.2; }
      }
    }

    // Contact damage.
    const rr = this.radius + p.radius;
    const dx = p.x - this.x, dy = p.y - this.y;
    if (dx * dx + dy * dy < rr * rr) p.takeDamage(this.contact, game);
  }

  _radial(game, n, speed, offset) {
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * TAU;
      game.bullets.spawnEnemy(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed, 4, 6, 12, COLORS.magenta, 'orb');
    }
    game.particles.ring(this.x, this.y, COLORS.magenta, this.radius, 0.4);
    game.particles.addShake(5);
  }

  takeDamage(amount, game) {
    this.hp -= amount;
    this.hitFlash = 1;
    game.particles.hit(this.x + (game.rng() - 0.5) * this.radius, this.y + (game.rng() - 0.5) * this.radius, COLORS.white, 3);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = true;
      return true;
    }
    return false;
  }

  render(ctx, game) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Glow.
    ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite(this.hitFlash > 0 ? COLORS.white : COLORS.magenta);
    const gs = this.radius * 5.2;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(g, -gs / 2, -gs / 2, gs, gs);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    const flash = this.hitFlash > 0;
    const stroke = flash ? '#ffffff' : COLORS.magenta;

    // Outer rotating dual polygon.
    ctx.save();
    ctx.rotate(this.rot);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 5;
    ctx.fillStyle = flash ? 'rgba(255,255,255,0.35)' : 'rgba(255,62,165,0.18)';
    polygon(ctx, 6, this.radius);
    ctx.fill(); ctx.stroke();
    ctx.rotate(Math.PI / 6);
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3;
    polygon(ctx, 6, this.radius * 0.74);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Counter-rotating cyan ring for contrast.
    ctx.save();
    ctx.rotate(-this.rot * 1.4);
    ctx.strokeStyle = flash ? '#ffffff' : COLORS.cyan;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    polygon(ctx, 3, this.radius * 1.12);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Charge telegraph.
    if (this.state === 'wind') {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 24, 0, TAU);
      ctx.strokeStyle = COLORS.red;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 40);
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Core.
    const pulse = 1 + 0.08 * Math.sin(this.t * 6);
    ctx.rotate(-this.rot * 1.7);
    ctx.fillStyle = flash ? '#fff' : 'rgba(255,62,165,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.46 * pulse, 0, TAU);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : COLORS.magenta;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.30 * pulse, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.13 * pulse, 0, TAU);
    ctx.fill();

    ctx.restore();

    // Health bar at the top.
    const w = Math.min(620, game.width * 0.6);
    const x = (game.width - w) / 2;
    const y = 26;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 15px ui-monospace, Menlo, monospace';
    ctx.fillStyle = COLORS.magenta;
    ctx.fillText(this.name, game.width / 2, y - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x, y, w, 12);
    ctx.fillStyle = 'rgba(255,62,165,0.25)';
    ctx.fillRect(x, y, w, 12);
    ctx.fillStyle = COLORS.magenta;
    ctx.fillRect(x, y, w * this.hpFrac, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x, y, w * this.hpFrac, 3);
    ctx.strokeStyle = 'rgba(255,62,165,0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, 12);
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