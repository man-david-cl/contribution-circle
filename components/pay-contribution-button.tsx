'use client';

import { useState } from 'react';

export function PayContributionButton({ cycleId }: { cycleId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function pay() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to start payment');
      window.location.assign(result.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be started');
      setLoading(false);
    }
  }

  return <div>
    <button className="btn btn-primary" type="button" disabled={loading} onClick={pay}>
      {loading ? 'Redirecting…' : 'Pay with Paystack'}
    </button>
    {error && <p role="alert" style={{ color: '#b42318', fontSize: 12, marginTop: 6 }}>{error}</p>}
  </div>;
}
