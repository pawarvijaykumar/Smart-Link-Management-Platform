import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import world50mData from "world-atlas/countries-50m.json";
import usData from "us-atlas/states-10m.json";
import {
  NUMERIC_TO_ISO2,
  COUNTRY_NAME_TO_ISO2,
  US_STATES,
  getStateDisplayName,
  getCountryFlagEmoji,
} from "../data/geoLookup.js";
import { Globe, Building2, Plus, Minus, RotateCcw, ArrowLeft, Info } from "lucide-react";

// -----------------------------------------------------------------------------
// Component: GeoMap2D
// High-resolution 2D World Map (Natural Earth) with Pan/Zoom & Drill-down
// -----------------------------------------------------------------------------
export default function GeoMap2D({
  topCountries = [],
  regions = [],
  topCities = [],
  summary = null,
  selectedCountryProp = null,
  onCountrySelect = null,
  selectedCityProp = null,
}) {
  // Navigation / Drill-down state: 'world' | 'country' | 'state' | 'city'
  const [drillLevel, setDrillLevel] = useState("world");
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  // SVG and Zoom refs
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const containerRef = useRef(null);

  // Hover state
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(1);

  // Extract World Atlas 50m features
  const countriesGeo = useMemo(() => {
    return topojson.feature(world50mData, world50mData.objects.countries);
  }, []);

  // Map of CountryCode / CountryName -> Metrics
  const countryDataMap = useMemo(() => {
    const map = new Map();
    for (const c of topCountries) {
      if (c.countryCode) {
        map.set(c.countryCode.toUpperCase(), c);
      }
      if (c.country) {
        map.set(c.country.toLowerCase(), c);
      }
    }
    return map;
  }, [topCountries]);

  // Max visits across countries for choropleth scale
  const maxCountryClicks = useMemo(() => {
    return topCountries.reduce((max, c) => Math.max(max, c.totalClicks || 0), 1);
  }, [topCountries]);

  // Helper: Find country traffic data by GeoJSON feature
  const getFeatureCountryData = useCallback(
    (feature) => {
      if (!feature) return null;
      const numId = String(feature.id).padStart(3, "0");
      const iso2 = NUMERIC_TO_ISO2[numId];
      if (iso2 && countryDataMap.has(iso2)) {
        return countryDataMap.get(iso2);
      }
      const rawName = feature.properties?.name;
      if (rawName) {
        const normIso = COUNTRY_NAME_TO_ISO2[rawName.toLowerCase()];
        if (normIso && countryDataMap.has(normIso)) {
          return countryDataMap.get(normIso);
        }
        if (countryDataMap.has(rawName.toLowerCase())) {
          return countryDataMap.get(rawName.toLowerCase());
        }
      }
      return null;
    },
    [countryDataMap]
  );

  // Helper: Get ISO2 code for a feature
  const getFeatureCountryCode = useCallback((feature) => {
    if (!feature) return "";
    const numId = String(feature.id).padStart(3, "0");
    const iso2 = NUMERIC_TO_ISO2[numId];
    if (iso2) return iso2;
    const rawName = feature.properties?.name;
    if (rawName && COUNTRY_NAME_TO_ISO2[rawName.toLowerCase()]) {
      return COUNTRY_NAME_TO_ISO2[rawName.toLowerCase()];
    }
    return "";
  }, []);

  // Helper: Determine country fill - mint-green highlight for visited countries
  const getCountryFill = useCallback(
    (data) => {
      if (!data || !data.totalClicks || data.totalClicks <= 0) {
        return "var(--map-land)";
      }
      const ratio = data.totalClicks / maxCountryClicks;
      if (ratio > 0.5) return "#10B981"; // Mint-green / emerald for high traffic
      if (ratio > 0.2) return "#8B5CF6"; // Purple for moderate traffic
      return "#6366F1"; // Indigo for lower traffic
    },
    [maxCountryClicks]
  );

  // 2D Projection and Path Generator (Natural Earth projection - filling card height & width)
  const { pathGenerator, graticulePath } = useMemo(() => {
    const width = 960;
    const height = 480;
    const proj = d3
      .geoNaturalEarth1()
      .scale(175)
      .translate([width / 2, height / 2 + 10]);
    const pathGen = d3.geoPath().projection(proj);
    const grat = d3.geoGraticule().step([20, 20])();
    return { pathGenerator: pathGen, graticulePath: pathGen(grat) };
  }, []);

  // Initialize and attach D3 Zoom & Pan
  useEffect(() => {
    if (!svgRef.current || !gRef.current || drillLevel !== "world") return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setCurrentZoom(event.transform.k);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    return () => {
      svg.on(".zoom", null);
    };
  }, [drillLevel]);

  // Zoom control handlers
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.4);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1 / 1.4);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  // Drill-down navigation handlers
  const handleSelectCountry = useCallback(
    (c) => {
      setSelectedCountry(c);
      setSelectedRegion(null);
      setSelectedCity(null);
      setDrillLevel("country");
      onCountrySelect?.(c);
    },
    [onCountrySelect]
  );

  const handleSelectRegion = useCallback((r) => {
    setSelectedRegion(r);
    setSelectedCity(null);
    setDrillLevel("state");
  }, []);

  const handleSelectCity = useCallback((cityItem) => {
    setSelectedCity(cityItem);
    setDrillLevel("city");
  }, []);

  const handleBackToWorld = useCallback(() => {
    setSelectedCountry(null);
    setSelectedRegion(null);
    setSelectedCity(null);
    setDrillLevel("world");
  }, []);

  const handleBackToCountry = useCallback(() => {
    setSelectedRegion(null);
    setSelectedCity(null);
    setDrillLevel("country");
  }, []);

  const handleBackToState = useCallback(() => {
    setSelectedCity(null);
    setDrillLevel("state");
  }, []);

  // Sync with external selection from parent table if provided
  useEffect(() => {
    if (selectedCountryProp) {
      handleSelectCountry(selectedCountryProp);
    }
  }, [selectedCountryProp, handleSelectCountry]);

  useEffect(() => {
    if (selectedCityProp) {
      const foundCountry = topCountries.find(
        (c) =>
          c.countryCode === selectedCityProp.countryCode ||
          c.country?.toLowerCase() === selectedCityProp.country?.toLowerCase()
      );
      if (foundCountry) {
        setSelectedCountry(foundCountry);
      }
      if (selectedCityProp.region) {
        setSelectedRegion({
          region: selectedCityProp.region,
          displayName: getStateDisplayName(selectedCityProp.countryCode, selectedCityProp.region),
          countryCode: selectedCityProp.countryCode,
          country: selectedCityProp.country,
        });
      }
      setSelectedCity(selectedCityProp);
      setDrillLevel("city");
    }
  }, [selectedCityProp, topCountries]);

  // Hover handlers
  const handleCountryHover = useCallback((event, feature, data) => {
    const name = feature.properties?.name || "Unknown";
    const numId = String(feature.id).padStart(3, "0");
    const iso = NUMERIC_TO_ISO2[numId] || COUNTRY_NAME_TO_ISO2[name.toLowerCase()] || "";
    setHoveredCountry(
      data || {
        country: name,
        countryCode: iso,
        totalClicks: 0,
        qrClicks: 0,
        directClicks: 0,
        percentage: 0,
      }
    );
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: event.clientX - rect.left + 14,
        y: event.clientY - rect.top + 14,
      });
    }
  }, []);

  const handleCountryMouseMove = useCallback((event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: event.clientX - rect.left + 14,
        y: event.clientY - rect.top + 14,
      });
    }
  }, []);

  const handleCountryMouseLeave = useCallback(() => {
    setHoveredCountry(null);
  }, []);

  const handleCountryClick = useCallback(
    (feature, data) => {
      const name = feature.properties?.name || "Unknown";
      const numId = String(feature.id).padStart(3, "0");
      const iso = NUMERIC_TO_ISO2[numId] || COUNTRY_NAME_TO_ISO2[name.toLowerCase()] || "";
      const countryPayload = data || {
        country: name,
        countryCode: iso,
        totalClicks: 0,
        qrClicks: 0,
        directClicks: 0,
        percentage: 0,
      };
      handleSelectCountry(countryPayload);
    },
    [handleSelectCountry]
  );

  // Filtered regions and cities for drill-down views
  const countryRegions = useMemo(() => {
    if (!selectedCountry) return [];
    const code = (selectedCountry.countryCode || "").toUpperCase();
    return regions.filter(
      (r) =>
        (r.countryCode && r.countryCode.toUpperCase() === code) ||
        (r.country && r.country.toLowerCase() === selectedCountry.country.toLowerCase())
    );
  }, [regions, selectedCountry]);

  const stateCities = useMemo(() => {
    if (!selectedCountry) return [];
    const countryMatch = (c) =>
      (c.countryCode && c.countryCode.toUpperCase() === (selectedCountry.countryCode || "").toUpperCase()) ||
      (c.country && c.country.toLowerCase() === selectedCountry.country.toLowerCase());

    const citiesInCountry = topCities.filter(countryMatch);
    if (drillLevel === "state" || drillLevel === "city") {
      if (!selectedRegion) return citiesInCountry;
      return citiesInCountry.filter(
        (c) =>
          c.region === selectedRegion.region ||
          getStateDisplayName(c.countryCode, c.region) === selectedRegion.displayName ||
          (selectedRegion.region && c.region && c.region.toLowerCase() === selectedRegion.region.toLowerCase())
      );
    }
    return citiesInCountry;
  }, [topCities, selectedCountry, selectedRegion, drillLevel]);

  return (
    <div className="geo-2d-container" ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Breadcrumb Trail when drilled down */}
      {drillLevel !== "world" && (
        <div
          className="geo-drilldown-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
            paddingBottom: "12px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="geo-breadcrumbs" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <button
              type="button"
              className="crumb-btn"
              onClick={handleBackToWorld}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "4px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Globe size={14} /> World
            </button>

            {selectedCountry && (
              <>
                <span style={{ color: "var(--text-muted)" }}>/</span>
                <button
                  type="button"
                  className="crumb-btn"
                  onClick={handleBackToCountry}
                  style={{
                    background: "none",
                    border: "none",
                    color: drillLevel === "country" ? "var(--text)" : "var(--accent)",
                    fontWeight: drillLevel === "country" ? "600" : "400",
                    cursor: drillLevel === "country" ? "default" : "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {getCountryFlagEmoji(selectedCountry.countryCode)} {selectedCountry.country}
                </button>
              </>
            )}

            {selectedRegion && (
              <>
                <span style={{ color: "var(--text-muted)" }}>/</span>
                <button
                  type="button"
                  className="crumb-btn"
                  onClick={handleBackToState}
                  style={{
                    background: "none",
                    border: "none",
                    color: drillLevel === "state" ? "var(--text)" : "var(--accent)",
                    fontWeight: drillLevel === "state" ? "600" : "400",
                    cursor: drillLevel === "state" ? "default" : "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {selectedRegion.displayName}
                </button>
              </>
            )}

            {selectedCity && (
              <>
                <span style={{ color: "var(--text-muted)" }}>/</span>
                <span style={{ color: "var(--text)", fontWeight: "600", padding: "2px 6px" }}>
                  {selectedCity.city}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            className="geo-back-action-btn"
            onClick={
              drillLevel === "city"
                ? handleBackToState
                : drillLevel === "state"
                ? handleBackToCountry
                : handleBackToWorld
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: "500",
              color: "var(--text)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={13} />
            {drillLevel === "city"
              ? `Back to ${selectedRegion?.displayName || "State"}`
              : drillLevel === "state"
              ? `Back to ${selectedCountry?.country || "Country"}`
              : "Back to World"}
          </button>
        </div>
      )}

      {/* Main Map or Drilldown View */}
      {drillLevel === "world" ? (
        <div className="geo-2d-canvas-wrap" style={{ position: "relative", width: "100%", overflow: "hidden" }}>
          {/* Zoom and Pan Controls (+ / - / Reset) */}
          <div
            className="geo-zoom-controls"
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              zIndex: 10,
            }}
            role="toolbar"
            aria-label="Map zoom controls"
          >
            <button
              type="button"
              className="geo-zoom-btn"
              onClick={handleZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              disabled={currentZoom >= 8}
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                cursor: currentZoom >= 8 ? "not-allowed" : "pointer",
                opacity: currentZoom >= 8 ? 0.5 : 1,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="geo-zoom-btn"
              onClick={handleZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              disabled={currentZoom <= 1}
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                cursor: currentZoom <= 1 ? "not-allowed" : "pointer",
                opacity: currentZoom <= 1 ? 0.5 : 1,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              className="geo-zoom-btn"
              onClick={handleResetZoom}
              title="Reset zoom"
              aria-label="Reset zoom"
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* SVG Map: Natural Earth Projection, Transparent Ocean, 0.5px borders, 6% graticule */}
          <svg
            ref={svgRef}
            viewBox="0 0 960 480"
            className="geo-2d-svg"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              background: "transparent",
              cursor: currentZoom > 1 ? "grab" : "default",
            }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="countryGlow2D" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <g ref={gRef} className="geo-zoom-layer">
              {/* Faint Graticule lines at 6% opacity */}
              <path
                d={graticulePath}
                fill="none"
                stroke="var(--text)"
                strokeOpacity="0.06"
                strokeWidth="0.5"
                strokeDasharray="2,2"
                style={{ pointerEvents: "none" }}
              />

              {/* Country Boundaries */}
              <g className="geo-countries-group">
                {countriesGeo.features.map((feature) => {
                  const data = getFeatureCountryData(feature);
                  const code = getFeatureCountryCode(feature);
                  const isHovered =
                    hoveredCountry &&
                    ((code && hoveredCountry.countryCode === code) ||
                      (feature.properties?.name &&
                        hoveredCountry.country?.toLowerCase() === feature.properties.name.toLowerCase()));
                  const isSelected =
                    selectedCountry &&
                    ((code && selectedCountry.countryCode === code) ||
                      (feature.properties?.name &&
                        selectedCountry.country?.toLowerCase() === feature.properties.name.toLowerCase()));
                  const hasData = data && data.totalClicks > 0;
                  const fill = getCountryFill(data);

                  return (
                    <path
                      key={feature.id || feature.properties?.name || code}
                      d={pathGenerator(feature)}
                      fill={fill}
                      stroke={
                        isSelected
                          ? "#38BDF8"
                          : isHovered
                          ? "#34D399"
                          : hasData
                          ? "#10B981"
                          : "var(--border)"
                      }
                      strokeWidth={isSelected ? 2 : isHovered ? 1.5 : hasData ? 1 : 0.5}
                      filter={hasData && (isHovered || isSelected) ? "url(#countryGlow2D)" : "none"}
                      className="geo-country-path"
                      style={{
                        cursor: "pointer",
                        transition: "fill 0.15s ease, stroke 0.15s ease",
                      }}
                      onMouseEnter={(e) => handleCountryHover(e, feature, data)}
                      onMouseMove={handleCountryMouseMove}
                      onMouseLeave={handleCountryMouseLeave}
                      onClick={() => handleCountryClick(feature, data)}
                    >
                      <title>{`${feature.properties?.name || "Country"}: ${data?.totalClicks || 0} visits`}</title>
                    </path>
                  );
                })}
              </g>
            </g>
          </svg>

          {/* Floating Tooltip: Country, Visits, Share */}
          {hoveredCountry && (
            <div
              className="geo-floating-tooltip"
              style={{
                position: "absolute",
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "8px 12px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                pointerEvents: "none",
                zIndex: 20,
                fontSize: "12px",
                minWidth: "140px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", marginBottom: "4px" }}>
                <span>{getCountryFlagEmoji(hoveredCountry.countryCode)}</span>
                <span>{hoveredCountry.country}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", gap: "12px" }}>
                <span>Visits:</span>
                <span style={{ fontWeight: "600", color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                  {hoveredCountry.totalClicks || 0}
                </span>
              </div>
              {hoveredCountry.percentage !== undefined && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", gap: "12px", marginTop: "2px" }}>
                  <span>Share of total:</span>
                  <span style={{ fontWeight: "600", color: "#10B981" }}>
                    {hoveredCountry.percentage}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Legend Row: High / Moderate / Low / Unvisited with Drilldown Hint */}
          <div
            className="globe-footer-legend"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginTop: "12px",
              padding: "8px 16px",
              borderRadius: "999px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontSize: "11.5px",
              color: "var(--text-muted)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <span className="legend-tag" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span className="dot-sample green-dot" style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981", display: "inline-block" }} /> High
              </span>
              <span className="legend-tag" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span className="dot-sample purple-dot" style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#8B5CF6", boxShadow: "0 0 6px #8B5CF6", display: "inline-block" }} /> Moderate
              </span>
              <span className="legend-tag" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span className="dot-sample" style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#6366F1", display: "inline-block" }} /> Low
              </span>
              <span className="legend-tag" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span className="dot-sample slate-dot" style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--map-land)", border: "1px solid var(--border)", display: "inline-block" }} /> Unvisited
              </span>
            </div>
            <span className="legend-hint" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
              Click any coloured country to drill down
            </span>
          </div>
        </div>
      ) : (
        /* Drilldown Views: Country -> State -> City */
        <div className="geo-drilldown-content" style={{ marginTop: "12px" }}>
          {drillLevel === "country" && (
            <div className="geo-drilldown-country">
              {/* If US, render interactive State Map */}
              {selectedCountry?.countryCode?.toUpperCase() === "US" && (
                <div style={{ marginBottom: "20px" }}>
                  <USStatesVectorMap
                    regions={countryRegions}
                    onSelectRegion={handleSelectRegion}
                  />
                </div>
              )}

              <div style={{ marginBottom: "12px" }}>
                <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>
                  States & Administrative Regions in {selectedCountry.country}
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                  Select a region below to inspect city clusters and traffic channels.
                </p>
              </div>

              {countryRegions.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {countryRegions.map((r, idx) => {
                    const displayName = getStateDisplayName(r.countryCode, r.region);
                    return (
                      <div
                        key={`${r.region}-${idx}`}
                        onClick={() => handleSelectRegion({ ...r, displayName })}
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          cursor: "pointer",
                          transition: "border-color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>
                            {displayName}
                          </span>
                          <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            {r.totalClicks} {r.totalClicks === 1 ? "visit" : "visits"}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {r.qrClicks} QR, {r.directClicks} direct
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  No specific state or regional data recorded for {selectedCountry.country}.
                  Visits were recorded at the national gateway level.
                </div>
              )}
            </div>
          )}

          {drillLevel === "state" && (
            <div className="geo-drilldown-state">
              <div style={{ marginBottom: "12px" }}>
                <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>
                  Cities in {selectedRegion.displayName}
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                  Metropolitan locations generating traffic in this state.
                </p>
              </div>

              {stateCities.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {stateCities.map((c, idx) => (
                    <div
                      key={`${c.city}-${idx}`}
                      onClick={() => handleSelectCity(c)}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        cursor: "pointer",
                        transition: "border-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>
                          {c.city}
                        </span>
                        <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {c.totalClicks} {c.totalClicks === 1 ? "visit" : "visits"}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {c.qrClicks} QR, {c.directClicks} direct
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  No individual cities identified for this state.
                </div>
              )}
            </div>
          )}

          {drillLevel === "city" && (
            <div className="geo-drilldown-city">
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "18px",
                }}
              >
                <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: "600", color: "var(--text)" }}>
                  {selectedCity.city}
                </h4>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--text-muted)" }}>
                  {getStateDisplayName(selectedCity.countryCode, selectedCity.region)}, {selectedCity.country}
                </p>

                <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
                  <div>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>Total Visits</span>
                    <strong style={{ fontSize: "18px", fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                      {selectedCity.totalClicks}
                    </strong>
                  </div>
                  <div>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>QR Scans</span>
                    <strong style={{ fontSize: "18px", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                      {selectedCity.qrClicks}
                    </strong>
                  </div>
                  <div>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>Direct Visits</span>
                    <strong style={{ fontSize: "18px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {selectedCity.directClicks}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    background: "var(--surface-2)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "var(--text-muted)",
                  }}
                >
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>Locations are approximate and based on IP address.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: USStatesVectorMap
// Interactive US Vector Map for US State Drill-Down using us-atlas
// -----------------------------------------------------------------------------
function USStatesVectorMap({ regions = [], onSelectRegion }) {
  const svgRef = useRef(null);

  const regionClicksMap = useMemo(() => {
    const map = new Map();
    for (const r of regions) {
      if (r.region) {
        map.set(r.region.toUpperCase(), r);
      }
    }
    return map;
  }, [regions]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = 760;
    const height = 440;

    svg.selectAll("*").remove();

    const projection = d3
      .geoAlbersUsa()
      .scale(850)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);
    const states = topojson.feature(usData, usData.objects.states);
    const g = svg.append("g");

    const fipsToCode = {};
    for (const [code, info] of Object.entries(US_STATES)) {
      fipsToCode[info.fips] = code;
    }

    g.selectAll("path")
      .data(states.features)
      .enter()
      .append("path")
      .attr("class", "us-state-path")
      .attr("d", path)
      .attr("fill", (d) => {
        const code = fipsToCode[d.id];
        const data = code ? regionClicksMap.get(code) : null;
        if (data && data.totalClicks > 0) {
          return "var(--accent)";
        }
        return "var(--map-land)";
      })
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this).attr("stroke", "var(--accent)").attr("stroke-width", 1.5);
      })
      .on("mouseleave", function (event, d) {
        d3.select(this).attr("stroke", "var(--border)").attr("stroke-width", 0.5);
      })
      .on("click", (event, d) => {
        const code = fipsToCode[d.id];
        const name = d.properties?.name || US_STATES[code]?.name || "State";
        const data = code ? regionClicksMap.get(code) : null;
        onSelectRegion(
          data || {
            countryCode: "US",
            country: "United States",
            region: code || "Unknown",
            displayName: name,
            totalClicks: 0,
            qrClicks: 0,
            directClicks: 0,
            percentage: 0,
          }
        );
      })
      .append("title")
      .text((d) => {
        const code = fipsToCode[d.id];
        const name = d.properties?.name || US_STATES[code]?.name || "State";
        const data = code ? regionClicksMap.get(code) : null;
        return `${name}: ${data?.totalClicks || 0} visits (${data?.qrClicks || 0} QR)`;
      });
  }, [regions, regionClicksMap, onSelectRegion]);

  return (
    <div className="us-vector-wrapper" style={{ width: "100%", overflow: "hidden" }}>
      <svg
        ref={svgRef}
        viewBox="0 0 760 440"
        className="us-vector-svg"
        style={{ width: "100%", height: "auto", display: "block" }}
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}
