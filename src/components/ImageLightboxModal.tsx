import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface LightboxImage {
  src: string;
  title: string;
  caption?: string;
}

export function ImageLightboxModal({
  image,
  onClose,
}: {
  image: LightboxImage | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [image?.src]);

  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))));
      if (e.key === '-') setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [image, onClose]);

  return (
    <AnimatePresence>
      {image ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a190d]/85 p-2 backdrop-blur-xs dark:bg-[#050403]/90 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={image.title}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#c98f4f] bg-[#fcf4e4] text-[#4a2e1a] shadow-2xl dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6]"
          >
            <div className="flex flex-col gap-2.5 border-b border-[#c98f4f]/40 bg-[#e6c58c]/65 px-3.5 py-3 dark:border-[#423428] dark:bg-[#27221c] sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-sm sm:text-base font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                    {image.title}
                  </h3>
                  {image.caption ? (
                    <p className="truncate text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">{image.caption}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="btn-rust inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs cursor-pointer sm:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-1.5 shrink-0 sm:justify-end">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
                    aria-label="Dézoomer"
                    className="btn-sand inline-flex h-10 w-10 items-center justify-center rounded-lg text-xs cursor-pointer sm:h-8 sm:w-8"
                  >
                    <ZoomOut className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                  <span className="w-12 text-center font-mono text-xs font-semibold tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                    aria-label="Zoomer"
                    className="btn-sand inline-flex h-10 w-10 items-center justify-center rounded-lg text-xs cursor-pointer sm:h-8 sm:w-8"
                  >
                    <ZoomIn className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    aria-label="Réinitialiser le zoom"
                    className="btn-sand inline-flex h-10 w-10 items-center justify-center rounded-lg text-xs cursor-pointer sm:h-8 sm:w-8"
                  >
                    <RotateCcw className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={image.src}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Ouvrir dans un nouvel onglet"
                    className="btn-sand inline-flex h-10 w-10 items-center justify-center rounded-lg text-xs sm:h-8 sm:w-8"
                  >
                    <ExternalLink className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer"
                    className="btn-rust hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto touch-pan-x touch-pan-y bg-[#f7ead0] p-3 dark:bg-[#12100e] sm:p-6">
              <div className="flex min-h-full items-center justify-center">
                <img
                  src={image.src}
                  alt={image.title}
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                  className="max-h-[74dvh] w-auto rounded-lg border border-[#c98f4f]/50 transition-transform duration-150 dark:border-[#423428] dark:brightness-95"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
