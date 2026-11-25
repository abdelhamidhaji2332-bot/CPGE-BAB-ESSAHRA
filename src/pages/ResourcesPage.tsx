import { AnimatePresence, motion } from 'framer-motion';
import { Download, Eye, FileText, Search, Trash2, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { PdfPreviewModal, type PreviewDoc } from '../components/PdfPreviewModal';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import {
  CAMPUS_CLASSES,
  RESOURCE_CATEGORIES,
  RESOURCE_CATEGORY_LABELS,
  type ClassCode,
  type ResourceCategory,
} from '../shared/curriculum';

interface ResourceRow {
  id: number;
  class_code: string | null;
  subject_slug: string | null;
  category: ResourceCategory;
  title: string;
  chapter: string;
  description: string;
  file_path: string;
  file_size: number;
  progress_status?: 'a_faire' | 'en_cours' | 'maitrise' | null;
}

const PROGRESS_LABELS: Record<'a_faire' | 'en_cours' | 'maitrise', string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  maitrise: 'Maîtrisé',
};

export function ResourcesPage({
  initialClass,
  initialSubject,
}: {
  initialClass?: string;
  initialSubject?: string;
}) {
  const { user, apiFetch } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const [docs, setDocs] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>(initialClass || 'ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (initialClass) setSelectedClass(initialClass);
    if (initialSubject) setSelectedSubject(initialSubject);
  }, [initialClass, initialSubject]);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);

  // Upload state exclusively for professors & admins
  const [showUpload, setShowUpload] = useState(false);
  const [uploadClass, setUploadClass] = useState<ClassCode>('MPSI');
  const [uploadCategory, setUploadCategory] = useState<ResourceCategory>('td');
  const [uploadSubject, setUploadSubject] = useState('mathematiques');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadChapter, setUploadChapter] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canUpload = user && (user.role === 'admin' || user.role === 'professeur');

  const fetchDocs = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('scope', 'ressources');
        if (selectedClass !== 'ALL') params.set('classCode', selectedClass);
        if (query.trim()) params.set('q', query.trim());
        const res = await apiFetch(`/api/documents?${params.toString()}`, { signal });
        if (!res.ok) {
          if (!signal?.aborted) {
            toast.error(t('Échec du chargement des ressources PDF.', 'تعذر تحميل الموارد الرقمية.'));
          }
          return;
        }
        const data = await res.json();
        if (signal?.aborted) return;
        const allowed = new Set<string>(RESOURCE_CATEGORIES);
        setDocs(((data.documents || []) as ResourceRow[]).filter((d) => allowed.has(d.category)));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!signal?.aborted) {
          toast.error(t('Erreur réseau lors du chargement des ressources.', 'خطأ في الشبكة أثناء تحميل الموارد.'));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [apiFetch, selectedClass, query, t, toast]
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchDocs(controller.signal);
    return () => controller.abort();
  }, [fetchDocs]);

  // Available subjects synchronized with selectedClass
  const availableSubjects = useMemo(() => {
    if (selectedClass !== 'ALL' && selectedClass !== 'CAMPUS') {
      return CAMPUS_CLASSES.find((c) => c.code === selectedClass)?.subjects || [];
    }
    const map = new Map<string, string>();
    for (const cls of CAMPUS_CLASSES) {
      for (const s of cls.subjects) {
        if (!map.has(s.slug)) map.set(s.slug, s.name);
      }
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [selectedClass]);

  useEffect(() => {
    if (
      selectedSubject !== 'ALL' &&
      !availableSubjects.some((s) => s.slug === selectedSubject)
    ) {
      setSelectedSubject('ALL');
    }
  }, [availableSubjects, selectedSubject]);

  const docsBySubject = useMemo(() => {
    if (selectedSubject === 'ALL') return docs;
    return docs.filter((d) => d.subject_slug === selectedSubject);
  }, [docs, selectedSubject]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: docsBySubject.length };
    for (const d of docsBySubject) {
      counts[d.category] = (counts[d.category] || 0) + 1;
    }
    return counts;
  }, [docsBySubject]);

  const visibleDocs = useMemo(() => {
    if (selectedCategory === 'ALL') return docsBySubject;
    return docsBySubject.filter((d) => d.category === selectedCategory);
  }, [docsBySubject, selectedCategory]);

  const handleProgress = async (docId: number, status: 'a_faire' | 'en_cours' | 'maitrise') => {
    try {
      const res = await apiFetch(`/api/documents/${docId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('Impossible de mettre à jour le suivi.', 'تعذر تحديث التقدم.'));
        return;
      }
      setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, progress_status: status } : d)));
      toast.success(t(`Suivi mis à jour : ${PROGRESS_LABELS[status]}.`, 'تم تحديث التقدم بنجاح.'));
    } catch {
      toast.error(t('Erreur réseau lors de la mise à jour.', 'خطأ في الشبكة أثناء التحديث.'));
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    try {
      const res = await apiFetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('Suppression impossible.', 'تعذر حذف الوثيقة.'));
        return;
      }
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success(t('Document PDF supprimé.', 'تم حذف الوثيقة بنجاح.'));
    } catch {
      toast.error(t('Erreur réseau lors de la suppression.', 'خطأ في الشبكة أثناء الحذف.'));
    }
  };

  const selectedClassObj = useMemo(
    () => CAMPUS_CLASSES.find((c) => c.code === uploadClass) || CAMPUS_CLASSES[0],
    [uploadClass]
  );

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) {
      const msg = t('Veuillez sélectionner un fichier PDF et saisir un titre.', 'يرجى اختيار ملف PDF وإدخال عنوان.');
      setUploadMsg(msg);
      toast.warning(msg);
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('classCode', uploadClass);
      formData.append('category', uploadCategory);
      formData.append('subjectSlug', uploadSubject);
      formData.append('title', uploadTitle.trim());
      formData.append('chapter', uploadChapter.trim());
      formData.append('description', uploadDesc.trim());

      const res = await apiFetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || t('Échec du dépôt PDF.', 'فشل رفع ملف PDF.');
        setUploadMsg(msg);
        toast.error(msg);
        return;
      }
      setUploadTitle('');
      setUploadChapter('');
      setUploadDesc('');
      setUploadFile(null);
      setShowUpload(false);
      toast.success(t('Support PDF publié avec succès.', 'تم نشر ملف PDF بنجاح.'));
      await fetchDocs();
    } catch {
      const msg = t('Erreur réseau lors de l’envoi du PDF.', 'خطأ في الشبكة أثناء رفع الملف.');
      setUploadMsg(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-[#f7ead0] py-6 text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6] sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-5 dark:border-[#332920] sm:flex-row sm:items-end sm:gap-6 sm:pb-8">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              Bibliothèque Pédagogique · Archives PDF
            </p>
            <h1 className="dune-heading mt-1.5 sm:mt-2 font-display text-2xl font-semibold tracking-tight text-[#a8532c] dark:text-[#e88c5d] sm:text-4xl">
              Ressources académiques du campus
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
              TD, DS, Résumés, annales CNC (Spé) et CF (Spé) classés par filière et matière officielle.
            </p>
          </div>

          {canUpload ? (
            <button
              type="button"
              onClick={() => setShowUpload((prev) => !prev)}
              className="btn-rust inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer sm:min-h-0"
            >
              <Upload className="h-4 w-4" />
              {showUpload ? 'Fermer le formulaire' : 'Publier un PDF'}
            </button>
          ) : null}
        </div>

        <AnimatePresence>
          {showUpload && canUpload ? (
            <motion.form
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              onSubmit={handleUploadSubmit}
              className="mt-6 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-4 dark:border-[#5a4634] dark:bg-[#1c1916] sm:p-6"
            >
              <h2 className="font-display text-base font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                Publier un support pédagogique (PDF)
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Classe</label>
                  <select
                    value={uploadClass}
                    onChange={(e) => {
                      const next = e.target.value as ClassCode;
                      setUploadClass(next);
                      const found = CAMPUS_CLASSES.find((c) => c.code === next);
                      if (found?.subjects[0]) setUploadSubject(found.subjects[0].slug);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  >
                    {CAMPUS_CLASSES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.levelLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Catégorie</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as ResourceCategory)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  >
                    {RESOURCE_CATEGORIES.map((k) => (
                      <option key={k} value={k}>
                        {RESOURCE_CATEGORY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Matière</label>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  >
                    {selectedClassObj.subjects.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Titre du document</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Ex: Chapitre 4 — Espaces préhilbertiens réels"
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Chapitre / Période</label>
                  <input
                    type="text"
                    value={uploadChapter}
                    onChange={(e) => setUploadChapter(e.target.value)}
                    placeholder="Ex: Semestre 1 · Algèbre"
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Description succincte</label>
                  <input
                    type="text"
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    placeholder="Notions abordées ou consignes de préparation"
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Fichier PDF (12 Mo max.)</label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-1.5 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  />
                </div>
              </div>

              {uploadMsg ? <p className="mt-3 text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d]">{uploadMsg}</p> : null}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="btn-sand rounded-lg px-4 py-2 text-xs font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-rust rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'Publication...' : 'Enregistrer le PDF'}
                </button>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>

        {/* Filters */}
        <div className="mt-5 sm:mt-6 space-y-3">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                aria-label="Filtrer par classe"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-3 py-2 text-xs font-medium text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] sm:min-h-0 sm:w-auto"
              >
                <option value="ALL">Toutes les classes</option>
                {CAMPUS_CLASSES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.level})
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrer par matière"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-3 py-2 text-xs font-medium text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] sm:min-h-0 sm:w-auto"
              >
                <option value="ALL">Toutes les matières ({availableSubjects.length})</option>
                {availableSubjects.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4a2e1a]/60 dark:text-[#c8b696]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un chapitre, mot-clé..."
                className="min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] py-2 pl-9 pr-3 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
              />
            </div>
          </div>

          <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:w-fit sm:flex-wrap">
            {(['ALL', ...RESOURCE_CATEGORIES] as const).map(
              (cat) => {
                const active = selectedCategory === cat;
                const label = cat === 'ALL' ? 'Tous' : RESOURCE_CATEGORY_LABELS[cat];
                const count = categoryCounts[cat] || 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[36px] shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer sm:min-h-0 ${
                      active
                        ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                        : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#e3d4b7] dark:hover:bg-[#332b23]'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Documents Grid */}
        {loading ? (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4] dark:border-[#423428] dark:bg-[#1c1916]" />
            ))}
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[#c98f4f]/55 bg-[#fcf4e4] p-10 text-center dark:border-[#5a4634] dark:bg-[#1c1916]">
            <FileText className="mx-auto h-8 w-8 text-[#a8532c] dark:text-[#e88c5d]" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              Coming soon · {t('À venir', 'قريباً')}
            </p>
            <p className="mt-1.5 font-display text-xl font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
              {t(
                'Coming soon — TD, DS, Résumés, CNC & CF',
                'قريباً — التمارين، الفروض، الملخصات و CNC / CF'
              )}
            </p>
            <p className="mx-auto mt-1.5 max-w-lg text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
              {t(
                'Les supports pédagogiques (TD, DS, résumés, CNC et CF) seront déposés directement ici par les professeurs du campus.',
                'سيتم نشر التمارين والفروض والملخصات ومواضيع CNC و CF هنا مباشرة من طرف أساتذة الأقسام التحضيرية.'
              )}
            </p>
            {canUpload ? (
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="btn-rust mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                {t('Publier un support PDF', 'نشر وثيقة PDF')}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 sm:mt-8 grid grid-cols-1 gap-3.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleDocs.map((doc) => (
                <GlowCard key={doc.id} className="p-4 sm:p-5">
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">
                        <span className="font-medium text-[#a8532c] dark:text-[#e88c5d]">
                          {doc.class_code || 'Campus'} · {RESOURCE_CATEGORY_LABELS[doc.category]}
                        </span>
                        <span className="font-mono tabular-nums">
                          {Math.max(1, Math.round(doc.file_size / 1024))} Ko
                        </span>
                      </div>
                      <h3 className="mt-2.5 font-display text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                        {doc.title}
                      </h3>
                      {doc.chapter ? (
                        <p className="mt-1 text-xs font-medium text-[#a8532c] dark:text-[#e88c5d]">{doc.chapter}</p>
                      ) : null}
                      <p className="mt-2 text-xs leading-relaxed text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                        {doc.description || 'Support PDF officiel prêt à consulter.'}
                      </p>
                    </div>

                    <div className="mt-5 space-y-3 border-t border-[#c98f4f]/30 pt-3.5 dark:border-[#423428]">
                      {user ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[#4a2e1a]/75 dark:text-[#c8b696]">Suivi :</span>
                          <div className="flex flex-wrap items-center gap-1">
                            {(['a_faire', 'en_cours', 'maitrise'] as const).map((st) => {
                              const active = (doc.progress_status || 'a_faire') === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleProgress(doc.id, st)}
                                  className={`min-h-[32px] rounded px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer sm:min-h-0 sm:px-2 sm:py-0.5 ${
                                    active
                                      ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                                      : 'text-[#4a2e1a]/75 hover:bg-[#e6c58c]/60 hover:text-[#4a2e1a] dark:text-[#c8b696] dark:hover:bg-[#332b23] dark:hover:text-[#f5ebd6]'
                                  }`}
                                >
                                  {PROGRESS_LABELS[st]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="btn-sand inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer sm:min-h-0"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Consulter
                        </button>
                        <a
                          href={doc.file_path}
                          download
                          className="btn-rust inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold sm:min-h-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {(doc.file_path.split('.').pop()?.split('?')[0] || 'PDF').toUpperCase()}
                        </a>
                        {canUpload ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc.id)}
                            aria-label="Supprimer le document"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#c98f4f] text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] transition-colors cursor-pointer dark:border-[#5a4634] dark:text-[#e88c5d] dark:hover:bg-[#c25e32] dark:hover:text-[#fdf6e9] sm:h-auto sm:w-auto sm:p-2"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </GlowCard>
              ))}
          </div>
        )}
      </div>

      <PdfPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
