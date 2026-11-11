import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { DepositSubmission } from '@/components/deposit-submission';

const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value || 0);

export default async function DepositsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: cycle }, { data: settings }, { data: deposits, error }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('contribution_cycles').select('id,cycle_number,month_label,contribution_amount,status,due_date')
      .in('status', ['open', 'collecting']).order('cycle_number', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('group_settings').select('currency,deposit_bank_name,deposit_account_name,deposit_account_number').limit(1).maybeSingle(),
    supabase.from('contributions').select('id,amount,status,transfer_date,payment_reference,created_at,review_note,cycle:contribution_cycles(month_label,cycle_number)')
      .eq('member_id', user.id).order('created_at', { ascending: false }).limit(30)
  ]);

  const currency = settings?.currency || 'NGN';
  const totalApproved = (deposits || []).filter(d => d.status === 'verified').reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const pending = (deposits || []).filter(d => ['pending', 'submitted'].includes(d.status)).reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const alreadySubmitted = Boolean(cycle && deposits?.some(d => (d as any).cycle?.cycle_number === cycle.cycle_number));
  const bankConfigured = Boolean(settings?.deposit_bank_name && settings?.deposit_account_name && settings?.deposit_account_number);

  return <main className="container">
    <header className="nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="muted" style={{ fontSize: 13 }}>Hello, {profile?.full_name || 'Member'}</span><Link className="btn btn-secondary" href="/dashboard">Back to dashboard</Link></div></header>
    <div className="layout">
      <aside className="sidebar card" style={{ padding: 15 }}><div className="eyebrow" style={{ padding: '8px 12px' }}>Member workspace</div><nav className="menu">
        <Link href="/dashboard">Overview</Link><Link href="/dashboard#cycles">Contribution cycles</Link><Link className="active" href="/deposits">My deposits</Link><Link href="/withdrawal">My withdrawals</Link><Link href="/onboarding/bank">Bank details</Link>
      </nav></aside>
      <section className="main">
        <div className="eyebrow">Member workspace</div><h1 style={{ fontSize: 30, margin: '8px 0' }}>My deposits</h1>
        <p className="muted" style={{ fontSize: 14 }}>Submit your bank transfer receipt and follow its verification status.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 13, marginTop: 18 }}>
          <div className="card stat"><span className="muted">Confirmed deposits</span><strong>{money(totalApproved, currency)}</strong></div>
          <div className="card stat"><span className="muted">Awaiting approval</span><strong>{money(pending, currency)}</strong></div>
          <div className="card stat"><span className="muted">Current cycle amount</span><strong>{cycle ? money(Number(cycle.contribution_amount), currency) : '—'}</strong></div>
        </div>
        <section className="card" style={{ padding: 20, marginTop: 18 }}>
          <h3>Group bank transfer details</h3>
          {bankConfigured ? <div className="recipient-grid">
            <div><small>Bank</small><strong>{settings?.deposit_bank_name}</strong></div>
            <div><small>Account name</small><strong>{settings?.deposit_account_name}</strong></div>
            <div><small>Account number</small><strong>{settings?.deposit_account_number}</strong></div>
          </div> : <p className="muted" style={{ fontSize: 13 }}>The administrator has not added the group's deposit account details yet. Please check back later.</p>}
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Only transfer to the account details displayed here. Contact the administrator if anything looks incorrect.</p>
        </section>
        {cycle ? <section className="card" style={{ padding: 20, marginTop: 18 }}>
          <h3>Current contribution cycle: #{cycle.cycle_number}</h3>
          <p className="muted" style={{ fontSize: 13 }}>{cycle.month_label} · Due {cycle.due_date ? new Date(cycle.due_date + 'T00:00:00').toLocaleDateString() : 'date not set'} · {money(Number(cycle.contribution_amount), currency)}</p>
          {!bankConfigured ? <p className="muted">Deposit submission will be available after the administrator configures the group's bank details.</p>
            : alreadySubmitted ? <p className="pill">You have already submitted a deposit for this cycle.</p>
            : <DepositSubmission cycleId={cycle.id} amount={Number(cycle.contribution_amount)} currency={currency} />}
        </section> : <section className="card" style={{ padding: 20, marginTop: 18 }}><h3>No open contribution cycle</h3><p className="muted" style={{ fontSize: 13 }}>The administrator must open a contribution cycle before you can submit a deposit.</p></section>}
        <section className="card" style={{ padding: 20, marginTop: 18 }}>
          <h3>Deposit history</h3>
          {error ? <p className="muted">Could not load your deposit history. Refresh the page to try again.</p> : deposits?.length ? <div className="table-wrap"><table><thead><tr><th>Cycle</th><th>Amount</th><th>Transfer date</th><th>Status</th><th>Admin note</th></tr></thead><tbody>
            {deposits.map((d: any) => <tr key={d.id}><td>{d.cycle?.month_label || 'Contribution cycle'}</td><td>{money(Number(d.amount), currency)}</td><td>{d.transfer_date ? new Date(d.transfer_date + 'T00:00:00').toLocaleDateString() : new Date(d.created_at).toLocaleDateString()}</td><td><span className="pill">{d.status}</span></td><td>{d.review_note || '—'}</td></tr>)}
          </tbody></table></div> : <p className="muted" style={{ fontSize: 13 }}>You have not submitted any deposits yet.</p>}
        </section>
      </section>
    </div>
  </main>;
}
