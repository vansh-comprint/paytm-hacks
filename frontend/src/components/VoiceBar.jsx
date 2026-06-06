// The capture bar: text input (do-first path), the manual "Hey Paytm" mic button (the FLOOR),
// and a toggle to enable hands-free wake-word listening.
import { useState } from 'react';

export default function VoiceBar({
  onSendText, recording, onMicDown, onMicUp,
  wakeEnabled, onToggleWake, wakeStatus, busy,
}) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
  };

  return (
    <div className="voicebar card">
      <div className="vb-row">
        <input
          className="vb-input"
          type="text"
          value={text}
          placeholder='Type or speak — e.g. "Paytm, pachaas cash Maggi"  /  "aaj ka hisaab"'
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="vb-send" onClick={submit} disabled={busy}>Send</button>
        {/* The FLOOR: press-and-hold to record, mirrors the wake-word flow. */}
        <button
          className={`vb-mic ${recording ? 'rec' : ''}`}
          onMouseDown={onMicDown}
          onMouseUp={onMicUp}
          onMouseLeave={recording ? onMicUp : undefined}
          onTouchStart={(e) => { e.preventDefault(); onMicDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); onMicUp(); }}
          title="Hold to talk (Hey Paytm)"
        >
          {recording ? '● recording… release to send' : '🎤 Hold to talk'}
        </button>
      </div>
      <div className="vb-row sub">
        <label className="wake-toggle">
          <input type="checkbox" checked={wakeEnabled} onChange={onToggleWake} />
          <span>Hands-free wake word</span>
        </label>
        <span className="wake-status muted">{wakeEnabled ? wakeStatus : 'off — manual mic is the demo-safe path'}</span>
      </div>
    </div>
  );
}
