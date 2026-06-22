import { FormEvent, useState } from 'react';
import { WalletCards } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PasswordField } from './PasswordField';
import { TurnstileWidget, turnstileConfigured } from './TurnstileWidget';

const passwordResetRedirectUrl = () => `${window.location.origin}/?auth_action=password_reset`;

type Props = {
  onMessage: (message: string) => void;
  initialMode?: 'signin' | 'signup';
  // Hands the just-entered password to the vault gate so an existing vault can be
  // unlocked without prompting for the same password a second time.
  onAuthenticated: (password: string) => void;
};

type View = 'auth' | 'forgot';

export function AuthView({ onMessage, onAuthenticated, initialMode = 'signin' }: Props) {
  const [view, setView] = useState<View>('auth');
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const options = { captchaToken: captchaToken ?? undefined };
    const result =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password, options })
        : await supabase.auth.signUp({
            email,
            password,
            options: { ...options, emailRedirectTo: window.location.origin }
          });
    setCaptchaToken(null);
    setCaptchaResetKey((value) => value + 1);

    if (result.error) {
      setLoading(false);
      setError(result.error.message);
      return;
    }

    // If email confirmation is enabled, sign-up returns no session yet. The
    // encryption vault is set up on the first authenticated visit instead.
    const session = result.data.session;
    if (!session) {
      setLoading(false);
      onMessage('Check your email to confirm your account, then sign in.');
      return;
    }

    setLoading(false);
    onAuthenticated(password);
    onMessage('Signed in. Unlocking your encrypted vault.');
  }

  async function sendReset(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectUrl(),
      captchaToken: captchaToken ?? undefined
    });
    setCaptchaToken(null);
    setCaptchaResetKey((value) => value + 1);
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    onMessage('Password reset email sent. After resetting, restore your data with your recovery code.');
    setView('auth');
  }

  if (view === 'forgot') {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand-lockup">
            <div className="brand-mark">
              <WalletCards size={28} />
            </div>
            <div>
              <p className="eyebrow">Account recovery</p>
              <h1>Reset your password</h1>
            </div>
          </div>
          <p className="auth-copy">
            We'll email you a reset link. After setting a new password, you'll restore your encrypted data with your
            recovery code.
          </p>
          <form className="auth-form" onSubmit={sendReset}>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" type="submit" disabled={loading || (turnstileConfigured && !captchaToken)}>
              {loading ? 'Sending...' : 'Send reset email'}
            </button>
          </form>
          <button className="text-button" type="button" onClick={() => setView('auth')}>
            Back to sign in
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
            <WalletCards size={28} />
          </div>
          <div>
            <p className="eyebrow">Private period budgeting</p>
            <h1>PaceMint</h1>
          </div>
        </div>
        <p className="auth-copy">
          Track spending, reserve savings first, and keep a clear daily number for the rest of your selected budget period. Your data is
          end-to-end encrypted.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            minLength={mode === 'signin' ? 6 : 12}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
          />
          {mode === 'signup' && <small>Use at least 12 characters. A password manager is recommended.</small>}
          <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading || (turnstileConfigured && !captchaToken)}>
            {loading ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button className="text-button" type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Create a new account' : 'Use an existing account'}
        </button>
        {mode === 'signin' && (
          <button className="text-button" type="button" onClick={() => setView('forgot')}>
            Forgot password?
          </button>
        )}
      </section>
    </main>
  );
}
