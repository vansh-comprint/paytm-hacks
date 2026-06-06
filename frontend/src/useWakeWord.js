// Wake-word engine (openWakeWord via WASM). Listens for the bundled "hey jarvis" / "alexa"
// (no training). Exposes getStream() so the app records the command from the engine's OWN mic
// stream — one getUserMedia, the engine never stops, so it re-arms reliably (fixes "only works once").
import { useCallback, useEffect, useRef, useState } from 'react';
import WakeWordEngine, { MODEL_FILE_MAP } from './wakeword/index.js';

export const MODEL_FILES = { ...MODEL_FILE_MAP, hey_paytm: 'hey_paytm.onnx' };
// Bundled options: hey_jarvis | alexa | hey_mycroft | hey_rhasspy. Listening for two = more reliable.
export const ACTIVE_KEYWORDS = ['hey_jarvis', 'alexa'];

export function useWakeWord({ enabled, onWake }) {
  const [status, setStatus] = useState('off');
  const engineRef = useRef(null);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  useEffect(() => {
    if (!enabled) { setStatus('off'); return; }
    let cancelled = false;
    const offs = [];
    const engine = new WakeWordEngine({
      baseAssetUrl: '/openwakeword/models',
      ortWasmPath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
      modelFiles: MODEL_FILES,
      keywords: ACTIVE_KEYWORDS,
      detectionThreshold: 0.4,
      cooldownMs: 1500,
    });
    engineRef.current = engine;

    offs.push(engine.on('detect', ({ keyword, score }) => {
      if (cancelled) return;
      setStatus(`heard "${keyword}" (${score.toFixed(2)})`);
      onWakeRef.current?.(keyword, score);
    }));
    offs.push(engine.on('error', (e) => !cancelled && setStatus('error: ' + (e?.message || e))));

    setStatus('loading…');
    engine.load()
      .then(() => engine.start())
      .then(() => !cancelled && setStatus('armed (say “hey jarvis” / “alexa”)'))
      .catch((e) => !cancelled && setStatus('error: ' + (e?.message || e)));

    return () => {
      cancelled = true;
      offs.forEach((f) => f && f());
      try { engine.stop(); } catch { /* noop */ }
      engineRef.current = null;
    };
  }, [enabled]);

  // the engine's live mic stream — the app records the wake command from it (no second mic)
  const getStream = useCallback(() => engineRef.current?.getStream?.() ?? null, []);

  return { status, getStream };
}
