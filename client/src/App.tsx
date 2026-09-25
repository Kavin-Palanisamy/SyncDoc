import React, { useState, useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage.js';
import { EditorPage } from './pages/EditorPage.js';
import Login from "./components/Login";
import Signup from "./components/Signup";

export const App: React.FC = () => {

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('doc') || null;
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveDocumentId(params.get('doc') || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
  
  if (!isLoggedIn) {
  return showSignup ? (
    <Signup onSwitchToLogin={() => setShowSignup(false)} />
  ) : (
    <Login
      onLogin={() => setIsLoggedIn(true)}
      onSwitchToSignup={() => setShowSignup(true)}
    />
  );
}

  return activeDocumentId ? (
    <EditorPage
      documentId={activeDocumentId}
      onBackToDashboard={handleBackToDashboard}
    />
  ) : (
    <DashboardPage onOpenDocument={handleOpenDocument} />
  );
};
