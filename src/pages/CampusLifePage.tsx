import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';

interface CampusEvent {
  id: number;
  organizer_group: 'BDE' | 'Groupe Média' | 'Administration';
  event_type: 'Événement' | 'Article' | 'Conférence' | 'Tournoi';
  title: string;
  summary: string;
  content: string;
  event_date: string;
  location: string;
  capacity: number;
  instagram_url?: string;
  registered_count: number;
  is_registered: number;
}

export function CampusLifePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, apiFetch } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [filterGroup, setFilterGroup] = useState<'ALL' | CampusEvent['organizer_group']>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [organizerGroup, setOrganizerGroup] = useState<CampusEvent['organizer_group']>(
    user?.role === 'groupe_media' ? 'Groupe Média' : 'BDE'
  );
  const [eventType, setEventType] = useState<CampusEvent['event_type']>('Événement');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState(120);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const canPublish =
    user && (user.role === 'bde' || user.role === 'groupe_media' || user.role === 'admin');

  const fetchEvents = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/events', { signal });
        if (!res.ok) {
          if (!signal?.aborted) {
            toast.error(t('Échec du chargement des événements.', 'تعذر تحميل الأنشطة.'));
          }
          return;
        }
        const data = await res.json();
        if (signal?.aborted) return;
        setEvents(data.events || []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!signal?.aborted) {
          toast.error(t('Erreur réseau lors du chargement des événements.', 'خطأ في الشبكة أثناء تحميل الأنشطة.'));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [apiFetch, t, toast]
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchEvents(controller.signal);
    return () => controller.abort();
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((e) => {
      if (filterGroup !== 'ALL' && e.organizer_group !== filterGroup) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q)
      );
    });
  }, [events, filterGroup, searchQuery]);

  const handleToggleRsvp = async (eventId: number) => {
    if (!user) {
      toast.info(t('Connectez-vous pour réserver une place.', 'سجّل الدخول لحجز مقعدك.'));
      onNavigate('/portail');
      return;
    }
    try {
      const res = await apiFetch(`/api/events/${eventId}/register`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.event) {
        setEvents((prev) => prev.map((e) => (e.id === eventId ? data.event : e)));
        toast.success(
          data.event.is_registered
            ? t('Place réservée avec succès.', 'تم حجز مقعدك بنجاح.')
            : t('Inscription annulée.', 'تم إلغاء التسجيل.')
        );
      } else {
        const msg = data.error || t('Action impossible.', 'تعذر تنفيذ الطلب.');
        setFeedback(msg);
        toast.error(msg);
      }
    } catch {
      toast.error(t('Erreur réseau lors de la réservation.', 'خطأ في الشبكة أثناء الحجز.'));
    }
  };

  const handleShareEvent = async (ev: CampusEvent) => {
    const targetUrl = ev.instagram_url || window.location.href;
    try {
      await navigator.clipboard.writeText(`${ev.title} — ${targetUrl}`);
      setCopiedId(ev.id);
      toast.success(t('Lien copié dans le presse-papiers.', 'تم نسخ الرابط.'));
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === ev.id ? null : prev));
      }, 2000);
    } catch {
      setFeedback(`Lien : ${targetUrl}`);
      toast.info(t(`Lien : ${targetUrl}`, `الرابط: ${targetUrl}`));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizerGroup,
          eventType,
          title,
          summary,
          content,
          eventDate,
          location,
          capacity: Number(capacity),
          instagramUrl: instagramUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || t('Création impossible.', 'تعذر إنشاء النشاط.');
        setFeedback(msg);
        toast.error(msg);
        return;
      }
      setTitle('');
      setSummary('');
      setContent('');
      setEventDate('');
      setLocation('');
      setInstagramUrl('');
      setShowForm(false);
      toast.success(t('Événement publié avec succès.', 'تم نشر النشاط بنجاح.'));
      await fetchEvents();
    } catch {
      const msg = t('Erreur réseau lors de la publication.', 'خطأ في الشبكة أثناء النشر.');
      setFeedback(msg);
      toast.error(msg);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('Suppression impossible.', 'تعذر حذف النشاط.'));
        return;
      }
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      toast.success(t('Événement supprimé.', 'تم حذف النشاط بنجاح.'));
    } catch {
      toast.error(t('Erreur réseau lors de la suppression.', 'خطأ في الشبكة أثناء الحذف.'));
    }
  };

  return (
    <div className="bg-[#f7ead0] py-6 text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6] sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-5 dark:border-[#332920] sm:flex-row sm:items-end sm:gap-6 sm:pb-8">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              {t('Vie Étudiante · BDE & Groupe Média', 'الحياة الطلابية · مكتب الطلبة وفريق الإعلام')}
            </p>
            <h1 className="dune-heading mt-1.5 sm:mt-2 font-display text-2xl font-semibold tracking-tight text-[#a8532c] dark:text-[#e88c5d] sm:text-4xl">
              {t('Vie Campus, Événements & Pages Instagram', 'الحياة الجامعية، الأنشطة وصفحات إنستغرام')}
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
              {t(
                'Le BDE est le président des étudiants qui porte la voix des promotions Sup & Spé, et l’équipe Média (Groupe Média) est responsable de partager tous les événements sur le site web et sur les pages Instagram officielles.',
                'يمثّل مكتب الطلبة (BDE) رئيس الطلبة والصوت الرسمي لأقسام التحضيرية، بينما يتكلف فريق الإعلام بمشاركة كل ما يتعلق بالأنشطة والفعاليات على الموقع وصفحات إنستغرام الرسمية.'
              )}
            </p>
          </div>

          {canPublish ? (
            <button
              type="button"
              onClick={() => {
                if (!showForm) {
                  setOrganizerGroup(user?.role === 'groupe_media' ? 'Groupe Média' : 'BDE');
                }
                setShowForm((p) => !p);
              }}
              className="btn-rust inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer sm:min-h-0"
            >
              <Plus className="h-4 w-4" />
              {showForm ? t('Fermer', 'إغلاق') : t('Partager un événement', 'نشر نشاط أو إعلان')}
            </button>
          ) : null}
        </div>

        {/* Dedicated BDE & Groupe Média Mission Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <GlowCard
            onClick={() => setFilterGroup((prev) => (prev === 'BDE' ? 'ALL' : 'BDE'))}
            className={`p-5 transition-all ${filterGroup === 'BDE' ? '!border-[#a8532c] ring-1 ring-[#a8532c]/35 dark:!border-[#e88c5d] dark:ring-[#e88c5d]/35' : ''}`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              <span className="inline-flex items-center gap-2">
                <Crown className="h-4 w-4" />
                {t('BDE · Président des étudiants', 'BDE · رئيس الطلبة')}
              </span>
              <span className="text-[11px] font-medium lowercase">
                {filterGroup === 'BDE' ? t('filtre actif', 'مفعل') : t('cliquer pour filtrer', 'انقر للتصفية')}
              </span>
            </div>
            <h2 className="mt-2 font-display text-lg font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
              {t('Le président & représentant officiel des étudiants', 'رئيس الطلبة والممثل الرسمي للتلاميذ')}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
              {t(
                'Le BDE (Bureau des Étudiants) est le président des étudiants du campus. Il représente l’ensemble des élèves Sup & Spé auprès de la direction, anime la cohésion et coordonne les initiatives étudiantes.',
                'مكتب الطلبة هو الممثل والرئيس الرسمي لطلبة الأقسام التحضيرية باب الصحراء، يشرف على تمثيل التلاميذ وتنسيق المبادرات والأنشطة الطلابية.'
              )}
            </p>
          </GlowCard>

          <GlowCard
            onClick={() => setFilterGroup((prev) => (prev === 'Groupe Média' ? 'ALL' : 'Groupe Média'))}
            className={`p-5 transition-all ${filterGroup === 'Groupe Média' ? '!border-[#a8532c] ring-1 ring-[#a8532c]/35 dark:!border-[#e88c5d] dark:ring-[#e88c5d]/35' : ''}`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              <span className="inline-flex items-center gap-2">
                <Camera className="h-4 w-4" />
                {t('Groupe Média · Équipe Média & Instagram', 'فريق الإعلام · الموقع وصفحات إنستغرام')}
              </span>
              <span className="text-[11px] font-medium lowercase">
                {filterGroup === 'Groupe Média' ? t('filtre actif', 'مفعل') : t('cliquer pour filtrer', 'انقر للتصفية')}
              </span>
            </div>
            <h2 className="mt-2 font-display text-lg font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
              {t('Diffusion des événements sur le site & les pages Instagram', 'نشر الفعاليات على الموقع وصفحات إنستغرام')}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
              {t(
                'L’équipe Média est responsable de partager tout ce qui concerne les événements du campus ici sur le site web ainsi que sur les pages Instagram officielles : annonces, photos, affiches, stories et récapitulatifs.',
                'فريق الإعلام مسؤول عن مشاركة كل ما يخص أنشطة وفعاليات المؤسسة هنا على الموقع الرسمي وعلى صفحات إنستغرام: الإعلانات، الصور، الملصقات والتغطية الإعلامية.'
              )}
            </p>
          </GlowCard>
        </div>

        {feedback ? (
          <div className="mt-4 rounded-lg border border-[#a8532c]/40 bg-[#e6c58c]/60 px-4 py-2.5 text-xs font-medium text-[#a8532c] dark:border-[#e88c5d]/50 dark:bg-[#2a241d] dark:text-[#e88c5d]">
            {feedback}
          </div>
        ) : null}

        <AnimatePresence>
          {showForm && canPublish ? (
            <motion.form
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              onSubmit={handleCreate}
              className="mt-6 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-6 dark:border-[#5a4634] dark:bg-[#1c1916]"
            >
              <h2 className="font-display text-base font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                Publier un événement ou une actualité campus
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Pôle organisateur</label>
                  <select
                    value={organizerGroup}
                    onChange={(e) => setOrganizerGroup(e.target.value as CampusEvent['organizer_group'])}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  >
                    <option value="BDE">BDE (Président des étudiants)</option>
                    <option value="Groupe Média">Groupe Média (Site &amp; Pages Instagram)</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Format</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as CampusEvent['event_type'])}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  >
                    <option value="Événement">Événement</option>
                    <option value="Conférence">Conférence</option>
                    <option value="Tournoi">Tournoi</option>
                    <option value="Article">Article</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Capacité</label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Titre</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Date / Créneau</label>
                  <input
                    type="text"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    placeholder="Ex: Mercredi 17h30"
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Lieu</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Grand Amphithéâtre"
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Accroche</label>
                  <input
                    type="text"
                    required
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Lien page / post Instagram (optionnel)</label>
                  <input
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Contenu détaillé</label>
                <textarea
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-rust rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer">
                  Publier sur le site
                </button>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>

        {/* Filter Bar + Live Search */}
        <div className="mt-5 sm:mt-6 flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
          <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:w-fit sm:flex-wrap">
            {(['ALL', 'BDE', 'Groupe Média', 'Administration'] as const).map((grp) => {
              const active = filterGroup === grp;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setFilterGroup(grp)}
                  className={`min-h-[36px] shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer sm:min-h-0 ${
                    active
                      ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                      : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#e3d4b7] dark:hover:bg-[#332b23]'
                  }`}
                >
                  {grp === 'ALL' ? t('Tout le campus', 'الجميع') : grp}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4a2e1a]/60 dark:text-[#c8b696]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Rechercher un événement, lieu...', 'ابحث عن نشاط أو مكان...')}
              className="min-h-[42px] w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] py-2 pl-9 pr-3 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-6 sm:mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4] dark:border-[#423428] dark:bg-[#1c1916]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 sm:mt-8 rounded-xl border border-[#c98f4f]/55 bg-[#fcf4e4] p-7 sm:p-8 text-center text-sm text-[#4a2e1a]/80 dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#e3d4b7]">
            {t('Aucun événement ne correspond à votre recherche.', 'لا توجد أنشطة مطابقة للبحث.')}
          </div>
        ) : (
          <div className="mt-6 sm:mt-8 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
              {filtered.map((ev) => {
                const registered = Boolean(ev.is_registered);
                const isExpanded = Boolean(expandedIds[ev.id]);
                const isLong = ev.content.length > 150;
                return (
                  <GlowCard key={ev.id} className="p-4 sm:p-6">
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">
                          <span className="font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                            {ev.organizer_group} · {ev.event_type}
                          </span>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#4a2e1a] dark:text-[#f5ebd6]">
                              <Users className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                              {ev.registered_count}/{ev.capacity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleShareEvent(ev)}
                              aria-label="Partager le lien"
                              title="Partager"
                              className="inline-flex min-h-[34px] items-center gap-1 rounded border border-[#c98f4f] px-2.5 py-1 text-[11px] font-medium text-[#a8532c] hover:bg-[#e6c58c]/65 transition-colors cursor-pointer dark:border-[#5a4634] dark:text-[#e88c5d] dark:hover:bg-[#332b23] sm:min-h-0 sm:px-2"
                            >
                              {copiedId === ev.id ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  {t('Copié', 'تم النسخ')}
                                </>
                              ) : (
                                <>
                                  <Share2 className="h-3 w-3" />
                                  {t('Partager', 'مشاركة')}
                                </>
                              )}
                            </button>
                            {canPublish ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteEvent(ev.id)}
                                aria-label="Supprimer l’événement"
                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#c98f4f] text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] cursor-pointer dark:border-[#5a4634] dark:text-[#e88c5d] dark:hover:bg-[#c25e32] dark:hover:text-[#fdf6e9] sm:h-auto sm:w-auto sm:p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <h2 className="mt-2.5 font-display text-lg sm:text-xl font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                          {ev.title}
                        </h2>
                        <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium text-[#a8532c] dark:text-[#e88c5d]">{ev.summary}</p>
                        <p
                          className={`mt-2 text-xs sm:text-sm leading-relaxed text-[#4a2e1a]/85 dark:text-[#e3d4b7] ${
                            isLong && !isExpanded ? 'line-clamp-3' : ''
                          }`}
                        >
                          {ev.content}
                        </p>
                        {isLong ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedIds((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))
                            }
                            className="mt-1.5 inline-flex min-h-[34px] items-center gap-1 text-xs font-semibold text-[#a8532c] hover:underline cursor-pointer dark:text-[#e88c5d] sm:min-h-0"
                          >
                            {isExpanded ? (
                              <>
                                {t('Réduire', 'تقليص')}
                                <ChevronUp className="h-3.5 w-3.5" />
                              </>
                            ) : (
                              <>
                                {t('Lire la suite', 'اقرأ المزيد')}
                                <ChevronDown className="h-3.5 w-3.5" />
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-5 flex flex-col gap-3 border-t border-[#c98f4f]/30 pt-4 dark:border-[#423428] sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                            {ev.event_date}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                            {ev.location}
                          </span>
                          {ev.instagram_url ? (
                            <a
                              href={ev.instagram_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[#a8532c] hover:underline dark:text-[#e88c5d]"
                            >
                              Instagram
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleRsvp(ev.id)}
                          className={
                            registered
                              ? 'btn-sand inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer sm:min-h-0'
                              : 'btn-rust inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer sm:min-h-0'
                          }
                        >
                          {registered ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                              Place réservée
                            </>
                          ) : user ? (
                            'Réserver sa place'
                          ) : (
                            'Portail pour participer'
                          )}
                        </button>
                      </div>
                    </div>
                  </GlowCard>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
