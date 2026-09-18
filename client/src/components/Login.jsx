import React, { useState } from "react";
import "./Login.css";
export default function Login({onLogin,onSwitchToSignup }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password.trim()) {
      setError("Enter your email/username and password to continue.");
      return;
    }

    // UI-only placeholder — no real authentication happens here.
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onLogin();
      // setError("This is a UI preview — login isn't connected yet.");
    }, 900);
  };

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

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            <span>{isSubmitting ? "Signing in" : "Sign in"}</span>
          </button>
          
          <p className="login-switch">
         Don't have an account?{" "}
       <button
        type="button"
       onClick={onSwitchToSignup}
      className="login-signup-link"
     >
    Sign up
  </button>
</p>
        </form>
      </main>
    </div>
  );
}