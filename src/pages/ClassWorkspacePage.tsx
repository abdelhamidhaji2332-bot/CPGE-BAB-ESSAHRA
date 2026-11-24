import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Calendar,
  Compass,
  Download,
  Eye,
  Lock,
  Megaphone,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  Table2,
  Trash2,
  Upload,
  ZoomIn,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { ImageLightboxModal, type LightboxImage } from '../components/ImageLightboxModal';
import { PdfPreviewModal, type PreviewDoc } from '../components/PdfPreviewModal';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import {
  CAMPUS_CLASSES,
  DOCUMENT_CATEGORY_LABELS,
  ROLE_LABELS,
  getClassDefinition,
  type ClassCode,
  type DocumentCategory,
  type UserRole,
} from '../shared/curriculum';

export type WorkspaceTab = 'bibliotheque' | 'colloscope' | 'emploi-du-temps' | 'annonces' | 'chat';

interface ClassDocument {
  id: number;
  class_code: string;
  subject_slug: string | null;
  category: DocumentCategory;
  title: string;
  chapter: string;
  description: string;
  file_path: string;
  file_size: number;
  progress_status?: 'a_faire' | 'en_cours' | 'maitrise' | null;
}

interface TimetableRow {
  id: number;
  semester: 'S1' | 'S2';
  day_of_week: string;
  start_time: string;
  end_time: string;
  session_type: 'Cours' | 'TD' | 'TP' | 'DS' | 'Concours Blanc';
  subject_slug: string;
  subject_name: string;
  room: string;
  professor_name: string;
}

interface ColloscopeRow {
  id: number;
  week_number: number;
  week_label: string;
  trinome_number: number;
  subject_slug: string;
  subject_name: string;
  kholleur_name: string;
  day_time: string;
  room: string;
}

interface AnnouncementRow {
  id: number;
  author_name: string;
  author_role: UserRole;
  title: string;
  content: string;
  is_pinned: number;
  source_message_id: number | null;
  created_at: string;
}

interface ChatMessageRow {
  id: number;
  author_id: number;
  author_name: string;
  author_role: UserRole;
  content: string;
  is_announcement: number;
  announcement_id: number | null;
  created_at: string;
}

const DAYS_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const PROGRESSION_PARTNER: Record<ClassCode, { label: string; labelAr: string; target: ClassCode }> = {
  MPSI: { label: 'Parcours Spé : MP →', labelAr: 'المسار في السنة 2: MP →', target: 'MP' },
  PCSI1: { label: 'Parcours Spé : PSI1 →', labelAr: 'المسار في السنة 2: PSI1 →', target: 'PSI1' },
  PCSI2: { label: 'Parcours Spé : PSI2 →', labelAr: 'المسار في السنة 2: PSI2 →', target: 'PSI2' },
  ECS: { label: 'Parcours Spé : 2ECS →', labelAr: 'المسار في السنة 2: 2ECS →', target: '2ECS' },
  MP: { label: '← Parcours Sup : MPSI', labelAr: '← السنة 1: MPSI', target: 'MPSI' },
  PSI1: { label: '← Parcours Sup : PCSI1', labelAr: '← السنة 1: PCSI1', target: 'PCSI1' },
  PSI2: { label: '← Parcours Sup : PCSI2', labelAr: '← السنة 1: PCSI2', target: 'PCSI2' },
  '2ECS': { label: '← Parcours Sup : ECS', labelAr: '← السنة 1: ECS', target: 'ECS' },
};

