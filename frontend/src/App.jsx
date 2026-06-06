import { useCallback, useEffect, useRef, useState } from 'react';
import { api, blobToBase64, pickAudioMime } from './api.js';
import { useWakeWord } from './useWakeWord.js';
import { playChime } from './chime.js';
import Brandmark from './components/Brandmark.jsx';
import Orb from './components/Orb.jsx';
import VoiceBar from './components/VoiceBar.jsx';
import Reveal from './components/Reveal.jsx';
import Ledger from './components/Ledger.jsx';
import LooseEnds from './components/LooseEnds.jsx';
import WhatsAppSent from './components/WhatsAppSent.jsx';
import Nudges from './components/Nudge.jsx';

const WAKE_CAPTURE_MS = 4500;
const AMBIENT_CHUNK_MS = 4500;
const AMBIENT_SPEECH_GATE = 0.05;

export default function App() {
  const [state, setState] = useState({ sales: [], todos: [], messages: [], eod: null });
  const [online, setOnline] = useState(null);
  const [reply, setReply] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [mode, setMode] = useState('off');      // 'off' | 'listen' | 'talk'
  const [activated, setActivated] = useState(false);
  const [nudges, setNudges] = useState([]);
  const [busyTodo, setBusyTodo] = useState('');
  const [dismissedMsgs, setDismissedMsgs] = useState(() => new Set());

  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const nudgeId = useRef(0);
  const voiceLevelRef = useRef(0);     // shared mic level -> the orb (orb has no mic of its own)
  const meterStopRef = useRef(null);

  const refresh = useCallback(async () => {
    try { setState(await api.state()); setOnline(true); } catch { setOnline(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const pushNudge = useCallback((text) => {
    if (!text) return;
    const id = ++nudgeId.current;
    setNudges((n) => [...n, { id, text }]);
    setTimeout(() => setNudges((n) => n.filter((x) => x.id !== id)), 5200);
  }, []);

  // analyser tap on an existing stream -> feeds voiceLevelRef (no extra getUserMedia)
  const attachMeter = useCallback((stream) => {
    let actx, raf;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = actx.createAnalyser();
      analyser.fftSize = 512;
      actx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let s = 0; for (let i = 0; i < data.length; i++) { const v = data[i] / 255; s += v * v; }
        voiceLevelRef.current = Math.min(Math.sqrt(s / data.length) * 6, 1);
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch { /* noop */ }
    return () => { cancelAnimationFrame(raf); try { actx && actx.close(); } catch { /* noop */ } voiceLevelRef.current = 0; };
  }, []);

  const playAudio = useCallback((url) => {
    if (!url || !audioRef.current) return;
    audioRef.current.src = url;
    setSpeaking(true);
    audioRef.current.play().catch(() => setSpeaking(false));
  }, []);

  const sendTurn = useCallback(async (body) => {
    setBusy(true);
    try {
      const r = await api.turn(body);
      setOnline(true);
      setReply({ transcript: r.transcript, reply_text: r.reply_text });
      if (r.reply_audio_url) playAudio(r.reply_audio_url);
      if (r.changed) await refresh();
      return r;
    } catch {
      setOnline(false);
      setReply({ transcript: '', reply_text: 'Backend offline. Start Deep’s backend on :8000.' });
    } finally {
      setBusy(false);
      setActivated(false);
    }
  }, [playAudio, refresh]);

  // one-shot capture (hold-to-talk + wake). Re-arms the wake engine afterwards.
  const startRec = useCallback(async () => {
    if (recRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      meterStopRef.current = attachMeter(stream);
      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data?.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        meterStopRef.current?.(); meterStopRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recRef.current = null;
        setRecording(false);
        if (blob.size > 0) await sendTurn({ mode: 'wake', audioBase64: await blobToBase64(blob) });
        else setActivated(false);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      setRecording(false);
      setActivated(false);
      setReply({ transcript: '', reply_text: 'Mic permission denied. Use the text box.' });
    }
  }, [attachMeter, sendTurn]);

  const stopRec = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }, []);

  // wake fired: chime + activation, then capture the command (own mic) and reply
  const onWake = useCallback(async () => {
    if (recRef.current) return;
    playChime();
    setActivated(true);
    await startRec();
    setTimeout(stopRec, WAKE_CAPTURE_MS);
  }, [startRec, stopRec]);

  const { status: wakeStatus, getScores, isSpeechActive, testWav } = useWakeWord({ enabled: mode === 'talk', onWake });

  // live diagnostics so we can SEE the wake engine (score, VAD speech) instead of guessing
  const [diag, setDiag] = useState({ score: 0, speech: false });
  const [selfTest, setSelfTest] = useState(null);
  useEffect(() => {
    if (mode !== 'talk') { setDiag({ score: 0, speech: false }); return; }
    const id = setInterval(() => {
      const scores = Object.values(getScores());
      setDiag({ score: scores.length ? Math.max(...scores) : 0, speech: isSpeechActive() });
    }, 150);
    return () => clearInterval(id);
  }, [mode, getScores, isSpeechActive]);
  const runSelfTest = async () => { setSelfTest('run'); setSelfTest(await testWav()); };

  // ambient / Listen: continuous chunks, log-only, bottom nudge (no spoken reply); feeds the orb level
  useEffect(() => {
    if (mode !== 'listen') return;
    let active = true, stream, rec, ctx, analyser, raf, peak = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const measure = () => {
          if (!active) return;
          analyser.getByteFrequencyData(data);
          let s = 0; for (let i = 0; i < data.length; i++) { const v = data[i] / 255; s += v * v; }
          const lvl = Math.sqrt(s / data.length);
          peak = Math.max(peak, lvl);
          voiceLevelRef.current = Math.min(lvl * 6, 1);
          raf = requestAnimationFrame(measure);
        };
        measure();
        const cycle = () => {
          if (!active) return;
          peak = 0;
          const mime = pickAudioMime();
          rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
          const chunks = [];
          rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
          rec.onstop = async () => {
            if (active && peak > AMBIENT_SPEECH_GATE && chunks.length) {
              try {
                const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
                const r = await api.turn({ mode: 'ambient', audioBase64: await blobToBase64(blob) });
                if (r.changed) { pushNudge(r.reply_text); await refresh(); }
              } catch { /* dropped chunk */ }
            }
            if (active) cycle();
          };
          rec.start();
          setTimeout(() => rec.state !== 'inactive' && rec.stop(), AMBIENT_CHUNK_MS);
        };
        cycle();
      } catch { active = false; }
    })();
    return () => {
      active = false;
      voiceLevelRef.current = 0;
      try {
        cancelAnimationFrame(raf);
        rec && rec.state !== 'inactive' && rec.stop();
        stream && stream.getTracks().forEach((t) => t.stop());
        ctx && ctx.state !== 'closed' && ctx.close();
      } catch { /* noop */ }
    };
  }, [mode, pushNudge, refresh]);

  const sendText = (text) => sendTurn({ mode: 'text', text });
  const speakEod = () => sendTurn({ mode: 'text', text: 'aaj ka hisaab' });
  const markDone = async (t) => { try { await api.todoDone(t.id); await refresh(); } catch { setOnline(false); } };
  const sendReminder = async (t) => {
    setBusyTodo(t.id);
    try { await api.collectConfirm(t.id); await refresh(); } catch { setOnline(false); } finally { setBusyTodo(''); }
  };
  const dismissMsg = (id) => setDismissedMsgs((s) => { const n = new Set(s); n.add(id); return n; });

  return (
    <div className="min-h-dvh bg-counter">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Brandmark online={online} />

        <div className="mt-2 grid gap-5">
          <section className="relative flex flex-col items-center pt-1">
            <Orb
              levelRef={voiceLevelRef}
              className={`pointer-events-none -my-6 h-[min(90vw,600px)] w-[min(90vw,600px)] transition-transform duration-500 ${activated ? 'scale-105' : ''}`}
            />
            <p className={`deva -mt-3 text-[15px] ${activated ? 'font-semibold text-brand' : 'text-muted'}`}>
              {activated ? 'सुन रहा हूँ…' : mode === 'listen' ? 'चुपचाप सुन रहा हूँ — बस बोलते रहिए' : mode === 'talk' ? 'बोलिए “Hey Jarvis”' : 'बोलिए — मैं सुन रहा हूँ'}
            </p>
          </section>

          <VoiceBar
            onSendText={sendText}
            recording={recording}
            onMicDown={startRec}
            onMicUp={stopRec}
            mode={mode}
            onMode={setMode}
            wakeStatus={wakeStatus}
            busy={busy}
          />

          {mode === 'talk' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-line bg-panel-2 px-3.5 py-2 text-[12px]">
              <span className="font-semibold text-ink">wake score <span className="tnum">{diag.score.toFixed(2)}</span></span>
              <span className="text-muted">fires &gt; 0.30</span>
              <span className={diag.speech ? 'font-medium text-wa' : 'text-muted'}>● speech {diag.speech ? 'detected' : 'idle'}</span>
              <button onClick={runSelfTest} className="ml-auto rounded-lg bg-brand-ink px-2.5 py-1 font-semibold text-surface">Self-test</button>
              {selfTest !== null && (
                <span className="text-ink">
                  offline: {selfTest === 'run' ? '…' : typeof selfTest === 'number' ? selfTest.toFixed(2) + (selfTest > 0.5 ? ' ✓ pipeline OK' : ' ⚠ low') : 'n/a'}
                </span>
              )}
            </div>
          )}

          {reply && (
            <div
              key={reply.reply_text}
              className="animate-fade-up rounded-[var(--radius)] border border-line bg-panel-2 px-4 py-3"
            >
              {reply.transcript && <p className="text-[12.5px] italic text-muted">“{reply.transcript}”</p>}
              <p className="mt-0.5 deva text-[15px] font-medium leading-relaxed text-ink">{reply.reply_text}</p>
            </div>
          )}

          <Reveal eod={state.eod} onSpeak={speakEod} speaking={speaking || busy} />

          <div className="grid gap-5 md:grid-cols-[1.25fr_1fr]">
            <Ledger sales={state.sales} />
            <div className="grid gap-5">
              <LooseEnds todos={state.todos} onSendReminder={sendReminder} onMarkDone={markDone} busyId={busyTodo} />
              <WhatsAppSent messages={state.messages.filter((m) => !dismissedMsgs.has(m.id))} onDismiss={dismissMsg} />
            </div>
          </div>

          <footer className="mt-2 pb-4 text-center text-[11px] text-muted">
            Galla · Paytm <span className="text-brand">×</span> OctoDeep · animated number by{' '}
            <a href="https://skiper-ui.com" target="_blank" rel="noreferrer" className="underline decoration-line">Skiper UI</a>
          </footer>
        </div>
      </div>

      <Nudges items={nudges} />
      <audio ref={audioRef} onEnded={() => setSpeaking(false)} hidden />
    </div>
  );
}
