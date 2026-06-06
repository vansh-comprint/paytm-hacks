// Proactive layer: the "notice + propose" brain. Pure + read-only — scans the store and
// returns agent-initiated suggestions (overdue udhaar to collect, stock to reorder). The owner
// fires one with a single tap (POST /suggest/act) which reuses the existing senders. This is
// what makes Galla *speak up first* instead of only reacting to a tap (AGENTS.md vision §9).
// Consent stays owner-side: this only PROPOSES — nothing is sent until /suggest/act.
import { store } from './store.js';

export function computeSuggestions() {
  const out = [];

  // Overdue / un-reminded udhaar -> proactive collection (WhatsApp + simulated call on approve)
  for (const t of store.todos) {
    if (t.kind === 'collect' && t.status === 'open' && !t.reminded) {
      out.push({
        id: `sug_${t.id}`,
        kind: 'collect',
        todo_id: t.id,
        priority: Number(t.amount) || 0,
        customer: t.customer,
        amount: t.amount,
        item: t.item || null,
        action: 'message+call',
        title: `${t.customer} ka ₹${t.amount} baaki${t.item ? ` (${t.item})` : ''} — yaad dila du?`,
      });
    }
  }

  // Open / un-ordered restock -> proactive order to the supplier
  for (const t of store.todos) {
    if (t.kind === 'restock' && t.status === 'open' && !t.ordered) {
      out.push({
        id: `sug_${t.id}`,
        kind: 'restock',
        todo_id: t.id,
        priority: 0,
        item: t.item || t.text,
        qty: t.qty || null,
        action: 'order+call',
        title: `${t.item || t.text} khatam — order bhej du?`,
      });
    }
  }

  // collections first (highest amount first), then restock
  return out.sort((a, b) => (a.kind === b.kind ? b.priority - a.priority : a.kind === 'collect' ? -1 : 1));
}

// A one-line Hinglish briefing of what Galla wants to act on (for a proactive banner / spoken nudge).
export function briefingText() {
  const s = computeSuggestions();
  const coll = s.filter((x) => x.kind === 'collect');
  const rest = s.filter((x) => x.kind === 'restock');
  const parts = [];
  if (coll.length) {
    const total = coll.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    parts.push(`${coll.length} logon ka ₹${total} udhaar baaki hai`);
  }
  if (rest.length) parts.push(`${rest.length} cheez stock mein nahi`);
  return parts.length ? `${parts.join(', ')} — ek tap mein bhej du?` : '';
}
