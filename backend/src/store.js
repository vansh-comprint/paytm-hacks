// In-memory store, seeded from /seed/seed.json at boot (no DB — per AGENTS.md §2).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '../../seed/seed.json');

export const store = {
  sales: [],      // Sale  = { id, ts, type:"cash"|"upi", amount, item, customer_id?, status }
  todos: [],      // Todo  = { id, ts, kind:"restock"|"collect"|"pay", text, status:"open"|"done", ...extra }
  messages: [],   // Message = { id, ts, to, channel:"whatsapp", body, link?, mock }
  upiTxns: [],    // seeded mock UPI day (digital payments captured automatically)
  contacts: [],
  items: [],
  _seq: 0,
};

export const nextId = (p) => `${p}_${++store._seq}`;
export const nowIso = () => new Date().toISOString();

// Rewrite a seed timestamp's DATE to today, keeping its time-of-day, so EOD is always "today".
function stampToday(ts) {
  const d = new Date(ts);
  const t = new Date();
  if (!Number.isNaN(d.getTime())) t.setHours(d.getHours(), d.getMinutes(), 0, 0);
  return t.toISOString();
}

export function matchContact(name) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  if (!n) return null;
  return store.contacts.find((c) => {
    const cn = c.name.toLowerCase();
    return cn === n || cn.includes(n) || n.includes(cn) || cn.split(' ')[0] === n.split(' ')[0];
  }) || null;
}

export const findContact = (id) => store.contacts.find((c) => c.id === id) || null;

export function loadSeed() {
  const raw = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  store.sales = [];
  store.messages = [];
  store.todos = [];
  store._seq = 0;
  store.contacts = raw.contacts || [];
  store.items = raw.items || [];
  store.upiTxns = (raw.upi_txns || []).map((t) => ({ ...t, ts: stampToday(t.ts) }));

  // Pre-seed a few open udhaar as `collect` todos so collections is demoable immediately.
  for (const u of raw.udhaar || []) {
    const c = matchContact(u.customer);
    store.todos.push({
      id: nextId('udh'),
      ts: stampToday(u.ts || nowIso()),
      kind: 'collect',
      text: `${u.customer} ka ₹${u.amount} baaki${u.item ? ` (${u.item})` : ''}`,
      status: 'open',
      amount: u.amount,
      customer: c?.name || u.customer,
      customer_id: c?.id,
      phone: c?.phone || u.phone || null,
      item: u.item || null,
      reminded: false,
    });
  }
}
