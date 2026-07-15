import { ArrowLeft, Mail, ShieldCheck, Trash2, WalletCards } from 'lucide-react';

export type LegalPageKey = 'privacy' | 'terms' | 'support' | 'data-deletion' | 'ai-disclosure';

type Props = {
  page: LegalPageKey;
  onBack: () => void;
};

const updated = 'June 22, 2026';

const pages: Record<LegalPageKey, { eyebrow: string; title: string; sections: Array<{ title: string; body: string }> }> = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    sections: [
      {
        title: 'What PaceMint stores',
        body:
          'PaceMint stores account-scoped budget records in Supabase. Budget details are encrypted in your browser before they are saved, so the database stores ciphertext for sensitive fields.'
      },
      {
        title: 'Authentication and account data',
        body:
          'Supabase Auth handles email/password authentication. Your email address is used for sign-in, password reset, and account support.'
      },
      {
        title: 'AI chat data',
        body:
          'When you use the AI chat, selected budget-period context — including summary numbers, categories, recurring totals, and the free-text descriptions you typed for your recent expenses — is sent to OpenRouter so it can answer your question. You can exclude expense descriptions from AI chat in Settings, or avoid using AI chat for any expense whose description you do not want shared with a third-party AI provider.'
      },
      {
        title: 'Analytics',
        body:
          'PaceMint does not currently use advertising trackers or product analytics. If privacy-preserving analytics are added later, this policy will be updated before collection begins.'
      },
      {
        title: 'Service providers',
        body:
          'PaceMint uses Supabase for authentication and encrypted storage, Vercel for hosting, OpenRouter only when you use AI chat, and Web3Forms when you submit feedback.'
      },
      {
        title: 'Deletion and retention',
        body:
          'You can delete your account from Settings. PaceMint removes account-owned budget rows, encryption keys, AI usage records, and the authentication identity through the self-service deletion flow.'
      }
    ]
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Terms of Use',
    sections: [
      {
        title: 'Personal budgeting only',
        body:
          'PaceMint is a personal budgeting tool. It is not financial, tax, investment, legal, or accounting advice.'
      },
      {
        title: 'Your responsibility',
        body:
          'You are responsible for the accuracy of the data you enter, for keeping your password secure, and for saving your recovery code.'
      },
      {
        title: 'Availability',
        body:
          'The service depends on Supabase, Vercel, and OpenRouter. Features may be unavailable during provider outages, maintenance, or rate limits.'
      },
      {
        title: 'Acceptable use',
        body:
          'Do not attempt to bypass authentication, access another user account, abuse rate limits, or use the app for unlawful activity.'
      }
    ]
  },
  support: {
    eyebrow: 'Support',
    title: 'Contact and Support',
    sections: [
      {
        title: 'Getting help',
        body:
          'For support, include your account email, the page where the issue happened, what you expected, and what happened instead. Do not send passwords, recovery codes, or full financial exports.'
      },
      {
        title: 'Account recovery',
        body:
          'Password reset requires access to your email. Encrypted budget recovery also requires your recovery code. Without both password access and the recovery code, encrypted data cannot be restored.'
      },
      {
        title: 'Contact',
        body:
          'Email hannagonjohn@gmail.com for account or product support. Never include your password, recovery code, or a financial export.'
      }
    ]
  },
  'data-deletion': {
    eyebrow: 'Data',
    title: 'Data Deletion',
    sections: [
      {
        title: 'Export first',
        body:
          'Before deleting data, export your workbook from Settings if you want a copy. Exports are decrypted Excel files and should be stored carefully.'
      },
      {
        title: 'Deleting budget data',
        body:
          'You can permanently delete your budget data from Settings. PaceMint requires a recent sign-in and confirmation before processing deletion.'
      },
      {
        title: 'Deleting an account',
        body:
          'Self-service deletion removes account-owned financial rows, encryption keys, AI usage records, and the Supabase authentication identity. This action cannot be undone.'
      }
    ]
  },
  'ai-disclosure': {
    eyebrow: 'AI',
    title: 'AI Disclosure',
    sections: [
      {
        title: 'How AI is used',
        body:
          'PaceMint uses OpenRouter to power the budget chatbot. The AI feature is read-only and cannot change your budget records.'
      },
      {
        title: 'What is sent',
        body:
          'When you send a chat message, PaceMint sends your question plus selected budget-period context: summary numbers, categories, recurring totals, and your most recent expenses (up to 20) — including the free-text description you typed for each one. You can exclude expense descriptions from AI chat in Settings.'
      },
      {
        title: 'Limits',
        body:
          'AI answers can be incomplete or wrong. Treat them as budgeting suggestions, not professional financial advice.'
      },
      {
        title: 'Free model availability',
        body:
          'The configured OpenRouter model may be rate-limited or unavailable. AI chat also has an account-level daily usage limit to protect service availability and cost.'
      }
    ]
  }
};

export function LegalPage({ page, onBack }: Props) {
  const content = pages[page];

  return (
    <main className="legal-page">
      <nav className="landing-nav">
        <div className="brand-lockup small">
          <div className="brand-mark">
            <WalletCards size={23} />
          </div>
          <div>
            <p className="eyebrow">PaceMint</p>
            <strong>{content.title}</strong>
          </div>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          Back
        </button>
      </nav>

      <section className="legal-hero">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>Last updated {updated}. These pages describe PaceMint's current product behavior and service terms.</p>
      </section>

      <section className="legal-content">
        {content.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>

      <section className="legal-actions">
        <article>
          <ShieldCheck size={20} />
          <strong>Private by design</strong>
          <p>Budget details are encrypted client-side before storage.</p>
        </article>
        <article>
          <Mail size={20} />
          <strong>Support-ready</strong>
          <p>Support requests must never include passwords, recovery codes, or financial exports.</p>
        </article>
        <article>
          <Trash2 size={20} />
          <strong>Deletion path</strong>
          <p>Account owners can permanently delete their account from Settings.</p>
        </article>
      </section>
    </main>
  );
}
