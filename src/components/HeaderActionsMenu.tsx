import { useEffect, useRef } from 'react';
import { LogOut, MessageSquare, Moon, MoreHorizontal, RefreshCw, Sun } from 'lucide-react';

type Props = {
  theme: 'dark' | 'light';
  onRefresh: () => void;
  onToggleTheme: () => void;
  onFeedback: () => void;
  onSignOut: () => void;
};

export function HeaderActionsMenu({ theme, onRefresh, onToggleTheme, onFeedback, onSignOut }: Props) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  function run(action: () => void) {
    menuRef.current?.removeAttribute('open');
    action();
  }

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) menuRef.current.removeAttribute('open');
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') menuRef.current?.removeAttribute('open');
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return (
    <details className="header-menu actions-menu" ref={menuRef}>
      <summary className="icon-button header-actions-trigger" aria-label="Open account and display menu">
        <MoreHorizontal size={20} />
      </summary>
      <div className="header-popover actions-popover">
        <button type="button" onClick={() => run(onRefresh)}><RefreshCw size={17} /><span><strong>Refresh data</strong><small>Reload this budget period</small></span></button>
        <button type="button" onClick={() => run(onToggleTheme)}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span><strong>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</strong><small>Change the interface appearance</small></span></button>
        <button type="button" onClick={() => run(onFeedback)}><MessageSquare size={17} /><span><strong>Send feedback</strong><small>Report a problem or request</small></span></button>
        <div className="menu-divider" />
        <button className="danger-menu-item" type="button" onClick={() => run(onSignOut)}><LogOut size={17} /><span><strong>Sign out</strong><small>Lock this budgeting session</small></span></button>
      </div>
    </details>
  );
}
