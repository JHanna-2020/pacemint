import { ChangeEvent, useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { regenerateRecoveryCode } from '../lib/encryptionSession';
import { UserSettings } from '../lib/types';
import { AccountDeletion } from './AccountDeletion';
import { MfaSettings } from './MfaSettings';
import { AccountSecurity } from './AccountSecurity';

type Props = {
  userId: string;
  userEmail: string;
  settings: UserSettings | null;
  onToggleExcludeDescriptions: (value: boolean) => Promise<void>;
  onMessage: (message: string) => void;
};

export function SettingsPanel({ userId, userEmail, settings, onToggleExcludeDescriptions, onMessage }: Props) {
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  async function generateRecoveryCode() {
    const confirmed = window.confirm(
      'Generating a new recovery code will replace your old one. Save the new code immediately.'
    );
    if (!confirmed) return;

    setRecoveryLoading(true);
    setRecoveryError(null);
    try {
      const code = await regenerateRecoveryCode(userId);
      setRecoveryCode(code);
      onMessage('New recovery code generated. Save it now.');
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : 'Could not generate a recovery code.');
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function copyRecoveryCode() {
    if (!recoveryCode) return;
    await navigator.clipboard?.writeText(recoveryCode);
    onMessage('Recovery code copied.');
  }

  const [privacyLoading, setPrivacyLoading] = useState(false);

  async function toggleExcludeDescriptions(event: ChangeEvent<HTMLInputElement>) {
    setPrivacyLoading(true);
    try {
      await onToggleExcludeDescriptions(event.target.checked);
      onMessage(event.target.checked ? 'Expense descriptions excluded from AI chat.' : 'Expense descriptions included in AI chat.');
    } finally {
      setPrivacyLoading(false);
    }
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Security &amp; account</p>
          <h2>Sign-in and recovery</h2>
        </div>
      </div>

      <AccountSecurity email={userEmail} userId={userId} onMessage={onMessage} />

      <div className="settings-divider" />
      <MfaSettings />

      <div className="settings-divider" />
      <div className="security-panel">
        <div className="security-heading">
          <ShieldCheck size={20} />
          <div>
            <p className="eyebrow">Privacy</p>
            <h3>AI chat</h3>
          </div>
        </div>
        <p className="settings-copy">
          When on, AI chat still sees your budget summary, categories, and amounts, but expense descriptions are left
          out of what's sent to OpenRouter.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'row' }}>
          <input
            type="checkbox"
            checked={settings?.excludeDescriptionsFromAI ?? false}
            onChange={toggleExcludeDescriptions}
            disabled={privacyLoading}
            style={{ width: 'auto' }}
          />
          Exclude expense descriptions from AI chat
        </label>
      </div>

      <div className="settings-divider" />
      <div className="security-panel">
        <div className="security-heading">
          <KeyRound size={20} />
          <div>
            <p className="eyebrow">Security</p>
            <h3>Recovery code</h3>
          </div>
        </div>
        <p className="settings-copy">
          Generate a new recovery code while your vault is unlocked. Your previous recovery code will stop working.
        </p>
        {recoveryCode ? (
          <div className="recovery-code-box">
            <code>{recoveryCode}</code>
            <button className="icon-button" type="button" aria-label="Copy recovery code" onClick={copyRecoveryCode}>
              <Copy size={18} />
            </button>
          </div>
        ) : null}
        {recoveryError && <p className="form-error">{recoveryError}</p>}
        <button className="secondary-button" type="button" onClick={generateRecoveryCode} disabled={recoveryLoading}>
          <RefreshCw size={17} />
          {recoveryLoading ? 'Generating...' : 'Generate new recovery code'}
        </button>
      </div>

      <div className="settings-divider" />
      <div className="security-panel">
        <div>
          <p className="eyebrow">Account</p>
          <h3>Delete account and data</h3>
        </div>
        <AccountDeletion email={userEmail} />
      </div>
    </section>
  );
}
