// Thin Sarvam REST client (STT / LLM / TTS). All three smoke-tested live 2026-06-06.
// Auth = single `api-subscription-key` header. Uses Node 18+ global fetch/FormData/Blob.
import { config } from './config.js';

const BASE = 'https://api.sarvam.ai';
const keyHeader = () => ({ 'api-subscription-key': config.sarvamKey });

// Speech-to-text-translate (Saaras): auto-detects language, returns English transcript.
// Sarvam STT accepts webm/opus directly (verified) — so the browser's MediaRecorder blob
// can be forwarded as-is, no ffmpeg conversion needed.
export async function stt(buffer, { filename = 'speech.webm', mimetype = 'audio/webm' } = {}) {
  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: mimetype }), filename);
  fd.append('model', config.models.stt);
  const r = await fetch(`${BASE}/speech-to-text-translate`, { method: 'POST', headers: keyHeader(), body: fd });
  if (!r.ok) throw new Error(`STT ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return { transcript: (j.transcript || '').trim(), language_code: j.language_code };
}

// OpenAI-compatible chat completion. Returns the assistant message text.
export async function chat(messages, { temperature = 0.1, max_tokens = 512 } = {}) {
  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { ...keyHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.models.llm, messages, temperature, max_tokens }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? '';
}

// Bulbul text-to-speech. Returns a WAV Buffer (PCM 16-bit mono 22050Hz) or null.
export async function tts(text, lang = config.replyLang) {
  const r = await fetch(`${BASE}/text-to-speech`, {
    method: 'POST',
    headers: { ...keyHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: (text || '').slice(0, 1500),
      target_language_code: lang,
      speaker: config.ttsSpeaker,
      model: config.models.tts,
    }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const b64 = j.audios?.[0];
  return b64 ? Buffer.from(b64, 'base64') : null;
}
