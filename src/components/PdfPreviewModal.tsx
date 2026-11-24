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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#4a2e1a]/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border-2 border-[#c98f4f] bg-[#fcf4e4] text-[#4a2e1a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#c98f4f]/40 bg-[#e6c58c]/45 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#a8532c] font-medium">
              <FileText className="h-3.5 w-3.5" />
              <span>{doc.category || 'Document PDF'}</span>
              {doc.chapter ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{doc.chapter}</span>
                </>
              ) : null}
            </div>
            <h3 className="mt-1 truncate font-display text-base font-semibold text-[#4a2e1a]">
              {doc.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={doc.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-sand inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ouvrir
            </a>
            <a
              href={doc.file_path}
              download
              className="btn-rust inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'aperçu"
              className="rounded-lg border border-[#c98f4f] p-2 text-[#4a2e1a] hover:bg-[#e6c58c] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {doc.description ? (
          <div className="border-b border-[#c98f4f]/30 bg-[#f7ead0] px-5 py-2.5 text-xs text-[#4a2e1a]/80">
            {doc.description}
          </div>
        ) : null}

        <div className="flex-1 bg-[#e6c58c]/20">
          <iframe src={doc.file_path} title={doc.title} className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  );
}
