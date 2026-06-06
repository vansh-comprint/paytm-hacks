# Galla — Backend (Dev B)

The brain: Sarvam voice pipeline → intent router → ledger → EOD → actions.
Node + Express, in-memory store seeded from `/seed`. Runs on `:8000`, CORS open to `:5173`.
Contract = [`/contract/contract.md`](../contract/contract.md). Product = [`AGENTS.md`](../AGENTS.md), [`VISION.md`](../VISION.md).

## Run
```bash
cd backend
npm install
cp .env.example .env      # paste the Sarvam key (already filled if you have the team .env)

npm run smoke             # 1) prove the key — TTS->STT->LLM — should print ALL GREEN ✅
npm start                 # 2) boot the brain on :8000
```
Open <http://localhost:8000/dev/dev.html> for a backend-only tester (type, mic, quick buttons, collections).

## Pipeline (`POST /turn`)
1. **STT** — if `audioBase64` → Sarvam Saaras (`saaras:v2.5`), accepts the browser's `webm/opus` directly. Else `text` is the transcript.
2. **Route** — one Sarvam-LLM call (`sarvam-30b`) → `Intent` JSON. Prompt injects the contacts + items lists and normalizes Hindi number words (`pachaas`→50). `src/router.js`.
3. **Apply** — `src/ledger.js` mutates the store: `log_sale` / `log_udhaar` (→ a `collect` todo) / `log_miss` (→ a `restock` todo) / `mark_done`, or answers a `query`.
4. **TTS** — Sarvam Bulbul (`bulbul:v3`, voice `priya`), **Hindi**, **only for queries** → `reply_audio_url`. Logging is text-confirm only (save TTS for the wow moments).

## EOD (the hero)
`GET /state.eod` = voice-logged cash + seeded UPI day reconciled → `{ total, cash, upi, sale_count, busiest_hours, top_items, misses }`. The spoken Hindi tally is composed in `src/eod.js`.

## Quick curls
```bash
curl -s localhost:8000/turn -H 'Content-Type: application/json' -d '{"mode":"text","text":"Paytm, pachaas cash Maggi"}' | jq '.intent,.reply_text'
curl -s localhost:8000/turn -H 'Content-Type: application/json' -d '{"mode":"text","text":"aaj ka hisaab"}'        | jq '.reply_text,.reply_audio_url'
curl -s localhost:8000/state | jq .eod
curl -s localhost:8000/collect/confirm -H 'Content-Type: application/json' -d '{"udhaar_id":"udh_1"}' | jq '.message.body'
```

## Real WhatsApp (upgrade, after core is green)
Set `WHATSAPP_MODE=openwa` in `.env`. Uses the already-installed OpenWA gateway (`~/OpenWA`, `:2785`) — start it, link a spare number (scan QR), put a real test number on a seed contact, `POST /reset`. `/collect/confirm` then really sends *and* still returns the card (mock fallback on any error). `src/whatsapp.js`.

## Layout
```
src/config.js    env + model choices        src/eod.js      EOD reconciliation + spoken Hindi
src/sarvam.js    STT/LLM/TTS clients        src/payment.js  mock Paytm link + UPI deep link
src/router.js    intent router + prompt     src/whatsapp.js mock card | OpenWA real send
src/hindi.js     Hindi number fallback      src/server.js   Express endpoints (the contract)
src/ledger.js    apply intent -> store      src/smoke.js    Sarvam key round-trip
src/store.js     in-memory store + seed loader
```

## Models (verified live 2026-06-06)
STT `saaras:v2.5` · LLM `sarvam-30b` (or `-105b`) · TTS `bulbul:v3` voice `priya`. Auth header `api-subscription-key`.
**AGENTS.md §5's `sarvam-m` is deprecated** — do not use.
