// Live ledger — voice/text-logged sales as they land. Sale = { id, ts, type, amount, item, status }
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const time = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export default function LedgerFeed({ sales }) {
  const rows = [...(sales || [])].reverse(); // newest first
  return (
    <section className="card">
      <div className="card-head">
        <h3>Ledger</h3>
        <span className="muted">{rows.length} logged</span>
      </div>
      {rows.length === 0 && <p className="muted empty">Say “Paytm, pachaas cash Maggi” to log the first sale.</p>}
      <div className="feed">
        {rows.map((s) => (
          <div key={s.id} className="feed-row">
            <span className={`tag ${s.type}`}>{s.type === 'cash' ? 'CASH' : 'UPI'}</span>
            <span className="feed-item">{s.item || 'sale'}</span>
            <span className="feed-amt">{inr(s.amount)}</span>
            <span className="feed-time muted">{time(s.ts)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
