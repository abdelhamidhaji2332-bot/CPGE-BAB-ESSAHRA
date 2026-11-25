import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Compass,
  FileText,
  GraduationCap,
  Megaphone,
  MessageSquare,
  Search,
  ShieldCheck,
  Table2,
  ZoomIn,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { ImageLightboxModal, type LightboxImage } from '../components/ImageLightboxModal';
import { PdfPreviewModal, type PreviewDoc } from '../components/PdfPreviewModal';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import { CAMPUS_CLASSES, getClassDefinition, type AcademicLevel, type ClassCode } from '../shared/curriculum';

interface ClassSummary {
  code: ClassCode;
  level: AcademicLevel;
  levelLabel: string;
  filiere: string;
  shortTrack: string;
  description: string;
  documentCount: number;
  subjectCount: number;
}

type TrackFilter = 'ALL' | 'SCIENTIFIQUE' | 'ECONOMIQUE';

const PROGRESSION_PARTNER: Record<ClassCode, { label: string; labelAr: string; target: ClassCode }> = {
  MPSI: { label: 'Suite en 2e année : MP', labelAr: 'المتابعة في السنة الثانية: MP', target: 'MP' },
  PCSI1: { label: 'Suite en 2e année : PSI1', labelAr: 'المتابعة في السنة الثانية: PSI1', target: 'PSI1' },
  PCSI2: { label: 'Suite en 2e année : PSI2', labelAr: 'المتابعة في السنة الثانية: PSI2', target: 'PSI2' },
  ECS: { label: 'Suite en 2e année : 2ECS', labelAr: 'المتابعة في السنة الثانية: 2ECS', target: '2ECS' },
  MP: { label: '1ère année associée : MPSI', labelAr: 'السنة الأولى المرتبطة: MPSI', target: 'MPSI' },
  PSI1: { label: '1ère année associée : PCSI1', labelAr: 'السنة الأولى المرتبطة: PCSI1', target: 'PCSI1' },
  PSI2: { label: '1ère année associée : PCSI2', labelAr: 'السنة الأولى المرتبطة: PCSI2', target: 'PCSI2' },
  '2ECS': { label: '1ère année associée : ECS', labelAr: 'السنة الأولى المرتبطة: ECS', target: 'ECS' },
};

interface GuideDoc {
  id: number;
  title: string;
  chapter: string;
  description: string;
  file_path: string;
  category: string;
}

