import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { ContributionLevelPicker } from '@/components/contribution-level-picker';

export default async function ContributionLevelsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles')
    .select('full_name,is_active,contribution_level').eq('id', user.id).single();
  if (!profile?.is_active) redirect('/dashboard');

  return <main className="container dashboard-shell">
    <header className="nav dashboard-nav">
      <Link href="/" className="brand">contribution<span>circle.</span></Link>
      <Link href="/dashboard" className="btn btn-secondary">Back to dashboard</Link>
    </header>
    <section className="card" style={{ maxWidth: 960, margin: '36px auto', padding: 28 }}>
      <div className="eyebrow">Choose your contribution plan</div>
      <h1 style={{ fontSize: 32, margin: '8px 0' }}>Select your contribution level</h1>
      <p className="muted">Your selected amount is what you contribute in every open cycle. Everyone contributes to the same shared pool, regardless of their selected level.</p>
      <ContributionLevelPicker currentAmount={profile.contribution_level ?? null} />
    </section>
  </main>;
}
