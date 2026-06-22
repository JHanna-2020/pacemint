import { Moon, Sun } from 'lucide-react';

type Props = {
  theme: 'dark' | 'light';
  onToggle: () => void;
  // When true, renders as a fixed control in the top-right corner. Used on
  // screens that don't have a toolbar to host the toggle inline.
  floating?: boolean;
};

export function ThemeToggle({ theme, onToggle, floating = false }: Props) {
  return (
    <button
      className={floating ? 'icon-button theme-toggle-floating' : 'icon-button'}
      type="button"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={onToggle}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
