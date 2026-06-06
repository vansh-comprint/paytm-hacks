// THE HERO. Renders Deep's Eod shape:
// { total, cash, upi, sale_count, busiest_hours: string|null, top_items: {name,count}[], misses: string[] }
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function EodBoard({ eod, onSpeak, speaking }) {
  if (!eod) return null;
  const cashPct = eod.total ? Math.round((eod.cash / eod.total) * 100) : 0;

  return (
    <section className="eod card hero">
      <div className="eod-head">
        <div>
          <p className="eyebrow">End of day · आज का हिसाब</p>
          <h2 className="eod-total">{inr(eod.total)}</h2>
        </div>
        <button className="speak" onClick={onSpeak} disabled={speaking}>
          {speaking ? '🔊 …' : '🔊 सुनाओ'}
        </button>
      </div>

      <div className="split-bar" title={`${cashPct}% cash`}>
        <span className="split-upi" style={{ width: `${100 - cashPct}%` }} />
        <span className="split-cash" style={{ width: `${cashPct}%` }} />
      </div>
      <div className="split-legend">
        <span><i className="dot upi" /> Online (UPI) {inr(eod.upi)}</span>
        <span className="cash-hi"><i className="dot cash" /> Cash {inr(eod.cash)} — the blind spot</span>
      </div>

      <div className="eod-grid">
        <Stat label="Sales" value={eod.sale_count} />
        <Stat label="Busiest" value={eod.busiest_hours || '—'} />
        <Stat label="Top item" value={eod.top_items?.[0]?.name || '—'} />
      </div>

      {eod.top_items?.length > 0 && (
        <div className="chips">
          {eod.top_items.map((t) => (
            <span key={t.name} className="chip">{t.name} ×{t.count}</span>
          ))}
        </div>
      )}

      {eod.misses?.length > 0 && (
        <p className="misses">⚠ Walked-out demand: {eod.misses.join(', ')}</p>
      )}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
