import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { useLang } from '../context/LangContext';

export function SitePrepaEntrance({
  visible,
  onComplete,
}: {
  visible: boolean;
  onComplete: () => void;
}) {
  const { t } = useLang();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    const delay = prefersReducedMotion ? 200 : 1450;
    const timer = window.setTimeout(onComplete, delay);
    return () => window.clearTimeout(timer);
  }, [visible, onComplete, prefersReducedMotion]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="site-prepa-entrance"
          initial={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : -36,
          }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          onClick={onComplete}
          role="dialog"
          aria-label="Site Prépa — CPGE Bab Sahra"
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#f7ead0] px-6 text-center text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6]"
        >
          {/* Subtle warm desert radial wash */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(230,197,140,0.55)_0%,rgba(247,234,208,0)_68%)] dark:bg-[radial-gradient(circle_at_center,rgba(232,140,93,0.18)_0%,rgba(18,16,14,0)_68%)]"
          />

          <div className="relative z-10 flex max-w-md flex-col items-center">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.86, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              className="rounded-2xl border-2 border-[#c98f4f]/70 bg-[#fcf4e4] p-2 shadow-md dark:border-[#5a4634] dark:bg-[#1c1916]"
            >
              <img
                src="/images/logo.png"
                alt="Logo Site Prépa Bab Sahra"
                className="h-16 w-16 rounded-xl object-cover sm:h-20 sm:w-20"
              />
            </motion.div>

            <motion.h1
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 font-display text-4xl font-semibold tracking-wide text-[#a8532c] dark:text-[#e88c5d] sm:text-5xl"
            >
              Site Prépa
            </motion.h1>

            <motion.div
              initial={prefersReducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.45, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mt-3 h-[3px] w-24 origin-center rounded-full bg-[#c98f4f] dark:bg-[#e88c5d]"
            />

            <motion.p
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#4a2e1a]/85 dark:text-[#e3d4b7] sm:text-sm"
            >
              {t('CPGE Bab Sahra · Guelmim', 'الأقسام التحضيرية باب الصحراء · كلميم')}
            </motion.p>

            <motion.p
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="mt-2 text-xs text-[#4a2e1a]/70 dark:text-[#c8b696]"
            >
              {t(
                'Sup & Spé · Bibliothèque · Colloscopes · Vie Campus',
                'السنة 1 و 2 · المكتبة · الكولوسكوب · الحياة الطلابية'
              )}
            </motion.p>

            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ duration: 0.3, delay: 0.65 }}
              onClick={(e) => {
                e.stopPropagation();
                onComplete();
              }}
              className="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-[#a8532c] hover:opacity-100 cursor-pointer dark:text-[#e88c5d]"
            >
              <span>{t('Accéder au menu', 'الدخول إلى القائمة')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
