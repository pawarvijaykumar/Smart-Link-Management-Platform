// =============================================================================
// CHANGE: Stage 13 Smart A/B Link Testing View — 2026-11-17
// Complete A/B experiment lifecycle management, 50/50 traffic allocation preview,
// fallback routing controls, and comparative IST click analytics.
// Updated: Automatic creation form draft persistence across navigation & reload.
// =============================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import SpecularButton from "./SpecularButton";
import {
  TrendingUp,
  Trophy,
  Copy,
  Check,
  Search,
  X,
  AlertTriangle,
  GitFork,
  BarChart3,
  Link2,
  ExternalLink,
  Plus,
  RefreshCw,
  FileEdit,
  ArrowLeft,
  Star,
} from "lucide-react";

import {
  DRAFT_STORAGE_KEY,
  MODAL_OPEN_STORAGE_KEY,
  DEFAULT_FORM_STATE,
  loadSavedDraft,
  loadSavedModalOpen,
  persistDraft,
  setModalOpenState,
  clearDraftStorage,
} from "../utils/abTestingDraft.js";

// Helper to format Date to IST string
const formatISTDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return d.toLocaleString();
  }
};

// Helper to format short date for trend chart (e.g. "17 Nov")
const formatChartDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(dt);
  } catch {
    return dateStr;
  }
};

// Helper: Truncate long URLs cleanly
const truncateUrl = (url, maxLen = 42) => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + (parsed.pathname === "/" ? "" : parsed.pathname);
    return display.length > maxLen ? `${display.slice(0, maxLen)}…` : display;
  } catch {
    return url.length > maxLen ? `${url.slice(0, maxLen)}…` : url;
  }
};

// Status badge helper
const renderStatusBadge = (status) => {
  switch (status) {
    case "active":
      return (
        <span className="ab-status-badge active" title="Active: Traffic is being split 50/50">
          <span className="ab-status-dot pulse" />
          Active
        </span>
      );
    case "draft":
      return (
        <span className="ab-status-badge draft" title="Draft: Links are inactive until started">
          <span className="ab-status-dot" />
          Draft
        </span>
      );
    case "paused":
      return (
        <span className="ab-status-badge paused" title="Paused: Traffic routes to fallback variant">
          <span className="ab-status-dot" />
          Paused
        </span>
      );
    case "completed":
      return (
        <span className="ab-status-badge completed" title="Completed: Traffic permanently routes to fallback">
          <span className="ab-status-dot" />
          Completed
        </span>
      );
    default:
      return <span className="ab-status-badge">{status}</span>;
  }
};

