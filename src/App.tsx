/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import LandingPage from './components/LandingPage';
import SocialProof from './components/SocialProof';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import { useMetaPixel } from './hooks/useMetaPixel';
import { fbPageView } from './lib/metaPixel';

const Wizard = lazy(() => import('./components/Wizard'));
const PersonalizedSongPage = lazy(() => import('./components/PersonalizedSongPage'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

export default function App() {
  useMetaPixel();

  const [currentView, setCurrentView] = useState<'landing' | 'wizard' | 'song' | 'admin' | 'terms' | 'privacy'>(() => {
    if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
      return 'admin';
    }
    if (window.location.pathname.includes('/song/')) {
      return 'song';
    }
    if (window.location.pathname === '/terms') {
      return 'terms';
    }
    if (window.location.pathname === '/privacy') {
      return 'privacy';
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
      } else if (path.includes('/song/')) {
        setCurrentView('song');
      } else if (path === '/terms') {
        setCurrentView('terms');
      } else if (path === '/privacy') {
        setCurrentView('privacy');
      } else if (currentViewRef.current === 'song' || currentViewRef.current === 'admin') {
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
            <Suspense fallback={loading}><Wizard onBackToLanding={backToLanding} /></Suspense>
          )}
          <SocialProof />
        </>
      )}
    </div>
  );
}
