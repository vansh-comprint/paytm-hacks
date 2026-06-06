import { motion } from 'motion/react';
import { ShoppingBasket, HandCoins, Check, Send } from 'lucide-react';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// Udhaar to collect (consent reminder) + restock. List rows with full borders — no side-stripes.
export default function LooseEnds({ todos, onSendReminder, onMarkDone, busyId }) {
  const open = (todos || []).filter((t) => t.status === 'open');
  const collect = open.filter((t) => t.kind === 'collect');
  const other = open.filter((t) => t.kind !== 'collect');

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Loose ends</h2>
        <span className="text-[12px] text-muted tnum">{open.length} open</span>
      </div>

      {open.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-line bg-panel/60 px-4 py-5 text-[13.5px] text-muted">
          All settled. Nothing to chase.
        </p>
      ) : (
        <div className="grid gap-2">
          {collect.map((t) => (
            <Row key={t.id} icon={<HandCoins size={15} />} tone="cash">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{t.customer}</p>
                <p className="text-[12.5px] text-muted">
                  <span className="tnum text-cash-ink">{inr(t.amount)}</span> udhaar{t.item ? ` · ${t.item}` : ''}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                disabled={busyId === t.id || t.reminded}
                onClick={() => onSendReminder(t)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-wa/12 px-3 py-2 text-[12.5px] font-semibold text-wa disabled:opacity-60"
              >
                {t.reminded ? <><Check size={14} /> Reminded</> : <><Send size={13} /> {busyId === t.id ? '…' : 'Remind'}</>}
              </motion.button>
            </Row>
          ))}

          {other.map((t) => (
            <Row key={t.id} icon={<ShoppingBasket size={15} />} tone="brand">
              <p className="min-w-0 flex-1 truncate text-[14px] text-ink">{t.item || t.text}</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onMarkDone(t)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-soft"
              >
                <Check size={14} /> Done
              </motion.button>
            </Row>
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ icon, tone, children }) {
  const chip = tone === 'cash' ? 'bg-cash/15 text-cash' : 'bg-brand/15 text-brand';
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-panel px-3.5 py-3">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${chip}`}>{icon}</span>
      {children}
    </div>
  );
}
