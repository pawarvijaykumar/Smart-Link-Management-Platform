import React from "react";
import { Lock } from "lucide-react";
import HeroDashboardPreview from "./HeroDashboardPreview";

export default function BrowserMockup({
  url = "app.smartlink.io/dashboard",
  children,
}) {
  return (
    <div className="mkt-browser-mockup" role="region" aria-label="Product interface preview">
      <div className="mkt-browser-header">
        <div className="mkt-browser-dots" aria-hidden="true">
          <div className="mkt-browser-dot mkt-dot-red"></div>
          <div className="mkt-browser-dot mkt-dot-yellow"></div>
          <div className="mkt-browser-dot mkt-dot-green"></div>
        </div>

        <div className="mkt-browser-bar">
          <Lock size={12} strokeWidth={2} />
          <span>{url}</span>
        </div>

        <div style={{ width: "42px" }} aria-hidden="true"></div>
      </div>

      {children || <HeroDashboardPreview />}
    </div>
  );
}
