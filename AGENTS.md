# AGENTS.md — Galla

> Paytm AI Hackathon · Theme 2 (AI for Small Businesses) · 4-hour MVP · 2 devs + 2 agents.
> **Galla** = a voice-first "digital munshi" for India's shop owners. The owner logs cash + UPI
> sales by speaking (or typing) in Hindi, and Galla speaks back the shop's **true end-of-day
> numbers** — the cash Paytm's Soundbox can't see, reconciled with UPI.

---

## 0. Common Goal (both agents align to this)

Ship a **working web prototype** where:
1. A shopkeeper logs a sale by voice/text — *"Paytm, pachaas cash Maggi"* — and Galla confirms it.
2. He can ask one thing — *"aaj kitna becha?"* — and Galla answers **aloud in Hindi**.
3. Galla speaks a **true end-of-day tally**: total, cash-vs-UPI split, sale count, busiest hours, top items.
4. Bonus paths: consent-based **WhatsApp collection** of udhaar, and a **restock to-do**.

**The EOD tally is the hero. Protect it above everything.** The judging rule is "demos must be a
working prototype, not slides" — so the core loop must *run live*. Everything grand stays a
roadmap slide, never a claim of "built."

**Cut order if we slip:** calling agents → ambient mode → procurement to-do → real WhatsApp (keep
the mock card) → wake word (keep the manual button). **Never sacrifice logging + EOD tally + one spoken query.**

---

## 1. The Two Agents & Ownership

