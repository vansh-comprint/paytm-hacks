// Copies the onnxruntime-web wasm runtime out of node_modules into
// public/openwakeword/ort/ so the wake-word engine runs FULLY OFFLINE (no CDN).
// Runs automatically via "postinstall"; also: `npm run copy-ort`.
// These files are large + gitignored — each clone repopulates them from its own node_modules.

import { mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'node_modules', 'onnxruntime-web', 'dist');
const dest = join(here, '..', 'public', 'openwakeword', 'ort');

if (!existsSync(src)) {
  console.warn('[copy-ort] onnxruntime-web not installed yet — skipping (run after npm install).');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });

// The wasm execution provider (executionProviders: ['wasm']) needs the simd-threaded build.
// We copy both the unified jsep build and the plain build (+ their .mjs glue) to be safe.
const wanted = [
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
];

const available = new Set(readdirSync(src));
let copied = 0;
for (const f of wanted) {
  if (available.has(f)) {
    copyFileSync(join(src, f), join(dest, f));
    copied++;
  }
}
console.log(`[copy-ort] copied ${copied}/${wanted.length} ORT runtime files -> public/openwakeword/ort/`);
