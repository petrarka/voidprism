// VOIDPRISM — upgrade card rolling, effects and the card/icon renderer.

import { UPGRADES, COLORS } from './config.js';
import { TAU } from './utils.js';

/** Pick `count` distinct, not-yet-maxed upgrades for the player. */
export function rollUpgrades(player, rng, count = 3) {
  const levels = player.upgradeLevels || (player.upgradeLevels = {});
  const pool = UPGRADES.filter((u) => (levels[u.id] || 0) < u.max);
  const picks = [];
  const copy = pool.slice();
  for (let i = 0; i < count && copy.length > 0; i++) {
    const k = Math.floor(rng() * copy.length);
    picks.push(copy[k]);
    copy.splice(k, 1);
  }
  return picks;
}

export function applyUpgrade(player, up) {
  if (!player.upgradeLevels) player.upgradeLevels = {};
  player.upgradeLevels[up.id] = (player.upgradeLevels[up.id] || 0) + 1;
  up.apply(player);
}

export function drawUpgradeCard(ctx, x, y, w, h, up, index, hovered, t) {
  const r = 16;
  ctx.save();

  // Soft coloured halo so the cards pop off the dimmed arena.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x + w / 2, y + 64, 10, x + w / 2, y + 64, w * 0.85);
  halo.addColorStop(0, hexA(up.color, hovered ? 0.28 : 0.16));
  halo.addColorStop(1, hexA(up.color, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - 40, y - 40, w + 80, h + 80);
  ctx.restore();

  // Card body.
  roundRect(ctx, x, y, w, h, r);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, hovered ? 'rgba(30,42,82,0.99)' : 'rgba(18,26,52,0.97)');
  grad.addColorStop(1, 'rgba(8,12,26,0.99)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Coloured edge that brightens on hover.
  ctx.lineWidth = hovered ? 3.2 : 1.8;
  ctx.strokeStyle = up.color;
  ctx.globalAlpha = hovered ? 1 : 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Top accent bar.
  ctx.fillStyle = up.color;
  ctx.globalAlpha = hovered ? 1 : 0.65;
  ctx.fillRect(x + r, y, w - r * 2, 4);
  ctx.globalAlpha = 1;

  // Icon medallion.
  const cx = x + w / 2;
  const icy = y + 68;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ig = ctx.createRadialGradient(cx, icy, 2, cx, icy, 42);
  ig.addColorStop(0, hexA(up.color, 0.5));
  ig.addColorStop(1, hexA(up.color, 0));
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(cx, icy, 42, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, icy, 33, 0, TAU);
  ctx.fillStyle = 'rgba(4,6,14,0.85)';
  ctx.fill();
  ctx.strokeStyle = up.color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawIcon(ctx, up.icon, cx, icy, 18, up.color);

  // Index badge.
  ctx.fillStyle = up.color;
  ctx.globalAlpha = hovered ? 1 : 0.8;
  ctx.beginPath();
  ctx.arc(x + 22, y + 22, 12, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#05060f';
  ctx.font = '800 14px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), x + 22, y + 23);

  // Name.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.white;
  ctx.font = '800 21px ui-monospace, Menlo, monospace';
  ctx.fillText(up.name, cx, y + 130);

  // Description (wrap to two lines).
  ctx.fillStyle = 'rgba(205,220,245,0.9)';
  ctx.font = '500 14px ui-monospace, Menlo, monospace';
  wrapText(ctx, up.desc, cx, y + 158, w - 34, 19, 2);

  // Level pips + label.
  const lvl = (up._level || 0);
  const max = up.max;
  if (max < 90) {
    ctx.fillStyle = 'rgba(150,170,210,0.85)';
    ctx.font = '700 12px ui-monospace, Menlo, monospace';
    ctx.fillText(`LV ${lvl} / ${max}`, cx, y + 206);
    const pipW = 12, gap = 5;
    const total = max * pipW + (max - 1) * gap;
    let px = cx - total / 2;
    const py = y + 220;
    for (let i = 0; i < max; i++) {
      ctx.fillStyle = i < lvl ? up.color : 'rgba(255,255,255,0.16)';
      ctx.fillRect(px + i * (pipW + gap), py, pipW, 6);
    }
  } else {
    ctx.fillStyle = up.color;
    ctx.globalAlpha = 0.8;
    ctx.font = '700 12px ui-monospace, Menlo, monospace';
    ctx.fillText('ALWAYS AVAILABLE', cx, y + 214);
    ctx.globalAlpha = 1;
  }

  if (hovered) {
    ctx.fillStyle = up.color;
    ctx.globalAlpha = 0.95;
    ctx.font = '800 13px ui-monospace, Menlo, monospace';
    ctx.fillText('SELECT', cx, y + h - 18);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function hexA(hex, a) {
  if (hex[0] !== '#' || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function drawIcon(ctx, icon, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (icon) {
    case 'split':
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, i * s * 0.55);
        ctx.lineTo(s * 0.7, i * s * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.2, i * s * 0.55 - 3);
        ctx.lineTo(s * 0.7, i * s * 0.55);
        ctx.lineTo(s * 0.2, i * s * 0.55 + 3);
        ctx.stroke();
      }
      break;
    case 'pierce':
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.5); ctx.lineTo(s, 0); ctx.lineTo(s * 0.3, s * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(-s * 0.2, 0, s * 0.55, 0, TAU); ctx.stroke();
      break;
    case 'rate':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.8 + i * s * 0.5, -s * 0.6);
        ctx.lineTo(-s * 0.4 + i * s * 0.5, 0);
        ctx.lineTo(-s * 0.8 + i * s * 0.5, s * 0.6);
        ctx.stroke();
      }
      break;
    case 'speed':
      ctx.beginPath(); ctx.moveTo(-s, -s * 0.5); ctx.lineTo(s * 0.2, -s * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s * 0.7, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.lineTo(s * 0.2, s * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.3); ctx.lineTo(s * 0.7, 0); ctx.lineTo(s * 0.1, s * 0.3); ctx.stroke();
      break;
    case 'dash':
      ctx.beginPath(); ctx.moveTo(-s, -s * 0.6); ctx.lineTo(s * 0.2, 0); ctx.lineTo(-s, s * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.6); ctx.lineTo(s, 0); ctx.lineTo(-s * 0.1, s * 0.6); ctx.stroke();
      break;
    case 'orbital':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, TAU); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(s * 0.9, 0, s * 0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-s * 0.9, 0, s * 0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, TAU); ctx.fill();
      break;
    case 'bomb':
      ctx.beginPath(); ctx.arc(0, s * 0.2, s * 0.7, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.3, -s); ctx.stroke();
      ctx.beginPath(); ctx.arc(s * 0.35, -s, s * 0.15, 0, TAU); ctx.fill();
      break;
    case 'repair':
      ctx.fillRect(-s * 0.18, -s * 0.8, s * 0.36, s * 1.6);
      ctx.fillRect(-s * 0.8, -s * 0.18, s * 1.6, s * 0.36);
      break;
    case 'magnet':
      ctx.lineWidth = s * 0.42;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.7, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.7, 0); ctx.lineTo(-s * 0.7, s * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.7, 0); ctx.lineTo(s * 0.7, s * 0.7); ctx.stroke();
      break;
    case 'combo':
      ctx.font = `800 ${s * 1.3}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('x', -s * 0.35, 0);
      ctx.fillText('8', s * 0.45, 0);
      break;
    case 'damage':
      ctx.beginPath();
      ctx.moveTo(s * 0.15, -s); ctx.lineTo(-s * 0.5, s * 0.15);
      ctx.lineTo(-s * 0.02, s * 0.15); ctx.lineTo(-s * 0.2, s);
      ctx.lineTo(s * 0.55, -s * 0.2); ctx.lineTo(s * 0.05, -s * 0.2);
      ctx.closePath(); ctx.fill();
      break;
    case 'thrust':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s * 0.6 + i * s * 0.6);
        ctx.lineTo(s * 0.2, -s * 0.3 + i * s * 0.6);
        ctx.lineTo(-s * 0.6, 0 + i * s * 0.6);
        ctx.stroke();
      }
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.stroke();
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

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      line = words[i];
      lines++;
      if (lines >= maxLines - 1) {
        // last allowed line: append remainder truncated
        let rest = line;
        for (let j = i + 1; j < words.length; j++) rest += ' ' + words[j];
        while (ctx.measureText(rest).width > maxW && rest.length > 0) rest = rest.slice(0, -1);
        ctx.fillText(rest, x, y + lines * lineH);
        return;
      }
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y + lines * lineH);
}