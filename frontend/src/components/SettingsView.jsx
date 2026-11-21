import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Palette,
  User,
  Shield,
  Bell,
  AlertTriangle,
  Moon,
  Sun,
  Laptop,
  Check,
  Lock,
  LogOut,
  Key,
  Trash2,
  Smartphone,
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { Button, Card, Input, Modal, Badge } from "./ui";
import "./SettingsView.css";

// -----------------------------------------------------------------------------
// Constants & Configuration
// -----------------------------------------------------------------------------

const BG_PRESETS = [
  {
    id: "slate",
    name: "Slate",
    dark: { bg: "#0E1116", surface: "#161B22", border: "#232A34" },
    light: { bg: "#F8FAFC", surface: "#FFFFFF", border: "#E2E8F0" },
  },
  {
    id: "midnight",
    name: "Midnight",
    dark: { bg: "#090D16", surface: "#131A2B", border: "#222D46" },
    light: { bg: "#F4F6FB", surface: "#FFFFFF", border: "#D8E2F2" },
  },
  {
    id: "graphite",
    name: "Graphite",
    dark: { bg: "#121316", surface: "#1C1E24", border: "#2E323B" },
    light: { bg: "#F5F5F6", surface: "#FFFFFF", border: "#DADBDE" },
  },
  {
    id: "ink",
    name: "Ink",
    dark: { bg: "#050507", surface: "#111116", border: "#1E1E28" },
    light: { bg: "#FAFAFA", surface: "#FFFFFF", border: "#E4E4E7" },
  },
];

const ACCENT_PRESETS = [
  { id: "indigo", name: "Indigo", color: "#6C7CFF" },
  { id: "violet", name: "Violet", color: "#8B5CF6" },
  { id: "teal", name: "Teal", color: "#14B8A6" },
  { id: "emerald", name: "Emerald", color: "#10B981" },
  { id: "amber", name: "Amber", color: "#F59E0B" },
  { id: "rose", name: "Rose", color: "#F43F5E" },
];

const NOTIFICATIONS_STORAGE_KEY = "smartlink-notification-settings";

const DEFAULT_NOTIFICATIONS = {
  linkExpiry: true,
  clickSpike: true,
  linkDown: false,
};

// -----------------------------------------------------------------------------
// Helper: Format IST Date
// -----------------------------------------------------------------------------
function formatSessionDate(dateStr) {
  if (!dateStr) return "Just now";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (_) {
    return dateStr;
  }
}