| Agent | Dev | Owns (don't let the other edit) | Mission |
|-------|-----|---------------------------------|---------|
| **Octo** | Dev A | `/frontend/**` | The browser app — everything judges see + all input capture. |
| **Deep** | Dev B | `/backend/**`, `/seed/**` | The brain — Sarvam pipeline, intent router, ledger, EOD, actions. |

**Shared, change only by mutual agreement:** `/contract/contract.md` and `/contract/types.ts`
(the API + intent schema below). If you must change the contract, ping the other dev *first* —
this is the one thing that breaks a parallel build.

Clean directory split = Octo and Deep almost never touch the same file. Commit small and often.

---

## 2. Tech Stack (opinionated, for speed)

- **Frontend (Octo):** React + Vite, plain CSS or Tailwind. Mic via `MediaRecorder`. Wake word via
  **Picovoice Porcupine Web** SDK. Plays TTS audio returned by backend. Runs on `:5173`.
- **Backend (Deep):** Node + Express (keeps Sarvam, ledger, and WhatsApp in one place since
  `whatsapp-web.js` is Node). Calls Sarvam over HTTP. In-memory store seeded from `/seed`. Runs on `:8000`, CORS open to `:5173`.
- **Storage:** in-memory objects seeded at boot (no DB needed for the demo). SQLite only if trivial.
- **Everything is JavaScript/TypeScript** so both devs share one language.

### Env (`.env.example`)
```
# backend
SARVAM_API_KEY=...          # you have this
PORT=8000
# frontend (Vite -> prefix VITE_)
VITE_PICOVOICE_ACCESS_KEY=... # free from console.picovoice.ai (separate from Sarvam)
VITE_API_BASE=http://localhost:8000
# WhatsApp: whatsapp-web.js logs in via QR using the spare number — no key needed.
# Paytm: NO keys -> payment links are MOCKED.
```

---

## 3. The Shared Contract (build against this; do not drift)

```
POST /turn
  body: { mode: "text" | "wake" | "ambient", text?: string, audioBase64?: string }
  ->   { transcript: string,
         intent: Intent,
         reply_text: string,
         reply_audio_url?: string,   // Bulbul TTS for query + EOD only
         changed: boolean }          // did state change? front end re-fetches /state

GET  /state
  ->   { sales: Sale[], todos: Todo[], messages: Message[], eod: Eod }

POST /collect/confirm
  body: { udhaar_id: string }        // owner consent tap
  ->   { message: Message }          // the WhatsApp card (mock by default, real if wired)

Intent = {
  type: "log_sale" | "log_udhaar" | "log_miss" | "query" | "mark_done" | "unknown",
  amount: number | null,
  pay_type: "cash" | "upi" | null,
  item: string | null,
  customer: string | null,           // MUST be matched against the contacts list, not free text
  query_kind: "today_total" | "what_owed" | "cash_vs_upi" | null
}

Sale    = { id, ts, type:"cash"|"upi", amount, item, customer_id?, status }
Todo    = { id, ts, kind:"restock"|"collect"|"pay", text, status:"open"|"done", due? }
Message = { id, ts, to, channel:"whatsapp", body, link?, mock:boolean }
Eod     = { total, cash, upi, sale_count, busiest_hours, top_items[], misses[] }
```

**The 3 entry modes are just 3 ways to fill `/turn`.** `mode` is a flag; the intent router does all
the real work. This is the whole "27 paths" collapsed into one endpoint.

---

## 4. Octo — Frontend Task List (ordered)

- [ ] **App shell + dashboard layout** (the screen judges see).
- [ ] **Text input** box → `POST /turn {mode:"text"}` → render reply. *(Do this first; unblocks everything.)*
- [ ] **Live ledger feed** — re-fetch `/state` on `changed:true`; show each sale as it lands.
- [ ] **EOD board** — render `eod` (total, cash/UPI split, sale_count, busiest_hours, top_items, misses). This is the hero screen — make it look good.
- [ ] **Mic capture** (`MediaRecorder`) → base64 → `POST /turn {mode:"wake"}` → play `reply_audio_url`.
- [ ] **Wake word** — Porcupine Web, custom keyword **"Paytm"**. *Timebox 45 min.* If flaky, ship a **"Paytm" button** that triggers the same record flow (this is also your live-demo safety net).
- [ ] **To-do panel** — list `todos`, allow "mark done".
- [ ] **Consent + message card** — a "Send reminder" button → `POST /collect/confirm` → show the returned WhatsApp `Message` as a card.
- [ ] **Ambient toggle** *(only if time)* — chunked continuous capture → `/turn {mode:"ambient"}`; UI shows a "listening" indicator; never blocks the rest.
- **DoD:** the full demo loop (script in §7) runs from this UI without touching a terminal.

## 5. Deep — Backend Task List (ordered)

- [ ] **Task 0 — verify Sarvam:** confirm exact endpoints/params at **docs.sarvam.ai** for STT, LLM, TTS, then smoke-test the key with one call each. *Do not assume signatures — confirm them now.* (Models: STT = Saarika/Saaras, TTS = **Bulbul**, LLM = `sarvam-m` chat-completions.)
- [ ] **Seed data** in `/seed`: one mock UPI day (~10 timestamped txns), ~5 contacts, ~10 items.
- [ ] **`/turn` pipeline:** if `audioBase64` → Sarvam **STT** → text; then **intent router** (one Sarvam-LLM call → the `Intent` JSON; include the contacts + item list in the prompt so it matches names/items, and **normalize Hindi number words** like "pachaas"→50).
- [ ] **Ledger writes** for `log_sale` / `log_udhaar` / `log_miss`; **mark_done** for todos.
- [ ] **EOD reconciliation:** captured cash + seeded UPI → compute `Eod`.
- [ ] **One query:** `query_kind:"today_total"` (+ `cash_vs_upi`) → compose `reply_text`.
- [ ] **TTS:** Sarvam **Bulbul** for the query answer and the EOD summary → `reply_audio_url`. (Text/visual confirm is fine for routine sale logging — save TTS for the wow moments.)
- [ ] **Procurement:** `log_miss` (or item low) → create a `restock` Todo. *(One proactive nudge is enough.)*
- [ ] **Collections:** `/collect/confirm` → build a `Message` with a **mocked Paytm payment link** (Paytm-styled URL/QR). **Default = mock card.** If core is green, wire `whatsapp-web.js` to actually send from the spare number (QR-login once); keep the mock as fallback.
- **DoD:** every contract endpoint returns correct shapes; the loop in §7 works end to end.

---

## 6. Timebox (4h, 2 people) — with sync points

- **0:00–0:30 — both:** repo + env, Deep smoke-tests Sarvam key, seed data, **lock the contract (§3).**
- **0:30–2:00 — split:** Octo → shell + text input + ledger feed + EOD board skeleton. Deep → `/turn` + router + ledger + EOD + query + TTS. **Sync @2:00.**
- **2:00–3:00:** full loop live (log → EOD speaks = hero secured). Then Deep → collections + procurement; Octo → mic + wake word + consent card. **Sync @3:00.**
- **3:00–3:30:** ambient toggle *if* time; polish the spoken EOD + query; real WhatsApp *if* core green.
- **3:30–4:00:** rehearse the §7 loop 3×, wire the manual fallback button, **record a backup video**, freeze code.

---

## 7. Demo Script (build toward exactly this)

1. Say **"Paytm, pachaas cash Maggi"** → confirms, logs. (Do 3–4, mix cash + "online".)
2. **"Paytm, do logon ne Maggi maangi, khatam thi"** → a restock to-do pops.
3. **"Paytm, aaj kitna becha?"** → Galla answers aloud ("ab tak ₹4,200, ₹1,400 cash").
4. Mark an udhaar → tap **Send reminder** (consent) → WhatsApp card with payment link appears.
5. **"Paytm, aaj ka hisaab"** → **hero:** spoken + on-screen — *"Aaj ₹4,200 — ₹2,800 online, ₹1,400 cash. 47 sale. Sabse busy 6–8 baje. 3 logon ne Maggi maangi jo nahi thi."*
6. Tagline: *"Paytm saw the ₹2,800. We just showed them the ₹1,400 they were blind to."*

**Live-demo safety:** manual "Paytm" button mirrors the wake word; pre-record the whole loop as backup.

---

## 8. STRETCH (ADD-ON) — Calling Agents 📞 *(only if everything above is green)*

Outbound voice agents that **call other people, never the owner** — owned by **Deep**, started
**only after logging + EOD + collections-WhatsApp are done.** This is an add-on, not scored core.

- **Collections call:** Galla calls the **debtor** in Hindi — "Namaste, Sharma Store ka ₹500 baaki hai, abhi Paytm link bhej dun?" — then drops the payment link via SMS/WhatsApp.
- **Procurement call:** Galla calls the **distributor** — "Bhaiya, 2 carton Maggi aur 1 aata bhej dena" — placing the reorder from the restock to-do.

**Tooling:** Bolna (India-native, Exotel/Twilio telephony) **or** LiveKit Agents, both with Sarvam as STT/LLM/TTS.
**Hard rules:**
- Needs a telephony provider account + number → real risk in 4h. Do **not** start unless core is frozen.
- Keep a **pre-recorded 20-sec clip** of each call as the demo fallback; never demo live telephony on venue wifi without a recording to fall back to.
- Consent stays owner-side for collections (owner approves before Galla calls).

---

## 9. Rules of Engagement

- **Don't break the contract (§3) silently.** It's the only thing that lets Octo and Deep run in parallel.
- **Mock-first.** Ship the mocked version of any external call (Paytm link, WhatsApp) before the real one.
- **Commit small, push often**, write a one-line message. Pull before you push.
- **Protect the hero.** If a feature threatens the EOD tally working, drop the feature.
- **Demo small, narrate big.** The companion/lending/calling vision is a roadmap slide *after* the working demo.
