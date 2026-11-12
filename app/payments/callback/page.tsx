'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function PaymentCallbackContent() {
  const params = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';
  const [message, setMessage] = useState('Verifying your payment…');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    if (!reference) {
      setMessage('No payment reference was provided.');
      return;
    }
    fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payment verification failed');
      if (active) {
        setSuccess(true);
        setMessage('Your contribution payment has been confirmed.');
      }
    }).catch(error => {
      if (active) setMessage(error instanceof Error ? error.message : 'Verification failed. Please contact the administrator.');
    });
    return () => { active = false; };
  }, [reference]);

  return <main className="container" style={{ maxWidth: 620, paddingTop: 80 }}>
    <section className="card" style={{ padding: 28, textAlign: 'center' }}>
      <div className="eyebrow">Payment status</div>
      <h1 style={{ fontSize: 28, margin: '10px 0' }}>{success ? 'Payment successful' : 'Payment update'}</h1>
      <p className="muted">{message}</p>
      <Link className="btn btn-primary" href="/dashboard/contribute" style={{ display: 'inline-block', marginTop: 20 }}>Return to contributions</Link>
    </section>
  </main>;
}

export default function PaymentCallbackPage() {
  return <Suspense fallback={<main className="container" style={{ paddingTop: 80 }}>Loading payment status…</main>}>
    <PaymentCallbackContent />
  </Suspense>;
}
