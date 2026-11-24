import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Compass,
  GraduationCap,
  Home,
  Megaphone,
  MessageSquare,
  Search,
  Table2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../context/LangContext';
import { CAMPUS_CLASSES, type AcademicLevel, type ClassCode } from '../shared/curriculum';

const NEXT_STAGE_MAP: Partial<Record<ClassCode, { label: string; target: ClassCode }>> = {
  MPSI: { label: 'Suite en Spé : MP', target: 'MP' },
  PCSI1: { label: 'Suite en Spé : PSI1', target: 'PSI1' },
  PCSI2: { label: 'Suite en Spé : PSI2', target: 'PSI2' },
  ECS: { label: 'Suite en Spé : 2ECS', target: '2ECS' },
  MP: { label: '1ère année : MPSI', target: 'MPSI' },
  PSI1: { label: '1ère année : PCSI1', target: 'PCSI1' },
  PSI2: { label: '1ère année : PCSI2', target: 'PCSI2' },
  '2ECS': { label: '1ère année : ECS', target: 'ECS' },
};

export function ClassQuickSwitcher({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | AcademicLevel>('ALL');
  const [selectedCode, setSelectedCode] = useState<ClassCode>('MPSI');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filteredClasses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CAMPUS_CLASSES.filter((cls) => {
      if (levelFilter !== 'ALL' && cls.level !== levelFilter) return false;
      if (!q) return true;
      return (
        cls.code.toLowerCase().includes(q) ||
        cls.filiere.toLowerCase().includes(q) ||
        cls.description.toLowerCase().includes(q) ||
        cls.subjects.some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [query, levelFilter]);

  const activeClass = useMemo(
    () => filteredClasses.find((c) => c.code === selectedCode) || filteredClasses[0] || CAMPUS_CLASSES[0],
    [filteredClasses, selectedCode]
  );

  const jumpTo = (path: string) => {
    onClose();
    onNavigate(path);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#2a190d]/70 p-0 backdrop-blur-xs dark:bg-[#050403]/85 sm:items-start sm:px-4 sm:pt-16 sm:pb-6"
          role="dialog"
          aria-modal="true"
          aria-label={t('Sélecteur rapide des classes et espaces', 'الانتقال السريع بين الأقسام والفضاءات')}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 18 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-[#c98f4f] bg-[#fcf4e4] text-[#4a2e1a] shadow-2xl dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] sm:max-h-[84vh] sm:rounded-xl"
          >
            {/* Mobile Sheet Handle */}
            <div className="flex justify-center bg-[#f7ead0] pt-2 dark:bg-[#161310] sm:hidden" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-[#c98f4f]/55 dark:bg-[#5a4634]" />
            </div>

            {/* Search Header */}
            <div className="border-b border-[#c98f4f]/40 bg-[#f7ead0] px-4 py-3 dark:border-[#423428] dark:bg-[#161310] sm:px-5 sm:py-3.5">
              <div className="flex items-center gap-2.5">
                <Search className="h-4 w-4 shrink-0 text-[#a8532c] dark:text-[#e88c5d]" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(
                    'Classe (MPSI, MP...) ou matière...',
                    'ابحث عن قسم أو مادة...'
                  )}
                  className="w-full bg-transparent text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/50 focus:outline-none dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                />
                <div className="hidden sm:flex items-center gap-1 rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/65 p-0.5 shrink-0 dark:border-[#5a4634] dark:bg-[#27221c]">
                  {(['ALL', 'Sup', 'Spé'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevelFilter(lvl)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                        levelFilter === lvl
                          ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                          : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#e3d4b7] dark:hover:bg-[#332b23]'
                      }`}
                    >
                      {lvl === 'ALL' ? t('Toutes', 'الكل') : lvl}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('Fermer', 'إغلاق')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#c98f4f]/50 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] transition-colors cursor-pointer dark:border-[#5a4634] dark:text-[#e88c5d] dark:hover:bg-[#c25e32] dark:hover:text-[#fdf6e9] sm:h-8 sm:w-8"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile Level Filter */}
              <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg border border-[#c98f4f]/45 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:hidden">
                {(['ALL', 'Sup', 'Spé'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFilter(lvl)}
                    className={`min-h-[36px] rounded-md px-2 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                      levelFilter === lvl
                        ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                        : 'text-[#4a2e1a] dark:text-[#e3d4b7]'
                    }`}
                  >
                    {lvl === 'ALL' ? t('Toutes (8)', 'الكل (8)') : lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Split Body */}
            <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-12">
              {/* Mobile Compact Horizontal Class Selector */}
              <div className="border-b border-[#c98f4f]/35 bg-[#fcf4e4] p-3.5 dark:border-[#423428] dark:bg-[#1c1916] md:hidden">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                  {t('Sélectionnez une classe', 'اختر القسم')} ({filteredClasses.length})
                </p>
                {filteredClasses.length === 0 ? (
                  <p className="rounded-lg border border-[#c98f4f]/35 bg-[#f7ead0] p-3 text-xs text-[#4a2e1a]/75 dark:border-[#423428] dark:bg-[#26211c] dark:text-[#c8b696]">
                    {t('Aucune classe ne correspond à votre recherche.', 'لا يوجد قسم مطابق للبحث.')}
                  </p>
                ) : (
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {filteredClasses.map((cls) => {
                      const isSelected = activeClass.code === cls.code;
                      return (
                        <button
                          key={cls.code}
                          type="button"
                          onClick={() => setSelectedCode(cls.code)}
                          className={`min-h-[44px] shrink-0 rounded-xl border px-3.5 py-2 text-start transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-[#a8532c] bg-[#a8532c] text-[#f7ead0] dark:border-[#c25e32] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                              : 'border-[#c98f4f]/45 bg-[#f7ead0] text-[#4a2e1a] dark:border-[#423428] dark:bg-[#26211c] dark:text-[#f5ebd6]'
                          }`}
                        >
                          <span className="block font-display text-sm font-bold leading-tight">
                            {cls.code}
                          </span>
                          <span
                            className={`block text-[10px] ${
                              isSelected ? 'text-[#f7ead0]/85 dark:text-[#fdf6e9]/90' : 'text-[#4a2e1a]/70 dark:text-[#c8b696]'
                            }`}
                          >
                            {cls.level}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Desktop Left: 8 Classes List */}
              <div className="hidden border-b border-[#c98f4f]/35 p-4 dark:border-[#423428] md:block md:col-span-5 md:border-b-0 md:border-e">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                  {t('Classes CPGE Bab Sahra', 'أقسام باب الصحراء')} ({filteredClasses.length})
                </p>

                {filteredClasses.length === 0 ? (
                  <p className="rounded-lg border border-[#c98f4f]/35 bg-[#f7ead0] p-4 text-xs text-[#4a2e1a]/75 dark:border-[#423428] dark:bg-[#26211c] dark:text-[#c8b696]">
                    {t('Aucune classe ne correspond à votre recherche.', 'لا يوجد قسم مطابق للبحث.')}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredClasses.map((cls) => {
                      const isSelected = activeClass.code === cls.code;
                      return (
                        <button
                          key={cls.code}
                          type="button"
                          onMouseEnter={() => setSelectedCode(cls.code)}
                          onClick={() => jumpTo(`/classes/${cls.code}`)}
                          className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-start transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-[#a8532c] bg-[#e6c58c] text-[#4a2e1a] dark:border-[#e88c5d] dark:bg-[#2a241d] dark:text-[#f5ebd6]'
                              : 'border-[#c98f4f]/30 bg-[#f7ead0]/70 hover:bg-[#e6c58c]/55 dark:border-[#423428] dark:bg-[#26211c] dark:hover:bg-[#332b23]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-base font-bold text-[#a8532c] dark:text-[#e88c5d]">
                                {cls.code}
                              </span>
                              <span className="text-[11px] font-medium text-[#4a2e1a]/75 dark:text-[#c8b696]">
                                {cls.level}
                              </span>
                            </div>
                            <p className="truncate text-xs text-[#4a2e1a]/85 dark:text-[#e3d4b7]">{cls.filiere}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#a8532c] dark:text-[#e88c5d]" />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 border-t border-[#c98f4f]/35 pt-4 dark:border-[#423428]">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                    {t('Accès direct campus', 'روابط مباشرة')}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: t('Ressources PDF', 'الموارد'), path: '/ressources', icon: BookOpen },
                      { label: t('Internat', 'الداخلية'), path: '/internat', icon: Home },
                      { label: t('Vie Campus', 'الحياة الطلابية'), path: '/vie-campus', icon: GraduationCap },
                      { label: t('Administration', 'الإدارة'), path: '/administration', icon: Building2 },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => jumpTo(item.path)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#c98f4f]/40 bg-[#f7ead0] px-2.5 py-2 text-xs font-medium text-[#4a2e1a] hover:bg-[#e6c58c] transition-colors cursor-pointer dark:border-[#423428] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:hover:bg-[#332b23]"
                        >
                          <Icon className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right (and main body on mobile): Live Selected Class Preview */}
              <div className="bg-[#f7ead0]/55 p-4 pb-6 dark:bg-[#161310] sm:p-5 md:col-span-7">
                <div className="flex flex-col justify-between gap-3 border-b border-[#c98f4f]/35 pb-4 dark:border-[#423428] sm:flex-row sm:items-start">
                  <div>
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                      {activeClass.levelLabel} · {activeClass.shortTrack}
                    </p>
                    <h3 className="mt-1 font-display text-xl sm:text-2xl font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                      {activeClass.code} — {activeClass.filiere}
                    </h3>
                    <p className="mt-1 text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">{activeClass.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => jumpTo(`/classes/${activeClass.code}`)}
                      className="btn-rust inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer md:hidden"
                    >
                      {t(`Ouvrir ${activeClass.code}`, `فتح ${activeClass.code}`)}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    {NEXT_STAGE_MAP[activeClass.code] ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCode(NEXT_STAGE_MAP[activeClass.code]!.target)}
                        className="btn-sand inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Compass className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                        {NEXT_STAGE_MAP[activeClass.code]!.label}
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Direct Tab Jump Actions */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                    {t('Ouvrir directement :', 'فتح مباشر:')}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: t('Colloscope', 'الكولوسكوب'), tab: 'colloscope', icon: Table2 },
                      { label: t('Emploi du temps', 'الجدول'), tab: 'emploi-du-temps', icon: Calendar },
                      { label: t('Annonces', 'الإعلانات'), tab: 'annonces', icon: Megaphone },
                      { label: t('Chat', 'الدردشة'), tab: 'chat', icon: MessageSquare },
                    ].map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.tab}
                          type="button"
                          onClick={() => jumpTo(`/classes/${activeClass.code}?tab=${action.tab}`)}
                          className="btn-rust inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold cursor-pointer"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clickable Subjects Index */}
                <div className="mt-5">
                  <p className="text-xs font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                    {t('Matières officielles (touchez pour filtrer) :', 'المواد الرسمية (انقر للتصفية):')}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {activeClass.subjects.map((sub) => (
                      <button
                        key={sub.slug}
                        type="button"
                        onClick={() =>
                          jumpTo(`/ressources?class=${activeClass.code}&subject=${sub.slug}`)
                        }
                        className="min-h-[44px] rounded-lg border border-[#c98f4f]/40 bg-[#fcf4e4] p-2.5 text-start hover:border-[#a8532c] hover:bg-[#e6c58c]/45 transition-colors cursor-pointer dark:border-[#423428] dark:bg-[#1c1916] dark:hover:border-[#e88c5d] dark:hover:bg-[#2a241d]"
                      >
                        <p className="text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d]">{sub.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[#4a2e1a]/75 dark:text-[#c8b696]">
                          {sub.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Campus Quick Links */}
                <div className="mt-5 border-t border-[#c98f4f]/35 pt-4 dark:border-[#423428] md:hidden">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                    {t('Accès direct campus', 'روابط مباشرة')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: t('Ressources PDF', 'الموارد'), path: '/ressources', icon: BookOpen },
                      { label: t('Internat', 'الداخلية'), path: '/internat', icon: Home },
                      { label: t('Vie Campus', 'الحياة الطلابية'), path: '/vie-campus', icon: GraduationCap },
                      { label: t('Administration', 'الإدارة'), path: '/administration', icon: Building2 },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => jumpTo(item.path)}
                          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#c98f4f]/45 bg-[#fcf4e4] px-3 py-2 text-xs font-semibold text-[#4a2e1a] active:bg-[#e6c58c] cursor-pointer dark:border-[#423428] dark:bg-[#1c1916] dark:text-[#f5ebd6] dark:active:bg-[#2a241d]"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[#a8532c] dark:text-[#e88c5d]" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
