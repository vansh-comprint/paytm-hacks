// Backend client — talks to Deep's brain (contract/contract.md). Backend on :8000, CORS open.
// Override with VITE_API_BASE in frontend/.env (Vite needs the VITE_ prefix).

const BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '');

async function jget(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}
async function jpost(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
  return r.json();
}

export const api = {
  base: BASE,
  // POST /turn { mode, text?, audioBase64? } -> TurnResponse
  turn: (body) => jpost('/turn', body),
  // GET /state -> { sales, todos, messages, eod }
  state: () => jget('/state'),
  // POST /collect/confirm { udhaar_id } -> { message }
  collectConfirm: (udhaar_id) => jpost('/collect/confirm', { udhaar_id }),
  // dev helpers
  health: () => jget('/health'),
  reset: () => jpost('/reset', {}),
};

// MediaRecorder blob -> bare base64 (no data: prefix), matching Deep's dev.html.
export const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });

// Pick a mime Sarvam STT accepts (webm/opus per contract).
export function pickAudioMime() {
  const prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined') return '';
  return prefs.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
}
