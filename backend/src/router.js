// Intent router: one Sarvam-LLM call turns a transcript into the contract's Intent JSON.
// The contacts + items lists are injected into the prompt so names/items match the ledger.
import { chat } from './sarvam.js';
import { store } from './store.js';
import { hindiToNumber } from './hindi.js';

const TYPES = ['log_sale', 'log_udhaar', 'log_miss', 'set_reminder', 'query', 'mark_done', 'unknown'];
const QKINDS = ['today_total', 'what_owed', 'cash_vs_upi', null];
const DIRS = ['in', 'out', 'unclear', null];
const empty = () => ({
  type: 'unknown', amount: null, pay_type: null, item: null,
  customer: null, query_kind: null, direction: null, when: null,
});

export function systemPrompt() {
  const names = store.contacts.map((c) => c.name).join(', ') || '(none)';
  const items = store.items.map((i) => i.name).join(', ') || '(none)';
  return `You are the intent router for "Galla", an Indian shopkeeper's voice munshi.
The shopkeeper speaks Hindi / Hinglish (already transcribed to English). Read ONE utterance
and output ONLY a single JSON object — no prose, no markdown fences.

Schema (every key ALWAYS present; null when N/A):
{ "type":"log_sale"|"log_udhaar"|"log_miss"|"set_reminder"|"query"|"mark_done"|"unknown",
  "amount":<number|null>, "pay_type":"cash"|"upi"|null, "item":<string|null>,
  "customer":<string|null>, "query_kind":"today_total"|"what_owed"|"cash_vs_upi"|null,
  "direction":"in"|"out"|"unclear"|null, "when":<string|null> }

Types:
- log_sale  : money RECEIVED for a sale. set amount, pay_type (cash, or upi for "online/UPI/Paytm/GPay"), item, direction "in".
- log_udhaar: credit / someone owes (udhaar, baaki, "likh do"). set amount, customer, item. pay_type null.
- log_miss  : a wanted item is out of stock / reorder needed ("khatam ho gayi", "order kar do"). set item; amount=quantity if said.
- set_reminder: owner wants to be reminded / remind a debtor at a TIME ("Ramesh ko 6 baje yaad dilana", "do minute baad reminder", "kal yaad dilana"). set customer, when (and amount/item if a new udhaar is also stated).
- query     : a question. query_kind="today_total" (kitna becha/kamaaya), "cash_vs_upi" ("aaj ka hisaab"), "what_owed" (kiska udhaar baaki).
- mark_done : completing a to-do. identify via item or customer.
- unknown   : anything else.

direction (for cash only): "in" = money received (a sale). "out" = money PAID OUT / expense
("X ko diya", "kharcha", "bill bhara"). "unclear" = a cash amount is mentioned but it is
NOT clear whether it came in or went out (e.g. bare "pachaas rupaye diye" with no payer) —
prefer "unclear" over guessing; the backend will queue it for the owner to review.

when: if a time is mentioned, normalize it to EXACTLY one of these shapes (else null):
"in N minutes" | "in N hours" | "in N days" | "today HH:MM" | "tomorrow HH:MM" (24-hour).
e.g. "6 baje"->"today 18:00", "do minute baad"->"in 2 minutes", "teen din baad"->"in 3 days", "kal subah 9 baje"->"tomorrow 09:00".

Rules:
- Output JSON ONLY.
- amount is a plain number. Normalize Hindi number words: pachaas=50, sau=100, "paanch sau"=500, "do hazaar"=2000, "dhaai sau"=250.
- "online" / "Paytm" / "UPI" / "GPay" / "PhonePe" => pay_type "upi". "cash"/"nakad" => "cash".
- Ignore the wake word "Paytm" when it is just the trigger (e.g. "Paytm, pachaas cash Maggi").
- Match customer to KNOWN CUSTOMERS and item to KNOWN ITEMS when possible; else keep what was said.

KNOWN CUSTOMERS: ${names}
KNOWN ITEMS: ${items}

Examples:
"Paytm, pachaas cash Maggi" -> {"type":"log_sale","amount":50,"pay_type":"cash","item":"Maggi","customer":null,"query_kind":null,"direction":"in","when":null}
"sau rupaye online doodh" -> {"type":"log_sale","amount":100,"pay_type":"upi","item":"Milk","customer":null,"query_kind":null,"direction":"in","when":null}
"cheeni khatam ho gayi hai" -> {"type":"log_miss","amount":null,"pay_type":null,"item":"Sugar","customer":null,"query_kind":null,"direction":null,"when":null}
"pachaas rupaye diye" -> {"type":"log_sale","amount":50,"pay_type":"cash","item":null,"customer":null,"query_kind":null,"direction":"unclear","when":null}
"chai wale ko bees rupaye diye" -> {"type":"log_sale","amount":20,"pay_type":"cash","item":null,"customer":null,"query_kind":null,"direction":"out","when":null}
"Ramesh ko paanch sau ka udhaar likh do" -> {"type":"log_udhaar","amount":500,"pay_type":null,"item":null,"customer":"Ramesh Kumar","query_kind":null,"direction":null,"when":null}
"Ramesh ko do minute baad yaad dilana" -> {"type":"set_reminder","amount":null,"pay_type":null,"item":null,"customer":"Ramesh Kumar","query_kind":null,"direction":null,"when":"in 2 minutes"}
"Suresh ko 6 baje paise ka reminder bhejna" -> {"type":"set_reminder","amount":null,"pay_type":null,"item":null,"customer":"Suresh Patel","query_kind":null,"direction":null,"when":"today 18:00"}
"aaj ka hisaab" -> {"type":"query","amount":null,"pay_type":null,"item":null,"customer":null,"query_kind":"cash_vs_upi","direction":null,"when":null}
"kiska udhaar baaki hai" -> {"type":"query","amount":null,"pay_type":null,"item":null,"customer":null,"query_kind":"what_owed","direction":null,"when":null}`;
}

