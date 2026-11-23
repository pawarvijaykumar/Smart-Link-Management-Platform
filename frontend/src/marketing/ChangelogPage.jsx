import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import MarketingLayout from "./MarketingLayout";
import { CHANGELOG } from "../data/changelog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ArrowRight } from "lucide-react";
import "./Changelog.css";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "feature", label: "Features" },
  { key: "improvement", label: "Improvements" },
  { key: "fix", label: "Fixes" },
  { key: "security", label: "Security" },
];

function formatShortDate(isoStr) {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return `${monthNames[m]} ${d}`;
}

function getMonthYear(isoStr) {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  const monthFullNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const m = parseInt(parts[1], 10) - 1;
  return `${monthFullNames[m]} ${parts[0]}`;
}

function getReleaseHeading(item) {
  const shortDate = formatShortDate(item.date);
  return item.release ? `${item.release} - ${shortDate}` : shortDate;
}

export default function ChangelogPage({ token, onNavigate }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [highlightedId, setHighlightedId] = useState(null);
  const [activeMonth, setActiveMonth] = useState("");

  const trackRef = useRef(null);
  const lineRef = useRef(null);

  // Newsletter state
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState(null); // null | "success" | "error"
  const [subscribeMessage, setSubscribeMessage] = useState("");

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (selectedCategory === "all") return CHANGELOG;
    return CHANGELOG.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  // Paginated entries
  const displayedEntries = useMemo(() => {
    return filteredEntries.slice(0, visibleCount);
  }, [filteredEntries, visibleCount]);

  // Group displayed entries by Month Year, then by Release Heading
  const groupedEntries = useMemo(() => {
    const monthGroups = [];
    displayedEntries.forEach((item) => {
      const monthKey = getMonthYear(item.date);
      let monthGroup = monthGroups.find((g) => g.monthYear === monthKey);
      if (!monthGroup) {
        monthGroup = { monthYear: monthKey, releases: [] };
        monthGroups.push(monthGroup);
      }
      const relKey = getReleaseHeading(item);
      let releaseGroup = monthGroup.releases.find((r) => r.heading === relKey);
      if (!releaseGroup) {
        releaseGroup = { heading: relKey, items: [] };
        monthGroup.releases.push(releaseGroup);
      }
      releaseGroup.items.push(item);
    });
    return monthGroups;
  }, [displayedEntries]);

  // Initialize or update activeMonth
  useEffect(() => {
    if (groupedEntries.length > 0) {
      if (!activeMonth || !groupedEntries.some((g) => g.monthYear === activeMonth)) {
        setActiveMonth(groupedEntries[0].monthYear);
      }
    }
  }, [groupedEntries, activeMonth]);

  // IntersectionObserver to highlight active month in view as the user scrolls
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const m = entry.target.getAttribute("data-month");
            if (m) setActiveMonth(m);
          }
        });
      },
      {
        rootMargin: "-100px 0px -60% 0px",
        threshold: 0,
      }
    );

    const monthEls = document.querySelectorAll(".cl-month-section");
    monthEls.forEach((el) => observer.observe(el));

    return () => {
      monthEls.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [groupedEntries]);

  // 1px dashed vertical line connecting from first dot to last dot
  useLayoutEffect(() => {
    const updateLine = () => {
      if (!trackRef.current || !lineRef.current) return;
      const dots = trackRef.current.querySelectorAll(".cl-timeline-dot");
      if (dots.length < 2) {
        lineRef.current.style.display = "none";
        return;
      }
      lineRef.current.style.display = "block";
      const trackRect = trackRef.current.getBoundingClientRect();
      const firstDotRect = dots[0].getBoundingClientRect();
      const lastDotRect = dots[dots.length - 1].getBoundingClientRect();

      const topOffset = firstDotRect.top + firstDotRect.height / 2 - trackRect.top;
      const bottomOffset = lastDotRect.top + lastDotRect.height / 2 - trackRect.top;
      const height = Math.max(0, bottomOffset - topOffset);

      lineRef.current.style.top = `${topOffset}px`;
      lineRef.current.style.height = `${height}px`;
    };

    updateLine();
    window.addEventListener("resize", updateLine);

    let ro;
    if (typeof ResizeObserver !== "undefined" && trackRef.current) {
      ro = new ResizeObserver(updateLine);
      ro.observe(trackRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateLine);
      if (ro) ro.disconnect();
    };
  }, [displayedEntries, selectedCategory]);

  // Smooth scroll to month on click
  const handleMonthScroll = (monthYear) => {
    setActiveMonth(monthYear);
    const slug = monthYear.toLowerCase().replace(/\s+/g, "-");
    const el = document.getElementById(`month-${slug}`);
    if (el) {
      const navOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  // Handle URL hash anchor scrolling & highlighting
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash ? window.location.hash.substring(1) : "";
      if (!hash) return;

      const targetEl = document.getElementById(hash);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(hash);
        const timer = setTimeout(() => {
          setHighlightedId(null);
        }, 2400);
        return () => clearTimeout(timer);
      }
    };

    const timeout = setTimeout(handleHashChange, 150);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [displayedEntries]);

  // Newsletter subscribe handler
  const handleSubscribe = (e) => {
    e.preventDefault();
    const trimmed = subscribeEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setSubscribeStatus("error");
      setSubscribeMessage("Please enter a valid email address.");
      return;
    }

    setSubscribeStatus("success");
    setSubscribeMessage("Subscribed to product updates.");
    setSubscribeEmail("");

    setTimeout(() => {
      setSubscribeStatus(null);
      setSubscribeMessage("");
    }, 4000);
  };

  const handleLinkClick = (href, e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(href);
    } else {
      window.history.pushState({}, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const latestEntryId = CHANGELOG.length > 0 ? CHANGELOG[0].id : null;

  return (
    <MarketingLayout
      title="Changelog — SmartLink"
      description="New features, improvements and fixes in SmartLink."
      token={token}
      currentPath="/changelog"
      onNavigate={onNavigate}
    >
      <div className="cl-page-root">
        {/* Header Section */}
        <header className="cl-header">
          <h1 className="cl-title">Changelog</h1>
          <p className="cl-subtitle">
            New features, improvements and fixes in SmartLink.
          </p>

          {/* Filter Chips */}
          <div className="cl-filters-wrapper">
            <nav className="cl-filters-nav" aria-label="Changelog category filters">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedCategory(cat.key);
                      setVisibleCount(12);
                    }}
                    className={`cl-filter-chip ${isSelected ? "cl-filter-chip--active" : ""}`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* 1px Divider Line Between Header and Timeline */}
        <div className="cl-header-divider" aria-hidden="true" />

        {/* 2-Column Layout: Left Sticky Months + Centre Max-760px Timeline */}
        <div className="cl-main-layout">
          {/* Left Column (Sticky Month List - hidden when results are empty) */}
          {filteredEntries.length > 0 && (
            <aside className="cl-col-left" aria-label="Months">
              <div className="cl-sticky-months">
                <span className="cl-months-nav-title">Months</span>
                <nav className="cl-months-nav">
                  {groupedEntries.map((group) => {
                    const isActive = activeMonth === group.monthYear;
                    return (
                      <button
                        key={group.monthYear}
                        type="button"
                        className={`cl-month-nav-btn ${isActive ? "active" : ""}`}
                        onClick={() => handleMonthScroll(group.monthYear)}
                        aria-current={isActive ? "true" : undefined}
                      >
                        <span className="cl-month-nav-dot" aria-hidden="true" />
                        <span className="cl-month-nav-text">{group.monthYear}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>
          )}

          {/* Centre Column (Max 760px): The Timeline */}
          <div
            className="cl-timeline-column"
            style={filteredEntries.length === 0 ? { maxWidth: "100%", margin: "0 auto" } : undefined}
          >
            {filteredEntries.length === 0 ? (
              <p className="cl-empty-line" role="status">
                No updates in this category yet.
              </p>
            ) : (
              <div className="cl-timeline-track" ref={trackRef}>
                {/* 1px dashed vertical line running behind dots from first to last entry */}
                <div className="cl-timeline-line" ref={lineRef} aria-hidden="true" />

                {groupedEntries.map((monthGroup, mIdx) => {
                  const slug = monthGroup.monthYear.toLowerCase().replace(/\s+/g, "-");
                  return (
                    <section
                      key={monthGroup.monthYear}
                      id={`month-${slug}`}
                      data-month={monthGroup.monthYear}
                      className="cl-month-section"
                    >
                      {/* 1px Divider Line between months */}
                      {mIdx > 0 && (
                        <div className="cl-month-divider" aria-hidden="true" />
                      )}

                      <div className="cl-month-heading-row">
                        <h2 className="cl-month-heading">{monthGroup.monthYear}</h2>
                      </div>

                      {/* Releases under this month */}
                      {monthGroup.releases.map((release) => {
                        const hasMultipleEntries = release.items.length >= 2;

                        return (
                          <div key={release.heading} className="cl-release-group">
                            {/* Render separate release heading ONLY when release contains 2 or more entries */}
                            {hasMultipleEntries && (
                              <div className="cl-release-heading-row">
                                <h3 className="cl-release-heading">{release.heading}</h3>
                              </div>
                            )}

                            <ol className="cl-timeline-list">
                              {release.items.map((entry) => {
                                const isHighlighted = highlightedId === entry.id;
                                const isLatest = entry.id === latestEntryId;
                                const categoryName =
                                  entry.category.charAt(0).toUpperCase() +
                                  entry.category.slice(1);

                                return (
                                  <li
                                    key={entry.id}
                                    id={entry.id}
                                    className="cl-timeline-item"
                                  >
                                    {/* Neutral grey dot aligned vertically with meta line */}
                                    <span
                                      className="cl-timeline-dot"
                                      aria-hidden="true"
                                    />

                                    {/* Entry Meta Line:
                                        If release has 1 entry: show "v2.5 - Nov 22" inline.
                                        If release has 2+ entries: date was shown in release heading above,
                                        so show "Feature" (plain muted text) + "New" only on latest. */}
                                    <div className="cl-entry-meta">
                                      {!hasMultipleEntries && (
                                        <>
                                          <span className="cl-mono-meta">
                                            {release.heading}
                                          </span>
                                          <span className="cl-meta-separator" aria-hidden="true">·</span>
                                        </>
                                      )}
                                      <span className="cl-category-plain">
                                        {categoryName}
                                      </span>
                                      {isLatest && (
                                        <>
                                          <span className="cl-meta-separator" aria-hidden="true">·</span>
                                          <span className="cl-new-label">New</span>
                                        </>
                                      )}
                                    </div>

                                    {/* Card Content without internal dividers */}
                                    <article
                                      className={`cl-entry-card ${isHighlighted ? "cl-card--highlighted" : ""}`}
                                    >
                                      <h4 className="cl-card-title">{entry.title}</h4>
                                      <p className="cl-card-description">
                                        {entry.description}
                                      </p>

                                      {/* Show Learn more ONLY if the entry has a real link field */}
                                      {Boolean(entry.link) && (
                                        <a
                                          href={entry.link}
                                          onClick={(e) => handleLinkClick(entry.link, e)}
                                          className="cl-learn-more-link"
                                        >
                                          <span>Learn more</span>
                                          <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" />
                                        </a>
                                      )}
                                    </article>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        );
                      })}
                    </section>
                  );
                })}
              </div>
            )}

            {/* Pagination Button */}
            {filteredEntries.length > displayedEntries.length && (
              <div className="cl-pagination-wrapper">
                <Button
                  variant="glass"
                  size="md"
                  onClick={() => setVisibleCount((prev) => prev + 8)}
                >
                  Load older updates
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Full-width strip below the timeline */}
        <section className="cl-subscribe-strip" aria-labelledby="subscribe-heading">
          <div className="cl-subscribe-strip-inner">
            <div className="cl-subscribe-strip-left">
              <h2 id="subscribe-heading" className="cl-subscribe-strip-title">
                Get product updates
              </h2>
              <p className="cl-subscribe-strip-desc">
                Subscribe for release notes and major product announcements.
              </p>
            </div>
            <form className="cl-subscribe-form-inline" onSubmit={handleSubscribe} noValidate>
              <div className="cl-subscribe-input-wrap">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={subscribeEmail}
                  onChange={(e) => setSubscribeEmail(e.target.value)}
                  aria-label="Email address for product updates"
                  required
                />
              </div>
              <Button type="submit" variant="primary" size="md" className="cl-subscribe-submit-btn">
                Subscribe
              </Button>
            </form>
          </div>
          {subscribeStatus && (
            <div
              className={`cl-subscribe-toast ${subscribeStatus === "error" ? "cl-subscribe-toast--error" : ""}`}
              role="status"
            >
              {subscribeMessage}
            </div>
          )}
        </section>
      </div>
    </MarketingLayout>
  );
}
