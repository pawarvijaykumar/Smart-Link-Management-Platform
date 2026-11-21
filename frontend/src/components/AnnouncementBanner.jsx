import React, { useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import { ANNOUNCEMENT_CONFIG } from "../config/plans.config";
import "./AnnouncementBanner.css";

export default function AnnouncementBanner({ onNavigate }) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(ANNOUNCEMENT_CONFIG.id);
      if (dismissed !== "dismissed") {
        setIsDismissed(false);
      }
    } catch (_) {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(ANNOUNCEMENT_CONFIG.id, "dismissed");
    } catch (_) {}
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div className="announcement-banner" role="region" aria-label="Product announcement">
      <div className="announcement-main">
        <span className="announcement-pill">UPDATE</span>
        <p className="announcement-text">{ANNOUNCEMENT_CONFIG.message}</p>
        <button
          type="button"
          className="announcement-action"
          onClick={() => onNavigate && onNavigate(ANNOUNCEMENT_CONFIG.learnMorePath)}
        >
          <span>Learn more</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        className="announcement-close"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        title="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
}
