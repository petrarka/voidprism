// VOIDPRISM — bootstrap: size the canvas, build the game, run the frame loop.
// Shot mode (?shot=title|play|shop|boss|over) stages a deterministic scene and
// raises window.__shotReady once it has settled, for the screenshot harness.

import { Game } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const statusEl = document.getElementById('status');

function fit() {
  canvas.width = Math.max(320, window.innerWidth);
  canvas.height = Math.max(240, window.innerHeight);
}
fit();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seedParam = params.get('seed');
const seed = seedParam !== null && seedParam !== '' ? (parseInt(seedParam, 10) >>> 0) : undefined;

const game = new Game(canvas, { shot, seed });
window.__game = game;

window.addEventListener('resize', () => {
  fit();
  game.resize(canvas.width, canvas.height);
});

const announce = (msg) => { if (statusEl) statusEl.textContent = msg; };
announce('VOIDPRISM ready.');

let last = performance.now();
let frames = 0;

function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.05) dt = 0.05;

  game.update(dt);
  game.render(ctx);

  frames++;
  if (game.shotMode && frames >= 40) window.__shotReady = true;

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// If the tab was loaded without a shot, a click/keypress unlocks WebAudio.
window.addEventListener('pointerdown', () => game.audio.init(), { once: true });
window.addEventListener('keydown', () => game.audio.init(), { once: true });