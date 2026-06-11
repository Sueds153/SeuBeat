/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Wizard from './components/Wizard';
import SocialProof from './components/SocialProof';
import PersonalizedSongPage from './components/PersonalizedSongPage';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'wizard' | 'song' | 'admin'>(() => {
    if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
      return 'admin';
    }
    if (window.location.pathname.includes('/song/')) {
      return 'song';
    }
    return 'landing';
  });

  // Handle browser back navigation or dynamic path change
  useEffect(() => {
    const handleLocationChange = () => {
      if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
        setCurrentView('admin');
      } else if (window.location.pathname.includes('/song/')) {
        setCurrentView('song');
      } else if (currentView === 'song' || currentView === 'admin') {
        setCurrentView('landing');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [currentView]);

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

  // Admin route
  if (currentView === 'admin') {
    return <AdminPanel />;
  }

  return (
    <div className="bg-stone-950 min-h-screen text-stone-100 selection:bg-amber-500/25 selection:text-amber-300">
      {currentView === 'song' ? (
        <PersonalizedSongPage onBackToLanding={backToLanding} />
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
