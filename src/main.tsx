import './instrument';
import {initGA, gaPageView} from './lib/analytics';

// Defer GA init to avoid blocking React mount
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => { initGA(); gaPageView(); });
} else {
  setTimeout(() => { initGA(); gaPageView(); }, 0);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {reactErrorHandler} from '@sentry/react';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
