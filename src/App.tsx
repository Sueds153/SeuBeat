/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import LandingPage from './components/LandingPage';
import SocialProof from './components/SocialProof';
import { useMetaPixel } from './hooks/useMetaPixel';
import { fbPageView, fbInitiateCheckout } from './lib/metaPixel';

const Wizard = lazy(() => import('./components/Wizard'));
const PersonalizedSongPage = lazy(() => import('./components/PersonalizedSongPage'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

export default function App() {
  useMetaPixel();

  const [currentView, setCurrentView] = useState<'landing' | 'wizard' | 'song' | 'admin'>(() => {
    if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
      return 'admin';
    }
    if (window.location.pathname.includes('/song/')) {
      return 'song';
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
      if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
        setCurrentView('admin');
      } else if (window.location.pathname.includes('/song/')) {
        setCurrentView('song');
      } else if (currentViewRef.current === 'song' || currentViewRef.current === 'admin') {
        setCurrentView('landing');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const startWizard = () => {
    setCurrentView('wizard');
    fbInitiateCheckout('wizard');
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
    <div className="flex items-center justify-center min-h-screen bg-stone-950">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Admin route
  if (currentView === 'admin') {
    return <Suspense fallback={loading}><AdminPanel /></Suspense>;
  }

  return (
    <div className="bg-stone-950 min-h-screen text-stone-100 selection:bg-amber-500/25 selection:text-amber-300">
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
