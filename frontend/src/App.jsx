import { useCallback, useEffect, useRef, useState } from 'react';
import { api, blobToBase64, pickAudioMime } from './api.js';
import { useWakeWord } from './useWakeWord.js';
import Brandmark from './components/Brandmark.jsx';
import Orb from './components/Orb.jsx';
import VoiceBar from './components/VoiceBar.jsx';
import Reveal from './components/Reveal.jsx';
import Ledger from './components/Ledger.jsx';
import LooseEnds from './components/LooseEnds.jsx';
import WhatsAppSent from './components/WhatsAppSent.jsx';

const WAKE_CAPTURE_MS = 4000; // record window after the wake word fires

export default function App() {
  const [state, setState] = useState({ sales: [], todos: [], messages: [], eod: null });
  const [online, setOnline] = useState(null);
  const [reply, setReply] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [busyTodo, setBusyTodo] = useState('');

  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  const refresh = useCallback(async () => {
    try {
      const s = await api.state();
      setState(s);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
    }
  }, [playAudio, refresh]);

  // ---- mic recording (shared by manual hold-to-talk + wake-word trigger) ----
  const startRec = useCallback(async () => {
    if (recRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data?.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recRef.current = null;
        setRecording(false);
        if (blob.size > 0) {
          const audioBase64 = await blobToBase64(blob);
          await sendTurn({ mode: 'wake', audioBase64 });
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      setRecording(false);
      setReply({ transcript: '', reply_text: 'Mic permission denied. Use the text box.' });
    }
  }, [sendTurn]);

  const stopRec = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }, []);

  const onWake = useCallback(async () => {
    if (recRef.current) return;
    await startRec();
    setTimeout(stopRec, WAKE_CAPTURE_MS);
  }, [startRec, stopRec]);

  const { status: wakeStatus } = useWakeWord({ enabled: wakeEnabled, onWake });

  const sendText = (text) => sendTurn({ mode: 'text', text });
  const speakEod = () => sendTurn({ mode: 'text', text: 'aaj ka hisaab' });
  // deterministic mark-done via /todo/done (was a fuzzy "X ho gaya" text turn that could mis-match)
  const markDone = async (t) => {
    try { await api.todoDone(t.id); await refresh(); }
    catch { setOnline(false); }
  };

  const sendReminder = async (t) => {
    setBusyTodo(t.id);
    try {
      await api.collectConfirm(t.id);
      await refresh();
    } catch {
      setOnline(false);
    } finally {
      setBusyTodo('');
    }
  };

  return (
    <div className="min-h-dvh bg-counter">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Brandmark online={online} />

        <div className="mt-6 grid gap-5">
          <div className="flex flex-col items-center pb-1 pt-2">
            <Orb className="h-40 w-40 sm:h-48 sm:w-48" listening={recording || wakeEnabled} />
            <p className="mt-1 deva text-[13.5px] text-muted">
              {recording ? 'सुन रहा हूँ…' : 'बोलो — मैं सुन रहा हूँ'}
            </p>
          </div>
          <VoiceBar
            onSendText={sendText}
            recording={recording}
            onMicDown={startRec}
            onMicUp={stopRec}
            wakeEnabled={wakeEnabled}
            onToggleWake={() => setWakeEnabled((v) => !v)}
            wakeStatus={wakeStatus}
            busy={busy}
          />

          {reply && (
            <div
              key={reply.reply_text}
              className="animate-fade-up rounded-[var(--radius)] border border-line bg-[oklch(0.97_0.018_235)] px-4 py-3"
            >
              {reply.transcript && <p className="text-[12.5px] italic text-muted">“{reply.transcript}”</p>}
              <p className="mt-0.5 deva text-[15px] font-medium leading-relaxed text-ink">{reply.reply_text}</p>
            </div>
          )}

          <Reveal eod={state.eod} onSpeak={speakEod} speaking={speaking || busy} />

          <div className="grid gap-5 md:grid-cols-[1.25fr_1fr]">
            <Ledger sales={state.sales} />
            <div className="grid gap-5">
              <LooseEnds
                todos={state.todos}
                onSendReminder={sendReminder}
                onMarkDone={markDone}
                busyId={busyTodo}
              />
              <WhatsAppSent messages={state.messages} />
            </div>
          </div>

          <footer className="mt-2 pb-4 text-center text-[11px] text-muted">
            Galla · Paytm <span className="text-brand">×</span> OctoDeep · animated number by{' '}
            <a href="https://skiper-ui.com" target="_blank" rel="noreferrer" className="underline decoration-line">Skiper UI</a>
          </footer>
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => setSpeaking(false)} hidden />
    </div>
  );
}
