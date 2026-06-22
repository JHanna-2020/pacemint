import { FormEvent, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { clearDEK } from '../lib/encryptionSession';
import { supabase } from '../lib/supabase';
import { PasswordField } from './PasswordField';
import { TurnstileWidget, turnstileConfigured } from './TurnstileWidget';

type Props = {
  email: string;
};

export function AccountDeletion({ email }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  useEffect(() => {
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaFactorId(data?.totp.find((factor) => factor.status === 'verified')?.id ?? null);
    });
  }, []);

  async function removeAccount(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: captchaToken ?? undefined }
      });
      setCaptchaToken(null);
      setCaptchaResetKey((value) => value + 1);
      if (signInError || !data.session) throw new Error('Your password could not be verified.');
      if (mfaFactorId) {
        const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode });
        if (mfaError) throw new Error('Your authenticator code could not be verified.');
      }
      const { data: refreshed } = await supabase.auth.getSession();
      if (!refreshed.session) throw new Error('Your session could not be refreshed.');
      const response = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshed.session.access_token}`
        },
        body: JSON.stringify({ confirmation })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Account deletion failed.');
      clearDEK();
      await supabase.auth.signOut({ scope: 'local' });
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account deletion failed.');
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="secondary-button danger-outline" type="button" onClick={() => setOpen(true)}>
        <Trash2 size={17} />
        Delete account
      </button>
    );
  }

  return (
    <form className="account-deletion" onSubmit={removeAccount}>
      <strong>Permanently delete this account</strong>
      <p className="settings-copy">This removes your encrypted budget data and sign-in identity. This cannot be undone.</p>
      <PasswordField
        label="Current password"
        value={password}
        onChange={setPassword}
        minLength={6}
        autoComplete="current-password"
        required
      />
      <label>
        Type DELETE to confirm
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      </label>
      {mfaFactorId && (
        <label>
          Authenticator code
          <input
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
            required
          />
        </label>
      )}
      <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />
      {error && <p className="form-error">{error}</p>}
      <div className="allocation-actions">
        <button className="secondary-button" type="button" onClick={() => setOpen(false)} disabled={loading}>
          Cancel
        </button>
        <button
          className="primary-button danger-action"
          type="submit"
          disabled={
            loading ||
            confirmation !== 'DELETE' ||
            (mfaFactorId !== null && mfaCode.length !== 6) ||
            (turnstileConfigured && !captchaToken)
          }
        >
          <Trash2 size={17} />
          {loading ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </form>
  );
}
