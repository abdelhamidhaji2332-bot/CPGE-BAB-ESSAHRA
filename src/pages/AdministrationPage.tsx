import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import { CAMPUS_CLASSES } from '../shared/curriculum';

type AdminCategory =
  | 'Note officielle'
  | 'Concours & Examens'
  | 'Scolarité'
  | 'Bourses & Internat'
  | 'Urgent';

interface AdminAnnouncement {
  id: number;
  category: AdminCategory;
  target_audience: string;
  title: string;
  content: string;
  is_pinned: number;
  author_name: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES: AdminCategory[] = [
  'Note officielle',
  'Concours & Examens',
  'Scolarité',
  'Bourses & Internat',
  'Urgent',
];

const AUDIENCE_OPTIONS = [
  'Toutes les classes',
  '1ère année · Sup',
  '2ème année · Spé',
  ...CAMPUS_CLASSES.map((c) => c.code),
  'Internes',
];

export function AdministrationPage() {
  const { user, apiFetch } = useAuth();
  const { t } = useLang();
  const toast = useToast();

  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<'ALL' | AdminCategory>('ALL');
  const [filterAudience, setFilterAudience] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer / Edit state (Administration only)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [category, setCategory] = useState<AdminCategory>('Note officielle');
  const [targetAudience, setTargetAudience] = useState<string>('Toutes les classes');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'admin';

  const fetchAnnouncements = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await fetch('/api/administration/announcements', { signal });
        if (!res.ok) {
          if (!signal?.aborted) {
            toast.error(
              t(
                'Impossible de charger les annonces de l’administration.',
                'تعذر تحميل إعلانات الإدارة.'
              )
            );
          }
          return;
        }
        const data = await res.json();
        if (signal?.aborted) return;
        setAnnouncements(data.announcements || []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!signal?.aborted) {
          toast.error(
            t(
              'Erreur réseau lors du chargement des annonces officielles.',
              'خطأ في الشبكة أثناء تحميل الإعلانات الرسمية.'
            )
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [t, toast]
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchAnnouncements(controller.signal);
    return () => controller.abort();
  }, [fetchAnnouncements]);

  const resetForm = () => {
    setEditingId(null);
    setCategory('Note officielle');
    setTargetAudience('Toutes les classes');
    setTitle('');
    setContent('');
    setIsPinned(true);
    setError(null);
  };

  const openCreateForm = () => {
    if (showForm && editingId === null) {
      setShowForm(false);
      return;
    }
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (ann: AdminAnnouncement) => {
    setEditingId(ann.id);
    setCategory(ann.category);
    setTargetAudience(ann.target_audience);
    setTitle(ann.title);
    setContent(ann.content);
    setIsPinned(ann.is_pinned === 1);
    setError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const isEdit = editingId !== null;
      const endpoint = isEdit
        ? `/api/administration/announcements/${editingId}`
        : '/api/administration/announcements';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          targetAudience,
          title,
          content,
          isPinned,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || t('Enregistrement impossible.', 'تعذر الحفظ.');
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        isEdit
          ? t('Annonce officielle mise à jour.', 'تم تحديث الإعلان الرسمي بنجاح.')
          : t('Annonce officielle publiée.', 'تم نشر الإعلان الرسمي بنجاح.')
      );
      resetForm();
      setShowForm(false);
      await fetchAnnouncements();
    } catch {
      const msg = t('Erreur réseau lors de l’enregistrement.', 'خطأ في الشبكة أثناء الحفظ.');
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePin = async (ann: AdminAnnouncement) => {
    try {
      const res = await apiFetch(`/api/administration/announcements/${ann.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: ann.is_pinned !== 1 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('Modification impossible.', 'تعذر التعديل.'));
        return;
      }
      toast.success(
        ann.is_pinned === 1
          ? t('Annonce désépinglée.', 'تم إلغاء تثبيت الإعلان.')
          : t('Annonce épinglée en priorité.', 'تم تثبيت الإعلان في الأعلى.')
      );
      await fetchAnnouncements();
    } catch {
      toast.error(t('Erreur réseau lors de la mise à jour.', 'خطأ في الشبكة أثناء التحديث.'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/api/administration/announcements/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('Suppression impossible.', 'تعذر الحذف.'));
        return;
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      if (editingId === id) {
        resetForm();
        setShowForm(false);
      }
      toast.success(t('Annonce officielle supprimée.', 'تم حذف الإعلان الرسمي.'));
    } catch {
      toast.error(t('Erreur réseau lors de la suppression.', 'خطأ في الشبكة أثناء الحذف.'));
    }
  };

  const filteredAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return announcements.filter((a) => {
      if (filterCategory !== 'ALL' && a.category !== filterCategory) return false;
      if (filterAudience !== 'ALL' && a.target_audience !== filterAudience) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.target_audience.toLowerCase().includes(q) ||
        a.author_name.toLowerCase().includes(q)
      );
    });
  }, [announcements, filterCategory, filterAudience, searchQuery]);

  const pinnedAnnouncements = useMemo(
    () => filteredAnnouncements.filter((a) => a.is_pinned === 1),
    [filteredAnnouncements]
  );

  const regularAnnouncements = useMemo(
    () => filteredAnnouncements.filter((a) => a.is_pinned !== 1),
    [filteredAnnouncements]
  );

  const renderCard = (ann: AdminAnnouncement) => {
    const isUrgent = ann.category === 'Urgent';
    return (
      <GlowCard key={ann.id} className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">
              {ann.is_pinned === 1 ? (
                <>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                    <Pin className="h-3 w-3" />
                    {t('Épinglé', 'مثبّت')}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  isUrgent ? 'text-[#9b2c1a] dark:text-rose-400' : 'text-[#a8532c] dark:text-[#e88c5d]'
                }`}
              >
                {isUrgent ? <AlertTriangle className="h-3 w-3" /> : null}
                {ann.category}
              </span>
              <span aria-hidden="true">·</span>
              <span>{ann.target_audience}</span>
              <span aria-hidden="true">·</span>
              <span>{ann.author_name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{ann.created_at.slice(0, 10)}</span>
            </div>

            <h2 className="mt-2 font-display text-lg font-semibold text-[#4a2e1a] dark:text-[#f5ebd6] sm:text-xl">
              {ann.title}
            </h2>
            <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
              {ann.content}
            </p>
          </div>

          {canManage ? (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleTogglePin(ann)}
                aria-label={ann.is_pinned === 1 ? 'Désépingler' : 'Épingler'}
                title={ann.is_pinned === 1 ? 'Désépingler' : 'Épingler'}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors cursor-pointer sm:h-9 sm:w-9 ${
                  ann.is_pinned === 1
                    ? 'border-[#a8532c] bg-[#a8532c] text-[#f7ead0] dark:border-[#c25e32] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                    : 'border-[#c98f4f] text-[#4a2e1a] hover:bg-[#e6c58c] dark:border-[#5a4634] dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
                }`}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openEditForm(ann)}
                aria-label={t('Modifier l’annonce', 'تعديل الإعلان')}
                title={t('Modifier', 'تعديل')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#c98f4f] text-[#4a2e1a] hover:bg-[#e6c58c] transition-colors cursor-pointer dark:border-[#5a4634] dark:text-[#f5ebd6] dark:hover:bg-[#332b23] sm:h-9 sm:w-9"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(ann.id)}
                aria-label={t('Supprimer l’annonce', 'حذف الإعلان')}
                title={t('Supprimer', 'حذف')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#c98f4f] text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] transition-colors cursor-pointer dark:border-[#5a4634] dark:text-[#e88c5d] dark:hover:bg-[#c25e32] dark:hover:text-[#fdf6e9] sm:h-9 sm:w-9"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      </GlowCard>
    );
  };

  return (
    <div className="bg-[#f7ead0] py-6 text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6] sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Institutional Header */}
        <div className="flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-5 dark:border-[#332920] sm:flex-row sm:items-end sm:gap-6 sm:pb-8">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              {t('Direction & Scolarité · CPGE Bab Sahra', 'الإدارة والشؤون التربوية · باب الصحراء')}
            </p>
            <h1 className="dune-heading mt-1.5 sm:mt-2 font-display text-2xl font-semibold tracking-tight text-[#a8532c] dark:text-[#e88c5d] sm:text-4xl">
              {t('Annonces de l’Administration', 'إعلانات وبلاغات الإدارة')}
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
              {t(
                'Communiqués officiels, calendriers des concours (CNC / CNAEM), avis de scolarité et notes administratives publiées par la direction du centre.',
                'البلاغات الرسمية، مواعيد المباريات الوطنية، إعلانات التمدرس والمذكرات الإدارية الصادرة عن إدارة المركز.'
              )}
            </p>
          </div>

          {canManage ? (
            <button
              type="button"
              onClick={openCreateForm}
              className="btn-rust inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer sm:w-auto sm:min-h-0"
            >
              <Plus className="h-4 w-4" />
              {showForm && editingId === null
                ? t('Fermer le formulaire', 'إغلاق النموذج')
                : t('Publier une annonce', 'نشر إعلان رسمي')}
            </button>
          ) : null}
        </div>

        {/* Administration Composer / Editor */}
        <AnimatePresence>
          {showForm && canManage ? (
            <motion.form
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              onSubmit={handleSubmit}
              className="mt-6 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-4 dark:border-[#5a4634] dark:bg-[#1c1916] sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                  {editingId !== null
                    ? t('Modifier l’annonce officielle', 'تعديل الإعلان الرسمي')
                    : t('Nouvelle annonce de l’Administration', 'إعلان إداري جديد')}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="text-xs font-semibold text-[#4a2e1a]/75 hover:text-[#a8532c] cursor-pointer dark:text-[#c8b696] dark:hover:text-[#e88c5d]"
                >
                  {t('Annuler', 'إلغاء')}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">
                    {t('Catégorie', 'الفئة')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AdminCategory)}
                    className="mt-1.5 min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] sm:min-h-0"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">
                    {t('Public concerné', 'الفئة المستهدفة')}
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="mt-1.5 min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] sm:min-h-0"
                  >
                    {AUDIENCE_OPTIONS.map((aud) => (
                      <option key={aud} value={aud}>
                        {aud}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">
                  {t('Objet / Titre de l’annonce', 'عنوان الإعلان')}
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t(
                    'Ex : Calendrier des Concours Blancs du 2e semestre',
                    'مثال: جدولة الفروض المحروسة أو المباريات الوطنية'
                  )}
                  className="mt-1.5 min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
                />
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">
                  {t('Contenu détaillé', 'نص الإعلان')}
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={3}
                  maxLength={4000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t(
                    'Précisez les dates, pièces à fournir, lieux ou consignes officielles...',
                    'أدخل التفاصيل والمواعيد والوثائق المطلوبة...'
                  )}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                />
              </div>

              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-[#4a2e1a] dark:text-[#e3d4b7]">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-[#c98f4f] dark:border-[#5a4634]"
                />
                {t('Épingler en priorité en haut de la page', 'تثبيت الإعلان في أعلى الصفحة')}
              </label>

              {error ? <p className="mt-2 text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d]">{error}</p> : null}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="btn-sand min-h-[42px] rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer sm:min-h-0"
                >
                  {t('Annuler', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-rust min-h-[42px] rounded-lg px-5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-60 sm:min-h-0"
                >
                  {submitting
                    ? t('Enregistrement...', 'جاري الحفظ...')
                    : editingId !== null
                      ? t('Enregistrer les modifications', 'حفظ التعديلات')
                      : t('Publier l’annonce', 'نشر الإعلان')}
                </button>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>

        {/* Filter Bar & Search */}
        <div className="mt-5 sm:mt-6 flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
          <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c] lg:w-fit">
            <button
              type="button"
              onClick={() => setFilterCategory('ALL')}
              className={`min-h-[36px] shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer sm:min-h-0 ${
                filterCategory === 'ALL'
                  ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                  : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#e3d4b7] dark:hover:bg-[#332b23]'
              }`}
            >
              {t('Toutes', 'الكل')} ({announcements.length})
            </button>
            {CATEGORIES.map((cat) => {
              const active = filterCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`min-h-[36px] shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer sm:min-h-0 ${
                    active
                      ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                      : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#e3d4b7] dark:hover:bg-[#332b23]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 sm:flex sm:items-center">
            <select
              aria-label={t('Filtrer par public', 'تصفية حسب الفئة المستهدفة')}
              value={filterAudience}
              onChange={(e) => setFilterAudience(e.target.value)}
              className="min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-3 py-2 text-xs font-medium text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] sm:min-h-0 sm:w-44"
            >
              <option value="ALL">{t('Tous les publics', 'جميع الأقسام')}</option>
              {AUDIENCE_OPTIONS.map((aud) => (
                <option key={aud} value={aud}>
                  {aud}
                </option>
              ))}
            </select>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4a2e1a]/60 dark:text-[#c8b696]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Rechercher une note...', 'البحث في الإعلانات...')}
                className="min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] py-2 pl-9 pr-3 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
              />
            </div>
          </div>
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="mt-6 space-y-4">
            <div className="h-36 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4] dark:border-[#423428] dark:bg-[#1c1916]" />
            <div className="h-36 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4] dark:border-[#423428] dark:bg-[#1c1916]" />
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="mt-6 rounded-xl border border-[#c98f4f]/45 bg-[#fcf4e4] p-8 text-center dark:border-[#5a4634] dark:bg-[#1c1916]">
            <Building2 className="mx-auto h-7 w-7 text-[#a8532c] dark:text-[#e88c5d]" />
            <h2 className="mt-2 font-display text-lg font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
              {t('Aucune annonce administrative', 'لا توجد إعلانات إدارية')}
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-xs sm:text-sm text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
              {t(
                'Aucun communiqué ne correspond aux critères sélectionnés pour le moment.',
                'لا يوجد أي بلاغ مطابق للبحث أو التصفية حالياً.'
              )}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {pinnedAnnouncements.length > 0 ? (
              <section>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                  {t('Communiqués prioritaires', 'بلاغات هامة ومثبتة')} ({pinnedAnnouncements.length})
                </h2>
                <div className="mt-3 space-y-4">
                  {pinnedAnnouncements.map(renderCard)}
                </div>
              </section>
            ) : null}

            {regularAnnouncements.length > 0 ? (
              <section>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                  {t('Notes & Avis récents', 'المذكرات والإعلانات الأخيرة')} ({regularAnnouncements.length})
                </h2>
                <div className="mt-3 space-y-4">
                  {regularAnnouncements.map(renderCard)}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
