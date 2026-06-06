import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X } from 'lucide-react';

const time = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// Reminder cards from POST /collect/confirm. Each can be dismissed with the × (local view only).
export default function WhatsAppSent({ messages, onDismiss }) {
  const rows = [...(messages || [])].reverse();
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Reminders sent</h2>
        <span className="text-[12px] text-muted tnum">{rows.length}</span>
      </div>
      <div className="grid gap-2">
        <AnimatePresence initial={false}>
          {rows.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ y: -6 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[var(--radius)] border border-line bg-panel p-3.5"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-wa">
                  <MessageCircle size={14} /> {m.to || 'WhatsApp'}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      m.mock ? 'bg-cash/15 text-cash-ink' : 'bg-wa/15 text-wa'
                    }`}
                  >
                    {m.mock ? 'Mock' : 'Sent'}
                  </span>
                  <button
                    onClick={() => onDismiss?.(m.id)}
                    className="grid h-5 w-5 place-items-center rounded text-muted transition-colors hover:bg-line-soft hover:text-ink"
                    aria-label="Dismiss reminder"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{m.body}</p>
              {m.link && (
                <a href={m.link} target="_blank" rel="noreferrer" className="mt-1.5 inline-block break-all text-[12px] text-brand">
                  {m.link}
                </a>
              )}
              <span className="mt-1.5 block text-[11px] text-muted tnum">{time(m.ts)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
