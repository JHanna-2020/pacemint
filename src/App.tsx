import { useEffect, useMemo, useReducer, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { LayoutDashboard, Settings, SlidersHorizontal, WalletCards } from 'lucide-react';
import { AuthView } from './components/AuthView';
import { ResetPasswordView } from './components/ResetPasswordView';
import { VaultGate } from './components/VaultGate';
import { clearDEK, hasDEK, subscribeVault } from './lib/encryptionSession';
import { BudgetChat } from './components/BudgetChat';
import { CategoryBudgets } from './components/CategoryBudgets';
import { Charts } from './components/Charts';
import { DataPortability } from './components/DataPortability';
import { ExpenseManager } from './components/ExpenseManager';
import { FeedbackPage } from './components/FeedbackPage';
import { IncomeManager } from './components/IncomeManager';
import { LandingPage } from './components/LandingPage';
import { LegalPage, LegalPageKey } from './components/LegalPage';
import { HeaderPeriodMenu } from './components/HeaderPeriodMenu';
import { HeaderActionsMenu } from './components/HeaderActionsMenu';
import { OnboardingPanel } from './components/OnboardingPanel';
import { ProductOnboarding } from './components/ProductOnboarding';
import { PlanSettings } from './components/PlanSettings';
import { StatementProfiles } from './components/StatementProfiles';
import { RecurringPanel } from './components/RecurringPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ThemeToggle } from './components/ThemeToggle';
import { SummaryCards } from './components/SummaryCards';
import { supabase } from './lib/supabase';
import { useBudgetData } from './hooks/useBudgetData';

function envConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

const APP_ONBOARDING_VERSION = '2026-06-18-onboarding-v1';
const APP_ONBOARDING_STORAGE_KEY = 'pacemint:onboarding-version';

function isPasswordResetUrl() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return (
    params.get('auth_action') === 'password_reset' ||
    hashParams.get('auth_action') === 'password_reset' ||
    params.get('type') === 'recovery' ||
    hashParams.get('type') === 'recovery'
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [legalPage, setLegalPage] = useState<LegalPageKey | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [recoveringPassword, setRecoveringPassword] = useState(isPasswordResetUrl);
  // Password captured at sign-in, used to auto-unlock the vault so the user is not
  // prompted for the same password again (notably after a 2FA challenge).
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  // Re-render whenever the encryption vault locks or unlocks.
  const [, bumpVault] = useReducer((value) => value + 1, 0);
  const [activePage, setActivePage] = useState<'dashboard' | 'budget' | 'settings'>('dashboard');
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark');
  const [showProductOnboarding, setShowProductOnboarding] = useState(
    () => localStorage.getItem(APP_ONBOARDING_STORAGE_KEY) !== APP_ONBOARDING_VERSION
  );
  const vaultUnlocked = hasDEK();
  const budget = useBudgetData(session, vaultUnlocked);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => subscribeVault(bumpVault), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (isPasswordResetUrl()) {
        setRecoveringPassword(true);
      }
      setAuthLoading(false);
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        clearDEK();
        setRecoveringPassword(false);
        setPendingPassword(null);
      }
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveringPassword(true);
      }
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const defaultExpenseDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return today >= budget.period.start && today <= budget.period.end ? today : budget.period.start;
  }, [budget.period.end, budget.period.start]);

  function dismissProductOnboarding() {
    localStorage.setItem(APP_ONBOARDING_STORAGE_KEY, APP_ONBOARDING_VERSION);
    setShowProductOnboarding(false);
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  // Rendered on screens that have no toolbar of their own so the light/dark
  // control is available on every page.
  const floatingThemeToggle = <ThemeToggle theme={theme} onToggle={toggleTheme} floating />;

  if (!envConfigured()) {
    return (
      <>
        {floatingThemeToggle}
        <main className="setup-screen">
          <div className="setup-panel">
            <WalletCards size={32} />
            <h1>Connect Supabase</h1>
            <p>Create `.env` from `.env.example`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.</p>
          </div>
        </main>
      </>
    );
  }

  if (authLoading) {
    return (
      <>
        {floatingThemeToggle}
        <main className="loading-screen">Loading budget workspace...</main>
      </>
    );
  }

  if (legalPage) {
    return (
      <>
        {floatingThemeToggle}
        <LegalPage page={legalPage} onBack={() => setLegalPage(null)} />
      </>
    );
  }

  if (feedbackOpen) {
    return (
      <>
        {floatingThemeToggle}
        <FeedbackPage userEmail={session?.user.email} onBack={() => setFeedbackOpen(false)} onMessage={setToast} />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  if (!session) {
    return showAuth ? (
      <>
        {floatingThemeToggle}
        <AuthView initialMode={authMode} onMessage={setToast} onAuthenticated={setPendingPassword} />
        {showProductOnboarding && <ProductOnboarding onClose={dismissProductOnboarding} />}
        {toast && <div className="toast">{toast}</div>}
      </>
    ) : (
      <>
        <LandingPage
          onGetStarted={(mode = 'signup') => {
            setAuthMode(mode);
            setShowAuth(true);
          }}
          onOpenLegal={setLegalPage}
          onOpenFeedback={() => setFeedbackOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {showProductOnboarding && <ProductOnboarding onClose={dismissProductOnboarding} />}
      </>
    );
  }

  // User returned from a password-reset email: set a new password and restore
  // the encrypted vault with the recovery code.
  if (recoveringPassword && session) {
    return (
      <>
        {floatingThemeToggle}
        <ResetPasswordView
          session={session}
          onMessage={(message) => {
            setRecoveringPassword(false);
            window.history.replaceState({}, document.title, window.location.pathname);
            setToast(message);
          }}
        />
      </>
    );
  }

  // Session exists but the encryption key isn't in memory (e.g. after a page
  // refresh). Re-derive it before showing any data.
  if (!hasDEK()) {
    return (
      <>
        {floatingThemeToggle}
        <VaultGate
          session={session}
          onMessage={setToast}
          initialPassword={pendingPassword}
          onPasswordConsumed={() => setPendingPassword(null)}
        />
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup small">
          <div className="brand-mark">
            <WalletCards size={23} />
          </div>
          <div>
            <p className="eyebrow">PaceMint</p>
            <strong>
              {activePage === 'dashboard'
                ? 'Budget dashboard'
                : activePage === 'budget'
                  ? 'Budget settings'
                  : 'Settings'}
            </strong>
          </div>
        </div>
        <nav className="page-tabs" aria-label="Primary navigation">
          <button
            className={activePage === 'dashboard' ? 'page-tab active' : 'page-tab'}
            onClick={() => setActivePage('dashboard')}
            type="button"
          >
            <LayoutDashboard size={17} />
            Dashboard
          </button>
          <button
            className={activePage === 'budget' ? 'page-tab active' : 'page-tab'}
            onClick={() => setActivePage('budget')}
            type="button"
          >
            <SlidersHorizontal size={17} />
            Budget
          </button>
          <button
            className={activePage === 'settings' ? 'page-tab active' : 'page-tab'}
            onClick={() => setActivePage('settings')}
            type="button"
          >
            <Settings size={17} />
            Settings
          </button>
        </nav>
        <div className="topbar-actions">
          <HeaderPeriodMenu
            mode={budget.mode}
            period={budget.period}
            profiles={budget.profiles}
            selectedProfile={budget.selectedProfile}
            onModeChange={(mode) => {
              if (mode === 'statement' && budget.profiles.filter((profile) => !profile.archivedAt).length === 0) {
                setActivePage('budget');
                setToast('Add a statement profile before switching to statement mode.');
                return;
              }
              void budget.changeMode(mode);
            }}
            onProfileChange={budget.selectProfile}
            onShift={budget.shiftPeriod}
            onMonthlyAnchorChange={budget.setMonthlyAnchor}
            onManageProfiles={() => setActivePage('budget')}
          />
          <HeaderActionsMenu
            theme={theme}
            onRefresh={() => void budget.refresh()}
            onToggleTheme={toggleTheme}
            onFeedback={() => setFeedbackOpen(true)}
            onSignOut={() => void supabase.auth.signOut()}
          />
        </div>
      </header>

      {budget.error && <div className="alert-banner">{budget.error}</div>}
      {budget.loading && <div className="loading-bar" />}

      <main className="dashboard">
        {!budget.loading && !budget.data.settings ? (
          <OnboardingPanel onSave={budget.saveSettings} />
        ) : activePage === 'dashboard' ? (
          <>
            <section className="intro-band intro-band--solo">
              <div>
                <div className="intro-eyebrow-row">
                  <p className="eyebrow">Savings reserved first</p>
                  <details className="hint">
                    <summary aria-label="How the spending cap works">?</summary>
                    <span className="hint-popover">
                      Your configured budget and income after savings set the spending cap for {budget.period.label}.
                      Recurring templates are expanded into the selected period.
                    </span>
                  </details>
                </div>
                <h1>
                  {budget.summary.remaining < 0
                    ? `Your ${budget.mode === 'statement' ? 'statement' : 'monthly'} plan needs attention.`
                    : 'Know what you can spend with confidence.'}
                </h1>
              </div>
            </section>

            <SummaryCards summary={budget.summary} />

            {budget.mode === 'statement' && (
              <div className="info-banner">
                This view includes only expenses assigned to {budget.selectedProfile?.name}. Unassigned spending remains visible in Monthly mode.
              </div>
            )}

            <div className="dashboard-stack">
              <ExpenseManager
                expenses={budget.data.expenses}
                defaultDate={defaultExpenseDate}
                profiles={budget.profiles}
                defaultProfileId={budget.mode === 'statement' && !budget.selectedProfile?.archivedAt ? budget.selectedProfile?.id ?? null : null}
                onCreate={budget.createExpense}
                onUpdate={budget.updateExpense}
                onDelete={budget.deleteExpense}
              />
              <IncomeManager
                income={budget.data.oneTimeIncome}
                defaultDate={defaultExpenseDate}
                onCreate={budget.createOneTimeIncome}
                onUpdate={budget.updateOneTimeIncome}
                onDelete={budget.deleteOneTimeIncome}
              />
              <Charts categories={budget.categorySummaries} trend={budget.trend} />
              <BudgetChat
                period={budget.period}
                summary={budget.summary}
                categories={budget.categorySummaries}
                expenses={budget.data.expenses}
                recurringExpenses={budget.data.recurringExpenses}
                excludeDescriptions={budget.data.settings?.excludeDescriptionsFromAI ?? false}
              />
            </div>
          </>
        ) : activePage === 'budget' ? (
          <>
            <section className="settings-hero">
              <div>
                <p className="eyebrow">Budget controls</p>
                <h1>Manage the rules behind your budget periods.</h1>
              </div>
              <p>
                Update monthly and statement plans, category limits, recurring templates, and data portability tools.
              </p>
            </section>
            <section className="settings-grid" aria-label="Budget settings panels">
              <div className="settings-main">
                <PlanSettings settings={budget.data.settings} onSave={budget.saveSettings} />
                <StatementProfiles profiles={budget.profiles} onSave={budget.saveStatementProfiles} />
                <CategoryBudgets
                  summaries={budget.categorySummaries}
                  onSave={budget.saveCategoryLimit}
                  onGenerateAutoAllocation={budget.generateCategoryAllocation}
                  onApplyAutoAllocation={budget.applyCategoryAllocation}
                />
                <RecurringPanel
                  recurring={budget.data.recurringExpenses}
                  profiles={budget.profiles}
                  onCreate={budget.createRecurringExpense}
                  onDelete={budget.deleteRecurringExpense}
                />
              </div>
              <aside className="settings-rail">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Data</p>
                      <h2>Import and export</h2>
                    </div>
                  </div>
                  <p className="settings-copy">Download an Excel workbook or import an existing PaceMint JSON backup.</p>
                  <DataPortability onExport={budget.exportData} onImport={budget.importData} onMessage={setToast} />
                </section>
              </aside>
            </section>
          </>
        ) : (
          <>
            <section className="settings-hero">
              <div>
                <p className="eyebrow">Account</p>
                <h1>Security and account settings.</h1>
              </div>
              <p>Manage your sign-in details, two-factor authentication, recovery code, and account.</p>
            </section>
            <section className="settings-grid settings-grid--single" aria-label="Account settings panels">
              <SettingsPanel
                userId={session.user.id}
                userEmail={session.user.email ?? ''}
                settings={budget.data.settings}
                onToggleExcludeDescriptions={budget.setExcludeDescriptionsFromAI}
                onMessage={setToast}
              />
            </section>
          </>
        )}
      </main>
      <footer className="app-footer">
        <button type="button" onClick={() => setLegalPage('privacy')}>
          Privacy
        </button>
        <button type="button" onClick={() => setLegalPage('terms')}>
          Terms
        </button>
        <button type="button" onClick={() => setLegalPage('support')}>
          Support
        </button>
        <button type="button" onClick={() => setFeedbackOpen(true)}>
          Feedback
        </button>
        <button type="button" onClick={() => setLegalPage('data-deletion')}>
          Data deletion
        </button>
        <button type="button" onClick={() => setLegalPage('ai-disclosure')}>
          AI disclosure
        </button>
      </footer>
      {showProductOnboarding && <ProductOnboarding onClose={dismissProductOnboarding} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
