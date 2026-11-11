import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

export default async function WithdrawalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, bank_account_number')
    .eq('id', user.id)
    .single();

  if (!profile?.bank_account_number) redirect('/onboarding/bank');

  const { data: requests, error } = await supabase
    .from('withdrawal_requests')
    .select('id, status, created_at, request_note, admin_note, payment_reference, cycle_id')
    .eq('member_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <main className="container">
      <header className="nav">
        <Link href="/" className="brand">contribution<span>circle.</span></Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>Hello, {profile.full_name || 'Member'}</span>
          <form action="/auth/signout" method="post">
            <button className="btn btn-secondary">Log out</button>
          </form>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar card" style={{ padding: 15 }}>
          <div className="eyebrow" style={{ padding: '8px 12px' }}>Member workspace</div>
          <nav className="menu">
            <Link href="/dashboard">Overview</Link>
            <Link href="/dashboard#cycles">Contribution cycles</Link>
            <Link className="active" href="/withdrawal">My withdrawals</Link>
            <Link href="/onboarding/bank">Bank details</Link>
          </nav>
        </aside>

        <section className="main">
          <div style={{ marginBottom: 20 }}>
            <div className="eyebrow">Member workspace</div>
            <h1 style={{ fontSize: 30, margin: '8px 0' }}>My withdrawals</h1>
            <p className="muted" style={{ fontSize: 14 }}>
              View every withdrawal request you have submitted and track its progress.
            </p>
          </div>

          <section className="card" style={{ padding: 20 }}>
            <h3>Withdrawal request history</h3>
            {error ? (
              <p className="muted">We could not load your withdrawal requests. Please refresh the page.</p>
            ) : requests?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date submitted</th><th>Status</th><th>Request ID</th><th>Payment reference</th></tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.id}>
                        <td>{new Date(request.created_at).toLocaleDateString()}</td>
                        <td><span className="pill">{request.status}</span></td>
                        <td>{request.id.slice(0, 8).toUpperCase()}</td>
                        <td>{request.payment_reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '24px 8px', textAlign: 'center' }}>
                <h3>No withdrawal requests yet</h3>
                <p className="muted" style={{ fontSize: 14 }}>
                  When you submit a withdrawal request, it will appear here with its latest status.
                </p>
                <Link href="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 12 }}>
                  Return to dashboard
                </Link>
              </div>
            )}
          </section>

          {requests?.some((request) => request.request_note || request.admin_note) && (
            <section className="card" style={{ marginTop: 18, padding: 20 }}>
              <h3>Request notes</h3>
              {requests.filter((request) => request.request_note || request.admin_note).map((request) => (
                <div key={request.id} style={{ padding: '12px 0', borderBottom: '1px solid #e8ece9' }}>
                  <strong style={{ fontSize: 13 }}>Request {request.id.slice(0, 8).toUpperCase()}</strong>
                  {request.request_note && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Your note: {request.request_note}</p>}
                  {request.admin_note && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Admin response: {request.admin_note}</p>}
                </div>
              ))}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
