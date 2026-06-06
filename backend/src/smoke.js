// Sarvam key smoke-test — run FIRST, and any time the day feels weird:  npm run smoke
// Round-trips the real key: TTS (text->wav) -> STT (wav->text) -> LLM (intent JSON).
import { config, requireKey } from './config.js';
import * as sarvam from './sarvam.js';

async function main() {
  try { requireKey(); } catch (e) { console.log('FAIL:', e.message); process.exit(1); }
  console.log(`Models: stt=${config.models.stt}  llm=${config.models.llm}  tts=${config.models.tts} (${config.ttsSpeaker})`);
  let ok = true;
  let wav = null;

  try {
    wav = await sarvam.tts('Aaj ke chaar hazaar do sau rupaye hue.');
    if (!wav || wav.subarray(0, 4).toString() !== 'RIFF') throw new Error('not a WAV');
    console.log(`  [PASS] TTS  -> ${wav.length.toLocaleString()} bytes WAV`);
  } catch (e) { console.log('  [FAIL] TTS  ->', e.message); ok = false; }

  if (wav) {
    try {
      const { transcript } = await sarvam.stt(wav, { filename: 'speech.wav', mimetype: 'audio/wav' });
      console.log(`  [PASS] STT  -> "${transcript}"`);
    } catch (e) { console.log('  [FAIL] STT  ->', e.message); ok = false; }
  }

  try {
    const c = await sarvam.chat([
      { role: 'system', content: 'Output ONLY JSON.' },
      { role: 'user', content: 'Return {"ok": true}' },
    ]);
    console.log(`  [PASS] LLM  -> ${c.trim().slice(0, 80)}`);
  } catch (e) { console.log('  [FAIL] LLM  ->', e.message); ok = false; }

  console.log(ok ? '\nALL GREEN ✅' : '\nSOMETHING FAILED ❌');
  process.exit(ok ? 0 : 1);
}
main();
