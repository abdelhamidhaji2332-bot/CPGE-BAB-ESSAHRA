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
          fill="#4a2e1a"
        />
      </svg>

      <footer className="dunes-footer px-4 pt-2 pb-7 text-center">
        <div className="mx-auto max-w-5xl">
          <h3 className="font-display text-lg font-semibold text-[#c98f4f]">
            {t('Contact — CPGE Bab Sahra', 'اتصل بنا — القسم التحضيري باب الصحراء')}
          </h3>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-sm text-[#e6c58c]">
            <button
              type="button"
              onClick={() => onNavigate('/vie-campus')}
              className="hover:text-[#f7ead0] cursor-pointer"
            >
              {t('Instagram (Groupe Média)', 'إنستغرام (مجموعة الإعلام)')}
            </button>
            <a href="mailto:cpgebas@email.com" className="hover:text-[#f7ead0]">
              {t('E-mail', 'البريد الإلكتروني')}: <bdi>cpgebas@email.com</bdi>
            </a>
            <a href="tel:+212600000000" className="hover:text-[#f7ead0]">
              {t('Téléphone', 'الهاتف')}: <bdi>+212 600 000 000</bdi>
            </a>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-5 border-t border-[#c98f4f]/25 pt-4 text-xs text-[#e6c58c]/85">
            <button type="button" onClick={() => onNavigate('/classes/MPSI')} className="hover:text-[#f7ead0] cursor-pointer">
              {t('Classes', 'الأقسام')}
            </button>
            <button type="button" onClick={() => onNavigate('/ressources')} className="hover:text-[#f7ead0] cursor-pointer">
              {t('Bibliothèque PDF', 'المكتبة PDF')}
            </button>
            <button type="button" onClick={() => onNavigate('/internat')} className="hover:text-[#f7ead0] cursor-pointer">
              {t('Internat', 'الداخلية')}
            </button>
            <button type="button" onClick={() => onNavigate('/vie-campus')} className="hover:text-[#f7ead0] cursor-pointer">
              {t('BDE & Groupe Média', 'مكتب الطلبة والإعلام')}
            </button>
            <button type="button" onClick={() => onNavigate('/espace-prof')} className="hover:text-[#f7ead0] cursor-pointer">
              {t('Espace Professeur', 'فضاء الأساتذة')}
            </button>
            <button type="button" onClick={() => onNavigate('/portail')} className="hover:text-[#f7ead0] cursor-pointer">
              {t('Portail & Équipe Dev', 'البوابة وفريق التطوير')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
