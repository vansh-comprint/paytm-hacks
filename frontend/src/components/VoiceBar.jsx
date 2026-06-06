import { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Send, AudioLines } from 'lucide-react';

// The ask: type or speak to your munshi. Hold-to-talk is the demo-safe FLOOR;
// the toggle enables hands-free "Hey Paytm" listening.
export default function VoiceBar({
  onSendText, recording, onMicDown, onMicUp,
  wakeEnabled, onToggleWake, wakeStatus, busy,
}) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
  };

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

      <div className="flex items-center justify-between px-1 text-[12px]">
        <label className="inline-flex cursor-pointer items-center gap-2 text-ink-soft">
          <input
            type="checkbox"
            checked={wakeEnabled}
            onChange={onToggleWake}
            className="h-3.5 w-3.5 accent-[var(--color-brand)]"
          />
          Hands-free wake word
        </label>
        <span className="text-muted">
          {wakeEnabled ? wakeStatus : 'manual mic is the demo-safe path'}
        </span>
      </div>
    </section>
  );
}
