// Wake-word engine (openWakeWord via WASM). Listens for the bundled "hey jarvis" / "alexa"
// (no training). Exposes pause()/resume() so the recorder can take the mic during a capture and
// the engine re-arms cleanly afterwards (fixes "only works once" mic contention).
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

  // release the mic so a recorder can take it; engine stays loaded
  const pause = useCallback(() => { try { engineRef.current?.stop(); } catch { /* noop */ } }, []);
  // re-acquire the mic and listen again (no re-download)
  const resume = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.start()
      .then(() => setStatus('armed (say “hey jarvis” / “alexa”)'))
      .catch(() => { /* noop */ });
  }, []);

  return { status, pause, resume };
}
