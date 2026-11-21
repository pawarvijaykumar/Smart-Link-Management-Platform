import React from "react";
import { Lock } from "lucide-react";

export default function BrowserMockup({
  imageUrl = "/dashboard-preview.png",
  url = "app.smartlink.io/dashboard",
  alt = "SmartLink Analytics Dashboard preview",
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

      <img
        src={imageUrl}
        alt={alt}
        className="mkt-browser-img"
        loading="lazy"
        width={1200}
        height={675}
      />
    </div>
  );
}
