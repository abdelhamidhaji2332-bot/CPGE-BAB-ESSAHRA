import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLang } from './LangContext';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastInput {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  notify: (input: ToastInput) => string;
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE_TOASTS = 4;

const TYPE_STYLES: Record<
  ToastType,
  {
    cardBorder: string;
    iconWrap: string;
    titleText: string;
    progressBar: string;
    Icon: typeof CheckCircle2;
  }
> = {
  success: {
    cardBorder: 'border-[#c98f4f]/70 border-s-4 border-s-[#2f6f4e] dark:border-[#5a4634] dark:border-s-emerald-400',
    iconWrap: 'bg-[#2f6f4e]/12 text-[#2f6f4e] dark:bg-emerald-500/15 dark:text-emerald-300',
    titleText: 'text-[#2f6f4e] dark:text-emerald-300',
    progressBar: 'bg-[#2f6f4e] dark:bg-emerald-400',
    Icon: CheckCircle2,
  },
  error: {
    cardBorder: 'border-[#c98f4f]/70 border-s-4 border-s-[#b42318] dark:border-[#5a4634] dark:border-s-rose-400',
    iconWrap: 'bg-[#b42318]/12 text-[#b42318] dark:bg-rose-500/15 dark:text-rose-300',
    titleText: 'text-[#b42318] dark:text-rose-300',
    progressBar: 'bg-[#b42318] dark:bg-rose-400',
    Icon: AlertCircle,
  },
  warning: {
    cardBorder: 'border-[#c98f4f]/70 border-s-4 border-s-[#b45309] dark:border-[#5a4634] dark:border-s-amber-400',
    iconWrap: 'bg-[#b45309]/12 text-[#b45309] dark:bg-amber-500/15 dark:text-amber-300',
    titleText: 'text-[#b45309] dark:text-amber-300',
    progressBar: 'bg-[#b45309] dark:bg-amber-400',
    Icon: AlertTriangle,
  },
  info: {
    cardBorder: 'border-[#c98f4f]/70 border-s-4 border-s-[#a8532c] dark:border-[#5a4634] dark:border-s-[#e88c5d]',
    iconWrap: 'bg-[#a8532c]/12 text-[#a8532c] dark:bg-[#e88c5d]/15 dark:text-[#e88c5d]',
    titleText: 'text-[#a8532c] dark:text-[#e88c5d]',
    progressBar: 'bg-[#a8532c] dark:bg-[#e88c5d]',
    Icon: Info,
  },
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { t } = useLang();
  const prefersReducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(item.duration);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (item.duration <= 0 || paused) return;
    startedAtRef.current = Date.now();
    const timer = window.setTimeout(() => {
      onDismiss(item.id);
    }, remainingRef.current);

    return () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    };
  }, [item.duration, item.id, onDismiss, paused]);

  const style = TYPE_STYLES[item.type];
  const Icon = style.Icon;

  const defaultTitle =
    item.type === 'success'
      ? t('Enregistré', 'تم بنجاح')
      : item.type === 'error'
        ? t('Erreur', 'خطأ')
        : item.type === 'warning'
          ? t('Attention', 'تنبيه')
          : t('Information', 'معلومة');

  return (
    <motion.div
      layout
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role={item.type === 'error' || item.type === 'warning' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border bg-[#fcf4e4] p-3.5 shadow-lg shadow-[#4a2e1a]/15 dark:bg-[#1c1916] dark:shadow-black/50 ${style.cardBorder}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.iconWrap}`}>
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold tracking-wide ${style.titleText}`}>
            {item.title || defaultTitle}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#4a2e1a] dark:text-[#f5ebd6]">{item.message}</p>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          aria-label={t('Fermer la notification', 'إغلاق الإشعار')}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#4a2e1a]/60 transition-colors hover:bg-[#e6c58c]/55 hover:text-[#4a2e1a] dark:text-[#c8b696] dark:hover:bg-[#2a241d] dark:hover:text-[#f5ebd6] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {item.duration > 0 && !paused && !prefersReducedMotion ? (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: remainingRef.current / 1000, ease: 'linear' }}
          className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left opacity-70 ${style.progressBar}`}
        />
      ) : null}
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seqRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const notify = useCallback((input: ToastInput): string => {
    const type: ToastType = input.type ?? 'info';
    const defaultDuration = type === 'error' || type === 'warning' ? 5500 : 3800;
    const duration = input.duration ?? defaultDuration;
    seqRef.current += 1;
    const id = `toast-${Date.now()}-${seqRef.current}`;

    setToasts((prev) => {
      // Avoid stacking identical back-to-back messages
      const deduped = prev.filter((t) => !(t.message === input.message && t.type === type));
      return [...deduped, { id, type, title: input.title, message: input.message, duration }].slice(
        -MAX_VISIBLE_TOASTS
      );
    });

    return id;
  }, []);

  const success = useCallback(
    (message: string, title?: string, duration?: number) =>
      notify({ type: 'success', message, title, duration }),
    [notify]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) =>
      notify({ type: 'error', message, title, duration }),
    [notify]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) =>
      notify({ type: 'info', message, title, duration }),
    [notify]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) =>
      notify({ type: 'warning', message, title, duration }),
    [notify]
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, notify, success, error, info, warning, dismiss, clearAll }),
    [toasts, notify, success, error, info, warning, dismiss, clearAll]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed top-16 inset-x-3 z-50 mx-auto flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:top-24 sm:end-6 sm:w-full"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast doit être utilisé dans ToastProvider');
  }
  return ctx;
}
