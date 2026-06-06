// Header: the Galla wordmark + the "Paytm × OctoDeep" co-brand + backend status.
// No gradient text (impeccable ban): solid ink, weight + size carry the hierarchy.

function StatusDot({ online }) {
  const label = online === false ? 'backend offline' : online ? 'backend live' : 'connecting';
  const tone =
    online === false ? 'text-danger' : online ? 'text-wa' : 'text-muted';
  const dot =
    online === false ? 'bg-danger' : online ? 'bg-wa' : 'bg-muted';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide ${tone}`}>
      <span className={`relative flex h-2 w-2`}>
        {online && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-60`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}

export default function Brandmark({ online }) {
  return (
    <header className="flex items-end justify-between gap-4 pt-1">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-[2rem] font-extrabold leading-none tracking-tight text-ink">
          Galla
        </h1>
        <span className="deva text-lg font-semibold text-brand">गल्ला</span>
        <span className="hidden text-sm text-muted sm:inline">· the voice till</span>
      </div>

      <div className="flex flex-col items-end gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Paytm <span className="text-brand">×</span> OctoDeep
        </p>
        <StatusDot online={online} />
      </div>
    </header>
  );
}
