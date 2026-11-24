import { AnimatePresence, motion } from 'framer-motion';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { useLang } from '../context/LangContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'drawer';
  onAction?: () => void;
}

export function PWAInstallButton({ variant = 'topbar', onAction }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useLang();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      onAction?.();
      return;
    }
    if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'topbar' ? (
        <button
          type="button"
          onClick={handleClick}
          aria-label={t("Installer l'application", 'تثبيت التطبيق')}
          title={t("Installer l'application sur l'écran d'accueil", 'تثبيت التطبيق على الشاشة الرئيسية')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f7ead0]/85 text-[#f7ead0] transition-colors hover:bg-[#f7ead0] hover:text-[#a8532c] dark:border-[#e88c5d]/60 dark:text-[#f5ebd6] dark:hover:bg-[#e88c5d] dark:hover:text-[#12100e] cursor-pointer sm:h-auto sm:w-auto sm:gap-1.5 sm:px-4 sm:py-1.5 sm:text-xs sm:font-medium sm:whitespace-nowrap"
        >
          <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="hidden md:inline">
            {t('Installer', 'تثبيت')}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-[#a8532c]/45 bg-[#f3dfb9] px-3.5 py-2.5 text-start text-[#4a2e1a] transition-colors hover:bg-[#e6c58c] dark:border-[#e88c5d]/45 dark:bg-[#2a241d] dark:text-[#f5ebd6] dark:hover:bg-[#362c22] cursor-pointer"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#a8532c] text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]">
            <Smartphone className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[#a8532c] dark:text-[#e88c5d]">
              {t("Installer l'application", 'تثبيت التطبيق')}
            </span>
            <span className="block truncate text-[11px] text-[#4a2e1a]/75 dark:text-[#c8b696]">
              {isIOS
                ? t("Ajouter à l'écran d'accueil Safari", 'إضافة إلى الشاشة الرئيسية')
                : t('Accès rapide depuis votre écran d’accueil', 'وصول سريع من الشاشة الرئيسية')}
            </span>
          </span>
        </button>
      )}

      <AnimatePresence>
        {showIOSGuide ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setShowIOSGuide(false)}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2a190d]/60 dark:bg-[#050403]/85 p-4 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ios-pwa-title"
              className="w-full max-w-sm rounded-2xl border-2 border-[#c98f4f] bg-[#fcf4e4] p-5 text-[#4a2e1a] shadow-2xl dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[#c98f4f]/35 pb-3 dark:border-[#423428]">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/apple-touch-icon.png"
                    alt="Site Prépa"
                    className="h-10 w-10 rounded-xl border border-[#c98f4f]/50 dark:border-[#5a4634]"
                  />
                  <div>
                    <h3 id="ios-pwa-title" className="font-display text-base font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                      {t('Installer Site Prépa', 'تثبيت موقع التحضيرية')}
                    </h3>
                    <p className="text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">
                      {t('iPhone & iPad · Safari', 'آيفون وآيباد · سفاري')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={t('Fermer', 'إغلاق')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#c98f4f]/45 text-[#4a2e1a] hover:bg-[#e6c58c] dark:border-[#5a4634] dark:text-[#f5ebd6] dark:hover:bg-[#2a241d] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-3 rounded-xl border border-[#c98f4f]/35 bg-[#f7ead0] p-3 dark:border-[#423428] dark:bg-[#26211c]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#a8532c] text-xs font-semibold text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]">
                    1
                  </span>
                  <div className="flex-1 leading-snug">
                    <span className="font-semibold">
                      {t('Touchez le bouton Partager', 'اضغط على زر المشاركة')}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">
                      <Share className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                      {t('Dans la barre d’outils Safari', 'في شريط أدوات متصفح سفاري')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl border border-[#c98f4f]/35 bg-[#f7ead0] p-3 dark:border-[#423428] dark:bg-[#26211c]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#a8532c] text-xs font-semibold text-[#f7ead0] dark:bg-[#c25e32] dark:text-[#fdf6e9]">
                    2
                  </span>
                  <div className="flex-1 leading-snug">
                    <span className="font-semibold">
                      {t("Sélectionnez « Sur l'écran d'accueil »", 'اختر « إضافة إلى الشاشة الرئيسية »')}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">
                      <PlusSquare className="h-3.5 w-3.5 text-[#a8532c] dark:text-[#e88c5d]" />
                      {t('Puis confirmez avec Ajouter', 'ثم اضغط على إضافة للتأكيد')}
                    </span>
                  </div>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => {
                  setShowIOSGuide(false);
                  onAction?.();
                }}
                className="btn-rust mt-4 w-full min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer"
              >
                {t('Compris', 'فهمت')}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
