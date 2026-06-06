// Apply an Intent to the ledger. Returns { changed, reply_text, speak }.
// `speak` (=> TTS audio) is true ONLY for queries — the "wow" moments.
import { store, nextId, nowIso, matchContact } from './store.js';
import { speakEod, speakOwed } from './eod.js';
import { schedule } from './scheduler.js';
import { parseWhen } from './time.js';

function openCollectFor(name, id) {
  const n = (name || '').toLowerCase();
  return store.todos.find((t) => t.kind === 'collect' && t.status === 'open' &&
    ((id && t.customer_id === id) || (n && (t.customer || '').toLowerCase() === n)));
}

export async function applyIntent(intent, { mode = 'text' } = {}) {
  switch (intent.type) {
    case 'log_sale': {
      const amount = Number(intent.amount) || 0;

      // ambiguous cash -> review queue (owner resolves at EOD)
      if (intent.direction === 'unclear') {
        const review = { id: nextId('rev'), ts: nowIso(), amount, raw: intent.item || null,
          reason: 'cash in/out unclear', status: 'open' };
        store.reviews.push(review);
        return { changed: true, reply_text: `❓ ₹${amount} review ke liye rakha (aaya ya gaya, confirm karein).`, speak: false };
      }
      // money paid out -> expense (track cash vs upi so net_cash stays correct)
      if (intent.direction === 'out') {
        const exp = { id: nextId('exp'), ts: nowIso(), amount, note: intent.item || 'paisa diya',
          type: intent.pay_type === 'upi' ? 'upi' : 'cash' };
        store.expenses.push(exp);
        return { changed: true, reply_text: `💸 ₹${amount} kharcha note kiya.`, speak: false };
      }
      // normal sale (money in)
      const type = intent.pay_type === 'upi' ? 'upi' : 'cash';
      const item = intent.item || 'item';
      const c = matchContact(intent.customer);
      const sale = { id: nextId('sale'), ts: nowIso(), type, amount, item, customer_id: c?.id, status: 'done' };
      store.sales.push(sale);
      return { changed: true, reply_text: `✅ ₹${amount} ${type} — ${item}`, speak: false };
    }

    case 'log_udhaar': {
      const amount = Number(intent.amount) || 0;
      const c = matchContact(intent.customer);
      const customer = c?.name || intent.customer || 'Customer';
      store.todos.push({
        id: nextId('udh'), ts: nowIso(), kind: 'collect',
        text: `${customer} ka ₹${amount} baaki${intent.item ? ` (${intent.item})` : ''}`,
        status: 'open', amount, customer, customer_id: c?.id,
        phone: c?.phone || null, item: intent.item || null, reminded: false,
      });
      return { changed: true, reply_text: `📝 ${customer} ka ₹${amount} udhaar likh diya`, speak: false };
    }

    case 'log_miss': {
      // a pending order — NOT sent until the owner taps confirm (/procure/confirm)
      const item = intent.item || 'item';
      const qty = Number(intent.amount) || null;
      const todo = {
        id: nextId('rst'), ts: nowIso(), kind: 'restock',
        text: qty ? `Order ${qty} ${item}` : `Reorder ${item}`,
        status: 'open', item, qty, ordered: false,
      };
      store.todos.push(todo);
      return { changed: true, reply_text: `🛒 ${item} order list mein daala — confirm karke bhej dunga.`, speak: false };
    }

    case 'set_reminder': {
      const c = matchContact(intent.customer);
      const existing = openCollectFor(c?.name || intent.customer, c?.id);
      const amount = Number(intent.amount) || existing?.amount || 0;
      const customer = c?.name || intent.customer || existing?.customer || 'Customer';
      const phone = c?.phone || existing?.phone || null;
      const fireAt = parseWhen(intent.when);
      if (!fireAt) {
        return { changed: false, reply_text: 'Kab yaad dilaun? (jaise "6 baje" ya "do minute baad")', speak: false };
      }
      if (!amount || amount <= 0) {
        return { changed: false, reply_text: `${customer} ka kitne rupaye ka reminder? Pehle udhaar likhwaaiye.`, speak: false };
      }
      if (intent.amount && !existing) {
        store.todos.push({ id: nextId('udh'), ts: nowIso(), kind: 'collect',
          text: `${customer} ka ₹${amount} baaki`, status: 'open', amount, customer,
          customer_id: c?.id, phone, item: intent.item || null, reminded: false });
      }
      schedule({ customer, customer_id: c?.id, phone, amount, item: intent.item || existing?.item || null, fireAt });
      const t = new Date(fireAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      return { changed: true, reply_text: `⏰ Theek hai — ${customer} ko ${t} par WhatsApp aur call se yaad dila dunga.`, speak: false };
    }

    case 'mark_done': {
      const needle = (intent.item || intent.customer || '').toLowerCase();
      const t = store.todos.find((td) => td.status === 'open' && needle &&
        `${td.item || ''} ${td.customer || ''} ${td.text || ''}`.toLowerCase().includes(needle));
      if (t) { t.status = 'done'; return { changed: true, reply_text: `✔️ Done: ${t.text}`, speak: false }; }
      return { changed: false, reply_text: 'Koi matching kaam nahi mila.', speak: false };
    }

    case 'query': {
      const text = intent.query_kind === 'what_owed' ? speakOwed() : speakEod();
      return { changed: false, reply_text: text, speak: true };
    }

    default:
      return { changed: false, reply_text: 'Maaf kijiye, samajh nahi aaya. Dobara boliye?', speak: false };
  }
}
