# Galla — Frontend (Octo / Dev A)

The browser app judges see + all input capture (text, mic, wake word). React + Vite, runs on `:5173`,
talks to Deep's backend on `:8000`. Contract = [`/contract/contract.md`](../contract/contract.md).

## Run
```bash
cd frontend
npm install        # also runs postinstall → copies ORT wasm into public/openwakeword/ort (offline)
cp .env.example .env   # VITE_API_BASE=http://localhost:8000
npm run dev        # http://localhost:5173
```
Start Deep's backend (`cd backend && npm start`) so `/turn` and `/state` resolve. The header shows
**backend live / offline**.

## What works
- **Text bar** → `POST /turn {mode:"text"}` → renders Galla's reply, plays `reply_audio_url` if present.
- **Hold-to-talk mic** (the demo-safe FLOOR) → records (webm/opus) → `POST /turn {mode:"wake", audioBase64}`.
- **Live ledger** + **EOD board** (the hero: total, cash/UPI split, busiest, top items, walked-out demand) — re-fetches `/state` on `changed:true`.
- **Collections** → "Send reminder" → `POST /collect/confirm` → WhatsApp card.
- **Wake word** (toggle, off by default) → openWakeWord in-browser, fully offline.

## Wake word (openWakeWord, no vendor key)
Engine is vendored in `src/wakeword/` (from `dnavarrom/openwakeword_wasm`, MIT). Models in
`public/openwakeword/models/`. It runs **fully offline** — the ORT runtime is self-hosted in
`public/openwakeword/ort/` (gitignored; `npm run copy-ort` / postinstall repopulates from node_modules).

Currently listens for the bundled **`hey_jarvis`** as a stand-in. **To switch to "Hey Paytm":**
1. Drop the trained `hey_paytm.onnx` (from `../training/`) into `public/openwakeword/models/`.
2. In `src/useWakeWord.js`, set `ACTIVE_KEYWORD = 'hey_paytm'`.
That's it — `modelFiles` already maps it; no fork, no other change.

## Layout
```
src/api.js              backend client (/turn, /state, /collect/confirm) + audio helpers
src/useWakeWord.js      openWakeWord engine hook (swap-in point for hey_paytm)
src/wakeword/           vendored WASM engine (WakeWordEngine.js)
src/components/         EodBoard (hero) · LedgerFeed · TodoPanel · CollectionsCard · VoiceBar
src/App.jsx             dashboard + turn/record/playback wiring
public/openwakeword/    models/ (committed) · ort/ (gitignored, auto-copied)
```
