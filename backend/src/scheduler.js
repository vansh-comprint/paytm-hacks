// Tiny in-process scheduler: polls every 15s and fires due reminders. No external dep —
// good enough for a demo (process-lifetime jobs). At fire time: WhatsApp + simulated call.
import { store, nextId, nowIso } from './store.js';
import { sendCollection } from './whatsapp.js';
import { simulateCall } from './calls.js';

const POLL_MS = 15000;

export function schedule({ customer, customer_id, phone, amount, item, fireAt }) {
  const job = {
    id: nextId('sch'), ts: nowIso(), fireAt, kind: 'collect',
    customer, customer_id, phone, amount, item, status: 'pending',
  };
  store.scheduled.push(job);
  return job;
}

export async function fireJob(job) {
  job.status = 'fired';
  job.firedAt = nowIso();
  const ref = String(job.id).toUpperCase();
  // pretend this collect job is a todo for the existing senders
  const pseudo = { id: ref, customer: job.customer, amount: job.amount, item: job.item, phone: job.phone };
  job.message_id = (await sendCollection(pseudo)).id;
  job.call_id = (await simulateCall('collection', { name: job.customer, amount: job.amount, phone: job.phone })).id;
  return job;
}

export function startScheduler() {
  const tick = async () => {
    const now = Date.now();
    for (const job of store.scheduled) {
      if (job.status === 'pending' && new Date(job.fireAt).getTime() <= now) {
        try { await fireJob(job); } catch (e) { job.status = 'error'; job.error = String(e?.message || e); }
      }
    }
  };
  setInterval(tick, POLL_MS);
  tick(); // also check immediately on boot
}
