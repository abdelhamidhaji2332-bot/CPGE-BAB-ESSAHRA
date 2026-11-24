import { CheckCircle2, Code2, FileText, Plus, Send, Trash2, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { useAuth } from '../context/AuthContext';
import {
  CAMPUS_CLASSES,
  DOCUMENT_CATEGORY_LABELS,
  type ClassCode,
  type DocumentCategory,
} from '../shared/curriculum';

interface TeacherPdfDoc {
  id: number;
  class_code: string | null;
  category: DocumentCategory;
  title: string;
  chapter: string;
  file_path: string;
  file_size: number;
}

interface InfoSubmission {
  id: number;
  assignment_id: number;
  student_id: number;
  student_name: string;
  file_name: string;
  code_content: string;
  professor_feedback: string | null;
  status: 'soumis' | 'revu' | 'valide';
  submitted_at: string;
}

interface InfoAssignment {
  id: number;
  class_code: ClassCode;
  title: string;
  description: string;
  language: string;
  due_date: string;
  professor_name: string;
  mySubmission: InfoSubmission | null;
  submissions: InfoSubmission[];
}

const STATUS_TEXT: Record<InfoSubmission['status'], string> = {
  soumis: 'Soumis · En attente de revue',
  revu: 'Revu · Remarques disponibles',
  valide: 'Validé par le professeur',
};

export function ProfWorkspacePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, apiFetch } = useAuth();
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [assignments, setAssignments] = useState<InfoAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create assignment form
  const [newClass, setNewClass] = useState<ClassCode>('MPSI');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('Vendredi 20h00');
  const [formMsg, setFormMsg] = useState<string | null>(null);

  // Student submission modal/drawer state
  const [activeAssignId, setActiveAssignId] = useState<number | null>(null);
  const [fileName, setFileName] = useState('solution_tp.py');
  const [codeContent, setCodeContent] = useState('');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  // Professor review state
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { status: InfoSubmission['status']; feedback: string }>>({});

  // Teacher Cours / TD / DS PDF upload state
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docClass, setDocClass] = useState<ClassCode>('MPSI');
  const [docCat, setDocCat] = useState<DocumentCategory>('cours');
  const [docSubj, setDocSubj] = useState('mathematiques');
  const [docTitle, setDocTitle] = useState('');
  const [docChapter, setDocChapter] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<TeacherPdfDoc[]>([]);

  const isProfOrAdmin = user && (user.role === 'professeur' || user.role === 'admin');

  const selectedDocClassObj = useMemo(
    () => CAMPUS_CLASSES.find((c) => c.code === docClass) || CAMPUS_CLASSES[0],
    [docClass]
  );

  const fetchTeacherDocs = useCallback(async () => {
    if (!isProfOrAdmin) return;
    const res = await apiFetch('/api/documents');
    if (res.ok) {
      const data = await res.json();
      const rows = (data.documents || []) as TeacherPdfDoc[];
      setUploadedDocs(rows.filter((d) => ['cours', 'td', 'ds', 'concours-blancs', 'corriges'].includes(d.category)));
    }
  }, [apiFetch, isProfOrAdmin]);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedClass !== 'ALL' ? `?classCode=${selectedClass}` : '';
      const res = await apiFetch(`/api/informatique/assignments${qs}`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, selectedClass]);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    void fetchTeacherDocs();
  }, [fetchTeacherDocs]);

  const handleUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !docTitle.trim()) {
      setDocMsg('Sélectionnez un fichier PDF et saisissez un titre.');
      return;
    }
    setDocUploading(true);
    setDocMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('classCode', docClass);
      fd.append('category', docCat);
      fd.append('subjectSlug', docSubj);
      fd.append('title', docTitle.trim());
      fd.append('chapter', docChapter.trim());
      fd.append('description', docDesc.trim());
      const res = await apiFetch('/api/documents/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setDocMsg(data.error || 'Échec de publication.');
        return;
      }
      setDocTitle('');
      setDocChapter('');
      setDocDesc('');
      setDocFile(null);
      setShowDocUpload(false);
      setDocMsg(`Document publié dans ${docClass} (${DOCUMENT_CATEGORY_LABELS[docCat]}).`);
      await fetchTeacherDocs();
    } finally {
      setDocUploading(false);
    }
  };

  const handleDeletePdf = async (docId: number) => {
    const res = await apiFetch(`/api/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    const res = await apiFetch('/api/informatique/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classCode: newClass,
        title: newTitle,
        description: newDesc,
        dueDate: newDue,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormMsg(data.error || 'Création impossible.');
      return;
    }
    setNewTitle('');
    setNewDesc('');
    setShowCreate(false);
    await fetchAssignments();
  };

  const handleSubmitCode = async (e: React.FormEvent, assignmentId: number) => {
    e.preventDefault();
    setSubmitMsg(null);
    const res = await apiFetch(`/api/informatique/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, codeContent }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSubmitMsg(data.error || 'Envoi impossible.');
      return;
    }
    setActiveAssignId(null);
    setCodeContent('');
    await fetchAssignments();
  };

  const handleReviewSubmission = async (subId: number) => {
    const draft = reviewDrafts[subId] ?? { status: 'valide' as const, feedback: '' };
    const res = await apiFetch(`/api/informatique/submissions/${subId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: draft.status,
        professorFeedback: draft.feedback,
      }),
    });
    if (res.ok) {
      await fetchAssignments();
    }
  };

  return (
    <div className="bg-[#f7ead0] py-8 text-[#4a2e1a] sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-6 sm:flex-row sm:items-end sm:gap-6 sm:pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
              Espace Professeur · Informatique &amp; Python
            </p>
            <h1 className="dune-heading mt-2 font-display text-2xl font-semibold tracking-tight text-[#a8532c] sm:text-4xl">
              Travaux d’Informatique et dépôts de code
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#4a2e1a]/85">
              Système de remise de travaux dirigé par les enseignants : sujets Python par classe,
              soumission directe des scripts par les élèves et validation commentée.
            </p>
          </div>

          {isProfOrAdmin ? (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDocUpload((p) => !p)}
                className="btn-sand inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                {showDocUpload ? 'Fermer dépôt PDF' : 'Publier Cours / TD / DS'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate((p) => !p)}
                className="btn-rust inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {showCreate ? 'Fermer' : 'Nouveau TP / DM Python'}
              </button>
            </div>
          ) : null}
        </div>

        {docMsg ? (
          <div className="mt-4 rounded-lg border border-[#a8532c]/40 bg-[#e6c58c]/60 px-4 py-2.5 text-xs font-medium text-[#a8532c]">
            {docMsg}
          </div>
        ) : null}

        {showDocUpload && isProfOrAdmin ? (
          <form
            onSubmit={handleUploadPdf}
            className="mt-6 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-6"
          >
            <h2 className="font-display text-base font-semibold text-[#a8532c]">
              Publier un Cours, TD ou Devoir Surveillé (PDF)
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Classe</label>
                <select
                  value={docClass}
                  onChange={(e) => {
                    const next = e.target.value as ClassCode;
                    setDocClass(next);
                    const found = CAMPUS_CLASSES.find((c) => c.code === next);
                    if (found?.subjects[0]) setDocSubj(found.subjects[0].slug);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                >
                  {CAMPUS_CLASSES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.level})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Type de support</label>
                <select
                  value={docCat}
                  onChange={(e) => setDocCat(e.target.value as DocumentCategory)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                >
                  <option value="cours">Cours / Leçon</option>
                  <option value="td">TD (Travaux Dirigés)</option>
                  <option value="ds">Devoir Surveillé (DS)</option>
                  <option value="corriges">Corrigé</option>
                  <option value="concours-blancs">Concours Blanc</option>
                  <option value="guides">Guide Campus</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Matière</label>
                <select
                  value={docSubj}
                  onChange={(e) => setDocSubj(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                >
                  {selectedDocClassObj.subjects.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Titre</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Ex: Chapitre 2 — Séries numériques"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Chapitre / Période</label>
                <input
                  type="text"
                  value={docChapter}
                  onChange={(e) => setDocChapter(e.target.value)}
                  placeholder="Ex: Semestre 1"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Fichier PDF (12 Mo max.)</label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-1.5 text-xs text-[#4a2e1a]"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-[#4a2e1a]">Description (optionnelle)</label>
              <input
                type="text"
                value={docDesc}
                onChange={(e) => setDocDesc(e.target.value)}
                placeholder="Consignes ou notions abordées"
                className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDocUpload(false)}
                className="btn-sand rounded-lg px-4 py-2 text-xs font-medium cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={docUploading}
                className="btn-rust rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {docUploading ? 'Publication...' : 'Publier le support PDF'}
              </button>
            </div>
          </form>
        ) : null}

        {isProfOrAdmin ? (
          <GlowCard className="mt-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
                <FileText className="h-4 w-4" />
                <span>Cours, TD &amp; DS publiés par les professeurs ({uploadedDocs.length})</span>
              </div>
              {uploadedDocs.length === 0 ? (
                <span className="text-xs font-semibold text-[#a8532c]">Coming soon — En attente de publication</span>
              ) : null}
            </div>
            {uploadedDocs.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {uploadedDocs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#c98f4f]/40 bg-[#f7ead0] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#4a2e1a]">{d.title}</p>
                      <p className="text-[11px] text-[#a8532c]">
                        {d.class_code || 'Campus'} · {DOCUMENT_CATEGORY_LABELS[d.category]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePdf(d.id)}
                      aria-label={`Supprimer ${d.title}`}
                      className="rounded border border-[#c98f4f] p-1.5 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </GlowCard>
        ) : null}

        {showCreate && isProfOrAdmin ? (
          <form
            onSubmit={handleCreateAssignment}
            className="mt-6 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-6"
          >
            <h2 className="font-display text-base font-semibold text-[#a8532c]">
              Publier un travail d’Informatique
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Classe destinataire</label>
                <select
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value as ClassCode)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                >
                  {CAMPUS_CLASSES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.level})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#4a2e1a]">Titre du TP / DM</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: TP 03 — Résolution numérique d’équations différentielles (Euler & RK4)"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#4a2e1a]">Énoncé et attentes</label>
                <textarea
                  rows={3}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Échéance</label>
                <input
                  type="text"
                  required
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a]"
                />
              </div>
            </div>
            {formMsg ? <p className="mt-2 text-xs font-semibold text-[#a8532c]">{formMsg}</p> : null}
            <div className="mt-4 flex justify-end">
              <button type="submit" className="btn-rust rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer">
                Publier le TP
              </button>
            </div>
          </form>
        ) : null}

        <div className="no-scrollbar mt-6 flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 sm:w-fit sm:flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedClass('ALL')}
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
              selectedClass === 'ALL'
                ? 'bg-[#a8532c] text-[#f7ead0]'
                : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
            }`}
          >
            Toutes (8)
          </button>
          {CAMPUS_CLASSES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setSelectedClass(c.code)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                selectedClass === c.code
                  ? 'bg-[#a8532c] text-[#f7ead0]'
                  : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
              }`}
            >
              {c.code}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4]" />
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {assignments.map((assign) => {
              const canSubmitForClass =
                user && (user.role === 'admin' || user.role === 'professeur' || user.classCode === assign.class_code);
              const isEditingThis = activeAssignId === assign.id;

              return (
                <GlowCard key={assign.id} className="p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4a2e1a]/75">
                        <span className="font-mono font-semibold text-[#a8532c]">{assign.class_code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{assign.language}</span>
                        <span aria-hidden="true">·</span>
                        <span>{assign.professor_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>Échéance : {assign.due_date}</span>
                      </div>
                      <h2 className="mt-2 font-display text-lg font-semibold text-[#4a2e1a]">
                        {assign.title}
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#4a2e1a]/85">
                        {assign.description}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {!user ? (
                        <button
                          type="button"
                          onClick={() => onNavigate('/portail')}
                          className="btn-sand rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer"
                        >
                          Connexion requise
                        </button>
                      ) : canSubmitForClass && !isProfOrAdmin ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingThis) {
                              setActiveAssignId(null);
                            } else {
                              setActiveAssignId(assign.id);
                              setFileName(assign.mySubmission?.file_name || `tp_${assign.class_code.toLowerCase()}.py`);
                              setCodeContent(
                                assign.mySubmission?.code_content ||
                                  '# Écrivez ou collez votre implémentation Python ici\n\ndef main():\n    pass\n'
                              );
                            }
                          }}
                          className="btn-rust inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer"
                        >
                          <Code2 className="h-3.5 w-3.5" />
                          {assign.mySubmission ? 'Mettre à jour mon rendu' : 'Déposer mon code'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Student's own submission status */}
                  {assign.mySubmission ? (
                    <div className="mt-4 rounded-lg border border-[#c98f4f]/45 bg-[#f7ead0] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#a8532c]">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#a8532c]" />
                          {STATUS_TEXT[assign.mySubmission.status]}
                        </span>
                        <span className="font-mono text-[#4a2e1a]/75">{assign.mySubmission.file_name}</span>
                      </div>
                      {assign.mySubmission.professor_feedback ? (
                        <p className="mt-2 text-xs text-[#4a2e1a]">
                          <strong>Remarque professeur :</strong> {assign.mySubmission.professor_feedback}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Student submission form */}
                  {isEditingThis ? (
                    <form
                      onSubmit={(e) => handleSubmitCode(e, assign.id)}
                      className="mt-5 border-t border-[#c98f4f]/35 pt-5"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-[#4a2e1a]">Nom du fichier (.py)</label>
                          <input
                            type="text"
                            required
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 font-mono text-xs text-[#4a2e1a]"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-[#4a2e1a]">Code source Python</label>
                        <textarea
                          rows={8}
                          required
                          value={codeContent}
                          onChange={(e) => setCodeContent(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#3b2414] p-3 font-mono text-xs text-[#f7ead0]"
                        />
                      </div>
                      {submitMsg ? <p className="mt-2 text-xs font-semibold text-[#a8532c]">{submitMsg}</p> : null}
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveAssignId(null)}
                          className="btn-sand rounded-lg px-3.5 py-2 text-xs font-medium cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="btn-rust inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Envoyer le rendu
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {/* Professor / Admin Submissions Review Table */}
                  {isProfOrAdmin ? (
                    <div className="mt-5 border-t border-[#c98f4f]/35 pt-4">
                      <p className="text-xs font-semibold text-[#a8532c]">
                        Rendus des élèves ({assign.submissions.length})
                      </p>
                      {assign.submissions.length === 0 ? (
                        <p className="mt-2 text-xs text-[#4a2e1a]/75">
                          Aucun script soumis pour le moment dans cette classe.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {assign.submissions.map((sub) => {
                            const draft = reviewDrafts[sub.id] ?? {
                              status: sub.status,
                              feedback: sub.professor_feedback || '',
                            };
                            return (
                              <div
                                key={sub.id}
                                className="rounded-lg border border-[#c98f4f]/45 bg-[#f7ead0] p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold text-[#4a2e1a]">
                                    {sub.student_name} · <span className="font-mono text-[#a8532c]">{sub.file_name}</span>
                                  </span>
                                  <span className="text-[#4a2e1a]/75">{STATUS_TEXT[sub.status]}</span>
                                </div>
                                <pre className="mt-2 max-h-40 overflow-auto rounded border border-[#c98f4f]/50 bg-[#3b2414] p-3 font-mono text-[11px] text-[#f7ead0]">
                                  {sub.code_content}
                                </pre>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <select
                                    value={draft.status}
                                    onChange={(e) =>
                                      setReviewDrafts((p) => ({
                                        ...p,
                                        [sub.id]: { ...draft, status: e.target.value as InfoSubmission['status'] },
                                      }))
                                    }
                                    className="rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-2.5 py-1.5 text-xs text-[#4a2e1a]"
                                  >
                                    <option value="soumis">Soumis</option>
                                    <option value="revu">Revu</option>
                                    <option value="valide">Validé</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={draft.feedback}
                                    onChange={(e) =>
                                      setReviewDrafts((p) => ({
                                        ...p,
                                        [sub.id]: { ...draft, feedback: e.target.value },
                                      }))
                                    }
                                    placeholder="Commentaire sur la complexité, tests ou correction..."
                                    className="flex-1 rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-3 py-1.5 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleReviewSubmission(sub.id)}
                                    className="btn-rust rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                                  >
                                    Enregistrer avis
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </GlowCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
