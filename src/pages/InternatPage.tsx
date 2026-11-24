import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Home, Megaphone, Pin, Plus, Search, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

interface InternatNotice {
  id: number;
  pavillon: string;
  category: 'Horaire' | 'Permanence' | 'Maintenance' | 'Annonce';
  title: string;
  content: string;
  is_pinned: number;
  author_name: string;
  created_at: string;
}

const DAILY_SCHEDULE = [
  { time: '07:00 – 07:45', startMin: 7 * 60, endMin: 7 * 60 + 45, activity: 'Petit-déjeuner', place: 'Réfectoire Campus' },
  { time: '12:15 – 13:30', startMin: 12 * 60 + 15, endMin: 13 * 60 + 30, activity: 'Déjeuner (service Sup / Spé)', place: 'Réfectoire Campus' },
  { time: '18:30 – 20:00', startMin: 18 * 60 + 30, endMin: 20 * 60, activity: 'Étude encadrée — Séquence 1', place: 'Salles d’étude & Pavillons' },
  { time: '20:00 – 20:55', startMin: 20 * 60, endMin: 20 * 60 + 55, activity: 'Dîner', place: 'Réfectoire Campus' },
  { time: '21:00 – 22:30', startMin: 21 * 60, endMin: 22 * 60 + 30, activity: 'Étude du soir — Séquence 2', place: 'Salles de travail' },
  { time: '23:15', startMin: 23 * 60 + 15, endMin: 23 * 60 + 45, activity: 'Silence des couloirs & extinction des feux', place: 'Pavillons A & B' },
];

