// VOIDPRISM — the in-game HUD: score, wave, combo, hull, bombs and dash pips.
// Always drawn on top of the action, in screen space.

import { COLORS } from './config.js';
import { clamp, TAU } from './utils.js';

const MONO = 'ui-monospace, Menlo, Consolas, monospace';

export function drawHUD(ctx, game) {
  const w = game.width, h = game.height;
  const p = game.player;

  ctx.save();
  ctx.textBaseline = 'top';

  // ---- top left: wave
  ctx.textAlign = 'left';
  ctx.font = `800 15px ${MONO}`;
  ctx.fillStyle = 'rgba(120,140,180,0.9)';
  ctx.fillText('WAVE', 24, 20);
  ctx.font = `800 30px ${MONO}`;
  ctx.fillStyle = COLORS.white;
  const waveStr = String(game.wave).padStart(2, '0');
  ctx.fillText(waveStr, 24, 36);

  // ---- top center: score + combo
  ctx.textAlign = 'center';
  ctx.font = `700 13px ${MONO}`;
  ctx.fillStyle = 'rgba(120,140,180,0.9)';
  ctx.fillText('SCORE', w / 2, 16);
  ctx.font = `800 34px ${MONO}`;
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText(formatScore(game.score), w / 2, 30);

  // combo multiplier under the score
  const mult = game.comboMult;
  if (mult > 1) {
    const t = clamp((game.combo - (mult - 1) * 3) / 3, 0, 1);
    const scale = 1 + 0.12 * Math.sin(game.time * 12);
    ctx.save();
    ctx.translate(w / 2, 78);
    ctx.scale(scale, scale);
    ctx.font = `900 22px ${MONO}`;
    const hue = multColor(mult);
    ctx.fillStyle = hue;
    ctx.fillText('x' + mult, 0, 0);
    ctx.restore();
    // decay meter
    const mw = 90;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(w / 2 - mw / 2, 88, mw, 4);
    ctx.fillStyle = multColor(mult);
    ctx.fillRect(w / 2 - mw / 2, 88, mw * t, 4);
  }

  // ---- top right: best
  ctx.textAlign = 'right';
  ctx.font = `700 13px ${MONO}`;
  ctx.fillStyle = 'rgba(120,140,180,0.9)';
  ctx.fillText('BEST', w - 24, 20);
  ctx.font = `800 20px ${MONO}`;
  ctx.fillStyle = 'rgba(230,240,255,0.9)';
  ctx.fillText(formatScore(Math.max(game.bestScore, game.score)), w - 24, 38);
  if (game.muted) {
    ctx.font = `700 12px ${MONO}`;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('MUTED (M)', w - 24, 64);
  }

  // ---- bottom left: hull + bombs + dash
  const bx = 24;
  const by = h - 54;
  ctx.textAlign = 'left';
  ctx.font = `800 13px ${MONO}`;
  ctx.fillStyle = 'rgba(120,140,180,0.9)';
  ctx.fillText('HULL', bx, by - 18);

  const barW = 210, barH = 14;
  const frac = clamp(p.hull / p.maxHull, 0, 1);
  // segmented hull bar
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const x = bx + (i / segs) * barW;
    const sw = barW / segs - 2;
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(x, by, sw, barH);
    const segFrac = clamp(frac * segs - i, 0, 1);
    if (segFrac > 0) {
      ctx.fillStyle = frac > 0.35 ? COLORS.green : COLORS.red;
      ctx.fillRect(x, by, sw * segFrac, barH);
    }
  }
  ctx.strokeStyle = 'rgba(123,245,154,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - 1, by - 1, barW + 1, barH + 1);
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = 'rgba(230,240,255,0.8)';
  ctx.fillText(Math.ceil(p.hull) + '/' + Math.round(p.maxHull), bx + barW + 10, by + 1);

  // bombs row
  const iy = by + 26;
  ctx.font = `800 12px ${MONO}`;
  ctx.fillStyle = 'rgba(120,140,180,0.9)';
  ctx.fillText('BOMBS', bx, iy + 3);
  for (let i = 0; i < p.bombs; i++) {
    drawBombIcon(ctx, bx + 62 + i * 20, iy + 9, COLORS.yellow);
  }
  ctx.fillStyle = 'rgba(120,140,180,0.55)';
  ctx.font = `700 11px ${MONO}`;
  ctx.fillText('[Q]', bx + 62 + p.bombs * 20 + 4, iy + 3);

  // dash charges
  const dx0 = bx + 190;
  ctx.font = `800 12px ${MONO}`;
  ctx.fillStyle = 'rgba(120,140,180,0.9)';
  ctx.fillText('DASH', dx0, iy + 3);
  for (let i = 0; i < p.dashMax; i++) {
    const cx = dx0 + 50 + i * 18;
    const cy = iy + 9;
    const filled = i < p.dashCharges;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    if (filled) {
      ctx.fillStyle = COLORS.orange;
      ctx.fillRect(-5, -5, 10, 10);
    } else {
      ctx.strokeStyle = 'rgba(255,159,67,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-5, -5, 10, 10);
    }
    ctx.restore();
    // recharge sweep on the next empty pip
    if (!filled && i === p.dashCharges && p.dashRecharge > 0) {
      const prog = 1 - p.dashRecharge / p.dashCd;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 2);
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU * prog);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- wave announce banner
  if (game.announceTimer > 0) {
    const a = clamp(game.announceTimer, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `900 40px ${MONO}`;
    ctx.fillStyle = game.announceBoss ? COLORS.magenta : COLORS.white;
    ctx.fillText(game.announceText, w / 2, h * 0.30);
    ctx.font = `700 15px ${MONO}`;
    ctx.fillStyle = 'rgba(200,215,240,0.8)';
    ctx.fillText(game.announceSub, w / 2, h * 0.30 + 50);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawBombIcon(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y + 2, 6, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 1.5, y - 8, 3, 5);
  ctx.beginPath();
  ctx.arc(x + 1, y - 8, 1.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function multColor(m) {
  if (m >= 7) return COLORS.red;
  if (m >= 5) return COLORS.magenta;
  if (m >= 3) return COLORS.violet;
  return COLORS.cyan;
}

export function formatScore(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}