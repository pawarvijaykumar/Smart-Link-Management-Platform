import React from "react";
import { Link2 } from "lucide-react";

export default function MarketingFooter({ onNavigate }) {
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
    <footer className="mkt-footer" role="contentinfo">
      <div className="mkt-container">
        <div className="mkt-footer-grid">
          {/* Brand & Status Column */}
          <div className="mkt-footer-brand">
            <a
              href="/"
              className="mkt-logo-link"
              onClick={(e) => handleNav("/", e)}
              aria-label="SmartLink Home"
            >
              <div className="mkt-logo-icon">
                <Link2 size={18} strokeWidth={2} />
              </div>
              <span>SmartLink</span>
            </a>
            <p>
              Enterprise-grade short links, real-time campaign attribution, and click intelligence.
            </p>

            <a
              href="/status"
              className="mkt-status-badge"
              onClick={(e) => handleNav("/status", e)}
            >
              <span className="mkt-status-dot-pulse" aria-hidden="true"></span>
              <span>All Systems Operational</span>
            </a>
          </div>

          {/* Column 1: Product */}
          <div className="mkt-footer-col">
            <h5>Product</h5>
            <ul>
              <li>
                <a href="/#features" onClick={(e) => handleNav("/#features", e)}>
                  Features
                </a>
              </li>
              <li>
                <a href="/pricing" onClick={(e) => handleNav("/pricing", e)}>
                  Pricing
                </a>
              </li>
              <li>
                <a href="/docs" onClick={(e) => handleNav("/docs", e)}>
                  Integrations
                </a>
              </li>
              <li>
                <a href="/changelog" onClick={(e) => handleNav("/changelog", e)}>
                  Changelog
                </a>
              </li>
              <li>
                <a href="/status" onClick={(e) => handleNav("/status", e)}>
                  System Status
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div className="mkt-footer-col">
            <h5>Resources</h5>
            <ul>
              <li>
                <a href="/docs" onClick={(e) => handleNav("/docs", e)}>
                  Documentation
                </a>
              </li>
              <li>
                <a href="/docs" onClick={(e) => handleNav("/docs#analytics-api", e)}>
                  API Reference
                </a>
              </li>
              <li>
                <a href="/docs" onClick={(e) => handleNav("/docs#quickstart", e)}>
                  Quick Start Guide
                </a>
              </li>
              <li>
                <a href="https://github.com/developer/smartlink" target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className="mkt-footer-col">
            <h5>Company</h5>
            <ul>
              <li>
                <a href="/#features" onClick={(e) => handleNav("/#features", e)}>
                  About
                </a>
              </li>
              <li>
                <a href="/changelog" onClick={(e) => handleNav("/changelog", e)}>
                  Blog & Releases
                </a>
              </li>
              <li>
                <a href="/pricing" onClick={(e) => handleNav("/pricing", e)}>
                  Careers
                </a>
              </li>
              <li>
                <a href="mailto:support@smartlink.io">Contact</a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div className="mkt-footer-col">
            <h5>Legal</h5>
            <ul>
              <li>
                <a href="/docs" onClick={(e) => handleNav("/docs", e)}>
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/docs" onClick={(e) => handleNav("/docs", e)}>
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/status" onClick={(e) => handleNav("/status", e)}>
                  Security
                </a>
              </li>
              <li>
                <a href="/status" onClick={(e) => handleNav("/status", e)}>
                  Cookie Preferences
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mkt-footer-bottom">
          <span>&copy; {new Date().getFullYear()} SmartLink, Inc. All rights reserved.</span>
          <span>Engineered for performance and measurement.</span>
        </div>
      </div>
    </footer>
  );
}
