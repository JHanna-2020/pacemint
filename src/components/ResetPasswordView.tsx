import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { commitRecovery, validateRecoveryCode } from '../lib/encryptionSession';
import { PasswordField } from './PasswordField';

type Props = {
  session: Session;
  onMessage: (message: string) => void;
};

// Rendered when the user returns from a password-reset email (Supabase fires a
// PASSWORD_RECOVERY session). They set a new auth password and, because the new
// password can't decrypt the existing data, restore the vault with their
// recovery code — both in one step.
export function ResetPasswordView({ session, onMessage }: Props) {
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Validate the recovery code first -- a wrong code throws here with no
      // writes yet, instead of after the Auth password has already changed.
      const dek = await validateRecoveryCode(session.user.id, recoveryCode);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      await commitRecovery(session.user.id, dek, password);
      onMessage('Password updated and your data is restored.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-lockup">
          <div className="brand-mark">
            <KeyRound size={28} />
          </div>
          <div>
            <p className="eyebrow">{session.user.email}</p>
            <h1>Set a new password</h1>
          </div>
        </div>
        <p className="auth-copy">
          Choose a new password and enter your recovery code so we can re-encrypt your data under the new password.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            minLength={12}
            autoComplete="new-password"
            required
          />
          <label>
            Recovery code
            <input
              type="text"
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Working...' : 'Update password and restore data'}
          </button>
        </form>
        <button className="text-button" type="button" onClick={() => void supabase.auth.signOut()}>
          Cancel and sign out
        </button>
      </section>
    </main>
  );
}
