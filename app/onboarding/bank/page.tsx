
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type BankProfile = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
};

export default function BankSetup() {
  const router = useRouter();
  const [profile, setProfile] = useState<BankProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('bank_name, bank_account_name, bank_account_number')
        .eq('id', user.id)
        .single();

      if (error) {
        setError(error.message);
      } else if (data) {
        setProfile(data);
        setBankName(data.bank_name || '');
        setAccountName(data.bank_account_name || '');
        setAccountNumber(data.bank_account_number || '');
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  function startEditing() {
    setBankName(profile?.bank_name || '');
    setAccountName(profile?.bank_account_name || '');
    setAccountNumber(profile?.bank_account_number || '');
    setError('');
    setEditing(true);
  }

  function cancelEditing() {
    setBankName(profile?.bank_name || '');
    setAccountName(profile?.bank_account_name || '');
    setAccountNumber(profile?.bank_account_number || '');
    setError('');
    setEditing(false);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setError('Please complete all bank details.');
      return;
    }

    if (!/^\d{10}$/.test(accountNumber.trim())) {
      setError('Please enter a valid 10-digit account number.');
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const updatedDetails = {
        bank_name: bankName.trim(),
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updatedDetails)
        .eq('id', user.id)
        .select('id')
        .maybeSingle();

      if (error) {
        setError(error.message);
        return;
      }

      if (!data) {
        setError('Your profile was not updated. Please contact support.');
        return;
      }

      setProfile(updatedDetails);
      setEditing(false);
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong while saving your bank details.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p>Loading your bank details...</p>
      </main>
    );
  }

  if (error && !profile && !editing) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (profile && !editing) {
    return (
      <main className="mx-auto max-w-md p-6">
        <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              My bank details
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Your saved payment information.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Bank name</p>
              <p className="font-medium text-slate-900">
                {profile.bank_name}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Account name</p>
              <p className="font-medium text-slate-900">
                {profile.bank_account_name}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Account number</p>
              <p className="font-medium text-slate-900">
                {profile.bank_account_number}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={startEditing}
            className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Edit bank details
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <form
        onSubmit={save}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {profile ? 'Edit bank details' : 'Bank details'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {profile
              ? 'Update your saved bank information.'
              : 'Add your bank information to complete onboarding.'}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="bank_name" className="block text-sm font-medium text-slate-700">
            Bank name
          </label>
          <input
            id="bank_name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="bank_account_name" className="block text-sm font-medium text-slate-700">
            Account name
          </label>
          <input
            id="bank_account_name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="bank_account_number" className="block text-sm font-medium text-slate-700">
            Account number
          </label>
          <input
            id="bank_account_number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            type="text"
            inputMode="numeric"
            maxLength={10}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Saving...' : 'Save bank details'}
        </button>

        {profile && (
          <button
            type="button"
            onClick={cancelEditing}
            disabled={busy}
            className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
        )}
      </form>
    </main>
  );
}
