# PLAN.md — Octo (Frontend) working plan

> What I (Octo / Dev A) am building and where it stands, so Deep and the team stay aligned.
> Product = [`VISION.md`](VISION.md) · build split = [`AGENTS.md`](AGENTS.md) · API = [`contract/contract.md`](contract/contract.md).
> **Hero = the spoken EOD true-tally. Protect it above all.**

## Status at a glance

| Area | State |
|---|---|
| Frontend app shell + dashboard | ✅ built (`frontend/`) |
| Text input → `POST /turn` → reply + audio | ✅ wired to Deep's contract |
| Live ledger feed (`/state` on `changed`) | ✅ |
| **EOD board (hero)** — total, cash/UPI split, busiest, top items, walked-out demand | ✅ renders Deep's `Eod` shape |
| Hold-to-talk mic → `POST /turn {mode:"wake"}` (the **floor**) | ✅ mirrors Deep's `dev.html` capture |
| Collections — "Send reminder" → `POST /collect/confirm` → WhatsApp card | ✅ |
| Wake word — openWakeWord in-browser, **fully offline** | ✅ wired w/ `hey_jarvis` stand-in; ⏳ swap to `hey_paytm` after training |
| **"Hey Paytm" custom model** | ⏳ **training in Colab (~1hr)** — `training/hey_paytm_training.ipynb` |

## The wake word — our one deviation from the brief (decided)

`AGENTS.md`/`VISION.md` named **Porcupine**; we chose **openWakeWord** instead. Why: it's **fully
offline, no AccessKey** → can't fail on venue wifi, and the model is genuinely ours. Phrase = **"Hey Paytm"**
(multi-word phrases detect far more reliably than a bare short word).

- Engine runs in the browser via a vendored WASM wrapper (`frontend/src/wakeword/`, MIT). **No fork needed** —
  `modelFiles` is a constructor option, so adding our word is pure config.
- **The manual hold-to-talk mic is the floor** — the demo never depends on the wake word firing.
- Build/test now with bundled `hey_jarvis`; swap in `hey_paytm.onnx` when training finishes (2-line change,
  see `frontend/README.md`).

## What's next (my queue, hero-first)

1. Run the app against Deep's live backend end-to-end; tighten the EOD board visuals (design pass).
2. Polish the spoken-query + EOD flow (the wow moments).
3. Swap in `hey_paytm.onnx` once trained; tune `detectionThreshold` on real mic.
4. Mark-done UX for to-dos (currently best-effort via a text turn — may need a small contract addition; will ping Deep).
5. Ambient toggle *only if* core is green (per cut order).

## 🧑‍💻 What YOU / the team need to do

1. **Start the "Hey Paytm" training now** (the ~1hr long pole — I can't run Colab in your Google account):
   upload `training/hey_paytm_training.ipynb` to Colab → T4 GPU → *Run all* → download
   `my_custom_model/hey_paytm.onnx` and hand it to me. Steps: `training/README.md`.
2. **Deep:** keep the **contract (`contract/types.ts`)** as the source of truth — I'm coding against your shapes
   (`Eod.busiest_hours` = string, `top_items` = `{name,count}[]`, ISO-string timestamps, nullable `reply_audio_url`).
   Ping me before changing it.
3. Decide if **mark-done** for to-dos should get its own endpoint or stay a voice/text `mark_done` intent.

## Cut order (unchanged from AGENTS.md §0)
calling agents → ambient → procurement to-do → real WhatsApp (keep mock) → **wake word (keep the manual button)**.
Never sacrifice: **logging + EOD tally + one spoken query.**

## Sync points
- **Contract:** shared, change only by mutual agreement (we already collided once on `types.ts` — Deep's is canonical).
- Octo owns `frontend/**` + `training/**`; Deep owns `backend/**` + `seed/**`. Clean split = we rarely touch the same file.
