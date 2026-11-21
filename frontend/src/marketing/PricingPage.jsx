import React, { useState } from "react";
import MarketingLayout from "./MarketingLayout";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";

const COMPARISON_DATA = [
  {
    category: "Links & Routing",
    features: [
      { name: "Active short links", free: "50 links", pro: "Unlimited", team: "Unlimited" },
      { name: "Custom short code aliases", free: true, pro: true, team: true },
      { name: "Dynamic QR code generation", free: "Standard SVG", pro: "Custom Vector", team: "Custom Vector & Colors" },
      { name: "Expiration & max-click limits", free: false, pro: true, team: true },
      { name: "Smart A/B link variant testing", free: false, pro: true, team: true },
      { name: "Custom branded domain", free: false, pro: false, team: "Included (with SSL)" },
    ],
  },
  {
    category: "Analytics & Intelligence",
    features: [
      { name: "History retention", free: "7 days", pro: "1 year", team: "Unlimited" },
      { name: "Device & browser identification", free: true, pro: true, team: true },
      { name: "Geo-location country mapping", free: "Top 5", pro: "Full worldwide", team: "Full worldwide" },
      { name: "UTM campaign attribution", free: false, pro: true, team: true },
      { name: "Traffic anomaly detection", free: false, pro: true, team: true },
      { name: "PDF executive reports & CSV", free: false, pro: true, team: true },
    ],
  },
  {
    category: "Team & Support",
    features: [
      { name: "User seats", free: "1 seat", pro: "1 seat", team: "5 seats included" },
      { name: "REST API access", free: false, pro: "1,000 req/min", team: "10,000 req/min" },
      { name: "Uptime guarantee", free: "99.5%", pro: "99.9%", team: "99.99% SLA" },
      { name: "Support tier", free: "Community", pro: "Standard Email", team: "Priority 24/7" },
    ],
  },
];

