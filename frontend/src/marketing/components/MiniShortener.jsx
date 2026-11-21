import React, { useState } from "react";
import { Link2, ArrowRight } from "lucide-react";

export default function MiniShortener({ onNavigate }) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    // Direct user to registration/onboarding with the prefilled URL
    const target = `/register?url=${encodeURIComponent(trimmed)}`;
    if (onNavigate) {
      onNavigate(target);
    } else {
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <form className="mkt-mini-shortener" onSubmit={handleSubmit} role="search" aria-label="Quick link shortener">
      <Link2 size={16} color="var(--mkt-muted)" style={{ flexShrink: 0 }} />
      <input
        type="url"
        required
        placeholder="Paste a long URL (e.g. https://example.com/spring-campaign)..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="URL to shorten"
      />
      <button type="submit" className="mkt-btn mkt-btn-primary mkt-btn-sm">
        <span>Shorten</span>
        <ArrowRight size={14} />
      </button>
    </form>
  );
}
