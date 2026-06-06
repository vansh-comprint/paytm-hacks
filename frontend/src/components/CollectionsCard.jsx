// WhatsApp message cards returned by POST /collect/confirm.
// Message = { id, ts, to, channel, body, link?, mock }
const time = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export default function CollectionsCard({ messages }) {
  const rows = [...(messages || [])].reverse();
  if (rows.length === 0) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h3>WhatsApp sent</h3>
        <span className="muted">{rows.length}</span>
      </div>
      <div className="messages">
        {rows.map((m) => (
          <div key={m.id} className="wa-card">
            <div className="wa-head">
              <span className="wa-channel">WhatsApp · {m.to || '—'}</span>
              <span className={`badge ${m.mock ? 'mock' : 'real'}`}>{m.mock ? 'MOCK' : 'SENT'}</span>
            </div>
            <p className="wa-body">{m.body}</p>
            {m.link && <a className="wa-link" href={m.link} target="_blank" rel="noreferrer">{m.link}</a>}
            <span className="wa-time muted">{time(m.ts)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
