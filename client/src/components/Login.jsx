import React, { useState, useEffect, useRef } from "react";
import { ApiService } from "../services/api";
import "./Login.css";

export default function Login({ onLogin, onSwitchToSignup }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleConfigNote, setGoogleConfigNote] = useState("");
  const googleBtnContainerRef = useRef(null);

  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

  // Initialize Google Identity Services (GSI) when script is ready
  useEffect(() => {
    if (!googleClientId) return;

    let checkInterval = null;
    const initializeGoogle = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Optional: render hidden official button for native fallback trigger
          if (googleBtnContainerRef.current) {
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              theme: "outline",
              size: "large",
              type: "standard",
              text: "continue_with",
              width: 320,
            });
          }
        } catch (initErr) {
          console.warn("[Google GSI] Initialization failed:", initErr);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
    } else {
      checkInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initializeGoogle();
          clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [googleClientId]);

  // Handle Google Credential Response from GSI
  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      setError("Google authentication was cancelled or returned an empty response.");
      return;
    }

    setIsGoogleSubmitting(true);
    setError("");
    setGoogleConfigNote("");

    try {
      const res = await ApiService.googleLogin(response.credential);
      if (res && res.token && res.user) {
        localStorage.setItem("syncdoc_token", res.token);
        localStorage.setItem("syncdoc_auth", "true");
        localStorage.setItem("syncdoc_user", JSON.stringify(res.user));
        localStorage.setItem("syncdoc_user_name", res.user.name);
        localStorage.setItem("syncdoc_user_id", res.user.userId);
        localStorage.setItem("syncdoc_user_color", res.user.userColor);

        sessionStorage.setItem("syncdoc_token", res.token);
        sessionStorage.setItem("syncdoc_auth", "true");
        sessionStorage.setItem("syncdoc_user_name", res.user.name);

        if (onLogin) onLogin(res.user);
      } else {
        throw new Error(res.error || "Google authentication failed.");
      }
    } catch (err) {
      console.error("[Login] Google login error:", err);
      setError(err.message || "Failed to sign in with Google. Please try again.");
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // Google Login button click handler
  const handleGoogleClick = () => {
    setError("");
    setGoogleConfigNote("");

    if (!googleClientId) {
      setGoogleConfigNote(
        "Google Sign-In is integrated. To enable live OAuth, configure VITE_GOOGLE_CLIENT_ID in your .env file."
      );
      return;
    }

    if (window.google?.accounts?.id) {
      setIsGoogleSubmitting(true);
      try {
        window.google.accounts.id.prompt((notification) => {
          setIsGoogleSubmitting(false);
          if (notification.isNotDisplayed()) {
            // If prompt could not display, click official container if available
            if (googleBtnContainerRef.current) {
              const innerBtn = googleBtnContainerRef.current.querySelector("div[role=button]");
              if (innerBtn) (innerBtn).click();
            } else {
              setError("Google sign-in popup was blocked or could not be displayed.");
            }
          } else if (notification.isSkippedMoment()) {
            setError("Google sign-in was dismissed.");
          }
        });
      } catch (err) {
        setIsGoogleSubmitting(false);
        setError("Unable to launch Google authentication dialog. Please check your browser popup settings.");
      }
    } else {
      setError("Google authentication service is still loading. Please wait a moment and try again.");
    }
  };

  // Standard Email/Password login submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setGoogleConfigNote("");

    if (!identifier.trim() || !password.trim()) {
      setError("Enter your email/username and password to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ApiService.login(identifier.trim(), password);
      if (res && res.token && res.user) {
        localStorage.setItem("syncdoc_token", res.token);
        localStorage.setItem("syncdoc_auth", "true");
        localStorage.setItem("syncdoc_user", JSON.stringify(res.user));
        localStorage.setItem("syncdoc_user_name", res.user.name);
        localStorage.setItem("syncdoc_user_id", res.user.userId);
        localStorage.setItem("syncdoc_user_color", res.user.userColor);

        sessionStorage.setItem("syncdoc_token", res.token);
        sessionStorage.setItem("syncdoc_auth", "true");
        sessionStorage.setItem("syncdoc_user_name", res.user.name);

        if (onLogin) onLogin(res.user);
      } else {
        throw new Error(res.error || "Authentication failed.");
      }
    } catch (err) {
      console.error("[Login] Submit error:", err);
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || isGoogleSubmitting;

  return (
    <div className="login-page">
      <div className="login-aurora login-aurora--one" aria-hidden="true" />
      <div className="login-aurora login-aurora--two" aria-hidden="true" />
      <div className="login-grain" aria-hidden="true" />

      <main className="login-card" role="main">
        <div className="login-mark" aria-hidden="true">
          <span className="login-mark__glyph">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2.5L14.2 9.3L21 12L14.2 14.7L12 21.5L9.8 14.7L3 12L9.8 9.3L12 2.5Z"
                fill="url(#starGradient)"
              />
              <defs>
                <linearGradient id="starGradient" x1="3" y1="2.5" x2="21" y2="21.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#c4b5fd" />
                  <stop offset="1" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </div>

        <header className="login-header">
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">Sign in to continue where you left off.</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="identifier">Email or username</label>
            <div className="login-input-shell">
              <svg
                className="login-input-icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3.5 6.5C3.5 5.67157 4.17157 5 5 5H19C19.8284 5 20.5 5.67157 20.5 6.5V17.5C20.5 18.3284 19.8284 19 19 19H5C4.17157 19 3.5 18.3284 3.5 17.5V6.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M4.5 6.5L12 12.5L19.5 6.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                placeholder="you@example.com"
                value={identifier}
                disabled={isBusy}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          </div>

          <div className="login-field">
            <div className="login-field__row">
              <label htmlFor="password">Password</label>
            </div>
            <div className="login-input-shell">
              <svg
                className="login-input-icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M8 10.5V7.5C8 5.29086 9.79086 3.5 12 3.5C14.2091 3.5 16 5.29086 16 7.5V10.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                disabled={isBusy}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login-visibility-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path
                      d="M3 3L21 21M10.6 10.7C10.2 11.1 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 12.9 13.8 13.3 13.5M6.5 6.7C4.5 8 3 10 2.5 12C3.7 15.6 7.5 18.5 12 18.5C13.8 18.5 15.5 18 16.9 17.2M9.5 5.2C10.3 5 11.1 4.9 12 4.9C16.5 4.9 20.3 7.8 21.5 11.4C21.1 12.6 20.4 13.7 19.5 14.6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path
                      d="M2.5 12C3.7 8.4 7.5 5.5 12 5.5C16.5 5.5 20.3 8.4 21.5 12C20.3 15.6 16.5 18.5 12 18.5C7.5 18.5 3.7 15.6 2.5 12Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div
            className={`login-error ${error ? "login-error--visible" : ""}`}
            role="alert"
            aria-live="polite"
          >
            {error && (
              <>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M12 8V13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="12" cy="16.2" r="0.9" fill="currentColor" />
                </svg>
                <span>{error}</span>
              </>
            )}
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={isBusy}
            aria-busy={isSubmitting}
          >
            <span>{isSubmitting ? "Signing in..." : "Sign in"}</span>
          </button>

          {/* Visual "OR" Divider */}
          <div className="login-divider" aria-hidden="true">
            <span>OR</span>
          </div>

          {/* Continue with Google button */}
          <button
            type="button"
            className="login-google-btn"
            onClick={handleGoogleClick}
            disabled={isBusy}
            aria-busy={isGoogleSubmitting}
            aria-label="Continue with Google"
          >
            <svg
              className="login-google-icon"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>{isGoogleSubmitting ? "Connecting to Google..." : "Continue with Google"}</span>
          </button>

          {/* Hidden container for Google GSI iframe if needed */}
          <div ref={googleBtnContainerRef} style={{ display: "none" }} aria-hidden="true" />

          {googleConfigNote && (
            <div className="login-google-fallback-note" role="note">
              {googleConfigNote}
            </div>
          )}

          <p className="login-switch">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="login-signup-link"
              disabled={isBusy}
            >
              Sign up
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}