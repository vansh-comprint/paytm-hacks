import { motion, AnimatePresence } from 'motion/react';
import { Coins, Smartphone } from 'lucide-react';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const time = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// The day filling up. A quiet list, not a stack of cards. Cash rows carry the warm accent.
export default function Ledger({ sales }) {
  const rows = [...(sales || [])].reverse();
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Ledger</h2>
        <span className="text-[12px] text-muted tnum">{rows.length} logged</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-line bg-panel/60 px-4 py-5 text-[13.5px] text-muted">
          Say <span className="text-ink">“Paytm, pachaas cash Maggi”</span> to log the first sale.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius)] border border-line bg-panel">
          <AnimatePresence initial={false}>
            {rows.map((s) => {
              const cash = s.type === 'cash';
              return (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      cash ? 'bg-[oklch(0.95_0.04_80)] text-cash-ink' : 'bg-[oklch(0.95_0.03_235)] text-upi'
                    }`}
                  >
                    {cash ? <Coins size={16} /> : <Smartphone size={16} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">{s.item || 'Sale'}</span>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${cash ? 'text-cash-ink' : 'text-upi'}`}>
                    {cash ? 'Cash' : 'UPI'}
                  </span>
                  <span className="w-20 text-right text-[14.5px] font-semibold text-ink tnum">{inr(s.amount)}</span>
                  <span className="w-12 text-right text-[12px] text-muted tnum">{time(s.ts)}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
