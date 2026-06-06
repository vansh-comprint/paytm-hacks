// Apply an Intent to the ledger. Returns { changed, reply_text, speak }.
// `speak` (=> TTS audio) is true ONLY for queries — the "wow" moments. Routine logging
// gets a fast text/visual confirm, no audio (AGENTS.md §5).
import { store, nextId, nowIso, matchContact } from './store.js';
import { speakEod, speakOwed } from './eod.js';

export async function applyIntent(intent) {
  switch (intent.type) {
    case 'log_sale': {
      const amount = Number(intent.amount) || 0;
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
      const todo = {
        id: nextId('udh'), ts: nowIso(), kind: 'collect',
        text: `${customer} ka ₹${amount} baaki${intent.item ? ` (${intent.item})` : ''}`,
        status: 'open', amount, customer, customer_id: c?.id,
        phone: c?.phone || null, item: intent.item || null, reminded: false,
      };
      store.todos.push(todo);
      return { changed: true, reply_text: `📝 ${customer} ka ₹${amount} udhaar likh diya`, speak: false };
    }

    case 'log_miss': {
      const item = intent.item || 'item';
      const qty = Number(intent.amount) || null;
      const todo = {
        id: nextId('rst'), ts: nowIso(), kind: 'restock',
        text: qty ? `Order ${qty} ${item}` : `Restock ${item}`,
        status: 'open', item, qty,
      };
      store.todos.push(todo);
      return { changed: true, reply_text: `🛒 ${item} order list mein daal diya`, speak: false };
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
