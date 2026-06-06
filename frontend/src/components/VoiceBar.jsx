import { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Send, AudioLines } from 'lucide-react';
import ModeSwitch from './ModeSwitch.jsx';

// Capture bar: text + hold-to-talk (the FLOOR) + the Off/Listen/Talk mode switch.
export default function VoiceBar({
  onSendText, recording, onMicDown, onMicUp, mode, onMode, wakeStatus, busy,
}) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
  };

  const hint =
    mode === 'talk' ? wakeStatus   // e.g. 'armed (say "hey jarvis" / "alexa")'
    : mode === 'listen' ? 'Ambient — Galla logs quietly, no reply'
    : 'Hold to talk is the demo-safe path';

  return (
    <section aria-label="Talk to Galla" className="grid gap-3">
      <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-panel p-1.5 shadow-[0_1px_0_oklch(1_0_0/0.6)_inset,0_8px_24px_-18px_oklch(0.3_0.1_250/0.5)]">
        <span className="grid h-9 w-9 shrink-0 place-items-center text-brand">
          <AudioLines size={19} strokeWidth={2} />
        </span>
        <input
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink placeholder:text-muted/80 focus:outline-none"
          value={text}
          placeholder='Bolo ya likho — "Paytm, pachaas cash Maggi"'
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="Type a sale or a question"
        />
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={submit}
          disabled={busy || !text.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-ink text-surface disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={16} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onPointerDown={(e) => { e.preventDefault(); onMicDown(); }}
          onPointerUp={(e) => { e.preventDefault(); onMicUp(); }}
          onPointerLeave={() => recording && onMicUp()}
          className={`grid h-9 shrink-0 place-items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
            recording ? 'bg-danger text-white' : 'bg-brand text-surface'
          }`}
          aria-label="Hold to talk"
          title="Hold to talk"
        >
          <span className="flex items-center gap-1.5">
            <Mic size={15} />
            {recording ? 'Recording…' : 'Hold'}
          </span>
        </motion.button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <ModeSwitch mode={mode} onMode={onMode} />
        <span className={`text-[12px] ${mode === 'listen' ? 'text-wa' : 'text-muted'}`}>{hint}</span>
      </div>
    </section>
  );
}
