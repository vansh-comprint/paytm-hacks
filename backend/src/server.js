// Galla backend — the contract surface (AGENTS.md §3) + agent actions.
// Express on :8000, CORS open to :5173.
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, requireKey } from './config.js';
import { store, loadSeed, nextId, theSupplier, findTodo, findReview, matchContact, nowIso } from './store.js';
import { route, emptyIntent } from './router.js';
import { applyIntent } from './ledger.js';
import { computeEod } from './eod.js';
import { sendCollection, sendOrder } from './whatsapp.js';
import { simulateCall } from './calls.js';
import { startScheduler, schedule } from './scheduler.js';
import { computeSuggestions, briefingText } from './suggest.js';
import { parseWhen } from './time.js';
import { AUDIO_DIR, saveWav } from './audio.js';
import * as sarvam from './sarvam.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');

requireKey();
loadSeed();
startScheduler();

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // audioBase64 can be ~MBs
app.use('/audio', express.static(AUDIO_DIR));
app.use('/dev', express.static(PUBLIC_DIR));

// POST /turn  { mode, text?, audioBase64? } -> { transcript, intent, reply_text, reply_audio_url?, changed }
app.post('/turn', async (req, res) => {
  const t0 = Date.now();
  try {
    const { mode = 'text', text, audioBase64 } = req.body || {};

    let transcript = (text || '').trim();
    let sttMs = 0;
    if (audioBase64) {
      const buf = Buffer.from(String(audioBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (buf.length) { const s0 = Date.now(); transcript = (await sarvam.stt(buf)).transcript; sttMs = Date.now() - s0; }
    }
    if (!transcript) {
      console.log(`[turn] ${mode} EMPTY transcript (stt ${sttMs}ms) -> "Kuch sunai nahi diya."`);
      return res.json({ transcript: '', intent: emptyIntent(), reply_text: 'Kuch sunai nahi diya.', reply_audio_url: null, changed: false });
    }

    const r0 = Date.now();
    const intent = await route(transcript);
    console.log(`[turn] ${mode} stt:${sttMs}ms route:${Date.now() - r0}ms  "${transcript}" -> ${intent.type}${intent.amount != null ? ` ₹${intent.amount}` : ''}${intent.item ? ` ${intent.item}` : ''}${intent.direction ? ` dir=${intent.direction}` : ''}`);
    const result = await applyIntent(intent, { mode });

    let reply_audio_url = null;
    if (result.speak && mode !== 'ambient' && result.reply_text) {
      try {
        const wav = await sarvam.tts(result.reply_text);
        if (wav) reply_audio_url = `${req.protocol}://${req.get('host')}${saveWav(wav)}`;
      } catch { /* never block the turn on TTS */ }
    }

    res.json({ transcript, intent, reply_text: result.reply_text, reply_audio_url, changed: !!result.changed });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// GET /state -> contract keys + additive agent state
app.get('/state', (req, res) => {
  res.json({
    sales: store.sales,
    todos: store.todos,
    messages: store.messages,
    eod: computeEod(),
    // additive (beyond §3): collections + procurement + agent actions
    expenses: store.expenses,
    reviews: store.reviews,
    scheduled: store.scheduled,
    calls: store.calls,
    suppliers: store.suppliers,
    contacts: store.contacts,
    items: store.items,
    upi_txns: store.upiTxns,
    // proactive layer: agent-initiated suggestions + a one-line briefing
    suggestions: computeSuggestions(),
    briefing: briefingText(),
  });
});

// POST /suggest/act { suggestion_id } -> fire a proactive suggestion (owner's one-tap consent).
// Reuses the existing collect/procure senders: WhatsApp + a simulated Hindi call.
app.post('/suggest/act', async (req, res) => {
  const { suggestion_id } = req.body || {};
  const sug = computeSuggestions().find((s) => s.id === suggestion_id);
  if (!sug) return res.status(404).json({ error: `suggestion '${suggestion_id}' not found (maybe already actioned)` });
  const todo = findTodo(sug.todo_id);
  if (!todo) return res.status(404).json({ error: `todo '${sug.todo_id}' not found` });

  if (sug.kind === 'collect') {
    const message = await sendCollection(todo);
    const call = await simulateCall('collection', { name: todo.customer, amount: todo.amount, phone: todo.phone });
    todo.reminded = true;
    return res.json({ suggestion: sug, message, call, todo });
  }
  // restock
  const supplier = theSupplier();
  if (!supplier) return res.status(400).json({ error: 'no supplier configured in seed' });
  const itemsLine = todo.qty ? `${todo.qty} ${todo.item}` : todo.item || todo.text;
  const message = await sendOrder(supplier, itemsLine);
  const call = await simulateCall('order', { name: supplier.name, phone: supplier.phone, itemsLine });
  todo.ordered = true;
  todo.status = 'done';
  return res.json({ suggestion: sug, message, call, todo });
});

// POST /collect/confirm { udhaar_id } -> { message }  (tap-to-send, WhatsApp only)
app.post('/collect/confirm', async (req, res) => {
  const { udhaar_id } = req.body || {};
  const todo = store.todos.find((t) => t.id === udhaar_id && t.kind === 'collect');
  if (!todo) return res.status(404).json({ error: `collect item '${udhaar_id}' not found` });
  const message = await sendCollection(todo);
  todo.reminded = true;
  res.json({ message });
});

// POST /procure/confirm { todo_id } -> { message, call }  (order the supplier: WhatsApp + simulated call)
app.post('/procure/confirm', async (req, res) => {
  const { todo_id } = req.body || {};
  const todo = store.todos.find((t) => t.id === todo_id && t.kind === 'restock');
  if (!todo) return res.status(404).json({ error: `restock item '${todo_id}' not found` });
  const supplier = theSupplier();
  if (!supplier) return res.status(400).json({ error: 'no supplier configured in seed' });

  const itemsLine = todo.qty ? `${todo.qty} ${todo.item}` : todo.item || todo.text;
  const message = await sendOrder(supplier, itemsLine);
  const call = await simulateCall('order', { name: supplier.name, phone: supplier.phone, itemsLine });
  todo.ordered = true;
  todo.status = 'done';
  res.json({ message, call, todo });
});

// POST /review/resolve { review_id, resolution:"in"|"out"|"ignore" } -> { review, eod }
app.post('/review/resolve', (req, res) => {
  const { review_id, resolution } = req.body || {};
  const review = findReview(review_id);
  if (!review) return res.status(404).json({ error: `review '${review_id}' not found` });
  if (resolution === 'in') {
    store.sales.push({ id: nextId('sale'), ts: nowIso(), type: 'cash', amount: review.amount, item: review.raw || 'cash sale', status: 'done' });
  } else if (resolution === 'out') {
    store.expenses.push({ id: nextId('exp'), ts: nowIso(), amount: review.amount, note: review.raw || 'cash diya' });
  }
  review.status = 'resolved';
  review.resolution = resolution || 'ignore';
  res.json({ review, eod: computeEod() });
});

// POST /todo/done { todo_id } -> { todo }   (deterministic mark-done for any todo)
app.post('/todo/done', (req, res) => {
  const { todo_id } = req.body || {};
  const todo = findTodo(todo_id);
  if (!todo) return res.status(404).json({ error: `todo '${todo_id}' not found` });
  todo.status = 'done';
  res.json({ todo });
});

// POST /reminders { udhaar_id? | (customer, amount), item?, when } -> { scheduled }
// Schedule a collection reminder from the UI; at fireAt the scheduler sends WhatsApp + a simulated call.
app.post('/reminders', (req, res) => {
  const b = req.body || {};
  const fireAt = parseWhen(b.when);
  if (!fireAt) return res.status(400).json({ error: 'could not parse "when" (try "in 5 minutes", "today 18:00", "6 baje")' });

  let customer; let customer_id; let phone; let amount; let item;
  if (b.udhaar_id) {
    const t = store.todos.find((x) => x.id === b.udhaar_id && x.kind === 'collect');
    if (!t) return res.status(404).json({ error: `udhaar '${b.udhaar_id}' not found` });
    ({ customer, customer_id, phone, amount, item } = t);
  } else {
    const c = matchContact(b.customer);
    customer = c?.name || b.customer || 'Customer';
    customer_id = c?.id;
    phone = c?.phone || b.phone || null;
    amount = Number(b.amount) || 0;
    item = b.item || null;
  }
  if (!amount || amount <= 0) return res.status(400).json({ error: 'a positive amount is required' });

  const scheduled = schedule({ customer, customer_id, phone, amount, item, fireAt });
  res.json({ scheduled });
});

// POST /reminders/cancel { id } -> { scheduled }   (cancel a pending reminder; cancelled jobs never fire)
app.post('/reminders/cancel', (req, res) => {
  const { id } = req.body || {};
  const job = store.scheduled.find((s) => s.id === id);
  if (!job) return res.status(404).json({ error: `reminder '${id}' not found` });
  if (job.status === 'pending') { job.status = 'cancelled'; job.cancelledAt = nowIso(); }
  res.json({ scheduled: job });
});

// --- dev helpers ---
app.get('/health', (req, res) => res.json({
  ok: true,
  models: config.models,
  speaker: config.ttsSpeaker,
  whatsapp: config.whatsappMode,
  router: config.router === 'groq' && config.groq.key ? `groq:${config.groq.model}` : `sarvam:${config.models.llm}`,
}));
app.post('/reset', (req, res) => { loadSeed(); res.json({ ok: true, eod: computeEod() }); });

app.listen(config.port, () => {
  const router = config.router === 'groq' && config.groq.key ? `groq:${config.groq.model}` : `sarvam:${config.models.llm}`;
  console.log(`Galla backend on http://localhost:${config.port}  (router: ${router}, stt: ${config.models.stt}, tts: ${config.models.tts}/${config.ttsSpeaker}, whatsapp: ${config.whatsappMode})`);
});
