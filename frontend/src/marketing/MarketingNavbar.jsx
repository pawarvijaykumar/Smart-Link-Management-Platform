import React, { useState, useEffect } from "react";
import { Link2, Menu, X, Sun, Moon, ArrowRight, LayoutDashboard } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function MarketingNavbar({ token, currentPath = "/", onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { effectiveTheme, setTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      if (currentPath === "/") {
        const hero = document.querySelector(".mkt-hero");
        if (hero) {
          const rect = hero.getBoundingClientRect();
          // Navbar is ~64px tall; hero bottom reaching near navbar switches to cream
          setIsScrolled(rect.bottom <= 72);
        } else {
          setIsScrolled(window.scrollY > 50);
        }
      } else {
        setIsScrolled(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [currentPath]);

  const handleNavClick = (path, e) => {
    if (e) e.preventDefault();
    setMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const toggleTheme = () => {
    setTheme(effectiveTheme === "dark" ? "light" : "dark");
  };

  const isHeroState = currentPath === "/" && !isScrolled;

  return (
    <header
      className={`mkt-navbar ${isHeroState ? "mkt-navbar--hero" : "mkt-navbar--scrolled"} ${
        mobileMenuOpen ? "mkt-navbar--open" : ""
      }`}
      role="banner"
    >
      <div className="mkt-container">
        <div className="mkt-navbar-inner">
          {/* Logo */}
          <a
            href="/"
            className="mkt-logo-link"
            onClick={(e) => handleNavClick("/", e)}
            aria-label="SmartLink Home"
          >
            <div className="mkt-logo-icon">
              <Link2 size={18} strokeWidth={2} />
            </div>
            <span>SmartLink</span>
            <span className="mkt-logo-badge">PRO</span>
          </a>

          {/* Desktop Nav Links */}
          <nav className="mkt-nav-links" aria-label="Main Navigation">
            <a
              href="/#features"
              className={`mkt-nav-link ${currentPath === "/#features" ? "active" : ""}`}
              onClick={(e) => {
                if (currentPath === "/") {
                  const el = document.getElementById("features");
                  if (el) {
                    e.preventDefault();
                    el.scrollIntoView({ behavior: "smooth" });
                  }
                } else {
                  handleNavClick("/#features", e);
                }
              }}
            >
              Features
            </a>
            <a
              href="/pricing"
              className={`mkt-nav-link ${currentPath === "/pricing" ? "active" : ""}`}
              onClick={(e) => handleNavClick("/pricing", e)}
            >
              Pricing
            </a>
            <a
              href="/docs"
              className={`mkt-nav-link ${currentPath === "/docs" ? "active" : ""}`}
              onClick={(e) => handleNavClick("/docs", e)}
            >
              Docs
            </a>
            <a
              href="/changelog"
              className={`mkt-nav-link ${currentPath === "/changelog" ? "active" : ""}`}
              onClick={(e) => handleNavClick("/changelog", e)}
            >
              Changelog
            </a>
          </nav>

          {/* Nav Actions */}
          <div className="mkt-nav-actions">
            {/* Theme Switcher */}
            <button
              type="button"
              className="mkt-theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle color theme"
            >
              {effectiveTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {token ? (
              /* User is logged in */
              <button
                type="button"
                className="mkt-btn mkt-btn-primary"
                onClick={(e) => handleNavClick("/dashboard", e)}
              >
                <LayoutDashboard size={16} />
                <span>Go to dashboard</span>
                <ArrowRight size={15} />
              </button>
            ) : (
              /* Visitor is not logged in */
              <>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-ghost"
                  onClick={(e) => handleNavClick("/login", e)}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary"
                  onClick={(e) => handleNavClick("/register", e)}
                >
                  <span>Get started</span>
                  <ArrowRight size={15} />
                </button>
              </>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="mkt-mobile-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mkt-mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
          <a
            href="/#features"
            className="mkt-mobile-nav-link"
            onClick={(e) => {
              setMobileMenuOpen(false);
              if (currentPath === "/") {
                const el = document.getElementById("features");
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: "smooth" });
                }
              } else {
                handleNavClick("/#features", e);
              }
            }}
          >
            Features
          </a>
          <a
            href="/pricing"
            className="mkt-mobile-nav-link"
            onClick={(e) => handleNavClick("/pricing", e)}
          >
            Pricing
          </a>
          <a
            href="/docs"
            className="mkt-mobile-nav-link"
            onClick={(e) => handleNavClick("/docs", e)}
          >
            Docs
          </a>
          <a
            href="/changelog"
            className="mkt-mobile-nav-link"
            onClick={(e) => handleNavClick("/changelog", e)}
          >
            Changelog
          </a>
          <a
            href="/status"
            className="mkt-mobile-nav-link"
            onClick={(e) => handleNavClick("/status", e)}
          >
            System Status
          </a>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {token ? (
              <button
                type="button"
                className="mkt-btn mkt-btn-primary mkt-btn-lg"
                onClick={(e) => handleNavClick("/dashboard", e)}
              >
                <LayoutDashboard size={16} />
                <span>Go to dashboard</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-secondary mkt-btn-lg"
                  onClick={(e) => handleNavClick("/login", e)}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary mkt-btn-lg"
                  onClick={(e) => handleNavClick("/register", e)}
                >
                  Get started free
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
