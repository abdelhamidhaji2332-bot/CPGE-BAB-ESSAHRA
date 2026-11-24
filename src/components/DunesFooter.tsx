import { useLang } from '../context/LangContext';

export function DunesFooter({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useLang();

  return (
    <div className="mt-auto">
      {/* Exact Repo Dunes SVG Wave */}
      <svg
        className="dunes block h-[50px] w-full"
        viewBox="0 0 1200 50"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 50 V30 C200 0 350 0 550 25 C750 50 950 5 1200 28 V50 Z"
          fill="var(--footer-bg)"
        />
      </svg>

      <footer className="dunes-footer px-4 pt-2 pb-[calc(5.25rem+env(safe-area-inset-bottom))] text-center md:pb-7">
        <div className="mx-auto max-w-5xl">
          <h3 className="font-display text-base sm:text-lg font-semibold text-[#c98f4f] dark:text-[#e88c5d]">
            {t('Contact — CPGE Bab Sahra', 'اتصل بنا — القسم التحضيري باب الصحراء')}
          </h3>

          <div className="mt-3 flex flex-col items-center justify-center gap-2 text-sm text-[#e6c58c] dark:text-[#d6c4a5] sm:flex-row sm:flex-wrap sm:gap-6">
            <button
              type="button"
              onClick={() => onNavigate('/vie-campus')}
              className="inline-flex min-h-[40px] items-center hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] cursor-pointer sm:min-h-0"
            >
              {t('Instagram (Groupe Média)', 'إنستغرام (مجموعة الإعلام)')}
            </button>
            <a href="mailto:cpgebas@email.com" className="inline-flex min-h-[40px] items-center hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] sm:min-h-0">
              {t('E-mail', 'البريد الإلكتروني')}:&nbsp;<bdi>cpgebas@email.com</bdi>
            </a>
            <a href="tel:+212600000000" className="inline-flex min-h-[40px] items-center hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] sm:min-h-0">
              {t('Téléphone', 'الهاتف')}:&nbsp;<bdi>+212 600 000 000</bdi>
            </a>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-[#c98f4f]/25 dark:border-[#5a4634]/50 pt-4 text-xs text-[#e6c58c]/85 dark:text-[#c8b696] sm:mt-5 sm:gap-5">
            <button type="button" onClick={() => onNavigate('/classes/MPSI')} className="inline-flex min-h-[40px] items-center px-1.5 hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] cursor-pointer sm:min-h-0 sm:px-0">
              {t('Classes', 'الأقسام')}
            </button>
            <button type="button" onClick={() => onNavigate('/ressources')} className="inline-flex min-h-[40px] items-center px-1.5 hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] cursor-pointer sm:min-h-0 sm:px-0">
              {t('Bibliothèque PDF', 'المكتبة PDF')}
            </button>
            <button type="button" onClick={() => onNavigate('/internat')} className="inline-flex min-h-[40px] items-center px-1.5 hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] cursor-pointer sm:min-h-0 sm:px-0">
              {t('Internat', 'الداخلية')}
            </button>
            <button type="button" onClick={() => onNavigate('/vie-campus')} className="inline-flex min-h-[40px] items-center px-1.5 hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] cursor-pointer sm:min-h-0 sm:px-0">
              {t('BDE & Groupe Média', 'مكتب الطلبة والإعلام')}
            </button>
            <button type="button" onClick={() => onNavigate('/administration')} className="inline-flex min-h-[40px] items-center px-1.5 hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] cursor-pointer sm:min-h-0 sm:px-0">
              {t('Administration', 'الإدارة')}
            </button>
            <button type="button" onClick={() => onNavigate('/portail')} className="inline-flex min-h-[40px] items-center px-1.5 hover:text-[#f7ead0] dark:hover:text-[#fdf6e9] cursor-pointer sm:min-h-0 sm:px-0">
              {t('Portail & Équipe Dev', 'البوابة وفريق التطوير')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
