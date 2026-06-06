import { Power, Ear, MessageSquare } from 'lucide-react';

// Off · Listen · Talk. Listen = ambient (log-only, nudges). Talk = wake word "hey jarvis" (replies).
const MODES = [
  { id: 'off', label: 'Off', icon: Power },
  { id: 'listen', label: 'Listen', icon: Ear },
  { id: 'talk', label: 'Talk', icon: MessageSquare },
];

export default function ModeSwitch({ mode, onMode }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onMode(m.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              active ? 'bg-brand-ink text-surface' : 'text-muted hover:text-ink'
            }`}
            title={m.id === 'listen' ? 'Ambient — logs silently' : m.id === 'talk' ? 'Wake word "hey jarvis" — talks back' : 'Stop listening'}
          >
            <Icon size={14} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
