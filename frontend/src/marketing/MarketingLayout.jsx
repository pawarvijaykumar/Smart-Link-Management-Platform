import React, { useEffect } from "react";
import MarketingNavbar from "./MarketingNavbar";
import MarketingFooter from "./MarketingFooter";
import PageBackground from "../components/PageBackground";
import "./Marketing.css";

export default function MarketingLayout({
  title = "SmartLink — Short links you can actually measure",
  description = "Create short links, track campaign attribution, and analyze clicks in real time.",
  token,
  currentPath = "/",
  onNavigate,
  backgroundVariant,
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
    <div className="page mkt-wrapper">
      <PageBackground variant={backgroundVariant} />
      <MarketingNavbar
        token={token}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />
      <div className={`mkt-frame-outer ${currentPath !== "/" ? "mkt-has-nav-offset" : ""}`}>
        <div className="mkt-frame-lines">
          <main id="main-content" tabIndex="-1" style={{ outline: "none", flex: 1, minHeight: "100%" }}>
            {children}
          </main>
        </div>
      </div>
      <MarketingFooter onNavigate={onNavigate} />
    </div>
  );
}
