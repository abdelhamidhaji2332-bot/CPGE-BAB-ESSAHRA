import { AnimatePresence, motion } from 'framer-motion';
import { Download, Eye, FileText, Search, Trash2, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { PdfPreviewModal, type PreviewDoc } from '../components/PdfPreviewModal';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import {
  CAMPUS_CLASSES,
  DOCUMENT_CATEGORY_LABELS,
  type ClassCode,
  type DocumentCategory,
} from '../shared/curriculum';

interface ResourceRow {
  id: number;
  class_code: string | null;
  subject_slug: string | null;
  category: DocumentCategory;
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

export function ResourcesPage() {
  const { user, apiFetch } = useAuth();
  const { t } = useLang();
  const [docs, setDocs] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);

  // Upload state exclusively for professors & admins
  const [showUpload, setShowUpload] = useState(false);
  const [uploadClass, setUploadClass] = useState<ClassCode>('MPSI');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('cours');
  const [uploadSubject, setUploadSubject] = useState('mathematiques');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadChapter, setUploadChapter] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canUpload = user && (user.role === 'admin' || user.role === 'professeur');

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClass !== 'ALL') params.set('classCode', selectedClass);
      if (query.trim()) params.set('q', query.trim());
      const res = await apiFetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents || []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, selectedClass, query]);

  useEffect(() => {
    void fetchDocs();
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
    const res = await apiFetch(`/api/documents/${docId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, progress_status: status } : d)));
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    const res = await apiFetch(`/api/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  const selectedClassObj = useMemo(
    () => CAMPUS_CLASSES.find((c) => c.code === uploadClass) || CAMPUS_CLASSES[0],
    [uploadClass]
  );

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) {
      setUploadMsg('Veuillez sélectionner un fichier PDF et saisir un titre.');
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
        setUploadMsg(data.error || 'Échec du dépôt PDF.');
        return;
      }
      setUploadTitle('');
      setUploadChapter('');
      setUploadDesc('');
      setUploadFile(null);
      setShowUpload(false);
      await fetchDocs();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-[#f7ead0] py-8 text-[#4a2e1a] sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-6 sm:flex-row sm:items-end sm:gap-6 sm:pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
              Bibliothèque Pédagogique · Archives PDF
            </p>
            <h1 className="dune-heading mt-2 font-display text-2xl font-semibold tracking-tight text-[#a8532c] sm:text-4xl">
              Ressources académiques du campus
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#4a2e1a]/85">
              Cours, feuilles de TD, Devoirs Surveillés, Concours Blancs, corrigés et colloscopes classés
              par filière et matière officielle.
            </p>
          </div>

          {canUpload ? (
            <button
              type="button"
              onClick={() => setShowUpload((prev) => !prev)}
              className="btn-rust inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
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
              className="mt-6 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-6"
            >
              <h2 className="font-display text-base font-semibold text-[#a8532c]">
                Publier un support pédagogique (PDF)
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a]">Classe</label>
                  <select
                    value={uploadClass}
                    onChange={(e) => {
                      const next = e.target.value as ClassCode;
                      setUploadClass(next);
                      const found = CAMPUS_CLASSES.find((c) => c.code === next);
                      if (found?.subjects[0]) setUploadSubject(found.subjects[0].slug);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                  >
                    {CAMPUS_CLASSES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.levelLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a]">Catégorie</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                  >
                    {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a]">Matière</label>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
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
                  <label className="block text-xs font-medium text-[#4a2e1a]">Titre du document</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Ex: Chapitre 4 — Espaces préhilbertiens réels"
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a]">Chapitre / Période</label>
                  <input
                    type="text"
                    value={uploadChapter}
                    onChange={(e) => setUploadChapter(e.target.value)}
                    placeholder="Ex: Semestre 1 · Algèbre"
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a]">Description succincte</label>
                  <input
                    type="text"
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    placeholder="Notions abordées ou consignes de préparation"
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2e1a]">Fichier PDF (12 Mo max.)</label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-1.5 text-xs text-[#4a2e1a]"
                  />
                </div>
              </div>

              {uploadMsg ? <p className="mt-3 text-xs font-semibold text-[#a8532c]">{uploadMsg}</p> : null}

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
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                aria-label="Filtrer par classe"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-3 py-2 text-xs font-medium text-[#4a2e1a] sm:w-auto"
              >
                <option value="ALL">Toutes les classes</option>
                <option value="CAMPUS">Guides Campus</option>
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
                className="w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-3 py-2 text-xs font-medium text-[#4a2e1a] sm:w-auto"
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
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4a2e1a]/60" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un chapitre, mot-clé..."
                className="w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] py-2 pl-9 pr-3 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
              />
            </div>
          </div>

          <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 sm:w-fit sm:flex-wrap">
            {(['ALL', 'cours', 'td', 'ds', 'concours-blancs', 'corriges', 'colloscopes', 'guides'] as const).map(
              (cat) => {
                const active = selectedCategory === cat;
                const label = cat === 'ALL' ? 'Tous' : DOCUMENT_CATEGORY_LABELS[cat];
                const count = categoryCounts[cat] || 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#a8532c] text-[#f7ead0]'
                        : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
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
              <div key={i} className="h-44 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4]" />
            ))}
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[#c98f4f]/55 bg-[#fcf4e4] p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-[#a8532c]" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[#a8532c]">
              Coming soon · {t('À venir', 'قريباً')}
            </p>
            <p className="mt-1.5 font-display text-xl font-semibold text-[#4a2e1a]">
              {t(
                'Coming soon — Cours, TD et Devoirs Surveillés',
                'قريباً — الدروس، التمارين والفروض المحروسة'
              )}
            </p>
            <p className="mx-auto mt-1.5 max-w-lg text-xs text-[#4a2e1a]/80">
              {t(
                'Les supports pédagogiques (cours, TD, DS et corrigés) seront déposés directement ici par les professeurs du campus.',
                'سيتم نشر الدروس والتمارين والفروض هنا مباشرة من طرف أساتذة الأقسام التحضيرية.'
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
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedClass}-${selectedSubject}-${selectedCategory}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {visibleDocs.map((doc) => (
                <GlowCard key={doc.id} className="p-5">
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#4a2e1a]/75">
                        <span className="font-medium text-[#a8532c]">
                          {doc.class_code || 'Campus'} · {DOCUMENT_CATEGORY_LABELS[doc.category]}
                        </span>
                        <span className="font-mono tabular-nums">
                          {Math.max(1, Math.round(doc.file_size / 1024))} Ko
                        </span>
                      </div>
                      <h3 className="mt-2.5 font-display text-base font-semibold text-[#4a2e1a]">
                        {doc.title}
                      </h3>
                      {doc.chapter ? (
                        <p className="mt-1 text-xs font-medium text-[#a8532c]">{doc.chapter}</p>
                      ) : null}
                      <p className="mt-2 text-xs leading-relaxed text-[#4a2e1a]/80">
                        {doc.description || 'Support PDF officiel prêt à consulter.'}
                      </p>
                    </div>

                    <div className="mt-5 space-y-3 border-t border-[#c98f4f]/30 pt-3.5">
                      {user ? (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-[#4a2e1a]/75">Suivi :</span>
                          <div className="flex items-center gap-1">
                            {(['a_faire', 'en_cours', 'maitrise'] as const).map((st) => {
                              const active = (doc.progress_status || 'a_faire') === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleProgress(doc.id, st)}
                                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-[#a8532c] text-[#f7ead0]'
                                      : 'text-[#4a2e1a]/75 hover:bg-[#e6c58c]/60 hover:text-[#4a2e1a]'
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
                          className="btn-sand inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Consulter
                        </button>
                        <a
                          href={doc.file_path}
                          download
                          className="btn-rust inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </a>
                        {canUpload ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc.id)}
                            aria-label="Supprimer le document"
                            className="rounded-lg border border-[#c98f4f] p-2 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </GlowCard>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <PdfPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