export function LandingPage({
  onNavigate,
  onOpenClassSwitcher,
}: {
  onNavigate: (path: string) => void;
  onOpenClassSwitcher?: () => void;
}) {
  const { user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const [levelFilter, setLevelFilter] = useState<'ALL' | AcademicLevel>('ALL');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('ALL');
  const [inspectedCode, setInspectedCode] = useState<ClassCode>(
    () => (user?.classCode && getClassDefinition(user.classCode)?.code) || 'MPSI'
  );
  const [classes, setClasses] = useState<ClassSummary[]>(
    CAMPUS_CLASSES.map((c) => ({
      code: c.code,
      level: c.level,
      levelLabel: c.levelLabel,
      filiere: c.filiere,
      shortTrack: c.shortTrack,
      description: c.description,
      documentCount: 0,
      subjectCount: c.subjects.length,
    }))
  );
  const [guides, setGuides] = useState<GuideDoc[]>([]);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch('/api/classes', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('classes');
        return r.json();
      })
      .then((data) => {
        if (active && data?.classes) setClasses(data.classes);
      })
      .catch((err) => {
        if (active && err?.name !== 'AbortError') {
          toast.error(
            t('Impossible de charger les classes du campus.', 'تعذر تحميل قائمة الأقسام.')
          );
        }
      });

    fetch('/api/documents?category=guides', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('guides');
        return r.json();
      })
      .then((data) => {
        if (active && data?.documents) setGuides(data.documents);
      })
      .catch((err) => {
        if (active && err?.name !== 'AbortError') {
          toast.error(
            t('Impossible de charger les guides PDF.', 'تعذر تحميل أدلة PDF.')
          );
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [t, toast]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (levelFilter !== 'ALL' && c.level !== levelFilter) return false;
      const isEco = c.code === 'ECS' || c.code === '2ECS';
      if (trackFilter === 'ECONOMIQUE' && !isEco) return false;
      if (trackFilter === 'SCIENTIFIQUE' && isEco) return false;
      return true;
    });
  }, [classes, levelFilter, trackFilter]);

  useEffect(() => {
    if (filteredClasses.length > 0 && !filteredClasses.some((c) => c.code === inspectedCode)) {
      setInspectedCode(filteredClasses[0].code);
    }
  }, [filteredClasses, inspectedCode]);

  const inspectedSummary = useMemo(
    () => classes.find((c) => c.code === inspectedCode) || classes[0],
    [classes, inspectedCode]
  );

  const inspectedDefinition = useMemo(
    () => getClassDefinition(inspectedCode) || CAMPUS_CLASSES[0],
    [inspectedCode]
  );

  const partner = PROGRESSION_PARTNER[inspectedDefinition.code];

  const handleSelectPartner = (targetCode: ClassCode) => {
    setLevelFilter('ALL');
    setTrackFilter('ALL');
    setInspectedCode(targetCode);
  };

  return (
    <div className="bg-[#f7ead0] text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Row 1 (.row .img-right): CPGE Bab Sahra Guelmim */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 24 }}
          className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 pb-8 sm:pb-12 border-b-2 border-[#e6c58c] dark:border-[#332920]"
        >
          <div className="flex-1 w-full">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              {t(
                'CPGE Bab Sahra · Guelmim · Sup & Spé',
                'الأقسام التحضيرية باب الصحراء · كلميم · السنة 1 و 2'
              )}
            </p>
            <h1
              className="dune-heading mt-2 sm:mt-3 font-display text-2xl font-semibold leading-tight text-[#a8532c] dark:text-[#e88c5d] sm:text-4xl"
              style={{ textWrap: 'balance' }}
            >
              {t('CPGE — Campus Bab Sahra', 'الأقسام التحضيرية للمدارس العليا — باب الصحراء')}
            </h1>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed text-[#4a2e1a]/90 dark:text-[#e3d4b7]">
              {t(
                'Les Classes Préparatoires aux Grandes Écoles (CPGE) offrent une formation intensive et rigoureuse de deux ans pour préparer les étudiants aux concours d’admission des plus prestigieuses écoles d’ingénieurs et de commerce au Maroc et en France.',
                'توفّر الأقسام التحضيرية للمدارس العليا تكويناً مكثفاً ورصيناً لمدة سنتين يؤهّل الطلبة لاجتياز مباريات ولوج أرقى مدارس المهندسين والتجارة بالمغرب وفرنسا.'
              )}
            </p>
            <div className="mt-5 sm:mt-6 grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  if (user?.classCode) {
                    onNavigate(`/classes/${user.classCode}`);
                  } else {
                    document.getElementById('classes-campus')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="btn-rust inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap cursor-pointer"
              >
                {user?.classCode
                  ? t(`Ouvrir l’espace ${user.classCode}`, `فتح فضاء ${user.classCode}`)
                  : t('Explorer les 8 classes', 'استكشاف الأقسام الثمانية')}
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:gap-3">
                {onOpenClassSwitcher ? (
                  <button
                    type="button"
                    onClick={onOpenClassSwitcher}
                    className="btn-sand inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer"
                  >
                    <Search className="h-4 w-4 text-[#a8532c] dark:text-[#e88c5d]" />
                    <span className="sm:hidden">{t('Classes', 'الأقسام')}</span>
                    <span className="hidden sm:inline">{t('Sélecteur rapide (⌘K)', 'بحث سريع (⌘K)')}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => onNavigate('/portail')}
                  className="btn-sand inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer"
                >
                  {user ? t('Mon portail', 'بوابتـي') : t('Connexion', 'تسجيل الدخول')}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setLightboxImage({
                src: '/images/image1.png',
                title: 'Campus CPGE Bab Sahra · Guelmim',
                caption: t(
                  'Vue du campus des Classes Préparatoires aux Grandes Écoles à Guelmim',
                  'نظرة على فضاء الأقسام التحضيرية للمدارس العليا باب الصحراء بكلميم'
                ),
              })
            }
            className="group relative w-full md:w-[46%] overflow-hidden rounded-xl border border-[#c98f4f]/50 shadow-sm cursor-zoom-in dark:border-[#5a4634]"
          >
            <img
              src="/images/image1.png"
              alt="Campus CPGE Bab Sahra Guelmim"
              className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md bg-[#2a190d]/75 px-2.5 py-1 text-[11px] font-medium text-[#f7ead0] opacity-90 sm:opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
              <ZoomIn className="h-3 w-3" />
              {t('Agrandir', 'تكبير')}
            </span>
          </button>
        </motion.section>

        {/* Row 2 (.row .img-left): Les filières */}
        <section className="flex flex-col md:flex-row-reverse items-center gap-6 sm:gap-8 py-8 sm:py-12 border-b-2 border-[#e6c58c] dark:border-[#332920]">
          <div className="flex-1 w-full">
            <h2 className="dune-heading font-display text-xl sm:text-2xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
              {t('Les filières — Sup & Spé', 'المسالك والتخصصات')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4a2e1a]/90 dark:text-[#e3d4b7]">
              {t(
                'La CPGE Bab Sahra regroupe les filières scientifiques et économiques : MPSI et PCSI en première année (Sup), puis MP et PSI en deuxième année (Spé) pour les profils ingénieurs, ainsi que ECS et 2ECS pour l’accès aux grandes écoles de commerce.',
                'تضم ثانوية باب الصحراء المسالك العلمية والاقتصادية: MPSI و PCSI في السنة الأولى، ثم MP و PSI في السنة الثانية لمسالك المهندسين، إضافة إلى ECS و 2ECS لمدارس التجارة والتسيير.'
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/ressources')}
                className="btn-rust inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer sm:w-auto"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t('Bibliothèque PDF', 'المكتبة الرقمية')}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setLightboxImage({
                src: '/images/image2.png',
                title: t('Les filières — MPSI, PCSI, ECS, MP, PSI & 2ECS', 'المسالك والتخصصات'),
                caption: t(
                  'Filières scientifiques et économiques à la CPGE Bab Sahra',
                  'المسالك العلمية والاقتصادية بالأقسام التحضيرية باب الصحراء'
                ),
              })
            }
            className="group relative w-full md:w-[46%] overflow-hidden rounded-xl border border-[#c98f4f]/50 shadow-sm cursor-zoom-in dark:border-[#5a4634]"
          >
            <img
              src="/images/image2.png"
              alt="Filières MPSI PCSI ECS PSI MP à la CPGE Bab Sahra"
              className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md bg-[#2a190d]/75 px-2.5 py-1 text-[11px] font-medium text-[#f7ead0] opacity-90 sm:opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
              <ZoomIn className="h-3 w-3" />
              {t('Agrandir', 'تكبير')}
            </span>
          </button>
        </section>

        {/* 8 Official Classes Showcase Grid + Interactive Inspector */}
        <section id="classes-campus" className="py-8 sm:py-12 border-b-2 border-[#e6c58c] dark:border-[#332920]">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h2 className="dune-heading font-display text-xl sm:text-2xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                {t('Sélection & espaces des 8 classes', 'اختيار وفضاءات الأقسام الثمانية')}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                {t(
                  'Touchez une classe pour inspecter ses matières, son parcours Sup ↔ Spé et ouvrir directement la bibliothèque, le colloscope ou l’emploi du temps.',
                  'انقر على أي قسم لاستعراض مواده ومساره الدراسي والوصول المباشر للمكتبة أو الكولوسكوب أو جدول الحصص.'
                )}
              </p>
            </div>

            {onOpenClassSwitcher ? (
              <button
                type="button"
                onClick={onOpenClassSwitcher}
                className="btn-sand inline-flex items-center gap-2 self-start rounded-lg px-3.5 py-2 text-xs font-semibold lg:self-auto cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                {t('Recherche rapide (⌘K)', 'بحث سريع (⌘K)')}
              </button>
            ) : null}
          </div>

          {/* Interactive Filters: Level + Track */}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#c98f4f] bg-[#e6c58c]/60 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:inline-flex sm:items-center">
              {(['ALL', 'Sup', 'Spé'] as const).map((tab) => {
                const active = levelFilter === tab;
                const label =
                  tab === 'ALL'
                    ? t('Toutes (8)', 'الكل (8)')
                    : tab === 'Sup'
                      ? t('1A · Sup', 'السنة 1 · Sup')
                      : t('2A · Spé', 'السنة 2 · Spé');
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setLevelFilter(tab)}
                    className={`min-h-[38px] rounded-md px-2.5 py-1.5 text-center text-xs font-medium whitespace-nowrap transition-colors cursor-pointer sm:min-h-0 sm:px-3.5 ${
                      active
                        ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                        : 'text-[#4a2e1a] hover:bg-[#c98f4f]/30 dark:text-[#e3d4b7] dark:hover:bg-[#332b23]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#c98f4f] bg-[#e6c58c]/60 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:inline-flex sm:items-center">
              {(
                [
                  { id: 'ALL', label: t('Toutes filières', 'كل المسالك') },
                  { id: 'SCIENTIFIQUE', label: t('Scientifique', 'علمي') },
                  { id: 'ECONOMIQUE', label: t('Économique', 'اقتصادي') },
                ] as const
              ).map((trk) => {
                const active = trackFilter === trk.id;
                return (
                  <button
                    key={trk.id}
                    type="button"
                    onClick={() => setTrackFilter(trk.id)}
                    className={`min-h-[38px] rounded-md px-2 py-1.5 text-center text-xs font-medium whitespace-nowrap transition-colors cursor-pointer sm:min-h-0 sm:px-3 ${
                      active
                        ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                        : 'text-[#4a2e1a] hover:bg-[#c98f4f]/30 dark:text-[#e3d4b7] dark:hover:bg-[#332b23]'
                    }`}
                  >
                    {trk.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 sm:mt-6 grid grid-cols-1 min-[360px]:grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {filteredClasses.map((cls, idx) => {
              const selected = inspectedCode === cls.code;
              return (
                <GlowCard
                  key={cls.code}
                  delay={idx * 0.03}
                  onClick={() => setInspectedCode(cls.code)}
                  className={`p-3.5 sm:p-5 transition-all ${
                    selected
                      ? '!border-[#a8532c] !bg-[#e6c58c]/55 ring-2 ring-[#a8532c]/35 dark:!border-[#e88c5d] dark:!bg-[#2a241d] dark:ring-[#e88c5d]/35'
                      : ''
                  }`}
                >
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-[#4a2e1a]/70 dark:text-[#c8b696]">
                        <span className="truncate">{cls.level}</span>
                        <span className="font-mono tabular-nums font-medium text-[#a8532c] dark:text-[#e88c5d] shrink-0">
                          {cls.subjectCount} {t('mat.', 'مواد')}
                        </span>
                      </div>
                      <h3 className="mt-1.5 sm:mt-2.5 font-display text-lg sm:text-2xl font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                        {cls.code}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs sm:text-sm leading-snug text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
                        {cls.filiere}
                      </p>
                    </div>

                    <div className="mt-3 sm:mt-5 flex items-center justify-between border-t border-[#c98f4f]/35 pt-2 sm:pt-3 text-[11px] sm:text-xs dark:border-[#423428]">
                      <span className="font-mono tabular-nums text-[#4a2e1a]/70 dark:text-[#c8b696]">
                        {cls.documentCount} PDF
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(`/classes/${cls.code}`);
                        }}
                        className="inline-flex min-h-[34px] items-center gap-1 px-1.5 font-semibold text-[#a8532c] hover:underline cursor-pointer dark:text-[#e88c5d] sm:min-h-0 sm:px-0"
                      >
                        {t('Ouvrir', 'دخول')}
                        <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>
                  </div>
                </GlowCard>
              );
            })}
          </div>

          {/* Interactive Selected Class Inspector Panel */}
          <div className="mt-5 sm:mt-6 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-4 sm:p-6 shadow-sm dark:border-[#5a4634] dark:bg-[#1c1916]">
              <div className="flex flex-col justify-between gap-4 border-b border-[#c98f4f]/35 pb-4 dark:border-[#423428] sm:pb-5 lg:flex-row lg:items-center">
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                    {inspectedDefinition.levelLabel} · {inspectedDefinition.shortTrack}
                  </p>
                  <h3 className="mt-1 font-display text-xl sm:text-2xl font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                    {inspectedDefinition.code} — {inspectedDefinition.filiere}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
                    {inspectedDefinition.description} ·{' '}
                    <span className="font-mono font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                      {inspectedSummary?.documentCount ?? 0} PDF
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectPartner(partner.target)}
                    className="btn-sand inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer sm:min-h-0"
                  >
                    <Compass className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                    {t(partner.label, partner.labelAr)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/classes/${inspectedDefinition.code}`)}
                    className="btn-rust inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer sm:min-h-0"
                  >
                    {t(`Ouvrir l’espace ${inspectedDefinition.code}`, `فتح فضاء ${inspectedDefinition.code}`)}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Direct Tab Quick Launch */}
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                  {t('Accès direct :', 'وصول مباشر:')}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  {[
                    { tab: 'colloscope', label: t('Colloscope', 'الكولوسكوب'), icon: Table2 },
                    { tab: 'emploi-du-temps', label: t('Emploi du temps', 'جدول الحصص'), icon: Calendar },
                    { tab: 'annonces', label: t('Annonces', 'الإعلانات'), icon: Megaphone },
                    { tab: 'chat', label: t('Chat', 'الدردشة'), icon: MessageSquare },
                  ].map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.tab}
                        type="button"
                        onClick={() => onNavigate(`/classes/${inspectedDefinition.code}?tab=${action.tab}`)}
                        className="btn-sand inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer sm:min-h-0 sm:py-1.5"
                      >
                        <Icon className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d] shrink-0" />
                        <span className="truncate">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clickable Subjects jumping to Ressources PDF filtered by class and subject */}
              <div className="mt-5">
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                  {t(
                    `Matières de ${inspectedDefinition.code} (${inspectedDefinition.subjects.length}) — touchez pour filtrer`,
                    `مواد ${inspectedDefinition.code} (${inspectedDefinition.subjects.length}) — انقر للتصفية`
                  )}
                </p>
                <div className="mt-2.5 grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-5">
                  {inspectedDefinition.subjects.map((sub) => (
                    <button
                      key={sub.slug}
                      type="button"
                      onClick={() =>
                        onNavigate(`/ressources?class=${inspectedDefinition.code}&subject=${sub.slug}`)
                      }
                      className="min-h-[52px] rounded-lg border border-[#c98f4f]/40 bg-[#f7ead0] p-2.5 sm:p-3 text-start transition-colors hover:border-[#a8532c] hover:bg-[#e6c58c]/55 cursor-pointer dark:border-[#423428] dark:bg-[#26211c] dark:hover:border-[#e88c5d] dark:hover:bg-[#332b23]"
                    >
                      <p className="text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d] line-clamp-1">{sub.name}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#4a2e1a]/80 dark:text-[#c8b696]">{sub.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
        </section>

        {/* Row 3 (.row .img-right): La CPGE Bab Sahra */}
        <section className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 py-8 sm:py-12 border-b-2 border-[#e6c58c] dark:border-[#332920]">
          <div className="flex-1 w-full">
            <h2 className="dune-heading font-display text-xl sm:text-2xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
              {t('La CPGE Bab Sahra · Guelmim', 'الأقسام التحضيرية باب الصحراء · كلميم')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4a2e1a]/90 dark:text-[#e3d4b7]">
              {t(
                'Située à Guelmim dans la région de Guelmim-Oued Noun, la CPGE Bab Sahra accompagne ses étudiants avec des colloscopes hebdomadaires par trinôme, des emplois du temps complets (Cours, TD, TP, RCL, DS) et une bibliothèque partagée accessible sans connexion.',
                'تقع ثانوية باب الصحراء في كلميم بجهة كلميم-واد نون، وترافق طلبتها بفضل جداول الكولوسكوب الأسبوعية وجداول الحصص الرسمية والمكتبة الرقمية المتاحة للجميع.'
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate(`/classes/${inspectedDefinition.code}?tab=colloscope`)}
                className="btn-rust inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5" />
                {t(
                  `Colloscope & Emploi (${inspectedDefinition.code})`,
                  `الكولوسكوب وجدول الحصص (${inspectedDefinition.code})`
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setLightboxImage({
                src: '/images/image3.png',
                title: 'CPGE Bab Sahra · Guelmim',
                caption: t(
                  'Colloscopes, emplois du temps et salles de khôlles à Guelmim',
                  'جداول الكولوسكوب وجداول الحصص الرسمية بكلميم'
                ),
              })
            }
            className="group relative w-full md:w-[46%] overflow-hidden rounded-xl border border-[#c98f4f]/50 shadow-sm cursor-zoom-in dark:border-[#5a4634]"
          >
            <img
              src="/images/image3.png"
              alt="La CPGE Bab Sahra Guelmim"
              className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md bg-[#2a190d]/75 px-2.5 py-1 text-[11px] font-medium text-[#f7ead0] opacity-90 sm:opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
              <ZoomIn className="h-3 w-3" />
              {t('Agrandir', 'تكبير')}
            </span>
          </button>
        </section>

        {/* Row 4 (.row .img-left): Internat, BDE & Page Instagram */}
        <section className="flex flex-col md:flex-row-reverse items-center gap-6 sm:gap-8 py-8 sm:py-12 border-b-2 border-[#e6c58c] dark:border-[#332920]">
          <div className="flex-1 w-full">
            <h2 className="dune-heading font-display text-xl sm:text-2xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
              {t('Internat, BDE & Page Instagram du Campus', 'الداخلية، مكتب الطلبة وصفحة إنستغرام')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4a2e1a]/90 dark:text-[#e3d4b7]">
              {t(
                'Consultez les horaires officiels de l’internat et les avis des maîtres d’internat. Suivez les initiatives du BDE (président des étudiants) ainsi que les publications du Groupe Média qui gère la page Instagram officielle du campus.',
                'اطّلع على مواقيت الداخلية وإعلانات الحراس، وتابع مبادرات مكتب الطلبة (BDE) ومنشورات فريق الإعلام المسؤول عن صفحة إنستغرام الرسمية.'
              )}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/internat')}
                className="btn-rust inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('Portail Internat', 'بوابة الداخلية')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/vie-campus')}
                className="btn-sand inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium cursor-pointer"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                {t('Vie Campus & BDE', 'الحياة الطلابية و BDE')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/administration')}
                className="btn-sand min-[380px]:col-span-2 sm:col-span-1 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium cursor-pointer"
              >
                <Building2 className="h-3.5 w-3.5" />
                {t('Annonces Administration', 'إعلانات الإدارة')}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setLightboxImage({
                src: '/images/image4.png',
                title: t('Internat & Vie étudiante Bab Sahra', 'الداخلية والحياة الطلابية'),
                caption: t(
                  'Vie résidentielle, BDE et équipe Média du campus',
                  'الحياة الداخلية ومكتب الطلبة وفريق الإعلام'
                ),
              })
            }
            className="group relative w-full md:w-[46%] overflow-hidden rounded-xl border border-[#c98f4f]/50 shadow-sm cursor-zoom-in dark:border-[#5a4634]"
          >
            <img
              src="/images/image4.png"
              alt="Internat et vie étudiante CPGE Bab Sahra"
              className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md bg-[#2a190d]/75 px-2.5 py-1 text-[11px] font-medium text-[#f7ead0] opacity-90 sm:opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
              <ZoomIn className="h-3 w-3" />
              {t('Agrandir', 'تكبير')}
            </span>
          </button>
        </section>

        {/* Official Campus Guides */}
        <section className="py-8 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="dune-heading font-display text-xl sm:text-2xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                {t('Guides de rentrée & méthodologie', 'أدلة الدخول والمنهجية')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/ressources')}
              className="inline-flex min-h-[38px] items-center text-xs font-semibold text-[#a8532c] hover:underline whitespace-nowrap cursor-pointer dark:text-[#e88c5d] sm:min-h-0"
            >
              {t('Tous les supports PDF →', 'كل وثائق PDF ←')}
            </button>
          </div>

          <div className="mt-5 sm:mt-6 grid grid-cols-1 gap-3.5 sm:gap-4 md:grid-cols-3">
            {guides.map((doc) => (
              <GlowCard key={doc.id} className="p-4 sm:p-5">
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-[#a8532c] dark:text-[#e88c5d]">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{doc.chapter || 'Guide Campus'}</span>
                    </div>
                    <h3 className="mt-2 font-display text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                      {doc.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                      {doc.description}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-[#c98f4f]/35 pt-3 dark:border-[#423428]">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="btn-sand min-h-[40px] flex-1 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer sm:min-h-0"
                    >
                      {t('Consulter', 'معاينة')}
                    </button>
                    <a
                      href={doc.file_path}
                      download
                      className="btn-rust inline-flex min-h-[40px] items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-semibold sm:min-h-0"
                    >
                      PDF
                    </a>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        </section>
      </div>

      <PdfPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <ImageLightboxModal image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
