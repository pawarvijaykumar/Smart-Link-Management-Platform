// =============================================================================
// Component: GeoAnalyticsView
// Professional Geo-Location Analytics Dashboard with Interactive 3D Earth Globe,
// 2D World Pin Map, Pause/Resume, IST Refresh Sync, SpotlightCards & SpecularButtons.
// =============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from "react";
import {
  Globe,
  MapPin,
  Building2,
  QrCode,
  Radio,
  RefreshCw,
  Pause,
  Play,
  X,
  Search,
  Info,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import SpotlightCard from "./SpotlightCard.jsx";
import SpecularButton from "./SpecularButton.jsx";
import TimeRangeToggle from "./ui/TimeRangeToggle.jsx";
import GeoPinMap2D from "./GeoPinMap2D.jsx";
import { getCountryFlagEmoji } from "../data/geoLookup.js";
import "./GeoAnalytics.css";

// Lazy-load 3D Earth Globe to prevent WebGL overhead when viewing 2D map
const GeoGlobe3D = lazy(() => import("./GeoGlobe3D.jsx"));

// Formats timestamp in Indian Standard Time (IST - Asia/Kolkata)
function formatIST(date) {
  if (!date) return "";
  try {
    const formatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);
    return `${formatted} IST`;
  } catch (_) {
    return `${date.toLocaleTimeString()} IST`;
  }
}

