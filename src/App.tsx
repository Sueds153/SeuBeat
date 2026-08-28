/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import LandingPage from './components/LandingPage';
import SocialProof from './components/SocialProof';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import RecoverPage from './components/RecoverPage';
import VoiceCapturePage from './components/VoiceCapturePage';
import Wizard from './components/Wizard';
import { useMetaPixel } from './hooks/useMetaPixel';
import { fbPageView } from './lib/metaPixel';
import { captureUtm } from './lib/utm';

const PersonalizedSongPage = lazy(() => import('./components/PersonalizedSongPage'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

export default function App() {
  useMetaPixel();

  // Captura UTM no início do funil, seja qual for a rota de entrada
  useEffect(() => {
    captureUtm();
  }, []);

  const [currentView, setCurrentView] = useState<'landing' | 'wizard' | 'song' | 'admin' | 'terms' | 'privacy' | 'recover' | 'voice'>(() => {
    if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
      return 'admin';
    }
    if (window.location.pathname === '/wizard') {
      return 'wizard';
    }
    if (window.location.pathname.includes('/voice/')) {
      return 'voice';
    }
    if (window.location.pathname.includes('/song/') || window.location.pathname.includes('/dedicatoria/')) {
      return 'song';
    }
    if (window.location.pathname === '/terms') {
      return 'terms';
    }
    if (window.location.pathname === '/privacy') {
      return 'privacy';
    }
    if (window.location.pathname === '/retomar' || window.location.pathname === '/retomar/') {
      return 'recover';
    }
    return 'landing';
  });

  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;
  const isFirstRender = useRef(true);

  // Fire PageView when view changes (skip first mount — initMetaPixel já o fez)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fbPageView();
  }, [currentView]);

  // Handle browser back navigation or dynamic path change
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path === '/admin' || path === '/admin/') {
        setCurrentView('admin');
      } else if (path === '/wizard') {
        setCurrentView('wizard');
      } else if (path.includes('/voice/')) {
        setCurrentView('voice');
      } else if (path.includes('/song/') || path.includes('/dedicatoria/')) {
        setCurrentView('song');
      } else if (path === '/terms') {
        setCurrentView('terms');
      } else if (path === '/privacy') {
        setCurrentView('privacy');
      } else if (path === '/retomar' || path === '/retomar/') {
        setCurrentView('recover');
      } else if (currentViewRef.current === 'song' || currentViewRef.current === 'admin' || currentViewRef.current === 'wizard' || currentViewRef.current === 'voice') {
        setCurrentView('landing');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const startWizard = () => {
    setCurrentView('wizard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToLanding = () => {
    if (window.location.pathname.includes('/song/') || window.location.pathname.includes('/admin')) {
      window.history.pushState({}, '', '/');
    }
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loading = (
    <div className="flex items-center justify-center min-h-screen bg-[#151210]">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Static pages (no suspense needed)
  if (currentView === 'terms') {
    return <TermsPage onBackToLanding={backToLanding} />;
  }
  if (currentView === 'privacy') {
    return <PrivacyPage onBackToLanding={backToLanding} />;
  }
  if (currentView === 'recover') {
    return (
      <RecoverPage
        onBackToLanding={backToLanding}
        onResume={(requestId) => {
          window.history.pushState({}, '', `/wizard?resume=${encodeURIComponent(requestId)}&step=payment`);
          setCurrentView('wizard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (currentView === 'voice') {
    const match = window.location.pathname.match(/\/voice\/([a-f0-9-]+)/);
    const reqId = match?.[1] || '';
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email') || undefined;
    return (
      <VoiceCapturePage
        requestId={reqId}
        email={emailParam}
        onBackToLanding={backToLanding}
      />
    );
  }

  // Admin route
  if (currentView === 'admin') {
    return <Suspense fallback={loading}><AdminPanel /></Suspense>;
  }

  return (
    <div className="bg-[#151210] min-h-screen text-stone-100 selection:bg-amber-500/25 selection:text-amber-300">
      {currentView === 'song' ? (
        <Suspense fallback={loading}><PersonalizedSongPage onBackToLanding={backToLanding} /></Suspense>
      ) : (
        <>
          {currentView === 'landing' ? (
            <LandingPage onStartWizard={startWizard} />
          ) : (
            <Wizard onBackToLanding={backToLanding} />
          )}
          <SocialProof />
        </>
      )}
    </div>
  );
}
