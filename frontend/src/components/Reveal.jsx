import { motion } from 'motion/react';
import { Volume2, Sparkles } from 'lucide-react';
import MoneyFlow from './MoneyFlow.jsx';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const EXPO = [0.16, 1, 0.3, 1];

// The hero, as a story: Paytm's number, then the cash Galla found, then the true day.
// Deliberately NOT a metric-card grid — the figures live inside the sentence.
export default function Reveal({ eod, onSpeak, speaking }) {
  if (!eod) {
    return (
      <section className="rounded-[var(--radius)] border border-line bg-panel p-6 text-muted">
        Waiting for the day to begin. Log a sale, then ask <span className="text-ink">“aaj ka hisaab”</span>.
      </section>
    );
  }
  const total = eod.total || 0;
  const cashPct = total ? Math.max(4, Math.round((eod.cash / total) * 100)) : 0;
  const upiPct = total ? Math.min(96, 100 - cashPct) : 0;

  const facts = [
    `${eod.sale_count} sales`,
    eod.busiest_hours && `busiest ${eod.busiest_hours}`,
    eod.top_items?.[0] && `most-wanted ${eod.top_items[0].name}`,
  ].filter(Boolean);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EXPO }}
      className="relative overflow-hidden rounded-[var(--radius)] border border-line bg-panel p-6 sm:p-7 shadow-[0_1px_0_oklch(1_0_0/0.7)_inset,0_24px_60px_-40px_oklch(0.3_0.1_250/0.55)]"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          <Sparkles size={13} className="text-brand" /> Aaj ka hisaab · the day, reconciled
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onSpeak}
          disabled={speaking}
          className="inline-flex items-center gap-2 rounded-full bg-brand-ink px-3.5 py-2 text-[13px] font-semibold text-surface disabled:opacity-50"
        >
          <Volume2 size={15} /> {speaking ? 'Bol raha…' : 'Suno'}
        </motion.button>
      </div>

      {/* the reconciliation sentence */}
      <p className="font-display text-[1.35rem] leading-snug text-ink-soft sm:text-[1.55rem]">
        Paytm saw <span className="font-bold tnum text-upi">{inr(eod.upi)}</span> online.
        <br className="hidden sm:block" />{' '}
        Galla heard <span className="font-bold tnum text-cash-ink">{inr(eod.cash)}</span> more in cash. The part no app saw.
      </p>

      {/* the true day — the figure as the climax, not a labelled stat box */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium uppercase tracking-wide text-muted">Your real day</span>
        <MoneyFlow value={total} className="font-display text-[2.9rem] font-extrabold leading-none tracking-tight text-ink tnum" />
      </div>

      {/* tactile till bar: cash is "found" second */}
      <div className="mt-5 flex h-3.5 w-full overflow-hidden rounded-full bg-[oklch(0.93_0.01_245)]">
        <motion.span
          className="block h-full bg-upi"
          style={{ width: `${upiPct}%`, transformOrigin: 'left' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: EXPO, delay: 0.15 }}
        />
        <motion.span
          className="block h-full bg-cash"
          style={{ width: `${cashPct}%`, transformOrigin: 'left' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: EXPO, delay: 0.65 }}
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <i className="h-2.5 w-2.5 rounded-full bg-upi" /> Online {inr(eod.upi)}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-cash-ink">
          <i className="h-2.5 w-2.5 rounded-full bg-cash" /> Cash {inr(eod.cash)} · {cashPct}% they were blind to
        </span>
      </div>

      {facts.length > 0 && (
        <p className="mt-5 border-t border-line-soft pt-4 text-[13px] text-muted">
          {facts.join('  ·  ')}
        </p>
      )}
      {eod.misses?.length > 0 && (
        <p className="mt-3 rounded-xl border border-[oklch(0.85_0.07_75)] bg-[oklch(0.96_0.04_80)] px-3.5 py-2.5 text-[13px] text-cash-ink">
          {eod.misses.length} asked for <b>{eod.misses.join(', ')}</b> you didn’t have.
        </p>
      )}
    </motion.section>
  );
}
