// Galla end-to-end agent test. Hits the running backend on :8000.
//   node e2e.mjs            -> logic only (no WhatsApp/call sends, fast, CI-safe)
//   SEND=1 node e2e.mjs     -> ALSO does real collection + order sends and waits for a
//                              scheduled reminder to FIRE (real WhatsApp + call). Needs
//                              WHATSAPP_MODE=openwa + OpenWA linked + DEMO_PHONE set.
const B = process.env.BASE || 'http://localhost:8000';
const SEND = !!process.env.SEND;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  (cond ? pass++ : fail++);
  console.log(`  ${cond ? '✓' : '✗ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return cond;
};
const head = (t) => console.log(`\n=== ${t} ===`);
const get = async (p) => (await fetch(B + p)).json();
const post = async (p, body) => (await fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }));
const postJson = async (p, body) => (await post(p, body)).json();
const turn = (text, mode = 'text') => postJson('/turn', { mode, text });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const audioUrl = (u) => (u?.startsWith('http') ? u : B + u);
async function isWav(u) {
  if (!u) return false;
  const b = Buffer.from(await (await fetch(audioUrl(u))).arrayBuffer());
  return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WAVE';
}

async function main() {
  head('0. health + reset');
  const h = await get('/health');
  ok('backend healthy', h.ok === true, JSON.stringify(h.models));
  await postJson('/reset', {});

  head('1. intent agent (Hinglish → intent)');
  let r = await turn('Paytm sau cash maggi');
  ok('log_sale cash', r.intent.type === 'log_sale' && r.intent.amount === 100 && r.intent.pay_type === 'cash', JSON.stringify(r.intent));
  r = await turn('do sau online doodh');
  ok('log_sale upi + item match (doodh→Milk)', r.intent.type === 'log_sale' && r.intent.amount === 200 && r.intent.pay_type === 'upi' && /milk/i.test(r.intent.item || ''), JSON.stringify(r.intent));
  r = await turn('Ramesh ko paanch sau ka udhaar likh do');
  ok('log_udhaar + contact match', r.intent.type === 'log_udhaar' && r.intent.amount === 500 && /ramesh/i.test(r.intent.customer || ''), JSON.stringify(r.intent));
  r = await turn('cheeni khatam ho gayi hai', 'ambient');
  ok('log_miss (cheeni→Sugar)', r.intent.type === 'log_miss' && /sugar/i.test(r.intent.item || ''), JSON.stringify(r.intent));
  r = await turn('pachaas rupaye diye', 'ambient');
  ok('ambiguous cash → direction unclear', r.intent.direction === 'unclear', JSON.stringify(r.intent));
  r = await turn('chai wale ko bees rupaye diye', 'ambient');
  ok('expense → direction out', r.intent.direction === 'out', JSON.stringify(r.intent));
  r = await turn('Suresh ko do minute baad yaad dilana', 'wake');
  ok('set_reminder + when parsed', r.intent.type === 'set_reminder' && /minute/.test(r.intent.when || ''), JSON.stringify(r.intent));

  head('2. query agent (spoken Hindi)');
  r = await turn('aaj ka hisaab', 'wake');
  ok('query cash_vs_upi', r.intent.type === 'query' && r.intent.query_kind === 'cash_vs_upi');
  ok('EOD reply is Devanagari Hindi', /[ऀ-ॿ]/.test(r.reply_text || ''), (r.reply_text || '').slice(0, 60));
  ok('EOD reply has spoken audio (WAV)', await isWav(r.reply_audio_url), r.reply_audio_url || 'null');
  const owed = await turn('kiska udhaar baaki hai', 'wake');
  ok('query what_owed', owed.intent.query_kind === 'what_owed');

  head('3. EOD reconciliation math');
  const eod = (await get('/state')).eod;
  // logged: 100 cash (maggi) ; 200 upi (doodh) ; seed upi 1345 ; expense 20 ; review 50 (unresolved)
  ok('cash = 100', eod.cash === 100, `got ${eod.cash}`);
  ok('upi = 200 + 1345 = 1545', eod.upi === 1545, `got ${eod.upi}`);
  ok('expenses = 20', eod.expenses === 20, `got ${eod.expenses}`);
  ok('net_cash = cash − cashExpenses = 80', eod.net_cash === 80, `got ${eod.net_cash}`);
  ok('to_review = 1', eod.to_review === 1, `got ${eod.to_review}`);
  ok('misses include Sugar', (eod.misses || []).some((m) => /sugar/i.test(m)), JSON.stringify(eod.misses));

  head('4. review agent (resolve ambiguous cash)');
  let st = await get('/state');
  const review = st.reviews.find((x) => x.status === 'open');
  ok('one open review exists', !!review, review?.id);
  const rr = await postJson('/review/resolve', { review_id: review.id, resolution: 'in' });
  ok('resolve "in" → cash now 150', rr.eod.cash === 150, `got ${rr.eod.cash}`);
  ok('resolve clears the review', rr.eod.to_review === 0, `to_review ${rr.eod.to_review}`);

  head('5. mark-done agent (/todo/done deterministic)');
  st = await get('/state');
  const restock = st.todos.find((t) => t.kind === 'restock' && t.status === 'open');
  const done = await postJson('/todo/done', { todo_id: restock.id });
  ok('todo marked done', done.todo.status === 'done', restock.id);

  head('6. reminder agent (create + cancel, by udhaar_id and by name)');
  st = await get('/state');
  const collect = st.todos.find((t) => t.kind === 'collect' && t.status === 'open');
  const s1 = (await postJson('/reminders', { udhaar_id: collect.id, when: 'in 5 minutes' })).scheduled;
  ok('schedule by udhaar_id → pending', s1.status === 'pending' && s1.amount === collect.amount, JSON.stringify({ id: s1.id, amt: s1.amount }));
  const c1 = (await postJson('/reminders/cancel', { id: s1.id })).scheduled;
  ok('cancel → cancelled (won’t fire)', c1.status === 'cancelled');
  const s2 = (await postJson('/reminders', { customer: 'Anita', amount: 300, when: 'in 5 minutes' })).scheduled;
  ok('schedule by customer+amount (Anita match)', /anita/i.test(s2.customer) && s2.amount === 300, s2.customer);
  await postJson('/reminders/cancel', { id: s2.id });

  head('7. error handling (graceful, no crash)');
  ok('bad "when" → 400', (await post('/reminders', { customer: 'X', amount: 10, when: 'banana' })).status === 400);
  ok('no amount → 400', (await post('/reminders', { customer: 'X', when: 'in 2 minutes' })).status === 400);
  ok('bad todo id → 404', (await post('/todo/done', { todo_id: 'nope' })).status === 404);
  ok('bad collect id → 404', (await post('/collect/confirm', { udhaar_id: 'nope' })).status === 404);

  if (!SEND) {
    console.log('\n(skipping real WhatsApp/call sends — run with SEND=1 to exercise them)');
  } else {
    head('8. collections agent — REAL WhatsApp (watch your phone)');
    st = await get('/state');
    const c = st.todos.find((t) => t.kind === 'collect' && t.status === 'open');
    const cm = (await postJson('/collect/confirm', { udhaar_id: c.id })).message;
    ok('collection sent (mock:false = real)', cm.mock === false, `to ${cm.to}`);
    ok('message has Paytm link', !!cm.link, cm.link);

    head('9. procurement agent — REAL order + simulated Hindi call');
    await turn('atta khatam ho gaya', 'ambient');
    st = await get('/state');
    const rst = st.todos.find((t) => t.kind === 'restock' && t.status === 'open');
    const pr = await postJson('/procure/confirm', { todo_id: rst.id });
    ok('order sent (mock:false = real)', pr.message.mock === false, `to ${pr.message.to}`);
    ok('simulated call has Hindi script', /[ऀ-ॿ]/.test(pr.call.script || ''), (pr.call.script || '').slice(0, 50));
    ok('call audio is a real WAV', await isWav(pr.call.audio_url), pr.call.audio_url);

    head('10. scheduler agent — live timed fire (~75s; real WhatsApp + call)');
    const fire = (await postJson('/reminders', { udhaar_id: c.id, when: 'in 1 minute' })).scheduled;
    console.log(`  …scheduled ${fire.id} for ${new Date(fire.fireAt).toLocaleTimeString()} — polling for fire`);
    let fired = null;
    for (let i = 0; i < 16; i++) {
      await sleep(6000);
      const j = (await get('/state')).scheduled.find((x) => x.id === fire.id);
      if (j && j.status === 'fired') { fired = j; break; }
      process.stdout.write('.');
    }
    console.log('');
    ok('scheduled job fired', !!fired, fired ? `msg=${fired.message_id} call=${fired.call_id}` : 'TIMED OUT');
    if (fired) {
      st = await get('/state');
      const msg = st.messages.find((m) => m.id === fired.message_id);
      const call = st.calls.find((cl) => cl.id === fired.call_id);
      ok('fire sent real WhatsApp', msg && msg.mock === false, msg ? `to ${msg.to}` : 'no msg');
      ok('fire produced a call WAV', await isWav(call?.audio_url), call?.audio_url);
    }
  }

  console.log(`\n──────────── ${fail === 0 ? 'ALL GREEN ✅' : 'SOME FAILED ❌'} — ${pass} passed, ${fail} failed ────────────`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('e2e crashed:', e); process.exit(2); });
