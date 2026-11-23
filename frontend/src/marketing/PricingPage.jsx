import React, { useState, useEffect } from "react";
import MarketingLayout from "./MarketingLayout";
import { Check, X, ArrowRight } from "lucide-react";
import "./Pricing.css";

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

const PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Essential link shortening and basic analytics for individuals.",
    monthlyPrice: 0,
    features: [
      "Up to 50 active short links",
      "7-day click history retention",
      "Standard QR code downloads",
      "Device & browser detection",
      "Community support",
    ],
    ctaText: (token) => (token ? "Current plan" : "Get started free"),
    ctaHref: (token) => (token ? "/dashboard" : "/register?plan=free"),
    buttonStyle: "outline",
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Advanced analytics, UTM attribution, and automated reports for marketers.",
    monthlyPrice: 19,
    features: [
      "Unlimited short links",
      "1-year click history retention",
      "Multi-channel UTM campaign attribution",
      "Smart A/B link variant testing",
      "Automated PDF summaries & CSV export",
      "Traffic anomaly & spike detection",
    ],
    ctaText: (token) => (token ? "Upgrade to Pro" : "Start 14-day free trial"),
    ctaHref: (token) => (token ? "/dashboard" : "/register?plan=pro"),
    buttonStyle: "solid",
    recommended: true,
  },
  {
    id: "team",
    name: "Team",
    description: "Custom branded domains, team seats, and high-volume REST API access.",
    monthlyPrice: 49,
    features: [
      "Everything in Pro tier",
      "5 team member seats with roles",
      "Custom branded domain (SSL included)",
      "10,000 req/min REST API rate limit",
      "99.99% uptime SLA guarantee",
      "Dedicated 24/7 priority support",
    ],
    ctaText: () => "Upgrade to Team",
    ctaHref: (token) => (token ? "/dashboard" : "/register?plan=team"),
    buttonStyle: "outline",
    recommended: false,
  },
];

