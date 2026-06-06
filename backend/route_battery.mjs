// Galla routing + mode-behavior battery. Hits the running backend on :8000.
// Focus: intent ROUTING accuracy across the two behavioural modes (conversational
// text/wake vs ambient log-only) + the talk-back audio contract + the full voice
// (audio -> STT -> route -> TTS) pipeline. Run AFTER the backend is up:
//   node route_battery.mjs
// Optional: AUDIO=0 node route_battery.mjs   (skip the Sarvam audio-pipeline probe)
import { tts } from './src/sarvam.js';

const B = process.env.BASE || 'http://localhost:8000';
const DO_AUDIO = process.env.AUDIO !== '0';

let pass = 0, fail = 0, warn = 0;
const ok = (name, cond, detail = '') => {
  (cond ? pass++ : fail++);
  console.log(`  ${cond ? '✓' : '✗ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return cond;
};
const soft = (name, cond, detail = '') => { // routing is probabilistic; soft = warn, don't fail the run
  if (!cond) warn++;
  console.log(`  ${cond ? '✓' : '⚠ WARN'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return cond;
};
const head = (t) => console.log(`\n=== ${t} ===`);
const get = async (p) => (await fetch(B + p)).json();
const postJson = async (p, body) => (await fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })).json();
const turn = (text, mode = 'text') => postJson('/turn', { mode, text });
const audioUrl = (u) => (u?.startsWith('http') ? u : B + u);
async function isWav(u) {
  if (!u) return false;
  const b = Buffer.from(await (await fetch(audioUrl(u))).arrayBuffer());
  return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WAVE';
}
const rx = (s, re) => re.test(String(s || ''));

// One routing case. Verifies the classified Intent fields. `mode` exercises behaviour.
async function routeCase(text, mode, expect) {
  const r = await turn(text, mode);
  const i = r.intent || {};
  const tag = `[${mode}] "${text}"`;
  const parts = [];
  let good = true;
  const check = (label, cond) => { if (!cond) good = false; parts.push(`${cond ? '' : '✗'}${label}`); };
  if (expect.type) check(`type=${i.type}`, i.type === expect.type);
  if ('amount' in expect) check(`amt=${i.amount}`, i.amount === expect.amount);
  if (expect.pay_type) check(`pay=${i.pay_type}`, i.pay_type === expect.pay_type);
  if (expect.item_re) check(`item=${i.item}`, rx(i.item, expect.item_re));
  if (expect.customer_re) check(`cust=${i.customer}`, rx(i.customer, expect.customer_re));
  if (expect.query_kind) check(`qk=${i.query_kind}`, i.query_kind === expect.query_kind);
  if (expect.direction) check(`dir=${i.direction}`, i.direction === expect.direction);
  if (expect.when_re) check(`when=${i.when}`, rx(i.when, expect.when_re));
  soft(`${tag} -> {${parts.join(' ')}}`, good, good ? '' : `raw=${JSON.stringify(i)}`);
  return r;
}