export function InternatPage() {
  const { user, apiFetch } = useAuth();
  const { t } = useLang();
  const [notices, setNotices] = useState<InternatNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [filterCategory, setFilterCategory] = useState<'ALL' | InternatNotice['category']>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  const [pavillon, setPavillon] = useState('Tous les pavillons');
  const [category, setCategory] = useState<InternatNotice['category']>('Annonce');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user && (user.role === 'maitre_internat' || user.role === 'admin');

  useEffect(() => {
    const interval = window.setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const nextUpcomingStart = useMemo(() => {
    const active = DAILY_SCHEDULE.find((s) => nowMinutes >= s.startMin && nowMinutes <= s.endMin);
    if (active) return null;
    const upcoming = DAILY_SCHEDULE.find((s) => s.startMin > nowMinutes);
    return upcoming ? upcoming.startMin : null;
  }, [nowMinutes]);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/internat');
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotices();
  }, [fetchNotices]);

  const matchedNotices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notices.filter((n) => {
      if (filterCategory !== 'ALL' && n.category !== filterCategory) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.pavillon.toLowerCase().includes(q) ||
        n.author_name.toLowerCase().includes(q)
      );
    });
  }, [notices, filterCategory, searchQuery]);

  const announcements = useMemo(
    () => matchedNotices.filter((n) => n.category === 'Annonce'),
    [matchedNotices]
  );

  const serviceNotices = useMemo(
    () => matchedNotices.filter((n) => n.category !== 'Annonce'),
    [matchedNotices]
  );

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await apiFetch('/api/internat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pavillon, category, title, content, isPinned }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Publication impossible.');
      return;
    }
    setTitle('');
    setContent('');
    setIsPinned(false);
    setShowForm(false);
    await fetchNotices();
  };

  const handleDelete = async (id: number) => {
    const res = await apiFetch(`/api/internat/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setNotices((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return (
    <div className="bg-[#f7ead0] py-8 text-[#4a2e1a] sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-6 sm:flex-row sm:items-end sm:gap-6 sm:pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
              {t('Vie Résidentielle · Maîtres d’internat', 'الحياة الداخلية · حراس الداخلية')}
            </p>
            <h1 className="dune-heading mt-2 font-display text-2xl font-semibold tracking-tight text-[#a8532c] sm:text-4xl">
              {t('Portail de l’Internat', 'بوابة الداخلية')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#4a2e1a]/85">
              {t(
                'Annonces officielles de l’internat, horaires des repas et études du soir, permanences et notes de service publiées par les maîtres d’internat.',
                'إعلانات الداخلية الرسمية، مواقيت الوجبات والمذاكرة المسائية، والمناوبات الصادرة عن حراس الداخلية.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="/documents/guides/reglement-interieur-internat.pdf"
              download
              className="btn-sand rounded-lg px-3.5 py-2.5 text-xs font-semibold"
            >
              {t('Règlement PDF', 'النظام الداخلي PDF')}
            </a>
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  setCategory('Annonce');
                  setShowForm((prev) => !prev);
                }}
                className="btn-rust inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {showForm ? t('Fermer', 'إغلاق') : t('Publier une annonce / note', 'نشر إعلان أو مذكرة')}
              </button>
            ) : null}
          </div>
        </div>

        {/* Interactive Filter Bar & Live Search */}
        <div className="mt-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 sm:w-fit sm:flex-wrap">
            {(
              [
                { id: 'ALL', label: t('Tout voir', 'الكل') },
                { id: 'Annonce', label: t('Annonces', 'الإعلانات') },
                { id: 'Horaire', label: t('Horaires', 'المواقيت') },
                { id: 'Permanence', label: t('Permanences', 'المناوبات') },
                { id: 'Maintenance', label: t('Maintenance', 'الصيانة') },
              ] as const
            ).map((item) => {
              const active = filterCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilterCategory(item.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active ? 'bg-[#a8532c] text-[#f7ead0]' : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4a2e1a]/60" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Filtrer par pavillon, titre...', 'تصفية حسب الجناح أو العنوان...')}
              className="w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] py-2 pl-9 pr-3 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
            />
          </div>
        </div>

        <AnimatePresence>
          {showForm && canManage ? (
            <motion.form
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              onSubmit={handlePublish}
              className="mt-6 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-6"
            >
              <h2 className="font-display text-base font-semibold text-[#a8532c]">
                {category === 'Annonce'
                  ? t('Nouvelle annonce d’internat', 'إعلان جديد للداخلية')
                  : t('Nouvelle note de service', 'مذكرة جديدة')}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a]">Pavillon / Zone</label>
                  <input
                    type="text"
                    required
                    value={pavillon}
                    onChange={(e) => setPavillon(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a]">Catégorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as InternatNotice['category'])}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                  >
                    <option value="Annonce">Annonce</option>
                    <option value="Horaire">Horaire</option>
                    <option value="Permanence">Permanence</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-[#4a2e1a]">Titre</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Réunion des internes ou permanence exceptionnelle"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                />
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-[#4a2e1a]">Message</label>
                <textarea
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                />
              </div>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-[#4a2e1a]">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-[#c98f4f]"
                />
                Épingler en haut des annonces d’internat
              </label>
              {error ? <p className="mt-2 text-xs font-semibold text-[#a8532c]">{error}</p> : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="btn-rust rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Publier
                </button>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>

        {/* Dedicated Annonces de l'Internat Section */}
        {filterCategory === 'ALL' || filterCategory === 'Annonce' ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[#a8532c]" />
                <h2 className="font-display text-xl font-semibold text-[#a8532c]">
                  {t('Annonces de l’Internat', 'إعلانات الداخلية')} ({announcements.length})
                </h2>
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Annonce');
                    setShowForm(true);
                  }}
                  className="btn-sand inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('Nouvelle annonce', 'إعلان جديد')}
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className="mt-4 h-32 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4]" />
            ) : announcements.length === 0 ? (
              <div className="mt-4 rounded-xl border border-[#c98f4f]/45 bg-[#fcf4e4] p-6 text-center text-sm text-[#4a2e1a]/80">
                {t('Aucune annonce d’internat ne correspond à votre filtre.', 'لا توجد إعلانات مطابقة حالياً.')}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {announcements.map((ann) => (
                  <GlowCard key={ann.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#4a2e1a]/75">
                          {ann.is_pinned ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#a8532c]">
                              <Pin className="h-3 w-3" />
                              Épinglé
                            </span>
                          ) : null}
                          <span className="font-semibold text-[#a8532c]">Annonce</span>
                          <span aria-hidden="true">·</span>
                          <span>{ann.pavillon}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ann.author_name}</span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-semibold text-[#4a2e1a]">
                          {ann.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#4a2e1a]/85">{ann.content}</p>
                      </div>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(ann.id)}
                          aria-label="Supprimer l’annonce"
                          className="rounded-lg border border-[#c98f4f] p-2 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </GlowCard>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Structured Boarding Timetable with Live Time Highlight */}
          <GlowCard className="p-6 lg:col-span-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#a8532c]">
              <Clock className="h-4 w-4" />
              <span>{t('Rythme journalier type', 'البرنامج اليومي')}</span>
            </div>
            <h2 className="mt-2 font-display text-lg font-semibold text-[#4a2e1a]">
              {t('Horaires de l’internat', 'مواقيت الداخلية')}
            </h2>
            <div className="mt-5 divide-y divide-[#c98f4f]/30">
              {DAILY_SCHEDULE.map((row) => {
                const isLive = nowMinutes >= row.startMin && nowMinutes <= row.endMin;
                const isNext = nextUpcomingStart === row.startMin;
                return (
                  <div
                    key={row.time}
                    className={`py-3 first:pt-0 last:pb-0 transition-colors ${
                      isLive ? 'rounded-lg bg-[#e6c58c]/45 px-2.5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#a8532c] tabular-nums">
                        {row.time}
                      </span>
                      {isLive ? (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#a8532c]">
                          {t('En cours', 'حالياً')}
                        </span>
                      ) : isNext ? (
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a2e1a]/75">
                          {t('À venir', 'لاحقاً')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#4a2e1a]">{row.activity}</div>
                    <div className="text-xs text-[#4a2e1a]/75">{row.place}</div>
                  </div>
                );
              })}
            </div>
          </GlowCard>

          {/* Service & Permanence Notices */}
          <div className="space-y-4 lg:col-span-2">
            <h2 className="font-display text-lg font-semibold text-[#4a2e1a]">
              {t('Horaires, Permanences & Maintenance', 'المواقيت، المناوبات والصيانة')} ({serviceNotices.length})
            </h2>

            {loading ? (
              <div className="h-40 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4]" />
            ) : filterCategory === 'Annonce' ? (
              <div className="rounded-xl border border-[#c98f4f]/45 bg-[#fcf4e4] p-8 text-center text-sm text-[#4a2e1a]/80">
                <Home className="mx-auto h-6 w-6 text-[#a8532c]" />
                <p className="mt-2">
                  {t(
                    'Filtre actif sur les Annonces uniquement. Cliquez sur « Tout voir » pour afficher les horaires et permanences.',
                    'التصفية مفعلة على الإعلانات فقط. انقر على « الكل » لعرض المواقيت والمناوبات.'
                  )}
                </p>
              </div>
            ) : serviceNotices.length === 0 ? (
              <div className="rounded-xl border border-[#c98f4f]/45 bg-[#fcf4e4] p-8 text-center text-sm text-[#4a2e1a]/80">
                <Home className="mx-auto h-6 w-6 text-[#a8532c]" />
                <p className="mt-2">Aucune note de service ne correspond à votre filtre.</p>
              </div>
            ) : (
              serviceNotices.map((notice) => (
                <GlowCard key={notice.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4a2e1a]/75">
                        {notice.is_pinned ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#a8532c]">
                            <Pin className="h-3 w-3" />
                            Épinglé
                          </span>
                        ) : null}
                        <span className="font-medium text-[#4a2e1a]">{notice.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{notice.pavillon}</span>
                        <span aria-hidden="true">·</span>
                        <span>{notice.author_name}</span>
                      </div>
                      <h3 className="mt-2 font-display text-base font-semibold text-[#4a2e1a]">
                        {notice.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#4a2e1a]/85">{notice.content}</p>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(notice.id)}
                        aria-label="Supprimer la note"
                        className="rounded-lg border border-[#c98f4f] p-2 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </GlowCard>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
