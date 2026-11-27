// CHANGE: Added password recovery — 2026-10-20
import { useState, useEffect } from "react";
import axios from "axios";
import { Link2, TrendingUp, Activity, Globe, QrCode } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useTheme } from "./context/ThemeContext";
import SpecularButton from "./components/SpecularButton";
import PageBackground from "./components/PageBackground";
import DigitalWaveBackground from "./components/DigitalWaveBackground";
import authBg from "./assets/auth-bg.png";

const AUTH_URL = "http://localhost:5000/api/v1/users";

function Login({ onLoginSuccess, initialError = "", initialMode = "login", onNavigate }) {
  const { effectiveTheme } = useTheme();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [mode, setMode] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        if (window.location.pathname === "/register") return "register";
        if (window.location.pathname === "/login") return "login";
      }
    } catch (_) {}
    return initialMode;
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState(initialError);
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Check URL query parameters or pathname for resetToken, token, or prefill url on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pathMatch =
        typeof window !== "undefined"
          ? window.location.pathname.match(/\/reset-password\/([^/?#]+)/)
          : null;
      const tokenParam =
        params.get("resetToken") || params.get("token") || (pathMatch ? pathMatch[1] : null);
      if (tokenParam) {
        setResetToken(tokenParam);
        setMode("reset");
        setError("");
        setSuccessMsg("");
      }
      const prefillUrl = params.get("url");
      if (prefillUrl) {
        try {
          sessionStorage.setItem("smartlink_prefill_url", prefillUrl);
        } catch (_) {}
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Check if Google Client ID is configured and warn if missing
  useEffect(() => {
    if (!googleClientId) {
      console.warn("Google sign-in is not configured: VITE_GOOGLE_CLIENT_ID environment variable is missing.");
    }
  }, [googleClientId]);

  // Handle Google OAuth Success
  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError("Failed to retrieve Google credentials.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      // POST to /api/users/google using the same API client and token storage as normal login
      const response = await axios.post(
        "/api/users/google",
        { credential: credentialResponse.credential },
        { withCredentials: true }
      );

      if (response.data?.success && response.data?.token) {
        localStorage.setItem("token", response.data.token);
        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }
        if (onLoginSuccess) {
          onLoginSuccess(response.data.token, response.data.user);
        }
        if (onNavigate) {
          onNavigate("/dashboard");
        } else {
          window.history.pushState({}, "", "/dashboard");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      } else {
        setError(response.data?.message || "Google sign-in failed. Please try again.");
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Google sign-in failed. Please try again later.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.warn("Google Sign-In prompt failed or was closed.");
    setError("Google Sign-In was cancelled or failed to load.");
  };

  const handleSocialClick = (provider) => {
    setError("");
    setSuccessMsg(`Demo ${mode} with ${provider}.`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const trimmedEmail = email.trim();

    // -------------------------------------------------------------------------
    // FORGOT PASSWORD SUBMIT
    // -------------------------------------------------------------------------
    if (mode === "forgot") {
      if (!trimmedEmail) {
        setError("Please enter your registered email address.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }

      setLoading(true);
      try {
        const response = await axios.post(`${AUTH_URL}/forgot-password`, {
          email: trimmedEmail,
        });

        // Always show the generic response returned by the backend
        setSuccessMsg(
          response.data?.message ||
            "If an account with that email exists, a password reset link has been sent."
        );
        setEmail("");
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          "Unable to process password reset request. Please check your backend connection.";
        setError(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // RESET PASSWORD SUBMIT
    // -------------------------------------------------------------------------
    if (mode === "reset") {
      if (!resetToken.trim()) {
        setError("Missing or invalid reset token. Please use the link sent to your email.");
        return;
      }

      if (!newPassword) {
        setError("Please enter a new password.");
        return;
      }

      if (newPassword.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("Passwords do not match. Please re-enter.");
        return;
      }

      setLoading(true);
      try {
        const response = await axios.post(`${AUTH_URL}/reset-password`, {
          token: resetToken.trim(),
          newPassword,
        });

        if (response.data?.success) {
          setSuccessMsg(
            response.data?.message ||
              "Password has been reset successfully! You can now log in with your new password."
          );
          setNewPassword("");
          setConfirmPassword("");
          setResetToken("");

          // Clean up resetToken from URL without reloading
          if (window.history && window.history.replaceState) {
            const nextPath =
              window.location.pathname.startsWith("/reset-password") ? "/login" : window.location.pathname;
            window.history.replaceState({}, document.title, nextPath);
          }

          setMode("login");
        } else {
          setError(response.data?.message || "Failed to reset password.");
        }
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          "Password reset link is invalid or has expired. Please request a new link.";
        setError(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // LOGIN & REGISTER SUBMITS
    // -------------------------------------------------------------------------
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    if (mode === "register" && !username.trim()) {
      setError("Username is required to create an account.");
      return;
    }

    setLoading(true);

    try {
      // CHANGE: Added persistent session refresh tokens — 2026-10-21
      if (mode === "login") {
        const response = await axios.post(
          `${AUTH_URL}/login`,
          {
            email: trimmedEmail,
            password,
          },
          { withCredentials: true }
        );

        if (response.data?.success && response.data?.token) {
          localStorage.setItem("token", response.data.token);
          onLoginSuccess(response.data.token, response.data.user);
        } else {
          setError(response.data?.message || "Login failed. Please check your credentials.");
        }
      } else {
        // Register mode using existing backend createUser endpoint
        const regResponse = await axios.post(`${AUTH_URL}/register`, {
          username: username.trim(),
          email: trimmedEmail,
          password,
        });

        if (regResponse.data?.success) {
          // Automatically log in with the newly registered user
          const loginResponse = await axios.post(
            `${AUTH_URL}/login`,
            {
              email: trimmedEmail,
              password,
            },
            { withCredentials: true }
          );

          if (loginResponse.data?.success && loginResponse.data?.token) {
            localStorage.setItem("token", loginResponse.data.token);
            onLoginSuccess(loginResponse.data.token, loginResponse.data.user);
          } else {
            setSuccessMsg("Account created successfully! Please log in.");
            setMode("login");
          }
        } else {
          setError(regResponse.data?.message || "Registration failed.");
        }
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Unable to connect to the authentication service. Please check your backend.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccessMsg("");
  };

  return (
    <div className="page auth-wrapper">
      <DigitalWaveBackground />
      <main
        className={`auth-card auth-sliding-card ${mode === "register" ? "register" : ""}`}
        id="authCard"
      >
        {/* Sliding Image Panel Background */}
        <div
          className="auth-slide-bg"
          style={{ backgroundImage: `url(${authBg})` }}
          aria-hidden="true"
        />

        {/* HERO: Register view (shown on left when mode is register) */}
        <section className="auth-hero register" aria-label="Existing account">
          {/* Middle: heading, one-line subtext, switch button, and floating stat card */}
          <div className="auth-hero-center">
            <div className="auth-hero-middle">
              <h2 className="auth-hero-title">Welcome back</h2>
              <p className="auth-hero-subtext">Login to review your account and continue your journey.</p>
              <button
                type="button"
                className="auth-hero-switch"
                onClick={() => switchMode("login")}
              >
                Login
              </button>
            </div>

            {/* Small glass-style floating card */}
            <div className="auth-hero-glass-card">
              <div className="auth-hero-stat-row">
                <div className="auth-hero-stat-meta">
                  <span className="auth-hero-stat-label">Total clicks</span>
                  <span className="auth-hero-stat-num">34</span>
                </div>
                <div className="auth-hero-stat-badge">
                  <TrendingUp size={12} strokeWidth={2.6} />
                  <span>+34 vs last 30 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: 3 short feature points with small icons & developer profile links */}
          <div className="auth-hero-bottom">
            <div className="auth-hero-features">
              <div className="auth-hero-feature-item">
                <div className="auth-hero-feature-icon" aria-hidden="true">
                  <Activity size={13} strokeWidth={2.4} />
                </div>
                <span>Track every click</span>
              </div>
              <div className="auth-hero-feature-item">
                <div className="auth-hero-feature-icon" aria-hidden="true">
                  <Globe size={13} strokeWidth={2.4} />
                </div>
                <span>Country and device insights</span>
              </div>
              <div className="auth-hero-feature-item">
                <div className="auth-hero-feature-icon" aria-hidden="true">
                  <QrCode size={13} strokeWidth={2.4} />
                </div>
                <span>Branded QR codes</span>
              </div>
            </div>

            {/* Welcome Panel Profile Social Links */}
            <div className="auth-hero-social" aria-label="Developer profiles">
              <span className="auth-hero-social-heading">Connect with Developer</span>
              <div className="auth-hero-social-links">
                <a
                  href="https://github.com/pawarvijaykumar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth-hero-social-link auth-hero-social-link--github"
                  aria-label="Visit Vijay Kumar's GitHub Profile (opens in new tab)"
                >
                  <svg
                    className="auth-hero-social-svg"
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
                    />
                  </svg>
                  <span className="auth-hero-social-name">GitHub</span>
                  <span className="auth-hero-tooltip" role="tooltip">
                    GitHub Profile
                  </span>
                </a>

                <a
                  href="https://www.linkedin.com/in/vijaykumar-pawar-943a64409/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth-hero-social-link auth-hero-social-link--linkedin"
                  aria-label="Visit Vijay Kumar's LinkedIn Profile (opens in new tab)"
                >
                  <svg
                    className="auth-hero-social-svg"
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
                  </svg>
                  <span className="auth-hero-social-name">LinkedIn</span>
                  <span className="auth-hero-tooltip" role="tooltip">
                    LinkedIn Profile
                  </span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* HERO: Login view (shown on right when mode is login/forgot/reset) */}
        <section className="auth-hero login" aria-label="New account">
          {/* Middle: heading, one-line subtext, switch button, and floating stat card */}
          <div className="auth-hero-center">
            <div className="auth-hero-middle">
              {mode === "forgot" || mode === "reset" ? (
                <>
                  <h2 className="auth-hero-title">Remember it?</h2>
                  <p className="auth-hero-subtext">If you remember your password, you can sign in directly.</p>
                  <button
                    type="button"
                    className="auth-hero-switch"
                    onClick={() => switchMode("login")}
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  <h2 className="auth-hero-title">Hello there</h2>
                  <p className="auth-hero-subtext">Begin your journey with us and discover something new.</p>
                  <button
                    type="button"
                    className="auth-hero-switch"
                    onClick={() => switchMode("register")}
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>

            {/* Small glass-style floating card */}
            <div className="auth-hero-glass-card">
              <div className="auth-hero-stat-row">
                <div className="auth-hero-stat-meta">
                  <span className="auth-hero-stat-label">Total clicks</span>
                  <span className="auth-hero-stat-num">34</span>
                </div>
                <div className="auth-hero-stat-badge">
                  <TrendingUp size={12} strokeWidth={2.6} />
                  <span>+34 vs last 30 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: 3 short feature points with small icons & developer profile links */}
          <div className="auth-hero-bottom">
            <div className="auth-hero-features">
              <div className="auth-hero-feature-item">
                <div className="auth-hero-feature-icon" aria-hidden="true">
                  <Activity size={13} strokeWidth={2.4} />
                </div>
                <span>Track every click</span>
              </div>
              <div className="auth-hero-feature-item">
                <div className="auth-hero-feature-icon" aria-hidden="true">
                  <Globe size={13} strokeWidth={2.4} />
                </div>
                <span>Country and device insights</span>
              </div>
              <div className="auth-hero-feature-item">
                <div className="auth-hero-feature-icon" aria-hidden="true">
                  <QrCode size={13} strokeWidth={2.4} />
                </div>
                <span>Branded QR codes</span>
              </div>
            </div>

            {/* Welcome Panel Profile Social Links */}
            <div className="auth-hero-social" aria-label="Developer profiles">
              <span className="auth-hero-social-heading">Connect with Developer</span>
              <div className="auth-hero-social-links">
                <a
                  href="https://github.com/pawarvijaykumar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth-hero-social-link auth-hero-social-link--github"
                  aria-label="Visit Vijay Kumar's GitHub Profile (opens in new tab)"
                >
                  <svg
                    className="auth-hero-social-svg"
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
                    />
                  </svg>
                  <span className="auth-hero-social-name">GitHub</span>
                  <span className="auth-hero-tooltip" role="tooltip">
                    GitHub Profile
                  </span>
                </a>

                <a
                  href="https://www.linkedin.com/in/vijaykumar-pawar-943a64409/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth-hero-social-link auth-hero-social-link--linkedin"
                  aria-label="Visit Vijay Kumar's LinkedIn Profile (opens in new tab)"
                >
                  <svg
                    className="auth-hero-social-svg"
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
                  </svg>
                  <span className="auth-hero-social-name">LinkedIn</span>
                  <span className="auth-hero-tooltip" role="tooltip">
                    LinkedIn Profile
                  </span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FORM PANEL: Login / Forgot / Reset (left half on desktop) */}
        <section
          className={`auth-panel login ${mode !== "register" ? "active" : ""}`}
          aria-label={mode === "forgot" ? "Forgot password" : mode === "reset" ? "Reset password" : "Sign in"}
        >
          <div className="auth-panel-inner">
            {/* Brand Header */}
            <div className="auth-brand">
              <div className="auth-logo-icon" aria-hidden="true">
                <Link2 size={22} strokeWidth={2.2} />
              </div>
              <div className="auth-brand-info">
                <h1 className="auth-brand-name">SmartLink</h1>
                <span className="auth-brand-tagline">Link Management & Analytics</span>
              </div>
            </div>

            {/* View Title */}
            <div className="auth-title-section">
              <h2>
                {mode === "login" && "Welcome back"}
                {mode === "forgot" && "Reset your password"}
                {mode === "reset" && "Set new password"}
              </h2>
              <p>
                {mode === "login" && "Sign in to continue to your account."}
                {mode === "forgot" && "Enter your registered email address and we'll send you a password reset link."}
                {mode === "reset" && "Enter your new password below to regain access to your account."}
              </p>
            </div>

            {/* Status Messages */}
            {error && mode !== "register" && (
              <div className="auth-alert error" role="alert">
                <svg
                  className="auth-alert-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {successMsg && mode !== "register" && (
              <div className="auth-alert success" role="status">
                <svg
                  className="auth-alert-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {/* Login & Forgot Email */}
              {mode !== "reset" && (
                <div className="auth-input-group">
                  <label htmlFor="auth-email">Email Address</label>
                  <div className="auth-input-wrapper">
                    <svg
                      className="auth-input-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                      id="auth-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Login: Password */}
              {mode === "login" && (
                <div className="auth-input-group">
                  <label htmlFor="auth-password">Password</label>
                  <div className="auth-input-wrapper">
                    <svg
                      className="auth-input-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-toggle-pwd"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="auth-options-row">
                    <label className="auth-remember-me">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span>Remember me</span>
                    </label>
                    <button
                      type="button"
                      className="auth-forgot-btn"
                      onClick={() => switchMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              )}

              {/* Reset: New Password & Confirm Password */}
              {mode === "reset" && (
                <>
                  <div className="auth-input-group">
                    <label htmlFor="auth-new-password">New Password</label>
                    <div className="auth-input-wrapper">
                      <svg
                        className="auth-input-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="18"
                        height="18"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        id="auth-new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pwd"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? "Hide password" : "Show password"}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="auth-confirm-password">Confirm New Password</label>
                    <div className="auth-input-wrapper">
                      <svg
                        className="auth-input-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="18"
                        height="18"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        id="auth-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repeat new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pwd"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <SpecularButton
                type="submit"
                variant="primary"
                size="lg"
                className="auth-submit-btn"
                disabled={loading}
                loading={loading}
              >
                {loading ? (
                  <span className="auth-btn-loading">
                    <span className="auth-spinner" aria-hidden="true"></span>
                    {mode === "login" && "Signing In..."}
                    {mode === "forgot" && "Sending Link..."}
                    {mode === "reset" && "Updating Password..."}
                  </span>
                ) : (
                  <>
                    {mode === "login" && "Sign in"}
                    {mode === "forgot" && "Send Reset Link →"}
                    {mode === "reset" && "Update Password →"}
                  </>
                )}
              </SpecularButton>

              {/* Social Login on Login tab */}
              {mode === "login" && (
                <>
                  <div className="auth-divider">
                    <span>Or sign in with</span>
                  </div>

                  <div className="auth-social-group">
                    {/* Google */}
                    <div className="auth-social-btn-wrap">
                      <button
                        type="button"
                        className="auth-social-btn auth-social-btn--google"
                        aria-label="Sign in with Google"
                        title="Google"
                        onClick={() => handleSocialClick("Google")}
                      >
                        <svg className="auth-social-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <path fill="#4285F4" d="M21.35 12.23c0-.74-.07-1.45-.22-2.12H12v4.01h5.24a4.48 4.48 0 0 1-1.95 2.94v2.44h3.15c1.84-1.69 2.91-4.18 2.91-7.27Z"/>
                          <path fill="#34A853" d="M12 21.99c2.63 0 4.84-.87 6.45-2.49l-3.15-2.44c-.87.58-1.98.93-3.3.93-2.54 0-4.69-1.72-5.46-4.03H3.29v2.52A9.75 9.75 0 0 0 12 21.99Z"/>
                          <path fill="#FBBC05" d="M6.54 13.96A5.86 5.86 0 0 1 6.23 12c0-.68.12-1.34.31-1.96V7.52H3.29A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.04 4.48l3.25-2.52Z"/>
                          <path fill="#EA4335" d="M12 6.01c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.02 14.63 2.01 12 2.01a9.75 9.75 0 0 0-8.71 5.51l3.25 2.52C7.31 7.73 9.46 6.01 12 6.01Z"/>
                        </svg>
                        <span className="auth-social-label">Google</span>
                      </button>

                      {googleClientId && (
                        <div className="auth-google-overlay" aria-hidden="true">
                          <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            text="continue_with"
                            shape="rectangular"
                            size="large"
                          />
                        </div>
                      )}
                    </div>

                    {/* GitHub */}
                    <button
                      type="button"
                      className="auth-social-btn auth-social-btn--github"
                      aria-label="Sign in with GitHub"
                      title="GitHub"
                      onClick={() => handleSocialClick("GitHub")}
                    >
                      <svg className="auth-social-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
                      </svg>
                      <span className="auth-social-label">GitHub</span>
                    </button>

                    {/* LinkedIn */}
                    <button
                      type="button"
                      className="auth-social-btn auth-social-btn--linkedin"
                      aria-label="Sign in with LinkedIn"
                      title="LinkedIn"
                      onClick={() => handleSocialClick("LinkedIn")}
                    >
                      <svg className="auth-social-icon" viewBox="0 0 24 24" width="18" height="18" fill="#0A66C2" aria-hidden="true">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z"/>
                      </svg>
                      <span className="auth-social-label">LinkedIn</span>
                    </button>
                  </div>
                </>
              )}
            </form>

            {/* Mobile-only toggle prompt */}
            <div className="auth-footer-prompt mobile-only">
              {mode === "login" && (
                <p>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="auth-inline-link"
                    onClick={() => switchMode("register")}
                  >
                    Create one now
                  </button>
                </p>
              )}
              {(mode === "forgot" || mode === "reset") && (
                <p>
                  Remember your password?{" "}
                  <button
                    type="button"
                    className="auth-inline-link"
                    onClick={() => switchMode("login")}
                  >
                    Sign in here
                  </button>
                </p>
              )}
            </div>

            <div className="auth-back-link-wrapper">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  if (onNavigate) {
                    onNavigate("/");
                  } else {
                    window.history.pushState({}, "", "/");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }
                }}
                className="auth-back-link"
              >
                &larr; Back to home
              </a>
            </div>
          </div>
        </section>

        {/* FORM PANEL: Register (right half on desktop) */}
        <section
          className={`auth-panel register ${mode === "register" ? "active" : ""}`}
          aria-label="Create account"
        >
          <div className="auth-panel-inner">
            {/* Brand Header */}
            <div className="auth-brand">
              <div className="auth-logo-icon" aria-hidden="true">
                <Link2 size={22} strokeWidth={2.2} />
              </div>
              <div className="auth-brand-info">
                <h1 className="auth-brand-name">SmartLink</h1>
                <span className="auth-brand-tagline">Link Management & Analytics</span>
              </div>
            </div>

            {/* View Title */}
            <div className="auth-title-section">
              <h2>Create account</h2>
              <p>Create your account and begin your journey.</p>
            </div>

            {/* Status Messages */}
            {error && mode === "register" && (
              <div className="auth-alert error" role="alert">
                <svg
                  className="auth-alert-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {successMsg && mode === "register" && (
              <div className="auth-alert success" role="status">
                <svg
                  className="auth-alert-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            {/* Register Form */}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {/* Username / Full Name */}
              <div className="auth-input-group">
                <label htmlFor="auth-reg-username">Full name</label>
                <div className="auth-input-wrapper">
                  <svg
                    className="auth-input-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    id="auth-reg-username"
                    type="text"
                    placeholder="Enter your name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="auth-input-group">
                <label htmlFor="auth-reg-email">Email</label>
                <div className="auth-input-wrapper">
                  <svg
                    className="auth-input-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    id="auth-reg-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-input-group">
                <label htmlFor="auth-reg-password">Password</label>
                <div className="auth-input-wrapper">
                  <svg
                    className="auth-input-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="auth-reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pwd"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <SpecularButton
                type="submit"
                variant="primary"
                size="lg"
                className="auth-submit-btn"
                disabled={loading}
                loading={loading}
              >
                {loading ? (
                  <span className="auth-btn-loading">
                    <span className="auth-spinner" aria-hidden="true"></span>
                    Creating Account...
                  </span>
                ) : (
                  "Create account"
                )}
              </SpecularButton>

              {/* Social Login on Register tab */}
              <div className="auth-divider">
                <span>Or sign up with</span>
              </div>

              <div className="auth-social-group">
                {/* Google */}
                <div className="auth-social-btn-wrap">
                  <button
                    type="button"
                    className="auth-social-btn auth-social-btn--google"
                    aria-label="Sign up with Google"
                    title="Google"
                    onClick={() => handleSocialClick("Google")}
                  >
                    <svg className="auth-social-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="#4285F4" d="M21.35 12.23c0-.74-.07-1.45-.22-2.12H12v4.01h5.24a4.48 4.48 0 0 1-1.95 2.94v2.44h3.15c1.84-1.69 2.91-4.18 2.91-7.27Z"/>
                      <path fill="#34A853" d="M12 21.99c2.63 0 4.84-.87 6.45-2.49l-3.15-2.44c-.87.58-1.98.93-3.3.93-2.54 0-4.69-1.72-5.46-4.03H3.29v2.52A9.75 9.75 0 0 0 12 21.99Z"/>
                      <path fill="#FBBC05" d="M6.54 13.96A5.86 5.86 0 0 1 6.23 12c0-.68.12-1.34.31-1.96V7.52H3.29A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.04 4.48l3.25-2.52Z"/>
                      <path fill="#EA4335" d="M12 6.01c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.02 14.63 2.01 12 2.01a9.75 9.75 0 0 0-8.71 5.51l3.25 2.52C7.31 7.73 9.46 6.01 12 6.01Z"/>
                    </svg>
                    <span className="auth-social-label">Google</span>
                  </button>

                  {googleClientId && (
                    <div className="auth-google-overlay" aria-hidden="true">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        text="continue_with"
                        shape="rectangular"
                        size="large"
                      />
                    </div>
                  )}
                </div>

                {/* GitHub */}
                <button
                  type="button"
                  className="auth-social-btn auth-social-btn--github"
                  aria-label="Sign up with GitHub"
                  title="GitHub"
                  onClick={() => handleSocialClick("GitHub")}
                >
                  <svg className="auth-social-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
                  </svg>
                  <span className="auth-social-label">GitHub</span>
                </button>

                {/* LinkedIn */}
                <button
                  type="button"
                  className="auth-social-btn auth-social-btn--linkedin"
                  aria-label="Sign up with LinkedIn"
                  title="LinkedIn"
                  onClick={() => handleSocialClick("LinkedIn")}
                >
                  <svg className="auth-social-icon" viewBox="0 0 24 24" width="18" height="18" fill="#0A66C2" aria-hidden="true">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z"/>
                  </svg>
                  <span className="auth-social-label">LinkedIn</span>
                </button>
              </div>

              <p className="auth-terms">
                By creating an account, you agree to the terms and privacy policy.
              </p>
            </form>

            {/* Mobile-only toggle prompt */}
            <div className="auth-footer-prompt mobile-only">
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  className="auth-inline-link"
                  onClick={() => switchMode("login")}
                >
                  Sign in here
                </button>
              </p>
            </div>

            <div className="auth-back-link-wrapper">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  if (onNavigate) {
                    onNavigate("/");
                  } else {
                    window.history.pushState({}, "", "/");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }
                }}
                className="auth-back-link"
              >
                &larr; Back to home
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Login;
