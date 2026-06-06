// End-of-day reconciliation: the HERO. Captured cash (voice-logged) + seeded UPI day.
import { store } from './store.js';

const sum = (arr) => arr.reduce((a, x) => a + (Number(x.amount) || 0), 0);

function allTimestamps() {
  return [...store.sales.map((s) => s.ts), ...store.upiTxns.map((t) => t.ts)];
}

// peak 2-hour window across sales + UPI txns
function busiestWindow() {
  const buckets = new Array(24).fill(0);
  for (const ts of allTimestamps()) {
    const h = new Date(ts).getHours();
    if (h >= 0 && h < 24) buckets[h] += 1;
  }
  let peak = 0, best = -1;
  for (let h = 0; h < 23; h++) {
    const w = buckets[h] + buckets[h + 1];
    if (w > peak) { peak = w; best = h; }
  }
  return best < 0 ? null : best; // start hour of the 2h window
}

const pad = (n) => String(n).padStart(2, '0');

function topItems() {
  const counts = {};
  for (const s of store.sales) {
    const k = s.item || 'item';
    counts[k] = (counts[k] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
}

export function computeEod() {
  const cash = sum(store.sales.filter((s) => s.type === 'cash'));
  const upiFromSales = sum(store.sales.filter((s) => s.type === 'upi'));
  const upiSeed = sum(store.upiTxns);
  const upi = upiFromSales + upiSeed;
  const start = busiestWindow();
  const misses = store.todos
    .filter((t) => t.kind === 'restock' && t.status === 'open')
    .map((t) => t.item || t.text);
  return {
    total: cash + upi,
    cash,
    upi,
    sale_count: store.sales.length + store.upiTxns.length,
    busiest_hours: start == null ? null : `${pad(start)}:00–${pad(start + 2)}:00`,
    top_items: topItems(),
    misses,
  };
}

// --- spoken Hindi (Devanagari, digits read in Hindi by Bulbul hi-IN) ---

function hindiPeriodLabel(start) {
  if (start == null) return null;
  const to12 = (h) => (h % 12 === 0 ? 12 : h % 12);
  const period = start >= 5 && start < 12 ? 'सुबह' : start >= 12 && start < 17 ? 'दोपहर' : start >= 17 && start < 21 ? 'शाम' : 'रात';
  return `${period} ${to12(start)} से ${to12(start + 2)} बजे`;
}

export function speakEod() {
  const e = computeEod();
  let line = `आज ${e.total} रुपये की बिक्री हुई — ${e.upi} रुपये ऑनलाइन और ${e.cash} रुपये कैश। कुल ${e.sale_count} सेल।`;
  const busy = hindiPeriodLabel(busiestWindow());
  if (busy) line += ` सबसे ज़्यादा भीड़ ${busy}।`;
  if (e.misses.length) line += ` ${e.misses.length} बार ${e.misses[0]} माँगी गई जो स्टॉक में नहीं थी।`;
  return line;
}

export function speakOwed() {
  const open = store.todos.filter((t) => t.kind === 'collect' && t.status === 'open');
  if (!open.length) return 'अभी किसी का उधार बाकी नहीं है।';
  const total = sum(open);
  const names = open.slice(0, 5).map((t) => `${t.customer} ${t.amount} रुपये`).join(', ');
  return `${open.length} लोगों का कुल ${total} रुपये उधार बाकी है: ${names}।`;
}
