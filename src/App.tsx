import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ClassQuickSwitcher } from './components/ClassQuickSwitcher';
import { DunesFooter } from './components/DunesFooter';
import { Navbar } from './components/Navbar';
import { SitePrepaEntrance } from './components/SitePrepaEntrance';
import { AuthProvider } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { CampusLifePage } from './pages/CampusLifePage';
import { ClassWorkspacePage, type WorkspaceTab } from './pages/ClassWorkspacePage';
import { DevTeamPage } from './pages/DevTeamPage';
import { InternatPage } from './pages/InternatPage';
import { LandingPage } from './pages/LandingPage';
import { PortalPage } from './pages/PortalPage';
import { ProfWorkspacePage } from './pages/ProfWorkspacePage';
import { ResourcesPage } from './pages/ResourcesPage';

function CampusShell() {
  const [locationUrl, setLocationUrl] = useState<string>(
    () => (window.location.pathname || '/') + (window.location.search || '')
  );
  const [showEntrance, setShowEntrance] = useState<boolean>(
    () => (window.location.pathname || '/') === '/'
  );
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const onPop = () => {
      setLocationUrl((window.location.pathname || '/') + (window.location.search || ''));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSwitcherOpen((prev) => !prev);
      }
    };
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 360);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const navigate = useCallback((nextUrl: string) => {
    const current = (window.location.pathname || '/') + (window.location.search || '');
    if (nextUrl !== current) {
      window.history.pushState({}, '', nextUrl);
    }
    setLocationUrl(nextUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [pathname, searchString] = locationUrl.split('?');
  const searchParams = new URLSearchParams(searchString || '');
  const tabParam = searchParams.get('tab') as WorkspaceTab | null;
  const subjectParam = searchParams.get('subject');

  let view = (
    <LandingPage
      onNavigate={navigate}
      onOpenClassSwitcher={() => setSwitcherOpen(true)}
    />
  );

  if (pathname === '/classes') {
    view = (
      <ClassWorkspacePage
        classSlug="MPSI"
        initialTab={tabParam || undefined}
        initialSubject={subjectParam || undefined}
        onNavigate={navigate}
        onOpenClassSwitcher={() => setSwitcherOpen(true)}
      />
    );
  } else if (pathname.startsWith('/classes/')) {
    const slug = pathname.replace('/classes/', '').split('/')[0];
    view = (
      <ClassWorkspacePage
        classSlug={slug}
        initialTab={tabParam || undefined}
        initialSubject={subjectParam || undefined}
        onNavigate={navigate}
        onOpenClassSwitcher={() => setSwitcherOpen(true)}
      />
    );
  } else if (pathname === '/ressources') {
    view = <ResourcesPage />;
  } else if (pathname === '/internat') {
    view = <InternatPage />;
  } else if (pathname === '/vie-campus') {
    view = <CampusLifePage onNavigate={navigate} />;
  } else if (pathname === '/espace-prof') {
    view = <ProfWorkspacePage onNavigate={navigate} />;
  } else if (pathname === '/portail') {
    view = <PortalPage onNavigate={navigate} />;
  } else if (pathname === '/dev-team') {
    view = <DevTeamPage onNavigate={navigate} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7ead0] text-[#4a2e1a]">
      <SitePrepaEntrance
        visible={showEntrance}
        onComplete={() => setShowEntrance(false)}
      />

      <motion.div
        style={{ scaleX }}
        className="fixed top-0 left-0 right-0 z-50 h-0.5 origin-left bg-[#a8532c]"
      />

      <Navbar
        currentPath={pathname}
        onNavigate={navigate}
        onOpenClassSwitcher={() => setSwitcherOpen(true)}
        entranceReady={!showEntrance}
      />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {view}
          </motion.div>
        </AnimatePresence>
      </main>

      <DunesFooter onNavigate={navigate} />

      <ClassQuickSwitcher
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onNavigate={navigate}
      />

      <AnimatePresence>
        {showScrollTop ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.16 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Retour en haut"
            className="btn-rust fixed right-4 bottom-4 z-40 rounded-full p-3 shadow-lg cursor-pointer sm:right-5 sm:bottom-5"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <CampusShell />
      </AuthProvider>
    </LangProvider>
  );
}
