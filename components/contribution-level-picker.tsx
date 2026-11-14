'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LEVELS = [10000, 20000, 30000, 40000, 50000];
const money = (amount: number) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
}).format(amount);

export function ContributionLevelPicker({ currentAmount }: { currentAmount: number | null }) {
  const [selected, setSelected] = useState<number | null>(currentAmount);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const hasChanged = selected !== null && selected !== currentAmount;

  async function saveAndContinue() {
    if (!selected || !hasChanged || busy) return;
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
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save your level.');
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section className="level-picker" aria-labelledby="level-options-heading">
      <h2 id="level-options-heading" className="sr-only">Available contribution levels</h2>
      <div className="level-picker-grid">
        {LEVELS.map((amount, index) => {
          const active = selected === amount;
          const current = currentAmount === amount;
          return (
            <button
              key={amount}
              type="button"
              className={`level-option${active ? ' is-selected' : ''}`}
              onClick={() => { setSelected(amount); setConfirming(false); setError(''); }}
              aria-pressed={active}
              aria-label={`Level ${index + 1}, ${money(amount)} per contribution cycle${current ? ', your current level' : ''}`}
            >
              <span className="level-option-top">
                <span className="eyebrow">Level {index + 1}</span>
                {active && <span className="level-check" aria-hidden="true">✓</span>}
              </span>
              <strong className="level-price">{money(amount)}</strong>
              <span className="level-option-note">
                {current ? 'Your current level' : 'Per contribution cycle'}
              </span>
              {!current && <span className="level-option-note">Separate contribution circle</span>}
              {current && <span className="level-current-tag">Currently selected</span>}
            </button>
          );
        })}
      </div>

      <div className="level-change-note">
        <strong>Before you switch</strong>
        <p>Each contribution level has a separate circle and payout rotation. Changing levels moves you to a different circle and assigns a position number there. Your current circle must have no open cycle or unresolved withdrawal before a change can be made.</p>
      </div>

      {error && <p className="level-error" role="alert">{error}</p>}

      {confirming && hasChanged && selected !== null && (
        <div className="level-confirm" role="group" aria-labelledby="level-confirm-heading">
          <h3 id="level-confirm-heading">Confirm your contribution level</h3>
          <div className="level-confirm-values">
            <div><span>Current contribution</span><strong>{currentAmount ? money(currentAmount) : 'Not selected'}</strong></div>
            <div><span>New contribution</span><strong>{money(selected)}</strong></div>
          </div>
          <p>Your new circle will have its own member list and payout position. The position number may be different after you switch.</p>
          <div className="level-confirm-actions">
            <button className="btn btn-secondary" type="button" onClick={() => setConfirming(false)} disabled={busy}>Go back</button>
            <button className="btn btn-primary" type="button" onClick={saveAndContinue} disabled={busy}>
              {busy ? 'Updating membership…' : 'Confirm level change'}
            </button>
          </div>
        </div>
      )}

      <div className="level-picker-footer">
        <p className="muted level-selection-summary" aria-live="polite">
          {selected ? `Selected: ${money(selected)} per contribution cycle` : 'Choose a contribution level to continue.'}
        </p>
        <button
          className="btn btn-primary level-continue"
          type="button"
          disabled={!selected || !hasChanged || busy}
          onClick={() => { setConfirming(true); setError(''); }}
        >
          {currentAmount && selected === currentAmount
            ? 'Your current level'
            : currentAmount
              ? `Continue with ${selected ? money(selected) : 'selected level'}`
              : 'Join this contribution level'}
        </button>
      </div>
    </section>
  );
}
