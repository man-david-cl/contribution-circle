'use client';

import { useState } from 'react';

export function WithdrawalButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function request() {
    if (busy || !confirm('Submit a withdrawal request for the active contribution cycle?')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/withdrawals', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to submit your request. Please try again.');
      setMessage('Your withdrawal request has been submitted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'A network error occurred. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={request}>
        {busy ? 'Submitting…' : 'Request withdrawal'}
      </button>
      {message && <p role="status" aria-live="polite" className="muted" style={{ fontSize: 12, marginTop: 8 }}>{message}</p>}
    </div>
  );
}
