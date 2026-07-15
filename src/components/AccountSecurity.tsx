import { FormEvent, useState } from 'react';
import { changeEncryptionPassword, unlockWithPassword } from '../lib/encryptionSession';
import { supabase } from '../lib/supabase';
import { PasswordField } from './PasswordField';

type Props = {
  email: string;
  userId: string;
  onMessage: (message: string) => void;
};

// Best-effort rollback after an Auth password-update failure: the vault was
// already re-wrapped under the new password. Retry a few times -- a
// transient failure here is worse than one on the forward path, since it
// leaves Auth and the vault expecting different passwords.
async function rollbackEncryptionPassword(userId: string, previousPassword: string, attempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await changeEncryptionPassword(userId, previousPassword);
      return;
    } catch {
      if (attempt === attempts) {
        throw new Error(
          'Password change failed and could not be undone automatically. Your vault may now require the NEW password you just entered — use "Forgot password" and your recovery code to restore access. Do not sign out first.'
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
}

export function AccountSecurity({ email, userId, onMessage }: Props) {
  const [nextEmail, setNextEmail] = useState(email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateEmail(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo: window.location.origin }
    );
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onMessage('Check your email to confirm the address change.');
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await unlockWithPassword(userId, currentPassword);
      await changeEncryptionPassword(userId, newPassword);
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        await rollbackEncryptionPassword(userId, currentPassword);
        throw new Error(updateError.message);
      }
      setCurrentPassword('');
      setNewPassword('');
      onMessage('Password updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="security-panel">
      <div>
        <p className="eyebrow">Sign-in details</p>
        <h3>Email and password</h3>
      </div>
      <form className="compact-form" onSubmit={updateEmail}>
        <label>
          Email address
          <input type="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} required />
        </label>
        <button className="secondary-button" type="submit" disabled={loading || nextEmail === email}>
          Change email
        </button>
      </form>
      <form className="compact-form" onSubmit={updatePassword}>
        <PasswordField
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          minLength={6}
          autoComplete="current-password"
          required
        />
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={12}
          autoComplete="new-password"
          required
        />
        <button className="secondary-button" type="submit" disabled={loading}>
          Change password
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
