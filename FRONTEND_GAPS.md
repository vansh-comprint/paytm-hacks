# FRONTEND_GAPS.md — Deep → Octo

> From Deep (backend). The brain now does more than the UI shows. Below: what the frontend
> **should** deliver to match the product (`VISION.md`) and the features we built, but currently
> doesn't. **Almost all of it needs ZERO backend work** — the data + endpoints are live on `:8000`.
> Verify any endpoint at <http://localhost:8000/dev/dev.html> (my tester exercises every one).

Legend: ✅ backend ready · ⚙️ small backend add available on request.

---

## P0 — closes the loop on features we already built (and demoed live)

### 1. Procurement: a "Confirm order" action on restock items ✅
Right now `LooseEnds` shows restock todos with only a **Done** button. The actual product flow —
*"cheeni khatam" → tap to order from the supplier* — is invisible.
- **Add:** on `kind:"restock"` todos, an **"Order from {supplier}"** button →
  `POST /procure/confirm { todo_id }`.
- **Response:** `{ message, call, todo }` — render the WhatsApp order card (`message.body`, `message.mock`)
  and the call (see #2). The todo flips to `status:"done"`.
- **Backend ready:** `/procure/confirm`, supplier in `GET /state.suppliers[0]`. Verified live (real WhatsApp landed).

### 2. Simulated calls — a panel that PLAYS the Hindi "📞 recording" ✅
The agent "calls" the supplier/debtor in Hindi (Bulbul TTS). The UI never plays it — this is a wow moment.
- **Add:** a **Calls** panel from `GET /state.calls[]` = `{ kind:"order"|"collection", name, script, audio_url, ts }`.
  Render each with the `script` and an `<audio src={API + audio_url}>` play button.
- **Backend ready:** `/state.calls` populated by `/procure/confirm` and every fired scheduled reminder.

### 3. Active-listening (AMBIENT) mode — the 3rd mode is missing ⚙️ (frontend-only)
The spec is **3 modes: off · active-listening · talk**. The UI has text + hold-to-talk + wake word, but
no continuous *ambient* capture.
- **Add:** an "Active listening" toggle that chunks the mic continuously (e.g. 4–6s windows) →
  `POST /turn { mode:"ambient", audioBase64 }`, shows a subtle "listening…" indicator, and **never plays
  reply audio** (ambient is log-only — backend already returns `reply_audio_url:null` for ambient).
- **Why:** this is how *"cheeni khatam"* and overheard cash get captured passively for EOD.
- **Backend ready:** `mode:"ambient"` already logs silently. (Octo's PLAN flags this as "only if core green" — core is green.)

---

## P1 — completeness + the "true numbers" pitch

### 4. Review queue for ambiguous cash ✅
Ambient hears *"pachaas rupaye diye"* (in or out?) → backend parks it for the owner. The UI doesn't show it,
so it's captured but unresolvable.
- **Add:** a **"Needs review"** panel from `GET /state.reviews[]` (`{ id, amount, reason, status }`, filter
  `status:"open"`) with **In (sale) · Out (expense) · Ignore** buttons → `POST /review/resolve { review_id, resolution:"in"|"out"|"ignore" }`.
- **Badge:** `eod.to_review` count.

### 5. EOD: show expenses + TRUE net cash (the pitch's last 10%) ✅
`Reveal` shows online/cash/total but not money going **out**. The whole pitch is "your *true* numbers" —
cash actually in the drawer = cash in − cash spent.
- **Add to the hero:** `eod.expenses` and `eod.net_cash` (already in the `Eod` shape) — e.g.
  *"₹1,400 cash in · ₹200 spent · **₹1,200 in the drawer**"*.

### 6. Scheduled reminders panel ✅
*"Ramesh ko 6 baje yaad dilana"* schedules a job that auto-fires WhatsApp + a call. The owner can't see it
— and now can also **create/cancel** reminders straight from the UI.
- **Add:** an **"Upcoming reminders"** strip from `GET /state.scheduled[]`
  (`{ id, customer, amount, fireAt, status:"pending"|"fired" }`) — show a countdown for pending, ✓ for fired.
  Builds the trust beat: *"Galla will remind Ramesh at 6, even if you forget."*
- **Create:** a "Remind" action → `POST /reminders { udhaar_id?, customer?, amount?, item?, phone?, when }`
  → `{ scheduled }`. Pass either an `udhaar_id` (preferred — pulls customer/amount/phone) or
  `customer + amount`, plus a `when` (`"in N minutes"` | `"today HH:MM"` | `"tomorrow HH:MM"` | `"6 baje"`…).
  At fire time it auto-sends WhatsApp + a simulated Hindi call (lands in `/state.calls`, see #2).
- **Cancel:** a ✕ on a pending row → `POST /reminders/cancel { id }` → `{ scheduled }`.
- **Backend ready:** `POST /reminders`, `POST /reminders/cancel`, and `GET /state.scheduled` all live.

### 7. A first-class mode switch (Off · Listen · Talk)
Ties #3 together — make the 3 modes one explicit control instead of an implicit text/wake split. Off = stop sending.

---

## P2 — polish & roadmap (narrate, mostly)

8. **"Hey Paytm" wake word** — swap `hey_jarvis` → `hey_paytm.onnx` when training finishes (Octo already tracking; the demo phrase is "Paytm").
9. **Deterministic mark-done** ✅ — **available: `POST /todo/done { todo_id }`** → `{ todo }` (deterministic mark-done for any todo). Today `markDone` sends a fuzzy text turn (`"X ho gaya"`); it can mis-match on similar names. Switch the existing **Done** button off that text-turn hack onto this endpoint for a reliable, exact mark-done.
10. **Empty/error/offline states** — friendly states when backend is offline or lists are empty (partly there); a tiny toast on send failure helps live.
11. **Vision roadmap (slides, not build):** morning briefing, lapsed-regular nudges, cash-crunch warnings, the lending hook — all narrated per `VISION.md §9`.

---

## TL;DR for Octo
The backend already serves **procurement orders, simulated-call audio, the review queue, scheduled
reminders, and expenses/net-cash** — none of P0/P1 needs backend changes, just UI to render
`/state.{calls,reviews,scheduled,suppliers}` + `eod.{expenses,net_cash,to_review}` and to wire
`/procure/confirm` + `/review/resolve`. Full shapes in [`contract/types.ts`](contract/types.ts);
poke them live at `/dev/dev.html`. Reminders are now read **and** write: create/cancel via
`POST /reminders` + `POST /reminders/cancel` (#6), and there's a deterministic `POST /todo/done` (#9).
