// CHANGE: Added password recovery — 2026-10-20
import { useState, useEffect } from "react";
import axios from "axios";

const AUTH_URL = "http://localhost:5000/api/v1/users";

function Login({ onLoginSuccess, initialError = "" }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot" | "reset"
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

  // Check URL query parameters for resetToken or token on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get("resetToken") || params.get("token");
      if (tokenParam) {
        setResetToken(tokenParam);
        setMode("reset");
        setError("");
        setSuccessMsg("");
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

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
            window.history.replaceState({}, document.title, window.location.pathname);
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

  const isAuthTabVisible = mode === "login" || mode === "register";

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-logo-icon" aria-hidden="true">S</div>
          <div>
            <h1 className="auth-brand-name">SmartLink</h1>
            <span className="auth-brand-tagline">Link Management & Analytics</span>
          </div>
        </div>

        {/* View Title */}
        <div className="auth-title-section">
          <h2>
            {mode === "login" && "Sign In to SmartLink"}
            {mode === "register" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
            {mode === "reset" && "Set new password"}
          </h2>
          <p>
            {mode === "login" && "Enter your email and password to access your dashboard"}
            {mode === "register" && "Register a new account to shorten, manage, and track your links"}
            {mode === "forgot" && "Enter your registered email address and we'll send you a password reset link."}
            {mode === "reset" && "Enter your new password below to regain access to your account."}
          </p>
        </div>

        {/* Auth Mode Tabs (Sign In / Register) */}
        {isAuthTabVisible && (
          <div className="auth-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`auth-tab-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={`auth-tab-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>
        )}

        {/* Status Messages */}
        {error && (
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

        {successMsg && (
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

        {/* Forms */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Register: Username */}
          {mode === "register" && (
            <div className="auth-input-group">
              <label htmlFor="auth-username">Username</label>
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
                  id="auth-username"
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
          )}

          {/* Login, Register, & Forgot: Email Address */}
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

          {/* Login & Register: Password */}
          {(mode === "login" || mode === "register") && (
            <div className="auth-input-group">
              <div className="auth-label-row">
                <label htmlFor="auth-password">Password</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="auth-forgot-btn"
                    onClick={() => switchMode("forgot")}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
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
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
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
          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-btn-loading">
                <span className="auth-spinner" aria-hidden="true"></span>
                {mode === "login" && "Signing In..."}
                {mode === "register" && "Creating Account..."}
                {mode === "forgot" && "Sending Link..."}
                {mode === "reset" && "Updating Password..."}
              </span>
            ) : (
              <>
                {mode === "login" && "Sign In to Dashboard →"}
                {mode === "register" && "Create Account →"}
                {mode === "forgot" && "Send Reset Link →"}
                {mode === "reset" && "Update Password →"}
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation / Switch Prompts */}
        <div className="auth-footer-prompt">
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

          {mode === "register" && (
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
      </div>
    </div>
  );
}

export default Login;
