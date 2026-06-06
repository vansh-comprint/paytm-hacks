import { useCallback, useEffect, useRef, useState } from 'react';
import { api, blobToBase64, pickAudioMime } from './api.js';
import { useWakeWord } from './useWakeWord.js';
import VoiceBar from './components/VoiceBar.jsx';
import EodBoard from './components/EodBoard.jsx';
import LedgerFeed from './components/LedgerFeed.jsx';
import TodoPanel from './components/TodoPanel.jsx';
import CollectionsCard from './components/CollectionsCard.jsx';
import './App.css';

const WAKE_CAPTURE_MS = 4000; // how long we record after the wake word fires

export default function App() {
  const [state, setState] = useState({ sales: [], todos: [], messages: [], eod: null });
  const [online, setOnline] = useState(null); // null=unknown, true/false
  const [reply, setReply] = useState(null);    // { transcript, reply_text }
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
      setReply({ transcript: '', reply_text: '⚠ Backend offline — start Deep’s backend on :8000.' });
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
      setReply({ transcript: '', reply_text: '⚠ Mic permission denied — use the text box.' });
    }
  }, [sendTurn]);

  const stopRec = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }, []);

  // Wake word → record a fixed window, then send as mode:"wake".
  const onWake = useCallback(async () => {
    if (recRef.current) return;
    await startRec();
    setTimeout(stopRec, WAKE_CAPTURE_MS);
  }, [startRec, stopRec]);

  const { status: wakeStatus } = useWakeWord({ enabled: wakeEnabled, onWake });

  // ---- actions ----
  const sendText = (text) => sendTurn({ mode: 'text', text });
  const speakEod = () => sendTurn({ mode: 'text', text: 'aaj ka hisaab' }); // → spoken Hindi tally
  const markDone = (t) => sendTurn({ mode: 'text', text: `${t.item || t.text || ''} ho gaya` });

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
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">गल्ला</span>
          <div>
            <h1>Galla</h1>
            <p className="tagline">the voice till — cash + UPI, reconciled</p>
          </div>
        </div>
        <div className={`health ${online === false ? 'down' : online ? 'up' : ''}`}>
          <span className="dot" />
          {online === false ? 'backend offline' : online ? 'backend live' : 'connecting…'}
        </div>
      </header>

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
        <div className="reply card">
          {reply.transcript && <p className="reply-heard">“{reply.transcript}”</p>}
          <p className="reply-text">{reply.reply_text}</p>
        </div>
      )}

      <main className="grid">
        <div className="col-main">
          <EodBoard eod={state.eod} onSpeak={speakEod} speaking={speaking || busy} />
          <LedgerFeed sales={state.sales} />
        </div>
        <div className="col-side">
          <TodoPanel
            todos={state.todos}
            onSendReminder={sendReminder}
            onMarkDone={markDone}
            busyId={busyTodo}
          />
          <CollectionsCard messages={state.messages} />
        </div>
      </main>

      <audio ref={audioRef} onEnded={() => setSpeaking(false)} hidden />
    </div>
  );
}
