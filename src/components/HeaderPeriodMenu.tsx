import { useEffect, useRef } from 'react';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { BudgetMode, BudgetPeriod, StatementProfile } from '../lib/types';

type Props = {
  mode: BudgetMode;
  period: BudgetPeriod;
  profiles: StatementProfile[];
  selectedProfile: StatementProfile | null;
  onModeChange: (mode: BudgetMode) => void;
  onProfileChange: (profileId: string) => void;
  onShift: (delta: number) => void;
  onMonthlyAnchorChange: (monthKey: string) => void;
  onManageProfiles: () => void;
};

export function HeaderPeriodMenu({
  mode,
  period,
  profiles,
  selectedProfile,
  onModeChange,
  onProfileChange,
  onShift,
  onMonthlyAnchorChange,
  onManageProfiles
}: Props) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const activeProfiles = profiles.filter((profile) => !profile.archivedAt);

  function close() {
    menuRef.current?.removeAttribute('open');
  }

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return (
    <details className="header-menu period-menu" ref={menuRef}>
      <summary className="header-menu-trigger period-menu-trigger" aria-label="Choose budget period">
        <CalendarRange size={18} />
        <span className="header-menu-trigger-text">
          <small>{mode === 'statement' ? selectedProfile?.name ?? 'Statement' : 'Monthly budget'}</small>
          <strong>{period.label}</strong>
        </span>
        <ChevronDown className="menu-chevron" size={16} />
      </summary>
      <div className="header-popover period-popover">
        <div className="popover-heading">
          <div><p className="eyebrow">Budget period</p><strong>Choose your view</strong></div>
        </div>
        <div className="mode-toggle" role="group" aria-label="Budget period type">
          <button className={mode === 'monthly' ? 'active' : ''} type="button" onClick={() => { onModeChange('monthly'); close(); }}>Monthly</button>
          <button className={mode === 'statement' ? 'active' : ''} type="button" onClick={() => { onModeChange('statement'); close(); }}>Statement</button>
        </div>
        {mode === 'statement' && (
          <label>
            Statement profile
            <select value={selectedProfile?.id ?? ''} onChange={(event) => onProfileChange(event.target.value)}>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}{profile.archivedAt ? ' (archived)' : ''}</option>
              ))}
            </select>
          </label>
        )}
        <div className="period-menu-navigation">
          <button className="icon-button" type="button" aria-label="Previous period" onClick={() => onShift(-1)}><ChevronLeft size={18} /></button>
          {mode === 'monthly' ? (
            <input aria-label="Selected month" type="month" value={period.anchorMonth} onChange={(event) => onMonthlyAnchorChange(event.target.value)} />
          ) : (
            <div><small>Current selection</small><strong>{period.label}</strong></div>
          )}
          <button className="icon-button" type="button" aria-label="Next period" onClick={() => onShift(1)}><ChevronRight size={18} /></button>
        </div>
        {activeProfiles.length === 0 && <p className="popover-note">Add a statement profile before using statement mode.</p>}
        <button className="popover-action" type="button" onClick={() => { close(); onManageProfiles(); }}>
          <SlidersHorizontal size={17} /> Manage statement profiles
        </button>
      </div>
    </details>
  );
}