export default function PricingPage({ token, onNavigate }) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);

  // Remove will-change after entrance animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 1600);
    return () => clearTimeout(timer);
  }, []);

  const handleNav = (path, e) => {
    if (e) e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const getPrice = (plan) => {
    if (plan.monthlyPrice === 0) return 0;
    return isAnnual ? Math.round(plan.monthlyPrice * 0.9) : plan.monthlyPrice;
  };

  // Render individual card inner markup
  const renderCardInner = (plan) => {
    const price = getPrice(plan);
    const isPro = plan.id === "pro";
    const ctaText = plan.ctaText(token);
    const ctaHref = plan.ctaHref(token);

    return (
      <>
        {/* 3. Tattoo Line Art SVG Illustration (behind text, z-index: 0) */}
        {plan.id === "free" && (
          <svg
            viewBox="0 0 100 100"
            className="pricing-tattoo pricing-tattoo--free"
            aria-hidden="true"
          >
            <circle cx="50" cy="50" r="42" />
            <circle cx="50" cy="50" r="28" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="14" />
            <path d="M50 8v84M8 50h84" />
            <path d="M20 20l60 60M20 80l60-60" strokeDasharray="2 4" />
            <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(-30 50 50)" />
            <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(30 50 50)" />
          </svg>
        )}

        {plan.id === "pro" && (
          <svg
            viewBox="0 0 100 100"
            className="pricing-tattoo pricing-tattoo--pro"
            aria-hidden="true"
          >
            <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" />
            <polygon points="50,22 74,36 74,64 50,78 26,64 26,36" strokeDasharray="4 2" />
            <circle cx="50" cy="50" r="12" />
            <line x1="50" y1="6" x2="50" y2="22" />
            <line x1="88" y1="28" x2="74" y2="36" />
            <line x1="88" y1="72" x2="74" y2="64" />
            <line x1="50" y1="94" x2="50" y2="78" />
            <line x1="12" y1="72" x2="26" y2="64" />
            <line x1="12" y1="28" x2="26" y2="36" />
            <line x1="50" y1="22" x2="50" y2="38" />
            <line x1="50" y1="62" x2="50" y2="78" />
            <line x1="26" y1="50" x2="74" y2="50" />
            <circle cx="50" cy="50" r="38" strokeDasharray="2 5" />
          </svg>
        )}

        {plan.id === "team" && (
          <svg
            viewBox="0 0 100 100"
            className="pricing-tattoo pricing-tattoo--team"
            aria-hidden="true"
          >
            <path d="M50 14L84 34v36L50 90L16 70V34z" />
            <path d="M50 14v38L84 70M50 52L16 70" />
            <line x1="50" y1="52" x2="50" y2="90" />
            <circle cx="50" cy="14" r="3.5" />
            <circle cx="84" cy="34" r="3.5" />
            <circle cx="84" cy="70" r="3.5" />
            <circle cx="50" cy="90" r="3.5" />
            <circle cx="16" cy="70" r="3.5" />
            <circle cx="16" cy="34" r="3.5" />
            <circle cx="50" cy="52" r="4.5" />
            <ellipse cx="50" cy="52" rx="36" ry="18" strokeDasharray="3 3" />
          </svg>
        )}

        {/* Content wrap (elevated, z-index: 1) */}
        <div className="pricing-card-content">
          <h2 className="pricing-plan-name">{plan.name}</h2>
          <p className="pricing-plan-desc">{plan.description}</p>

          {/* 2b. Price Style: "$25" in one piece, Geist 600, 44px tabular-nums */}
          <div className="pricing-price-row">
            <span key={`${plan.id}-${price}`} className="pricing-price-full">
              ${price}
            </span>
            <span className="pricing-price-period">/month</span>
          </div>

          <p className="pricing-features-label">What&apos;s included:</p>

          <ul className="pricing-features-list">
            {plan.features.map((feature, fIdx) => (
              <li key={fIdx} className="pricing-feature-item">
                <Check size={15} strokeWidth={2.2} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <a
            href={ctaHref}
            className={`pricing-cta-btn pricing-cta-btn--${plan.buttonStyle}`}
            onClick={(e) => handleNav(ctaHref, e)}
          >
            <span>{ctaText}</span>
            {isPro && <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />}
          </a>
        </div>
      </>
    );
  };

  return (
    <MarketingLayout
      title="Pricing — Simple, transparent plans for SmartLink"
      description="Choose the right plan for your link management and click tracking requirements. Monthly or annual billing available."
      token={token}
      currentPath="/pricing"
      onNavigate={onNavigate}
      backgroundVariant="none"
    >
      <div className={`pricing-page ${isAnimating ? "pricing-animating" : ""}`}>
        {/* 1. PRICING-ONLY BACKGROUND LAYER */}
        <div className="pricing-bg-layer" aria-hidden="true">
          <div className="pricing-bg-glow" />
          <div className="pricing-pattern-layer">
            <div className="pricing-pattern-tiles" />
          </div>
        </div>

        <div className="pricing-content-wrap">
          {/* HEADER (Blur-in entrance) */}
          <header className="pricing-header">
            <h1 className="pricing-title">Choose your plan</h1>
            <p className="pricing-subtitle">
              Simple, transparent pricing for individuals and growing teams.
            </p>
          </header>

          {/* BILLING TOGGLE (Blur-in entrance) */}
          <div className="pricing-toggle-wrap">
            <div
              className="pricing-toggle-pill"
              role="radiogroup"
              aria-label="Billing frequency toggle"
            >
              <button
                type="button"
                role="radio"
                aria-checked={isAnnual}
                className={`pricing-toggle-btn ${isAnnual ? "active" : ""}`}
                onClick={() => setIsAnnual(true)}
              >
                <span>Bill annually</span>
                <span className="pricing-discount-tag">10% off</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!isAnnual}
                className={`pricing-toggle-btn ${!isAnnual ? "active" : ""}`}
                onClick={() => setIsAnnual(false)}
              >
                <span>Bill monthly</span>
              </button>
            </div>
          </div>

          {/* THREE PRICING CARDS (Ghost flight & blur-in entrance) */}
          <div className="pricing-cards-grid">
            {/* Free Card (Left) */}
            <article className="pricing-card pricing-card--free">
              {renderCardInner(PLANS[0])}
            </article>

            {/* 2. Pro Card (Wrapped in Tinted Frame with Integrated "Recommended" Top Edge) */}
            <div className="pricing-pro-frame">
              <div className="pricing-pro-frame-header" aria-hidden="true">
                <span>Recommended</span>
              </div>
              <article className="pricing-card pricing-card--pro">
                {renderCardInner(PLANS[1])}
              </article>
            </div>

            {/* Team Card (Right) */}
            <article className="pricing-card pricing-card--team">
              {renderCardInner(PLANS[2])}
            </article>
          </div>

          {/* FEATURE COMPARISON TABLE */}
          <section className="pricing-comparison-section" aria-labelledby="comparison-title">
            <div className="pricing-comparison-header">
              <h2 id="comparison-title" className="pricing-comparison-title">
                Compare full plan features
              </h2>
              <p className="pricing-comparison-subtitle">
                Detailed breakdown of limits, analytics depth, and team capabilities.
              </p>
            </div>

            <div className="pricing-table-wrapper">
              <table className="pricing-table">
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
                      <tr className="pricing-table-cat-row">
                        <td colSpan={4}>{cat.category}</td>
                      </tr>
                      {cat.features.map((feat, featIdx) => (
                        <tr key={featIdx}>
                          <td style={{ fontWeight: "500", color: "var(--text)" }}>{feat.name}</td>
                          <td>
                            {typeof feat.free === "boolean" ? (
                              feat.free ? (
                                <Check size={16} strokeWidth={2} className="pricing-table-check" />
                              ) : (
                                <X size={16} strokeWidth={2} className="pricing-table-cross" />
                              )
                            ) : (
                              feat.free
                            )}
                          </td>
                          <td style={{ fontWeight: feat.pro === "Unlimited" ? "600" : "normal" }}>
                            {typeof feat.pro === "boolean" ? (
                              feat.pro ? (
                                <Check size={16} strokeWidth={2} className="pricing-table-check" />
                              ) : (
                                <X size={16} strokeWidth={2} className="pricing-table-cross" />
                              )
                            ) : (
                              feat.pro
                            )}
                          </td>
                          <td style={{ fontWeight: feat.team === "Unlimited" ? "600" : "normal" }}>
                            {typeof feat.team === "boolean" ? (
                              feat.team ? (
                                <Check size={16} strokeWidth={2} className="pricing-table-check" />
                              ) : (
                                <X size={16} strokeWidth={2} className="pricing-table-cross" />
                              )
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
      </div>
    </MarketingLayout>
  );
}
