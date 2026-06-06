import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

// Bottom toasts for ambient/Listen mode — Galla logged something or needs a tap, no spoken reply.
export default function Nudges({ items }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((n) => (
          <motion.div
            key={n.id}
            initial={{ y: 14 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-[13px] text-ink shadow-[0_10px_30px_-14px_oklch(0.3_0.1_250/0.45)]"
          >
            <Check size={14} className="shrink-0 text-wa" />
            <span className="deva">{n.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
