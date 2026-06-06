// Simulated calls (no telephony — AGENTS.md §8 fallback). Galla composes a Hindi script
// and synthesizes it with Bulbul; the frontend plays it as a "📞 call recording".
import { tts } from './sarvam.js';
import { saveWav } from './audio.js';
import { store, nextId, nowIso } from './store.js';
import { config } from './config.js';

// kind: "order" (to supplier) | "collection" (to debtor). Returns the stored Call record.
export async function simulateCall(kind, ctx) {
  const shop = config.merchant.name;
  let script;
  if (kind === 'order') {
    script = `नमस्ते ${ctx.name} जी, ${shop} से बात कर रहे हैं। कृपया ${ctx.itemsLine} भेज दीजिए। धन्यवाद।`;
  } else {
    script = `नमस्ते ${ctx.name} जी, ${shop} से। आपका ${ctx.amount} रुपये बाकी है, कृपया भेज दीजिए। धन्यवाद।`;
  }

  let audio_url = null;
  try {
    const wav = await tts(script, 'hi-IN');
    if (wav) audio_url = saveWav(wav);
  } catch { /* call audio is best-effort; script still recorded */ }

  const call = { id: nextId('call'), ts: nowIso(), kind, to: ctx.phone || null, name: ctx.name, script, audio_url };
  store.calls.push(call);
  return call;
}
