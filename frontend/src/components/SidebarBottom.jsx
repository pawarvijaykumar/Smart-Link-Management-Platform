import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Newspaper,
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
  const [popoverStyle, setPopoverStyle] = useState({});

  const containerRef = useRef(null);
  const whatsNewBtnRef = useRef(null);
  const aboutBtnRef = useRef(null);
  const profileBtnRef = useRef(null);
  const popoverRef = useRef(null);

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

  // Compute fixed position for the active popover so it's never clipped by sidebar overflow
  const updatePosition = useCallback(() => {
    if (!activePopover) return;
    let targetEl = null;
    if (activePopover === "whatsNew") targetEl = whatsNewBtnRef.current;
    else if (activePopover === "about") targetEl = aboutBtnRef.current;
    else if (activePopover === "profile") targetEl = profileBtnRef.current;

    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    if (isCollapsed) {
      // Collapsed: flyout to the right of the button
      const left = Math.min(rect.right + 10, viewportW - 290);
      const bottom = Math.max(12, Math.min(viewportH - 60, viewportH - rect.bottom));
      setPopoverStyle({
        position: "fixed",
        left: `${Math.max(10, left)}px`,
        bottom: `${bottom}px`,
        top: "auto",
        right: "auto",
        minWidth: "260px",
        maxWidth: "320px",
        maxHeight: `${viewportH - 24}px`,
        zIndex: 99999,
      });
    } else {
      // Expanded sidebar: popover opens upward from the button
      const width = activePopover === "profile" ? 250 : 280;
      let left = rect.left;
      if (left + width > viewportW - 12) {
        left = Math.max(12, viewportW - width - 12);
      }

      const spaceAbove = rect.top;
      const spaceBelow = viewportH - rect.bottom;
      const estimatedHeight = activePopover === "whatsNew" ? 340 : 250;

      if (spaceAbove < estimatedHeight && spaceBelow > spaceAbove) {
        // Flip downward if not enough room above
        setPopoverStyle({
          position: "fixed",
          left: `${Math.max(12, left)}px`,
          top: `${rect.bottom + 8}px`,
          bottom: "auto",
          right: "auto",
          minWidth: "260px",
          maxWidth: "320px",
          maxHeight: `${Math.max(200, spaceBelow - 16)}px`,
          zIndex: 99999,
        });
      } else {
        // Open upward
        setPopoverStyle({
          position: "fixed",
          left: `${Math.max(12, left)}px`,
          bottom: `${viewportH - rect.top + 8}px`,
          top: "auto",
          right: "auto",
          minWidth: "260px",
          maxWidth: "320px",
          maxHeight: `${Math.max(200, spaceAbove - 16)}px`,
          zIndex: 99999,
        });
      }
    }
  }, [activePopover, isCollapsed]);

  // Reposition on trigger change, resize, scroll
  useEffect(() => {
    if (!activePopover) return;
    updatePosition();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActivePopover(null);
      }
    };

    const handleClickOutside = (e) => {
      if (popoverRef.current && popoverRef.current.contains(e.target)) {
        return;
      }
      if (
        (whatsNewBtnRef.current && whatsNewBtnRef.current.contains(e.target)) ||
        (aboutBtnRef.current && aboutBtnRef.current.contains(e.target)) ||
        (profileBtnRef.current && profileBtnRef.current.contains(e.target))
      ) {
        return;
      }
      setActivePopover(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [activePopover, updatePosition]);

  const handleToggleWhatsNew = () => {
    if (activePopover === "whatsNew") {
      setActivePopover(null);
    } else {
      setActivePopover("whatsNew");
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
      {/* 1. Slim Plan Usage Card (Expanded mode only; hidden below 760px viewport height) */}
      {!isCollapsed && (
        <div className="sidebar-usage-card">
          <div className="usage-card-header">
            <div className="usage-card-title-group">
              <span className="usage-card-title">Plan usage</span>
              <span className="usage-card-plan">{plan.name}</span>
            </div>
            {!plan.isHighest && (
              <button
                type="button"
                className="usage-upgrade-link"
                onClick={() => onNavigate && onNavigate("/pricing")}
                title="Upgrade your plan"
                aria-label="Upgrade your plan"
              >
                <span>Upgrade plan</span>
                <ChevronRight size={11} />
              </button>
            )}
          </div>

          {/* Links Progress */}
          <div className="usage-item">
            <div className="usage-label-row">
              <span className="usage-label">Links</span>
              <span className="usage-value">
                {totalLinks} / {maxLinks}
              </span>
            </div>
            <div
              className="usage-track"
              role="progressbar"
              aria-valuenow={totalLinks}
              aria-valuemin="0"
              aria-valuemax={maxLinks}
              aria-label="Links usage progress"
            >
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
            <div
              className="usage-track"
              role="progressbar"
              aria-valuenow={totalClicks}
              aria-valuemin="0"
              aria-valuemax={maxClicks}
              aria-label="Clicks usage progress"
            >
              <div
                className="usage-fill"
                style={{ width: `${Math.max(clicksPct, 2)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. One Row of Three Small Icon Buttons: What's New, Help & Docs, About */}
      <div
        className="sidebar-actions-row"
        role="toolbar"
        aria-label="Meta & Support navigation"
      >
        {/* Action 1: What's New */}
        <div className="sidebar-popover-anchor">
          <button
            ref={whatsNewBtnRef}
            type="button"
            className={`sidebar-icon-btn ${activePopover === "whatsNew" ? "active" : ""}`}
            onClick={handleToggleWhatsNew}
            aria-expanded={activePopover === "whatsNew"}
            aria-haspopup="dialog"
            aria-label="What's new"
            data-tooltip="What's new"
            title="What's new"
          >
            <span className="row-icon-wrap">
              <Newspaper size={15} />
              {hasUnreadWhatsNew && (
                <span
                  className="row-unread-dot"
                  aria-label="New updates available"
                />
              )}
            </span>
          </button>
        </div>

        {/* Action 2: Help & Docs */}
        <button
          type="button"
          className="sidebar-icon-btn"
          onClick={() => onNavigate && onNavigate("/docs")}
          aria-label="Help & documentation"
          data-tooltip="Help & docs"
          title="Help & docs"
        >
          <span className="row-icon-wrap">
            <BookOpen size={15} />
          </span>
        </button>

        {/* Action 3: About */}
        <div className="sidebar-popover-anchor">
          <button
            ref={aboutBtnRef}
            type="button"
            className={`sidebar-icon-btn ${activePopover === "about" ? "active" : ""}`}
            onClick={handleToggleAbout}
            aria-expanded={activePopover === "about"}
            aria-haspopup="dialog"
            aria-label="About SmartLink"
            data-tooltip="About"
            title="About"
          >
            <span className="row-icon-wrap">
              <Info size={15} />
            </span>
          </button>
        </div>
      </div>

      {/* 3. Profile Row with Account Menu Popover */}
      <div className="sidebar-popover-anchor profile-anchor">
        <button
          ref={profileBtnRef}
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
      </div>

      {/* Portaled Popovers: Rendered outside the sidebar into document.body to prevent clipping */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {/* What's New Popover */}
            {activePopover === "whatsNew" && (
              <div
                ref={popoverRef}
                style={popoverStyle}
                className="sidebar-popover whats-new-popover portal-popover"
                role="dialog"
                aria-label="Latest product updates"
              >
                <div className="popover-header">
                  <div className="popover-header-title">
                    <Newspaper size={15} className="popover-title-icon" />
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

            {/* About Popover */}
            {activePopover === "about" && (
              <div
                ref={popoverRef}
                style={popoverStyle}
                className="sidebar-popover about-popover portal-popover"
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

            {/* Profile Menu Popover */}
            {activePopover === "profile" && (
              <div
                ref={popoverRef}
                style={popoverStyle}
                className="sidebar-popover profile-menu-popover portal-popover"
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
          </>,
          document.body
        )}
    </div>
  );
}
