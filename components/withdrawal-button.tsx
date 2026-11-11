'use client';
import { useState } from 'react';

export function WithdrawalButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function request() {
    if (!confirm('Submit a withdrawal request for the active contribution cycle?')) return;

    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/withdrawals', { method: 'POST' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to submit withdrawal request.');
      }

      setMessage('Your withdrawal request has been submitted. You can track it on My Withdrawals.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit withdrawal request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={request}
      >
        {busy ? 'Submitting…' : 'Withdraw'}
      </button>
      {message && (
        <p className="muted" role="status" style={{ fontSize: 12, marginTop: 8 }}>
          {message}
        </p>
      )}
    </div>
  );
}
