// To-dos: restock / collect / pay. Collections (kind:"collect") get a consent "Send reminder"
// that calls POST /collect/confirm. Restock/pay just display + optional best-effort mark-done.
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const KIND_LABEL = { restock: '🛒 Restock', collect: '💰 Collect', pay: '💸 Pay' };

export default function TodoPanel({ todos, onSendReminder, onMarkDone, busyId }) {
  const open = (todos || []).filter((t) => t.status === 'open');
  return (
    <section className="card">
      <div className="card-head">
        <h3>To-dos</h3>
        <span className="muted">{open.length} open</span>
      </div>
      {open.length === 0 && <p className="muted empty">Nothing pending.</p>}
      <div className="todos">
        {open.map((t) => (
          <div key={t.id} className={`todo ${t.kind}`}>
            <div className="todo-main">
              <span className="kind">{KIND_LABEL[t.kind] || t.kind}</span>
              <span className="todo-text">
                {t.kind === 'collect'
                  ? <><b>{t.customer}</b> · {inr(t.amount)}{t.item ? ` (${t.item})` : ''}</>
                  : (t.text || t.item)}
              </span>
            </div>
            <div className="todo-actions">
              {t.kind === 'collect' ? (
                <button
                  className="mini primary"
                  disabled={busyId === t.id || t.reminded}
                  onClick={() => onSendReminder(t)}
                >
                  {t.reminded ? '✓ reminded' : busyId === t.id ? '…' : 'Send reminder'}
                </button>
              ) : (
                <button className="mini ghost" onClick={() => onMarkDone(t)}>done</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
