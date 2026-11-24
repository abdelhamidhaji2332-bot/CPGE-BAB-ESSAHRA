import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { useEffect } from 'react';

export interface PreviewDoc {
  id?: number;
  title: string;
  file_path: string;
  category?: string;
  chapter?: string;
  description?: string;
}

export function PdfPreviewModal({
  doc,
  onClose,
}: {
  doc: PreviewDoc | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!doc) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [doc, onClose]);

  if (!doc) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu du document ${doc.title}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#4a2e1a]/75 p-0 backdrop-blur-xs dark:bg-[#050403]/85 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border-2 border-[#c98f4f] bg-[#fcf4e4] text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#f5ebd6] sm:h-[88vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-[#c98f4f]/40 bg-[#e6c58c]/45 px-4 py-3.5 dark:border-[#423428] dark:bg-[#27221c] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#a8532c] font-medium dark:text-[#e88c5d]">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>{doc.category || 'Document PDF'}</span>
                {doc.chapter ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{doc.chapter}</span>
                  </>
                ) : null}
              </div>
              <h3 className="mt-1 truncate font-display text-sm sm:text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                {doc.title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'aperçu"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#c98f4f] text-[#4a2e1a] hover:bg-[#e6c58c] transition-colors cursor-pointer dark:border-[#5a4634] dark:text-[#f5ebd6] dark:hover:bg-[#332b23] sm:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center shrink-0">
            <a
              href={doc.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-sand inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap sm:min-h-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ouvrir
            </a>
            <a
              href={doc.file_path}
              download
              className="btn-rust inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap sm:min-h-0"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'aperçu"
              className="hidden sm:inline-flex rounded-lg border border-[#c98f4f] p-2 text-[#4a2e1a] hover:bg-[#e6c58c] transition-colors cursor-pointer dark:border-[#5a4634] dark:text-[#f5ebd6] dark:hover:bg-[#332b23]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {doc.description ? (
          <div className="border-b border-[#c98f4f]/30 bg-[#f7ead0] px-4 py-2 text-xs text-[#4a2e1a]/80 dark:border-[#423428] dark:bg-[#161310] dark:text-[#e3d4b7] sm:px-5 sm:py-2.5">
            {doc.description}
          </div>
        ) : null}

        <div className="border-b border-[#c98f4f]/25 bg-[#fcf4e4] px-4 py-1.5 text-[11px] text-[#4a2e1a]/75 dark:border-[#423428] dark:bg-[#1c1916] dark:text-[#c8b696] sm:hidden">
          Si l’aperçu ne s’affiche pas sur votre téléphone, utilisez « Ouvrir » ou « Télécharger PDF ».
        </div>

        <div className="flex-1 bg-[#e6c58c]/20 dark:bg-[#26211c]">
          <iframe src={doc.file_path} title={doc.title} className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  );
}
