// In-memory store, seeded from /seed/seed.json at boot (no DB — per AGENTS.md §2).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '../../seed/seed.json');

export const store = {
  sales: [],      // Sale    = { id, ts, type:"cash"|"upi", amount, item, customer_id?, status }
  expenses: [],   // Expense = { id, ts, amount, note }                 (cash OUT)
  todos: [],      // Todo    = { id, ts, kind:"restock"|"collect"|"pay", text, status, ...extra }
  reviews: [],    // Review  = { id, ts, raw, amount, reason, status:"open"|"resolved" }  (ambiguous cash)
  scheduled: [],  // Sched   = { id, ts, fireAt, kind:"collect", customer, customer_id?, phone?, amount, status }
  calls: [],      // Call    = { id, ts, kind:"order"|"collection", to, name, script, audio_url }
  messages: [],   // Message = { id, ts, to, channel:"whatsapp", body, link?, mock }
  upiTxns: [],    // seeded mock UPI day (auto-captured digital payments)
  contacts: [],
  items: [],
  suppliers: [],
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
export const theSupplier = () => store.suppliers[0] || null; // one supplier for the demo
export const findTodo = (id) => store.todos.find((t) => t.id === id) || null;
export const findReview = (id) => store.reviews.find((r) => r.id === id) || null;

export function loadSeed() {
  const raw = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  store.sales = [];
  store.expenses = [];
  store.messages = [];
  store.todos = [];
  store.reviews = [];
  store.scheduled = [];
  store.calls = [];
  store._seq = 0;
  store.contacts = raw.contacts || [];
  store.items = raw.items || [];
  store.suppliers = raw.suppliers || [];
  // Demo: route every contact + supplier to one watchable phone (kept out of the repo).
  if (config.demoPhone) {
    store.contacts = store.contacts.map((c) => ({ ...c, phone: config.demoPhone }));
    store.suppliers = store.suppliers.map((s) => ({ ...s, phone: config.demoPhone }));
  }
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