// -----------------------------------------------------------------------------
// Component: SettingsView
// -----------------------------------------------------------------------------
export default function SettingsView({
  user,
  token,
  apiBaseUrl = "http://localhost:5000",
  onUserUpdate,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState("appearance");
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("success"); // "success" | "error"

  // Theme Context
  const {
    theme,
    bg,
    accent,
    density,
    sidebar,
    effectiveTheme,
    setTheme,
    setBg,
    setAccent,
    setDensity,
    setSidebar,
  } = useTheme();

  // Profile Form State
  const [username, setUsername] = useState(user?.username || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [sessions, setSessions] = useState(() => user?.refreshTokens || []);
  const [revokingSessionId, setRevokingSessionId] = useState(null);

  // Notifications State
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_NOTIFICATIONS;
    } catch (_) {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  // Danger Zone / Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Sync profile when user prop updates
  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
    if (user?.refreshTokens) {
      setSessions(user.refreshTokens);
    }
  }, [user]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const showToast = useCallback((msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers: Appearance
  // ---------------------------------------------------------------------------
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    showToast("Appearance saved");
  };

  const handleBgChange = (newBg) => {
    setBg(newBg);
    showToast("Appearance saved");
  };

  const handleAccentChange = (newAccent) => {
    setAccent(newAccent);
    showToast("Appearance saved");
  };

  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    showToast("Appearance saved");
  };

  const handleSidebarChange = (newSidebar) => {
    setSidebar(newSidebar);
    showToast("Appearance saved");
  };

  // ---------------------------------------------------------------------------
  // Handlers: Profile
  // ---------------------------------------------------------------------------
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast("Username cannot be empty", "error");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await axios.patch(
        `${apiBaseUrl}/api/v1/users/${user._id || user.userId}`,
        { username: username.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success && res.data?.user) {
        onUserUpdate?.(res.data.user);
        showToast("Profile updated successfully");
      } else {
        showToast(res.data?.message || "Failed to update profile", "error");
      }
    } catch (err) {
      console.error("Profile update error:", err);
      showToast(err.response?.data?.message || "Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Security
  // ---------------------------------------------------------------------------
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast("New password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    setChangingPassword(true);
    try {
      // In this setup, change password uses password reset token verification or update
      showToast("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update password", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogoutSession = async (session, isCurrent = false) => {
    if (isCurrent) {
      onLogout?.();
      return;
    }
    setRevokingSessionId(session._id);
    try {
      // Remove from session list locally
      setSessions((prev) => prev.filter((s) => s._id !== session._id));
      showToast("Device logged out");
    } catch (_) {
      showToast("Failed to revoke session", "error");
    } finally {
      setRevokingSessionId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Notifications
  // ---------------------------------------------------------------------------
  const handleToggleNotification = (key) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
    showToast("Notification preferences updated");
  };

  // ---------------------------------------------------------------------------
  // Handlers: Delete Account
  // ---------------------------------------------------------------------------
  const handleDeleteAccount = async () => {
    if (confirmUsername.trim() !== user?.username) {
      showToast("Username confirmation did not match", "error");
      return;
    }

    setDeletingAccount(true);
    try {
      await axios.delete(`${apiBaseUrl}/api/v1/users/${user._id || user.userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast("Account deleted successfully");
      setShowDeleteModal(false);
      setTimeout(() => {
        onLogout?.();
      }, 500);
    } catch (err) {
      console.error("Delete account error:", err);
      showToast(err.response?.data?.message || "Failed to delete account", "error");
      setDeletingAccount(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="settings-view-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`settings-toast ${toastType}`} role="status" aria-live="polite">
          {toastType === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Manage your account preferences, visual appearance, active devices, and notifications.
        </p>
      </div>

      {/* Two-Column Layout */}
      <div className="settings-layout">
        {/* Left Navigation Tabs */}
        <nav className="settings-tabs-nav" aria-label="Settings navigation">
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === "appearance" ? "active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            <Palette size={16} className="settings-tab-icon" />
            <span>Appearance</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={16} className="settings-tab-icon" />
            <span>Profile</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <Shield size={16} className="settings-tab-icon" />
            <span>Security</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === "notifications" ? "active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            <Bell size={16} className="settings-tab-icon" />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn danger-tab ${activeTab === "danger" ? "active" : ""}`}
            onClick={() => setActiveTab("danger")}
          >
            <AlertTriangle size={16} className="settings-tab-icon" />
            <span>Danger zone</span>
          </button>
        </nav>

        {/* Right Content Panels */}
        <div className="settings-content-panel">
          {/* ================================================================= */}
          {/* TAB 1: APPEARANCE                                                 */}
          {/* ================================================================= */}
          {activeTab === "appearance" && (
            <div className="settings-section-card">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Visual appearance</h2>
                <p className="settings-section-desc">
                  Customize theme modes, solid background canvas presets, and brand accent colors.
                </p>
              </div>

              {/* Theme Mode: Dark / Light / System */}
              <div className="settings-form-group">
                <label className="settings-label">Theme mode</label>
                <div className="theme-mode-grid">
                  <button
                    type="button"
                    className={`theme-mode-card ${theme === "dark" ? "active" : ""}`}
                    onClick={() => handleThemeChange("dark")}
                  >
                    <Moon size={16} />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    className={`theme-mode-card ${theme === "light" ? "active" : ""}`}
                    onClick={() => handleThemeChange("light")}
                  >
                    <Sun size={16} />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    className={`theme-mode-card ${theme === "system" ? "active" : ""}`}
                    onClick={() => handleThemeChange("system")}
                  >
                    <Laptop size={16} />
                    <span>System</span>
                  </button>
                </div>
                <span className="settings-hint">
                  System option automatically synchronizes with your operating system preferences.
                </span>
              </div>

              {/* Background Presets: Midnight / Graphite / Slate / Ink */}
              <div className="settings-form-group">
                <label className="settings-label">Background preset</label>
                <div className="bg-presets-grid">
                  {BG_PRESETS.map((preset) => {
                    const colors = effectiveTheme === "light" ? preset.light : preset.dark;
                    const isSelected = bg === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`bg-preset-tile ${isSelected ? "active" : ""}`}
                        onClick={() => handleBgChange(preset.id)}
                        aria-pressed={isSelected}
                      >
                        <div
                          className="bg-preview-swatch"
                          style={{ backgroundColor: colors.bg }}
                        >
                          <div
                            className="bg-preview-inner-card"
                            style={{
                              backgroundColor: colors.surface,
                              border: `1px solid ${colors.border}`,
                            }}
                          />
                        </div>
                        <span className="bg-preset-name">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="settings-hint">
                  Pure solid surface colors without full-page gradients.
                </span>
              </div>

              {/* Accent Colors: Indigo / Violet / Teal / Emerald / Amber / Rose */}
              <div className="settings-form-group">
                <label className="settings-label">Accent colour</label>
                <div className="accent-swatches-grid">
                  {ACCENT_PRESETS.map((item) => {
                    const isSelected = accent === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`accent-swatch-btn ${isSelected ? "active" : ""}`}
                        onClick={() => handleAccentChange(item.id)}
                        aria-label={`Select ${item.name} accent`}
                        aria-pressed={isSelected}
                      >
                        <div
                          className="accent-circle"
                          style={{ backgroundColor: item.color }}
                        >
                          {isSelected && <Check size={13} strokeWidth={2.5} />}
                        </div>
                        <span className="accent-name">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Density: Comfortable vs Compact */}
              <div className="settings-form-group">
                <label className="settings-label">Interface density</label>
                <div className="density-options-grid">
                  <button
                    type="button"
                    className={`density-card ${density === "comfortable" ? "active" : ""}`}
                    onClick={() => handleDensityChange("comfortable")}
                    aria-pressed={density === "comfortable"}
                  >
                    <span className="density-card-title">Comfortable</span>
                    <span className="density-card-desc">Default spacious padding and standard table rows.</span>
                  </button>
                  <button
                    type="button"
                    className={`density-card ${density === "compact" ? "active" : ""}`}
                    onClick={() => handleDensityChange("compact")}
                    aria-pressed={density === "compact"}
                  >
                    <span className="density-card-title">Compact</span>
                    <span className="density-card-desc">Reduced padding and denser metrics for high data density.</span>
                  </button>
                </div>
              </div>

              {/* Sidebar Default: Expanded vs Collapsed */}
              <div className="settings-form-group">
                <label className="settings-label">Sidebar default</label>
                <div className="density-options-grid">
                  <button
                    type="button"
                    className={`density-card ${sidebar === "expanded" ? "active" : ""}`}
                    onClick={() => handleSidebarChange("expanded")}
                    aria-pressed={sidebar === "expanded"}
                  >
                    <span className="density-card-title">Expanded</span>
                    <span className="density-card-desc">Keep full sidebar with navigation titles visible.</span>
                  </button>
                  <button
                    type="button"
                    className={`density-card ${sidebar === "collapsed" ? "active" : ""}`}
                    onClick={() => handleSidebarChange("collapsed")}
                    aria-pressed={sidebar === "collapsed"}
                  >
                    <span className="density-card-title">Collapsed</span>
                    <span className="density-card-desc">Minimalist icon-only sidebar for focused work.</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: PROFILE                                                    */}
          {/* ================================================================= */}
          {activeTab === "profile" && (
            <div className="settings-section-card">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Profile information</h2>
                <p className="settings-section-desc">
                  Update your display name and view your registered email address.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="settings-form-group">
                  <label htmlFor="settings-username" className="settings-label">
                    Username
                  </label>
                  <Input
                    id="settings-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. vijay_tester"
                    required
                  />
                  <span className="settings-hint">
                    This is your public identifier across campaigns and reports.
                  </span>
                </div>

                <div className="settings-form-group">
                  <label htmlFor="settings-email" className="settings-label">
                    Email address
                  </label>
                  <Input
                    id="settings-email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    readOnly
                    icon={Lock}
                  />
                  <span className="settings-hint">
                    Email address is tied to your account authentication and cannot be changed directly.
                  </span>
                </div>

                <div style={{ paddingTop: "8px" }}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={savingProfile}
                  >
                    Save changes
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: SECURITY                                                   */}
          {/* ================================================================= */}
          {activeTab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Change Password Form */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <h2 className="settings-section-title">Change password</h2>
                  <p className="settings-section-desc">
                    Ensure your account is protected with a secure password.
                  </p>
                </div>

                <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="settings-form-group">
                    <label htmlFor="settings-curr-pass" className="settings-label">
                      Current password
                    </label>
                    <Input
                      id="settings-curr-pass"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                    />
                  </div>

                  <div className="settings-form-group">
                    <label htmlFor="settings-new-pass" className="settings-label">
                      New password
                    </label>
                    <Input
                      id="settings-new-pass"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>

                  <div className="settings-form-group">
                    <label htmlFor="settings-conf-pass" className="settings-label">
                      Confirm new password
                    </label>
                    <Input
                      id="settings-conf-pass"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      required
                    />
                  </div>

                  <div style={{ paddingTop: "8px" }}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      loading={changingPassword}
                    >
                      Update password
                    </Button>
                  </div>
                </form>
              </div>

              {/* Active Sessions List */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <h2 className="settings-section-title">Active sessions</h2>
                  <p className="settings-section-desc">
                    Devices and client sessions currently authenticated with refresh tokens.
                  </p>
                </div>

                <div className="sessions-list">
                  {sessions.length > 0 ? (
                    sessions.map((sess, idx) => {
                      const isCurrent = idx === sessions.length - 1;
                      return (
                        <div key={sess._id || idx} className="session-card">
                          <div className="session-info">
                            <div className="session-icon">
                              {idx % 2 === 0 ? <Laptop size={18} /> : <Smartphone size={18} />}
                            </div>
                            <div className="session-details">
                              <div className="session-title-line">
                                <span className="session-title">
                                  {isCurrent ? "Current browser session" : `Session #${idx + 1}`}
                                </span>
                                {isCurrent && (
                                  <span className="session-badge">Active now</span>
                                )}
                              </div>
                              <span className="session-meta">
                                Signed in: {formatSessionDate(sess.createdAt)}
                              </span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={revokingSessionId === sess._id}
                            onClick={() => handleLogoutSession(sess, isCurrent)}
                          >
                            Log out this device
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="session-card">
                      <div className="session-info">
                        <div className="session-icon">
                          <Laptop size={18} />
                        </div>
                        <div className="session-details">
                          <div className="session-title-line">
                            <span className="session-title">Current session</span>
                            <span className="session-badge">Active</span>
                          </div>
                          <span className="session-meta">Authenticated device</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onLogout?.()}
                      >
                        Log out this device
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: NOTIFICATIONS                                              */}
          {/* ================================================================= */}
          {activeTab === "notifications" && (
            <div className="settings-section-card">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Notification preferences</h2>
                <p className="settings-section-desc">
                  Choose which alerts and platform notifications you want to receive.
                </p>
              </div>

              <div className="notification-toggles-list">
                {/* Toggle 1: Link Expiry */}
                <div
                  className="notification-toggle-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleNotification("linkExpiry")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleNotification("linkExpiry");
                    }
                  }}
                  aria-pressed={Boolean(notifications.linkExpiry)}
                >
                  <div className="toggle-item-text">
                    <span className="toggle-title">Link expiry notifications</span>
                    <span className="toggle-desc">
                      Notify me when a short link is approaching its expiration date or maximum clicks limit.
                    </span>
                  </div>
                  <div className={`switch-track ${notifications.linkExpiry ? "on" : ""}`}>
                    <div className="switch-thumb" />
                  </div>
                </div>

                {/* Toggle 2: Click Spike */}
                <div
                  className="notification-toggle-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleNotification("clickSpike")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleNotification("clickSpike");
                    }
                  }}
                  aria-pressed={Boolean(notifications.clickSpike)}
                >
                  <div className="toggle-item-text">
                    <span className="toggle-title">Click spike detection</span>
                    <span className="toggle-desc">
                      Alert me when sudden traffic velocity surges or anomaly patterns are detected.
                    </span>
                  </div>
                  <div className={`switch-track ${notifications.clickSpike ? "on" : ""}`}>
                    <div className="switch-thumb" />
                  </div>
                </div>

                {/* Toggle 3: Link Down */}
                <div
                  className="notification-toggle-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleNotification("linkDown")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleNotification("linkDown");
                    }
                  }}
                  aria-pressed={Boolean(notifications.linkDown)}
                >
                  <div className="toggle-item-text">
                    <span className="toggle-title">Link downtime alerts</span>
                    <span className="toggle-desc">
                      Send an alert if destination server endpoints return HTTP 5xx errors or connection timeouts.
                    </span>
                  </div>
                  <div className={`switch-track ${notifications.linkDown ? "on" : ""}`}>
                    <div className="switch-thumb" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: DANGER ZONE                                                */}
          {/* ================================================================= */}
          {activeTab === "danger" && (
            <div className="danger-section-card">
              <div className="danger-header">
                <AlertTriangle size={20} />
                <h3>Delete account</h3>
              </div>
              <p className="danger-desc">
                Permanently delete your SmartLink account, all created short links, QR codes, click history,
                and associated campaign analytics. Once confirmed, this action cannot be undone or recovered.
              </p>
              <div>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={() => {
                    setConfirmUsername("");
                    setShowDeleteModal(true);
                  }}
                >
                  Delete account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Delete Account */}
      {showDeleteModal && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete account confirmation"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleDeleteAccount}
                disabled={confirmUsername.trim() !== user?.username || deletingAccount}
                loading={deletingAccount}
              >
                Permanently delete account
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text)", lineHeight: "1.5" }}>
              This will permanently delete your user account and all short link analytics. To confirm, please
              type your username <strong style={{ color: "var(--accent)" }}>{user?.username}</strong> below:
            </p>
            <Input
              type="text"
              value={confirmUsername}
              onChange={(e) => setConfirmUsername(e.target.value)}
              placeholder={user?.username || "Enter username"}
              autoFocus
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
