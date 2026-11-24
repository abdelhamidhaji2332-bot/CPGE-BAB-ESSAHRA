import { Moon, Sun } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'topbar' | 'drawer';
  onAction?: () => void;
}

export function ThemeToggle({ variant = 'topbar', onAction }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLang();

  const handleToggle = () => {
    toggleTheme();
    onAction?.();
  };

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={isDark}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-[#c98f4f]/45 bg-[#f7ead0] px-3.5 py-2.5 text-start text-[#4a2e1a] transition-colors active:bg-[#e6c58c] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:active:bg-[#332b23] cursor-pointer"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e6c58c]/70 text-[#a8532c] dark:bg-[#362c22] dark:text-[#e88c5d]">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {isDark
                ? t('Mode Sable (Jour)', 'الوضع الرملي (نهاري)')
                : t('Mode Nuit (Révision)', 'الوضع الليلي (للمراجعة)')}
            </span>
            <span className="block truncate text-[11px] text-[#4a2e1a]/70 dark:text-[#c8b696]">
              {isDark
                ? t('Revenir au thème sable lumineux', 'العودة إلى المظهر الرملي المضيء')
                : t('Contraste élevé adapté à l’étude nocturne', 'تباين عالٍ مريح للدراسة الليلية')}
            </span>
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isDark}
      aria-label={
        isDark
          ? t('Passer au mode sable (jour)', 'التبديل إلى الوضع النهاري')
          : t('Passer au mode nuit (révision)', 'التبديل إلى الوضع الليلي')
      }
      title={
        isDark
          ? t('Mode Sable (Jour)', 'الوضع النهاري')
          : t('Mode Nuit (Révision)', 'الوضع الليلي')
      }
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f7ead0]/85 text-[#f7ead0] transition-colors hover:bg-[#f7ead0] hover:text-[#a8532c] dark:border-[#e88c5d]/60 dark:text-[#f5ebd6] dark:hover:bg-[#e88c5d] dark:hover:text-[#12100e] cursor-pointer sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-xs sm:font-medium sm:whitespace-nowrap"
    >
      {isDark ? (
        <Sun className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      ) : (
        <Moon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      )}
      <span className="hidden lg:inline">
        {isDark ? t('Jour', 'نهاري') : t('Nuit', 'ليلي')}
      </span>
    </button>
  );
}
