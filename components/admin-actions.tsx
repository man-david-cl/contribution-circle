'use client';

import { useState } from 'react';

export function AdminActions({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function act(action: 'approve' | 'reject' | 'paid') {
    if (busy) return;
    if (action === 'paid' && !confirm('Confirm that the recipient has actually received the payment? This advances the rotation.')) return;

    setBusy(true);
    setMsg('');
    try {
      const response = await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to update this withdrawal. Please try again.');
      window.location.reload();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'A network error occurred. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {status === 'pending' && (
        <>
          <button type="button" disabled={busy} className="btn btn-secondary" onClick={() => act('approve')}>
            {busy ? 'Please wait…' : 'Approve'}
          </button>
          <button type="button" disabled={busy} className="btn btn-danger" onClick={() => act('reject')}>
            Reject
          </button>
        </>
      )}
      {status === 'approved' && (
        <button type="button" disabled={busy} className="btn btn-primary" onClick={() => act('paid')}>
          {busy ? 'Please wait…' : 'Confirm paid'}
        </button>
      )}
      {msg && <small role="alert" style={{ color: '#b43c30' }}>{msg}</small>}
    </div>
  );
}
