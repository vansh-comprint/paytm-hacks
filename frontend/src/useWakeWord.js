// Wake-word engine (openWakeWord via WASM, fully offline). Loads the shared
// melspectrogram/embedding/VAD + a per-word head, listens on the mic, and calls
// onWake() when the phrase is detected.
//
// SWAP-IN: when Colab training finishes, drop hey_paytm.onnx into
// public/openwakeword/models/ and set ACTIVE_KEYWORD = 'hey_paytm'. No other change.
import { useEffect, useRef, useState } from 'react';
import WakeWordEngine, { MODEL_FILE_MAP } from './wakeword/index.js';

// Extend the bundled map with our custom head (no fork — `modelFiles` is a constructor option).
export const MODEL_FILES = { ...MODEL_FILE_MAP, hey_paytm: 'hey_paytm.onnx' };

// 'hey_jarvis' is the bundled stand-in we test with until hey_paytm.onnx exists.
export const ACTIVE_KEYWORD = 'hey_jarvis'; // TODO after training: 'hey_paytm'

export function useWakeWord({ enabled, onWake }) {
  const [status, setStatus] = useState('off');
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    let cancelled = false;
    const offs = [];
    const engine = new WakeWordEngine({
      baseAssetUrl: '/openwakeword/models',
      ortWasmPath: '/openwakeword/ort/', // self-hosted runtime → no CDN, works offline
      modelFiles: MODEL_FILES,
      keywords: [ACTIVE_KEYWORD],
      detectionThreshold: 0.5,
      cooldownMs: 2500, // avoid double-fire on one utterance
    });

    offs.push(engine.on('detect', ({ keyword, score }) => {
      if (cancelled) return;
      setStatus(`heard "${keyword}" (${score.toFixed(2)})`);
      onWakeRef.current?.(keyword, score);
    }));
    offs.push(engine.on('error', (e) => !cancelled && setStatus('error: ' + (e?.message || e))));

    setStatus('loading models…');
    engine
      .load()
      .then(() => engine.start())
      .then(() => !cancelled && setStatus(`listening for "${ACTIVE_KEYWORD}"`))
      .catch((e) => !cancelled && setStatus('error: ' + (e?.message || e)));

    return () => {
      cancelled = true;
      offs.forEach((f) => f && f());
      try { engine.stop(); } catch { /* noop */ }
    };
  }, [enabled]);

  return { status };
}
