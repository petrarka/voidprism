// VOIDPRISM — tuning constants, colours, enemy roster and upgrade cards.
// Everything the game balances lives here so the other modules stay about behaviour.

export const COLORS = {
  bg0: '#05060f',
  bg1: '#0a0d1e',
  grid: '#141a33',
  cyan: '#36e6ff',
  magenta: '#ff3ea5',
  violet: '#a06bff',
  green: '#7bf59a',
  yellow: '#ffd23f',
  orange: '#ff9f43',
  red: '#ff5470',
  white: '#eaf6ff',
  dim: '#5a6b96',
};

export const CFG = {
  player: {
    speed: 305,
    accel: 2600,
    friction: 9,
    radius: 13, // hitbox, deliberately smaller than the drawn sprite
    drawRadius: 18,
    maxHull: 100,
    fireInterval: 1 / 7,
    bulletSpeed: 660,
    bulletDamage: 13,
    bulletRadius: 4,
    spread: 0.10,
    dashSpeed: 980,
    dashTime: 0.15,
    dashCooldown: 1.05,
    dashCharges: 1,
    bombs: 3,
    magnet: 62,
    invulnAfterHit: 1.0,
    orbitals: 0,
    orbitalRadius: 58,
    orbitalDamage: 14,
    orbitalSpin: 2.6,
  },
  combo: {
    max: 8,
    perKill: 3, // kills needed per multiplier step
    decay: 2.2, // kills lost per second
    window: 100, // soft cap on the meter
  },
  enemyContact: 0.6, // seconds of contact grace per enemy touch
  bombDamage: 260,
  bombRadius: 9999,
  scorePerWave: 120,
  maxParticles: 900,
};

// Each enemy: hp, speed, contact damage, radius, colour, glyph, points, and a short
// description used in the title screen's bestiary.
export const ENEMY_TYPES = {
  chaser: {
    name: 'CHASER',
    hp: 30, speed: 96, radius: 15, contact: 14, color: COLORS.red,
    glyph: 'tri', points: 10, desc: 'telegraphs, then lunges',
  },
  weaver: {
    name: 'WEAVER',
    hp: 20, speed: 152, radius: 13, contact: 10, color: COLORS.violet,
    glyph: 'diamond', points: 9, desc: 'sine-weaves toward you',
  },
  splitter: {
    name: 'SPLITTER',
    hp: 48, speed: 74, radius: 19, contact: 15, color: COLORS.green,
    glyph: 'hex', points: 16, desc: 'bursts into three minis',
  },
  orbiter: {
    name: 'ORBITER',
    hp: 28, speed: 120, radius: 14, contact: 11, color: COLORS.cyan,
    glyph: 'pent', points: 13, desc: 'circles and fires aimed shots',
  },
  tank: {
    name: 'TANK',
    hp: 140, speed: 44, radius: 26, contact: 24, color: COLORS.yellow,
    glyph: 'octo', points: 32, desc: 'slow, heavy, high hull',
  },
  swarmer: {
    name: 'SWARMER',
    hp: 7, speed: 215, radius: 8, contact: 6, color: COLORS.orange,
    glyph: 'circle', points: 3, desc: 'fast, tiny, arrives in packs',
  },
  mini: {
    name: 'MINI',
    hp: 5, speed: 245, radius: 6, contact: 5, color: COLORS.green,
    glyph: 'tri', points: 2, desc: 'splitter spawn',
  },
};

// Spawn tables per wave. `groups` is a list of {type, count} that the director
// releases from the arena edges over the wave.
export function waveSpawns(wave) {
  const groups = [];
  const add = (type, count) => count > 0 && groups.push({ type, count });
  const w = wave;
  add('chaser', 3 + Math.floor(w * 1.3));
  if (w >= 2) add('weaver', 1 + Math.floor(w * 0.8));
  if (w >= 3) add('swarmer', 4 + w);
  if (w >= 4) add('splitter', 1 + Math.floor(w / 2));
  if (w >= 6) add('orbiter', 1 + Math.floor(w / 3));
  if (w >= 7) add('tank', Math.floor(w / 5));
  return groups;
}

export function isBossWave(wave) {
  return wave % 5 === 0;
}

export const BOSS_HP = 900; // base; scales with wave in waves.js

// ------------------------------------------------------------------ upgrades

// `icon` is a key the card renderer knows how to draw. `apply` mutates the
// player (and returns an optional message for the floating text).
export const UPGRADES = [
  {
    id: 'split', name: 'SPLIT SHOT', icon: 'split', color: COLORS.cyan,
    desc: '+1 projectile per shot', max: 4,
    apply: (p) => { p.split += 1; },
  },
  {
    id: 'pierce', name: 'PIERCE', icon: 'pierce', color: COLORS.violet,
    desc: 'bullets pierce +1 enemy', max: 3,
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'firerate', name: 'RAPID FIRE', icon: 'rate', color: COLORS.yellow,
    desc: '+22% fire rate', max: 5,
    apply: (p) => { p.fireInterval *= 0.82; },
  },
  {
    id: 'velocity', name: 'HYPERVELOCITY', icon: 'speed', color: COLORS.cyan,
    desc: '+20% bullet speed, +15% damage', max: 4,
    apply: (p) => { p.bulletSpeed *= 1.2; p.bulletDamage *= 1.15; },
  },
  {
    id: 'dash', name: 'EXTRA DASH', icon: 'dash', color: COLORS.orange,
    desc: '+1 dash charge', max: 3,
    apply: (p) => { p.dashMax += 1; p.dashCharges += 1; },
  },
  {
    id: 'orbital', name: 'ORBITAL SHARD', icon: 'orbital', color: COLORS.magenta,
    desc: '+1 orbiting damage shard', max: 4,
    apply: (p) => { p.orbitalCount += 1; },
  },
  {
    id: 'bomb', name: 'EXTRA BOMB', icon: 'bomb', color: COLORS.red,
    desc: '+1 bomb (max +2 held)', max: 6,
    apply: (p) => { p.bombs += 1; p.maxBombs += 1; },
  },
  {
    id: 'repair', name: 'HULL PATCH', icon: 'repair', color: COLORS.green,
    desc: 'repair 40 hull, +10 max', max: 99,
    apply: (p) => { p.maxHull += 10; p.hull = Math.min(p.maxHull, p.hull + 40); },
  },
  {
    id: 'magnet', name: 'MAGNET', icon: 'magnet', color: COLORS.violet,
    desc: '+70 pickup radius', max: 3,
    apply: (p) => { p.magnet += 70; },
  },
  {
    id: 'combo', name: 'SLOW DECAY', icon: 'combo', color: COLORS.yellow,
    desc: 'combo decays 30% slower', max: 4,
    apply: (p) => { p.comboDecayMul *= 0.7; },
  },
  {
    id: 'damage', name: 'OVERCHARGE', icon: 'damage', color: COLORS.red,
    desc: '+25% bullet damage', max: 5,
    apply: (p) => { p.bulletDamage *= 1.25; },
  },
  {
    id: 'thrust', name: 'THRUSTERS', icon: 'thrust', color: COLORS.orange,
    desc: '+12% move speed', max: 4,
    apply: (p) => { p.speed *= 1.12; },
  },
];