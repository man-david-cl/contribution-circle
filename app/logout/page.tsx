import Link from 'next/link';

export default function LogoutPage() {
  return (
    <main className="auth-shell">
      <aside className="auth-side">
        <div className="brand">contribution<span style={{ color: '#9ed2b9' }}>circle.</span></div>
        <div>
          <div className="eyebrow" style={{ color: '#9ed2b9' }}>Session ended</div>
          <h1 style={{ fontSize: 48, lineHeight: 1.05 }}>Your circle<br />is always here.</h1>
          <p style={{ color: '#c3ded2', lineHeight: 1.7 }}>Thank you for keeping your contribution group organized. Sign in again whenever you are ready.</p>
        </div>
        <small style={{ color: '#c3ded2' }}>For your security, close any shared browser window.</small>
      </aside>
      <section className="auth-main">
        <div className="auth-box card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, borderRadius: 18, background: '#e7f3ed', color: '#176b52', display: 'grid', placeItems: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
          <div className="eyebrow">Logged out</div>
          <h1 style={{ fontSize: 30, margin: '12px 0 8px' }}>You have been logged out</h1>
          <p className="muted" style={{ lineHeight: 1.7, marginBottom: 24 }}>Your Contribution Circle session has ended successfully.</p>
          <Link className="btn btn-primary" style={{ width: '100%' }} href="/login">Log in again</Link>
          <p style={{ marginTop: 18, fontSize: 13 }}><Link className="muted" href="/">Return to homepage</Link></p>
        </div>
      </section>
    </main>
  );
}
