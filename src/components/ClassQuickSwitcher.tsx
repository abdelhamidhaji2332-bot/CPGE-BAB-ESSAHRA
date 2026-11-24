import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Compass,
  GraduationCap,
  Home,
  MessageSquare,
  Search,
  Table2,
  Terminal,
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
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#2a190d]/70 px-4 pt-12 pb-6 backdrop-blur-xs sm:pt-16"
          role="dialog"
          aria-modal="true"
          aria-label={t('Sélecteur rapide des classes et espaces', 'الانتقال السريع بين الأقسام والفضاءات')}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#c98f4f] bg-[#fcf4e4] text-[#4a2e1a] shadow-2xl"
          >
            {/* Search Header */}
            <div className="flex items-center gap-3 border-b border-[#c98f4f]/40 bg-[#f7ead0] px-4 py-3.5 sm:px-5">
              <Search className="h-4 w-4 shrink-0 text-[#a8532c]" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(
                  'Rechercher une classe (MPSI, MP, ECS...) ou une matière (Physique, TIPE...)...',
                  'ابحث عن قسم (MPSI, MP, ECS...) أو مادة...'
                )}
                className="w-full bg-transparent text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/50 focus:outline-none"
              />
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/65 p-0.5 shrink-0">
                {(['ALL', 'Sup', 'Spé'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFilter(lvl)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                      levelFilter === lvl ? 'bg-[#a8532c] text-[#f7ead0]' : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                    }`}
                  >
                    {lvl === 'ALL' ? t('Toutes', 'الكل') : lvl}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="rounded-lg border border-[#c98f4f]/50 p-1.5 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Interactive Split Body */}
            <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-12">
              {/* Left: 8 Classes List */}
              <div className="border-b border-[#c98f4f]/35 p-4 md:col-span-5 md:border-b-0 md:border-r">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
                  {t('Classes CPGE Bab Sahra', 'أقسام باب الصحراء')} ({filteredClasses.length})
                </p>

                {filteredClasses.length === 0 ? (
                  <p className="rounded-lg border border-[#c98f4f]/35 bg-[#f7ead0] p-4 text-xs text-[#4a2e1a]/75">
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
                          className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-[#a8532c] bg-[#e6c58c] text-[#4a2e1a]'
                              : 'border-[#c98f4f]/30 bg-[#f7ead0]/70 hover:bg-[#e6c58c]/55'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-base font-bold text-[#a8532c]">
                                {cls.code}
                              </span>
                              <span className="text-[11px] font-medium text-[#4a2e1a]/75">
                                {cls.level}
                              </span>
                            </div>
                            <p className="truncate text-xs text-[#4a2e1a]/85">{cls.filiere}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#a8532c]" />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 border-t border-[#c98f4f]/35 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
                    {t('Accès direct campus', 'روابط مباشرة')}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: t('Ressources PDF', 'الموارد'), path: '/ressources', icon: BookOpen },
                      { label: t('Internat', 'الداخلية'), path: '/internat', icon: Home },
                      { label: t('Vie Campus', 'الحياة الطلابية'), path: '/vie-campus', icon: GraduationCap },
                      { label: t('Espace Prof', 'فضاء الأساتذة'), path: '/espace-prof', icon: Terminal },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => jumpTo(item.path)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#c98f4f]/40 bg-[#f7ead0] px-2.5 py-2 text-xs font-medium text-[#4a2e1a] hover:bg-[#e6c58c] transition-colors cursor-pointer"
                        >
                          <Icon className="h-3.5 w-3.5 text-[#a8532c]" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Live Selected Class Preview */}
              <div className="bg-[#f7ead0]/55 p-5 md:col-span-7">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#c98f4f]/35 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
                      {activeClass.levelLabel} · {activeClass.shortTrack}
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-semibold text-[#4a2e1a]">
                      {activeClass.code} — {activeClass.filiere}
                    </h3>
                    <p className="mt-1 text-xs text-[#4a2e1a]/80">{activeClass.description}</p>
                  </div>

                  {NEXT_STAGE_MAP[activeClass.code] ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCode(NEXT_STAGE_MAP[activeClass.code]!.target)}
                      className="btn-sand inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                    >
                      <Compass className="h-3.5 w-3.5 text-[#a8532c]" />
                      {NEXT_STAGE_MAP[activeClass.code]!.label}
                    </button>
                  ) : null}
                </div>

                {/* Direct Tab Jump Actions */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-[#4a2e1a]">
                    {t('Ouvrir directement :', 'فتح مباشر:')}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: t('Bibliothèque', 'المكتبة'), tab: 'bibliotheque', icon: BookOpen },
                      { label: t('Colloscope', 'الكولوسكوب'), tab: 'colloscope', icon: Table2 },
                      { label: t('Emploi du temps', 'الجدول'), tab: 'emploi-du-temps', icon: Calendar },
                      { label: t('Chat & Annonces', 'الدردشة'), tab: 'chat', icon: MessageSquare },
                    ].map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.tab}
                          type="button"
                          onClick={() => jumpTo(`/classes/${activeClass.code}?tab=${action.tab}`)}
                          className="btn-rust inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold cursor-pointer"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="truncate">{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clickable Subjects Index */}
                <div className="mt-5">
                  <p className="text-xs font-semibold text-[#4a2e1a]">
                    {t('Matières officielles (cliquez pour filtrer la bibliothèque) :', 'المواد الرسمية (انقر للتصفية):')}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {activeClass.subjects.map((sub) => (
                      <button
                        key={sub.slug}
                        type="button"
                        onClick={() =>
                          jumpTo(`/classes/${activeClass.code}?tab=bibliotheque&subject=${sub.slug}`)
                        }
                        className="rounded-lg border border-[#c98f4f]/40 bg-[#fcf4e4] p-2.5 text-left hover:border-[#a8532c] hover:bg-[#e6c58c]/45 transition-colors cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-[#a8532c]">{sub.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[#4a2e1a]/75">
                          {sub.description}
                        </p>
                      </button>
                    ))}
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
