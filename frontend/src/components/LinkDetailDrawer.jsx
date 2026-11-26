import React, { useEffect } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Sliders,
  Play,
  Pause,
  Trash2,
  BarChart3,
  Globe,
  Clock,
  Lock,
  Tag,
  MousePointerClick,
  Smartphone,
} from "lucide-react";
import { Button, Badge } from "./ui";
import { API_URL } from "../App";
import "./LinkDetailDrawer.css";

export default function LinkDetailDrawer({
  isOpen,
  link,
  onClose,
  onCopy,
  isCopied,
  onOpenQRCode,
  onOpenAccessModal,
  onTogglePause,
  onDelete,
  onOpenAnalytics,
  isToggling = false,
}) {
  // Close drawer on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !link) return null;

  const shortUrl = `${API_URL}/${link.shortCode}`;

  const isExpired = link.expiresAt && new Date(link.expiresAt) <= new Date();
  const isLimitReached =
    typeof link.maxClicks === "number" &&
    link.maxClicks > 0 &&
    (link.clicks || 0) >= link.maxClicks;

  let statusLabel = "Active";
  let statusVariant = "positive";
  if (link.isPaused) {
    statusLabel = "Paused";
    statusVariant = "neutral";
  } else if (isExpired) {
    statusLabel = "Expired";
    statusVariant = "negative";
  } else if (isLimitReached) {
    statusLabel = "Limit Reached";
    statusVariant = "negative";
  }

  const domain = (() => {
    try {
      return new URL(link.originalUrl).hostname.replace(/^www\./, "");
    } catch {
      return "Destination";
    }
  })();

  const formattedCreated = link.createdAt
    ? new Date(link.createdAt).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  const formattedExpiry = link.expiresAt
    ? new Date(link.expiresAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never expires";

  const qrScans = link.qrScans || 0;
  const directClicks = Math.max(0, (link.clicks || 0) - qrScans);

  const handleDeleteClick = () => {
    if (
      window.confirm(
        `Are you sure you want to delete the short link /${link.shortCode}? This action cannot be undone.`
      )
    ) {
      onDelete?.(link);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-info">
            <div className="drawer-title-row">
              <h3 className="drawer-title" title={link.originalUrl}>
                {link.utmCampaign ? link.utmCampaign : domain}
              </h3>
              <Badge variant={statusVariant} size="sm">
                {statusLabel}
              </Badge>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Created on {formattedCreated}
            </span>
          </div>

          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content Body */}
        <div className="drawer-body">
          {/* Short URL Box */}
          <div className="drawer-link-box">
            <div className="drawer-short-url-row">
              <a
                href={shortUrl}
                target="_blank"
                rel="noreferrer"
                className="drawer-short-url"
                title="Open short link in new tab"
              >
                /{link.shortCode}
              </a>

              <div style={{ display: "flex", gap: "6px" }}>
                <Button
                  size="xs"
                  variant={isCopied ? "success" : "secondary"}
                  icon={isCopied ? Check : Copy}
                  onClick={() => onCopy?.(link)}
                >
                  {isCopied ? "Copied" : "Copy"}
                </Button>
                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-action-view"
                  title="Test link destination"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px 8px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>

            <div className="drawer-dest-row">
              <span className="drawer-dest-label">Destination</span>
              <a
                href={link.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="drawer-dest-url"
                title={link.originalUrl}
              >
                {link.originalUrl}
              </a>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div>
            <div className="drawer-section-title">Traffic Overview</div>
            <div className="drawer-stats-grid">
              <div className="drawer-stat-card">
                <span className="drawer-stat-label">
                  <MousePointerClick size={14} /> Total Clicks
                </span>
                <span className="drawer-stat-value">
                  {(link.clicks || 0).toLocaleString()}
                </span>
              </div>

              <div className="drawer-stat-card">
                <span className="drawer-stat-label">
                  <QrCode size={14} /> QR Scans
                </span>
                <span className="drawer-stat-value">
                  {qrScans.toLocaleString()}
                </span>
              </div>

              <div className="drawer-stat-card">
                <span className="drawer-stat-label">
                  <Globe size={14} /> Direct Clicks
                </span>
                <span className="drawer-stat-value">
                  {directClicks.toLocaleString()}
                </span>
              </div>

              <div className="drawer-stat-card">
                <span className="drawer-stat-label">
                  <Sliders size={14} /> Click Limit
                </span>
                <span className="drawer-stat-value">
                  {link.maxClicks ? `${link.clicks || 0}/${link.maxClicks}` : "Unlimited"}
                </span>
              </div>
            </div>
          </div>

          {/* Tags Section */}
          <div>
            <div className="drawer-section-title">
              <Tag size={12} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />
              Tags
            </div>
            <div className="drawer-tags-wrap">
              {Array.isArray(link.tags) && link.tags.length > 0 ? (
                link.tags.map((tag, idx) => (
                  <span key={idx} className="drawer-tag-chip">
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="drawer-empty-tags">No tags assigned.</span>
              )}
            </div>
          </div>

          {/* Configuration & Access Rules */}
          <div>
            <div className="drawer-section-title">Access & Rules</div>
            <div className="drawer-details-list">
              <div className="drawer-detail-item">
                <span className="drawer-detail-key">
                  <Clock size={13} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                  Expiration
                </span>
                <span className="drawer-detail-val">{formattedExpiry}</span>
              </div>

              <div className="drawer-detail-item">
                <span className="drawer-detail-key">
                  <Lock size={13} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                  Password Protection
                </span>
                <span className="drawer-detail-val">
                  {link.password ? "Enabled (Protected)" : "Disabled (Public)"}
                </span>
              </div>

              {link.utmCampaign && (
                <div className="drawer-detail-item">
                  <span className="drawer-detail-key">UTM Campaign</span>
                  <span className="drawer-detail-val">{link.utmCampaign}</span>
                </div>
              )}

              {link.utmSource && (
                <div className="drawer-detail-item">
                  <span className="drawer-detail-key">UTM Source</span>
                  <span className="drawer-detail-val">{link.utmSource}</span>
                </div>
              )}

              {link.utmMedium && (
                <div className="drawer-detail-item">
                  <span className="drawer-detail-key">UTM Medium</span>
                  <span className="drawer-detail-val">{link.utmMedium}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer Action Bar */}
        <div className="drawer-footer">
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={handleDeleteClick}
            title="Delete this link"
          >
            Delete
          </Button>

          <div className="drawer-footer-actions">
            <Button
              size="sm"
              variant="secondary"
              icon={link.isPaused ? Play : Pause}
              onClick={() => onTogglePause?.(link)}
              disabled={isToggling}
            >
              {link.isPaused ? "Resume" : "Pause"}
            </Button>

            <Button
              size="sm"
              variant="secondary"
              icon={Sliders}
              onClick={() => onOpenAccessModal?.(link)}
            >
              Rules
            </Button>

            <Button
              size="sm"
              variant="secondary"
              icon={QrCode}
              onClick={() => onOpenQRCode?.(link)}
            >
              QR
            </Button>

            <Button
              size="sm"
              variant="primary"
              icon={BarChart3}
              onClick={() => onOpenAnalytics?.(link)}
            >
              Analytics
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
