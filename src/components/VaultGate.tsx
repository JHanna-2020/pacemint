import { FormEvent, useEffect, useState } from 'react';
import { Copy, Lock, ShieldCheck } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  activatePendingDEK,
  needsEncryptionSetup,
  recoverWithCode,
  setupEncryption,
  unlockWithPassword
} from '../lib/encryptionSession';
import { PasswordField } from './PasswordField';
import { TurnstileWidget, turnstileConfigured } from './TurnstileWidget';

type Props = {
  session: Session;
  onMessage: (message: string) => void;
  // Password captured at sign-in. When an existing vault needs unlocking (and any
  // 2FA challenge is already cleared), it is used to unlock automatically so the
  // user is not asked for the same password twice. Absent after a page refresh,
  // where the manual prompt is shown instead.
  initialPassword?: string | null;
  onPasswordConsumed?: () => void;
};

// Shown when a session exists but the in-memory encryption key is missing
// (e.g. after a page refresh, or after a password reset). Re-derives the key
// from the password, or restores access with the recovery code.
export function VaultGate({ session, onMessage, initialPassword, onPasswordConsumed }: Props) {
  const [mode, setMode] = useState<'unlock' | 'recover'>('unlock');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaChecking, setMfaChecking] = useState(true);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [newRecoveryCode, setNewRecoveryCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [autoUnlockTried, setAutoUnlockTried] = useState(false);
  const [autoUnlocking, setAutoUnlocking] = useState(false);

  async function checkAccountSecurity() {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
      const { data } = await supabase.auth.mfa.listFactors();
      setMfaFactorId(data?.totp.find((factor) => factor.status === 'verified')?.id ?? null);
      setMfaChecking(false);
      return;
    }
    setMfaFactorId(null);
    setNeedsSetup(await needsEncryptionSetup(session.user.id));
    setMfaChecking(false);
  }

  useEffect(() => {
    void checkAccountSecurity().catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not check account security.');
      setMfaChecking(false);
    });
  }, []);

  // Once any 2FA challenge is cleared and an existing vault is ready to unlock,
  // reuse the sign-in password instead of prompting again. On failure or refresh
  // (no captured password) the manual unlock form is shown.
  const canAutoUnlock =
    !mfaChecking && !mfaFactorId && !needsSetup && mode === 'unlock' && Boolean(initialPassword) && !autoUnlockTried;

  useEffect(() => {
    if (!canAutoUnlock || !initialPassword) return;
    setAutoUnlockTried(true);
    setAutoUnlocking(true);
    void unlockWithPassword(session.user.id, initialPassword)
      .then(() => onMessage('Vault unlocked.'))
      .catch(() => setAutoUnlocking(false))
      .finally(() => onPasswordConsumed?.());
  }, [canAutoUnlock, initialPassword]);

  async function verifyMfa(event: FormEvent) {
    event.preventDefault();
    if (!mfaFactorId) return;
    setLoading(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setMfaChecking(true);
    setMfaCode('');
    await checkAccountSecurity();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'unlock') {
        if (needsSetup) {
          if (!session.user.email) throw new Error('This account has no email address.');
          const { error: passwordError } = await supabase.auth.signInWithPassword({
            email: session.user.email,
            password,
            options: { captchaToken: captchaToken ?? undefined }
          });
          setCaptchaToken(null);
          setCaptchaResetKey((value) => value + 1);
          if (passwordError) throw new Error('That password does not match this account.');
          setNewRecoveryCode(await setupEncryption(session.user.id, password));
        } else {
          await unlockWithPassword(session.user.id, password);
          onMessage('Vault unlocked.');
        }
      } else {
        await recoverWithCode(session.user.id, recoveryCode, password);
        onMessage('Recovery successful. Your data is restored.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock your data.');
    } finally {
      setLoading(false);
    }
  }

  if (mfaChecking) return <main className="loading-screen">Checking account security...</main>;

  if (autoUnlocking || canAutoUnlock) return <main className="loading-screen">Unlocking your vault...</main>;

  if (newRecoveryCode) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="security-heading">
            <ShieldCheck size={28} />
            <div>
              <p className="eyebrow">Save this now</p>
              <h1>Your recovery code</h1>
            </div>
          </div>
          <p className="auth-copy">
            This is the only way to restore encrypted data after a forgotten password. It is shown once.
          </p>
          <div className="recovery-code-box">
            <code>{newRecoveryCode}</code>
            <button
              className="icon-button"
              type="button"
              aria-label="Copy recovery code"
              onClick={() => void navigator.clipboard?.writeText(newRecoveryCode)}
            >
              <Copy size={18} />
            </button>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              activatePendingDEK();
              onMessage('Recovery code confirmed. Welcome to PaceMint.');
            }}
          >
            I have saved my recovery code
          </button>
        </section>
      </main>
    );
  }

  if (mfaFactorId) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="security-heading">
            <ShieldCheck size={28} />
            <div>
              <p className="eyebrow">Two-factor authentication</p>
              <h1>Enter your authenticator code</h1>
            </div>
          </div>
          <form className="auth-form" onSubmit={verifyMfa}>
            <label>
              Six-digit code
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
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" type="submit" disabled={loading || mfaCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
          <button className="text-button" type="button" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-lockup">
          <div className="brand-mark">
            {mode === 'unlock' ? <Lock size={28} /> : <ShieldCheck size={28} />}
          </div>
          <div>
            <p className="eyebrow">{session.user.email}</p>
            <h1>{mode === 'unlock' ? (needsSetup ? 'Create your encrypted vault' : 'Unlock your data') : 'Restore with recovery code'}</h1>
          </div>
        </div>
        <p className="auth-copy">
          {mode === 'unlock'
            ? needsSetup
              ? 'Use the same password you created for this account. PaceMint will use it to protect your encryption key.'
              : 'Your budget is end-to-end encrypted. Enter your password to decrypt it on this device.'
            : 'Enter your recovery code and a new password to restore access to your encrypted data.'}
        </p>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'recover' && (
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
          )}
          <PasswordField
            label={mode === 'unlock' ? (needsSetup ? 'Account password' : 'Password') : 'New password'}
            value={password}
            onChange={setPassword}
            minLength={mode === 'unlock' ? (needsSetup ? 12 : 6) : 12}
            autoComplete={mode === 'unlock' ? 'current-password' : 'new-password'}
            required
          />
          {needsSetup && <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />}
          {error && <p className="form-error">{error}</p>}
          <button
            className="primary-button"
            type="submit"
            disabled={loading || (needsSetup && turnstileConfigured && !captchaToken)}
          >
            {loading
              ? 'Working...'
              : mode === 'unlock'
                ? needsSetup
                  ? 'Create encrypted vault'
                  : 'Unlock'
                : 'Restore access'}
          </button>
        </form>
        {!needsSetup && (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === 'unlock' ? 'recover' : 'unlock');
            }}
          >
            {mode === 'unlock' ? 'Forgot your password? Use a recovery code' : 'Back to unlock'}
          </button>
        )}
        <button className="text-button" type="button" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </section>
    </main>
  );
}
