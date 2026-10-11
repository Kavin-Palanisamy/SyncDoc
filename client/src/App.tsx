import React, { useState, useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage.js';
import { EditorPage } from './pages/EditorPage.js';
import Login from "./components/Login";
import Signup from "./components/Signup";
import { ApiService, AuthUser } from './services/api.js';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('syncdoc_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return !!localStorage.getItem('syncdoc_token');
  });

  const [isInitializing, setIsInitializing] = useState<boolean>(() => {
    return !!localStorage.getItem('syncdoc_token');
  });

  const [showSignup, setShowSignup] = useState(false);

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('doc') || null;
  });

  useEffect(() => {
    // Apply saved preferences on launch
    const savedTheme = localStorage.getItem('syncdoc_theme') || 'slate';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedDensity = localStorage.getItem('syncdoc_density') || 'comfortable';
    if (savedDensity === 'compact') {
      document.body.classList.add('density-compact');
    } else {
      document.body.classList.remove('density-compact');
    }

    const savedMotion = localStorage.getItem('syncdoc_reduced_motion') === 'true';
    if (savedMotion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveDocumentId(params.get('doc') || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Validate active session token on application startup
  useEffect(() => {
    const token = localStorage.getItem('syncdoc_token');
    if (!token) {
      // Fresh unauthenticated session: ensure login view is displayed
      localStorage.removeItem('syncdoc_auth');
      localStorage.removeItem('syncdoc_user');
      sessionStorage.removeItem('syncdoc_auth');
      setIsLoggedIn(false);
      setCurrentUser(null);
      setIsInitializing(false);
      return;
    }

    ApiService.getMe()
      .then((user) => {
        setCurrentUser(user);
        setIsLoggedIn(true);
        localStorage.setItem('syncdoc_auth', 'true');
        localStorage.setItem('syncdoc_user', JSON.stringify(user));
        localStorage.setItem('syncdoc_user_name', user.name);
        localStorage.setItem('syncdoc_user_id', user.userId);
        localStorage.setItem('syncdoc_user_color', user.userColor);
      })
      .catch((err) => {
        console.warn('Session expired or invalid:', err?.message);
        ApiService.logout();
        setIsLoggedIn(false);
        setCurrentUser(null);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  const handleOpenDocument = (docId: string) => {
    setActiveDocumentId(docId);
    const url = new URL(window.location.href);
    url.searchParams.set('doc', docId);
    window.history.pushState({}, '', url.toString());
  };

  const handleBackToDashboard = () => {
    setActiveDocumentId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('doc');
    window.history.pushState({}, '', url.toString());
  };

  const handleLogout = async () => {
    await ApiService.logout();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setActiveDocumentId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('doc');
    window.history.pushState({}, '', url.toString());
  };

  // While validating an existing stored token on refresh
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/40 flex items-center justify-center mb-3 text-blue-400 animate-spin">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-slate-300 font-semibold text-sm">Resuming session...</p>
      </div>
    );
  }

  // Unauthenticated users are strictly guarded to Login / Signup
  if (!isLoggedIn) {
    return showSignup ? (
      <Signup onSwitchToLogin={() => setShowSignup(false)} />
    ) : (
      <Login
        onLogin={(user?: AuthUser) => {
          if (user) setCurrentUser(user);
          setIsLoggedIn(true);
        }}
        onSwitchToSignup={() => setShowSignup(true)}
      />
    );
  }

  // Protected application routes
  return activeDocumentId ? (
    <EditorPage
      documentId={activeDocumentId}
      onBackToDashboard={handleBackToDashboard}
    />
  ) : (
    <DashboardPage
      currentUser={currentUser}
      onOpenDocument={handleOpenDocument}
      onLogout={handleLogout}
    />
  );
};