function getTodayFrenchDay(): string | null {
  const map = [null, 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return map[new Date().getDay()] || null;
}

const COLLOSCOPE_IMAGES: Record<ClassCode, string> = {
  MPSI: '/images/colloscope/mpsi.png',
  PCSI1: '/images/colloscope/pcsi1.png',
  PCSI2: '/images/colloscope/pcsi2.png',
  ECS: '/images/colloscope/ECS1.png',
  MP: '/images/colloscope/MP.png',
  PSI1: '/images/colloscope/psi1.png',
  PSI2: '/images/colloscope/psi2.png',
  '2ECS': '/images/colloscope/2ecs.png',
};

const EMPLOI_IMAGES: Record<ClassCode, string> = {
  MPSI: '/images/emploi-du-temps/mpsi.png',
  PCSI1: '/images/emploi-du-temps/pcsi1.png',
  PCSI2: '/images/emploi-du-temps/pcsi2.png',
  ECS: '/images/emploi-du-temps/ecs1.png',
  MP: '/images/emploi-du-temps/mp.png',
  PSI1: '/images/emploi-du-temps/psi1.png',
  PSI2: '/images/emploi-du-temps/psi2.png',
  '2ECS': '/images/emploi-du-temps/ecs2.png',
};

export function ClassWorkspacePage({
  classSlug,
  initialTab,
  initialSubject,
  onNavigate,
  onOpenClassSwitcher,
}: {
  classSlug?: string;
  initialTab?: WorkspaceTab;
  initialSubject?: string;
  onNavigate: (path: string) => void;
  onOpenClassSwitcher?: () => void;
}) {
  const { user, token, apiFetch } = useAuth();
  const { t } = useLang();
  const canUploadDocs = Boolean(user && (user.role === 'professeur' || user.role === 'admin'));
  const activeClass = useMemo(
    () => getClassDefinition(classSlug) || CAMPUS_CLASSES[0],
    [classSlug]
  );

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab || 'bibliotheque');
  const [documents, setDocuments] = useState<ClassDocument[]>([]);
  const [timetables, setTimetables] = useState<TimetableRow[]>([]);
  const [colloscopes, setColloscopes] = useState<ColloscopeRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [canAccessPrivate, setCanAccessPrivate] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [privateError, setPrivateError] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingPrivate, setLoadingPrivate] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);

  // Bibliothèque filters
  const [subjectFilter, setSubjectFilter] = useState<string>(initialSubject || 'ALL');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [docQuery, setDocQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCat, setUploadCat] = useState<DocumentCategory>('cours');
  const [uploadSubj, setUploadSubj] = useState<string>(activeClass.subjects[0]?.slug || 'mathematiques');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadChapter, setUploadChapter] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  // Colloscope filters + add form
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [trinomeFilter, setTrinomeFilter] = useState<string>('ALL');
  const [showColloForm, setShowColloForm] = useState(false);
  const [colloTrinome, setColloTrinome] = useState(1);
  const [colloSubj, setColloSubj] = useState(activeClass.subjects[0]?.slug || 'mathematiques');
  const [colloKholleur, setColloKholleur] = useState('');
  const [colloDayTime, setColloDayTime] = useState('Mardi 17h15');
  const [colloRoom, setColloRoom] = useState('K-104');

  // Timetable filters + add form
  const [semester, setSemester] = useState<'S1' | 'S2'>('S1');
  const [sessionFilter, setSessionFilter] = useState<string>('ALL');
  const [dayFilter, setDayFilter] = useState<string>('ALL');
  const todayFrench = useMemo(() => getTodayFrenchDay(), []);
  const [showTtForm, setShowTtForm] = useState(false);
  const [ttDay, setTtDay] = useState('Lundi');
  const [ttStart, setTtStart] = useState('08:00');
  const [ttEnd, setTtEnd] = useState('10:00');
  const [ttType, setTtType] = useState<TimetableRow['session_type']>('Cours');
  const [ttSubj, setTtSubj] = useState(activeClass.subjects[0]?.slug || 'mathematiques');
  const [ttRoom, setTtRoom] = useState(`Salle ${activeClass.code}-1`);

  // Announcements form
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPinned, setAnnPinned] = useState(true);

  // Real-time chat state
  const [chatInput, setChatInput] = useState('');
  const [sendAsAnnouncement, setSendAsAnnouncement] = useState(false);
  const [chatAnnTitle, setChatAnnTitle] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSubjectFilter(initialSubject || 'ALL');
    setCatFilter('ALL');
    setDocQuery('');
    setDayFilter('ALL');
    setUploadSubj(activeClass.subjects[0]?.slug || 'mathematiques');
    setColloSubj(activeClass.subjects[0]?.slug || 'mathematiques');
    setTtSubj(activeClass.subjects[0]?.slug || 'mathematiques');
    setTtRoom(`Salle ${activeClass.code}-1`);
  }, [activeClass, initialSubject]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await apiFetch(`/api/classes/${activeClass.code}/overview`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setTimetables(data.timetables || []);
        setColloscopes(data.colloscopes || []);
        setCanAccessPrivate(Boolean(data.canAccessPrivate));
        setIsModerator(Boolean(data.isModerator));
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [activeClass.code, apiFetch]);

  const loadPrivateWorkspace = useCallback(async () => {
    if (!token) {
      setPrivateError('Connectez-vous sur le Portail pour consulter les annonces officielles et le chat de classe.');
      setAnnouncements([]);
      setMessages([]);
      return;
    }
    setLoadingPrivate(true);
    setPrivateError(null);
    try {
      const res = await apiFetch(`/api/classes/${activeClass.code}/workspace-private`);
      const data = await res.json();
      if (!res.ok) {
        setPrivateError(data.error || 'Accès restreint à cette classe.');
        setAnnouncements([]);
        setMessages([]);
        return;
      }
      setAnnouncements(data.announcements || []);
      setMessages(data.messages || []);
      setIsModerator(Boolean(data.isModerator));
    } finally {
      setLoadingPrivate(false);
    }
  }, [activeClass.code, apiFetch, token]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadPrivateWorkspace();
  }, [loadPrivateWorkspace]);

  // WebSocket live connection for class chat & moderator announcements
  useEffect(() => {
    if (!token || !canAccessPrivate) {
      setWsConnected(false);
      setOnlineCount(0);
      return;
    }

    let closed = false;
    let reconnectTimer: number | undefined;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            type: 'auth',
            token,
            classCode: activeClass.code,
          })
        );
      };

      ws.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as { event: string; payload: unknown };
          if (parsed.event === 'auth:ok') {
            setWsConnected(true);
          } else if (parsed.event === 'presence:update') {
            const p = parsed.payload as { classCode: string; onlineCount: number };
            if (p.classCode === activeClass.code) setOnlineCount(p.onlineCount);
          } else if (parsed.event === 'message:created') {
            const msg = parsed.payload as ChatMessageRow;
            setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          } else if (parsed.event === 'announcement:created') {
            const ann = parsed.payload as AnnouncementRow;
            setAnnouncements((prev) =>
              prev.some((a) => a.id === ann.id) ? prev : [ann, ...prev]
            );
          } else if (parsed.event === 'announcement:updated') {
            const ann = parsed.payload as AnnouncementRow;
            setAnnouncements((prev) => prev.map((a) => (a.id === ann.id ? ann : a)));
          } else if (parsed.event === 'announcement:deleted') {
            const { id } = parsed.payload as { id: number };
            setAnnouncements((prev) => prev.filter((a) => a.id !== id));
          }
        } catch {
          // Ignore malformed WS frames
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [activeClass.code, canAccessPrivate, token]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeTab]);

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (subjectFilter !== 'ALL' && d.subject_slug !== subjectFilter) return false;
      if (catFilter !== 'ALL' && d.category !== catFilter) return false;
      if (docQuery.trim()) {
        const q = docQuery.toLowerCase();
        if (
          !d.title.toLowerCase().includes(q) &&
          !d.chapter.toLowerCase().includes(q) &&
          !d.description.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [documents, subjectFilter, catFilter, docQuery]);

  const officialColloscopeDoc = useMemo(
    () => documents.find((d) => d.category === 'colloscopes') || null,
    [documents]
  );

  const filteredColloscope = useMemo(() => {
    return colloscopes.filter((row) => {
      if (row.week_number !== selectedWeek) return false;
      if (trinomeFilter !== 'ALL' && String(row.trinome_number) !== trinomeFilter) return false;
      return true;
    });
  }, [colloscopes, selectedWeek, trinomeFilter]);

  const filteredTimetable = useMemo(() => {
    return timetables.filter((row) => {
      if (row.semester !== semester) return false;
      if (sessionFilter !== 'ALL' && row.session_type !== sessionFilter) return false;
      return true;
    });
  }, [timetables, semester, sessionFilter]);

  const latestPinnedModeratorAnnouncement = useMemo(
    () => announcements.find((a) => a.is_pinned === 1) || null,
    [announcements]
  );

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) {
      setUploadErr('Sélectionnez un PDF et saisissez un titre.');
      return;
    }
    setUploadErr(null);
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('classCode', activeClass.code);
    fd.append('category', uploadCat);
    fd.append('subjectSlug', uploadSubj);
    fd.append('title', uploadTitle.trim());
    fd.append('chapter', uploadChapter.trim());
    const res = await apiFetch('/api/documents/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      setUploadErr(data.error || 'Échec du dépôt.');
      return;
    }
    setUploadTitle('');
    setUploadChapter('');
    setUploadFile(null);
    setShowUpload(false);
    await loadOverview();
  };

  const handleProgress = async (docId: number, status: 'a_faire' | 'en_cours' | 'maitrise') => {
    const res = await apiFetch(`/api/documents/${docId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, progress_status: status } : d)));
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    const res = await apiFetch(`/api/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  const handleAddColloscope = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjObj = activeClass.subjects.find((s) => s.slug === colloSubj);
    const res = await apiFetch(`/api/classes/${activeClass.code}/colloscope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekNumber: Number(colloTrinome ? selectedWeek : 1),
        trinomeNumber: Number(colloTrinome),
        subjectSlug: colloSubj,
        subjectName: subjObj?.name || colloSubj,
        kholleurName: colloKholleur,
        dayTime: colloDayTime,
        room: colloRoom,
      }),
    });
    if (res.ok) {
      setColloKholleur('');
      setShowColloForm(false);
      await loadOverview();
    }
  };

  const handleAddTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjObj = activeClass.subjects.find((s) => s.slug === ttSubj);
    const res = await apiFetch(`/api/classes/${activeClass.code}/timetable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        semester,
        dayOfWeek: ttDay,
        startTime: ttStart,
        endTime: ttEnd,
        sessionType: ttType,
        subjectSlug: ttSubj,
        subjectName: subjObj?.name || ttSubj,
        room: ttRoom,
      }),
    });
    if (res.ok) {
      setShowTtForm(false);
      await loadOverview();
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch(`/api/classes/${activeClass.code}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: annTitle, content: annContent, isPinned: annPinned }),
    });
    if (res.ok) {
      setAnnTitle('');
      setAnnContent('');
      await loadPrivateWorkspace();
    }
  };

  const handleTogglePin = async (ann: AnnouncementRow) => {
    await apiFetch(`/api/classes/${activeClass.code}/announcements/${ann.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned: ann.is_pinned !== 1 }),
    });
    await loadPrivateWorkspace();
  };

  const handleDeleteAnnouncement = async (id: number) => {
    await apiFetch(`/api/classes/${activeClass.code}/announcements/${id}`, {
      method: 'DELETE',
    });
    await loadPrivateWorkspace();
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatError(null);
    const res = await apiFetch(`/api/classes/${activeClass.code}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: chatInput.trim(),
        isAnnouncement: isModerator && sendAsAnnouncement,
        announcementTitle: chatAnnTitle.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setChatError(data.error || 'Envoi impossible.');
      return;
    }
    setChatInput('');
    setChatAnnTitle('');
    setSendAsAnnouncement(false);
    // Idempotent merge in case WS delivery hasn't arrived yet
    if (data.message) {
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
      );
    }
    if (data.announcement) {
      setAnnouncements((prev) =>
        prev.some((a) => a.id === data.announcement.id) ? prev : [data.announcement, ...prev]
      );
    }
  };

  const renderPrivateLockScreen = () => (
    <GlowCard className="mt-6 p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-[#a8532c]" />
      <h2 className="mt-3 font-display text-xl font-semibold text-[#a8532c]">
        Espace dynamique protégé — Classe {activeClass.code}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[#4a2e1a]/85">
        {privateError ||
          'Les annonces officielles et le chat temps réel sont réservés aux membres rattachés à cette classe, aux professeurs et à l’administration.'}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/portail')}
          className="btn-rust rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
        >
          {user ? 'Changer de compte / Portail' : 'Se connecter au portail'}
        </button>
      </div>
    </GlowCard>
  );

  const partner = PROGRESSION_PARTNER[activeClass.code];
  const supClasses = useMemo(() => CAMPUS_CLASSES.filter((c) => c.level === 'Sup'), []);
  const speClasses = useMemo(() => CAMPUS_CLASSES.filter((c) => c.level === 'Spé'), []);

  return (
    <div className="bg-[#f7ead0] text-[#4a2e1a]">
      {/* Organized Sup / Spé Class Selector Bar */}
      <nav aria-label="Classes CPGE" className="subnav">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          {/* 1ère année (Sup) */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#a8532c] whitespace-nowrap">
              {t('1ère année · Sup', 'السنة 1 · Sup')}
            </span>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-[#c98f4f]/55 bg-[#e6c58c]/50 p-1 sm:inline-flex sm:items-center">
              {supClasses.map((c) => {
                const active = c.code === activeClass.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onNavigate(`/classes/${c.code}?tab=${activeTab}`)}
                    className={`relative rounded-lg px-3.5 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      active ? 'text-[#f7ead0]' : 'text-[#4a2e1a] hover:bg-[#c98f4f]/30'
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="activeClassBar"
                        className="absolute inset-0 rounded-lg bg-[#a8532c] shadow-xs"
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                      />
                    ) : null}
                    <span className="relative z-10">{c.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2ème année (Spé) */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#a8532c] whitespace-nowrap">
              {t('2ème année · Spé', 'السنة 2 · Spé')}
            </span>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-[#c98f4f]/55 bg-[#e6c58c]/50 p-1 sm:inline-flex sm:items-center">
              {speClasses.map((c) => {
                const active = c.code === activeClass.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onNavigate(`/classes/${c.code}?tab=${activeTab}`)}
                    className={`relative rounded-lg px-3.5 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      active ? 'text-[#f7ead0]' : 'text-[#4a2e1a] hover:bg-[#c98f4f]/30'
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="activeClassBar"
                        className="absolute inset-0 rounded-lg bg-[#a8532c] shadow-xs"
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                      />
                    ) : null}
                    <span className="relative z-10">{c.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Class Header */}
        <div className="mt-2 sm:mt-4 flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-5 sm:pb-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
              {activeClass.levelLabel} · {activeClass.subjects.length} matières officielles
            </p>
            <h1 className="dune-heading mt-1.5 font-display text-2xl font-semibold tracking-tight text-[#a8532c] sm:text-4xl">
              Espace {activeClass.code} — {activeClass.filiere}
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-[#4a2e1a]/85">{activeClass.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(`/classes/${partner.target}?tab=${activeTab}`)}
              className="btn-sand inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-[#a8532c]" />
              {t(partner.label, partner.labelAr)}
            </button>
            {onOpenClassSwitcher ? (
              <button
                type="button"
                onClick={onOpenClassSwitcher}
                className="btn-sand inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 text-[#a8532c]" />
                {t('Changer / Rechercher (⌘K)', 'تغيير / بحث (⌘K)')}
              </button>
            ) : null}
            {isModerator ? (
              <div className="rounded-md border border-[#c98f4f] bg-[#e6c58c]/65 px-3 py-1.5 text-xs font-semibold text-[#4a2e1a]">
                Droits modérateur actifs ({ROLE_LABELS[user!.role]})
              </div>
            ) : null}
          </div>
        </div>

        {/* 5 Mandatory Workspace Tabs (Swipeable strip on mobile) */}
        <div className="no-scrollbar mt-5 sm:mt-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1.5 sm:flex-wrap">
          {[
            { id: 'bibliotheque' as const, label: 'Bibliothèque Pédagogique', shortLabel: 'Bibliothèque', icon: BookOpen },
            { id: 'colloscope' as const, label: 'Colloscope Interactif', shortLabel: 'Colloscope', icon: Table2 },
            { id: 'emploi-du-temps' as const, label: 'Emploi du Temps', shortLabel: 'Emploi', icon: Calendar },
            { id: 'annonces' as const, label: `Annonces (${announcements.length})`, shortLabel: `Annonces (${announcements.length})`, icon: Megaphone },
            { id: 'chat' as const, label: 'Chat de Classe', shortLabel: 'Chat', icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-lg px-3 sm:px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active ? 'text-[#f7ead0]' : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="workspaceTabHighlight"
                    className="absolute inset-0 rounded-lg bg-[#a8532c]"
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  />
                ) : null}
                <Icon
                  className={`relative z-10 h-3.5 w-3.5 ${active ? 'text-[#f7ead0]' : 'text-[#a8532c]'}`}
                />
                <span className="relative z-10 sm:hidden">{tab.shortLabel}</span>
                <span className="relative z-10 hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeClass.code}-${activeTab}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
        {/* TAB 1: BIBLIOTHÈQUE PÉDAGOGIQUE */}
        {activeTab === 'bibliotheque' ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filtrer par matière"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-3 py-2 text-xs font-medium text-[#4a2e1a]"
                >
                  <option value="ALL">Toutes les matières ({activeClass.subjects.length})</option>
                  {activeClass.subjects.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrer par catégorie"
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="rounded-lg border border-[#c98f4f] bg-[#fcf4e4] px-3 py-2 text-xs font-medium text-[#4a2e1a]"
                >
                  <option value="ALL">Tous types (Cours, TD, DS, Corrigés)</option>
                  {Object.entries(DOCUMENT_CATEGORY_LABELS)
                    .filter(([k]) => k !== 'guides')
                    .map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1 lg:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4a2e1a]/60" />
                  <input
                    type="search"
                    value={docQuery}
                    onChange={(e) => setDocQuery(e.target.value)}
                    placeholder="Chapitre ou mot-clé..."
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#fcf4e4] py-2 pl-9 pr-3 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                  />
                </div>
                {canUploadDocs ? (
                  <button
                    type="button"
                    onClick={() => setShowUpload((p) => !p)}
                    className="btn-rust inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t('Déposer Cours / TD / DS (PDF)', 'نشر درس أو تمرين (PDF)')}
                  </button>
                ) : null}
              </div>
            </div>

            {showUpload && canUploadDocs ? (
              <form
                onSubmit={handleUploadDoc}
                className="rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-5"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <select
                    value={uploadCat}
                    onChange={(e) => setUploadCat(e.target.value as DocumentCategory)}
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  >
                    <option value="cours">Cours</option>
                    <option value="td">TD</option>
                    <option value="ds">DS</option>
                    <option value="concours-blancs">Concours Blancs</option>
                    <option value="corriges">Corrigés</option>
                    <option value="colloscopes">Colloscope</option>
                  </select>
                  <select
                    value={uploadSubj}
                    onChange={(e) => setUploadSubj(e.target.value)}
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  >
                    {activeClass.subjects.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-1.5 text-xs text-[#4a2e1a]"
                  />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Titre du document"
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                  />
                  <input
                    type="text"
                    value={uploadChapter}
                    onChange={(e) => setUploadChapter(e.target.value)}
                    placeholder="Chapitre"
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                  />
                </div>
                {uploadErr ? <p className="mt-2 text-xs font-semibold text-[#a8532c]">{uploadErr}</p> : null}
                <div className="mt-3 flex justify-end">
                  <button type="submit" className="btn-rust rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer">
                    Publier dans {activeClass.code}
                  </button>
                </div>
              </form>
            ) : null}

            {/* Subject Cards Quick Index */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
              {activeClass.subjects.map((sub) => {
                const selected = subjectFilter === sub.slug;
                return (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => setSubjectFilter(selected ? 'ALL' : sub.slug)}
                    className={`rounded-xl border p-3 sm:p-3.5 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#a8532c] bg-[#e6c58c] shadow-sm'
                        : 'border-[#c98f4f]/45 bg-[#fcf4e4] hover:border-[#a8532c]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#a8532c] line-clamp-1">{sub.name}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-[#4a2e1a]/80">{sub.description}</p>
                  </button>
                );
              })}
            </div>

            {loadingOverview ? (
              <div className="h-40 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4]" />
            ) : filteredDocs.length === 0 ? (
              <div className="rounded-xl border border-[#c98f4f]/55 bg-[#fcf4e4] p-10 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-[#a8532c]">
                  Coming soon · {t('À venir', 'قريباً')}
                </p>
                <h3 className="mt-2 font-display text-xl font-semibold text-[#4a2e1a]">
                  {t(
                    `Coming soon — Cours, TD et DS (${activeClass.code})`,
                    `قريباً — الدروس، التمارين والفروض (${activeClass.code})`
                  )}
                </h3>
                <p className="mx-auto mt-2 max-w-lg text-sm text-[#4a2e1a]/80">
                  {t(
                    'Les cours, feuilles de TD et Devoirs Surveillés de cette classe seront publiés prochainement directement par vos professeurs sur le site.',
                    'سيتم نشر الدروس وسلاسل التمارين والفروض المحروسة لهذا القسم قريباً مباشرة من طرف الأساتذة.'
                  )}
                </p>
                {canUploadDocs ? (
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="btn-rust mt-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t('Publier un Cours / TD / DS maintenant', 'نشر درس أو تمرين الآن')}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDocs.map((doc) => (
                  <GlowCard key={doc.id} className="p-5">
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#4a2e1a]/75">
                          <span className="font-semibold text-[#a8532c]">{DOCUMENT_CATEGORY_LABELS[doc.category]}</span>
                          <span className="font-mono tabular-nums">
                            {Math.max(1, Math.round(doc.file_size / 1024))} Ko
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-semibold text-[#4a2e1a]">
                          {doc.title}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-[#a8532c]">{doc.chapter}</p>
                        <p className="mt-1.5 text-xs text-[#4a2e1a]/80">{doc.description}</p>
                      </div>

                      <div className="mt-4 space-y-3 border-t border-[#c98f4f]/30 pt-3">
                        {user ? (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#4a2e1a]/75">Avancement :</span>
                            <div className="flex gap-1">
                              {(['a_faire', 'en_cours', 'maitrise'] as const).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleProgress(doc.id, st)}
                                  className={`rounded px-2 py-0.5 font-medium cursor-pointer ${
                                    (doc.progress_status || 'a_faire') === st
                                      ? 'bg-[#a8532c] text-[#f7ead0]'
                                      : 'text-[#4a2e1a]/75 hover:bg-[#e6c58c]/60 hover:text-[#4a2e1a]'
                                  }`}
                                >
                                  {st === 'a_faire' ? 'À faire' : st === 'en_cours' ? 'En cours' : 'Maîtrisé'}
                                </button>
                              ))}
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
                            className="btn-rust inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </a>
                          {canUploadDocs ? (
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
              </div>
            )}
          </div>
        ) : null}

        {/* TAB 2: COLLOSCOPE INTERACTIF */}
        {activeTab === 'colloscope' ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1">
                    {[1, 2, 3, 4].map((wk) => (
                      <button
                        key={wk}
                        type="button"
                        onClick={() => setSelectedWeek(wk)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                          selectedWeek === wk
                            ? 'bg-[#a8532c] text-[#f7ead0]'
                            : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                        }`}
                      >
                        Semaine {wk}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1">
                    <button
                      type="button"
                      onClick={() => setTrinomeFilter('ALL')}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        trinomeFilter === 'ALL'
                          ? 'bg-[#a8532c] text-[#f7ead0]'
                          : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                      }`}
                    >
                      Tous
                    </button>
                    {[1, 2, 3, 4, 5, 6].map((tr) => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => setTrinomeFilter(trinomeFilter === String(tr) ? 'ALL' : String(tr))}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-mono font-medium cursor-pointer transition-colors ${
                          trinomeFilter === String(tr)
                            ? 'bg-[#a8532c] text-[#f7ead0]'
                            : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                        }`}
                      >
                        T{tr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {officialColloscopeDoc ? (
                    <a
                      href={officialColloscopeDoc.file_path}
                      download
                      className="btn-sand inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Colloscope PDF
                    </a>
                  ) : null}
                  {isModerator ? (
                    <button
                      type="button"
                      onClick={() => setShowColloForm((p) => !p)}
                      className="btn-rust inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter créneau
                    </button>
                  ) : null}
                </div>
              </div>

              {showColloForm && isModerator ? (
                <form
                  onSubmit={handleAddColloscope}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-5 sm:grid-cols-5"
                >
                  <select
                    value={colloTrinome}
                    onChange={(e) => setColloTrinome(Number(e.target.value))}
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => (
                      <option key={t} value={t}>
                        Trinôme {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={colloSubj}
                    onChange={(e) => setColloSubj(e.target.value)}
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  >
                    {activeClass.subjects.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={colloKholleur}
                    onChange={(e) => setColloKholleur(e.target.value)}
                    placeholder="Nom du khôlleur"
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  />
                  <input
                    type="text"
                    required
                    value={colloDayTime}
                    onChange={(e) => setColloDayTime(e.target.value)}
                    placeholder="Jour & heure"
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={colloRoom}
                      onChange={(e) => setColloRoom(e.target.value)}
                      placeholder="Salle"
                      className="w-24 rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                    />
                    <button type="submit" className="btn-rust flex-1 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer">
                      OK
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Official Class Colloscope Visual & Colle Remark */}
              <div className="rounded-xl border border-[#c98f4f]/50 bg-[#fcf4e4] p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-[#a8532c]">
                    {t(
                      `Colloscope officiel — ${activeClass.code}`,
                      `جدول الكولوسكوب الرسمي — ${activeClass.code}`
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        src: COLLOSCOPE_IMAGES[activeClass.code],
                        title: `Colloscope officiel — ${activeClass.code}`,
                        caption: `Semaine ${selectedWeek} · Cliquez sur + / - pour zoomer`,
                      })
                    }
                    className="btn-sand inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <ZoomIn className="h-3.5 w-3.5 text-[#a8532c]" />
                    {t('Zoom interactif', 'تكبير تفاعلي')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxImage({
                      src: COLLOSCOPE_IMAGES[activeClass.code],
                      title: `Colloscope officiel — ${activeClass.code}`,
                      caption: `Semaine ${selectedWeek} · Cliquez sur + / - pour zoomer`,
                    })
                  }
                  className="group relative block w-full overflow-hidden rounded-lg border border-[#c98f4f]/40 cursor-zoom-in"
                >
                  <img
                    src={COLLOSCOPE_IMAGES[activeClass.code]}
                    alt={`Colloscope ${activeClass.code}`}
                    className="w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                </button>
                <p className="mt-3 text-xs leading-relaxed text-[#a8532c] font-medium">
                  {t(
                    '* Remarque : La colle en CPGE est un examen oral organisé en petits groupes pour évaluer la compréhension des cours et la capacité des étudiants à résoudre des exercices devant un professeur au tableau.',
                    '* ملاحظة: الكول (Colle) في الأقسام التحضيرية هو امتحان شفوي يُجرى في مجموعات صغيرة لتقييم فهم الدروس وقدرة الطلبة على حل التمارين أمام الأستاذ على السبورة.'
                  )}
                </p>
              </div>

              {loadingOverview ? (
                <div className="h-44 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4]" />
              ) : (
                <>
                  {/* Mobile Card List */}
                  <div className="space-y-2.5 sm:hidden">
                    {filteredColloscope.map((row) => (
                      <div
                        key={row.id}
                        onClick={() =>
                          setTrinomeFilter((prev) =>
                            prev === String(row.trinome_number) ? 'ALL' : String(row.trinome_number)
                          )
                        }
                        className="rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-3.5 cursor-pointer active:bg-[#e6c58c]/35"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-bold text-[#a8532c] tabular-nums">
                            Trinôme {row.trinome_number}
                          </span>
                          <span className="font-mono font-semibold text-[#a8532c]">{row.room}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#4a2e1a]">{row.subject_name}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-[#4a2e1a]/80">
                          <span>{row.kholleur_name}</span>
                          <span className="font-mono tabular-nums">{row.day_time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-[#c98f4f] bg-[#fcf4e4]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#c98f4f]/50 bg-[#e6c58c]/55 text-[#4a2e1a]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Trinôme</th>
                          <th className="px-4 py-3 font-semibold">Matière</th>
                          <th className="px-4 py-3 font-semibold">Khôlleur</th>
                          <th className="px-4 py-3 font-semibold">Créneau</th>
                          <th className="px-4 py-3 font-semibold">Salle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c98f4f]/30">
                        {filteredColloscope.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() =>
                              setTrinomeFilter((prev) =>
                                prev === String(row.trinome_number) ? 'ALL' : String(row.trinome_number)
                              )
                            }
                            title="Cliquez pour filtrer ce trinôme"
                            className="cursor-pointer hover:bg-[#e6c58c]/35 transition-colors"
                          >
                            <td className="px-4 py-3 font-mono font-semibold text-[#a8532c] tabular-nums">
                              Trinôme {row.trinome_number}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#4a2e1a]">{row.subject_name}</td>
                            <td className="px-4 py-3 text-[#4a2e1a]/80">{row.kholleur_name}</td>
                            <td className="px-4 py-3 font-mono font-medium text-[#4a2e1a] tabular-nums">{row.day_time}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-[#a8532c]">{row.room}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
        ) : null}

        {/* TAB 3: EMPLOI DU TEMPS ANNUEL */}
        {activeTab === 'emploi-du-temps' ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1">
                    {(['S1', 'S2'] as const).map((sem) => (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => setSemester(sem)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                          semester === sem
                            ? 'bg-[#a8532c] text-[#f7ead0]'
                            : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                        }`}
                      >
                        Semestre {sem === 'S1' ? '1' : '2'}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1">
                    {(['ALL', 'Cours', 'TD', 'TP', 'DS', 'Concours Blanc'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSessionFilter(st)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                          sessionFilter === st
                            ? 'bg-[#a8532c] text-[#f7ead0]'
                            : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                        }`}
                      >
                        {st === 'ALL' ? 'Toutes séances' : st}
                      </button>
                    ))}
                  </div>
                </div>

                {isModerator ? (
                  <button
                    type="button"
                    onClick={() => setShowTtForm((p) => !p)}
                    className="btn-rust inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter séance
                  </button>
                ) : null}
              </div>

              {showTtForm && isModerator ? (
                <form
                  onSubmit={handleAddTimetable}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-5 sm:grid-cols-6"
                >
                  <select
                    value={ttDay}
                    onChange={(e) => setTtDay(e.target.value)}
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  >
                    {DAYS_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={ttStart}
                    onChange={(e) => setTtStart(e.target.value)}
                    placeholder="08:00"
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 font-mono text-xs text-[#4a2e1a]"
                  />
                  <input
                    type="text"
                    required
                    value={ttEnd}
                    onChange={(e) => setTtEnd(e.target.value)}
                    placeholder="10:00"
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 font-mono text-xs text-[#4a2e1a]"
                  />
                  <select
                    value={ttType}
                    onChange={(e) => setTtType(e.target.value as TimetableRow['session_type'])}
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  >
                    {['Cours', 'TD', 'TP', 'DS', 'Concours Blanc'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ttSubj}
                    onChange={(e) => setTtSubj(e.target.value)}
                    className="rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  >
                    {activeClass.subjects.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={ttRoom}
                      onChange={(e) => setTtRoom(e.target.value)}
                      placeholder="Salle"
                      className="w-24 rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                    />
                    <button type="submit" className="btn-rust flex-1 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer">
                      OK
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Official Class Timetable Visual & RCL Remark */}
              <div className="rounded-xl border border-[#c98f4f]/50 bg-[#fcf4e4] p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-[#a8532c]">
                    {t(
                      `Emploi du temps officiel — ${activeClass.code}`,
                      `جدول الحصص الرسمي — ${activeClass.code}`
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        src: EMPLOI_IMAGES[activeClass.code],
                        title: `Emploi du temps officiel — ${activeClass.code}`,
                        caption: `Semestre ${semester === 'S1' ? '1' : '2'} · Cliquez sur + / - pour zoomer`,
                      })
                    }
                    className="btn-sand inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <ZoomIn className="h-3.5 w-3.5 text-[#a8532c]" />
                    {t('Zoom interactif', 'تكبير تفاعلي')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxImage({
                      src: EMPLOI_IMAGES[activeClass.code],
                      title: `Emploi du temps officiel — ${activeClass.code}`,
                      caption: `Semestre ${semester === 'S1' ? '1' : '2'} · Cliquez sur + / - pour zoomer`,
                    })
                  }
                  className="group relative block w-full overflow-hidden rounded-lg border border-[#c98f4f]/40 cursor-zoom-in"
                >
                  <img
                    src={EMPLOI_IMAGES[activeClass.code]}
                    alt={`Emploi du temps ${activeClass.code}`}
                    className="w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                </button>
                <p className="mt-3 text-xs leading-relaxed text-[#a8532c] font-medium">
                  {t(
                    '* Remarque : Le RCL (Renforcement Culturel & Linguistique) est un ensemble de séances intégrées au programme des CPGE, visant à renforcer et à améliorer les compétences des étudiants en français. Les étudiants sont répartis en groupes selon leur niveau (G1 à G4) selon une répartition effectuée par l’administration, assurées pendant les deux premières périodes avant la reprise du français (FR) et de la culture générale (CAT).',
                    '* ملاحظة: RCL (التقوية الثقافية واللغوية) هي حصص مدمجة في برنامج الأقسام التحضيرية تهدف إلى تطوير كفاءات الطلبة في اللغة الفرنسية حسب مجموعات المستوى (G1 إلى G4).'
                  )}
                </p>
              </div>

              {/* Day Focus Selector (Swipeable on mobile) */}
              <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 sm:w-fit sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setDayFilter('ALL')}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    dayFilter === 'ALL'
                      ? 'bg-[#a8532c] text-[#f7ead0]'
                      : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                  }`}
                >
                  {t('Tous les jours', 'كل الأيام')}
                </button>
                {DAYS_ORDER.map((day) => {
                  const isToday = day === todayFrench;
                  const active = dayFilter === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setDayFilter(active ? 'ALL' : day)}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#a8532c] text-[#f7ead0]'
                          : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25'
                      }`}
                    >
                      {day}
                      {isToday ? ' · Aujourd’hui' : ''}
                    </button>
                  );
                })}
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${
                  dayFilter === 'ALL' ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-1'
                }`}
              >
                {DAYS_ORDER.filter((d) => dayFilter === 'ALL' || d === dayFilter).map((day) => {
                  const slots = filteredTimetable.filter((s) => s.day_of_week === day);
                  const isToday = day === todayFrench;
                  return (
                    <GlowCard
                      key={day}
                      className={`p-5 ${isToday ? '!border-[#a8532c] ring-1 ring-[#a8532c]/30' : ''}`}
                    >
                      <div className="flex items-center justify-between border-b-2 border-[#e6c58c] pb-2.5">
                        <h3 className="font-display text-sm font-semibold text-[#a8532c]">{day}</h3>
                        {isToday ? (
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a8532c]">
                            Aujourd’hui
                          </span>
                        ) : null}
                      </div>
                      {slots.length === 0 ? (
                        <p className="mt-3 text-xs text-[#4a2e1a]/70">Aucun créneau filtré ce jour.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {slots.map((slot) => (
                            <div
                              key={slot.id}
                              className="rounded-lg border border-[#c98f4f]/45 bg-[#f7ead0] p-3"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-semibold tabular-nums text-[#a8532c]">
                                  {slot.start_time} – {slot.end_time}
                                </span>
                                <span
                                  className={
                                    slot.session_type === 'DS' || slot.session_type === 'Concours Blanc'
                                      ? 'font-bold text-[#a8532c]'
                                      : 'font-medium text-[#4a2e1a]/75'
                                  }
                                >
                                  {slot.session_type}
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-[#4a2e1a]">
                                {slot.subject_name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#4a2e1a]/75">
                                {slot.room} · {slot.professor_name}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </GlowCard>
                  );
                })}
              </div>
            </div>
        ) : null}

        {/* TAB 4: ANNONCES DE CLASSE */}
        {activeTab === 'annonces' ? (
          !canAccessPrivate || privateError ? (
            renderPrivateLockScreen()
          ) : (
            <div className="mt-6 space-y-5">
              {isModerator ? (
                <form
                  onSubmit={handleCreateAnnouncement}
                  className="rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-5"
                >
                  <h2 className="font-display text-sm font-semibold text-[#a8532c]">
                    Publier une annonce officielle ({activeClass.code})
                  </h2>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      required
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      placeholder="Objet (ex: Changement de salle DS n°2)"
                      className="sm:col-span-2 rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-[#4a2e1a]">
                      <input
                        type="checkbox"
                        checked={annPinned}
                        onChange={(e) => setAnnPinned(e.target.checked)}
                      />
                      Épingler en priorité
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    placeholder="Consigne détaillée pour la classe..."
                    className="mt-3 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  />
                  <div className="mt-3 flex justify-end">
                    <button type="submit" className="btn-rust rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer">
                      Publier l’annonce
                    </button>
                  </div>
                </form>
              ) : null}

              {announcements.length === 0 ? (
                <div className="rounded-xl border border-[#c98f4f]/45 bg-[#fcf4e4] p-8 text-center text-sm text-[#4a2e1a]/80">
                  Aucune annonce officielle publiée dans {activeClass.code}.
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <GlowCard key={ann.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4a2e1a]/75">
                            {ann.is_pinned ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#a8532c]">
                                <Pin className="h-3 w-3" />
                                Épinglée
                              </span>
                            ) : null}
                            {ann.source_message_id ? (
                              <span className="font-semibold text-[#a8532c]">Annonce Modérateur (Chat)</span>
                            ) : null}
                            <span>
                              {ann.author_name} ({ROLE_LABELS[ann.author_role]})
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{ann.created_at.slice(0, 16)}</span>
                          </div>
                          <h3 className="mt-2 font-display text-base font-semibold text-[#4a2e1a]">
                            {ann.title}
                          </h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-[#4a2e1a]/85">{ann.content}</p>
                        </div>

                        {isModerator ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleTogglePin(ann)}
                              title={ann.is_pinned ? 'Désépingler' : 'Épingler'}
                              className="rounded-lg border border-[#c98f4f] p-2 text-[#4a2e1a] hover:bg-[#e6c58c] cursor-pointer"
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              title="Supprimer"
                              className="rounded-lg border border-[#c98f4f] p-2 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </GlowCard>
                  ))}
                </div>
              )}
            </div>
          )
        ) : null}

        {/* TAB 5: CHAT DE CLASSE TEMPS RÉEL + INTÉGRATION MODÉRATEUR */}
        {activeTab === 'chat' ? (
          !canAccessPrivate || privateError ? (
            renderPrivateLockScreen()
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-[#c98f4f] bg-[#fcf4e4]">
              {/* Live Chat Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c98f4f]/50 bg-[#e6c58c]/55 px-5 py-3.5">
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#4a2e1a]">
                    Canal temps réel · {activeClass.code}
                  </h2>
                  <p className="text-[11px] text-[#4a2e1a]/75">
                    Échanges directs entre élèves, délégués et professeurs de la classe
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      wsConnected ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  />
                  <span className="text-[#4a2e1a]">
                    {wsConnected ? `Temps réel actif · ${onlineCount} connecté(s)` : 'Reconnexion...'}
                  </span>
                </div>
              </div>

              {/* Pinned Moderator Announcement inside Chat */}
              {latestPinnedModeratorAnnouncement ? (
                <div className="border-b border-[#a8532c]/30 bg-[#e6c58c]/70 px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-[#a8532c]">
                      <Pin className="h-3.5 w-3.5 shrink-0" />
                      <span>Annonce Modérateur épinglée : {latestPinnedModeratorAnnouncement.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('annonces')}
                      className="shrink-0 text-[11px] font-semibold text-[#4a2e1a] underline cursor-pointer"
                    >
                      Voir toutes les annonces
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-[#4a2e1a]">
                    {latestPinnedModeratorAnnouncement.content}
                  </p>
                </div>
              ) : null}

              {/* Messages Feed */}
              <div className="h-[56vh] max-h-96 sm:h-96 space-y-3 overflow-y-auto bg-[#f7ead0] p-3.5 sm:p-5">
                {messages.length === 0 ? (
                  <p className="py-12 text-center text-xs text-[#4a2e1a]/70">
                    Aucun message pour le moment dans {activeClass.code}. Lancez la discussion !
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = user && msg.author_id === user.id;
                    const isModBroadcast = msg.is_announcement === 1;
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-xl border p-3.5 ${
                          isModBroadcast
                            ? 'border-[#a8532c] bg-[#e6c58c]/65'
                            : isMine
                              ? 'ml-auto max-w-2xl border-[#c98f4f] bg-[#fcf4e4]'
                              : 'max-w-2xl border-[#c98f4f]/45 bg-[#fcf4e4]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#4a2e1a]">{msg.author_name}</span>
                            <span className="text-[#4a2e1a]/70">{ROLE_LABELS[msg.author_role]}</span>
                            {isModBroadcast ? (
                              <span className="rounded bg-[#a8532c] px-1.5 py-0.5 text-[10px] font-semibold text-[#f7ead0]">
                                Annonce Modérateur
                              </span>
                            ) : null}
                          </div>
                          <span className="font-mono text-[#4a2e1a]/65 tabular-nums">
                            {msg.created_at.slice(11, 16)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-[#4a2e1a]">{msg.content}</p>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Composer */}
              <form onSubmit={handleSendChat} className="space-y-3 border-t border-[#c98f4f]/50 bg-[#fcf4e4] p-4">
                {isModerator ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-[#c98f4f]/50 bg-[#f7ead0] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#4a2e1a]">
                      <input
                        type="checkbox"
                        checked={sendAsAnnouncement}
                        onChange={(e) => setSendAsAnnouncement(e.target.checked)}
                      />
                      <span>
                        Publier en tant qu’<strong className="text-[#a8532c]">Annonce Modérateur</strong>{' '}
                        (épingle dans le chat et synchronise avec Annonces de Classe)
                      </span>
                    </label>
                    {sendAsAnnouncement ? (
                      <input
                        type="text"
                        value={chatAnnTitle}
                        onChange={(e) => setChatAnnTitle(e.target.value)}
                        placeholder="Titre de l’annonce (optionnel)"
                        className="rounded border border-[#c98f4f] bg-[#fcf4e4] px-2.5 py-1 text-xs text-[#4a2e1a]"
                      />
                    ) : null}
                  </div>
                ) : null}

                {chatError ? <p className="text-xs font-semibold text-[#a8532c]">{chatError}</p> : null}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      sendAsAnnouncement
                        ? `Diffuser une annonce officielle dans ${activeClass.code}...`
                        : `Écrire un message dans ${activeClass.code}...`
                    }
                    className="flex-1 rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3.5 py-2.5 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                  />
                  <button
                    type="submit"
                    className="btn-rust inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Envoyer
                  </button>
                </div>
              </form>
            </div>
          )
        ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <PdfPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <ImageLightboxModal image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
