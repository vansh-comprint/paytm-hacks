// Intent router: one Sarvam-LLM call turns a transcript into the contract's Intent JSON.
// The contacts + items lists are injected into the prompt so names/items match the ledger.
import { chat } from './sarvam.js';
import { store } from './store.js';
import { hindiToNumber } from './hindi.js';

const TYPES = ['log_sale', 'log_udhaar', 'log_miss', 'query', 'mark_done', 'unknown'];
const QKINDS = ['today_total', 'what_owed', 'cash_vs_upi', null];
const empty = () => ({ type: 'unknown', amount: null, pay_type: null, item: null, customer: null, query_kind: null });

export function systemPrompt() {
  const names = store.contacts.map((c) => c.name).join(', ') || '(none)';
  const items = store.items.map((i) => i.name).join(', ') || '(none)';
  return `You are the intent router for "Galla", an Indian shopkeeper's voice munshi.
The shopkeeper speaks Hindi / Hinglish (already transcribed to English). Read ONE utterance
and output ONLY a single JSON object — no prose, no markdown fences.

Schema (every key ALWAYS present; null when N/A):
{ "type":"log_sale"|"log_udhaar"|"log_miss"|"query"|"mark_done"|"unknown",
  "amount":<number|null>, "pay_type":"cash"|"upi"|null, "item":<string|null>,
  "customer":<string|null>, "query_kind":"today_total"|"what_owed"|"cash_vs_upi"|null }

Types:
- log_sale  : a completed PAID sale. set amount, pay_type (cash, or upi for "online/UPI/Paytm/GPay"), item.
- log_udhaar: credit / someone owes (udhaar, baaki, "likh do"). set amount, customer, item. pay_type null.
- log_miss  : a wanted item was out of stock / reorder needed ("khatam thi", "order kar do"). set item; amount=quantity if said.
- query     : a question. query_kind="today_total" (kitna becha/kamaaya), "cash_vs_upi" (cash vs online split / "aaj ka hisaab"), "what_owed" (kiska udhaar baaki).
- mark_done : completing a to-do. identify via item or customer.
- unknown   : anything else.

Rules:
- Output JSON ONLY.
- amount is a plain number. Normalize Hindi number words: pachaas=50, sau=100, "paanch sau"=500, "do hazaar"=2000, "dhaai sau"=250.
- "online" / "Paytm" / "UPI" / "GPay" / "PhonePe" => pay_type "upi". "cash"/"nakad" => "cash".
- Ignore the wake word "Paytm" when it is just the trigger (e.g. "Paytm, pachaas cash Maggi").
- Match customer to KNOWN CUSTOMERS and item to KNOWN ITEMS when possible; else keep what was said.

KNOWN CUSTOMERS: ${names}
KNOWN ITEMS: ${items}

Examples:
"Paytm, pachaas cash Maggi" -> {"type":"log_sale","amount":50,"pay_type":"cash","item":"Maggi","customer":null,"query_kind":null}
"sau rupaye online doodh" -> {"type":"log_sale","amount":100,"pay_type":"upi","item":"Milk","customer":null,"query_kind":null}
"Ramesh ko paanch sau ka udhaar likh do" -> {"type":"log_udhaar","amount":500,"pay_type":null,"item":null,"customer":"Ramesh Kumar","query_kind":null}
"do logon ne Maggi maangi khatam thi" -> {"type":"log_miss","amount":2,"pay_type":null,"item":"Maggi","customer":null,"query_kind":null}
"aaj kitna becha" -> {"type":"query","amount":null,"pay_type":null,"item":null,"customer":null,"query_kind":"today_total"}
"aaj ka hisaab" -> {"type":"query","amount":null,"pay_type":null,"item":null,"customer":null,"query_kind":"cash_vs_upi"}
"kiska udhaar baaki hai" -> {"type":"query","amount":null,"pay_type":null,"item":null,"customer":null,"query_kind":"what_owed"}`;
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

  if (typeof out.amount === 'string') {
    const m = out.amount.match(/-?\d+(?:\.\d+)?/);
    out.amount = m ? Number(m[0]) : null;
  }
  if (out.amount == null && (out.type === 'log_sale' || out.type === 'log_udhaar')) {
    out.amount = hindiToNumber(transcript);
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
