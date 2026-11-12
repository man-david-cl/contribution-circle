'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Cycle = {
  id: string;
  cycle_number: number;
  month_label: string;
  contribution_amount: number;
  status: string;
  due_date: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

const money = (value: number) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
}).format(value || 0);

async function readJson(response: Response) {
  const raw = await response.text();
  try { return raw ? JSON.parse(raw) : {}; }
  catch { return { error: 'The server returned an invalid response.' }; }
}

export function AdminCycleManager({ cycles }: { cycles: Cycle[] }) {
  const router = useRouter();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function cancelCycle(cycle: Cycle) {
    const reason = (reasons[cycle.id] || '').trim();
    if (reason.length < 10) {
      setMessage('Enter a clear cancellation reason of at least 10 characters.');
      return;
    }
    if (!window.confirm(
      'Cancel Cycle #' + cycle.cycle_number + '? Its pending contributions will be marked cancelled. No payment will be recorded, no refund will be issued, and the rotation will not advance.'
    )) return;

    setBusy(cycle.id);
    setMessage('');
    try {
      const response = await fetch('/api/admin/cycles/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycle.id, reason }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'Could not cancel this cycle.');
      setMessage('Cycle #' + cycle.cycle_number + ' cancelled. Its history has been retained and the rotation was not advanced.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not cancel this cycle.');
    } finally {
      setBusy(null);
    }
  }

  return <section className="card dashboard-section" id="cycle-management">
    <div className="section-heading">
      <div><h2>Contribution cycle management</h2><p>Review cycle history and cancel unpaid cycles with an administrator reason.</p></div>
      <span className="section-count">{cycles.length} cycles</span>
    </div>
    {cycles.length ? <div className="table-wrap">
      <table className="dashboard-table">
        <thead><tr><th>Cycle</th><th>Amount</th><th>Due date</th><th>Status</th><th>Administrative action</th></tr></thead>
        <tbody>{cycles.map(cycle => <tr key={cycle.id}>
          <td>{cycle.month_label || 'Cycle'} · #{cycle.cycle_number}</td>
          <td>{money(Number(cycle.contribution_amount))}</td>
          <td>{cycle.due_date ? new Date(cycle.due_date + 'T00:00:00').toLocaleDateString('en-NG') : '—'}</td>
          <td><span className="pill">{cycle.status}</span>{cycle.cancelled_at && <div className="muted" style={{ fontSize: 12 }}>Cancelled {new Date(cycle.cancelled_at).toLocaleString('en-NG')}</div>}</td>
          <td style={{ minWidth: 250 }}>
            {['open', 'collecting'].includes(cycle.status) ? <div style={{ display: 'grid', gap: 7 }}>
              <input
                aria-label={'Cancellation reason for cycle ' + cycle.cycle_number}
                value={reasons[cycle.id] || ''}
                onChange={event => setReasons(current => ({ ...current, [cycle.id]: event.target.value }))}
                placeholder="Reason (10–500 characters)"
                maxLength={500}
              />
              <button className="btn btn-danger" type="button" disabled={busy !== null || (reasons[cycle.id] || '').trim().length < 10} onClick={() => void cancelCycle(cycle)}>
                {busy === cycle.id ? 'Cancelling…' : 'Cancel unpaid cycle'}
              </button>
            </div> : cycle.status === 'cancelled' ? <span className="muted" title={cycle.cancellation_reason || ''}>Cancelled — history retained</span> : <span className="muted">No action available</span>}
          </td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="muted">No contribution cycles have been created yet.</p>}
    {message && <p role="status" className="muted" style={{ marginTop: 12, fontSize: 13 }}>{message}</p>}
    <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Cancellation is blocked if a verified contribution, contribution transaction, or withdrawal request exists. Any payment already captured by the provider must be reconciled separately.</p>
  </section>;
}
