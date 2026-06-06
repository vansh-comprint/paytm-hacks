// Shared audio output helper: write a WAV buffer to /audio and return its served path.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextId } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUDIO_DIR = path.resolve(__dirname, '../audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

// Returns a relative path like "/audio/aud_7.wav". Callers with a request prefix the origin.
export function saveWav(buffer) {
  const name = `${nextId('aud')}.wav`;
  fs.writeFileSync(path.join(AUDIO_DIR, name), buffer);
  return `/audio/${name}`;
}