// -----------------------------------------------------------------------------
// Main Component: ABTestingView
// CHANGE: Stage 13 URL Selection from My Links & Draft Persistence — 2026-11-18
// -----------------------------------------------------------------------------
export default function ABTestingView({ links: propLinks = [], token, apiBaseUrl }) {
  // Navigation & view states
  const [experiments, setExperiments] = useState([]);
  const [selectedExperimentId, setSelectedExperimentId] = useState(null);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Filter & range states
  const [range, setRange] = useState("7d"); // "7d" | "30d" | "all"
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Loading & error states
  const [loadingList, setLoadingList] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Modal states with draft persistence
  const [showCreateModal, setShowCreateModal] = useState(loadSavedModalOpen);
  const [createForm, setCreateForm] = useState(loadSavedDraft);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // CHANGE: Stage 13 URL Selection from My Links State — 2026-11-18
  const [fetchedLinks, setFetchedLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkPickerTarget, setLinkPickerTarget] = useState(null); // "A" | "B" | null
  const [linkSearchTerm, setLinkSearchTerm] = useState("");

  // Detect whether incomplete draft data currently exists
  const hasDraft = useMemo(() => {
    return Boolean(
      createForm.name?.trim() ||
      createForm.variantA?.trim() ||
      createForm.variantB?.trim() ||
      createForm.fallbackVariant !== "A" ||
      createForm.status !== "active"
    );
  }, [createForm]);

  // Automatically save incomplete form data as temporary draft
  useEffect(() => {
    persistDraft(createForm);
  }, [createForm]);

  // Modal open & close handlers preserving draft
  const handleOpenModal = () => {
    setCreateError("");
    setShowCreateModal(true);
    setModalOpenState(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setModalOpenState(false);
    setLinkPickerTarget(null);
  };

  // Explicit Reset Action: Clears draft only upon user request
  const handleResetDraft = () => {
    setCreateForm({ ...DEFAULT_FORM_STATE });
    setCreateError("");
    clearDraftStorage();
  };

  // ---------------------------------------------------------------------------
  // CHANGE: Stage 13 Prevent background page scrolling while modal is open — 2026-11-18
  // Locks body scroll when create experiment or link picker modal is active.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const isAnyModalOpen = Boolean(showCreateModal || linkPickerTarget);
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [showCreateModal, linkPickerTarget]);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState(null);

  // Chart hover state
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Auto-dismiss success toast
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Auth headers generator
  const getAuthHeaders = useCallback(() => {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      withCredentials: true,
    };
  }, [token]);

  // ---------------------------------------------------------------------------
  // CHANGE: Stage 13 Fetch & Filter User Links for URL Picker — 2026-11-18
  // ---------------------------------------------------------------------------
  const availableLinks = useMemo(() => {
    if (propLinks && propLinks.length > 0) return propLinks;
    return fetchedLinks;
  }, [propLinks, fetchedLinks]);

  const fetchUserLinks = useCallback(async () => {
    if (!token) return;
    setLoadingLinks(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/api/links/my-links`, getAuthHeaders());
      if (res.data?.success && Array.isArray(res.data.data)) {
        setFetchedLinks(res.data.data);
      }
    } catch (err) {
      console.warn("Failed to fetch user links for picker:", err);
    } finally {
      setLoadingLinks(false);
    }
  }, [token, apiBaseUrl, getAuthHeaders]);

  useEffect(() => {
    if ((!propLinks || propLinks.length === 0) && token) {
      fetchUserLinks();
    }
  }, [propLinks, token, fetchUserLinks]);

  const filteredLinks = useMemo(() => {
    const term = linkSearchTerm.trim().toLowerCase();
    if (!term) return availableLinks;
    return availableLinks.filter((l) => {
      const name = (l.name || l.title || l.utmCampaign || "").toLowerCase();
      const code = (l.shortCode || "").toLowerCase();
      const orig = (l.originalUrl || "").toLowerCase();
      return name.includes(term) || code.includes(term) || orig.includes(term);
    });
  }, [availableLinks, linkSearchTerm]);

  // Insert original destination URL from selected short link
  const handleSelectLinkUrl = (originalUrl) => {
    if (!originalUrl) return;
    if (linkPickerTarget === "A") {
      setCreateForm((prev) => ({ ...prev, variantA: originalUrl }));
    } else if (linkPickerTarget === "B") {
      setCreateForm((prev) => ({ ...prev, variantB: originalUrl }));
    }
    setLinkPickerTarget(null);
    setLinkSearchTerm("");
  };

  // ---------------------------------------------------------------------------
  // Fetch All Experiments
  // ---------------------------------------------------------------------------
  const fetchExperiments = useCallback(async () => {
    if (!token) return;
    setLoadingList(true);
    setErrorMsg("");
    try {
      const res = await axios.get(`${apiBaseUrl}/api/experiments`, getAuthHeaders());
      if (res.data?.success) {
        setExperiments(res.data.experiments || []);
      }
    } catch (err) {
      console.error("Fetch experiments error:", err);
      setErrorMsg(err.response?.data?.message || "Failed to load A/B experiments.");
    } finally {
      setLoadingList(false);
    }
  }, [token, apiBaseUrl, getAuthHeaders]);

  // Initial load
  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  // ---------------------------------------------------------------------------
  // Fetch Analytics for Selected Experiment
  // ---------------------------------------------------------------------------
  const fetchAnalytics = useCallback(async (expId, selectedRange = range) => {
    if (!token || !expId) return;
    setLoadingAnalytics(true);
    setErrorMsg("");
    try {
      const res = await axios.get(
        `${apiBaseUrl}/api/experiments/${expId}/analytics?range=${selectedRange}`,
        getAuthHeaders()
      );
      if (res.data?.success) {
        setAnalyticsData(res.data);
        setSelectedExperiment(res.data.experiment);
      }
    } catch (err) {
      console.error("Fetch experiment analytics error:", err);
      setErrorMsg(err.response?.data?.message || "Failed to load experiment analytics.");
    } finally {
      setLoadingAnalytics(false);
    }
  }, [token, apiBaseUrl, range, getAuthHeaders]);

  // Trigger analytics fetch when selected experiment or range changes
  useEffect(() => {
    if (selectedExperimentId) {
      fetchAnalytics(selectedExperimentId, range);
    } else {
      setAnalyticsData(null);
      setSelectedExperiment(null);
    }
  }, [selectedExperimentId, range, fetchAnalytics]);

  // ---------------------------------------------------------------------------
  // Update Experiment Lifecycle Status
  // ---------------------------------------------------------------------------
  const handleUpdateStatus = async (expId, newStatus, newFallback) => {
    if (!token || !expId) return;
    setActionLoading(true);
    try {
      const payload = { status: newStatus };
      if (newFallback) payload.fallbackVariant = newFallback;

      const res = await axios.patch(
        `${apiBaseUrl}/api/experiments/${expId}/status`,
        payload,
        getAuthHeaders()
      );

      if (res.data?.success) {
        setSuccessToast(`Experiment updated: status set to ${newStatus}.`);
        await fetchExperiments();
        if (selectedExperimentId === expId) {
          await fetchAnalytics(expId, range);
        }
      }
    } catch (err) {
      console.error("Update experiment status error:", err);
      alert(err.response?.data?.message || "Failed to update experiment status.");
    } finally {
      setActionLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Update Fallback Variant
  // ---------------------------------------------------------------------------
  const handleUpdateFallback = async (expId, newFallback) => {
    if (!token || !expId) return;
    setActionLoading(true);
    try {
      const res = await axios.patch(
        `${apiBaseUrl}/api/experiments/${expId}/status`,
        { status: selectedExperiment?.status || "active", fallbackVariant: newFallback },
        getAuthHeaders()
      );

      if (res.data?.success) {
        setSuccessToast(`Fallback variant set to Variant ${newFallback}.`);
        await fetchExperiments();
        if (selectedExperimentId === expId) {
          await fetchAnalytics(expId, range);
        }
      }
    } catch (err) {
      console.error("Update fallback error:", err);
      alert(err.response?.data?.message || "Failed to update fallback variant.");
    } finally {
      setActionLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Create Experiment Handler
  // ---------------------------------------------------------------------------
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (!createForm.name.trim()) {
      setCreateError("Experiment name is required");
      return;
    }
    if (!createForm.variantA.trim()) {
      setCreateError("Variant A URL is required");
      return;
    }
    if (!createForm.variantB.trim()) {
      setCreateError("Variant B URL is required");
      return;
    }

    setCreating(true);
    try {
      const res = await axios.post(
        `${apiBaseUrl}/api/experiments`,
        {
          name: createForm.name.trim(),
          variantA: createForm.variantA.trim(),
          variantB: createForm.variantB.trim(),
          status: createForm.status,
          fallbackVariant: createForm.fallbackVariant,
        },
        getAuthHeaders()
      );

      if (res.data?.success) {
        handleCloseModal();
        setCreateForm({ ...DEFAULT_FORM_STATE });
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
          localStorage.removeItem(MODAL_OPEN_STORAGE_KEY);
        } catch (_) {}
        setSuccessToast("A/B Experiment created successfully!");
        await fetchExperiments();
        // Immediately view newly created experiment
        if (res.data.experiment?._id) {
          setSelectedExperimentId(res.data.experiment._id);
        }
      }
    } catch (err) {
      console.error("Create experiment error:", err);
      setCreateError(err.response?.data?.message || "Failed to create experiment.");
    } finally {
      setCreating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Copy Short Link Helper
  // ---------------------------------------------------------------------------
  const copyShortUrl = (shortCode, id) => {
    const fullUrl = `${apiBaseUrl}/${shortCode}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // ---------------------------------------------------------------------------
  // Filtered experiments for List View
  // ---------------------------------------------------------------------------
  const filteredExperiments = useMemo(() => {
    return experiments.filter((exp) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        exp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.shortCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.variantA?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.variantB?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || exp.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [experiments, searchQuery, statusFilter]);

  // ---------------------------------------------------------------------------
  // SVG Chart Geometry Calculation
  // ---------------------------------------------------------------------------
  const chartConfig = useMemo(() => {
    if (!analyticsData?.timeline || analyticsData.timeline.length === 0) {
      return null;
    }

    const timeline = analyticsData.timeline;
    const width = 800;
    const height = 260;
    const padLeft = 45;
    const padRight = 25;
    const padTop = 20;
    const padBottom = 35;

    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    // Find maximum clicks across all variants for y-scale
    const maxVal = Math.max(
      1,
      ...timeline.map((d) => Math.max(d.variantA || 0, d.variantB || 0))
    );

    // Compute Y ticks (4-5 ticks)
    const tickCount = 4;
    const step = Math.ceil(maxVal / tickCount);
    const niceMax = step * tickCount;
    const yTicks = [0];
    for (let i = 1; i <= tickCount; i++) {
      yTicks.push(i * step);
    }

    const numPoints = timeline.length;
    const getX = (idx) => {
      if (numPoints <= 1) return padLeft + innerW / 2;
      return padLeft + (idx / (numPoints - 1)) * innerW;
    };
    const getY = (val) => {
      return height - padBottom - (val / niceMax) * innerH;
    };

    // Build data points
    const pointsA = timeline.map((d, i) => ({
      x: getX(i),
      y: getY(d.variantA || 0),
      val: d.variantA || 0,
      date: d.date,
      otherVal: d.variantB || 0,
      total: d.total || 0,
    }));

    const pointsB = timeline.map((d, i) => ({
      x: getX(i),
      y: getY(d.variantB || 0),
      val: d.variantB || 0,
      date: d.date,
      otherVal: d.variantA || 0,
      total: d.total || 0,
    }));

    // Build SVG Path strings
    const buildPath = (pts) => {
      return pts.reduce(
        (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
        ""
      );
    };

    const pathA = buildPath(pointsA);
    const pathB = buildPath(pointsB);

    // Dynamic X-axis label interval
    const labelInterval = numPoints > 20 ? 4 : numPoints > 10 ? 2 : 1;

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      yTicks,
      niceMax,
      pointsA,
      pointsB,
      pathA,
      pathB,
      timeline,
      labelInterval,
      getX,
      getY,
    };
  }, [analyticsData]);

  // ===========================================================================
  // RENDER: Detailed Analytics View
  // ===========================================================================
  if (selectedExperimentId) {
    const exp = selectedExperiment || experiments.find((e) => e._id === selectedExperimentId);
    const summary = analyticsData?.summary || {
      totalClicks: 0,
      variantAClicks: 0,
      variantBClicks: 0,
      variantAPercentage: 50,
      variantBPercentage: 50,
      winningVariant: "NONE",
      winningReason: "No clicks recorded yet.",
      disclaimer:
        "The winner is determined strictly by total recorded clicks. Conversion rate tracking is not enabled in this version.",
    };

    return (
      <div className="ab-testing-container">
        {/* Toast Alert */}
        {successToast && (
          <div className="ab-toast-banner">
            <Check size={14} style={{ marginRight: "6px" }} /> {successToast}
          </div>
        )}

        {/* Back & Title Header */}
        <div className="ab-header-row">
          <div className="ab-header-left">
            <SpecularButton
              variant="ghost"
              size="sm"
              className="ab-btn-back"
              onClick={() => setSelectedExperimentId(null)}
            >
              ← Back to All Experiments
            </SpecularButton>
            <div className="ab-title-line">
              <h1 className="ab-title">{exp?.name || "Experiment Details"}</h1>
              {exp && renderStatusBadge(exp.status)}
            </div>
            <div className="ab-subtitle-meta">
              <span>Short Code: <strong>s/{exp?.shortCode}</strong></span>
              <span>•</span>
              <span>Created: {formatISTDate(exp?.createdAt)}</span>
              {exp?.startedAt && (
                <>
                  <span>•</span>
                  <span>Started: {formatISTDate(exp.startedAt)}</span>
                </>
              )}
            </div>
          </div>

          {/* Quick Lifecycle Controls */}
          <div className="ab-header-actions">
            <SpecularButton
              variant="secondary"
              size="sm"
              className="ab-btn-secondary"
              onClick={() => copyShortUrl(exp?.shortCode, exp?._id)}
            >
              {copiedId === exp?._id ? (
                <>
                  <Check size={14} style={{ marginRight: "5px" }} /> Copied!
                </>
              ) : (
                <>
                  <Copy size={14} style={{ marginRight: "5px" }} /> Copy Short Link
                </>
              )}
            </SpecularButton>
            <a
              href={`${apiBaseUrl}/${exp?.shortCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ab-btn-secondary"
            >
              ↗ Test Link
            </a>

            {/* Lifecycle transitions */}
            {exp?.status === "draft" && (
              <SpecularButton
                variant="success"
                size="sm"
                className="ab-btn-primary success"
                disabled={actionLoading}
                onClick={() => handleUpdateStatus(exp._id, "active")}
              >
                ▶ Start Experiment
              </SpecularButton>
            )}

            {exp?.status === "active" && (
              <>
                <SpecularButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="ab-btn-secondary warning"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus(exp._id, "paused")}
                >
                  ⏸ Pause
                </SpecularButton>
                <SpecularButton
                  type="button"
                  variant="danger"
                  size="sm"
                  className="ab-btn-secondary danger"
                  disabled={actionLoading}
                  onClick={() => {
                    if (window.confirm("Complete this experiment? Traffic will permanently route to the fallback variant.")) {
                      handleUpdateStatus(exp._id, "completed");
                    }
                  }}
                >
                  ⏹ Complete
                </SpecularButton>
              </>
            )}

            {exp?.status === "paused" && (
              <>
                <SpecularButton
                  type="button"
                  variant="success"
                  size="sm"
                  className="ab-btn-primary success"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus(exp._id, "active")}
                >
                  ▶ Resume
                </SpecularButton>
                <SpecularButton
                  type="button"
                  variant="danger"
                  size="sm"
                  className="ab-btn-secondary danger"
                  disabled={actionLoading}
                  onClick={() => {
                    if (window.confirm("Complete this experiment? Traffic will permanently route to the fallback variant.")) {
                      handleUpdateStatus(exp._id, "completed");
                    }
                  }}
                >
                  ⏹ Complete
                </SpecularButton>
              </>
            )}

            {exp?.status === "completed" && (
              <SpecularButton
                type="button"
                variant="secondary"
                size="sm"
                className="ab-btn-secondary"
                disabled={actionLoading}
                onClick={() => handleUpdateStatus(exp._id, "active")}
              >
                ↺ Re-open Experiment
              </SpecularButton>
            )}
          </div>
        </div>

        {/* Fallback Variant & Date Range Control Row */}
        <div className="ab-controls-bar">
          <div className="ab-fallback-selector">
            <span className="ab-control-label">Fallback Routing:</span>
            <label className={`ab-fallback-chip ${exp?.fallbackVariant === "A" ? "selected" : ""}`}>
              <input
                type="radio"
                name="fallbackVariant"
                value="A"
                checked={exp?.fallbackVariant === "A" || !exp?.fallbackVariant}
                onChange={() => handleUpdateFallback(exp._id, "A")}
              />
              Variant A
            </label>
            <label className={`ab-fallback-chip ${exp?.fallbackVariant === "B" ? "selected" : ""}`}>
              <input
                type="radio"
                name="fallbackVariant"
                value="B"
                checked={exp?.fallbackVariant === "B"}
                onChange={() => handleUpdateFallback(exp._id, "B")}
              />
              Variant B
            </label>
            <span className="ab-fallback-hint">
              (Traffic routes here when experiment is paused or completed)
            </span>
          </div>

          <div className="ab-range-controls">
            <div className="traffic-filter-pills">
              <button
                type="button"
                className={`traffic-pill-btn ${range === "7d" ? "active" : ""}`}
                onClick={() => setRange("7d")}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`traffic-pill-btn ${range === "30d" ? "active" : ""}`}
                onClick={() => setRange("30d")}
              >
                30 Days
              </button>
              <button
                type="button"
                className={`traffic-pill-btn ${range === "all" ? "active" : ""}`}
                onClick={() => setRange("all")}
              >
                All Time
              </button>
            </div>
            <SpecularButton
              variant="secondary"
              size="sm"
              className="ab-btn-refresh"
              onClick={() => fetchAnalytics(exp._id, range)}
              disabled={loadingAnalytics}
              title="Refresh Analytics"
            >
              <RefreshCw size={13} style={{ marginRight: "5px" }} /> Refresh
            </SpecularButton>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="ab-kpi-grid">
          {/* Card 1: Total Clicks */}
          <div className="ab-kpi-card">
            <div className="ab-kpi-header">
              <span className="ab-kpi-title">Total Period Clicks</span>
              <span className="ab-kpi-icon total"><TrendingUp size={16} /></span>
            </div>
            <div className="ab-kpi-value">{summary.totalClicks.toLocaleString()}</div>
            <div className="ab-kpi-subtitle">
              Cumulative clicks across both variants
            </div>
          </div>

          {/* Card 2: Variant A Clicks */}
          <div className="ab-kpi-card variant-a">
            <div className="ab-kpi-header">
              <span className="ab-kpi-title">Variant A Clicks</span>
              <span className="ab-badge-pill pill-a">
                {summary.variantAPercentage}%
              </span>
            </div>
            <div className="ab-kpi-value text-purple">
              {summary.variantAClicks.toLocaleString()}
            </div>
            <div className="ab-kpi-subtitle">
              Destination A recorded traffic share
            </div>
          </div>

          {/* Card 3: Variant B Clicks */}
          <div className="ab-kpi-card variant-b">
            <div className="ab-kpi-header">
              <span className="ab-kpi-title">Variant B Clicks</span>
              <span className="ab-badge-pill pill-b">
                {summary.variantBPercentage}%
              </span>
            </div>
            <div className="ab-kpi-value text-cyan">
              {summary.variantBClicks.toLocaleString()}
            </div>
            <div className="ab-kpi-subtitle">
              Destination B recorded traffic share
            </div>
          </div>

          {/* Card 4: Winning / Leading Variant */}
          <div className="ab-kpi-card winner">
            <div className="ab-kpi-header">
              <span className="ab-kpi-title">Winning Status</span>
              <span className="ab-kpi-icon trophy"><Trophy size={16} /></span>
            </div>
            <div className="ab-kpi-winner-status">
              {summary.winningVariant === "A" && (
                <span className="ab-winner-tag tag-a">Variant A Leading</span>
              )}
              {summary.winningVariant === "B" && (
                <span className="ab-winner-tag tag-b">Variant B Leading</span>
              )}
              {summary.winningVariant === "TIE" && (
                <span className="ab-winner-tag tag-tie">Equal Tie (50/50)</span>
              )}
              {summary.winningVariant === "NONE" && (
                <span className="ab-winner-tag tag-none">No Winner Yet</span>
              )}
            </div>
            <div className="ab-kpi-subtitle">{summary.winningReason}</div>
          </div>
        </div>

        {/* Traffic Allocation & Split Progress Bar */}
        <div className="ab-section-card">
          <div className="ab-section-header">
            <div>
              <h2 className="ab-section-title">Traffic Distribution Split</h2>
              <p className="ab-section-sub">
                Initial allocation probability is 50/50 via signed browser session cookies.
              </p>
            </div>
            <div className="ab-split-legend">
              <span className="legend-item">
                <span className="legend-box color-a" /> Variant A ({summary.variantAPercentage}%)
              </span>
              <span className="legend-item">
                <span className="legend-box color-b" /> Variant B ({summary.variantBPercentage}%)
              </span>
            </div>
          </div>

          <div className="ab-split-bar-track">
            <div
              className="ab-split-bar-segment segment-a"
              style={{ width: `${summary.variantAPercentage}%` }}
              title={`Variant A: ${summary.variantAPercentage}% (${summary.variantAClicks} clicks)`}
            >
              {summary.variantAPercentage > 12 && `${summary.variantAPercentage}%`}
            </div>
            <div
              className="ab-split-bar-segment segment-b"
              style={{ width: `${summary.variantBPercentage}%` }}
              title={`Variant B: ${summary.variantBPercentage}% (${summary.variantBClicks} clicks)`}
            >
              {summary.variantBPercentage > 12 && `${summary.variantBPercentage}%`}
            </div>
          </div>
        </div>

        {/* Daily Comparison Trend Line Chart */}
        <div className="ab-section-card">
          <div className="ab-section-header">
            <div>
              <h2 className="ab-section-title">Daily Variant Performance Trend</h2>
              <p className="ab-section-sub">
                Daily recorded clicks per variant in Indian Standard Time (IST).
              </p>
            </div>
            <div className="ab-split-legend">
              <span className="legend-item">
                <span className="legend-line color-a" /> Variant A
              </span>
              <span className="legend-item">
                <span className="legend-line color-b" /> Variant B
              </span>
            </div>
          </div>

          {loadingAnalytics ? (
            <div className="ab-loading-state">
              <div className="spinner" />
              <span>Loading trend metrics…</span>
            </div>
          ) : chartConfig ? (
            <div className="ab-chart-wrapper">
              <svg
                viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
                preserveAspectRatio="none"
                className="ab-chart-svg"
              >
                <defs>
                  <linearGradient id="gradVariantA" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#C084FC" />
                  </linearGradient>
                  <linearGradient id="gradVariantB" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#22D3EE" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Horizontal Gridlines & Values */}
                {chartConfig.yTicks.map((val) => {
                  const y = chartConfig.getY(val);
                  return (
                    <g key={val}>
                      <line
                        x1={chartConfig.padLeft}
                        y1={y}
                        x2={chartConfig.width - chartConfig.padRight}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartConfig.padLeft - 10}
                        y={y + 3.5}
                        textAnchor="end"
                        fill="var(--text-muted)"
                        fontSize="10.5px"
                        fontFamily="inherit"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Variant A Line */}
                {chartConfig.pathA && (
                  <path
                    d={chartConfig.pathA}
                    fill="none"
                    stroke="url(#gradVariantA)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Variant B Line */}
                {chartConfig.pathB && (
                  <path
                    d={chartConfig.pathB}
                    fill="none"
                    stroke="url(#gradVariantB)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Points */}
                {chartConfig.pointsA.map((p, i) => {
                  const pB = chartConfig.pointsB[i];
                  const isHovered = hoveredPoint?.date === p.date;
                  return (
                    <g key={p.date}>
                      {/* Vertical indicator line on hover */}
                      {isHovered && (
                        <line
                          x1={p.x}
                          y1={chartConfig.padTop}
                          x2={p.x}
                          y2={chartConfig.height - chartConfig.padBottom}
                          stroke="rgba(255, 255, 255, 0.25)"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Dot for Variant A */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 5.5 : 3.5}
                        fill="#A855F7"
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2 : 1}
                        style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                        onMouseEnter={() =>
                          setHoveredPoint({
                            date: p.date,
                            x: p.x,
                            y: (p.y + pB.y) / 2,
                            valA: p.val,
                            valB: pB.val,
                            total: p.total,
                          })
                        }
                        onMouseLeave={() => setHoveredPoint(null)}
                      />

                      {/* Dot for Variant B */}
                      <circle
                        cx={pB.x}
                        cy={pB.y}
                        r={isHovered ? 5.5 : 3.5}
                        fill="#06B6D4"
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2 : 1}
                        style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                        onMouseEnter={() =>
                          setHoveredPoint({
                            date: p.date,
                            x: p.x,
                            y: (p.y + pB.y) / 2,
                            valA: p.val,
                            valB: pB.val,
                            total: p.total,
                          })
                        }
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  );
                })}

                {/* X-Axis Date Labels */}
                {chartConfig.pointsA.map((p, i) => {
                  if (
                    i % chartConfig.labelInterval !== 0 &&
                    i !== chartConfig.pointsA.length - 1
                  ) {
                    return null;
                  }
                  return (
                    <text
                      key={p.date}
                      x={p.x}
                      y={chartConfig.height - 10}
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize="10.5px"
                      fontFamily="inherit"
                    >
                      {formatChartDate(p.date)}
                    </text>
                  );
                })}
              </svg>

              {/* Floating Hover Tooltip */}
              {hoveredPoint && (
                <div
                  className="ab-chart-tooltip"
                  style={{
                    left: `${(hoveredPoint.x / chartConfig.width) * 100}%`,
                    top: `${(hoveredPoint.y / chartConfig.height) * 100}%`,
                    transform: "translate(-50%, -125%)",
                  }}
                >
                  <div className="tooltip-date">{formatChartDate(hoveredPoint.date)}</div>
                  <div className="tooltip-row">
                    <span className="dot dot-a" />
                    <span>Variant A: <strong>{hoveredPoint.valA}</strong> clicks</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="dot dot-b" />
                    <span>Variant B: <strong>{hoveredPoint.valB}</strong> clicks</span>
                  </div>
                  <div className="tooltip-footer">
                    Total: {hoveredPoint.total} clicks
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="ab-empty-state">
              <p>No click history recorded yet in the selected date range.</p>
            </div>
          )}
        </div>

        {/* Destination URLs & Routing Details Grid */}
        <div className="ab-variants-grid">
          {/* Variant A Card */}
          <div className="ab-variant-card card-a">
            <div className="ab-card-header">
              <div className="ab-card-title-group">
                <span className="variant-tag tag-a">Variant A</span>
                <span className="variant-share">{summary.variantAPercentage}% Traffic</span>
              </div>
              {exp?.fallbackVariant === "A" && (
                <span className="fallback-badge"><Star size={11} fill="currentColor" style={{ marginRight: "4px" }} /> Configured Fallback</span>
              )}
            </div>
            <div className="variant-url-box">
              <a
                href={exp?.variantA}
                target="_blank"
                rel="noopener noreferrer"
                className="variant-url-link"
                title={exp?.variantA}
              >
                {truncateUrl(exp?.variantA, 60)} ↗
              </a>
            </div>
            <div className="variant-footer-stats">
              <span>Recorded clicks: <strong>{summary.variantAClicks.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Variant B Card */}
          <div className="ab-variant-card card-b">
            <div className="ab-card-header">
              <div className="ab-card-title-group">
                <span className="variant-tag tag-b">Variant B</span>
                <span className="variant-share">{summary.variantBPercentage}% Traffic</span>
              </div>
              {exp?.fallbackVariant === "B" && (
                <span className="fallback-badge"><Star size={11} fill="currentColor" style={{ marginRight: "4px" }} /> Configured Fallback</span>
              )}
            </div>
            <div className="variant-url-box">
              <a
                href={exp?.variantB}
                target="_blank"
                rel="noopener noreferrer"
                className="variant-url-link"
                title={exp?.variantB}
              >
                {truncateUrl(exp?.variantB, 60)} ↗
              </a>
            </div>
            <div className="variant-footer-stats">
              <span>Recorded clicks: <strong>{summary.variantBClicks.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        {/* Statistical Winner Disclaimer */}
        <div className="ab-disclaimer-box">
          <div className="disclaimer-icon"><AlertTriangle size={15} style={{ color: "var(--accent)" }} /></div>
          <div className="disclaimer-content">
            <strong>Statistical Measurement Disclaimer:</strong>
            <p>{summary.disclaimer}</p>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: Experiments List View
  // ===========================================================================
  return (
    <div className="ab-testing-container">
      {/* Toast Alert */}
      {successToast && (
        <div className="ab-toast-banner">
          <Check size={14} style={{ marginRight: "6px" }} /> {successToast}
        </div>
      )}

      {/* Page Title & Main Header */}
      <div className="ab-header-row">
        <div>
          <h1 className="ab-title">Smart A/B Link Testing</h1>
          <p className="ab-subtitle">
            Split visitor traffic evenly across two destination URLs to evaluate which variant drives more recorded clicks.
          </p>
        </div>
        <div className="ab-header-actions">
          <SpecularButton
            type="button"
            variant="primary"
            size="md"
            className="ab-btn-primary"
            onClick={handleOpenModal}
          >
            {hasDraft ? (
              <>
                <FileEdit size={14} style={{ marginRight: "6px" }} /> Resume Draft Experiment
              </>
            ) : (
              <>
                <Plus size={14} style={{ marginRight: "6px" }} /> New Experiment
              </>
            )}
          </SpecularButton>
          <SpecularButton
            type="button"
            variant="secondary"
            size="md"
            className="ab-btn-refresh"
            onClick={fetchExperiments}
            disabled={loadingList}
            title="Refresh List"
          >
            <RefreshCw size={13} style={{ marginRight: "6px" }} /> Refresh
          </SpecularButton>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="ab-filter-bar">
        <div className="ab-search-input-wrapper">
          <span className="search-icon"><Search size={14} /></span>
          <input
            type="text"
            className="ab-search-input"
            placeholder="Search experiments by name, short link, or destination URL…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearchQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="traffic-filter-pills">
          <button
            type="button"
            className={`traffic-pill-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All ({experiments.length})
          </button>
          <button
            type="button"
            className={`traffic-pill-btn ${statusFilter === "active" ? "active" : ""}`}
            onClick={() => setStatusFilter("active")}
          >
            Active
          </button>
          <button
            type="button"
            className={`traffic-pill-btn ${statusFilter === "draft" ? "active" : ""}`}
            onClick={() => setStatusFilter("draft")}
          >
            Draft
          </button>
          <button
            type="button"
            className={`traffic-pill-btn ${statusFilter === "paused" ? "active" : ""}`}
            onClick={() => setStatusFilter("paused")}
          >
            Paused
          </button>
          <button
            type="button"
            className={`traffic-pill-btn ${statusFilter === "completed" ? "active" : ""}`}
            onClick={() => setStatusFilter("completed")}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Experiments List / Grid */}
      {loadingList ? (
        <div className="ab-loading-state">
          <div className="spinner" />
          <span>Loading experiments…</span>
        </div>
      ) : errorMsg ? (
        <div className="ab-error-banner">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={14} /> {errorMsg}
          </span>
          <SpecularButton variant="danger" size="xs" onClick={fetchExperiments}>Try Again</SpecularButton>
        </div>
      ) : filteredExperiments.length === 0 ? (
        <div className="ab-empty-state-card">
          <div className="empty-icon"><GitFork size={36} style={{ color: "var(--accent)" }} /></div>
          <h3>No A/B Experiments Found</h3>
          <p>
            {experiments.length === 0
              ? "You haven't created any A/B experiments yet. Launch your first 50/50 split test now!"
              : "No experiments matched your search filter."}
          </p>
          {experiments.length === 0 && (
            <SpecularButton
              type="button"
              variant="primary"
              size="md"
              className="ab-btn-primary"
              onClick={handleOpenModal}
            >
              {hasDraft ? (
                <>
                  <FileEdit size={14} style={{ marginRight: "6px" }} /> Resume Draft Experiment
                </>
              ) : (
                <>
                  <Plus size={14} style={{ marginRight: "6px" }} /> Create Your First Experiment
                </>
              )}
            </SpecularButton>
          )}
        </div>
      ) : (
        <div className="ab-experiments-grid">
          {filteredExperiments.map((exp) => {
            const shortUrl = `${apiBaseUrl}/${exp.shortCode}`;
            const isAWinning = exp.winningVariant === "A";
            const isBWinning = exp.winningVariant === "B";
            const isTie = exp.winningVariant === "TIE";

            return (
              <div key={exp._id} className="ab-experiment-card">
                {/* Card Top: Title & Status */}
                <div className="exp-card-header">
                  <div className="exp-card-title-group">
                    <h3 className="exp-card-title" title={exp.name}>
                      {exp.name}
                    </h3>
                    <div className="exp-card-date">
                      Created: {formatISTDate(exp.createdAt)}
                    </div>
                  </div>
                  {renderStatusBadge(exp.status)}
                </div>

                {/* Short Link Bar */}
                <div className="exp-short-bar">
                  <span className="short-label">Short Link:</span>
                  <span className="short-code-pill">s/{exp.shortCode}</span>
                  <SpecularButton
                    variant={copiedId === exp._id ? "success" : "secondary"}
                    size="xs"
                    className="copy-btn"
                    onClick={() => copyShortUrl(exp.shortCode, exp._id)}
                    title="Copy full short URL"
                  >
                    {copiedId === exp._id ? (
                      <>
                        <Check size={12} style={{ marginRight: "3px" }} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} style={{ marginRight: "3px" }} /> Copy
                      </>
                    )}
                  </SpecularButton>
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="open-btn"
                    title="Open short link"
                  >
                    ↗
                  </a>
                </div>

                {/* Destinations preview */}
                <div className="exp-destinations-list">
                  <div className="destination-row">
                    <span className="variant-chip chip-a">A</span>
                    <span className="dest-url" title={exp.variantA}>
                      {truncateUrl(exp.variantA, 38)}
                    </span>
                    <span className="dest-clicks text-purple">
                      {exp.variantAClicks || 0} clicks
                    </span>
                  </div>
                  <div className="destination-row">
                    <span className="variant-chip chip-b">B</span>
                    <span className="dest-url" title={exp.variantB}>
                      {truncateUrl(exp.variantB, 38)}
                    </span>
                    <span className="dest-clicks text-cyan">
                      {exp.variantBClicks || 0} clicks
                    </span>
                  </div>
                </div>

                {/* Total clicks & Winner Tag */}
                <div className="exp-summary-row">
                  <div className="summary-clicks">
                    <span className="summary-num">{(exp.totalClicks || 0).toLocaleString()}</span>
                    <span className="summary-label">Total Clicks</span>
                  </div>
                  <div className="summary-winner">
                    {isAWinning && (
                      <span className="winner-pill tag-a">Variant A Leading</span>
                    )}
                    {isBWinning && (
                      <span className="winner-pill tag-b">Variant B Leading</span>
                    )}
                    {isTie && (
                      <span className="winner-pill tag-tie">Tie</span>
                    )}
                    {!isAWinning && !isBWinning && !isTie && (
                      <span className="winner-pill tag-none">No clicks yet</span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="exp-card-actions">
                  <SpecularButton
                    variant="primary"
                    size="md"
                    className="ab-btn-primary full-width"
                    onClick={() => setSelectedExperimentId(exp._id)}
                  >
                    <BarChart3 size={14} style={{ marginRight: "6px" }} /> View Analytics & Controls
                  </SpecularButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =======================================================================
          Create Experiment Modal Popup
      ======================================================================== */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-panel ab-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="ab-modal-title-group">
                <h3>Create New A/B Experiment</h3>
                {hasDraft && (
                  <span className="ab-draft-pill" title="Incomplete form draft is saved and preserved across navigation">
                    Draft Restored
                  </span>
                )}
              </div>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseModal}
              >
                <X size={16} />
              </button>
            </div>

            {/* CHANGE: Stage 13 Vertically scrollable modal body with sticky header/footer — 2026-11-18 */}
            <form onSubmit={handleCreateSubmit} className="ab-form">
              <div className="modal-body ab-modal-body">
                {createError && (
                  <div className="ab-form-error">
                    <AlertTriangle size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                    {createError}
                  </div>
                )}

                {/* Experiment Name */}
                <div className="form-group">
                  <label className="form-label">
                    Experiment Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Black Friday Hero Banner Test"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    maxLength={100}
                    required
                  />
                </div>

                {/* Destination Variant A */}
                <div className="form-group">
                  <label className="form-label">
                    Variant A Destination URL <span className="req">*</span>
                  </label>
                  <div className="ab-url-input-row">
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://example.com/landing-page-a"
                      value={createForm.variantA}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, variantA: e.target.value })
                      }
                      required
                    />
                    {/* CHANGE: Stage 13 Select from My Links Button for Variant A — 2026-11-18 */}
                    <SpecularButton
                      variant="secondary"
                      size="xs"
                      className="ab-btn-select-link"
                      onClick={() => {
                        setLinkPickerTarget("A");
                        if (availableLinks.length === 0) fetchUserLinks();
                      }}
                      title="Select URL from your existing links"
                    >
                      <Link2 size={13} style={{ marginRight: "4px" }} /> Select from My Links
                    </SpecularButton>
                  </div>
                  <span className="form-hint">
                    Baseline original page or control landing destination.
                  </span>
                </div>

                {/* Destination Variant B */}
                <div className="form-group">
                  <label className="form-label">
                    Variant B Destination URL <span className="req">*</span>
                  </label>
                  <div className="ab-url-input-row">
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://example.com/landing-page-b"
                      value={createForm.variantB}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, variantB: e.target.value })
                      }
                      required
                    />
                    {/* CHANGE: Stage 13 Select from My Links Button for Variant B — 2026-11-18 */}
                    <SpecularButton
                      variant="secondary"
                      size="xs"
                      className="ab-btn-select-link"
                      onClick={() => {
                        setLinkPickerTarget("B");
                        if (availableLinks.length === 0) fetchUserLinks();
                      }}
                      title="Select URL from your existing links"
                    >
                      <Link2 size={13} style={{ marginRight: "4px" }} /> Select from My Links
                    </SpecularButton>
                  </div>
                  <span className="form-hint">
                    Challenger or alternative landing destination.
                  </span>
                </div>

                {/* Traffic Split Display (Fixed 50/50) */}
                <div className="form-group">
                  <label className="form-label">Traffic Allocation</label>
                  <div className="ab-preview-split-box">
                    <div className="preview-split-bar">
                      <div className="preview-split-part part-a">50% Variant A</div>
                      <div className="preview-split-part part-b">50% Variant B</div>
                    </div>
                    <span className="form-hint">
                      Equal 50/50 allocation enforced with signed HTTP cookies valid for 30 days.
                    </span>
                  </div>
                </div>

                {/* Initial Lifecycle Status */}
                <div className="form-group">
                  <label className="form-label">Initial Status</label>
                  <div className="ab-radio-group">
                    <label className={`ab-radio-card ${createForm.status === "active" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="initialStatus"
                        value="active"
                        checked={createForm.status === "active"}
                        onChange={() => setCreateForm({ ...createForm, status: "active" })}
                      />
                      <div>
                        <strong>Active (Recommended)</strong>
                        <p>Start splitting traffic immediately on short link creation.</p>
                      </div>
                    </label>
                    <label className={`ab-radio-card ${createForm.status === "draft" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="initialStatus"
                        value="draft"
                        checked={createForm.status === "draft"}
                        onChange={() => setCreateForm({ ...createForm, status: "draft" })}
                      />
                      <div>
                        <strong>Draft</strong>
                        <p>Do not route public traffic until you manually start the experiment.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Fallback Variant */}
                <div className="form-group">
                  <label className="form-label">Fallback Destination</label>
                  <select
                    className="form-input"
                    value={createForm.fallbackVariant}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, fallbackVariant: e.target.value })
                    }
                  >
                    <option value="A">Variant A (Default)</option>
                    <option value="B">Variant B</option>
                  </select>
                  <span className="form-hint">
                    Destination to receive 100% of traffic if the experiment is paused or completed.
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="modal-actions ab-modal-footer">
                <div className="modal-actions-left">
                  {hasDraft && (
                    <SpecularButton
                      variant="ghost"
                      size="sm"
                      className="ab-btn-reset-draft"
                      onClick={handleResetDraft}
                      disabled={creating}
                      title="Discard current draft values and reset form"
                    >
                      Reset Form
                    </SpecularButton>
                  )}
                </div>
                <div className="modal-actions-right">
                  <SpecularButton
                    type="button"
                    variant="ghost"
                    size="md"
                    className="ab-btn-secondary"
                    onClick={handleCloseModal}
                    disabled={creating}
                  >
                    Cancel
                  </SpecularButton>
                  <SpecularButton
                    type="submit"
                    variant="primary"
                    size="md"
                    className="ab-btn-primary"
                    disabled={creating}
                    loading={creating}
                    loadingText="Creating…"
                  >
                    Create & Deploy Experiment
                  </SpecularButton>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* =======================================================================
          CHANGE: Stage 13 Link Picker Modal — 2026-11-18
          Modal displaying existing links to select original destination URL
      ======================================================================== */}
      {linkPickerTarget && (
        <div
          className="modal-backdrop ab-picker-backdrop"
          onClick={() => {
            setLinkPickerTarget(null);
            setLinkSearchTerm("");
          }}
        >
          <div
            className="modal-panel ab-picker-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="ab-modal-title-group">
                <h3>Select from My Links</h3>
                <span className={`ab-picker-variant-badge badge-${linkPickerTarget.toLowerCase()}`}>
                  For Variant {linkPickerTarget}
                </span>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => {
                  setLinkPickerTarget(null);
                  setLinkSearchTerm("");
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="ab-picker-search-bar">
              <span className="search-icon"><Search size={14} /></span>
              <input
                type="text"
                className="ab-picker-search-input"
                placeholder="Search by link name, short code, or URL…"
                value={linkSearchTerm}
                onChange={(e) => setLinkSearchTerm(e.target.value)}
                autoFocus
              />
              {linkSearchTerm && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setLinkSearchTerm("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="ab-picker-links-list">
              {loadingLinks ? (
                <div className="ab-picker-loading">
                  <div className="spinner" />
                  <span>Loading your links…</span>
                </div>
              ) : filteredLinks.length === 0 ? (
                <div className="ab-picker-empty">
                  <p>
                    {availableLinks.length === 0
                      ? "No existing links found. You can enter destination URLs directly in the form."
                      : `No links match "${linkSearchTerm}".`}
                  </p>
                </div>
              ) : (
                filteredLinks.map((link) => {
                  const displayName =
                    link.name ||
                    link.title ||
                    link.utmCampaign ||
                    `Link /${link.shortCode}`;
                  const shortUrl = `${apiBaseUrl}/${link.shortCode}`;

                  return (
                    <div
                      key={link._id || link.shortCode}
                      className="ab-picker-link-card"
                    >
                      <div className="ab-picker-link-info">
                        <div className="ab-picker-link-top">
                          <strong className="ab-picker-link-name">
                            {displayName}
                          </strong>
                          <span className="ab-picker-short-pill">
                            s/{link.shortCode}
                          </span>
                          <span className="ab-picker-clicks-pill">
                            {(link.clicks || 0).toLocaleString()} clicks
                          </span>
                        </div>
                        <div className="ab-picker-link-row">
                          <span className="ab-picker-meta-label">Short URL:</span>
                          <span className="ab-picker-short-url">{shortUrl}</span>
                        </div>
                        <div className="ab-picker-link-row">
                          <span className="ab-picker-meta-label">Destination URL:</span>
                          <span
                            className="ab-picker-dest-url"
                            title={link.originalUrl}
                          >
                            {link.originalUrl}
                          </span>
                        </div>
                      </div>

                      <div className="ab-picker-link-action">
                        <SpecularButton
                          variant="primary"
                          size="xs"
                          className="ab-btn-use-url"
                          onClick={() => handleSelectLinkUrl(link.originalUrl)}
                        >
                          Use This URL
                        </SpecularButton>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="modal-actions ab-picker-footer">
              <span className="ab-picker-count">
                Showing {filteredLinks.length} of {availableLinks.length} links
              </span>
              <SpecularButton
                variant="secondary"
                size="sm"
                className="ab-btn-secondary"
                onClick={() => {
                  setLinkPickerTarget(null);
                  setLinkSearchTerm("");
                }}
              >
                Close
              </SpecularButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
