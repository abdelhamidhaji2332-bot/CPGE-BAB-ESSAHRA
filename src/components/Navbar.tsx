import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Compass,
  GraduationCap,
  Home,
  Menu,
  Search,
  Shield,
  Terminal,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

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
  { labelFr: 'Internat', labelAr: 'الداخلية', href: '/internat', icon: Home },
  { labelFr: 'Vie Campus', labelAr: 'الحياة الطلابية', href: '/vie-campus', icon: GraduationCap },
  { labelFr: 'Espace Prof', labelAr: 'فضاء الأساتذة', href: '/espace-prof', icon: Terminal },
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

  return (
    <motion.header
      initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
      animate={entranceReady ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40"
    >
      {/* Topbar: linear-gradient(90deg, var(--rust), var(--dune)) */}
      <div className="topbar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3.5 py-2.5 sm:gap-4 sm:px-7 sm:py-3.5">
          <button
            type="button"
            onClick={() => handleLink('/')}
            className="inline-flex min-w-0 items-center gap-2.5 text-left sm:gap-3 shrink-0 cursor-pointer"
          >
            <img
              src="/images/logo.png"
              alt="Logo Site Prépa BAB Sahra"
              className="h-10 w-10 rounded-lg border border-[#f7ead0]/35 object-cover sm:h-[50px] sm:w-[50px]"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-display text-lg font-normal tracking-wider text-[#f7ead0] sm:text-2xl">
                {t('Site Prépa', 'موقع التحضيرية')}
              </span>
              <span className="text-[10px] font-medium text-[#f7ead0]/85 sm:text-[11px]">
                {t('BAB Sahra · CPGE Guelmim', 'باب الصحراء · كلميم')}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenClassSwitcher}
              aria-label={t('Choisir une classe', 'اختيار القسم')}
              className="btn-outline-light inline-flex items-center gap-1.5 !px-2.5 !py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer sm:!px-4"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('Classes · ⌘K', 'الأقسام')}</span>
            </button>

            <button
              type="button"
              onClick={toggleLang}
              aria-label={lang === 'ar' ? 'Passer en français' : 'التبديل إلى العربية'}
              className="btn-outline-light !px-2.5 !py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer sm:!px-4"
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
              className="btn-outline-light inline-flex items-center gap-1.5 !px-2.5 !py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer sm:!px-4"
            >
              <User className="h-3.5 w-3.5 sm:hidden" />
              <span className="hidden sm:inline">
                {user ? user.fullName.split(' ')[0] : t('Connexion', 'تسجيل الدخول')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((p) => !p)}
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileOpen}
              className="md:hidden inline-flex items-center justify-center rounded-lg border border-[#f7ead0]/45 p-2 text-[#f7ead0] hover:bg-[#f7ead0]/15 transition-colors cursor-pointer"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Sand Navigation Bar (Desktop) */}
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

      {/* Smooth Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="sand-nav md:hidden border-t border-[#c98f4f]/40 px-3.5 py-3 shadow-lg"
            aria-label="Navigation mobile"
          >
            <div className="grid grid-cols-2 gap-2">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const active =
                  link.href === '/'
                    ? currentPath === '/'
                    : currentPath === link.href || currentPath.startsWith(link.href + '/');
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => handleLink(link.href)}
                    className={`sand-nav-link flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold cursor-pointer ${
                      active
                        ? 'active border-[#a8532c]'
                        : 'border-[#c98f4f]/45 bg-[#fcf4e4]/65'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[#f7ead0]' : 'text-[#a8532c]'}`} />
                    <span className="truncate">{t(link.labelFr, link.labelAr)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2 border-t border-[#c98f4f]/40 pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenClassSwitcher();
                }}
                className="btn-sand flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 text-[#a8532c]" />
                {t('Chercher une classe', 'البحث عن قسم')}
              </button>
              <button
                type="button"
                onClick={() => handleLink('/portail')}
                className="btn-rust flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
              >
                <User className="h-3.5 w-3.5" />
                {user ? user.fullName.split(' ')[0] : t('Connexion', 'تسجيل الدخول')}
              </button>
              {isDevTeam ? (
                <button
                  type="button"
                  onClick={() => handleLink('/dev-team')}
                  className="btn-rust w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  {t('Panneau Équipe Dev', 'لوحة فريق التطوير')}
                </button>
              ) : null}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