function extractJson(text) {
  let t = (text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  try { return JSON.parse(t); } catch { return null; }
}

function normalize(raw, transcript) {
  const out = empty();
  if (raw && typeof raw === 'object') for (const k of Object.keys(out)) if (k in raw) out[k] = raw[k];
  if (!TYPES.includes(out.type)) out.type = 'unknown';
  if (!['cash', 'upi', null].includes(out.pay_type)) out.pay_type = null;
  if (!QKINDS.includes(out.query_kind)) out.query_kind = null;
  if (!DIRS.includes(out.direction)) out.direction = null;
  if (out.when != null && typeof out.when !== 'string') out.when = String(out.when);
  if (typeof out.when === 'string' && !out.when.trim()) out.when = null;

  if (typeof out.amount === 'string') {
    const m = out.amount.match(/-?\d+(?:\.\d+)?/);
    out.amount = m ? Number(m[0]) : null;
  }
  if (out.amount == null && (out.type === 'log_sale' || out.type === 'log_udhaar')) {
    out.amount = hindiToNumber(transcript);
  }
  if (typeof out.amount === 'number' && (!Number.isFinite(out.amount) || out.amount < 0)) {
    out.amount = null; // never let a negative/NaN amount corrupt the ledger
  }
  for (const k of ['item', 'customer']) {
    if (typeof out[k] === 'string') out[k] = out[k].trim() || null;
    else if (out[k] != null) out[k] = String(out[k]);
  }
  return out;
}

export async function route(transcript) {
  if (!transcript || !transcript.trim()) return empty();
  let content;
  try {
    // sarvam-30b is a reasoning model — give it room so reasoning_content doesn't
    // eat the whole budget before it emits the final JSON (finish_reason: length).
    content = await chat(
      [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: transcript },
      ],
      { temperature: 0, max_tokens: 3000 },
    );
  } catch {
    return empty();
  }
  return normalize(extractJson(content), transcript);
}

export { empty as emptyIntent };
