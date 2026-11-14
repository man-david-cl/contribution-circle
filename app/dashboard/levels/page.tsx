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

  return (
    <main className="container dashboard-shell levels-page">
      <header className="nav dashboard-nav">
        <Link href="/" className="brand">contribution<span>circle.</span></Link>
        <Link href="/dashboard" className="btn btn-secondary">Back to dashboard</Link>
      </header>
      <section className="card levels-panel">
        <div className="eyebrow">Choose your contribution plan</div>
        <h1>Select your contribution level</h1>
        <p className="muted levels-intro">
          Choose the amount you want to contribute each cycle. You will join a circle with members contributing at the same level. Each circle has its own members, position numbers and payout rotation.
        </p>
        {profile.group_id && (
          <div className="levels-current-position">
            <span>Your current circle position</span>
            <strong>#{String(profile.position_number || 0).padStart(3, '0')}</strong>
          </div>
        )}
        <ContributionLevelPicker currentAmount={profile.contribution_level ?? null} />
      </section>
    </main>
  );
}
