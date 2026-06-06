// WhatsApp delivery. Mock card is the DEFAULT (AGENTS.md §5). Real send is the upgrade,
// via the local OpenWA gateway. A Message is ALWAYS recorded + returned (mock:true unless a
// real send succeeded), so a flaky session can never sink the demo.
import { config } from './config.js';
import { store, nextId, nowIso } from './store.js';
import { paytmMockLink } from './payment.js';

const toChatId = (phone) => `${String(phone).replace(/\D/g, '')}@c.us`;

// POST {url}/api/sessions/{sessionId}/messages/send-text  header X-API-Key  body {chatId,text}
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

// Core sender: record + (optionally) really send a WhatsApp message. Returns the Message.
export async function sendWhatsApp({ phone, body, link = null }) {
  let mock = true;
  if (config.whatsappMode === 'openwa' && phone) {
    try { await openwaSend(phone, body); mock = false; } catch { mock = true; }
  }
  const message = { id: nextId('msg'), ts: nowIso(), to: phone || null, channel: 'whatsapp', body, link, mock };
  store.messages.push(message);
  return message;
}

// Collection reminder for a `collect` todo / scheduled job.
export function collectionBody({ customer, amount, item, ref }) {
  const link = paytmMockLink(amount, ref);
  const body =
    `Namaste ${customer}! 🙏\n` +
    `${config.merchant.name} se ek vinamra reminder.\n` +
    `Baaki rakam: ₹${amount}${item ? ` (${item})` : ''}\n\n` +
    `Paytm se abhi pay karein 👉 ${link}\n\n` +
    `Ref: ${ref}. Dhanyavaad!`;
  return { body, link };
}

export async function sendCollection(todo) {
  const ref = String(todo.id || 'REF').toUpperCase();
  const { body, link } = collectionBody({ customer: todo.customer, amount: todo.amount, item: todo.item, ref });
  return sendWhatsApp({ phone: todo.phone, body, link });
}

// Procurement order to the supplier.
export async function sendOrder(supplier, itemsLine) {
  const body =
    `Namaste ${supplier.name}! 🙏\n` +
    `${config.merchant.name} se order:\n` +
    `• ${itemsLine}\n\n` +
    `Kripya jaldi bhej dijiye. Dhanyavaad!`;
  return sendWhatsApp({ phone: supplier.phone, body });
}
