# Contract — Galla (materialized from AGENTS.md §3)

> Shared between **Octo** (frontend) and **Deep** (backend). **Do not drift.** Change only by
> mutual agreement — ping the other dev first. Backend runs `:8000`, frontend `:5173`, CORS open.

## Endpoints

### `POST /turn`
Request body is **JSON** (`Content-Type: application/json`):
```jsonc
{ "mode": "text" | "wake" | "ambient",
  "text": "string (optional)",
  "audioBase64": "string (optional)" }   // base64 of the MediaRecorder blob; webm/opus is fine
```
Response:
```jsonc
{ "transcript": "string",
  "intent": Intent,
  "reply_text": "string",
  "reply_audio_url": "string | null",   // Bulbul TTS — present for query/EOD only, else null
  "changed": true | false }             // did state change? if true, frontend re-fetches /state
```
- `mode` is just a flag; the intent router does the real work.
- `ambient` mode logs only — never returns audio (never "talks back").
- `reply_audio_url` is an absolute URL to a WAV served by the backend; play it directly.

### `GET /state`
```jsonc
{ "sales": Sale[], "todos": Todo[], "messages": Message[], "eod": Eod }
```

### `POST /collect/confirm`
```jsonc
// request
{ "udhaar_id": "string" }   // the id of a `collect` Todo from /state (owner consent tap)
// response
{ "message": Message }      // the WhatsApp card (mock:true by default; mock:false if really sent)
```

## Types
```ts
type Intent = {
  type: "log_sale" | "log_udhaar" | "log_miss" | "query" | "mark_done" | "unknown";
  amount: number | null;
  pay_type: "cash" | "upi" | null;
  item: string | null;
  customer: string | null;            // matched against the contacts list when possible
  query_kind: "today_total" | "what_owed" | "cash_vs_upi" | null;
};

type Sale    = { id: string; ts: string; type: "cash" | "upi"; amount: number; item: string; customer_id?: string; status: string };
type Todo    = { id: string; ts: string; kind: "restock" | "collect" | "pay"; text: string; status: "open" | "done"; due?: string;
                 // collect todos also carry: amount, customer, customer_id?, phone?, item?  (the udhaar to collect)
               };
type Message = { id: string; ts: string; to: string | null; channel: "whatsapp"; body: string; link?: string; mock: boolean };
type Eod     = { total: number; cash: number; upi: number; sale_count: number;
                 busiest_hours: string | null; top_items: { name: string; count: number }[]; misses: string[] };
```

## Notes (Deep → Octo)
- **udhaar = a `collect` Todo.** "Send reminder" passes that todo's `id` as `udhaar_id` to `/collect/confirm`.
- **Speak only the wow moments:** `reply_audio_url` is non-null only for `type:"query"`. Sale/udhaar/miss
  logging returns a short text confirm (`reply_text`) with no audio — render it, don't expect speech.
- **Reply language is Hindi** (Devanagari for spoken EOD/query).
- Sarvam models in use (verified live): STT `saaras:v2.5`, LLM `sarvam-30b`, TTS `bulbul:v3`/`priya`.
  (AGENTS.md's `sarvam-m` is deprecated.)

---

## Agent extensions (ADDITIVE — backwards compatible, but Octo should know)

**The 3 modes** (all via `/turn`'s `mode`):
- `ambient` = active listening — logs only, never returns audio. Captures sales/cash + needs
  like *"cheeni khatam"*. Ambiguous cash → review queue.
- `wake` / `text` = conversational — talks back; owner orders stock, sets reminders.
- off = the frontend simply stops sending.

**Intent gained two fields:**
- `direction: "in" | "out" | "unclear" | null` — for cash: received / paid-out / ambiguous.
  `unclear` (e.g. ambient "pachaas rupaye diye") creates a **Review** the owner resolves.
- `when: string | null` — for `set_reminder` (a new intent type). Normalized to
  `"in N minutes" | "in N hours" | "in N days" | "today HH:MM" | "tomorrow HH:MM"`.

**New intent type `set_reminder`** — "Ramesh ko 6 baje yaad dilana" → schedules a reminder
that auto-fires WhatsApp **+ a simulated call** at the time.

**New endpoints:**
```
POST /procure/confirm  { todo_id }          // approve a pending `restock` todo
   -> { message, call, todo }               // orders the supplier: WhatsApp + simulated call

POST /review/resolve   { review_id, resolution: "in"|"out"|"ignore" }
   -> { review, eod }                        // resolve an ambiguous-cash entry

POST /todo/done        { todo_id }           // mark any todo (collect or restock) done; 404 if not found
   -> { todo }                               // deterministic mark-done

POST /reminders        { udhaar_id?, customer?, amount?, item?, phone?, when }
   -> { scheduled }                          // schedule a collection reminder from the UI
                                             // pass udhaar_id (a `collect` todo id, reuses its
                                             // customer/amount/phone/item) OR customer+amount(+item/phone).
                                             // `when` normalized like the router; 400 if unparseable or amount<=0.
                                             // at fireAt: auto WhatsApp + simulated Hindi call.

POST /reminders/cancel { id }                // cancel a PENDING reminder; 404 if not found
   -> { scheduled }                          // status -> "cancelled"; cancelled jobs never fire
```

**`/state` gained additive arrays:** `expenses[]`, `reviews[]`, `scheduled[]`, `calls[]`,
`suppliers[]`, `contacts[]`, `items[]`, `upi_txns[]`. (The original four — `sales/todos/messages/eod` — are unchanged.)

**`Eod` gained:** `expenses`, `net_cash` (cash − expenses), `to_review`.

**Calls are SIMULATED** (no telephony): `Call.audio_url` is a Hindi Bulbul "recording" the
frontend plays as a 📞 call. See `/contract/types.ts` for the new interfaces
(`Review`, `Scheduled`, `Call`, `Expense`, `Supplier`).
