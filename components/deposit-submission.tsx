'use client';

import { useState } from 'react';

type Props = { cycleId: string; amount: number; currency: string };

export function DepositSubmission({ cycleId, amount, currency }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) { setMessage('Please attach your transfer receipt.'); return; }
    setBusy(true); setMessage('');
    try {
      const body = new FormData();
      body.set('cycleId', cycleId);
      body.set('transferDate', date);
      body.set('reference', reference);
      body.set('note', note);
      body.set('receipt', file);
      const response = await fetch('/api/deposits', { method: 'POST', body });
      const raw = await response.text();
      let result: { error?: string } = {};
      try { result = raw ? JSON.parse(raw) : {}; } catch { throw new Error('The server returned an invalid response. Please refresh and try again.'); }
      if (!response.ok) throw new Error(result.error || 'Unable to submit your deposit.');
      setMessage('Deposit submitted successfully. It is waiting for administrator verification.');
      setFile(null); setReference(''); setNote('');
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to submit deposit.');
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="card" style={{ padding: 20, marginTop: 18 }}>
    <h3>Submit a deposit</h3>
    <p className="muted" style={{ fontSize: 13 }}>Transfer the exact cycle amount, then upload your receipt for verification.</p>
    <div className="stat" style={{ margin: '12px 0' }}>
      <span className="muted" style={{ fontSize: 12 }}>Amount to deposit</span>
      <strong>{new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)}</strong>
    </div>
    <label className="field-label">Transfer date</label>
    <input className="input" type="date" required value={date} onChange={e => setDate(e.target.value)} />
    <label className="field-label" style={{ display: 'block', marginTop: 12 }}>Transfer reference (optional)</label>
    <input className="input" value={reference} onChange={e => setReference(e.target.value)} maxLength={100} placeholder="Bank transfer reference" />
    <label className="field-label" style={{ display: 'block', marginTop: 12 }}>Receipt or payment screenshot</label>
    <input className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={e => setFile(e.target.files?.[0] || null)} />
    <p className="muted" style={{ fontSize: 11 }}>JPG, PNG, WEBP or PDF. Maximum file size: 5 MB.</p>
    <label className="field-label" style={{ display: 'block', marginTop: 12 }}>Note (optional)</label>
    <textarea className="input" rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Any extra payment information" />
    <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>{busy ? 'Submitting…' : 'Submit deposit for approval'}</button>
    {message && <p role="status" className="muted" style={{ fontSize: 13, marginTop: 10 }}>{message}</p>}
  </form>;
}
