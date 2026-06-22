import { FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lightbulb, Mail, Send, WalletCards } from 'lucide-react';
import { TurnstileWidget, turnstileConfigured } from './TurnstileWidget';

type Props = {
  userEmail?: string;
  onBack: () => void;
  onMessage: (message: string) => void;
};

const feedbackEmail = import.meta.env.VITE_FEEDBACK_EMAIL || 'hannagonjohn@gmail.com';

export function FeedbackPage({ userEmail, onBack, onMessage }: Props) {
  const [area, setArea] = useState('Budgeting');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [impact, setImpact] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDetails = details.trim();

    if (!trimmedTitle || !trimmedDetails) {
      onMessage('Add a title and a few details before sending feedback.');
      return;
    }

    setStatus('sending');
    setError(null);

    try {
      const trimmedImpact = impact.trim();
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          area,
          title: trimmedTitle,
          details: trimmedDetails,
          impact: trimmedImpact || 'Not provided',
          userEmail: userEmail || 'Not provided',
          submittedFrom: window.location.href,
          captchaToken
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error ?? 'Feedback could not be sent right now.');
      }

      setStatus('sent');
      setCaptchaToken(null);
      setCaptchaResetKey((value) => value + 1);
      onMessage('Feedback sent to PaceMint.');
    } catch (submitError) {
      setStatus('idle');
      setError(submitError instanceof Error ? submitError.message : 'Feedback could not be sent right now.');
    }
  }

  function resetForm() {
    setArea('Budgeting');
    setTitle('');
    setDetails('');
    setImpact('');
    setError(null);
    setStatus('idle');
    setCaptchaToken(null);
    setCaptchaResetKey((value) => value + 1);
  }

  return (
    <main className="feedback-page">
      <nav className="landing-nav">
        <div className="brand-lockup small">
          <div className="brand-mark">
            <WalletCards size={23} />
          </div>
          <div>
            <p className="eyebrow">PaceMint</p>
            <strong>Product feedback</strong>
          </div>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          Back
        </button>
      </nav>

      <section className="feedback-layout">
        <div className="feedback-copy">
          <p className="eyebrow">Feature requests</p>
          <h1>Help shape what PaceMint builds next.</h1>
          <p>
            Send a focused suggestion about budgeting workflows, reports, AI chat, setup, or anything that would make
            PaceMint easier to use.
          </p>
          <div className="feedback-note">
            <Lightbulb size={20} />
            <p>Useful feedback explains the problem, the workflow it affects, and what a better result would look like.</p>
          </div>
        </div>

        {status === 'sent' ? (
          <section className="feedback-confirmation" aria-live="polite">
            <div className="confirmation-icon">
              <CheckCircle2 size={34} />
            </div>
            <p className="eyebrow">Sent</p>
            <h2>Your feedback was emailed.</h2>
            <p>
              Thanks for helping improve PaceMint. Your suggestion was sent to {feedbackEmail} and can be reviewed from
              that inbox.
            </p>
            <div className="feedback-confirmation-actions">
              <button className="primary-button" type="button" onClick={resetForm}>
                Send another idea
              </button>
              <button className="secondary-button" type="button" onClick={onBack}>
                Back
              </button>
            </div>
          </section>
        ) : (
          <form className="feedback-form" onSubmit={submitFeedback}>
          <label>
            Feature area
            <select name="area" value={area} onChange={(event) => setArea(event.target.value)} disabled={status === 'sending'}>
              <option>Budgeting</option>
              <option>Expenses</option>
              <option>Income</option>
              <option>Category budgets</option>
              <option>AI chatbot</option>
              <option>Import/export</option>
              <option>Account and security</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Short title
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Add weekly budget targets"
              maxLength={90}
              disabled={status === 'sending'}
            />
          </label>

          <label>
            What should PaceMint add or improve?
            <textarea
              name="details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Describe the feature, where it should appear, and how you would use it."
              rows={7}
              maxLength={1400}
              disabled={status === 'sending'}
            />
          </label>

          <label>
            Why would this help?
            <textarea
              name="impact"
              value={impact}
              onChange={(event) => setImpact(event.target.value)}
              placeholder="Optional: explain the outcome, pain point, or decision this would improve."
              rows={4}
              maxLength={800}
              disabled={status === 'sending'}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />

          <div className="feedback-form-footer">
            <span>
              <Mail size={16} />
              Sends to {feedbackEmail}
            </span>
            <button className="primary-button" type="submit" disabled={status === 'sending' || (turnstileConfigured && !captchaToken)}>
              <Send size={17} />
              {status === 'sending' ? 'Sending...' : 'Send feedback'}
            </button>
          </div>
        </form>
        )}
      </section>
    </main>
  );
}
