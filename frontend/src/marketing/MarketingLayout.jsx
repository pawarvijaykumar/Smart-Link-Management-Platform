import React, { useEffect } from "react";
import MarketingNavbar from "./MarketingNavbar";
import MarketingFooter from "./MarketingFooter";
import "./Marketing.css";

export default function MarketingLayout({
  title = "SmartLink — Short links you can actually measure",
  description = "Enterprise-grade URL shortening, real-time campaign attribution, and click intelligence built for modern teams.",
  token,
  currentPath = "/",
  onNavigate,
  children,
}) {
  useEffect(() => {
    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;
  }, [title, description]);

  return (
    <div className="mkt-wrapper">
      <MarketingNavbar
        token={token}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />
      <main id="main-content" tabIndex="-1" style={{ outline: "none", flex: 1 }}>
        {children}
      </main>
      <MarketingFooter onNavigate={onNavigate} />
    </div>
  );
}
