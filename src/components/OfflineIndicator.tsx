import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLang } from '../context/LangContext';

export function OfflineIndicator() {
  const { t } = useLang();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed start-4 bottom-20 z-40 flex items-center gap-2 rounded-xl border border-[#c98f4f] bg-[#4a2e1a] px-3.5 py-2 text-xs font-medium text-[#f7ead0] shadow-lg dark:border-[#e88c5d]/60 dark:bg-[#26211c] dark:text-[#f5ebd6] md:bottom-5"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-[#e6c58c] dark:text-[#e88c5d]" />
      <span>
        {t(
          'Mode hors ligne — Données en cache affichées',
          'وضع عدم الاتصال — يتم عرض البيانات المحفوظة'
        )}
      </span>
    </div>
  );
}
