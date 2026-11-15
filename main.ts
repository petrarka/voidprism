// VOIDPRISM entry program (Node 22+, standard library only).
//
// The submission is this directory's game/ folder: a plain static browser game
// (game/index.html plus its ES modules) that runs offline with no build step and
// no network access. This program packages the entry for the make.fun grader:
// it copies game/ and screenshots/ next to this file into MAKEFUN_OUTPUT_DIR
// (default /output) and writes dossier.json there through the vendored
// make.fun library, using the same option object the kit starter passes.
//
// It is deterministic: the same tree in, the same dossier bytes out, because the
// dossier is built only from file contents and hashes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory so a stale tree can never leak into the dossier.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// These are the scorer's own caps. Only text_max_bytes shapes the JSON; the rest
// mirror the gate so an entry the scorer would reject is refused here first.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const dossier = buildDossier(out, caps);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);