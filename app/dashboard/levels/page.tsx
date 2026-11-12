import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { ContributionLevelPicker } from '@/components/contribution-level-picker';

export default async function ContributionLevelsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles')
    .select('full_name,is_active,contribution_level,group_id,position_number').eq('id', user.id).single();
  if (!profile?.is_active) redirect('/dashboard');

  return <main className="container dashboard-shell">
    <header className="nav dashboard-nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><Link href="/dashboard" className="btn btn-secondary">Back to dashboard</Link></header>
    <section className="card" style={{ maxWidth: 960, margin: '36px auto', padding: 28 }}>
      <div className="eyebrow">Choose your contribution plan</div>
      <h1 style={{ fontSize: 32, margin: '8px 0' }}>Select your contribution level</h1>
      <p className="muted">You will join a circle with members contributing the same level. Each circle has its own names, position numbers and payout rotation.</p>
      {profile.group_id && <p className="muted">Your current position number is <strong>#{String(profile.position_number || 0).padStart(3,'0')}</strong>.</p>}
      <ContributionLevelPicker currentAmount={profile.contribution_level ?? null} />
    </section>
  </main>;
}
