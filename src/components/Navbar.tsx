import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BedDouble,
  BookOpen,
  Building2,
  Compass,
  GraduationCap,
  Home,
  LayoutGrid,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeToggle } from './ThemeToggle';

export interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenClassSwitcher: () => void;
  entranceReady?: boolean;
}

const NAV_LINKS = [
  { labelFr: 'Accueil', labelAr: 'الرئيسية', href: '/', icon: Home },
  { labelFr: 'Classes', labelAr: 'الأقسام', href: '/classes', icon: Compass },
  { labelFr: 'Ressources', labelAr: 'الموارد PDF', href: '/ressources', icon: BookOpen },
  { labelFr: 'Internat', labelAr: 'الداخلية', href: '/internat', icon: BedDouble },
  { labelFr: 'Vie Campus', labelAr: 'الحياة الطلابية', href: '/vie-campus', icon: GraduationCap },
  { labelFr: 'Administration', labelAr: 'الإدارة', href: '/administration', icon: Building2 },
];

export function Navbar({
  currentPath,
  onNavigate,
  onOpenClassSwitcher,
  entranceReady = true,
}: NavbarProps) {
  const { user } = useAuth();
  const { lang, toggleLang, t } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handleLink = (href: string) => {
    setMobileOpen(false);
    onNavigate(href);
  };

  const isDevTeam = user?.role === 'admin';

  const isMoreActive =
    mobileOpen ||
    currentPath === '/vie-campus' ||
    currentPath === '/administration' ||
    currentPath === '/portail' ||
    currentPath === '/dev-team';

  const mobileBottomItems = [
    { labelFr: 'Accueil', labelAr: 'الرئيسية', href: '/', icon: Home },
    { labelFr: 'Classes', labelAr: 'الأقسام', href: '/classes', icon: Compass },
    { labelFr: 'PDF', labelAr: 'الموارد', href: '/ressources', icon: BookOpen },
    { labelFr: 'Internat', labelAr: 'الداخلية', href: '/internat', icon: BedDouble },
  ];

  return (
    <>
      <motion.header
        initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
        animate={entranceReady ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
        transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-40"
      >
        {/* Topbar: linear-gradient(90deg, var(--rust), var(--dune)) */}
        <div className="topbar">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-7 sm:py-3.5">
            <button
              type="button"
              onClick={() => handleLink('/')}
              className="inline-flex min-w-0 items-center gap-2 text-start sm:gap-3 shrink-0 cursor-pointer"
            >
              <img
                src="/images/logo.png"
                alt="Logo Site Prépa BAB Sahra"
                className="h-9 w-9 rounded-lg border border-[#f7ead0]/35 object-cover sm:h-[50px] sm:w-[50px]"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-display text-base font-normal tracking-wider text-[#f7ead0] sm:text-2xl">
                  {t('Site Prépa', 'موقع التحضيرية')}
                </span>
                <span className="hidden min-[360px]:block text-[10px] font-medium text-[#f7ead0]/85 sm:text-[11px]">
                  {t('BAB Sahra · CPGE Guelmim', 'باب الصحراء · كلميم')}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <div className="hidden min-[420px]:inline-flex">
                <PWAInstallButton variant="topbar" />
              </div>

              <ThemeToggle variant="topbar" />

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenClassSwitcher();
                }}
                aria-label={t('Choisir une classe', 'اختيار القسم')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f7ead0]/85 text-[#f7ead0] transition-colors hover:bg-[#f7ead0] hover:text-[#a8532c] dark:border-[#e88c5d]/60 dark:text-[#f5ebd6] dark:hover:bg-[#e88c5d] dark:hover:text-[#12100e] cursor-pointer sm:h-auto sm:w-auto sm:gap-1.5 sm:px-4 sm:py-1.5 sm:text-xs sm:font-medium sm:whitespace-nowrap"
              >
                <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">{t('Classes · ⌘K', 'الأقسام')}</span>
              </button>

              <button
                type="button"
                onClick={toggleLang}
                aria-label={lang === 'ar' ? 'Passer en français' : 'التبديل إلى العربية'}
                className="inline-flex h-10 min-w-[40px] items-center justify-center rounded-full border-2 border-[#f7ead0]/85 px-2.5 text-xs font-semibold text-[#f7ead0] transition-colors hover:bg-[#f7ead0] hover:text-[#a8532c] dark:border-[#e88c5d]/60 dark:text-[#f5ebd6] dark:hover:bg-[#e88c5d] dark:hover:text-[#12100e] whitespace-nowrap cursor-pointer sm:h-auto sm:px-4 sm:py-1.5 sm:font-medium"
              >
                <span className="sm:hidden">{lang === 'ar' ? 'FR' : 'AR'}</span>
                <span className="hidden sm:inline">{lang === 'ar' ? 'Français' : 'العربية'}</span>
              </button>

              {isDevTeam ? (
                <button
                  type="button"
                  onClick={() => handleLink('/dev-team')}
                  className="btn-outline-light hidden sm:inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  {t('Équipe Dev', 'فريق التطوير')}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => handleLink('/portail')}
                aria-label={user ? user.fullName : t('Connexion', 'تسجيل الدخول')}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f7ead0]/85 text-[#f7ead0] transition-colors hover:bg-[#f7ead0] hover:text-[#a8532c] dark:border-[#e88c5d]/60 dark:text-[#f5ebd6] dark:hover:bg-[#e88c5d] dark:hover:text-[#12100e] cursor-pointer sm:h-auto sm:w-auto sm:gap-1.5 sm:px-4 sm:py-1.5 sm:text-xs sm:font-medium sm:whitespace-nowrap"
              >
                <User className="h-4 w-4 sm:hidden" />
                {user ? (
                  <span
                    className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-[#a8532c] dark:ring-[#1d1612] sm:hidden"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="hidden sm:inline">
                  {user ? user.fullName.split(' ')[0] : t('Connexion', 'تسجيل الدخول')}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Sand Navigation Bar (Desktop & Tablet >= md) */}
        <nav
          className="sand-nav hidden md:flex justify-center flex-wrap"
          aria-label="Navigation principale"
        >
          {NAV_LINKS.map((link, idx) => {
            const active =
              link.href === '/'
                ? currentPath === '/'
                : currentPath === link.href || currentPath.startsWith(link.href + '/');
            return (
              <motion.button
                key={link.href}
                type="button"
                initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
                animate={entranceReady ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
                transition={{
                  duration: 0.28,
                  delay: entranceReady ? 0.04 * idx : 0,
                  ease: [0.16, 1, 0.3, 1],
                }}
                onClick={() => handleLink(link.href)}
                className={`sand-nav-link px-6 py-3 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'active' : ''
                }`}
              >
                {t(link.labelFr, link.labelAr)}
              </motion.button>
            );
          })}
          {isDevTeam ? (
            <button
              type="button"
              onClick={() => handleLink('/dev-team')}
              className={`sand-nav-link px-6 py-3 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                currentPath === '/dev-team' ? 'active' : ''
              }`}
            >
              {t('Panneau Dev', 'لوحة التطوير')}
            </button>
          ) : null}
        </nav>
      </motion.header>

      {/* Mobile "Plus" Bottom Sheet Drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-[#2a190d]/55 dark:bg-[#050403]/75 backdrop-blur-[2px] md:hidden"
          >
            <motion.nav
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              aria-label="Menu campus mobile"
              className="fixed inset-x-0 bottom-16 z-50 mx-3 mb-2 rounded-2xl border-2 border-[#c98f4f] bg-[#fcf4e4] p-4 shadow-2xl dark:border-[#5a4634] dark:bg-[#1c1916]"
            >
              <div className="mb-3 flex items-center justify-between border-b border-[#c98f4f]/35 pb-2.5 dark:border-[#423428]">
                <div>
                  <p className="font-display text-base font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                    {t('Navigation Campus', 'تصفح الفضاءات')}
                  </p>
                  {user ? (
                    <p className="text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">
                      {user.fullName} {user.classCode ? `· ${user.classCode}` : ''}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={t('Fermer le menu', 'إغلاق القائمة')}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#c98f4f]/50 text-[#4a2e1a] hover:bg-[#e6c58c] dark:border-[#5a4634] dark:text-[#f5ebd6] dark:hover:bg-[#2a241d] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    labelFr: 'Vie Campus & BDE',
                    labelAr: 'الحياة الطلابية و BDE',
                    descFr: 'Événements, BDE et page Instagram',
                    descAr: 'الأنشطة الطلابية ومكتب الطلبة',
                    href: '/vie-campus',
                    icon: GraduationCap,
                  },
                  {
                    labelFr: 'Administration',
                    labelAr: 'الإدارة',
                    descFr: 'Annonces officielles de la direction',
                    descAr: 'بلاغات وإعلانات الإدارة الرسمية',
                    href: '/administration',
                    icon: Building2,
                  },
                  {
                    labelFr: user ? `Mon Portail (${user.fullName.split(' ')[0]})` : 'Portail / Connexion',
                    labelAr: user ? `بوابتي (${user.fullName.split(' ')[0]})` : 'تسجيل الدخول',
                    descFr: user ? 'Profil et changement de session' : 'Accéder au compte élève ou prof',
                    descAr: 'الحساب الشخصي وتسجيل الدخول',
                    href: '/portail',
                    icon: User,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = currentPath === item.href;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => handleLink(item.href)}
                      className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start transition-colors cursor-pointer ${
                        active
                          ? 'border-[#a8532c] bg-[#a8532c] text-[#f7ead0] dark:border-[#c25e32] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                          : 'border-[#c98f4f]/45 bg-[#f7ead0] text-[#4a2e1a] active:bg-[#e6c58c] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:active:bg-[#332b23]'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          active
                            ? 'bg-[#f7ead0]/20 text-[#f7ead0] dark:bg-[#fdf6e9]/20 dark:text-[#fdf6e9]'
                            : 'bg-[#e6c58c]/70 text-[#a8532c] dark:bg-[#362c22] dark:text-[#e88c5d]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {t(item.labelFr, item.labelAr)}
                        </span>
                        <span
                          className={`block truncate text-[11px] ${
                            active ? 'text-[#f7ead0]/85 dark:text-[#fdf6e9]/85' : 'text-[#4a2e1a]/70 dark:text-[#c8b696]'
                          }`}
                        >
                          {t(item.descFr, item.descAr)}
                        </span>
                      </span>
                    </button>
                  );
                })}

                {isDevTeam ? (
                  <button
                    type="button"
                    onClick={() => handleLink('/dev-team')}
                    className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3.5 py-2 text-start transition-colors cursor-pointer ${
                      currentPath === '/dev-team'
                        ? 'border-[#a8532c] bg-[#a8532c] text-[#f7ead0] dark:border-[#c25e32] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                        : 'border-[#c98f4f]/60 bg-[#e6c58c]/65 text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#2a241d] dark:text-[#f5ebd6]'
                    }`}
                  >
                    <Shield className="h-4 w-4 shrink-0 text-[#a8532c] dark:text-[#e88c5d]" />
                    <span className="text-sm font-semibold">
                      {t('Panneau Équipe Dev', 'لوحة فريق التطوير')}
                    </span>
                  </button>
                ) : null}

                <ThemeToggle variant="drawer" onAction={() => setMobileOpen(false)} />

                <PWAInstallButton variant="drawer" onAction={() => setMobileOpen(false)} />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenClassSwitcher();
                }}
                className="btn-sand mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer"
              >
                <Search className="h-4 w-4 text-[#a8532c] dark:text-[#e88c5d]" />
                {t('Changer rapidement de classe (MPSI, MP...)', 'الانتقال السريع بين الأقسام')}
              </button>
            </motion.nav>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Fixed Thumb-Zone Bottom Navigation Bar (Mobile < md) */}
      <nav
        aria-label={t('Barre de navigation mobile', 'شريط التنقل السريع')}
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#c98f4f] bg-[#e6c58c]/95 backdrop-blur-md shadow-[0_-4px_18px_rgba(74,46,26,0.12)] dark:border-[#5a4634] dark:bg-[#1c1916]/95 dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)] md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/'
                ? currentPath === '/'
                : currentPath === item.href || currentPath.startsWith(item.href + '/');
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleLink(item.href)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                    : 'text-[#4a2e1a] active:bg-[#c98f4f]/30 dark:text-[#f5ebd6] dark:active:bg-[#2a241d]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    active ? 'text-[#f7ead0] dark:text-[#fdf6e9]' : 'text-[#a8532c] dark:text-[#e88c5d]'
                  }`}
                />
                <span className="max-w-full truncate">{t(item.labelFr, item.labelAr)}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileOpen((p) => !p)}
            aria-expanded={mobileOpen}
            aria-label={t('Plus d’espaces', 'المزيد')}
            className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              isMoreActive
                ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                : 'text-[#4a2e1a] active:bg-[#c98f4f]/30 dark:text-[#f5ebd6] dark:active:bg-[#2a241d]'
            }`}
          >
            <LayoutGrid
              className={`h-4 w-4 ${
                isMoreActive ? 'text-[#f7ead0] dark:text-[#fdf6e9]' : 'text-[#a8532c] dark:text-[#e88c5d]'
              }`}
            />
            <span className="max-w-full truncate">{t('Plus', 'المزيد')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
