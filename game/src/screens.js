// VOIDPRISM — title screen, game-over screen, pause overlay and the mute button.

import { COLORS, ENEMY_TYPES } from './config.js';
import { TAU, clamp } from './utils.js';
import { drawEnemy } from './enemies.js';
import { formatScore } from './hud.js';

const MONO = 'ui-monospace, Menlo, Consolas, monospace';
const DISPLAY = '"Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif';

export function drawTitle(ctx, game) {
  const w = game.width, h = game.height;
  const t = game.time;
  const cx = w / 2;

  ctx.save();
  ctx.textAlign = 'center';

  // ---- logo
  const logoY = h * 0.20;
  ctx.save();
  ctx.translate(cx, logoY);
  const scale = 1 + 0.015 * Math.sin(t * 2.2);
  ctx.scale(scale, scale);
  // glow behind
  ctx.shadowColor = COLORS.magenta;
  ctx.shadowBlur = 40;
  const grad = ctx.createLinearGradient(-260, 0, 260, 0);
  grad.addColorStop(0, COLORS.cyan);
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(1, COLORS.magenta);
  ctx.fillStyle = grad;
  ctx.font = `900 92px ${DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.fillText('VOIDPRISM', 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();

  // subtitle
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 18px ${MONO}`;
  ctx.fillStyle = 'rgba(150,170,210,0.9)';
  ctx.letterSpacing = '8px';
  ctx.fillText('NEON ARENA SURVIVOR', cx, logoY + 74);
  ctx.letterSpacing = '0px';

  // ---- control panel
  const panelW = Math.min(720, w * 0.7);
  const panelX = cx - panelW / 2;
  const panelY = logoY + 112;
  const panelH = 214;
  roundRect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fillStyle = 'rgba(8,12,26,0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(54,230,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `800 14px ${MONO}`;
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText('CONTROLS', panelX + 28, panelY + 28);

  const controls = [
    ['WASD / ARROWS', 'MOVE'],
    ['MOUSE', 'AIM'],
    ['HOLD LMB / SPACE', 'FIRE'],
    ['SHIFT / RMB', 'DASH'],
    ['Q / MMB', 'BOMB'],
    ['M', 'MUTE'],
    ['P / ESC', 'PAUSE'],
    ['R', 'RESTART'],
  ];
  const colX = [panelX + 28, panelX + panelW / 2 + 10];
  const rowY = panelY + 62;
  for (let i = 0; i < controls.length; i++) {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const x = colX[col];
    const y = rowY + row * 34;
    ctx.font = `800 14px ${MONO}`;
    ctx.fillStyle = COLORS.white;
    ctx.fillText(controls[i][0], x, y);
    ctx.font = `600 13px ${MONO}`;
    ctx.fillStyle = 'rgba(150,170,210,0.85)';
    ctx.fillText(controls[i][1], x + 190, y);
  }

  // ---- bestiary strip
  const keys = ['chaser', 'weaver', 'splitter', 'orbiter', 'tank', 'swarmer'];
  const stripY = panelY + panelH + 34;
  const gap = Math.min(120, (w - 120) / keys.length);
  const startX = cx - (gap * (keys.length - 1)) / 2;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const ex = startX + i * gap;
    ctx.save();
    ctx.translate(ex, stripY);
    const fake = {
      x: 0, y: 0, radius: 15, color: ENEMY_TYPES[k].color, glyph: ENEMY_TYPES[k].glyph,
      rot: t * 0.6 + i, hitFlash: 0, state: 'seek', t: t + i, type: k, hp: 1, maxhp: 1,
    };
    drawEnemy(ctx, fake);
    ctx.restore();
    ctx.font = `700 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(160,180,215,0.8)';
    ctx.fillText(ENEMY_TYPES[k].name, ex, stripY + 34);
  }

  // ---- high scores
  ctx.textAlign = 'center';
  ctx.font = `700 14px ${MONO}`;
  ctx.fillStyle = 'rgba(150,170,210,0.85)';
  ctx.fillText(`BEST SCORE  ${formatScore(game.bestScore)}      BEST WAVE  ${game.bestWave}`, cx, h - 96);

  // ---- press start
  const pulse = 0.55 + 0.45 * Math.sin(t * 4);
  ctx.globalAlpha = pulse;
  ctx.font = `900 22px ${MONO}`;
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText('CLICK OR PRESS ENTER TO START', cx, h - 54);
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function drawGameOver(ctx, game) {
  const w = game.width, h = game.height;
  const t = game.time;
  const cx = w / 2;

  // dim the frozen arena
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,10,0.62)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Title
  ctx.save();
  ctx.translate(cx, h * 0.25);
  ctx.shadowColor = COLORS.red;
  ctx.shadowBlur = 54;
  ctx.fillStyle = COLORS.red;
  ctx.font = `900 92px ${DISPLAY}`;
  ctx.letterSpacing = '4px';
  ctx.fillText('GAME OVER', 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
  ctx.letterSpacing = '0px';

  if (game.newBest) {
    const a = 0.6 + 0.4 * Math.sin(t * 6);
    ctx.globalAlpha = a;
    ctx.font = `900 21px ${MONO}`;
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText('★ NEW HIGH SCORE ★', cx, h * 0.25 + 46);
    ctx.globalAlpha = 1;
  }

  // Stats panel
  const panelW = Math.min(600, w * 0.72);
  const panelH = 246;
  const px = cx - panelW / 2;
  const py = h * 0.385;
  roundRect(ctx, px, py, panelW, panelH, 18);
  const pg = ctx.createLinearGradient(px, py, px, py + panelH);
  pg.addColorStop(0, 'rgba(18,24,48,0.94)');
  pg.addColorStop(1, 'rgba(8,11,24,0.95)');
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,62,165,0.65)';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // top accent
  ctx.fillStyle = COLORS.magenta;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(px + 18, py, panelW - 36, 3);
  ctx.globalAlpha = 1;

  const rows = [
    ['FINAL SCORE', formatScore(game.score), COLORS.cyan],
    ['WAVE REACHED', String(game.wave), COLORS.white],
    ['BEST SCORE', formatScore(Math.max(game.bestScore, game.score)), COLORS.yellow],
    ['BEST WAVE', String(Math.max(game.bestWave, game.wave)), COLORS.white],
    ['KILLS', String(game.kills), COLORS.white],
    ['MAX COMBO', 'x' + game.maxCombo, COLORS.magenta],
  ];
  const rowH = 36;
  const startY = py + 46;
  for (let i = 0; i < rows.length; i++) {
    const y = startY + i * rowH;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(120,140,190,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 28, y - 22);
      ctx.lineTo(px + panelW - 28, y - 22);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.font = `700 15px ${MONO}`;
    ctx.fillStyle = 'rgba(190,205,235,0.92)';
    ctx.fillText(rows[i][0], px + 36, y);
    ctx.textAlign = 'right';
    ctx.font = `800 21px ${MONO}`;
    ctx.fillStyle = rows[i][2];
    ctx.fillText(rows[i][1], px + panelW - 36, y);
  }

  // Restart prompt
  const pulse = 0.55 + 0.45 * Math.sin(t * 4);
  ctx.globalAlpha = pulse;
  ctx.textAlign = 'center';
  ctx.font = `900 25px ${MONO}`;
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText('PRESS R TO RESTART', cx, h - 54);
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function drawPause(ctx, game) {
  const w = game.width, h = game.height;
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,10,0.66)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = `900 64px ${DISPLAY}`;
  ctx.fillStyle = COLORS.white;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 30;
  ctx.fillText('PAUSED', w / 2, h / 2 - 20);
  ctx.shadowBlur = 0;
  ctx.font = `700 16px ${MONO}`;
  ctx.fillStyle = 'rgba(180,200,235,0.9)';
  ctx.fillText('P / ESC to resume     ·     M to mute', w / 2, h / 2 + 30);
  ctx.restore();
}

export function drawMuteButton(ctx, game) {
  const x = game.width - 34;
  const y = game.height - 32;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = game.muted ? COLORS.red : 'rgba(200,215,240,0.8)';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2;
  // speaker
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 4);
  ctx.lineTo(x - 5, y - 4);
  ctx.lineTo(x + 1, y - 10);
  ctx.lineTo(x + 1, y + 10);
  ctx.lineTo(x - 5, y + 4);
  ctx.lineTo(x - 10, y + 4);
  ctx.closePath();
  ctx.fill();
  // waves or cross
  if (game.muted) {
    ctx.beginPath();
    ctx.moveTo(x + 5, y - 5); ctx.lineTo(x + 13, y + 5);
    ctx.moveTo(x + 13, y - 5); ctx.lineTo(x + 5, y + 5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x + 2, y, 7, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 2, y, 12, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}