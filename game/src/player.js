// VOIDPRISM — the player ship: movement, dash, firing, bombs and orbitals.

import { CFG, COLORS } from './config.js';
import { clamp, angleTo, TAU } from './utils.js';
import { glowSprite } from './particles.js';

export class Player {
  constructor() {
    this.reset(800, 600);
  }

  reset(w, h) {
    this.x = w / 2;
    this.y = h / 2;
    this.vx = 0; this.vy = 0;
    this.speed = CFG.player.speed;
    this.radius = CFG.player.radius;
    this.drawRadius = CFG.player.drawRadius;
    this.maxHull = CFG.player.maxHull;
    this.hull = this.maxHull;
    this.fireInterval = CFG.player.fireInterval;
    this.fireTimer = 0;
    this.bulletSpeed = CFG.player.bulletSpeed;
    this.bulletDamage = CFG.player.bulletDamage;
    this.bulletRadius = CFG.player.bulletRadius;
    this.split = 1;
    this.pierce = 0;
    this.dashMax = CFG.player.dashCharges;
    this.dashCharges = this.dashMax;
    this.dashRecharge = 0;
    this.dashCd = CFG.player.dashCooldown;
    this.dashTimer = 0;
    this.dashDirX = 1; this.dashDirY = 0;
    this.iframe = 0;
    this.hurtFlash = 0;
    this.bombs = CFG.player.bombs;
    this.maxBombs = CFG.player.bombs + 2;
    this.magnet = CFG.player.magnet;
    this.orbitalCount = CFG.player.orbitalCount;
    this.orbitalAngle = 0;
    this._orbPoints = [];
    for (let i = 0; i < 8; i++) this._orbPoints.push({ x: 0, y: 0, a: 0 });
    this._orbCount = 0;
    this.comboDecayMul = 1;
    this.aim = 0;
    this.trailTimer = 0;
    this.moving = false;
    this.alive = true;
  }

  get dashing() { return this.dashTimer > 0; }
  get invulnerable() { return this.iframe > 0 || this.dashTimer > 0; }

