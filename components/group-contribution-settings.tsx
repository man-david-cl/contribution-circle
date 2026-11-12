'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Group = {
  id: string; group_name: string; contribution_level: number; circle_number: number;
  contribution_amount: number; cycle_frequency: string; max_members: number;
  group_status: string; current_position: number; withdrawal_enabled: boolean;
};
type Member = { id: string; full_name: string | null; position_number: number | null; group_id: string | null; is_active: boolean };

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);
async function readJson(response: Response) {
  const raw = await response.text();
  try { return raw ? JSON.parse(raw) : {}; } catch { return { error: 'The server returned an invalid response.' }; }
}

export function GroupContributionSettings({ groups, members }: { groups: Group[]; members: Member[] }) {
  const router = useRouter();
  const [level, setLevel] = useState('1');
  const [capacity, setCapacity] = useState('50');
  const [frequency, setFrequency] = useState('monthly');
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function createGroup() {
    setBusy('create'); setMessage('');
    try {
      const r = await fetch('/api/admin/group-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: Number(level), max_members: Number(capacity), cycle_frequency: frequency, group_name: groupName }) });
      const j = await readJson(r); if (!r.ok) throw new Error(j.error || 'Could not create circle.');
      setMessage('New contribution circle created.'); setGroupName(''); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not create circle.'); }
    finally { setBusy(null); }
  }

  async function saveGroup(group: Group, form: HTMLFormElement) {
    const data = new FormData(form);
    setBusy(group.id); setMessage('');
    try {
      const r = await fetch('/api/admin/group-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        group_id: group.id, contribution_amount: Number(data.get('amount')), cycle_frequency: data.get('frequency'),
        max_members: Number(data.get('capacity')), group_status: data.get('status'),
      }) });
      const j = await readJson(r); if (!r.ok) throw new Error(j.error || 'Could not update circle.');
      setMessage(group.group_name + ' updated.'); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not update circle.'); }
    finally { setBusy(null); }
  }

  async function openCycle(group: Group) {
    if (!confirm('Open a new contribution cycle for ' + group.group_name + '?')) return;
    setBusy(group.id); setMessage('');
    try {
      const r = await fetch('/api/admin/cycles/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: group.id }) });
      const j = await readJson(r); if (!r.ok) throw new Error(j.error || 'Could not open cycle.');
      setMessage(j.data?.message || group.group_name + ' cycle #' + j.data?.cycle_number + ' is open.'); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not open cycle.'); }
    finally { setBusy(null); }
  }

  async function toggleWithdrawals(group: Group) {
    const next = !group.withdrawal_enabled;
    if (!confirm((next ? 'Enable' : 'Disable') + ' withdrawal access for ' + group.group_name + ' only?')) return;
    setBusy(group.id); setMessage('');
    try {
      const r = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: group.id, withdrawal_enabled: next }) });
      const j = await readJson(r); if (!r.ok) throw new Error(j.error || 'Could not update withdrawal access.');
      setMessage('Withdrawal access ' + (next ? 'enabled' : 'disabled') + ' for ' + group.group_name + '.'); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not update withdrawal access.'); }
    finally { setBusy(null); }
  }

  return <section className="card dashboard-section" style={{ padding: 20 }}>
    <div className="eyebrow">Group configuration</div>
    <h2 style={{ marginTop: 6 }}>Contribution levels and circles</h2>
    <p className="muted">Each circle has its own member numbers, contribution cycles, recipient and payout rotation. Rotations never cross between levels or circles.</p>
    <form onSubmit={e => { e.preventDefault(); void createGroup(); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end', margin: '18px 0 24px' }}>
      <label className="field-label">Level<select value={level} onChange={e => setLevel(e.target.value)}><option value="1">Level 1 · ₦10,000</option><option value="2">Level 2 · ₦20,000</option><option value="3">Level 3 · ₦30,000</option><option value="4">Level 4 · ₦40,000</option><option value="5">Level 5 · ₦50,000</option></select></label>
      <label className="field-label">Circle name<input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Optional name" /></label>
      <label className="field-label">Member capacity<input type="number" min="2" max="500" value={capacity} onChange={e => setCapacity(e.target.value)} /></label>
      <label className="field-label">Frequency<select value={frequency} onChange={e => setFrequency(e.target.value)}><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label>
      <button className="btn btn-primary" type="submit" disabled={busy !== null}>{busy === 'create' ? 'Creating…' : 'Create circle'}</button>
    </form>
    {groups.length === 0 ? <p className="muted">No circles configured yet. Apply the level-specific circles database migration to create the five starter levels.</p> : <div style={{ display: 'grid', gap: 14 }}>
      {groups.map(group => {
        const roster = members.filter(member => member.group_id === group.id).sort((a,b) => (a.position_number || 999999) - (b.position_number || 999999));
        const recipient = roster.find(member => member.is_active && member.position_number === group.current_position);
        return <article key={group.id} className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div><strong>{group.group_name}</strong><div className="muted" style={{ fontSize: 13 }}>Level {group.contribution_level} · Circle {group.circle_number} · {money(Number(group.contribution_amount))} per cycle</div></div>
            <span className="pill">{roster.length}/{group.max_members} members · {group.group_status}</span>
          </div>
          <form onSubmit={e => { e.preventDefault(); void saveGroup(group, e.currentTarget); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 10, alignItems: 'end', marginTop: 14 }}>
            <label className="field-label">Contribution (₦)<input name="amount" type="number" value={group.contribution_level * 10000} readOnly aria-readonly="true" /></label>
            <label className="field-label">Frequency<select name="frequency" defaultValue={group.cycle_frequency}><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label>
            <label className="field-label">Capacity<input name="capacity" type="number" min="2" max="500" defaultValue={group.max_members} /></label>
            <label className="field-label">Status<select name="status" defaultValue={group.group_status}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
            <button className="btn btn-secondary" type="submit" disabled={busy !== null}>{busy === group.id ? 'Saving…' : 'Save settings'}</button>
          </form>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <span className="pill">Current recipient: {recipient?.full_name || 'Not assigned'} · #{group.current_position}</span>
            <button className="btn btn-primary" type="button" disabled={busy !== null || group.group_status !== 'active'} onClick={() => void openCycle(group)}>Open cycle</button>
            <button className={group.withdrawal_enabled ? 'btn btn-danger' : 'btn btn-secondary'} type="button" disabled={busy !== null} onClick={() => void toggleWithdrawals(group)}>{group.withdrawal_enabled ? 'Disable withdrawals' : 'Enable withdrawals'}</button>
          </div>
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 13 }}>Members and rotation numbers</strong>
            {roster.length ? <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Number</th><th>Member name</th><th>Rotation</th><th>Status</th></tr></thead><tbody>{roster.map(member => <tr key={member.id}><td>#{String(member.position_number || 0).padStart(3,'0')}</td><td>{member.full_name || 'Member'}</td><td>{member.position_number === group.current_position ? 'Next recipient' : 'Waiting'}</td><td>{member.is_active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></div> : <p className="muted" style={{ fontSize: 13 }}>No members have selected this level and joined this circle yet.</p>}
          </div>
        </article>;
      })}
    </div>}
    {message && <p role="status" className="muted" style={{ marginTop: 12, fontSize: 13 }}>{message}</p>}
  </section>;
}
