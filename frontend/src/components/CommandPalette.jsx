import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import {
  Search,
  Plus,
  Sun,
  Moon,
  Settings,
  LayoutDashboard,
  Link2,
  QrCode,
  Megaphone,
  Globe,
  Smartphone,
  Activity,
  ArrowRightLeft,
  ShieldAlert,
  GitFork,
  FileText,
  HelpCircle,
  Zap,
  Check,
  Clock,
  ExternalLink,
  CornerDownLeft,
  X,
} from "lucide-react";
import { Skeleton } from "./ui";
import "./CommandPalette.css";

const RECENT_STORAGE_KEY = "smartlink-command-recent";
const MAX_RECENT_ITEMS = 5;

// In-memory links cache across palette opens
let inMemoryLinksCache = null;

/**
 * Substring highlight helper that safely wraps matched query terms in <mark>.
 */
function HighlightMatch({ text = "", query = "" }) {
  if (!text) return null;
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) return <>{text}</>;

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + trimmed.length);
  const after = text.slice(matchIndex + trimmed.length);

  return (
    <>
      {before}
      <mark className="cmd-match-highlight">{match}</mark>
      <HighlightMatch text={after} query={query} />
    </>
  );
}

export default function CommandPalette({
  isOpen,
  onClose,
  token,
  apiUrl,
  currentTheme = "dark",
  onToggleTheme,
  onNavigateView,
  onNavigateRoute,
  onOpenCreateLink,
  onSelectLink,
  initialLinks = [],
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [links, setLinks] = useState(() => inMemoryLinksCache || initialLinks || []);
  const [linksLoading, setLinksLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [recentItems, setRecentItems] = useState(() => {
    try {
      const stored = localStorage.getItem(RECENT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  });

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Focus management: preserve previous active element and focus search input on open
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
      setQuery("");
      setSelectedIndex(0);

      // Autofocus input
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);

      // Fetch links if not cached yet
      if (!inMemoryLinksCache) {
        setLinksLoading(true);
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        axios
          .get(`${apiUrl}/my-links`, { headers })
          .then((res) => {
            const fetched = res.data?.data || [];
            inMemoryLinksCache = fetched;
            setLinks(fetched);
          })
          .catch(() => {
            // Fallback to initial links if available
            if (initialLinks && initialLinks.length > 0) {
              setLinks(initialLinks);
            }
          })
          .finally(() => {
            setLinksLoading(false);
          });
      } else {
        setLinks(inMemoryLinksCache);
      }

      return () => clearTimeout(timer);
    } else {
      // Return focus to previous element when palette closes
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
        previousActiveElementRef.current.focus();
      }
    }
  }, [isOpen, apiUrl, token, initialLinks]);

  // Toast notification helper
  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage("");
    }, 2200);
  }, []);

  // Save item to Recent in localStorage
  const saveToRecent = useCallback((item) => {
    try {
      const serialized = {
        id: item.id,
        group: "recent",
        label: item.label,
        subtitle: item.subtitle,
        iconName: item.iconName,
        actionType: item.actionType,
        actionPayload: item.actionPayload,
        url: item.url,
      };

      setRecentItems((prev) => {
        const filtered = prev.filter((r) => r.id !== item.id);
        const next = [serialized, ...filtered].slice(0, MAX_RECENT_ITEMS);
        try {
          localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
        } catch (_) {}
        return next;
      });
    } catch (_) {}
  }, []);

  // Actions catalog
  const actionItems = useMemo(
    () => [
      {
        id: "act-create",
        group: "Actions",
        icon: Plus,
        iconName: "Plus",
        label: "Create link",
        subtitle: "Shorten a new destination URL",
        actionType: "create-link",
        keywords: "new shorten add link url",
      },
      {
        id: "act-theme",
        group: "Actions",
        icon: currentTheme === "dark" ? Sun : Moon,
        iconName: currentTheme === "dark" ? "Sun" : "Moon",
        label: "Toggle theme",
        subtitle: currentTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        actionType: "toggle-theme",
        keywords: "theme dark light appearance mode switch",
      },
      {
        id: "act-settings",
        group: "Actions",
        icon: Settings,
        iconName: "Settings",
        label: "Open settings",
        subtitle: "Appearance, profile and preferences",
        actionType: "navigate-view",
        actionPayload: "settings",
        keywords: "settings appearance account preferences profile",
      },
    ],
    [currentTheme]
  );

  // Navigate pages catalog (every sidebar page)
  const navigateItems = useMemo(
    () => [
      {
        id: "nav-dashboard",
        group: "Navigate",
        icon: LayoutDashboard,
        iconName: "LayoutDashboard",
        label: "Dashboard",
        subtitle: "Overview metrics and recent performance",
        actionType: "navigate-view",
        actionPayload: "dashboard",
        keywords: "home dashboard metrics stats analytics overview",
      },
      {
        id: "nav-links",
        group: "Navigate",
        icon: Link2,
        iconName: "Link2",
        label: "My Links",
        subtitle: "Manage, filter and copy all created links",
        actionType: "navigate-view",
        actionPayload: "links",
        keywords: "my links manage list table url short urls",
      },
      {
        id: "nav-qr",
        group: "Navigate",
        icon: QrCode,
        iconName: "QrCode",
        label: "QR Analytics",
        subtitle: "Scans, high-res downloads and QR performance",
        actionType: "navigate-view",
        actionPayload: "qr-analytics",
        keywords: "qr codes scan downloads tracking qr-analytics",
      },
      {
        id: "nav-campaigns",
        group: "Navigate",
        icon: Megaphone,
        iconName: "Megaphone",
        label: "Campaigns",
        subtitle: "UTM tags and marketing attribution",
        actionType: "navigate-view",
        actionPayload: "campaigns",
        keywords: "campaigns utm source medium term marketing attribution",
      },
      {
        id: "nav-geo",
        group: "Navigate",
        icon: Globe,
        iconName: "Globe",
        label: "Geo Analytics",
        subtitle: "Global distribution, countries and top cities",
        actionType: "navigate-view",
        actionPayload: "geo-analytics",
        keywords: "geo countries cities map globe location traffic",
      },
      {
        id: "nav-devices",
        group: "Navigate",
        icon: Smartphone,
        iconName: "Smartphone",
        label: "Devices & OS",
        subtitle: "Browsers, operating systems and mobile breakdown",
        actionType: "navigate-view",
        actionPayload: "device-analytics",
        keywords: "devices os browsers mobile desktop mobile-breakdown",
      },
      {
        id: "nav-traffic",
        group: "Navigate",
        icon: Activity,
        iconName: "Activity",
        label: "Traffic Analytics",
        subtitle: "Referrers, channels and direct traffic trends",
        actionType: "navigate-view",
        actionPayload: "traffic-analytics",
        keywords: "traffic referrers channels volume trends organic direct",
      },
      {
        id: "nav-comparison",
        group: "Navigate",
        icon: ArrowRightLeft,
        iconName: "ArrowRightLeft",
        label: "Link Comparison",
        subtitle: "Head-to-head performance benchmarks",
        actionType: "navigate-view",
        actionPayload: "link-comparison",
        keywords: "compare comparison benchmark vs diff links",
      },
      {
        id: "nav-anomaly",
        group: "Navigate",
        icon: ShieldAlert,
        iconName: "ShieldAlert",
        label: "Traffic Intelligence",
        subtitle: "Spike detection and anomalous traffic alerts",
        actionType: "navigate-view",
        actionPayload: "anomaly-detection",
        keywords: "anomaly intelligence spikes bot security alerts traffic-intelligence",
      },
      {
        id: "nav-ab",
        group: "Navigate",
        icon: GitFork,
        iconName: "GitFork",
        label: "A/B Testing",
        subtitle: "Split testing and variant conversion tracking",
        actionType: "navigate-view",
        actionPayload: "ab-testing",
        keywords: "a/b testing split variants experiments conversion",
      },
      {
        id: "nav-reports",
        group: "Navigate",
        icon: FileText,
        iconName: "FileText",
        label: "Reports & Export",
        subtitle: "CSV/PDF exports and scheduled automated reports",
        actionType: "navigate-view",
        actionPayload: "reports",
        keywords: "reports export csv pdf schedule automated download",
      },
      {
        id: "nav-settings",
        group: "Navigate",
        icon: Settings,
        iconName: "Settings",
        label: "Settings",
        subtitle: "Appearance, account security and workspace",
        actionType: "navigate-view",
        actionPayload: "settings",
        keywords: "settings appearance profile preferences theme workspace",
      },
    ],
    []
  );

  // Help catalog
  const helpItems = useMemo(
    () => [
      {
        id: "help-docs",
        group: "Help",
        icon: HelpCircle,
        iconName: "HelpCircle",
        label: "Docs",
        subtitle: "Guides, API documentation and tutorials",
        actionType: "navigate-route",
        actionPayload: "/docs",
        keywords: "docs documentation api guides help help-center",
      },
      {
        id: "help-changelog",
        group: "Help",
        icon: Zap,
        iconName: "Zap",
        label: "Changelog",
        subtitle: "Latest platform features and release notes",
        actionType: "navigate-route",
        actionPayload: "/changelog",
        keywords: "changelog updates what is new release notes versions",
      },
    ],
    []
  );

  // Link items mapped from user's links
  const userLinkItems = useMemo(() => {
    return links.map((link) => {
      const shortCode = link.shortCode || "";
      const shortUrl = `${apiUrl}/${shortCode}`;
      const title = link.title || shortCode;
      const originalUrl = link.originalUrl || link.destinationUrl || "";

      return {
        id: `link-${link._id || shortCode}`,
        group: "Links",
        icon: Link2,
        iconName: "Link2",
        label: title,
        subtitle: `${shortUrl} → ${originalUrl}`,
        shortUrl,
        originalUrl,
        shortCode,
        actionType: "select-link",
        actionPayload: link,
        keywords: `${title} ${shortCode} ${originalUrl} ${shortUrl}`,
        isLink: true,
      };
    });
  }, [links, apiUrl]);

  // Grouped items calculation based on query
  const groupedResults = useMemo(() => {
    const q = query.trim().toLowerCase();

    // EMPTY QUERY: Show Recent (if any) followed by Actions
    if (!q) {
      const groups = [];

      if (recentItems.length > 0) {
        // Resolve icons for recent items
        const resolvedRecent = recentItems.map((r) => {
          let IconComponent = Clock;
          if (r.iconName === "Plus") IconComponent = Plus;
          else if (r.iconName === "Sun") IconComponent = Sun;
          else if (r.iconName === "Moon") IconComponent = Moon;
          else if (r.iconName === "Settings") IconComponent = Settings;
          else if (r.iconName === "LayoutDashboard") IconComponent = LayoutDashboard;
          else if (r.iconName === "Link2") IconComponent = Link2;
          else if (r.iconName === "QrCode") IconComponent = QrCode;
          else if (r.iconName === "Megaphone") IconComponent = Megaphone;
          else if (r.iconName === "Globe") IconComponent = Globe;
          else if (r.iconName === "Smartphone") IconComponent = Smartphone;
          else if (r.iconName === "Activity") IconComponent = Activity;
          else if (r.iconName === "ArrowRightLeft") IconComponent = ArrowRightLeft;
          else if (r.iconName === "ShieldAlert") IconComponent = ShieldAlert;
          else if (r.iconName === "GitFork") IconComponent = GitFork;
          else if (r.iconName === "FileText") IconComponent = FileText;
          else if (r.iconName === "HelpCircle") IconComponent = HelpCircle;
          else if (r.iconName === "Zap") IconComponent = Zap;

          return {
            ...r,
            icon: IconComponent,
          };
        });

        groups.push({
          name: "Recent",
          items: resolvedRecent,
        });
      }

      groups.push({
        name: "Actions",
        items: actionItems,
      });

      return groups;
    }

    // NON-EMPTY QUERY: Filter all groups client-side in order: Actions, Navigate, Links (top 8), Help
    const filterFn = (item) => {
      const searchTarget = `${item.label} ${item.subtitle || ""} ${item.keywords || ""}`.toLowerCase();
      // Multi-word token match
      const tokens = q.split(/\s+/).filter(Boolean);
      return tokens.every((token) => searchTarget.includes(token));
    };

    const matchingActions = actionItems.filter(filterFn);
    const matchingNavigate = navigateItems.filter(filterFn);
    const matchingLinks = userLinkItems.filter(filterFn).slice(0, 8);
    const matchingHelp = helpItems.filter(filterFn);

    const groups = [];
    if (matchingActions.length > 0) {
      groups.push({ name: "Actions", items: matchingActions });
    }
    if (matchingNavigate.length > 0) {
      groups.push({ name: "Navigate", items: matchingNavigate });
    }
    if (matchingLinks.length > 0 || linksLoading) {
      groups.push({
        name: "Links",
        items: matchingLinks,
        isLoading: linksLoading && matchingLinks.length === 0,
      });
    }
    if (matchingHelp.length > 0) {
      groups.push({ name: "Help", items: matchingHelp });
    }

    return groups;
  }, [query, recentItems, actionItems, navigateItems, userLinkItems, helpItems, linksLoading]);

  // Flattened array for index-based keyboard navigation
  const flattenedItems = useMemo(() => {
    const list = [];
    groupedResults.forEach((group) => {
      if (!group.isLoading && group.items) {
        group.items.forEach((item) => list.push(item));
      }
    });
    return list;
  }, [groupedResults]);

  // Ensure selectedIndex is always within valid bounds
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (flattenedItems.length === 0) return 0;
      if (prev >= flattenedItems.length) return flattenedItems.length - 1;
      return prev < 0 ? 0 : prev;
    });
  }, [flattenedItems]);

  // Execute an item action
  const executeItem = useCallback(
    (item) => {
      if (!item) return;

      saveToRecent(item);

      switch (item.actionType) {
        case "create-link":
          onClose();
          onOpenCreateLink?.();
          break;

        case "toggle-theme":
          onToggleTheme?.();
          showToast(`Theme switched to ${currentTheme === "dark" ? "light" : "dark"}`);
          break;

        case "navigate-view":
          onClose();
          onNavigateView?.(item.actionPayload);
          break;

        case "navigate-route":
          onClose();
          onNavigateRoute?.(item.actionPayload);
          break;

        case "select-link":
          onClose();
          onSelectLink?.(item.actionPayload);
          break;

        default:
          onClose();
      }
    },
    [onClose, onOpenCreateLink, onToggleTheme, onNavigateView, onNavigateRoute, onSelectLink, currentTheme, saveToRecent, showToast]
  );

  // Copy link short URL to clipboard
  const copyLinkUrl = useCallback(
    async (item) => {
      if (!item) return;
      const url = item.shortUrl || (item.shortCode ? `${apiUrl}/${item.shortCode}` : "");
      if (!url) return;

      try {
        await navigator.clipboard.writeText(url);
        showToast("Copied");
        saveToRecent(item);
      } catch (_) {
        showToast("Failed to copy");
      }
    },
    [apiUrl, showToast, saveToRecent]
  );

  // Keyboard navigation & shortcut handler
  const handleKeyDown = useCallback(
    (e) => {
      // Close on Escape
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Ctrl+Enter or Cmd+Enter on a link copies short URL
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const currentItem = flattenedItems[selectedIndex];
        if (currentItem && (currentItem.isLink || currentItem.shortUrl)) {
          copyLinkUrl(currentItem);
        }
        return;
      }

      // Enter executes current item
      if (e.key === "Enter") {
        e.preventDefault();
        const currentItem = flattenedItems[selectedIndex];
        if (currentItem) {
          executeItem(currentItem);
        } else if (query.trim()) {
          // If in empty state, trigger Create Link
          onClose();
          onOpenCreateLink?.();
        }
        return;
      }

      // Arrow navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (flattenedItems.length === 0) return;
        setSelectedIndex((prev) => (prev + 1) % flattenedItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (flattenedItems.length === 0) return;
        setSelectedIndex((prev) => (prev - 1 + flattenedItems.length) % flattenedItems.length);
      } else if (e.key === "Tab") {
        // Trap focus inside dialog: keep on input or cycle
        e.preventDefault();
        inputRef.current?.focus();
      }
    },
    [onClose, flattenedItems, selectedIndex, executeItem, copyLinkUrl, query, onOpenCreateLink]
  );

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.querySelector(".cmd-item.selected");
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const selectedItem = flattenedItems[selectedIndex];
  const isSelectedALink = selectedItem && (selectedItem.isLink || selectedItem.shortUrl);
  let runningIndex = 0;

  return (
    <div className="cmd-portal-root">
      {/* Dimmed backdrop */}
      <div
        className="cmd-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Glass Dialog */}
      <div
        className="cmd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="cmd-header">
          <span className="cmd-search-icon" aria-hidden="true">
            <Search size={18} />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="cmd-listbox"
            aria-activedescendant={selectedItem ? `cmd-item-${selectedItem.id}` : undefined}
            placeholder="Type a command or search links..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          {query ? (
            <button
              type="button"
              className="cmd-clear-btn"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="cmd-shortcut-badge" aria-hidden="true">
              Esc
            </kbd>
          )}
        </div>

        {/* Results Container */}
        <div
          ref={listRef}
          id="cmd-listbox"
          className="cmd-listbox"
          role="listbox"
          aria-label="Suggestions"
        >
          {/* Skeleton loading state for links */}
          {linksLoading && query.trim() && (
            <div className="cmd-group" role="group" aria-label="Loading links">
              <div className="cmd-group-heading">Links</div>
              <div className="cmd-skeleton-list">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="cmd-skeleton-row" aria-hidden="true">
                    <Skeleton width="18px" height="18px" borderRadius="4px" />
                    <div className="cmd-skeleton-details">
                      <Skeleton width={`${40 + n * 15}%`} height="14px" borderRadius="4px" />
                      <Skeleton width={`${60 + n * 10}%`} height="11px" borderRadius="3px" style={{ marginTop: "4px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grouped items */}
          {groupedResults.map((group) => {
            if (group.isLoading) return null;
            if (!group.items || group.items.length === 0) return null;

            return (
              <div
                key={group.name}
                className="cmd-group"
                role="group"
                aria-labelledby={`cmd-heading-${group.name}`}
              >
                <div
                  id={`cmd-heading-${group.name}`}
                  className="cmd-group-heading"
                >
                  {group.name}
                </div>

                <div className="cmd-group-items">
                  {group.items.map((item) => {
                    const currentIndex = runningIndex++;
                    const isSelected = currentIndex === selectedIndex;
                    const IconComponent = item.icon || Link2;

                    return (
                      <div
                        key={item.id}
                        id={`cmd-item-${item.id}`}
                        role="option"
                        aria-selected={isSelected}
                        className={`cmd-item ${isSelected ? "selected" : ""}`}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <span className="cmd-item-icon" aria-hidden="true">
                          <IconComponent size={16} />
                        </span>

                        <div className="cmd-item-content">
                          <div className="cmd-item-title">
                            <HighlightMatch text={item.label} query={query} />
                          </div>
                          {item.subtitle && (
                            <div className="cmd-item-subtitle">
                              <HighlightMatch text={item.subtitle} query={query} />
                            </div>
                          )}
                        </div>

                        {/* Right Action Hint */}
                        <div className="cmd-item-actions">
                          {item.isLink && (
                            <button
                              type="button"
                              className="cmd-item-copy-btn"
                              title="Copy short URL (Ctrl+Enter)"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyLinkUrl(item);
                              }}
                              aria-label={`Copy short URL for ${item.label}`}
                            >
                              <span className="cmd-key-hint">Ctrl+↵</span>
                            </button>
                          )}
                          <span className="cmd-item-enter-icon" aria-hidden="true">
                            <CornerDownLeft size={13} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {flattenedItems.length === 0 && !linksLoading && query.trim() && (
            <div className="cmd-empty-state">
              <p className="cmd-empty-title">
                No results for &ldquo;{query}&rdquo;
              </p>
              <p className="cmd-empty-subtitle">
                Try searching for another action, page or link, or{" "}
                <button
                  type="button"
                  className="cmd-empty-create-btn"
                  onClick={() => {
                    onClose();
                    onOpenCreateLink?.();
                  }}
                >
                  <Plus size={13} /> Create link
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Keyboard hint footer */}
        <div className="cmd-footer">
          <div className="cmd-footer-hints">
            <span className="cmd-hint-item">
              <kbd className="cmd-kbd">↑</kbd>
              <kbd className="cmd-kbd">↓</kbd>
              <span className="cmd-hint-text">to navigate</span>
            </span>
            <span className="cmd-hint-item">
              <kbd className="cmd-kbd">↵</kbd>
              <span className="cmd-hint-text">to select</span>
            </span>
            {isSelectedALink && (
              <span className="cmd-hint-item">
                <kbd className="cmd-kbd">Ctrl</kbd>+<kbd className="cmd-kbd">↵</kbd>
                <span className="cmd-hint-text">to copy</span>
              </span>
            )}
            <span className="cmd-hint-item">
              <kbd className="cmd-kbd">Esc</kbd>
              <span className="cmd-hint-text">to close</span>
            </span>
          </div>

          {/* Toast Alert */}
          {toastMessage && (
            <div className="cmd-toast" role="status" aria-live="polite">
              <Check size={13} />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
