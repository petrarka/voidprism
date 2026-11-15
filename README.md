[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/petrarka/voidprism/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/petrarka/voidprism/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# VOIDPRISM

A neon twin-stick arena survivor for the make.fun **best-game-01** bounty. You are a
glass prism in a collapsing neon grid; geometric things want you dead. Survive escalating
waves, draft an upgrade after every wave, and break a boss every fifth wave.

Everything is drawn procedurally on a single `<canvas>` and every sound is synthesised at
runtime with WebAudio. There are no frameworks, no packages, no build step and no network
calls: open `game/index.html` through any static server and it runs.

## Play

```bash
node serve.ts
# open http://localhost:8080
```

## Controls

| Action | Keyboard / Mouse |
| --- | --- |
| Move | `WASD` or arrow keys |
| Aim | mouse |
| Fire | hold **left mouse** or `Space` |
| Dash (i-frames) | `Shift` or **right mouse** |
| Bomb (clears bullets) | `Q` or **middle mouse** |
| Mute | `M` |
| Pause | `P` or `Esc` |
| Restart (on game over) | `R` |

Dash has charges that refill on a cooldown, and grants brief invulnerability. Bombs clear
every enemy bullet and damage everything on screen. Kills build a combo multiplier up to
**x8**; it decays if you stop killing. Pickups drop rarely: bombs and hull repairs.

## Files

- `game/index.html` — canvas shell, loads `game/src/main.js` as an ES module.
- `game/src/config.js` — tuning constants, palette, enemy roster, upgrade cards.
- `game/src/utils.js` — vector/geometry helpers, seeded RNG, object pool.
- `game/src/input.js` — keyboard and mouse state.
- `game/src/audio.js` — WebAudio synth SFX and a pulsing bassline.
- `game/src/particles.js` — particles, score popups, screen shake, glow sprites.
- `game/src/player.js` — movement, dash, hull, firing, bombs, orbitals.
- `game/src/bullets.js` — pooled player and enemy bullets.
- `game/src/enemies.js` — the six enemy types and their behaviours.
- `game/src/boss.js` — the Warden: patterns and health bar.
- `game/src/waves.js` — spawn director and pickups.
- `game/src/upgrades.js` — upgrade cards and their effects.
- `game/src/hud.js` — in-game HUD.
- `game/src/screens.js` — title, game-over, pause and mute button.
- `game/src/game.js` — state machine, collisions and the render loop.
- `game/src/main.js` — bootstrap and frame loop.
- `main.ts` — entry program: copies the game and screenshots, writes `dossier.json`.
- `serve.ts` — tiny static server for local play.

## Build the entry

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/game/`, `out/screenshots/` and `out/dossier.json`.

## Screenshot / shot mode

Append `?shot=title`, `?shot=play`, `?shot=shop`, `?shot=boss` or `?shot=over` to the URL
to stage a deterministic scene, then wait for `window.__shotReady`. Optional `&seed=1`
fixes the RNG. These are the same URLs the four entry screenshots were taken from.

## License

MIT — see [LICENSE](LICENSE).