// VOIDPRISM — the game state machine: title → playing → upgrade → (boss) → gameover.
// Owns every system, resolves collisions, and stages the deterministic shot scenes.

import { CFG, COLORS } from './config.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Particles, glowSprite } from './particles.js';
import { Player } from './player.js';
import { Bullets } from './bullets.js';
import { Enemies } from './enemies.js';
import { Boss } from './boss.js';
import { WaveDirector, Pickups } from './waves.js';
import { rollUpgrades, applyUpgrade, drawUpgradeCard } from './upgrades.js';
import { drawHUD, formatScore } from './hud.js';
import { drawTitle, drawGameOver, drawPause, drawMuteButton } from './screens.js';
import { mulberry32, clamp, dist, TAU } from './utils.js';

const STORE_KEY = 'voidprism_best_v1';

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.shot = opts.shot || null;
    this.shotMode = !!this.shot;
    this.rng = mulberry32((opts.seed ?? 0x9e3779b9) >>> 0);

    this.input = new Input(canvas);
    this.audio = new Audio();
    this.particles = new Particles(this.rng);
    this.bullets = new Bullets();
    this.enemies = new Enemies(this.rng);
    this.boss = new Boss();
    this.player = new Player();
    this.waves = new WaveDirector(this);
    this.pickups = new Pickups(this);

    this.state = 'title';
    this.time = 0;
    this.paused = false;
    this.muted = false;

    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 1;
    this.wave = 0;
    this.newBest = false;

    this.announceTimer = 0;
    this.announceText = '';
    this.announceSub = '';
    this.announceBoss = false;

    this.upgradeChoices = [];
    this.hoverCard = -1;
    this.cardRects = [];

    this.bossDeath = 0;
    this._cascadeTick = 0;

    this.bestScore = 0;
    this.bestWave = 0;
    this._loadBest();

    this.stars = [];
    this._makeStars();

    if (this.shotMode) this.stageShot(this.shot);
  }

  get comboMult() {
    return clamp(1 + Math.floor(this.combo / 3), 1, CFG.combo.max);
  }

  // ------------------------------------------------------------- persistence
  _loadBest() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        this.bestScore = v.score || 0;
        this.bestWave = v.wave || 0;
      }
    } catch { /* storage may be unavailable */ }
  }

  _saveBest() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ score: this.bestScore, wave: this.bestWave }));
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------- background
  _makeStars() {
    this.stars.length = 0;
    const n = 120;
    for (let i = 0; i < n; i++) {
      this.stars.push({
        x: this.rng() * this.width,
        y: this.rng() * this.height,
        r: 0.4 + this.rng() * 1.6,
        p: this.rng() * TAU,
        s: 0.5 + this.rng() * 1.5,
      });
    }
  }

  resize(w, h) {
    const oldW = this.width, oldH = this.height;
    this.width = w; this.height = h;
    if (oldW > 0 && oldH > 0) {
      this.player.x = clamp((this.player.x / oldW) * w, 22, w - 22);
      this.player.y = clamp((this.player.y / oldH) * h, 22, h - 22);
    }
    this._makeStars();
  }

  // ------------------------------------------------------------- run control
  startRun() {
    this.audio.init();
    this.audio.startMusic();
    this.player.reset(this.width, this.height);
    this.player.upgradeLevels = {};
    this.bullets.player.clear();
    this.bullets.enemy.clear();
    this.enemies.clear();
    this.boss.clear();
    this.pickups.clear();
    this.particles.list.clear();
    this.particles.popups.clear();
    this.particles.shake = 0;
    this.particles.flash = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 1;
    this.wave = 1;
    this.time = 0;
    this.paused = false;
    this.newBest = false;
    this.bossDeath = 0;
    this.state = 'playing';
    this.waves.startWave(this.wave);
  }

  onWaveCleared() {
    this.bullets.enemy.clear();
    const bonus = CFG.scorePerWave * this.wave;
    this.score += bonus;
    this.combo = Math.max(this.combo, 3);
    this.particles.popup(this.width / 2, this.height * 0.42, 'WAVE CLEAR  +' + bonus, COLORS.green, 22);
    this.audio.pickup();
    this.upgradeChoices = rollUpgrades(this.player, this.rng, 3);
    this.hoverCard = -1;
    this.state = 'upgrade';
  }

  chooseUpgrade(i) {
    const up = this.upgradeChoices[i];
    if (!up) return;
    applyUpgrade(this.player, up);
    this.audio.pickup();
    this.particles.ring(this.player.x, this.player.y, up.color, 10, 0.5);
    this.upgradeChoices = [];
    this.wave++;
    this.waves.startWave(this.wave);
    this.state = 'playing';
  }

  detonateBomb() {
    if (this.bullets.enemy.active > 0) this.bullets.enemy.clear();
    this.audio.bomb();
    this.particles.addFlash(0.85, COLORS.cyan);
    this.particles.addShake(20);
    this.particles.ring(this.player.x, this.player.y, COLORS.cyan, 20, 0.6);
    this.particles.ring(this.player.x, this.player.y, '#ffffff', 30, 0.5);
    // Damage everything on screen.
    const L = this.enemies.list;
    for (let i = L.active - 1; i >= 0; i--) {
      this._damageEnemy(L.items[i], i, CFG.bombDamage, true);
    }
    if (this.boss.active && this.bossDeath <= 0) {
      this.boss.takeDamage(CFG.bombDamage, this);
    }
    this.particles.burst(this.player.x, this.player.y, COLORS.cyan, 40, 520, 4, 0.8);
  }

  announceWave(n, boss) {
    this.announceText = boss ? 'WARDEN INBOUND' : 'WAVE ' + String(n).padStart(2, '0');
    this.announceSub = boss ? 'BREAK THE CORE' : enemySummary(n);
    this.announceBoss = boss;
    this.announceTimer = 1.9;
  }

  // ------------------------------------------------------------- combat
  _damageEnemy(e, index, amount, silent) {
    e.hp -= amount;
    e.hitFlash = 1;
    if (!silent) {
      this.particles.hit(e.x, e.y, e.color, 4);
      if (Math.random() < 0.5) this.audio.hit();
    }
    if (e.hp <= 0) this._killEnemy(e, index);
  }

  _killEnemy(e, index) {
    this.combo += 1;
    const mult = this.comboMult;
    if (mult > this.maxCombo) this.maxCombo = mult;
    const gain = Math.round(e.points * mult);
    this.score += gain;
    this.kills++;
    this.particles.popup(e.x, e.y - 8, '+' + gain, e.color, e.points >= 16 ? 18 : 14);
    this.particles.explode(e.x, e.y, e.color, e.type === 'tank');
    this.audio.explode();
    this.pickups.maybeDrop(e.x, e.y);
    // Splitter bursts into minis.
    if (e.type === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + this.rng();
        this.enemies.spawn('mini', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, 1);
      }
    }
    this.enemies.list.remove(index);
  }

  _bossDefeated() {
    this.score += 500 + this.wave * 40;
    this.particles.popup(this.width / 2, this.height * 0.35, 'WARDEN DESTROYED', COLORS.magenta, 26);
    this.bossDeath = 1.4;
    this._cascadeTick = 0;
    this.audio.bigExplode();
    this.particles.addShake(26);
    this.particles.addFlash(0.7, COLORS.magenta);
    this.bullets.enemy.clear();
  }

  gameOver() {
    this.state = 'gameover';
    this.newBest = this.score > this.bestScore;
    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.wave > this.bestWave) this.bestWave = this.wave;
    this._saveBest();
    this.particles.explode(this.player.x, this.player.y, COLORS.cyan, true);
    this.particles.addShake(24);
    this.audio.bigExplode();
    this.audio.stopMusic();
  }

  _collisions(dt) {
    const p = this.player;
    const b = this.bullets;

    // Player bullets vs enemies and boss.
    for (let i = b.player.active - 1; i >= 0; i--) {
      const bullet = b.player.items[i];
      const ei = this.enemies.hitTest(bullet.x, bullet.y, bullet.radius);
      if (ei >= 0) {
        const e = this.enemies.list.items[ei];
        if (bullet.hitId !== e.id) {
          bullet.hitId = e.id;
          this._damageEnemy(e, ei, bullet.damage, false);
          if (bullet.pierce > 0) bullet.pierce--;
          else { b.player.remove(i); continue; }
        }
      }
      if (this.boss.active && this.bossDeath <= 0) {
        const rr = this.boss.radius + bullet.radius;
        const dx = bullet.x - this.boss.x, dy = bullet.y - this.boss.y;
        if (dx * dx + dy * dy <= rr * rr && bullet.hitId !== -2) {
          bullet.hitId = -2;
          if (this.boss.takeDamage(bullet.damage, this)) this._bossDefeated();
          if (bullet.pierce > 0) bullet.pierce--;
          else { b.player.remove(i); continue; }
        }
      }
    }

    // Enemy bullets vs player.
    for (let i = b.enemy.active - 1; i >= 0; i--) {
      const bullet = b.enemy.items[i];
      const rr = bullet.radius + p.radius;
      const dx = bullet.x - p.x, dy = bullet.y - p.y;
      if (dx * dx + dy * dy <= rr * rr) {
        p.takeDamage(bullet.damage, this);
        b.enemy.remove(i);
      }
    }

    // Enemy contact vs player.
    const L = this.enemies.list;
    for (let i = 0; i < L.active; i++) {
      const e = L.items[i];
      const rr = e.radius + p.radius;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rr * rr) {
        p.takeDamage(e.contact, this);
        const d = Math.sqrt(d2) || 1;
        e.x -= (dx / d) * 8;
        e.y -= (dy / d) * 8;
      }
    }
    if (this.boss.active && this.bossDeath <= 0) {
      const rr = this.boss.radius + p.radius;
      const dx = p.x - this.boss.x, dy = p.y - this.boss.y;
      if (dx * dx + dy * dy <= rr * rr) p.takeDamage(this.boss.contact, this);
    }

    // Orbitals vs enemies / boss.
    if (p.orbitalCount > 0) {
      const orbs = p.orbitals();
      for (let oi = 0; oi < p._orbCount; oi++) {
        const o = orbs[oi];
        const oi = this.enemies.hitTest(o.x, o.y, 10);
        if (oi >= 0) this._damageEnemy(this.enemies.list.items[oi], oi, CFG.player.orbitalDamage * dt * 6, true);
        if (this.boss.active && this.bossDeath <= 0) {
          const rr = this.boss.radius + 10;
          const dx = o.x - this.boss.x, dy = o.y - this.boss.y;
          if (dx * dx + dy * dy <= rr * rr) this.boss.takeDamage(CFG.player.orbitalDamage * dt * 6, this);
        }
      }
    }
  }

  // ------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    this.audio.update();

    // Global keys.
    if (this.input.wasPressed('KeyM')) this._toggleMute();
    this._checkMuteButton();

    if (this.shotMode) { this._updateShot(dt); this.input.endFrame(); return; }

    switch (this.state) {
      case 'title':
        this.particles.update(dt);
        if (this.input.wasPressed('Enter', 'Space', 'KeyR') || this.input.mousePressed.left) {
          this.audio.init();
          this.startRun();
        }
        break;
      case 'playing':
        this._updatePlaying(dt);
        break;
      case 'upgrade':
        this.particles.update(dt);
        this._updateUpgrade();
        break;
      case 'gameover':
        this.particles.update(dt);
        if (this.input.wasPressed('KeyR', 'Enter', 'Space') || this.input.mousePressed.left) {
          this.audio.init();
          this.startRun();
        }
        break;
    }
    this.input.endFrame();
  }

  _updatePlaying(dt) {
    if (this.input.wasPressed('KeyP', 'Escape')) { this.paused = !this.paused; this.audio.ui(); }
    if (this.paused) { this.input.endFrame(); return; }

    this.announceTimer = Math.max(0, this.announceTimer - dt);
    this.combo = Math.max(0, this.combo - CFG.combo.decay * this.player.comboDecayMul * dt);

    this.player.update(dt, this);
    this.bullets.update(dt, this.width, this.height);
    this.enemies.update(dt, this);

    if (this.bossDeath > 0) {
      this.bossDeath -= dt;
      this._cascadeTick -= dt;
      if (this._cascadeTick <= 0) {
        this._cascadeTick = 0.08;
        const a = this.rng() * TAU, rr = this.rng() * this.boss.radius;
        this.particles.explode(this.boss.x + Math.cos(a) * rr, this.boss.y + Math.sin(a) * rr, COLORS.magenta, this.rng() < 0.4);
      }
      if (this.bossDeath <= 0) this.boss.clear();
    } else if (this.boss.active) {
      this.boss.update(dt, this);
    }

    this._collisions(dt);
    this.pickups.update(dt, this.player);
    this.particles.update(dt);
    this.waves.update(dt);

    if (this.player.hull <= 0 && this.state === 'playing') this.gameOver();
  }

  _updateUpgrade() {
    // Hover detection over cards.
    const m = this.input.mouse;
    let hover = -1;
    for (let i = 0; i < this.cardRects.length; i++) {
      const r = this.cardRects[i];
      if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) hover = i;
    }
    this.hoverCard = hover;
    if (this.input.mousePressed.left && hover >= 0) { this.chooseUpgrade(hover); return; }
    if (this.input.wasPressed('Digit1')) this.chooseUpgrade(0);
    else if (this.input.wasPressed('Digit2')) this.chooseUpgrade(1);
    else if (this.input.wasPressed('Digit3')) this.chooseUpgrade(2);
  }

  _toggleMute() {
    this.audio.init();
    this.muted = this.audio.toggleMute();
    if (!this.muted) this.audio.ui();
  }

  _checkMuteButton() {
    const r = { x: this.width - 56, y: this.height - 54, w: 44, h: 40 };
    const m = this.input.mouse;
    if (this.input.mousePressed.left && m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
      this._toggleMute();
    }
  }

  // ------------------------------------------------------------- render
  render(ctx) {
    const w = this.width, h = this.height;
    this._drawBackground(ctx);

    ctx.save();
    const sh = this.particles.shake;
    if (sh > 0.2) {
      ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    }

    this.pickups.render(ctx);
    this.enemies.render(ctx);
    if (this.boss.active || this.bossDeath > 0) this.boss.render(ctx, this);
    this.bullets.render(ctx);
    if (this.player.alive && this.state !== 'title') this.player.render(ctx, this);
    this.particles.render(ctx);

    ctx.restore();

    this.particles.renderFlash(ctx, w, h);

    if (this.state === 'playing' || this.state === 'upgrade') {
      drawHUD(ctx, this);
    }
    if (this.state === 'playing' && this.player.alive) this._drawReticle(ctx);

    if (this.state === 'title') drawTitle(ctx, this);
    else if (this.state === 'gameover') drawGameOver(ctx, this);
    else if (this.state === 'upgrade') this._drawUpgrade(ctx);
    if (this.paused && this.state === 'playing') drawPause(ctx, this);

    drawMuteButton(ctx, this);
  }

  _drawReticle(ctx) {
    const m = this.input.mouse;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 9, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m.x - 14, m.y); ctx.lineTo(m.x - 5, m.y);
    ctx.moveTo(m.x + 5, m.y); ctx.lineTo(m.x + 14, m.y);
    ctx.moveTo(m.x, m.y - 14); ctx.lineTo(m.x, m.y - 5);
    ctx.moveTo(m.x, m.y + 5); ctx.lineTo(m.x, m.y + 14);
    ctx.stroke();
    ctx.restore();
  }

  _drawBackground(ctx) {
    const w = this.width, h = this.height;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, COLORS.bg0);
    g.addColorStop(0.55, COLORS.bg1);
    g.addColorStop(1, '#070913');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Nebula glows (a few big soft blobs, additive).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const blobs = [
      [w * 0.18, h * 0.25, COLORS.violet, 0.15],
      [w * 0.82, h * 0.30, COLORS.magenta, 0.13],
      [w * 0.55, h * 0.82, COLORS.cyan, 0.12],
    ];
    for (const [x, y, c, a] of blobs) {
      const gs = Math.max(w, h) * 0.9;
      ctx.globalAlpha = a;
      ctx.drawImage(glowSprite(c), x - gs / 2, y - gs / 2, gs, gs);
    }
    ctx.restore();

    // Grid.
    ctx.save();
    ctx.strokeStyle = 'rgba(40,60,110,0.16)';
    ctx.lineWidth = 1;
    const step = 64;
    const ox = (this.time * 8) % step;
    ctx.beginPath();
    for (let x = -ox; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.restore();

    // Stars.
    ctx.save();
    for (const s of this.stars) {
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.time * s.s + s.p));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillStyle = '#cfe3ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.restore();

    // Vignette.
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  _cardLayout() {
    const w = this.width;
    const n = 3;
    const cardW = Math.min(272, (w - 200) / n);
    const cardH = 272;
    const gap = 26;
    const total = cardW * n + gap * (n - 1);
    const startX = (w - total) / 2;
    const y = this.height / 2 - cardH / 2 + 10;
    const rects = [];
    for (let i = 0; i < n; i++) rects.push({ x: startX + i * (cardW + gap), y, w: cardW, h: cardH });
    return rects;
  }

  _drawUpgrade(ctx) {
    const w = this.width, h = this.height;
    ctx.save();
    ctx.fillStyle = 'rgba(3,4,10,0.50)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 14px ui-monospace, Menlo, monospace';
    ctx.fillStyle = COLORS.green;
    ctx.fillText(`WAVE ${String(this.wave).padStart(2, '0')} CLEARED`, w / 2, h * 0.20);
    ctx.font = '900 40px "Arial Black", Impact, system-ui, sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 24;
    ctx.fillText('CHOOSE AN UPGRADE', w / 2, h * 0.20 + 48);
    ctx.shadowBlur = 0;

    this.cardRects = this._cardLayout();
    for (let i = 0; i < this.upgradeChoices.length && i < 3; i++) {
      const up = this.upgradeChoices[i];
      up._level = (this.player.upgradeLevels && this.player.upgradeLevels[up.id]) || 0;
      const r = this.cardRects[i];
      drawUpgradeCard(ctx, r.x, r.y, r.w, r.h, up, i, this.hoverCard === i, this.time);
    }
    ctx.font = '600 14px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(170,190,225,0.8)';
    ctx.fillText('click a card  ·  or press 1 / 2 / 3', w / 2, h * 0.20 + 90);
    ctx.restore();
  }

  // ------------------------------------------------------------- shot staging
  stageShot(shot) {
    this.shot = shot;
    this.shotMode = true;
    this.time = 0;
    if (shot === 'title') this._stageTitle();
    else if (shot === 'play') this._stagePlay();
    else if (shot === 'shop') this._stageShop();
    else if (shot === 'boss') this._stageBoss();
    else if (shot === 'over') this._stageOver();
  }

  _stageTitle() {
    this.state = 'title';
    this.bestScore = Math.max(this.bestScore, 48250);
    this.bestWave = Math.max(this.bestWave, 14);
  }

  _seedPlayer(x, y, aim) {
    const p = this.player;
    p.reset(this.width, this.height);
    p.x = x; p.y = y; p.aim = aim;
    p.upgradeLevels = {};
    return p;
  }

  _stagePlay() {
    this.state = 'playing';
    this.wave = 4;
    this.score = 18420;
    this.kills = 87;
    this.combo = 15;
    this.maxCombo = 6;
    this.boss.clear();
    this.bullets.player.clear();
    this.bullets.enemy.clear();
    this.enemies.clear();
    this.pickups.clear();
    this.particles.list.clear();
    this.particles.popups.clear();

    const p = this._seedPlayer(this.width * 0.40, this.height * 0.56, -0.18);
    p.dashTimer = 0.4;
    p.iframe = 1;
    p.dashMax = 2;
    p.dashCharges = 1;
    p.dashRecharge = p.dashCd * 0.45;
    p.dashDirX = 1; p.dashDirY = -0.2;
    p.vx = 1; p.vy = -0.2;
    p.hull = p.maxHull * 0.72;

    const rng = this.rng;
    const types = ['chaser', 'weaver', 'splitter', 'orbiter', 'tank', 'swarmer'];
    const placed = [];
    let guard = 0;
    while (placed.length < 25 && guard++ < 800) {
      const x = 70 + rng() * (this.width - 140);
      const y = 70 + rng() * (this.height - 150);
      if (dist(x, y, p.x, p.y) < 150) continue;
      let ok = true;
      for (const q of placed) if (dist(x, y, q.x, q.y) < 46) { ok = false; break; }
      if (!ok) continue;
      const type = types[Math.floor(rng() * types.length)];
      const e = this.enemies.spawn(type, x, y, 1.15);
      e.rot = rng() * TAU;
      e.timer = 0.3 + rng() * 2;
      placed.push({ x, y });
      if (rng() < 0.35) this.particles.burst(x, y, e.color, 5, 130, 2, 0.5);
    }
    // Freeze a couple of chasers mid-telegraph so the wind-up reads.
    let telegraphed = 0;
    for (let i = 0; i < this.enemies.list.active && telegraphed < 2; i++) {
      const e = this.enemies.list.items[i];
      if (e.type === 'chaser') { e.state = 'wind'; e.timer = 0.22; telegraphed++; }
    }

    // Player bullets in flight.
    for (let i = 0; i < 7; i++) {
      const a = p.aim + (rng() - 0.5) * 0.5;
      const d = 40 + i * 46 + rng() * 20;
      const sp = 660;
      this.bullets.spawnPlayer(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp, 1.2, 13, 0, 4, COLORS.cyan);
    }

    // Enemy bullets.
    for (let i = 0; i < 12; i++) {
      const e = placed[Math.floor(rng() * placed.length)];
      const a = Math.atan2(p.y - e.y, p.x - e.x) + (rng() - 0.5) * 1.2;
      const sp = 130 + rng() * 120;
      this.bullets.spawnEnemy(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, 3, 5, 10, rng() < 0.4 ? COLORS.magenta : COLORS.cyan, 'orb');
    }

    // A pickup and some explosion particles.
    this.pickups.list.spawn(p.x + 170, p.y - 90, 'bomb');
    this.pickups.list.spawn(p.x - 210, p.y + 70, 'repair');
    this.particles.explode(this.width * 0.68, this.height * 0.32, COLORS.orange, false);
    this.particles.explode(this.width * 0.80, this.height * 0.66, COLORS.green, false);
    this.announceTimer = 0;
  }

  _stageShop() {
    this.state = 'upgrade';
    this.wave = 4;
    this.score = 22110;
    this.combo = 9;
    this.maxCombo = 5;
    this.boss.clear();
    this.bullets.player.clear();
    this.bullets.enemy.clear();
    this.enemies.clear();
    this.pickups.clear();
    this.particles.list.clear();

    const p = this._seedPlayer(this.width * 0.30, this.height * 0.62, -0.6);
    p.hull = p.maxHull * 0.8;
    p.orbitalCount = 1;
    // a couple of drifting enemies behind the dim
    this.enemies.spawn('chaser', this.width * 0.78, this.height * 0.28, 1);
    this.enemies.spawn('weaver', this.width * 0.86, this.height * 0.7, 1);
    for (let i = 0; i < 6; i++) {
      const a = this.rng() * TAU;
      this.bullets.spawnEnemy(this.width * 0.7, this.height * 0.5, Math.cos(a) * 60, Math.sin(a) * 60, 4, 5, 10, COLORS.magenta, 'orb');
    }
    this.upgradeChoices = rollUpgrades(this.player, this.rng, 3);
    this.hoverCard = 1;
    this.cardRects = this._cardLayout();
    this.announceTimer = 0;
  }

  _stageBoss() {
    this.state = 'playing';
    this.wave = 5;
    this.score = 30750;
    this.kills = 140;
    this.combo = 18;
    this.maxCombo = 7;
    this.bullets.player.clear();
    this.bullets.enemy.clear();
    this.enemies.clear();
    this.pickups.clear();
    this.particles.list.clear();
    this.particles.popups.clear();

    const p = this._seedPlayer(this.width * 0.5, this.height * 0.82, -Math.PI / 2);
    p.hull = p.maxHull * 0.6;
    p.dashTimer = 0;

    this.boss.spawn(this.width * 0.5, this.height * 0.28, 620);
    this.boss.mode = 'spiral';
    this.boss.modeTimer = 5;
    this.boss.spiralAngle = 0.4;
    // Pre-seed a spiral of bullets so the pattern is visible immediately.
    for (let arm = 0; arm < 5; arm++) {
      for (let i = 1; i <= 11; i++) {
        const a = arm * (TAU / 5) + i * 0.24 + 0.4;
        const rr = i * 26;
        const sp = 40;
        this.bullets.spawnEnemy(
          this.boss.x + Math.cos(a) * rr, this.boss.y + Math.sin(a) * rr,
          Math.cos(a) * sp, Math.sin(a) * sp, 4, 5, 11, COLORS.magenta, 'orb',
        );
      }
    }
    // A few aimed shots and explosions.
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (this.rng() - 0.5) * 1.4;
      this.bullets.spawnEnemy(this.boss.x, this.boss.y + 40, Math.cos(a) * 120, Math.sin(a) * 120, 3, 6, 12, COLORS.magenta, 'orb');
    }
    this.particles.explode(this.width * 0.30, this.height * 0.34, COLORS.magenta, false);
    this.particles.explode(this.width * 0.70, this.height * 0.45, COLORS.orange, false);
    this.particles.addShake(6);
    this.announceTimer = 0;
  }

  _stageOver() {
    this.state = 'gameover';
    this.score = 48750;
    this.wave = 14;
    this.kills = 512;
    this.maxCombo = 8;
    this.bestScore = Math.max(48750, 61200);
    this.bestWave = Math.max(14, 18);
    this.newBest = true;
    this.player.alive = false;
    this.enemies.clear();
    this.bullets.player.clear();
    this.bullets.enemy.clear();
    this.pickups.clear();
    this.boss.clear();
    this.particles.list.clear();
    this.particles.burst(this.width * 0.5, this.height * 0.55, COLORS.cyan, 30, 260, 3, 0.9);
  }

  _updateShot(dt) {
    // Advance only visuals so the staged frame settles nicely.
    this.particles.update(dt);
    if (this.state === 'playing') {
      if (this.shot === 'boss' && this.boss.active) {
        this.boss.rot += 0.5 * dt;
        this.boss.spiralAngle += 0.9 * dt;
        this.boss._spiralTick = (this.boss._spiralTick || 0) - dt;
        if (this.boss._spiralTick <= 0) {
          this.boss._spiralTick = 0.12;
          for (let k = 0; k < 2; k++) {
            const a = this.boss.spiralAngle + k * Math.PI;
            this.bullets.spawnEnemy(this.boss.x, this.boss.y, Math.cos(a) * 170, Math.sin(a) * 170, 3, 5, 11, COLORS.magenta, 'orb');
          }
        }
        this.bullets.update(dt, this.width, this.height);
      } else if (this.shot === 'play') {
        // Keep the ship streaking so the dash trail reads clearly.
        const p = this.player;
        p.dashTimer = 0.4;
        p.iframe = 1;
        p.x = clamp(p.x + 210 * dt, 60, this.width - 60);
        p.y = clamp(p.y - 40 * dt, 60, this.height - 60);
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) { p.trailTimer = 0.012; this.particles.dashTrail(p.x, p.y, COLORS.cyan); }
        this.bullets.update(dt, this.width, this.height);
        // slow enemy rotation for life
        for (let i = 0; i < this.enemies.list.active; i++) {
          const e = this.enemies.list.items[i];
          e.rot += e.spin * dt * 0.4;
          e.t += dt;
        }
      } else {
        this.bullets.update(dt, this.width, this.height);
      }
    } else if (this.state === 'upgrade') {
      for (let i = 0; i < this.enemies.list.active; i++) this.enemies.list.items[i].rot += 0.4 * dt;
    } else if (this.state === 'title') {
      this._makeStarsIfEmpty();
    }
  }

  _makeStarsIfEmpty() {
    if (this.stars.length === 0) this._makeStars();
  }
}

function enemySummary(wave) {
  const bits = [];
  if (wave >= 3) bits.push('SWARMS');
  if (wave >= 4) bits.push('SPLITTERS');
  if (wave >= 6) bits.push('ORBITERS');
  if (wave >= 7) bits.push('TANKS');
  bits.push('CHASERS');
  return bits.slice(0, 3).join(' · ');
}