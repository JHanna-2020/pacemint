import { FormEvent, useState } from 'react';
import { Archive, Plus, Save } from 'lucide-react';
import { StatementProfile } from '../lib/types';
import { formatCurrency } from '../lib/money';

type Props = {
  profiles: StatementProfile[];
  onSave: (profiles: StatementProfile[]) => Promise<void>;
};

function ProfileRow({ profile, onUpdate, onArchive }: {
  profile: StatementProfile;
  onUpdate: (changes: Partial<Pick<StatementProfile, 'name' | 'statementBudget'>>) => Promise<void>;
  onArchive: () => Promise<void>;
}) {
  const [draftName, setDraftName] = useState(profile.name);
  const [draftBudget, setDraftBudget] = useState(profile.statementBudget);
  const archived = Boolean(profile.archivedAt);
  return (
    <article className="mini-row statement-profile-row">
      <div>
        <input aria-label={`Name for ${profile.name}`} value={draftName} disabled={archived} onChange={(event) => setDraftName(event.target.value)} />
        <small>Closes day {profile.closingDay}{archived ? ' · archived' : ''}</small>
      </div>
      <label>
        <span className="sr-only">Budget for {profile.name}</span>
        <input type="number" min="0" step="0.01" value={draftBudget} disabled={archived} onChange={(event) => setDraftBudget(Number(event.target.value))} />
      </label>
      <span>{formatCurrency(profile.statementBudget)}</span>
      {!archived && (
        <>
          <button className="icon-button" type="button" aria-label={`Save ${profile.name}`} onClick={() => void onUpdate({ name: draftName.trim() || profile.name, statementBudget: draftBudget })}><Save size={16} /></button>
          <button className="icon-button danger-button" type="button" aria-label={`Archive ${profile.name}`} onClick={() => void onArchive()}><Archive size={16} /></button>
        </>
      )}
    </article>
  );
}

export function StatementProfiles({ profiles, onSave }: Props) {
  const [name, setName] = useState('');
  const [closingDay, setClosingDay] = useState(1);
  const [statementBudget, setStatementBudget] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || statementBudget < 0) return;
    await onSave([
      ...profiles,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        closingDay: Math.min(31, Math.max(1, closingDay)),
        statementBudget,
        archivedAt: null
      }
    ]);
    setName('');
    setClosingDay(1);
    setStatementBudget(0);
  }

  async function update(profile: StatementProfile, changes: Partial<Pick<StatementProfile, 'name' | 'statementBudget'>>) {
    await onSave(profiles.map((item) => (item.id === profile.id ? { ...item, ...changes } : item)));
  }

  async function archive(profile: StatementProfile) {
    if (!confirm(`Archive "${profile.name}"? Its statement history will remain available.`)) return;
    await onSave(profiles.map((item) => (item.id === profile.id ? { ...item, archivedAt: new Date().toISOString() } : item)));
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Statement budgeting</p>
          <h2>Statement profiles</h2>
        </div>
      </div>
      <p className="settings-copy">
        Use a custom name only. PaceMint does not request or store card numbers, issuers, account details, or payment credentials.
      </p>
      <form className="compact-form" onSubmit={submit}>
        <label>
          Custom name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Main card" required />
        </label>
        <label>
          Statement closing day
          <input type="number" min="1" max="31" value={closingDay} onChange={(event) => setClosingDay(Number(event.target.value))} required />
        </label>
        <label>
          Statement budget
          <input type="number" min="0" step="0.01" value={statementBudget || ''} onChange={(event) => setStatementBudget(Number(event.target.value))} required />
        </label>
        <button className="primary-button" type="submit"><Plus size={17} /> Add profile</button>
      </form>
      <div className="mini-list">
        {profiles.length === 0 ? <p className="empty-state">No statement profiles yet.</p> : profiles.map((profile) => (
          <ProfileRow key={profile.id} profile={profile} onUpdate={(changes) => update(profile, changes)} onArchive={() => archive(profile)} />
        ))}
      </div>
    </section>
  );
}
