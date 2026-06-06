# DEMO.md — Galla: the full run + what the frontend shows

> The complete, current end-to-end demo (AGENTS.md §7 is pre-pivot — **this supersedes it**).
> Every beat below is served by the backend today (`contract/contract.md`). What the UI must render
> per feature is in `FRONTEND_GAPS.md`; this doc is the **story + the screen, beat by beat**.

## Pre-demo checklist
- **Backend** up: `cd backend && npm start` (:8000). Sanity: `npm run smoke` → ALL GREEN.
- **Frontend** up: `cd frontend && npm run dev` (:5173).
- **Real WhatsApp/calls:** OpenWA on :2785 + session linked; in `backend/.env` set `WHATSAPP_MODE=openwa`
  and `DEMO_PHONE=<your watch phone>`. (If skipped → sends become mock cards; still fully demoable.)
- `POST /reset` (or the dev tester's Reset) for a clean start.

## The run — story, command, and what the screen does

| # | You say / tap | Backend | What the frontend shows |
|---|---|---|---|
| 1 | **"Paytm, pachaas cash Maggi"** (×3–4, mix cash + "online") | `/turn` → log_sale | Ledger row drops in; cash/UPI bar + money odometer move |
| 2 | flip **Active-listening**, say **"doodh khatam ho gaya"** | `/turn {mode:ambient}` → log_miss (log-only) | "listening…" indicator; a **restock** row in Loose ends (no talk-back) |
| 3 | tap **"Order from Verma Distributors"** | `/procure/confirm` → WhatsApp + simulated call | order card (mock/Sent); **Calls panel** plays the Hindi 📞 recording |
| 4 | ambient hears **"pachaas rupaye diye"** (in/out unclear) | `/turn {ambient}` → review | **Needs-review** row; tap **In/Out/Ignore** → `/review/resolve` |
| 5 | **"Paytm, aaj ka hisaab"** *(the hero)* | `/turn` → query → Hindi TTS | **Reveal** speaks the true-tally; ₹online vs ₹cash reconciled + **net cash in drawer** |
| 6a | tap **Remind** on Ramesh ₹500 | `/collect/confirm` → real WhatsApp | WhatsApp-sent card with Paytm link; row marks "Reminded" |
| 6b | **"Ramesh ko 1 minute baad yaad dilana"** (or a Schedule button → `/reminders`) | scheduler fires at the time | **Upcoming reminders** strip (countdown → ✓); at fire: WhatsApp + a call recording |
| 7 | **tagline** | — | *"Paytm saw the ₹2,800 online. We just showed them the ₹1,400 cash they were blind to."* |

## Full feature → endpoint → UI element
- **Voice/text logging, 3 modes** → `POST /turn {mode}` → VoiceBar + mode switch (Off · Listen · Talk)
- **EOD true-tally (hero)** → `GET /state.eod` (`total/cash/upi/expenses/net_cash/sale_count/busiest_hours/top_items/misses`) → Reveal
- **Ledger** → `state.sales` → Ledger feed
- **Collections (tap)** → `POST /collect/confirm` → Loose ends "Remind" + WhatsApp-sent card
- **Collections (schedule/cancel)** → `POST /reminders` / `/reminders/cancel`, `state.scheduled` → Upcoming-reminders strip
- **Procurement** → `POST /procure/confirm`, `state.suppliers` → "Order" button + order card
- **Simulated calls** → `state.calls[]` (`script`, `audio_url`) → Calls panel with play
- **Review queue** → `state.reviews`, `POST /review/resolve`, `eod.to_review` → Needs-review panel
- **Mark done** → `POST /todo/done` → Done button on any todo

## Safety nets (per AGENTS.md §8)
- **Hold-to-talk mic is the floor** — the demo never depends on the wake word firing.
- **Mock card fallback** if the WhatsApp session is flaky (`message.mock:true` still returns + renders).
- **Pre-record** the whole loop as a backup video; never demo live telephony/WhatsApp on venue wifi without it.

## Cut order if time runs short (protect the hero)
Calling-recording → ambient → procurement → real WhatsApp (keep the mock card) → wake word (keep hold-to-talk).
**Never sacrifice: voice-logging + the spoken EOD true-tally + one spoken query.**
