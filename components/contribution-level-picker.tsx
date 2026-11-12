'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LEVELS = [10000, 20000, 30000, 40000, 50000];
const money = (amount: number) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
}).format(amount);

export function ContributionLevelPicker({ currentAmount }: { currentAmount: number | null }) {
  const [selected, setSelected] = useState<number | null>(currentAmount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function saveAndContinue() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/member/contribution-level', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selected }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save your level.');
      router.push('/dashboard/contribute');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save your level.');
      setBusy(false);
    }
  }

  return <div style={{ marginTop: 26 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
      {LEVELS.map((amount, index) => {
        const active = selected === amount;
        const current = currentAmount === amount;
        return <button key={amount} type="button" onClick={() => setSelected(amount)}
          aria-pressed={active}
          style={{ textAlign: 'left', padding: 18, minHeight: 132, borderRadius: 14,
            border: active ? '2px solid #2563eb' : '1px solid var(--border, #dbe2ea)',
            background: active ? 'rgba(37,99,235,.08)' : 'var(--card, #fff)', cursor: 'pointer' }}>
          <span className="eyebrow">{index === 0 ? 'Starter level' : index === 4 ? 'Highest level' : 'Level ' + (index + 1)}</span>
          <strong style={{ display: 'block', fontSize: 24, marginTop: 12 }}>{money(amount)}</strong>
          <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 8 }}>
            {current ? 'Your current level' : active ? 'Selected' : 'Per contribution cycle'}
          </span>
        </button>;
      })}
    </div>
    <p className="muted" style={{ fontSize: 13, marginTop: 18 }}>
      {currentAmount ? 'Current level: ' + money(currentAmount) + '. You can upgrade or change your level at any time. Your new amount applies to future payments; already confirmed payments are not changed.' : 'Choose a level to get started. You can upgrade later, and your new level will apply to future payments.'}
    </p>
    {error && <p role="alert" style={{ color: '#b42318', marginTop: 12 }}>{error}</p>}
    <button className="btn btn-primary" type="button" disabled={!selected || busy}
      onClick={saveAndContinue} style={{ marginTop: 10 }}>
      {busy ? 'Saving level…' : currentAmount ? 'Save level and continue to deposits' : 'Continue to deposits'}
    </button>
  </div>;
}
