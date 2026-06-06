// WhatsApp delivery. Mock card is the DEFAULT (AGENTS.md §5). Real send is the upgrade —
// here via the already-installed OpenWA gateway (faster than embedding whatsapp-web.js).
// The Message is ALWAYS returned (mock:true unless a real send succeeded), so a flaky
// session can never sink the demo — the UI shows the card regardless.
import { config } from './config.js';
import { store, nextId, nowIso } from './store.js';
import { paytmMockLink } from './payment.js';

// WhatsApp chatId = digits-only + "@c.us"  (e.g. "+91 98123 45671" -> "919812345671@c.us")
const toChatId = (phone) => `${String(phone).replace(/\D/g, '')}@c.us`;

// Real send via the local OpenWA gateway (verified from its source):
//   POST {url}/api/sessions/{sessionId}/messages/send-text   header X-API-Key   body {chatId,text}
async function openwaSend(phone, text) {
  const base = config.openwa.url.replace(/\/$/, '');
  const url = `${base}/api/sessions/${encodeURIComponent(config.openwa.session)}/messages/send-text`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-Key': config.openwa.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: toChatId(phone), text }),
  });
  if (!r.ok) throw new Error(`OpenWA ${r.status}: ${await r.text()}`);
  return r.json();
}

// Build + (optionally) send a collection reminder for a `collect` todo. Returns a Message.
export async function sendCollection(todo) {
  const ref = String(todo.id || 'REF').toUpperCase();
  const link = paytmMockLink(todo.amount, ref);
  const body =
    `Namaste ${todo.customer}! 🙏\n` +
    `${config.merchant.name} se ek vinamra reminder.\n` +
    `Baaki rakam: ₹${todo.amount}${todo.item ? ` (${todo.item})` : ''}\n\n` +
    `Paytm se abhi pay karein 👉 ${link}\n\n` +
    `Ref: ${ref}. Dhanyavaad!`;

  let mock = true;
  const to = todo.phone || null;
  if (config.whatsappMode === 'openwa' && to) {
    try { await openwaSend(to, body); mock = false; } catch { mock = true; }
  }

  const message = { id: nextId('msg'), ts: nowIso(), to, channel: 'whatsapp', body, link, mock };
  store.messages.push(message);
  return message;
}
