// Galla backend — the contract surface (AGENTS.md §3). Express on :8000, CORS open to :5173.
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, requireKey } from './config.js';
import { store, loadSeed, nextId } from './store.js';
import { route, emptyIntent } from './router.js';
import { applyIntent } from './ledger.js';
import { computeEod } from './eod.js';
import { sendCollection } from './whatsapp.js';
import * as sarvam from './sarvam.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.resolve(__dirname, '../audio');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

requireKey();
loadSeed();

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // audioBase64 can be ~MBs
app.use('/audio', express.static(AUDIO_DIR));
app.use('/dev', express.static(PUBLIC_DIR));

// POST /turn  { mode, text?, audioBase64? } -> { transcript, intent, reply_text, reply_audio_url?, changed }
app.post('/turn', async (req, res) => {
  try {
    const { mode = 'text', text, audioBase64 } = req.body || {};

    let transcript = (text || '').trim();
    if (audioBase64) {
      const buf = Buffer.from(String(audioBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (buf.length) transcript = (await sarvam.stt(buf)).transcript;
    }
    if (!transcript) {
      return res.json({ transcript: '', intent: emptyIntent(), reply_text: 'Kuch sunai nahi diya.', reply_audio_url: null, changed: false });
    }

    const intent = await route(transcript);
    const result = await applyIntent(intent);

    let reply_audio_url = null;
    if (result.speak && mode !== 'ambient' && result.reply_text) {
      try {
        const wav = await sarvam.tts(result.reply_text);
        if (wav) {
          const name = `${nextId('aud')}.wav`;
          fs.writeFileSync(path.join(AUDIO_DIR, name), wav);
          reply_audio_url = `${req.protocol}://${req.get('host')}/audio/${name}`;
        }
      } catch { /* never block the turn on TTS */ }
    }

    res.json({ transcript, intent, reply_text: result.reply_text, reply_audio_url, changed: !!result.changed });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// GET /state -> { sales, todos, messages, eod }
app.get('/state', (req, res) => {
  res.json({ sales: store.sales, todos: store.todos, messages: store.messages, eod: computeEod() });
});

// POST /collect/confirm { udhaar_id } -> { message }   (udhaar_id = a `collect` todo id)
app.post('/collect/confirm', async (req, res) => {
  const { udhaar_id } = req.body || {};
  const todo = store.todos.find((t) => t.id === udhaar_id && t.kind === 'collect');
  if (!todo) return res.status(404).json({ error: `collect item '${udhaar_id}' not found` });
  const message = await sendCollection(todo);
  todo.reminded = true;
  res.json({ message });
});

// --- dev helpers ---
app.get('/health', (req, res) => res.json({ ok: true, models: config.models, speaker: config.ttsSpeaker, whatsapp: config.whatsappMode }));
app.post('/reset', (req, res) => { loadSeed(); res.json({ ok: true, eod: computeEod() }); });

app.listen(config.port, () => {
  console.log(`Galla backend on http://localhost:${config.port}  (models: ${JSON.stringify(config.models)})`);
});
