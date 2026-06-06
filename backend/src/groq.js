// Groq LLM client (OpenAI-compatible) — used for the intent router ONLY.
// Groq serves fast NON-reasoning models (llama-3.3-70b ≈ 350ms) with JSON mode, which is
// what a real-time voice router needs. Speech (STT/TTS) stays on Sarvam. Bearer auth.
import { config } from './config.js';

const BASE = 'https://api.groq.com/openai/v1';

export const hasKey = () => !!config.groq.key;

// Returns the assistant message text (a JSON object string, thanks to response_format).
export async function chat(messages, { temperature = 0, max_tokens = 400 } = {}) {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.groq.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.groq.model,
      messages,
      temperature,
      max_tokens,
      response_format: { type: 'json_object' }, // force a single JSON object back
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? '';
}