  update(dt, game) {
    const input = game.input;
    this.iframe = Math.max(0, this.iframe - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);

    // Aim toward the cursor (world coordinates equal canvas coordinates).
    this.aim = angleTo(this.x, this.y, input.mouse.x, input.mouse.y);

    // Dash recharge.
    if (this.dashCharges < this.dashMax) {
      this.dashRecharge -= dt;
      if (this.dashRecharge <= 0) {
        this.dashCharges++;
        this.dashRecharge = this.dashCharges < this.dashMax ? this.dashCd : 0;
        game.audio.ui();
      }
    }

    // Start a dash.
    const wantDash = input.wasPressed('ShiftLeft', 'ShiftRight') || input.mousePressed.right;
    if (wantDash && this.dashCharges > 0 && this.dashTimer <= 0) {
      const mv = input.moveVector();
      let dx = mv.x, dy = mv.y;
      if (dx === 0 && dy === 0) { dx = Math.cos(this.aim); dy = Math.sin(this.aim); }
      const l = Math.hypot(dx, dy) || 1;
      this.dashDirX = dx / l; this.dashDirY = dy / l;
      this.dashTimer = CFG.player.dashTime;
      this.iframe = Math.max(this.iframe, CFG.player.dashTime + 0.05);
      this.dashCharges--;
      if (this.dashRecharge <= 0) this.dashRecharge = this.dashCd;
      game.audio.dash();
      game.particles.ring(this.x, this.y, COLORS.cyan, 8, 0.35);
    }

    // Movement.
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDirX * CFG.player.dashSpeed;
      this.vy = this.dashDirY * CFG.player.dashSpeed;
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.012;
        game.particles.dashTrail(this.x, this.y, COLORS.cyan);
      }
    } else {
      const mv = input.moveVector();
      const tvx = mv.x * this.speed;
      const tvy = mv.y * this.speed;
      const k = 1 - Math.exp(-14 * dt);
      this.vx += (tvx - this.vx) * k;
      this.vy += (tvy - this.vy) * k;
      this.moving = mv.x !== 0 || mv.y !== 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Arena bounds with a soft margin.
    const m = 22;
    const w = game.width, h = game.height;
    if (this.x < m) { this.x = m; this.vx *= -0.2; }
    if (this.x > w - m) { this.x = w - m; this.vx *= -0.2; }
    if (this.y < m) { this.y = m; this.vy *= -0.2; }
    if (this.y > h - m) { this.y = h - m; this.vy *= -0.2; }

    // Firing.
    this.fireTimer -= dt;
    const wantFire = input.mouse.down || input.isDown('Space');
    if (wantFire && this.fireTimer <= 0) {
      this.fire(game);
      this.fireTimer = this.fireInterval;
    }

    // Orbitals.
    if (this.orbitalCount > 0) this.orbitalAngle += CFG.player.orbitalSpin * dt;

    // Bombs.
    if (input.wasPressed('KeyQ') || input.mousePressed.middle) this.useBomb(game);
  }

  fire(game) {
    const n = this.split;
    const spread = CFG.player.spread;
    const baseX = this.x + Math.cos(this.aim) * (this.drawRadius + 4);
    const baseY = this.y + Math.sin(this.aim) * (this.drawRadius + 4);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spread;
      const a = this.aim + off;
      const vx = Math.cos(a) * this.bulletSpeed;
      const vy = Math.sin(a) * this.bulletSpeed;
      game.bullets.spawnPlayer(baseX, baseY, vx, vy, 1.4, this.bulletDamage, this.pierce, this.bulletRadius, COLORS.cyan);
    }
    game.particles.muzzle(baseX, baseY, this.aim, COLORS.cyan);
    game.audio.shoot();
  }

  useBomb(game) {
    if (this.bombs <= 0) {
      game.audio.ui();
      return false;
    }
    this.bombs--;
    game.detonateBomb();
    return true;
  }

  // Fills and returns the reusable orbital buffer; read the live count from
  // this._orbCount so nothing is allocated per frame.
  orbitals() {
    const out = this._orbPoints;
    const n = Math.min(this.orbitalCount, out.length);
    this._orbCount = n;
    const r = CFG.player.orbitalRadius;
    for (let i = 0; i < n; i++) {
      const a = this.orbitalAngle + (i / Math.max(1, this.orbitalCount)) * TAU;
      out[i].x = this.x + Math.cos(a) * r;
      out[i].y = this.y + Math.sin(a) * r;
      out[i].a = a;
    }
    return out;
  }

  takeDamage(amount, game) {
    if (this.invulnerable) return false;
    this.hull -= amount;
    this.iframe = CFG.player.invulnAfterHit;
    this.hurtFlash = 1;
    game.particles.addShake(11);
    game.particles.burst(this.x, this.y, COLORS.red, 14, 220, 2.5, 0.5);
    game.audio.hurt();
    if (this.hull <= 0) {
      this.hull = 0;
      this.alive = false;
    }
    return true;
  }

  heal(amount) {
    this.hull = Math.min(this.maxHull, this.hull + amount);
  }

  render(ctx, game) {
    const blink = this.invulnerable && this.iframe > 0 && Math.floor(this.iframe * 20) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Dash motion streak behind the ship.
    if (this.dashing) {
      const sp = Math.hypot(this.vx, this.vy) || 1;
      const ux = this.vx / sp, uy = this.vy / sp;
      const len = 84;
      const lg = ctx.createLinearGradient(-ux * len, -uy * len, 0, 0);
      lg.addColorStop(0, 'rgba(54,230,255,0)');
      lg.addColorStop(0.6, 'rgba(54,230,255,0.35)');
      lg.addColorStop(1, 'rgba(180,250,255,0.9)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = lg;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-ux * len, -uy * len);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Outer glow.
    ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite(COLORS.cyan);
    const gs = this.dashing ? 70 : 54;
    ctx.globalAlpha = this.dashing ? 1.0 : 0.72;
    ctx.drawImage(g, -gs / 2, -gs / 2, gs, gs);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Orbitals.
    const orbs = this.orbitals();
    for (let oi = 0; oi < this._orbCount; oi++) {
      const o = orbs[oi];
      const ox = o.x - this.x, oy = o.y - this.y;
      ctx.globalCompositeOperation = 'lighter';
      const og = glowSprite(COLORS.magenta);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(og, ox - 16, oy - 16, 32, 32);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(o.a * 2);
      ctx.fillStyle = COLORS.magenta;
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Hull ring (thin arc showing health).
    const frac = this.hull / this.maxHull;
    ctx.rotate(this.aim);
    if (blink) ctx.globalAlpha = 0.35;

    // Ship body: a sharp arrowhead pointing along aim.
    const R = this.drawRadius;
    ctx.beginPath();
    ctx.moveTo(R * 1.25, 0);
    ctx.lineTo(-R * 0.75, R * 0.82);
    ctx.lineTo(-R * 0.35, 0);
    ctx.lineTo(-R * 0.75, -R * 0.82);
    ctx.closePath();
    ctx.fillStyle = this.hurtFlash > 0 ? '#ffffff' : '#0e2740';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = this.hurtFlash > 0 ? '#ffffff' : COLORS.cyan;
    ctx.stroke();

    // Cockpit.
    ctx.beginPath();
    ctx.arc(R * 0.15, 0, R * 0.28, 0, TAU);
    ctx.fillStyle = this.dashing ? '#ffffff' : COLORS.cyan;
    ctx.fill();
    ctx.restore();

    // Health ring around the ship (not rotated).
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.beginPath();
    ctx.arc(0, 0, R + 7, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.strokeStyle = frac > 0.35 ? COLORS.green : COLORS.red;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.restore();
  }
}