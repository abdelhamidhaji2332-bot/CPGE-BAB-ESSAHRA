import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

export type NotificationKind =
  | 'document'
  | 'announcement'
  | 'message'
  | 'timetable'
  | 'colloscope'
  | 'assignment';

export type WorkspaceTabTarget =
  | 'bibliotheque'
  | 'colloscope'
  | 'emploi-du-temps'
  | 'annonces'
  | 'chat';

export interface ClassNotificationItem {
  id: number;
  class_code: string;
  kind: NotificationKind;
  title: string;
  tab_target: WorkspaceTabTarget;
  actor_id: number | null;
  created_at: string;
}

interface ClassNotificationsContextValue {
  classCode: string | null;
  unreadCount: number;
  byTab: Record<WorkspaceTabTarget, number>;
  items: ClassNotificationItem[];
  refreshNotifications: () => Promise<void>;
  markAsRead: () => Promise<void>;
}

const EMPTY_BY_TAB: Record<WorkspaceTabTarget, number> = {
  bibliotheque: 0,
  colloscope: 0,
  'emploi-du-temps': 0,
  annonces: 0,
  chat: 0,
};

const ClassNotificationsContext = createContext<ClassNotificationsContextValue | null>(null);

export function ClassNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, token, apiFetch } = useAuth();
  const classCode = user?.classCode ?? null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [byTab, setByTab] = useState<Record<WorkspaceTabTarget, number>>(EMPTY_BY_TAB);
  const [items, setItems] = useState<ClassNotificationItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const refreshNotifications = useCallback(async () => {
    if (!token || !classCode) {
      setUnreadCount(0);
      setByTab({ ...EMPTY_BY_TAB });
      setItems([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/classes/${classCode}/notifications`);
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(Number(data.unreadCount || 0));
        setByTab({ ...EMPTY_BY_TAB, ...(data.byTab || {}) });
        setItems((data.items || []) as ClassNotificationItem[]);
      }
    } catch {
      // Non-blocking background sync
    }
  }, [apiFetch, classCode, token]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  // Live WebSocket listener for the student's specific class workspace across all pages
  useEffect(() => {
    if (!token || !classCode || !user) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token, classCode }));
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as {
            event: string;
            payload: ClassNotificationItem;
          };
          if (parsed.event === 'workspace:activity' && parsed.payload) {
            const activity = parsed.payload;
            if (activity.actor_id === user.id) return;
            setItems((prev) => {
              if (prev.some((item) => item.id === activity.id)) return prev;
              return [activity, ...prev].slice(0, 8);
            });
            setUnreadCount((prev) => prev + 1);
            setByTab((prev) => ({
              ...prev,
              [activity.tab_target]: (prev[activity.tab_target] || 0) + 1,
            }));
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connect, 4000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [classCode, token, user]);

  const markAsRead = useCallback(async () => {
    if (!token || !classCode) return;
    setUnreadCount(0);
    setByTab({ ...EMPTY_BY_TAB });
    setItems([]);
    try {
      await apiFetch(`/api/classes/${classCode}/notifications/mark-read`, {
        method: 'POST',
      });
    } catch {
      // Ignore network hiccup; state is already cleared locally
    }
  }, [apiFetch, classCode, token]);

  return (
    <ClassNotificationsContext.Provider
      value={{
        classCode,
        unreadCount,
        byTab,
        items,
        refreshNotifications,
        markAsRead,
      }}
    >
      {children}
    </ClassNotificationsContext.Provider>
  );
}

export function useClassNotifications(): ClassNotificationsContextValue {
  const ctx = useContext(ClassNotificationsContext);
  if (!ctx) {
    throw new Error('useClassNotifications must be used inside ClassNotificationsProvider');
  }
  return ctx;
}
