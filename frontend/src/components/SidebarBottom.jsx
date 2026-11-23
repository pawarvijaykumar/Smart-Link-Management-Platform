import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  BookOpen,
  Info,
  Settings as SettingsIcon,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  X,
  Zap,
  CheckCircle2,
  Check,
} from "lucide-react";
import { Badge } from "./ui/Badge";
import { useTheme } from "../context/ThemeContext";
import {
  PLAN_LIMITS,
  CURRENT_PLAN,
  APP_INFO,
} from "../config/plans.config";
import { CHANGELOG } from "../data/changelog";
import "./SidebarBottom.css";

export default function SidebarBottom({
  isCollapsed = false,
  totalLinks = 0,
  totalClicks = 0,
  user,
  onNavigate,
  onLogout,
}) {
  const { effectiveTheme, setTheme } = useTheme();
  const [activePopover, setActivePopover] = useState(null); // "whatsNew" | "about" | "profile" | null
  const [hasUnreadWhatsNew, setHasUnreadWhatsNew] = useState(false);
  const containerRef = useRef(null);

  const plan = PLAN_LIMITS[CURRENT_PLAN] || PLAN_LIMITS.pro;
  const maxLinks = plan.maxLinks || 50;
  const maxClicks = plan.maxClicks || 10000;
  const linksPct = Math.min(100, Math.round((totalLinks / maxLinks) * 100));
  const clicksPct = Math.min(100, Math.round((totalClicks / maxClicks) * 100));

  // Latest 3 updates from single source of truth changelog data
  const latestUpdates = CHANGELOG.slice(0, 3).map((entry) => {
    const parts = entry.date.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const formattedDate = monthNames[m] ? `${monthNames[m]} ${d}` : entry.date;
    return {
      version: entry.version || entry.category.toUpperCase(),
      title: entry.title,
      desc: entry.description,
      date: formattedDate,
    };
  });

  // Check unread state for What's New by version
  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem("smartlink_whats_new_version");
      if (storedVersion !== APP_INFO.version) {
        setHasUnreadWhatsNew(true);
      }
    } catch (_) {}
  }, []);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActivePopover(null);
      }
    };
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActivePopover(null);
      }
    };

    if (activePopover) {
      window.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [activePopover]);

  const handleToggleWhatsNew = () => {
    if (activePopover === "whatsNew") {
      setActivePopover(null);
    } else {
      setActivePopover("whatsNew");
      // Mark as read
      try {
        localStorage.setItem("smartlink_whats_new_version", APP_INFO.version);
        setHasUnreadWhatsNew(false);
      } catch (_) {}
    }
  };

  const handleToggleAbout = () => {
    setActivePopover((prev) => (prev === "about" ? null : "about"));
  };

  const handleToggleProfile = () => {
    setActivePopover((prev) => (prev === "profile" ? null : "profile"));
  };

  const toggleTheme = (e) => {
    e.stopPropagation();
    const nextTheme = effectiveTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const username = user?.username || "Vijay";
  const userInitial = username.charAt(0).toUpperCase();

  return (
    <div
      ref={containerRef}
      className={`sidebar-bottom-block ${isCollapsed ? "is-collapsed" : ""}`}
    >
      {/* 1. Usage Card (Expanded mode only) */}
      {!isCollapsed && (
        <div className="sidebar-usage-card">
          <div className="usage-card-header">
            <span className="usage-card-title">Plan Usage</span>
            <span className="usage-card-plan">{plan.name}</span>
          </div>

          {/* Links Progress */}
          <div className="usage-item">
            <div className="usage-label-row">
              <span className="usage-label">Links</span>
              <span className="usage-value">
                {totalLinks} / {maxLinks}
              </span>
            </div>
            <div className="usage-track" role="progressbar" aria-valuenow={totalLinks} aria-valuemin="0" aria-valuemax={maxLinks}>
              <div
                className="usage-fill"
                style={{ width: `${Math.max(linksPct, 2)}%` }}
              />
            </div>
          </div>

          {/* Clicks Progress */}
          <div className="usage-item">
            <div className="usage-label-row">
              <span className="usage-label">Clicks</span>
              <span className="usage-value">
                {totalClicks.toLocaleString()} / {maxClicks.toLocaleString()}
              </span>
            </div>
            <div className="usage-track" role="progressbar" aria-valuenow={totalClicks} aria-valuemin="0" aria-valuemax={maxClicks}>
              <div
                className="usage-fill"
                style={{ width: `${Math.max(clicksPct, 2)}%` }}
              />
            </div>
          </div>

          {/* Upgrade Text Link */}
          {!plan.isHighest && (
            <div className="usage-card-footer">
              <button
                type="button"
                className="usage-upgrade-link"
                onClick={() => onNavigate && onNavigate("/pricing")}
              >
                <span>Upgrade plan</span>
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Secondary Navigation Rows */}
      <nav className="sidebar-bottom-nav" aria-label="Support & Meta Navigation">
        {/* Row B: What's New */}
        <div className="sidebar-popover-anchor">
          <button
            type="button"
            className={`sidebar-bottom-row ${activePopover === "whatsNew" ? "active" : ""}`}
            onClick={handleToggleWhatsNew}
            aria-expanded={activePopover === "whatsNew"}
            aria-haspopup="dialog"
            aria-label="What's new"
            data-tooltip="What's new"
            title={isCollapsed ? "What's new" : undefined}
          >
            <span className="row-icon-wrap">
              <Sparkles size={16} />
              {hasUnreadWhatsNew && (
                <span
                  className="row-unread-dot"
                  aria-label="New updates available"
                />
              )}
            </span>
            {!isCollapsed && <span className="row-label">What&apos;s new</span>}
            {!isCollapsed && hasUnreadWhatsNew && (
              <span className="badge-new-pill">NEW</span>
            )}
          </button>

          {/* What's New Popover */}
          {activePopover === "whatsNew" && (
            <div
              className={`sidebar-popover whats-new-popover ${isCollapsed ? "popover-flyout" : "popover-upward"}`}
              role="dialog"
              aria-label="Latest product updates"
            >
              <div className="popover-header">
                <div className="popover-header-title">
                  <Sparkles size={15} className="popover-title-icon" />
                  <span>What&apos;s new</span>
                  <Badge variant="accent" size="sm">
                    {APP_INFO.version}
                  </Badge>
                </div>
                <button
                  type="button"
                  className="popover-close-btn"
                  onClick={() => setActivePopover(null)}
                  aria-label="Close updates"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="popover-body whats-new-list">
                {latestUpdates.map((update, idx) => (
                  <div key={idx} className="whats-new-item">
                    <div className="whats-new-meta">
                      <span className="whats-new-version">{update.version}</span>
                      <span className="whats-new-date">{update.date}</span>
                    </div>
                    <h4 className="whats-new-item-title">{update.title}</h4>
                    <p className="whats-new-item-desc">{update.desc}</p>
                  </div>
                ))}
              </div>

              <div className="popover-footer">
                <button
                  type="button"
                  className="popover-link-btn"
                  onClick={() => {
                    setActivePopover(null);
                    onNavigate && onNavigate("/changelog");
                  }}
                >
                  <span>View full changelog</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Row C: Help & Docs */}
        <button
          type="button"
          className="sidebar-bottom-row"
          onClick={() => onNavigate && onNavigate("/docs")}
          aria-label="Help & documentation"
          data-tooltip="Help & docs"
          title={isCollapsed ? "Help & docs" : undefined}
        >
          <span className="row-icon-wrap">
            <BookOpen size={16} />
          </span>
          {!isCollapsed && <span className="row-label">Help & docs</span>}
        </button>

        {/* Row D: About */}
        <div className="sidebar-popover-anchor">
          <button
            type="button"
            className={`sidebar-bottom-row ${activePopover === "about" ? "active" : ""}`}
            onClick={handleToggleAbout}
            aria-expanded={activePopover === "about"}
            aria-haspopup="dialog"
            aria-label="About SmartLink"
            data-tooltip="About"
            title={isCollapsed ? "About" : undefined}
          >
            <span className="row-icon-wrap">
              <Info size={16} />
            </span>
            {!isCollapsed && <span className="row-label">About</span>}
          </button>

          {/* About Popover */}
          {activePopover === "about" && (
            <div
              className={`sidebar-popover about-popover ${isCollapsed ? "popover-flyout" : "popover-upward"}`}
              role="dialog"
              aria-label="About SmartLink"
            >
              <div className="popover-header">
                <div className="popover-header-title">
                  <Info size={15} className="popover-title-icon" />
                  <span>About SmartLink</span>
                </div>
                <button
                  type="button"
                  className="popover-close-btn"
                  onClick={() => setActivePopover(null)}
                  aria-label="Close about popover"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="popover-body about-body">
                <div className="about-app-info">
                  <span className="about-app-name">SmartLink Platform</span>
                  <span className="about-app-version">{APP_INFO.version}</span>
                </div>

                <div className="about-status-card">
                  <div className="status-indicator-row">
                    <span className="status-dot-pulse" aria-hidden="true" />
                    <span className="status-text">
                      System status: <strong>{APP_INFO.status}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="status-action-link"
                    onClick={() => {
                      setActivePopover(null);
                      onNavigate && onNavigate(APP_INFO.statusUrl);
                    }}
                  >
                    Status page &rarr;
                  </button>
                </div>

                <div className="about-links-list">
                  <button
                    type="button"
                    className="about-link-row"
                    onClick={() => {
                      setActivePopover(null);
                      onNavigate && onNavigate(APP_INFO.privacyUrl);
                    }}
                  >
                    <span>Privacy Policy</span>
                    <ExternalLink size={12} />
                  </button>
                  <button
                    type="button"
                    className="about-link-row"
                    onClick={() => {
                      setActivePopover(null);
                      onNavigate && onNavigate(APP_INFO.termsUrl);
                    }}
                  >
                    <span>Terms of Service</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              <div className="popover-footer about-footer">
                <span className="about-copyright">&copy; 2026 SmartLink Inc.</span>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Row E: Profile Row */}
      <div className="sidebar-popover-anchor profile-anchor">
        <button
          type="button"
          className={`sidebar-profile-row ${activePopover === "profile" ? "active" : ""}`}
          onClick={handleToggleProfile}
          aria-expanded={activePopover === "profile"}
          aria-haspopup="menu"
          aria-label={`User profile for ${username}`}
          data-tooltip={isCollapsed ? `${username} (${plan.badge})` : undefined}
          title={isCollapsed ? `${username} (${plan.badge})` : undefined}
        >
          <div className="profile-avatar-container">
            <div className="user-avatar sidebar-avatar">
              {userInitial}
            </div>
            <span className="user-online-dot" aria-label="Online" />
          </div>

          {!isCollapsed && (
            <div className="profile-info-block">
              <div className="profile-name-row">
                <span className="profile-username" title={username}>
                  {username}
                </span>
                <span className="profile-plan-badge">{plan.badge}</span>
              </div>
              <span className="profile-email" title={user?.email || "smartlink@user"}>
                {user?.email || "smartlink@user"}
              </span>
            </div>
          )}

          {!isCollapsed && (
            <span className="profile-chevron-icon" aria-hidden="true">
              <ChevronUp size={14} />
            </span>
          )}
        </button>

        {/* Profile Menu Popover */}
        {activePopover === "profile" && (
          <div
            className={`sidebar-popover profile-menu-popover ${isCollapsed ? "popover-flyout" : "popover-upward"}`}
            role="menu"
            aria-label="User account menu"
          >
            <div className="profile-menu-header">
              <div className="profile-menu-user-row">
                <div className="user-avatar profile-menu-avatar">
                  {userInitial}
                </div>
                <div className="profile-menu-user-info">
                  <span className="profile-menu-name">{username}</span>
                  <span className="profile-menu-email">
                    {user?.email || "smartlink@user"}
                  </span>
                </div>
              </div>
            </div>

            <div className="profile-menu-divider" />

            <div className="profile-menu-items">
              {/* Settings */}
              <button
                type="button"
                className="profile-menu-item"
                role="menuitem"
                onClick={() => {
                  setActivePopover(null);
                  onNavigate && onNavigate("/settings");
                }}
              >
                <SettingsIcon size={15} />
                <span>Settings</span>
              </button>

              {/* Appearance (Theme Toggle) */}
              <button
                type="button"
                className="profile-menu-item theme-toggle-item"
                role="menuitem"
                onClick={toggleTheme}
                aria-label={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} mode`}
              >
                {effectiveTheme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                <span>Appearance</span>
                <span className="theme-current-badge">
                  {effectiveTheme === "dark" ? "Dark" : "Light"}
                </span>
              </button>
            </div>

            <div className="profile-menu-divider" />

            {/* Logout */}
            <div className="profile-menu-items">
              <button
                type="button"
                className="profile-menu-item logout-item"
                role="menuitem"
                onClick={() => {
                  setActivePopover(null);
                  onLogout && onLogout();
                }}
              >
                <LogOut size={15} />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
