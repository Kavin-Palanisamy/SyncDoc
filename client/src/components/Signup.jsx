import React, { useState } from "react";
import "./Login.css";

export default function Signup({ onSwitchToLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Please fill in all fields to continue.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setError("This is a UI preview — signup isn't connected yet.");
    }, 900);
  };

  const handleLoginClick = (e) => {
    if (onSwitchToLogin) {
      e.preventDefault();
      onSwitchToLogin();
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-aurora signup-aurora--one" aria-hidden="true" />
      <div className="signup-aurora signup-aurora--two" aria-hidden="true" />
      <div className="signup-grain" aria-hidden="true" />

      <main className="signup-card" role="main">
        <div className="signup-mark" aria-hidden="true">
          <span className="signup-mark__glyph">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2.5L14.2 9.3L21 12L14.2 14.7L12 21.5L9.8 14.7L3 12L9.8 9.3L12 2.5Z"
                fill="url(#starGradientSignup)"
              />
              <defs>
                <linearGradient id="starGradientSignup" x1="3" y1="2.5" x2="21" y2="21.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#c4b5fd" />
                  <stop offset="1" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </div>

        <header className="signup-header">
          <h1 className="signup-title">Create your account</h1>
          <p className="signup-subtitle">Join to start your journey with us.</p>
        </header>

        <form className="signup-form" onSubmit={handleSubmit} noValidate>
          <div className="signup-field">
            <label htmlFor="fullName">Full name</label>
            <div className="signup-input-shell">
              <svg className="signup-input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 19c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          <div className="signup-field">
            <label htmlFor="email">Email</label>
            <div className="signup-input-shell">
              <svg className="signup-input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path
                  d="M3.5 6.5C3.5 5.67157 4.17157 5 5 5H19C19.8284 5 20.5 5.67157 20.5 6.5V17.5C20.5 18.3284 19.8284 19 19 19H5C4.17157 19 3.5 18.3284 3.5 17.5V6.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path d="M4.5 6.5L12 12.5L19.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="signup-field">
            <label htmlFor="password">Password</label>
            <div className="signup-input-shell">
              <svg className="signup-input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 10.5V7.5C8 5.29086 9.79086 3.5 12 3.5C14.2091 3.5 16 5.29086 16 7.5V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="signup-visibility-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </div>

          <div className="signup-field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <div className="signup-input-shell">
              <svg className="signup-input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 10.5V7.5C8 5.29086 9.79086 3.5 12 3.5C14.2091 3.5 16 5.29086 16 7.5V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="signup-visibility-toggle"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </div>

          <div className={`signup-error ${error ? "signup-error--visible" : ""}`} role="alert" aria-live="polite">
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

          <button type="submit" className="signup-submit" disabled={isSubmitting}>
            <span>{isSubmitting ? "Creating account" : "Create account"}</span>
          </button>

          <p className="signup-switch">
            Already have an account?{" "}
            <a href="/login" onClick={handleLoginClick}>
              Login
            </a>
          </p>
        </form>
      </main>
    </div>
  );
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M2.5 12C3.7 8.4 7.5 5.5 12 5.5C16.5 5.5 20.3 8.4 21.5 12C20.3 15.6 16.5 18.5 12 18.5C7.5 18.5 3.7 15.6 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M3 3L21 21M10.6 10.7C10.2 11.1 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 12.9 13.8 13.3 13.5M6.5 6.7C4.5 8 3 10 2.5 12C3.7 15.6 7.5 18.5 12 18.5C13.8 18.5 15.5 18 16.9 17.2M9.5 5.2C10.3 5 11.1 4.9 12 4.9C16.5 4.9 20.3 7.8 21.5 11.4C21.1 12.6 20.4 13.7 19.5 14.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}