export default function GeoAnalyticsView({
  geoAnalytics,
  geoLoading,
  geoError,
  geoRange = "all",
  onRangeChange,
  onRefresh,
}) {
  const summary = geoAnalytics?.summary;
  const topCountries = geoAnalytics?.topCountries || [];
  const topCities = geoAnalytics?.topCities || [];
  const qrVsDirect = geoAnalytics?.qrVsDirectByCountry || [];

  // View Mode: '3d' (Interactive 3D Earth Globe) | '2d' (2D World Pin Map)
  const [viewMode, setViewMode] = useState("3d");

  // Pause / Resume state: Initially Pause (playing)
  const [isPaused, setIsPaused] = useState(false);

  // Last successful synchronized time in IST
  const [lastUpdatedTime, setLastUpdatedTime] = useState(() => formatIST(new Date()));

  // Active selection for drill-down inspection
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  // Table search queries
  const [countrySearch, setCountrySearch] = useState("");
  const [citySearch, setCitySearch] = useState("");

  // Internal refreshing state to prevent simultaneous clicks
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update last refresh timestamp when geoAnalytics successfully arrives
  useEffect(() => {
    if (geoAnalytics && !geoLoading) {
      setLastUpdatedTime(formatIST(new Date()));
      setIsRefreshing(false);
    }
  }, [geoAnalytics, geoLoading]);

  // Handle manual refresh
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing || geoLoading) return;
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, geoLoading, onRefresh]);

  // Handle Pause / Resume toggle
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Automatic refresh interval (polls every 30s when NOT paused)
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      if (!isRefreshing && !geoLoading && onRefresh) {
        onRefresh();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isPaused, isRefreshing, geoLoading, onRefresh]);

  // Row / Marker selections (Stable: no window scrolling or layout jumps)
  const handleSelectCountry = useCallback((countryItem) => {
    setSelectedCountry(countryItem);
    setSelectedCity(null);
  }, []);

  const handleSelectCity = useCallback((cityItem) => {
    setSelectedCity(cityItem);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedCountry(null);
    setSelectedCity(null);
  }, []);

  // Filtered country table items
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return topCountries;
    const q = countrySearch.toLowerCase().trim();
    return topCountries.filter(
      (c) =>
        (c.country && c.country.toLowerCase().includes(q)) ||
        (c.countryCode && c.countryCode.toLowerCase().includes(q))
    );
  }, [topCountries, countrySearch]);

  // Filtered city table items
  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return topCities;
    const q = citySearch.toLowerCase().trim();
    return topCities.filter(
      (c) =>
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.region && c.region.toLowerCase().includes(q)) ||
        (c.country && c.country.toLowerCase().includes(q))
    );
  }, [topCities, citySearch]);

  // Cities belonging to currently selected country
  const selectedCountryCities = useMemo(() => {
    if (!selectedCountry) return [];
    return topCities.filter(
      (c) =>
        (c.countryCode &&
          selectedCountry.countryCode &&
          c.countryCode.toUpperCase() === selectedCountry.countryCode.toUpperCase()) ||
        (c.country &&
          selectedCountry.country &&
          c.country.toLowerCase() === selectedCountry.country.toLowerCase())
    );
  }, [selectedCountry, topCities]);

  // Loading indicator for refresh button
  const refreshingActive = geoLoading || isRefreshing;

  return (
    <div className="geo-dashboard-container">
      {/* 1. Header & Controls Toolbar */}
      <div className="geo-header-row">
        <div className="geo-header-title-block">
          <h1>Geo Analytics</h1>
          <p>
            Track approximate visitor country and city locations, comparing physical QR scans with
            digital visits globally.
          </p>
        </div>

        <div className="geo-toolbar">
          {/* Last Synchronized IST Status Pill */}
          <div className="geo-last-synced-pill" title="Synchronized with MongoDB visitor tracking">
            <span className={`geo-sync-dot ${isPaused ? "paused" : ""}`} />
            <span>Updated {lastUpdatedTime}</span>
          </div>

          {/* Date Range Filters */}
          <TimeRangeToggle
            value={geoRange}
            onChange={(val) => onRangeChange?.(val)}
            disabled={refreshingActive}
            ariaLabel="Geo Analytics timeframe"
          />

          {/* 2D / 3D Visualization Switch */}
          <div className="geo-view-mode-group" role="group" aria-label="Visualization mode">
            <SpecularButton
              size="sm"
              variant={viewMode === "2d" ? "primary" : "ghost"}
              radius={6}
              onClick={() => setViewMode("2d")}
              aria-pressed={viewMode === "2d"}
              style={{
                padding: "5px 11px",
                fontSize: "12px",
                height: "30px",
              }}
            >
              2D Map
            </SpecularButton>
            <SpecularButton
              size="sm"
              variant={viewMode === "3d" ? "primary" : "ghost"}
              radius={6}
              onClick={() => setViewMode("3d")}
              aria-pressed={viewMode === "3d"}
              style={{
                padding: "5px 11px",
                fontSize: "12px",
                height: "30px",
              }}
            >
              3D Globe
            </SpecularButton>
          </div>

          {/* Pause / Resume Control */}
          <SpecularButton
            size="sm"
            variant={isPaused ? "success" : "secondary"}
            radius={8}
            onClick={togglePause}
            title={
              isPaused
                ? "Resume live animations and auto-refresh"
                : "Pause live animations and auto-refresh"
            }
            aria-label={isPaused ? "Resume animations" : "Pause animations"}
            style={{ height: "34px", padding: "0 13px" }}
          >
            {isPaused ? (
              <>
                <Play size={13} style={{ marginRight: "6px" }} />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause size={13} style={{ marginRight: "6px" }} />
                <span>Pause</span>
              </>
            )}
          </SpecularButton>

          {/* Manual Refresh Button */}
          <SpecularButton
            size="sm"
            variant="cyan"
            radius={8}
            onClick={handleManualRefresh}
            disabled={refreshingActive}
            loading={refreshingActive}
            title="Fetch latest geolocation data from backend"
            aria-label="Refresh geolocation analytics"
            style={{ height: "34px", padding: "0 14px" }}
          >
            <RefreshCw
              size={13}
              className={refreshingActive ? "spin-icon" : ""}
              style={{ marginRight: "6px" }}
            />
            <span>{refreshingActive ? "Updating..." : "Refresh"}</span>
          </SpecularButton>
        </div>
      </div>

      {/* Error Notice */}
      {geoError && (
        <div
          className="auth-alert error"
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            padding: "10px 16px",
            borderRadius: "8px",
            color: "#FCA5A5",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{geoError}</span>
          <button
            type="button"
            onClick={handleManualRefresh}
            style={{
              background: "transparent",
              border: "none",
              color: "#38BDF8",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "12px",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Analytics Summary Cards (6 Cards wrapped in SpotlightCard) */}
      <div className="geo-metrics-grid-6">
        {/* Card 1: Total Global Clicks */}
        <SpotlightCard className="geo-stat-card">
          <div className="geo-stat-card-header">
            <span>Global Clicks</span>
            <div className="geo-stat-icon-wrap">
              <Globe size={15} />
            </div>
          </div>
          <div className="geo-stat-value">{summary?.totalClicks ?? 0}</div>
          <div className="geo-stat-helper">
            {summary?.geoIdentifiedClicks ?? 0} located (
            {summary?.geoIdentifiedPercentage ?? 0}%)
          </div>
        </SpotlightCard>

        {/* Card 2: Total Countries */}
        <SpotlightCard className="geo-stat-card">
          <div className="geo-stat-card-header">
            <span>Countries</span>
            <div className="geo-stat-icon-wrap cyan">
              <MapPin size={15} />
            </div>
          </div>
          <div className="geo-stat-value">{summary?.countriesCount ?? 0}</div>
          <div className="geo-stat-helper">
            {summary?.countriesCount === 1 ? "1 country reached" : `${summary?.countriesCount ?? 0} countries reached`}
          </div>
        </SpotlightCard>

        {/* Card 3: Top Country */}
        <SpotlightCard className="geo-stat-card">
          <div className="geo-stat-card-header">
            <span>Top Country</span>
            <div className="geo-stat-icon-wrap emerald">
              <TrendingUp size={15} />
            </div>
          </div>
          <div
            className="geo-stat-value"
            style={{
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span>{getCountryFlagEmoji(topCountries[0]?.countryCode)}</span>
            <span>{topCountries[0]?.country || "None"}</span>
          </div>
          <div className="geo-stat-helper">
            {topCountries[0]
              ? `${topCountries[0].totalClicks} visits (${topCountries[0].percentage}% share)`
              : "No visits recorded"}
          </div>
        </SpotlightCard>

        {/* Card 4: Top City */}
        <SpotlightCard className="geo-stat-card">
          <div className="geo-stat-card-header">
            <span>Top City</span>
            <div className="geo-stat-icon-wrap amber">
              <Building2 size={15} />
            </div>
          </div>
          <div
            className="geo-stat-value"
            style={{
              fontSize: "18px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {topCities[0]?.city || "None"}
          </div>
          <div className="geo-stat-helper">
            {topCities[0]
              ? `${topCities[0].totalClicks} visits (${topCities[0].region || topCities[0].country})`
              : "No cities recorded"}
          </div>
        </SpotlightCard>

        {/* Card 5: QR Traffic */}
        <SpotlightCard className="geo-stat-card">
          <div className="geo-stat-card-header">
            <span>QR Scans</span>
            <div className="geo-stat-icon-wrap purple">
              <QrCode size={15} />
            </div>
          </div>
          <div className="geo-stat-value">{summary?.qrGeoClicks ?? 0}</div>
          <div className="geo-stat-helper">
            {summary?.totalClicks > 0
              ? `${Math.round(((summary?.qrGeoClicks ?? 0) / summary.totalClicks) * 100)}% of total traffic`
              : "0% of total traffic"}
          </div>
        </SpotlightCard>

        {/* Card 6: Direct Traffic */}
        <SpotlightCard className="geo-stat-card">
          <div className="geo-stat-card-header">
            <span>Direct Traffic</span>
            <div className="geo-stat-icon-wrap cyan">
              <Radio size={15} />
            </div>
          </div>
          <div className="geo-stat-value">
            {summary?.directGeoClicks ?? (summary?.totalClicks ?? 0)}
          </div>
          <div className="geo-stat-helper">
            {summary?.totalClicks > 0
              ? `${Math.round(
                  ((summary?.directGeoClicks ?? summary?.totalClicks) / summary.totalClicks) * 100
                )}% of total traffic`
              : "0% of total traffic"}
          </div>
        </SpotlightCard>
      </div>

      {/* 3. Interactive Main Section (3D Earth Globe or 2D World Map) */}
      <div className="geo-map-card">
        <div className="geo-map-card-header">
          <div className="geo-map-heading">
            <h3>
              {viewMode === "3d" ? (
                <Globe size={17} style={{ color: "#06B6D4" }} />
              ) : (
                <MapPin size={17} style={{ color: "#06B6D4" }} />
              )}
              <span>
                {viewMode === "3d"
                  ? "Interactive 3D Earth Globe"
                  : "Interactive 2D World Location Pin Map"}
              </span>
            </h3>
            <p>
              {viewMode === "3d"
                ? "Real-time 3D planetary distribution of visitor clicks and QR scans. Drag to rotate, scroll to zoom, click pins to inspect."
                : "Real-time geographic distribution of visitor clicks and QR scans. Click pins or countries to inspect traffic volume."}
            </p>
          </div>

          <div className="geo-map-status-controls">
            {(selectedCountry || selectedCity) && (
              <div className="geo-selected-badge">
                <span>
                  Filtering:{" "}
                  <strong>{selectedCity ? selectedCity.city : selectedCountry.country}</strong>
                </span>
                <button
                  type="button"
                  className="geo-clear-badge-btn"
                  onClick={handleClearSelection}
                  title="Clear selection"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Viewport: Conditional Rendering to prevent WebGL conflicts */}
        {viewMode === "3d" ? (
          <Suspense
            fallback={
              <div className="geo-loading-placeholder">
                <Globe size={24} style={{ color: "#06B6D4", marginRight: "10px" }} />
                <span>Loading 3D Earth Globe...</span>
              </div>
            }
          >
            <GeoGlobe3D
              topCountries={topCountries}
              topCities={topCities}
              summary={summary}
              isPaused={isPaused}
              selectedCountry={selectedCountry}
              onSelectCountry={handleSelectCountry}
              selectedCity={selectedCity}
              onSelectCity={handleSelectCity}
              onClearSelection={handleClearSelection}
            />
          </Suspense>
        ) : (
          <GeoPinMap2D
            topCountries={topCountries}
            topCities={topCities}
            summary={summary}
            isPaused={isPaused}
            selectedCountry={selectedCountry}
            onSelectCountry={handleSelectCountry}
            selectedCity={selectedCity}
            onSelectCity={handleSelectCity}
            onClearSelection={handleClearSelection}
          />
        )}

        {/* Selected Entity Details Panel (Positioned below the active viewport) */}
        {(selectedCountry || selectedCity) && (
          <div className="geo-details-panel">
            <div className="geo-details-header">
              <div className="geo-details-title">
                {selectedCity ? (
                  <>
                    <Building2 size={18} style={{ color: "#F59E0B" }} />
                    <span>
                      {selectedCity.city},{" "}
                      {selectedCity.region ? `${selectedCity.region}, ` : ""}
                      {selectedCity.country}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "rgba(245, 158, 11, 0.15)",
                        color: "#F59E0B",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                      }}
                    >
                      City Focus
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "18px" }}>
                      {getCountryFlagEmoji(selectedCountry.countryCode)}
                    </span>
                    <span>{selectedCountry.country}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "rgba(6, 182, 212, 0.15)",
                        color: "#38BDF8",
                        border: "1px solid rgba(6, 182, 212, 0.3)",
                      }}
                    >
                      Country Focus
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                className="geo-details-close-btn"
                onClick={handleClearSelection}
              >
                Clear Focus &times;
              </button>
            </div>

            <div className="geo-details-metrics-row">
              <div className="geo-detail-metric-chip">
                <span className="geo-detail-chip-label">Total Visits</span>
                <span className="geo-detail-chip-value">
                  {selectedCity ? selectedCity.totalClicks : selectedCountry.totalClicks}
                </span>
              </div>

              <div className="geo-detail-metric-chip">
                <span className="geo-detail-chip-label">Direct Clicks</span>
                <span className="geo-detail-chip-value">
                  {selectedCity ? selectedCity.directClicks || 0 : selectedCountry.directClicks || 0}
                </span>
              </div>

              <div className="geo-detail-metric-chip">
                <span className="geo-detail-chip-label">QR Scans</span>
                <span className="geo-detail-chip-value">
                  {selectedCity ? selectedCity.qrClicks || 0 : selectedCountry.qrClicks || 0}
                </span>
              </div>

              <div className="geo-detail-metric-chip">
                <span className="geo-detail-chip-label">Traffic Share</span>
                <span className="geo-detail-chip-value" style={{ color: "#38BDF8" }}>
                  {selectedCity ? selectedCity.percentage : selectedCountry.percentage}%
                </span>
              </div>
            </div>

            {/* If country selected, list top cities in this country */}
            {selectedCountry && selectedCountryCities.length > 0 && (
              <div style={{ marginTop: "6px" }}>
                <div
                  style={{
                    fontSize: "11.5px",
                    fontWeight: "600",
                    color: "#8B95A5",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Identified Cities in {selectedCountry.country}:
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {selectedCountryCities.map((c) => (
                    <button
                      key={`city-chip-${c.city}`}
                      type="button"
                      onClick={() => handleSelectCity(c)}
                      style={{
                        background: "#141923",
                        border: "1px solid #252B38",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        color: "#E6EAF0",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{c.city}</span>
                      <strong style={{ color: "#F59E0B" }}>{c.totalClicks}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Map Legend and Disclaimer */}
        <div className="geo-map-legend-bar">
          {viewMode === "3d" ? (
            <div className="geo-legend-tags">
              <div className="geo-legend-tag">
                <span className="geo-legend-dot" style={{ background: "#06B6D4" }} />
                <span>Country Marker (Cyan)</span>
              </div>
              <div className="geo-legend-tag">
                <span className="geo-legend-dot" style={{ background: "#F59E0B" }} />
                <span>City Marker (Amber)</span>
              </div>
              <div className="geo-legend-tag">
                <span className="geo-legend-dot" style={{ background: "#1E2D4A" }} />
                <span>Country Borders</span>
              </div>
              <div className="geo-legend-tag">
                <span className="geo-legend-dot" style={{ background: "#38BDF8" }} />
                <span>Atmospheric Halo</span>
              </div>
            </div>
          ) : (
            <div className="geo-legend-tags">
              <div className="geo-legend-tag">
                <span className="geo-legend-dot" style={{ background: "#06B6D4" }} />
                <span>Country Pin (Cyan)</span>
              </div>
              <div className="geo-legend-tag">
                <span className="geo-legend-dot" style={{ background: "#F59E0B" }} />
                <span>City Pin (Amber)</span>
              </div>
              <div className="geo-legend-tag">
                <span className="geo-legend-dot" style={{ background: "#1A2230" }} />
                <span>Unvisited Territory</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Info size={12.5} style={{ color: "#8B95A5" }} />
            <span>Locations are approximate based on public IP routing.</span>
          </div>
        </div>
      </div>

      {/* 4. Dual Tables: Top Countries & Top Cities */}
      <div className="geo-tables-grid">
        {/* Table 1: Top Countries */}
        <div className="geo-table-card">
          <div className="geo-table-header">
            <h4>Top Countries ({filteredCountries.length})</h4>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="geo-search-input"
                placeholder="Search country..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="geo-data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Country</th>
                  <th>Visits</th>
                  <th>Direct</th>
                  <th>QR</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredCountries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#8B95A5", padding: "24px" }}>
                      No country traffic recorded for this period.
                    </td>
                  </tr>
                ) : (
                  filteredCountries.map((c, idx) => {
                    const isSelected =
                      selectedCountry && selectedCountry.countryCode === c.countryCode;
                    return (
                      <tr
                        key={`country-row-${c.countryCode || idx}`}
                        className={`clickable-row ${isSelected ? "selected-row" : ""}`}
                        onClick={() => handleSelectCountry(c)}
                        title="Click to highlight on map"
                      >
                        <td style={{ color: "#8B95A5", width: "40px" }}>#{idx + 1}</td>
                        <td style={{ fontWeight: "600" }}>
                          <span style={{ marginRight: "6px" }}>
                            {getCountryFlagEmoji(c.countryCode)}
                          </span>
                          <span>{c.country}</span>
                        </td>
                        <td style={{ fontFamily: "monospace", fontWeight: "700" }}>
                          {c.totalClicks}
                        </td>
                        <td style={{ color: "#8B95A5" }}>{c.directClicks || 0}</td>
                        <td style={{ color: "#8B95A5" }}>{c.qrClicks || 0}</td>
                        <td style={{ width: "90px" }}>
                          <div className="geo-share-bar-wrap">
                            <div className="geo-share-bar">
                              <div
                                className="geo-share-bar-fill"
                                style={{ width: `${Math.min(100, c.percentage || 0)}%` }}
                              />
                            </div>
                            <span style={{ fontSize: "11px", color: "#8B95A5" }}>
                              {c.percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Top Cities */}
        <div className="geo-table-card">
          <div className="geo-table-header">
            <h4>Top Cities ({filteredCities.length})</h4>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="geo-search-input"
                placeholder="Search city..."
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="geo-data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>City</th>
                  <th>Region / Country</th>
                  <th>Visits</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredCities.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#8B95A5", padding: "24px" }}>
                      No city traffic recorded for this period.
                    </td>
                  </tr>
                ) : (
                  filteredCities.map((city, idx) => {
                    const isSelected = selectedCity && selectedCity.city === city.city;
                    return (
                      <tr
                        key={`city-row-${city.city}-${idx}`}
                        className={`clickable-row ${isSelected ? "selected-row" : ""}`}
                        onClick={() => handleSelectCity(city)}
                        title="Click to highlight on map"
                      >
                        <td style={{ color: "#8B95A5", width: "40px" }}>#{idx + 1}</td>
                        <td style={{ fontWeight: "600", color: "#F59E0B" }}>{city.city}</td>
                        <td style={{ color: "#8B95A5", fontSize: "12px" }}>
                          {city.region ? `${city.region}, ` : ""}
                          {city.country}
                        </td>
                        <td style={{ fontFamily: "monospace", fontWeight: "700" }}>
                          {city.totalClicks}
                        </td>
                        <td style={{ width: "90px" }}>
                          <div className="geo-share-bar-wrap">
                            <div className="geo-share-bar">
                              <div
                                className="geo-share-bar-fill"
                                style={{
                                  background: "#F59E0B",
                                  width: `${Math.min(100, city.percentage || 0)}%`,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: "11px", color: "#8B95A5" }}>
                              {city.percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