async function main() {
  head('0. health + reset');
  const h = await get('/health');
  ok('backend healthy', h.ok === true, `wa=${h.whatsapp} llm=${h.models?.llm}`);
  await postJson('/reset', {});

  head('1. ROUTING — conversational logging (mode: text/wake)');
  await routeCase('Paytm, pachaas cash Maggi', 'text', { type: 'log_sale', amount: 50, pay_type: 'cash', item_re: /maggi/i, direction: 'in' });
  await routeCase('sau rupaye online doodh', 'text', { type: 'log_sale', amount: 100, pay_type: 'upi', item_re: /milk|doodh/i, direction: 'in' });
  await routeCase('do sau ka biscuit GPay se', 'wake', { type: 'log_sale', amount: 200, pay_type: 'upi', item_re: /biscuit/i });
  await routeCase('char sau cash chawal', 'text', { type: 'log_sale', amount: 400, pay_type: 'cash', item_re: /rice|chawal/i });
  await routeCase('dhaai sau ka tea online', 'text', { type: 'log_sale', amount: 250, pay_type: 'upi', item_re: /tea/i });
  await routeCase('Paytm assi rupaye nakad ande', 'wake', { type: 'log_sale', amount: 80, pay_type: 'cash', item_re: /egg|ande/i });

  head('2. ROUTING — udhaar (credit) + contact match');
  await routeCase('Ramesh ko paanch sau ka udhaar likh do', 'text', { type: 'log_udhaar', amount: 500, customer_re: /ramesh/i });
  await routeCase('Suresh ke naam pe aath sau likh do', 'text', { type: 'log_udhaar', amount: 800, customer_re: /suresh/i });

  head('3. ROUTING — restock / out-of-stock (log_miss)');
  await routeCase('cheeni khatam ho gayi hai', 'ambient', { type: 'log_miss', item_re: /sugar|cheeni/i });
  await routeCase('doodh khatam ho gaya order kar do', 'ambient', { type: 'log_miss', item_re: /milk|doodh/i });
  await routeCase('do carton maggi mangwa lo', 'text', { type: 'log_miss', item_re: /maggi/i });

  head('4. ROUTING — cash direction (in / out / unclear) — feeds the review queue');
  await routeCase('chai wale ko bees rupaye diye', 'ambient', { type: 'log_sale', amount: 20, direction: 'out' });
  await routeCase('bijli ka bill teen sau bhara', 'ambient', { type: 'log_sale', amount: 300, direction: 'out' });
  await routeCase('pachaas rupaye diye', 'ambient', { type: 'log_sale', amount: 50, direction: 'unclear' });

  head('5. ROUTING — reminders (set_reminder + when normalization)');
  await routeCase('Suresh ko do minute baad yaad dilana', 'wake', { type: 'set_reminder', customer_re: /suresh/i, when_re: /in 2 min/i });
  await routeCase('Ramesh ko 6 baje paise ka reminder bhejna', 'wake', { type: 'set_reminder', customer_re: /ramesh/i, when_re: /today 18:00/i });
  await routeCase('kal subah 9 baje yaad dilana', 'wake', { type: 'set_reminder', when_re: /tomorrow 09:00/i });

  head('6. ROUTING — queries + mark_done + unknown');
  await routeCase('aaj kitna becha', 'wake', { type: 'query', query_kind: 'today_total' });
  await routeCase('aaj ka hisaab', 'wake', { type: 'query', query_kind: 'cash_vs_upi' });
  await routeCase('kiska udhaar baaki hai', 'wake', { type: 'query', query_kind: 'what_owed' });
  await routeCase('maggi wala kaam ho gaya', 'text', { type: 'mark_done' });
  await routeCase('namaste bhaiya kaise ho', 'text', { type: 'unknown' });

  head('7. MODE BEHAVIOUR CONTRACT — talk-back audio gating');
  // query in conversational (wake/text) -> spoken WAV; in ambient -> NEVER speaks
  let r = await turn('aaj ka hisaab', 'wake');
  ok('query[wake] has spoken WAV', await isWav(r.reply_audio_url), r.reply_audio_url || 'null');
  ok('query[wake] reply is Devanagari Hindi', /[ऀ-ॿ]/.test(r.reply_text || ''), (r.reply_text || '').slice(0, 50));
  r = await turn('aaj ka hisaab', 'ambient');
  ok('query[ambient] returns NO audio (log-only contract)', r.reply_audio_url == null, `audio=${r.reply_audio_url}`);
  ok('query[ambient] is NOT a state change (changed:false)', r.changed === false, `changed=${r.changed}`);
  r = await turn('Paytm sau cash maggi', 'text');
  ok('log_sale[text] returns NO audio (routine confirm only)', r.reply_audio_url == null, `audio=${r.reply_audio_url}`);
  ok('log_sale[text] is a state change (changed:true)', r.changed === true, `changed=${r.changed}`);
  r = await turn('', 'wake');
  ok('empty transcript -> graceful "kuch sunai nahi diya"', r.intent?.type === 'unknown' && /sunai/i.test(r.reply_text || ''), r.reply_text);

  head('8. MODE BEHAVIOUR — ambiguous cash creates a review (both modes route the same)');
  await postJson('/reset', {});
  await turn('pachaas rupaye diye', 'ambient');
  let revs = (await get('/state')).reviews.filter((x) => x.status === 'open');
  ok('ambient ambiguous cash -> 1 open review', revs.length === 1, `reviews=${revs.length}`);
  await turn('saath rupaye diye', 'text');
  revs = (await get('/state')).reviews.filter((x) => x.status === 'open');
  ok('text ambiguous cash ALSO -> review (mode is a flag, not a router)', revs.length === 2, `reviews=${revs.length}`);

  if (DO_AUDIO) {
    head('9. FULL VOICE PIPELINE — audio -> Sarvam STT -> route -> TTS (proves /turn audioBase64 plumbing)');
    try {
      const wav = await tts('पचास रुपये कैश मैगी।', 'hi-IN'); // synth a known Hindi command
      ok('synthesized a Hindi command WAV', !!wav && wav.subarray(0, 4).toString() === 'RIFF', `${wav?.length || 0} bytes`);
      const audioBase64 = `data:audio/wav;base64,${wav.toString('base64')}`;
      const vr = await postJson('/turn', { mode: 'wake', audioBase64 });
      ok('STT produced a transcript', !!(vr.transcript || '').trim(), `"${vr.transcript}"`);
      soft('voice -> log_sale (cash/maggi-ish)', vr.intent?.type === 'log_sale', `intent=${JSON.stringify(vr.intent)}`);
    } catch (e) {
      ok('voice pipeline probe ran', false, String(e?.message || e));
    }
  } else {
    console.log('\n(AUDIO=0 — skipped the Sarvam voice-pipeline probe)');
  }

  console.log(`\n──────── ${fail === 0 ? 'CORE GREEN ✅' : 'CORE FAILURES ❌'} — ${pass} hard-passed, ${fail} hard-failed, ${warn} routing warns ────────`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('battery crashed:', e); process.exit(2); });