export default function PricingPage({ token, onNavigate }) {
  const [billingCycle, setBillingCycle] = useState("yearly"); // "monthly" | "yearly"
  const isYearly = billingCycle === "yearly";

  const handleNav = (path, e) => {
    if (e) e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <MarketingLayout
      title="Pricing — Simple, transparent plans for SmartLink"
      description="Choose the right plan for your link management and click tracking requirements. Monthly or annual billing available."
      token={token}
      currentPath="/pricing"
      onNavigate={onNavigate}
    >
      <div className="mkt-container">
        {/* Header */}
        <section className="mkt-pricing-header" aria-labelledby="pricing-title">
          <div className="mkt-section-tag">Pricing Plans</div>
          <h1 id="pricing-title" className="mkt-section-title" style={{ fontSize: "44px" }}>
            Predictable plans for growing teams
          </h1>
          <p className="mkt-section-subtitle">
            Start free, then upgrade to unlocked history, custom domains, and automated report exports.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="mkt-toggle-container" role="radiogroup" aria-label="Billing cycle toggle">
            <button
              type="button"
              role="radio"
              aria-checked={!isYearly}
              className={`mkt-toggle-btn ${!isYearly ? "active" : ""}`}
              onClick={() => setBillingCycle("monthly")}
            >
              Monthly billing
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isYearly}
              className={`mkt-toggle-btn ${isYearly ? "active" : ""}`}
              onClick={() => setBillingCycle("yearly")}
            >
              <span>Annual billing</span>
              <span className="mkt-discount-badge">Save 20%</span>
            </button>
          </div>
        </section>

        {/* 3 Plans Grid */}
        <div className="mkt-plans-grid">
          {/* Plan 1: Free */}
          <div className="mkt-plan-card">
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--mkt-text)", margin: "0 0 6px" }}>
              Free
            </h3>
            <p style={{ fontSize: "14px", color: "var(--mkt-muted)", margin: 0 }}>
              Essential link shortening and basic analytics for individuals.
            </p>

            <div className="mkt-plan-price">
              <span className="mkt-price-currency">$</span>
              <span className="mkt-price-amount">0</span>
              <span className="mkt-price-period">/ month</span>
            </div>

            <button
              type="button"
              className="mkt-btn mkt-btn-secondary"
              onClick={(e) => handleNav(token ? "/dashboard" : "/register?plan=free", e)}
            >
              <span>{token ? "Current plan" : "Get started free"}</span>
            </button>

            <ul className="mkt-plan-features">
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Up to 50 active short links</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>7-day click history retention</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Standard QR code downloads</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Device & browser detection</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Community support</span>
              </li>
            </ul>
          </div>

          {/* Plan 2: Pro (Highlighted) */}
          <div className="mkt-plan-card highlighted">
            <div className="mkt-highlight-badge">Recommended</div>

            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--mkt-text)", margin: "0 0 6px" }}>
              Pro
            </h3>
            <p style={{ fontSize: "14px", color: "var(--mkt-muted)", margin: 0 }}>
              Advanced analytics, UTM attribution, and automated reports for marketers.
            </p>

            <div className="mkt-plan-price">
              <span className="mkt-price-currency">$</span>
              <span className="mkt-price-amount">{isYearly ? "15" : "19"}</span>
              <span className="mkt-price-period">/ month {isYearly ? "(billed annually)" : ""}</span>
            </div>

            <button
              type="button"
              className="mkt-btn mkt-btn-primary"
              onClick={(e) => handleNav(token ? "/dashboard" : "/register?plan=pro", e)}
            >
              <span>{token ? "Upgrade to Pro" : "Start 14-day free trial"}</span>
              <ArrowRight size={15} />
            </button>

            <ul className="mkt-plan-features">
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span><strong>Unlimited</strong> short links</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>1-year click history retention</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Multi-channel UTM campaign attribution</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Smart A/B link variant testing</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Automated PDF summaries & CSV export</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Traffic anomaly & spike detection</span>
              </li>
            </ul>
          </div>

          {/* Plan 3: Team */}
          <div className="mkt-plan-card">
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--mkt-text)", margin: "0 0 6px" }}>
              Team
            </h3>
            <p style={{ fontSize: "14px", color: "var(--mkt-muted)", margin: 0 }}>
              Custom branded domains, team seats, and high-volume REST API access.
            </p>

            <div className="mkt-plan-price">
              <span className="mkt-price-currency">$</span>
              <span className="mkt-price-amount">{isYearly ? "39" : "49"}</span>
              <span className="mkt-price-period">/ month {isYearly ? "(billed annually)" : ""}</span>
            </div>

            <button
              type="button"
              className="mkt-btn mkt-btn-secondary"
              onClick={(e) => handleNav(token ? "/dashboard" : "/register?plan=team", e)}
            >
              <span>Upgrade to Team</span>
            </button>

            <ul className="mkt-plan-features">
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Everything in Pro tier</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span><strong>5 team member seats</strong> with roles</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Custom branded domain (SSL included)</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>10,000 req/min REST API rate limit</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>99.99% uptime SLA guarantee</span>
              </li>
              <li className="mkt-feature-list-item">
                <Check size={16} className="mkt-check-icon" />
                <span>Dedicated 24/7 priority support</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <section aria-labelledby="comparison-title" style={{ marginBottom: "80px" }}>
          <div className="mkt-section-header" style={{ marginBottom: "32px" }}>
            <h2 id="comparison-title" className="mkt-section-title" style={{ fontSize: "28px" }}>
              Compare full plan features
            </h2>
            <p className="mkt-section-subtitle">
              Detailed breakdown of features, limits, and technical capabilities across all tiers.
            </p>
          </div>

          <div className="mkt-comparison-table-wrapper">
            <table className="mkt-table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Capability</th>
                  <th style={{ width: "20%" }}>Free</th>
                  <th style={{ width: "20%" }}>Pro</th>
                  <th style={{ width: "20%" }}>Team</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_DATA.map((cat, catIdx) => (
                  <React.Fragment key={catIdx}>
                    <tr style={{ background: "var(--mkt-surface-2)" }}>
                      <td
                        colSpan={4}
                        style={{
                          fontWeight: "700",
                          fontSize: "12px",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--mkt-muted)",
                          paddingTop: "16px",
                          paddingBottom: "10px",
                        }}
                      >
                        {cat.category}
                      </td>
                    </tr>
                    {cat.features.map((feat, featIdx) => (
                      <tr key={featIdx}>
                        <td style={{ fontWeight: "500", color: "var(--mkt-text)" }}>{feat.name}</td>
                        <td>
                          {typeof feat.free === "boolean" ? (
                            feat.free ? <Check size={16} className="mkt-check-icon" /> : <X size={16} color="var(--mkt-dim)" />
                          ) : (
                            feat.free
                          )}
                        </td>
                        <td style={{ fontWeight: feat.pro === "Unlimited" ? "600" : "normal" }}>
                          {typeof feat.pro === "boolean" ? (
                            feat.pro ? <Check size={16} className="mkt-check-icon" /> : <X size={16} color="var(--mkt-dim)" />
                          ) : (
                            feat.pro
                          )}
                        </td>
                        <td style={{ fontWeight: feat.team === "Unlimited" ? "600" : "normal" }}>
                          {typeof feat.team === "boolean" ? (
                            feat.team ? <Check size={16} className="mkt-check-icon" /> : <X size={16} color="var(--mkt-dim)" />
                          ) : (
                            feat.team
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
