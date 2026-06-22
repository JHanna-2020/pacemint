import { FormEvent, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Enrollment = {
  id: string;
  qrCode: string;
  secret: string;
};

export function MfaSettings() {
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      return;
    }
    setVerifiedFactorId(data.totp.find((factor) => factor.status === 'verified')?.id ?? null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function beginEnrollment() {
    setLoading(true);
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'PaceMint authenticator'
    });
    setLoading(false);
    if (enrollError) {
      setError(enrollError.message);
      return;
    }
    setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setLoading(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setEnrollment(null);
    setCode('');
    await refresh();
  }

  async function disable() {
    if (!verifiedFactorId || !window.confirm('Disable authenticator-based two-factor authentication?')) return;
    setLoading(true);
    setError(null);
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
    setLoading(false);
    if (removeError) {
      setError(removeError.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="security-panel">
      <div className="security-heading">
        <ShieldCheck size={20} />
        <div>
          <p className="eyebrow">Two-factor authentication</p>
          <h3>{verifiedFactorId ? 'Authenticator enabled' : 'Protect your account'}</h3>
        </div>
      </div>
      {enrollment ? (
        <form className="mfa-enrollment" onSubmit={verify}>
          <p className="settings-copy">Finish setup in your authenticator app:</p>
          <ol className="mfa-steps">
            <li>Open your authenticator app and choose <strong>Add account</strong> (or the “+” button).</li>
            <li>
              Scan the QR code below. Can’t scan? Choose <strong>Enter a setup key</strong> and type the code shown
              under the QR image.
            </li>
            <li>Enter the six-digit code your app generates to confirm and enable two-factor authentication.</li>
          </ol>
          <img src={enrollment.qrCode} alt="Authenticator setup QR code" />
          <p className="settings-copy">Manual setup key (if you can’t scan):</p>
          <code>{enrollment.secret}</code>
          <label>
            Verification code
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading || code.length !== 6}>
            Verify and enable
          </button>
        </form>
      ) : verifiedFactorId ? (
        <button className="secondary-button" type="button" onClick={disable} disabled={loading}>
          Disable authenticator
        </button>
      ) : (
        <div className="mfa-intro">
          <p className="settings-copy">
            Two-factor authentication adds a second step at sign-in: a six-digit code from an authenticator app on your
            phone. Even if someone learns your password, they can’t sign in without your phone.
          </p>
          <p className="settings-copy">
            First, install a free authenticator app if you don’t already have one:
          </p>
          <ul className="mfa-app-list">
            <li>
              <strong>Google Authenticator</strong> — iOS App Store / Google Play
            </li>
            <li>
              <strong>Microsoft Authenticator</strong> — iOS App Store / Google Play
            </li>
            <li>
              <strong>Authy</strong> — also syncs across multiple devices
            </li>
            <li>
              A password manager with built-in codes (e.g. <strong>1Password</strong> or <strong>Bitwarden</strong>)
            </li>
          </ul>
          <p className="settings-copy">
            Then select <strong>Set up authenticator</strong> below to scan a QR code and link it to PaceMint.
          </p>
          <button className="secondary-button" type="button" onClick={beginEnrollment} disabled={loading}>
            Set up authenticator
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
