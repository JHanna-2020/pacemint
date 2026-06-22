import {
  ArrowRight,
  Bot,
  CalendarRange,
  ChartNoAxesColumnIncreasing,
  KeyRound,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  WalletCards
} from 'lucide-react';
import { CSSProperties } from 'react';
import { LegalPageKey } from './LegalPage';

type Props = {
  onGetStarted: (mode?: 'signin' | 'signup') => void;
  onOpenLegal: (page: LegalPageKey) => void;
  onOpenFeedback: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
};

export function LandingPage({ onGetStarted, onOpenLegal, onOpenFeedback, theme, onToggleTheme }: Props) {
  function scrollToHowItWorks() {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Landing navigation">
        <div className="brand-lockup small">
          <div className="brand-mark"><WalletCards size={23} /></div>
          <div><p className="eyebrow">PaceMint</p><strong>Private budget control</strong></div>
        </div>
        <div className="landing-nav-links">
          <button className="landing-link" type="button" onClick={scrollToHowItWorks}>How it works</button>
          <button className="icon-button" type="button" aria-label="Toggle theme" onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="secondary-button" type="button" onClick={() => onGetStarted('signin')}>Sign in</button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <div className="early-access-pill"><Sparkles size={15} /> Open for early users</div>
          <p className="eyebrow">Encrypted · Private · No bank link</p>
          <h1>Know what you can spend—without connecting your bank.</h1>
          <p>
            PaceMint gives you a daily safe-to-spend number from your budget, savings target, recurring costs, and
            actual spending. Use calendar months or match the statement cycle you already live by.
          </p>
          <div className="landing-actions">
            <button className="primary-button" type="button" onClick={() => onGetStarted('signup')}>
              Create a free account <ArrowRight size={18} />
            </button>
            <button className="secondary-button" type="button" onClick={scrollToHowItWorks}>See how it works</button>
          </div>
          <div className="landing-trust-line" aria-label="Privacy highlights">
            <span><ShieldCheck size={16} /> Browser-side encryption</span>
            <span><LockKeyhole size={16} /> No card details</span>
            <span><KeyRound size={16} /> Recovery-code protected</span>
          </div>
        </div>

        <div className="landing-product-shot" aria-label="PaceMint statement budget preview">
          <div className="preview-topline">
            <span>Main card · May 16–Jun 15</span>
            <strong>On pace</strong>
          </div>
          <div className="pace-rail" aria-label="Daily spending pace">
            <div className="pace-readout">
              <small>Safe to spend today</small>
              <strong>$47.36</strong>
            </div>
            <div className="pace-track" style={{ '--pace': '47%' } as CSSProperties}>
              <div className="pace-track-fill" />
              <div className="pace-track-ticks" />
            </div>
            <div className="pace-rail-scale">
              <span>Cycle start</span>
              <span>Day 11 / 30</span>
              <span>Close</span>
            </div>
          </div>
          <div className="preview-metrics">
            <article><span>Spent</span><strong>$436.22</strong></article>
            <article><span>Remaining</span><strong>$1,263.78</strong></article>
            <article><span>Savings</span><strong>$500.00</strong></article>
          </div>
          <div className="preview-chart" aria-hidden="true">
            <div style={{ height: '38%' }} /><div style={{ height: '58%' }} /><div style={{ height: '28%' }} />
            <div style={{ height: '72%' }} /><div style={{ height: '46%' }} /><div style={{ height: '84%' }} />
          </div>
          <div className="preview-chat">
            <span><Bot size={16} /> Optional AI budget chat</span>
            <p>Gas is at <strong>43%</strong> of budget. You have <strong>$47.36</strong> left in that category.</p>
          </div>
        </div>
      </section>

      <section className="landing-proof-strip" aria-label="PaceMint product facts">
        <span>No bank login</span><span>No card number</span><span>No ad tracking</span><span>Export your data</span>
      </section>

      <section className="landing-feature-grid">
        <article><CalendarRange size={22} /><h2>Your period, your rules</h2><p>Budget by calendar month or a custom statement closing day, with clear previous and next periods.</p></article>
        <article><ChartNoAxesColumnIncreasing size={22} /><h2>A practical daily pace</h2><p>See spending, category pressure, remaining budget, and a daily or weekly safe-to-spend pace.</p></article>
        <article><LockKeyhole size={22} /><h2>Financial details stay encrypted</h2><p>Budget records are encrypted in your browser before Supabase stores them. PaceMint never asks for card details.</p></article>
        <article><Bot size={22} /><h2>AI when you choose it</h2><p>Ask focused questions using selected-period summaries. Your budget remains fully usable without AI chat.</p></article>
      </section>

      <section className="landing-audience">
        <div><p className="eyebrow">Designed for real budgeting habits</p><h2>A focused alternative to bank-connected finance apps.</h2></div>
        <div className="audience-grid">
          <article><strong>Statement-cycle budgeters</strong><p>Match spending to the dates on your main card instead of forcing everything into a calendar month.</p></article>
          <article><strong>Privacy-conscious planners</strong><p>Enter only the numbers you need. No account aggregation, transaction scraping, or card credentials.</p></article>
          <article><strong>Manual budgeters</strong><p>Keep deliberate control over expenses, recurring costs, category limits, and one-time income.</p></article>
        </div>
      </section>

      <section className="landing-setup" id="how-it-works">
        <div><p className="eyebrow">How it works</p><h2>Start in minutes. Adjust as your spending changes.</h2><p>PaceMint keeps setup explicit so you always understand the number on the dashboard.</p></div>
        <div className="setup-steps">
          <article><strong>1. Choose a period</strong><p>Use a calendar month or create a statement profile with only a custom name and closing day.</p></article>
          <article><strong>2. Set your guardrails</strong><p>Add income, a spending cap, savings, and optional category limits.</p></article>
          <article><strong>3. Log spending</strong><p>Add expenses manually and assign them to a statement profile only when useful.</p></article>
          <article><strong>4. Follow your pace</strong><p>Use remaining budget and daily pace to make the next spending decision.</p></article>
        </div>
      </section>

      <section className="landing-final-cta">
        <div><p className="eyebrow">Early access</p><h2>Build your first private budget today.</h2><p>Start free, export your data whenever you want, and send feedback directly to the builder.</p></div>
        <button className="primary-button" type="button" onClick={() => onGetStarted('signup')}>Create your account <ArrowRight size={18} /></button>
      </section>

      <footer className="site-footer">
        <span>PaceMint</span>
        <button type="button" onClick={() => onOpenLegal('privacy')}>Privacy</button>
        <button type="button" onClick={() => onOpenLegal('terms')}>Terms</button>
        <button type="button" onClick={() => onOpenLegal('support')}>Support</button>
        <button type="button" onClick={onOpenFeedback}>Feedback</button>
        <button type="button" onClick={() => onOpenLegal('data-deletion')}>Data deletion</button>
        <button type="button" onClick={() => onOpenLegal('ai-disclosure')}>AI disclosure</button>
      </footer>
    </main>
  );
}
