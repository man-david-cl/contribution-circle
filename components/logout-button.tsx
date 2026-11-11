'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError('Unable to log out. Please check your connection and try again.');
      setBusy(false);
      return;
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <div>
      <button type="button" className="btn btn-secondary" onClick={logout} disabled={busy}>
        {busy ? 'Logging out…' : 'Log out'}
      </button>
      {error && <p role="alert" className="auth-message auth-error">{error}</p>}
    </div>
  );
}
