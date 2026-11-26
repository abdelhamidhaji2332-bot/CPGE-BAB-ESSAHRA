import { motion } from 'framer-motion';
import {
  Calendar,
  Compass,
  Download,
  Lock,
  Megaphone,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  Table2,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { ImageLightboxModal, type LightboxImage } from '../components/ImageLightboxModal';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import {
  CAMPUS_CLASSES,
  ROLE_LABELS,
  getClassDefinition,
  type ClassCode,
  type UserRole,
} from '../shared/curriculum';

export type WorkspaceTab = 'colloscope' | 'emploi-du-temps' | 'annonces' | 'chat';

const VALID_TABS: WorkspaceTab[] = ['colloscope', 'emploi-du-temps', 'annonces', 'chat'];

function resolveWorkspaceTab(tab?: string | null): WorkspaceTab {
  return tab && (VALID_TABS as string[]).includes(tab) ? (tab as WorkspaceTab) : 'colloscope';
}

interface ClassDocument {
  id: number;
  category: string;
  file_path: string;
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
  onNavigate,
  onOpenClassSwitcher,
}: {
  classSlug?: string;
  initialTab?: WorkspaceTab;
  onNavigate: (path: string) => void;
  onOpenClassSwitcher?: () => void;
}) {
  const { user, token, apiFetch } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const activeClass = useMemo(
    () => getClassDefinition(classSlug) || CAMPUS_CLASSES[0],
    [classSlug]
  );

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => resolveWorkspaceTab(initialTab));
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
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);

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
  const canSendMessages = Boolean(
    user && user.role === 'delegue' && user.classCode === activeClass.code
  );

  useEffect(() => {
    setDayFilter('ALL');
    setColloSubj(activeClass.subjects[0]?.slug || 'mathematiques');
    setTtSubj(activeClass.subjects[0]?.slug || 'mathematiques');
    setTtRoom(`Salle ${activeClass.code}-1`);
  }, [activeClass]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(resolveWorkspaceTab(initialTab));
    }
  }, [initialTab]);

  const loadPrivateWorkspace = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        setPrivateError('Connectez-vous sur le Portail pour consulter les annonces officielles et le chat de classe.');
        setAnnouncements([]);
        setMessages([]);
        return;
      }
      setLoadingPrivate(true);
      setPrivateError(null);
      try {
        const res = await apiFetch(`/api/classes/${activeClass.code}/workspace-private`, { signal });
        const data = await res.json();
        if (signal?.aborted) return;
        if (!res.ok) {
          setPrivateError(data.error || 'Accès restreint à cette classe.');
          setAnnouncements([]);
          setMessages([]);
          return;
        }
        setAnnouncements(data.announcements || []);
        setMessages(data.messages || []);
        setIsModerator(Boolean(data.isModerator));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!signal?.aborted) {
          setPrivateError('Impossible de charger l’espace privé de cette classe pour le moment.');
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingPrivate(false);
        }
      }
    },
    [activeClass.code, apiFetch, token]
  );

  const loadOverview = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingOverview(true);
      try {
        const res = await apiFetch(`/api/classes/${activeClass.code}/overview`, { signal });
        if (!res.ok) {
          if (!signal?.aborted) {
            toast.error(t(`Impossible de charger l’espace ${activeClass.code}.`, `تعذر تحميل فضاء ${activeClass.code}.`));
          }
          return;
        }
        const data = await res.json();
        if (signal?.aborted) return;
        const hasPrivateAccess = Boolean(data.canAccessPrivate);
        setDocuments(data.documents || []);
        setTimetables(data.timetables || []);
        setColloscopes(data.colloscopes || []);
        setCanAccessPrivate(hasPrivateAccess);
        setIsModerator(Boolean(data.isModerator));

        if (hasPrivateAccess && token) {
          await loadPrivateWorkspace(signal);
        } else {
          setAnnouncements([]);
          setMessages([]);
          setPrivateError(
            token
              ? 'Accès restreint à cette classe.'
              : 'Connectez-vous sur le Portail pour consulter les annonces officielles et le chat de classe.'
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!signal?.aborted) {
          toast.error(t('Erreur réseau lors du chargement de la classe.', 'خطأ في الشبكة أثناء تحميل القسم.'));
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingOverview(false);
        }
      }
    },
    [activeClass.code, apiFetch, loadPrivateWorkspace, t, toast, token]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview]);

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

  const handleAddColloscope = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjObj = activeClass.subjects.find((s) => s.slug === colloSubj);
    try {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Ajout au colloscope impossible.');
        return;
      }
      setColloKholleur('');
      setShowColloForm(false);
      toast.success('Créneau de khôlle ajouté au colloscope.');
      await loadOverview();
    } catch {
      toast.error('Erreur réseau lors de l’ajout au colloscope.');
    }
  };

  const handleAddTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjObj = activeClass.subjects.find((s) => s.slug === ttSubj);
    try {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Ajout du créneau impossible.');
        return;
      }
      setShowTtForm(false);
      toast.success('Séance ajoutée à l’emploi du temps.');
      await loadOverview();
    } catch {
      toast.error('Erreur réseau lors de la modification de l’emploi du temps.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/classes/${activeClass.code}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: annTitle, content: annContent, isPinned: annPinned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Publication de l’annonce impossible.');
        return;
      }
      setAnnTitle('');
      setAnnContent('');
      toast.success('Annonce officielle publiée.');
      await loadPrivateWorkspace();
    } catch {
      toast.error('Erreur réseau lors de la publication de l’annonce.');
    }
  };

  const handleTogglePin = async (ann: AnnouncementRow) => {
    try {
      const res = await apiFetch(`/api/classes/${activeClass.code}/announcements/${ann.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: ann.is_pinned !== 1 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Modification impossible.');
        return;
      }
      toast.success(ann.is_pinned === 1 ? 'Annonce désépinglée.' : 'Annonce épinglée.');
      await loadPrivateWorkspace();
    } catch {
      toast.error('Erreur réseau lors de la mise à jour.');
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    try {
      const res = await apiFetch(`/api/classes/${activeClass.code}/announcements/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Suppression impossible.');
        return;
      }
      toast.success('Annonce supprimée.');
      await loadPrivateWorkspace();
    } catch {
      toast.error('Erreur réseau lors de la suppression.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSendMessages || !chatInput.trim()) return;
    setChatError(null);
    const wasAnnouncement = isModerator && sendAsAnnouncement;
    try {
      const res = await apiFetch(`/api/classes/${activeClass.code}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: chatInput.trim(),
          isAnnouncement: wasAnnouncement,
          announcementTitle: chatAnnTitle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Envoi impossible.';
        setChatError(msg);
        toast.error(msg);
        return;
      }
      setChatInput('');
      setChatAnnTitle('');
      setSendAsAnnouncement(false);
      if (wasAnnouncement) {
        toast.success('Annonce Modérateur diffusée dans le chat et les annonces.');
      }
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
    } catch {
      const msg = 'Erreur réseau lors de l’envoi du message.';
      setChatError(msg);
      toast.error(msg);
    }
  };

  const renderPrivateLockScreen = () => (
    <GlowCard className="mt-6 p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-[#a8532c] dark:text-[#e88c5d]" />
      <h2 className="mt-3 font-display text-xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
        Espace dynamique protégé — Classe {activeClass.code}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
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
    <div className="bg-[#f7ead0] text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6]">
      {/* Organized Sup / Spé Class Selector Bar */}
      <nav aria-label="Classes CPGE" className="subnav">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3.5 py-2.5 sm:px-6 sm:py-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          {/* 1ère année (Sup) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-12 shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d] sm:w-auto sm:whitespace-nowrap">
              <span className="sm:hidden">1A · Sup</span>
              <span className="hidden sm:inline">{t('1ère année · Sup', 'السنة 1 · Sup')}</span>
            </span>
            <div className="grid flex-1 grid-cols-4 gap-1 rounded-xl border border-[#c98f4f]/55 bg-[#e6c58c]/50 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:flex-none sm:inline-flex sm:items-center">
              {supClasses.map((c) => {
                const active = c.code === activeClass.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onNavigate(`/classes/${c.code}?tab=${activeTab}`)}
                    className={`relative min-h-[36px] rounded-lg px-1.5 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer sm:min-h-0 sm:px-3.5 ${
                      active
                        ? 'text-[#f7ead0] dark:text-[#fdf6e9]'
                        : 'text-[#4a2e1a] hover:bg-[#c98f4f]/30 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="activeClassBar"
                        className="absolute inset-0 rounded-lg bg-[#a8532c] shadow-xs dark:bg-[#c25e32]"
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
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-12 shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d] sm:w-auto sm:whitespace-nowrap">
              <span className="sm:hidden">2A · Spé</span>
              <span className="hidden sm:inline">{t('2ème année · Spé', 'السنة 2 · Spé')}</span>
            </span>
            <div className="grid flex-1 grid-cols-4 gap-1 rounded-xl border border-[#c98f4f]/55 bg-[#e6c58c]/50 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:flex-none sm:inline-flex sm:items-center">
              {speClasses.map((c) => {
                const active = c.code === activeClass.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onNavigate(`/classes/${c.code}?tab=${activeTab}`)}
                    className={`relative min-h-[36px] rounded-lg px-1.5 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer sm:min-h-0 sm:px-3.5 ${
                      active
                        ? 'text-[#f7ead0] dark:text-[#fdf6e9]'
                        : 'text-[#4a2e1a] hover:bg-[#c98f4f]/30 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="activeClassBar"
                        className="absolute inset-0 rounded-lg bg-[#a8532c] shadow-xs dark:bg-[#c25e32]"
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

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Class Header */}
        <div className="mt-1 sm:mt-4 flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-5 dark:border-[#5a4634] sm:pb-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              {activeClass.levelLabel} · {activeClass.subjects.length} matières officielles
            </p>
            <h1 className="dune-heading mt-1.5 font-display text-2xl font-semibold tracking-tight text-[#a8532c] dark:text-[#e88c5d] sm:text-4xl">
              Espace {activeClass.code} — {activeClass.filiere}
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">{activeClass.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(`/classes/${partner.target}?tab=${activeTab}`)}
              className="btn-sand inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer sm:min-h-0"
            >
              <Compass className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
              {t(partner.label, partner.labelAr)}
            </button>
            {onOpenClassSwitcher ? (
              <button
                type="button"
                onClick={onOpenClassSwitcher}
                className="btn-sand inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer sm:min-h-0"
              >
                <Search className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                {t('Changer (⌘K)', 'تغيير القسم')}
              </button>
            ) : null}
            {isModerator ? (
              <div className="min-[380px]:col-span-2 sm:col-span-1 rounded-md border border-[#c98f4f] bg-[#e6c58c]/65 px-3 py-1.5 text-center text-xs font-semibold text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#27221c] dark:text-[#f5ebd6]">
                Droits modérateur actifs ({ROLE_LABELS[user!.role]})
              </div>
            ) : null}
          </div>
        </div>

        {/* 4 Workspace Tabs (Swipeable strip on mobile) */}
        <div className="no-scrollbar mt-4 sm:mt-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:p-1.5 sm:flex-wrap">
          {[
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
                className={`relative inline-flex min-h-[42px] shrink-0 items-center gap-1.5 sm:gap-2 rounded-lg px-3 sm:px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'text-[#f7ead0] dark:text-[#fdf6e9]'
                    : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="workspaceTabHighlight"
                    className="absolute inset-0 rounded-lg bg-[#a8532c] dark:bg-[#c25e32]"
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  />
                ) : null}
                <Icon
                  className={`relative z-10 h-3.5 w-3.5 ${
                    active ? 'text-[#f7ead0] dark:text-[#fdf6e9]' : 'text-[#a8532c] dark:text-[#e88c5d]'
                  }`}
                />
                <span className="relative z-10 sm:hidden">{tab.shortLabel}</span>
                <span className="relative z-10 hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div>
        {/* TAB 1: COLLOSCOPE INTERACTIF */}
        {activeTab === 'colloscope' ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c]">
                    {[1, 2, 3, 4].map((wk) => (
                      <button
                        key={wk}
                        type="button"
                        onClick={() => setSelectedWeek(wk)}
                        className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer sm:min-h-0 ${
                          selectedWeek === wk
                            ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                            : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
                        }`}
                      >
                        Semaine {wk}
                      </button>
                    ))}
                  </div>

                  <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c]">
                    <button
                      type="button"
                      onClick={() => setTrinomeFilter('ALL')}
                      className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors sm:min-h-0 ${
                        trinomeFilter === 'ALL'
                          ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                          : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
                      }`}
                    >
                      Tous
                    </button>
                    {[1, 2, 3, 4, 5, 6].map((tr) => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => setTrinomeFilter(trinomeFilter === String(tr) ? 'ALL' : String(tr))}
                        className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-mono font-medium cursor-pointer transition-colors sm:min-h-0 ${
                          trinomeFilter === String(tr)
                            ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                            : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
                        }`}
                      >
                        T{tr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {officialColloscopeDoc ? (
                    <a
                      href={officialColloscopeDoc.file_path}
                      download
                      className="btn-sand inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold sm:min-h-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Colloscope PDF
                    </a>
                  ) : null}
                  {isModerator ? (
                    <button
                      type="button"
                      onClick={() => setShowColloForm((p) => !p)}
                      className="btn-rust inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer sm:min-h-0"
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
                  className="grid grid-cols-1 gap-3 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-4 dark:border-[#5a4634] dark:bg-[#1c1916] sm:p-5 sm:grid-cols-5"
                >
                  <select
                    value={colloTrinome}
                    onChange={(e) => setColloTrinome(Number(e.target.value))}
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] sm:min-h-0"
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
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] sm:min-h-0"
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
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
                  />
                  <input
                    type="text"
                    required
                    value={colloDayTime}
                    onChange={(e) => setColloDayTime(e.target.value)}
                    placeholder="Jour & heure"
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={colloRoom}
                      onChange={(e) => setColloRoom(e.target.value)}
                      placeholder="Salle"
                      className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0 sm:w-24 sm:flex-none"
                    />
                    <button type="submit" className="btn-rust min-h-[42px] flex-1 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer sm:min-h-0">
                      OK
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Official Class Colloscope Visual & Colle Remark */}
              <div className="rounded-xl border border-[#c98f4f]/50 bg-[#fcf4e4] p-4 dark:border-[#5a4634] dark:bg-[#1c1916] sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-[#a8532c] dark:text-[#e88c5d]">
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
                    <ZoomIn className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
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
                  className="group relative block w-full overflow-hidden rounded-lg border border-[#c98f4f]/40 dark:border-[#5a4634] cursor-zoom-in"
                >
                  <img
                    src={COLLOSCOPE_IMAGES[activeClass.code]}
                    alt={`Colloscope ${activeClass.code}`}
                    className="w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                </button>
                <p className="mt-3 text-xs leading-relaxed text-[#a8532c] dark:text-[#e88c5d] font-medium">
                  {t(
                    '* Remarque : La colle en CPGE est un examen oral organisé en petits groupes pour évaluer la compréhension des cours et la capacité des étudiants à résoudre des exercices devant un professeur au tableau.',
                    '* ملاحظة: الكول (Colle) في الأقسام التحضيرية هو امتحان شفوي يُجرى في مجموعات صغيرة لتقييم فهم الدروس وقدرة الطلبة على حل التمارين أمام الأستاذ على السبورة.'
                  )}
                </p>
              </div>

              {loadingOverview ? (
                <div className="h-44 animate-pulse rounded-xl border border-[#c98f4f]/40 bg-[#fcf4e4] dark:border-[#5a4634] dark:bg-[#1c1916]" />
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
                        className="rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-3.5 cursor-pointer active:bg-[#e6c58c]/35 dark:border-[#5a4634] dark:bg-[#1c1916] dark:active:bg-[#27221c]"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-bold text-[#a8532c] dark:text-[#e88c5d] tabular-nums">
                            Trinôme {row.trinome_number}
                          </span>
                          <span className="font-mono font-semibold text-[#a8532c] dark:text-[#e88c5d]">{row.room}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">{row.subject_name}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                          <span>{row.kholleur_name}</span>
                          <span className="font-mono tabular-nums">{row.day_time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-[#c98f4f] bg-[#fcf4e4] dark:border-[#5a4634] dark:bg-[#1c1916]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#c98f4f]/50 bg-[#e6c58c]/55 text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#27221c] dark:text-[#f5ebd6]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Trinôme</th>
                          <th className="px-4 py-3 font-semibold">Matière</th>
                          <th className="px-4 py-3 font-semibold">Khôlleur</th>
                          <th className="px-4 py-3 font-semibold">Créneau</th>
                          <th className="px-4 py-3 font-semibold">Salle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c98f4f]/30 dark:divide-[#423428]">
                        {filteredColloscope.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() =>
                              setTrinomeFilter((prev) =>
                                prev === String(row.trinome_number) ? 'ALL' : String(row.trinome_number)
                              )
                            }
                            title="Cliquez pour filtrer ce trinôme"
                            className="cursor-pointer hover:bg-[#e6c58c]/35 dark:hover:bg-[#27221c] transition-colors"
                          >
                            <td className="px-4 py-3 font-mono font-semibold text-[#a8532c] dark:text-[#e88c5d] tabular-nums">
                              Trinôme {row.trinome_number}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">{row.subject_name}</td>
                            <td className="px-4 py-3 text-[#4a2e1a]/80 dark:text-[#e3d4b7]">{row.kholleur_name}</td>
                            <td className="px-4 py-3 font-mono font-medium text-[#4a2e1a] dark:text-[#f5ebd6] tabular-nums">{row.day_time}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-[#a8532c] dark:text-[#e88c5d]">{row.room}</td>
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
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="inline-flex w-fit items-center gap-1 rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c]">
                    {(['S1', 'S2'] as const).map((sem) => (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => setSemester(sem)}
                        className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer sm:min-h-0 ${
                          semester === sem
                            ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                            : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
                        }`}
                      >
                        Semestre {sem === 'S1' ? '1' : '2'}
                      </button>
                    ))}
                  </div>

                  <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c]">
                    {(['ALL', 'Cours', 'TD', 'TP', 'DS', 'Concours Blanc'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSessionFilter(st)}
                        className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer sm:min-h-0 ${
                          sessionFilter === st
                            ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                            : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
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
                    className="btn-rust inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer sm:min-h-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter séance
                  </button>
                ) : null}
              </div>

              {showTtForm && isModerator ? (
                <form
                  onSubmit={handleAddTimetable}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-4 dark:border-[#5a4634] dark:bg-[#1c1916] sm:p-5 sm:grid-cols-6"
                >
                  <select
                    value={ttDay}
                    onChange={(e) => setTtDay(e.target.value)}
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] sm:min-h-0"
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
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 font-mono text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
                  />
                  <input
                    type="text"
                    required
                    value={ttEnd}
                    onChange={(e) => setTtEnd(e.target.value)}
                    placeholder="10:00"
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 font-mono text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
                  />
                  <select
                    value={ttType}
                    onChange={(e) => setTtType(e.target.value as TimetableRow['session_type'])}
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] sm:min-h-0"
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
                    className="min-h-[42px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] sm:min-h-0"
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
                      className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0 sm:w-24 sm:flex-none"
                    />
                    <button type="submit" className="btn-rust min-h-[42px] flex-1 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer sm:min-h-0">
                      OK
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Official Class Timetable Visual & RCL Remark */}
              <div className="rounded-xl border border-[#c98f4f]/50 bg-[#fcf4e4] p-4 dark:border-[#5a4634] dark:bg-[#1c1916] sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-[#a8532c] dark:text-[#e88c5d]">
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
                    <ZoomIn className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
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
                  className="group relative block w-full overflow-hidden rounded-lg border border-[#c98f4f]/40 dark:border-[#5a4634] cursor-zoom-in"
                >
                  <img
                    src={EMPLOI_IMAGES[activeClass.code]}
                    alt={`Emploi du temps ${activeClass.code}`}
                    className="w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                </button>
                <p className="mt-3 text-xs leading-relaxed text-[#a8532c] dark:text-[#e88c5d] font-medium">
                  {t(
                    '* Remarque : Le RCL (Renforcement Culturel & Linguistique) est un ensemble de séances intégrées au programme des CPGE, visant à renforcer et à améliorer les compétences des étudiants en français. Les étudiants sont répartis en groupes selon leur niveau (G1 à G4) selon une répartition effectuée par l’administration, assurées pendant les deux premières périodes avant la reprise du français (FR) et de la culture générale (CAT).',
                    '* ملاحظة: RCL (التقوية الثقافية واللغوية) هي حصص مدمجة في برنامج الأقسام التحضيرية تهدف إلى تطوير كفاءات الطلبة في اللغة الفرنسية حسب مجموعات المستوى (G1 إلى G4).'
                  )}
                </p>
              </div>

              {/* Day Focus Selector (Swipeable on mobile) */}
              <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#c98f4f]/50 bg-[#e6c58c]/55 p-1 dark:border-[#5a4634] dark:bg-[#27221c] sm:w-fit sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setDayFilter('ALL')}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    dayFilter === 'ALL'
                      ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                      : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
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
                          ? 'bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]'
                          : 'text-[#4a2e1a] hover:bg-[#c98f4f]/25 dark:text-[#f5ebd6] dark:hover:bg-[#332b23]'
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
                      className={`p-5 ${isToday ? '!border-[#a8532c] ring-1 ring-[#a8532c]/30 dark:!border-[#e88c5d] dark:ring-[#e88c5d]/30' : ''}`}
                    >
                      <div className="flex items-center justify-between border-b-2 border-[#e6c58c] pb-2.5 dark:border-[#5a4634]">
                        <h3 className="font-display text-sm font-semibold text-[#a8532c] dark:text-[#e88c5d]">{day}</h3>
                        {isToday ? (
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                            Aujourd’hui
                          </span>
                        ) : null}
                      </div>
                      {slots.length === 0 ? (
                        <p className="mt-3 text-xs text-[#4a2e1a]/70 dark:text-[#c8b696]">Aucun créneau filtré ce jour.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {slots.map((slot) => (
                            <div
                              key={slot.id}
                              className="rounded-lg border border-[#c98f4f]/45 bg-[#f7ead0] p-3 dark:border-[#423428] dark:bg-[#26211c]"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-semibold tabular-nums text-[#a8532c] dark:text-[#e88c5d]">
                                  {slot.start_time} – {slot.end_time}
                                </span>
                                <span
                                  className={
                                    slot.session_type === 'DS' || slot.session_type === 'Concours Blanc'
                                      ? 'font-bold text-[#a8532c] dark:text-[#e88c5d]'
                                      : 'font-medium text-[#4a2e1a]/75 dark:text-[#c8b696]'
                                  }
                                >
                                  {slot.session_type}
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                                {slot.subject_name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#4a2e1a]/75 dark:text-[#c8b696]">
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
                  className="rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-5 dark:border-[#5a4634] dark:bg-[#1c1916]"
                >
                  <h2 className="font-display text-sm font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                    Publier une annonce officielle ({activeClass.code})
                  </h2>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      required
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      placeholder="Objet (ex: Changement de salle DS n°2)"
                      className="sm:col-span-2 rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-[#4a2e1a] dark:text-[#f5ebd6]">
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
                    className="mt-3 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                  <div className="mt-3 flex justify-end">
                    <button type="submit" className="btn-rust rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer">
                      Publier l’annonce
                    </button>
                  </div>
                </form>
              ) : null}

              {announcements.length === 0 ? (
                <div className="rounded-xl border border-[#c98f4f]/45 bg-[#fcf4e4] p-8 text-center text-sm text-[#4a2e1a]/80 dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#e3d4b7]">
                  Aucune annonce officielle publiée dans {activeClass.code}.
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <GlowCard key={ann.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">
                            {ann.is_pinned ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                                <Pin className="h-3 w-3" />
                                Épinglée
                              </span>
                            ) : null}
                            {ann.source_message_id ? (
                              <span className="font-semibold text-[#a8532c] dark:text-[#e88c5d]">Annonce Modérateur (Chat)</span>
                            ) : null}
                            <span>
                              {ann.author_name} ({ROLE_LABELS[ann.author_role]})
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{ann.created_at.slice(0, 16)}</span>
                          </div>
                          <h3 className="mt-2 font-display text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                            {ann.title}
                          </h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-[#4a2e1a]/85 dark:text-[#e3d4b7]">{ann.content}</p>
                        </div>

                        {isModerator ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleTogglePin(ann)}
                              title={ann.is_pinned ? 'Désépingler' : 'Épingler'}
                              className="rounded-lg border border-[#c98f4f] p-2 text-[#4a2e1a] hover:bg-[#e6c58c] dark:border-[#5a4634] dark:text-[#f5ebd6] dark:hover:bg-[#332b23] cursor-pointer"
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              title="Supprimer"
                              className="rounded-lg border border-[#c98f4f] p-2 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] dark:border-[#5a4634] dark:text-[#e88c5d] dark:hover:bg-[#c25e32] dark:hover:text-[#fdf6e9] cursor-pointer"
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
            <div className="mt-6 overflow-hidden rounded-xl border border-[#c98f4f] bg-[#fcf4e4] dark:border-[#5a4634] dark:bg-[#1c1916]">
              {/* Live Chat Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c98f4f]/50 bg-[#e6c58c]/55 px-5 py-3.5 dark:border-[#5a4634] dark:bg-[#27221c]">
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                    Canal temps réel · {activeClass.code}
                  </h2>
                  <p className="text-[11px] text-[#4a2e1a]/75 dark:text-[#c8b696]">
                    Canal de diffusion de la classe · Envoi réservé au délégué de classe
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      wsConnected ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  />
                  <span className="text-[#4a2e1a] dark:text-[#f5ebd6]">
                    {wsConnected ? `Temps réel actif · ${onlineCount} connecté(s)` : 'Reconnexion...'}
                  </span>
                </div>
              </div>

              {/* Pinned Moderator Announcement inside Chat */}
              {latestPinnedModeratorAnnouncement ? (
                <div className="border-b border-[#a8532c]/30 bg-[#e6c58c]/70 px-5 py-3 dark:border-[#e88c5d]/30 dark:bg-[#2b221a]">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                      <Pin className="h-3.5 w-3.5 shrink-0" />
                      <span>Annonce Modérateur épinglée : {latestPinnedModeratorAnnouncement.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('annonces')}
                      className="shrink-0 text-[11px] font-semibold text-[#4a2e1a] dark:text-[#f5ebd6] underline cursor-pointer"
                    >
                      Voir toutes les annonces
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-[#4a2e1a] dark:text-[#e3d4b7]">
                    {latestPinnedModeratorAnnouncement.content}
                  </p>
                </div>
              ) : null}

              {/* Messages Feed */}
              <div className="h-[min(56dvh,420px)] space-y-3 overflow-y-auto bg-[#f7ead0] p-3.5 dark:bg-[#12100e] sm:h-96 sm:p-5">
                {messages.length === 0 ? (
                  <p className="py-12 text-center text-xs text-[#4a2e1a]/70 dark:text-[#c8b696]">
                    Aucun message pour le moment dans {activeClass.code}.
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
                            ? 'border-[#a8532c] bg-[#e6c58c]/65 dark:border-[#e88c5d] dark:bg-[#2b221a]'
                            : isMine
                              ? 'ms-auto max-w-2xl border-[#c98f4f] bg-[#fcf4e4] dark:border-[#7c5c3e] dark:bg-[#26211c]'
                              : 'max-w-2xl border-[#c98f4f]/45 bg-[#fcf4e4] dark:border-[#423428] dark:bg-[#1c1916]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">{msg.author_name}</span>
                            <span className="text-[#4a2e1a]/70 dark:text-[#c8b696]">{ROLE_LABELS[msg.author_role]}</span>
                            {isModBroadcast ? (
                              <span className="rounded bg-[#a8532c] px-1.5 py-0.5 text-[10px] font-semibold text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]">
                                Annonce Modérateur
                              </span>
                            ) : null}
                          </div>
                          <span className="font-mono text-[#4a2e1a]/65 dark:text-[#b5a383] tabular-nums">
                            {msg.created_at.slice(11, 16)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-[#4a2e1a] dark:text-[#f5ebd6]">{msg.content}</p>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Composer (Delegue only) */}
              {canSendMessages ? (
                <form onSubmit={handleSendChat} className="space-y-3 border-t border-[#c98f4f]/50 bg-[#fcf4e4] p-3.5 dark:border-[#5a4634] dark:bg-[#1c1916] sm:p-4">
                  {isModerator ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-[#c98f4f]/50 bg-[#f7ead0] px-3 py-2 dark:border-[#5a4634] dark:bg-[#26211c] sm:flex-row sm:items-center sm:justify-between">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#4a2e1a] dark:text-[#f5ebd6]">
                        <input
                          type="checkbox"
                          checked={sendAsAnnouncement}
                          onChange={(e) => setSendAsAnnouncement(e.target.checked)}
                        />
                        <span>
                          Publier en tant qu’<strong className="text-[#a8532c] dark:text-[#e88c5d]">Annonce Modérateur</strong>{' '}
                          (épingle dans le chat et synchronise avec Annonces de Classe)
                        </span>
                      </label>
                      {sendAsAnnouncement ? (
                        <input
                          type="text"
                          value={chatAnnTitle}
                          onChange={(e) => setChatAnnTitle(e.target.value)}
                          placeholder="Titre de l’annonce (optionnel)"
                          className="rounded border border-[#c98f4f] bg-[#fcf4e4] px-2.5 py-1 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {chatError ? <p className="text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d]">{chatError}</p> : null}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={
                        sendAsAnnouncement
                          ? `Diffuser une annonce dans ${activeClass.code}...`
                          : `Écrire dans ${activeClass.code}...`
                      }
                      className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3.5 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                    />
                    <button
                      type="submit"
                      aria-label="Envoyer"
                      className="btn-rust inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 text-xs font-semibold cursor-pointer sm:px-4"
                    >
                      <Send className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden min-[380px]:inline">Envoyer</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-2.5 border-t border-[#c98f4f]/50 bg-[#fcf4e4] px-4 py-3.5 text-xs text-[#4a2e1a]/80 dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#e3d4b7]">
                  <Lock className="h-4 w-4 shrink-0 text-[#a8532c] dark:text-[#e88c5d]" />
                  <span>
                    Seul le <strong>délégué de la classe ({activeClass.code})</strong> est autorisé à envoyer des messages dans ce canal. Les élèves consultent les messages en lecture seule.
                  </span>
                </div>
              )}
            </div>
          )
        ) : null}
        </div>
      </div>

      <ImageLightboxModal image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
