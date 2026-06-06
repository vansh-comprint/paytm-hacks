import 'dotenv/config';

// Models verified live against the Sarvam key on 2026-06-06.
// NOTE: AGENTS.md §5 lists LLM `sarvam-m` — that is DEPRECATED. Current: sarvam-30b / sarvam-105b.
export const config = {
  port: Number(process.env.PORT || 8000),
  sarvamKey: process.env.SARVAM_API_KEY || '',
  models: {
    stt: process.env.SARVAM_STT_MODEL || 'saaras:v2.5', // Saaras: auto-detect + translate to English
    llm: process.env.SARVAM_LLM_MODEL || 'sarvam-30b',  // or sarvam-105b
    tts: process.env.SARVAM_TTS_MODEL || 'bulbul:v3',   // latest Bulbul
  },
  ttsSpeaker: process.env.SARVAM_TTS_SPEAKER || 'priya', // valid for bulbul:v3 (anushka is v2-only)
  replyLang: process.env.REPLY_LANG || 'hi-IN',          // Galla talks back in Hindi

  // WhatsApp: mock card by default; real send via the local OpenWA gateway when WHATSAPP_MODE=openwa
  whatsappMode: process.env.WHATSAPP_MODE || 'mock',
  openwa: {
    url: process.env.OPENWA_URL || 'http://localhost:2785',
    key: process.env.OPENWA_KEY || 'dev-admin-key',
    session: process.env.OPENWA_SESSION || 'default',
  },

  // Payment links are MOCKED (no Paytm keys yet) — Paytm-styled URL, real provider swapped in later.
  merchant: {
    name: process.env.MERCHANT_NAME || 'Sharma General Store',
    vpa: process.env.MERCHANT_VPA || 'sharmastore@paytm',
  },

  // Demo override: when set, ALL seed contacts + suppliers use this phone, so every WhatsApp
  // and reminder lands on one watchable phone. Kept in .env (gitignored) so no real number
  // is committed to the public repo.
  demoPhone: process.env.DEMO_PHONE || '',
};

export function requireKey() {
  if (!config.sarvamKey) throw new Error('SARVAM_API_KEY missing — copy .env.example to .env');
}
