import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import usData from "us-atlas/states-10m.json";
import globeDots from "../data/globeDots.json";
import {
  NUMERIC_TO_ISO2,
  ISO2_TO_NUMERIC,
  COUNTRY_NAME_TO_ISO2,
  US_STATES,
  getStateDisplayName,
  getCountryFlagEmoji,
} from "../data/geoLookup.js";

// -----------------------------------------------------------------------------
// Component: RotatingDottedGlobe
// 3D Rotating Dotted Earth Globe with Wireframe Graticule & Multi-Level Drill-Down
// -----------------------------------------------------------------------------
export default function RotatingDottedGlobe({
  topCountries = [],
  regions = [],
  topCities = [],
  summary = null,
}) {
  // Navigation / Drill-down state
  // level: 'world' | 'country' | 'state' | 'city'
  const [drillLevel, setDrillLevel] = useState("world");
  const [selectedCountry, setSelectedCountry] = useState(null); // { country, countryCode, ... }
  const [selectedRegion, setSelectedRegion] = useState(null); // { region, displayName, ... }
  const [selectedCity, setSelectedCity] = useState(null); // { city, ... }

  // Canvas / SVG refs for globe
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Globe rotation and interaction state
  const [isRotating, setIsRotating] = useState(true);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const rotationRef = useRef([-20, -15]); // [lambda, phi]
  const scaleRef = useRef(250);
  const animFrameIdRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef([0, 0]);

  // Extract World Atlas features
  const { countriesGeo, landGeo } = useMemo(() => {
    const countries = topojson.feature(worldData, worldData.objects.countries);
    const land = topojson.feature(worldData, worldData.objects.land);
    return { countriesGeo: countries, landGeo: land };
  }, []);

  // US States features for detailed US drill-down
  const usStatesGeo = useMemo(() => {
    return topojson.feature(usData, usData.objects.states);
  }, []);

  // Map of CountryCode -> Metrics
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

  // Max clicks across countries for color scaling
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

  // ---------------------------------------------------------------------------
  // Globe Rendering & Interactive Rotation Loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (drillLevel !== "world" || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 560;

    // 1. Orthographic 3D projection
    const projection = d3
      .geoOrthographic()
      .scale(scaleRef.current)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .rotate(rotationRef.current);

    const path = d3.geoPath().projection(projection);

    // Clear previous drawing
    svg.selectAll("*").remove();

    // Definitions: Glow filters & Gradients
    const defs = svg.append("defs");

    // Atmospheric outer space glow
    const spaceGrad = defs
      .append("radialGradient")
      .attr("id", "spaceAtmosphere")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%");
    spaceGrad.append("stop").attr("offset", "0%").attr("stop-color", "#0f172a");
    spaceGrad.append("stop").attr("offset", "100%").attr("stop-color", "#020617");

    // Sphere radial gradient for 3D sphere volume
    const sphereGrad = defs
      .append("radialGradient")
      .attr("id", "sphereShading")
      .attr("cx", "35%")
      .attr("cy", "35%")
      .attr("r", "65%");
    sphereGrad.append("stop").attr("offset", "0%").attr("stop-color", "#1e293b");
    sphereGrad.append("stop").attr("offset", "80%").attr("stop-color", "#090d16");
    sphereGrad.append("stop").attr("offset", "100%").attr("stop-color", "#030712");

    // Glowing dot filter
    const dotFilter = defs.append("filter").attr("id", "dotGlow");
    dotFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "2.5")
      .attr("result", "coloredBlur");
    const feMerge = dotFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Main group
    const rootG = svg.append("g");

    // 1. Sphere Base (Ocean)
    const sphereBase = rootG
      .append("path")
      .datum({ type: "Sphere" })
      .attr("class", "globe-ocean-sphere")
      .attr("fill", "url(#sphereShading)")
      .attr("stroke", "rgba(56, 189, 248, 0.25)")
      .attr("stroke-width", 1.5)
      .attr("d", path);

    // 2. Wireframe Graticule Grid Lines (Latitude / Longitude 15-degree steps)
    const graticule = d3.geoGraticule().step([15, 15]);
    const graticulePath = rootG
      .append("path")
      .datum(graticule)
      .attr("class", "globe-graticule-lines")
      .attr("fill", "none")
      .attr("stroke", "rgba(148, 163, 184, 0.12)")
      .attr("stroke-width", 0.75)
      .attr("stroke-dasharray", "3,3")
      .attr("d", path);

    // 3. Country Outlines
    const countriesGroup = rootG.append("g").attr("class", "globe-countries-layer");
    const countryPaths = countriesGroup
      .selectAll("path")
      .data(countriesGeo.features)
      .enter()
      .append("path")
      .attr("class", "globe-country-boundary")
      .attr("d", path)
      .attr("fill", (d) => {
        const data = getFeatureCountryData(d);
        if (data && data.totalClicks > 0) {
          const ratio = data.totalClicks / maxCountryClicks;
          if (ratio > 0.5) return "rgba(16, 185, 129, 0.25)";
          return "rgba(139, 92, 246, 0.2)";
        }
        return "transparent";
      })
      .attr("stroke", (d) => {
        const data = getFeatureCountryData(d);
        if (data && data.totalClicks > 0) return "rgba(52, 211, 153, 0.6)";
        return "rgba(255, 255, 255, 0.1)";
      })
      .attr("stroke-width", (d) => {
        const data = getFeatureCountryData(d);
        return data && data.totalClicks > 0 ? 1.2 : 0.6;
      })
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        const data = getFeatureCountryData(d);
        const name = d.properties?.name || "Unknown";
        const iso = NUMERIC_TO_ISO2[String(d.id).padStart(3, "0")] || "";
        setHoveredCountry(
          data || {
            country: name,
            countryCode: iso,
            totalClicks: 0,
            qrClicks: 0,
            directClicks: 0,
            qrPercentage: 0,
          }
        );
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: event.clientX - rect.left + 15,
            y: event.clientY - rect.top + 15,
          });
        }
        d3.select(event.currentTarget)
          .attr("stroke", "#38BDF8")
          .attr("stroke-width", 2.2);
      })
      .on("mousemove", (event) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: event.clientX - rect.left + 15,
            y: event.clientY - rect.top + 15,
          });
        }
      })
      .on("mouseleave", (event, d) => {
        setHoveredCountry(null);
        const data = getFeatureCountryData(d);
        d3.select(event.currentTarget)
          .attr("stroke", data && data.totalClicks > 0 ? "rgba(52, 211, 153, 0.6)" : "rgba(255, 255, 255, 0.1)")
          .attr("stroke-width", data && data.totalClicks > 0 ? 1.2 : 0.6);
      })
      .on("click", (event, d) => {
        const data = getFeatureCountryData(d);
        const name = d.properties?.name || "Unknown";
        const iso = NUMERIC_TO_ISO2[String(d.id).padStart(3, "0")] || "";
        const countryPayload = data || {
          country: name,
          countryCode: iso,
          totalClicks: 0,
          qrClicks: 0,
          directClicks: 0,
          qrPercentage: 0,
        };
        handleSelectCountry(countryPayload);
      });

    // 4. Halftone Dotted Matrix (Wireframe-Dotted Earth Pattern)
    const dotsGroup = rootG.append("g").attr("class", "globe-dots-layer");

    // Build SVG circle elements for all 1,880 land dots
    const dotsSelection = dotsGroup
      .selectAll("circle")
      .data(globeDots)
      .enter()
      .append("circle")
      .attr("r", 1.8)
      .attr("fill", (d) => {
        const countryId = d[2];
        const numId = countryId ? String(countryId).padStart(3, "0") : null;
        const iso = numId ? NUMERIC_TO_ISO2[numId] : null;
        if (iso && countryDataMap.has(iso)) {
          const data = countryDataMap.get(iso);
          if (data && data.totalClicks > 0) {
            return data.qrClicks > 0 ? "#10B981" : "#8B5CF6";
          }
        }
        return "rgba(100, 116, 139, 0.55)";
      })
      .attr("filter", (d) => {
        const countryId = d[2];
        const numId = countryId ? String(countryId).padStart(3, "0") : null;
        const iso = numId ? NUMERIC_TO_ISO2[numId] : null;
        if (iso && countryDataMap.has(iso)) return "url(#dotGlow)";
        return "none";
      });

    // Function to reproject all elements on rotation update
    const renderFrame = () => {
      projection.rotate(rotationRef.current).scale(scaleRef.current);

      sphereBase.attr("d", path);
      graticulePath.attr("d", path);
      countryPaths.attr("d", path);

      dotsSelection
        .attr("cx", (d) => {
          const coords = projection([d[0], d[1]]);
          return coords ? coords[0] : -9999;
        })
        .attr("cy", (d) => {
          const coords = projection([d[0], d[1]]);
          return coords ? coords[1] : -9999;
        })
        .style("display", (d) => {
          // Hide dots on back hemisphere
          const p = projection([d[0], d[1]]);
          return p ? null : "none";
        });
    };

    renderFrame();

    // 5. Continuous Smooth Auto-Rotation Animation Loop
    let lastTime = performance.now();
    const animate = (time) => {
      if (isRotating && !isDraggingRef.current) {
        const dt = time - lastTime;
        if (dt < 100) {
          // Rotate 0.18 degrees per frame
          rotationRef.current[0] += 0.18;
          renderFrame();
        }
      }
      lastTime = time;
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 6. Interactive Drag Controls (Rotate in all directions with mouse / touch)
    const dragBehavior = d3
      .drag()
      .on("start", (event) => {
        isDraggingRef.current = true;
        lastMousePosRef.current = [event.x, event.y];
      })
      .on("drag", (event) => {
        const dx = event.x - lastMousePosRef.current[0];
        const dy = event.y - lastMousePosRef.current[1];
        lastMousePosRef.current = [event.x, event.y];

        const sens = 0.45;
        rotationRef.current[0] += dx * sens;
        rotationRef.current[1] = Math.max(-80, Math.min(80, rotationRef.current[1] - dy * sens));

        renderFrame();
      })
      .on("end", () => {
        isDraggingRef.current = false;
      });

    svg.call(dragBehavior);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [
    drillLevel,
    isRotating,
    countriesGeo,
    countryDataMap,
    maxCountryClicks,
    getFeatureCountryData,
  ]);

  // ---------------------------------------------------------------------------
  // Navigation / Drill-Down Handlers
  // ---------------------------------------------------------------------------
  const handleSelectCountry = useCallback((c) => {
    setSelectedCountry(c);
    setSelectedRegion(null);
    setSelectedCity(null);
    setDrillLevel("country");
  }, []);

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

  // Filtered Regions for selected country
  const countryRegions = useMemo(() => {
    if (!selectedCountry) return [];
    const code = (selectedCountry.countryCode || "").toUpperCase();
    return regions.filter(
      (r) =>
        (r.countryCode && r.countryCode.toUpperCase() === code) ||
        (r.country && r.country.toLowerCase() === selectedCountry.country.toLowerCase())
    );
  }, [regions, selectedCountry]);

  // Filtered Cities for selected country or state
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
          getStateDisplayName(c.countryCode, c.region) === selectedRegion.displayName
      );
    }
    return citiesInCountry;
  }, [topCities, selectedCountry, selectedRegion, drillLevel]);

  // Selected item metrics
  const activeMetrics = useMemo(() => {
    if (drillLevel === "city" && selectedCity) {
      return {
        title: selectedCity.city,
        subtitle: `${getStateDisplayName(selectedCity.countryCode, selectedCity.region)}, ${selectedCity.country}`,
        flag: getCountryFlagEmoji(selectedCity.countryCode),
        totalClicks: selectedCity.totalClicks || 0,
        qrClicks: selectedCity.qrClicks || 0,
        directClicks: selectedCity.directClicks || 0,
        qrPercentage: selectedCity.qrPercentage || 0,
      };
    }
    if (drillLevel === "state" && selectedRegion) {
      return {
        title: selectedRegion.displayName,
        subtitle: `State in ${selectedCountry?.country || "Nation"}`,
        flag: getCountryFlagEmoji(selectedCountry?.countryCode),
        totalClicks: selectedRegion.totalClicks || 0,
        qrClicks: selectedRegion.qrClicks || 0,
        directClicks: selectedRegion.directClicks || 0,
        qrPercentage: selectedRegion.qrPercentage || 0,
      };
    }
    if (drillLevel === "country" && selectedCountry) {
      return {
        title: selectedCountry.country,
        subtitle: `Nation (${selectedCountry.countryCode || "Global"})`,
        flag: getCountryFlagEmoji(selectedCountry.countryCode),
        totalClicks: selectedCountry.totalClicks || 0,
        qrClicks: selectedCountry.qrClicks || 0,
        directClicks: selectedCountry.directClicks || 0,
        qrPercentage: selectedCountry.qrPercentage || 0,
      };
    }
    return {
      title: "Global Overview",
      subtitle: `${summary?.countriesCount || topCountries.length} Countries Reached`,
      flag: "🌍",
      totalClicks: summary?.totalClicks || 0,
      qrClicks: summary?.qrGeoClicks || 0,
      directClicks: summary?.directGeoClicks || 0,
      qrPercentage:
        summary?.totalClicks > 0
          ? Number(((summary.qrGeoClicks / summary.totalClicks) * 100).toFixed(1))
          : 0,
    };
  }, [drillLevel, selectedCity, selectedRegion, selectedCountry, summary, topCountries]);

  return (
    <div className="geo-chart-card globe-interactive-card" ref={containerRef}>
      {/* 1. Header & Breadcrumb Trail */}
      <div className="globe-card-header">
        <div className="globe-title-block">
          <div className="globe-breadcrumbs">
            <button
              type="button"
              className={`crumb-btn ${drillLevel === "world" ? "active" : ""}`}
              onClick={handleBackToWorld}
            >
              🌍 World
            </button>

            {selectedCountry && (
              <>
                <span className="crumb-separator">/</span>
                <button
                  type="button"
                  className={`crumb-btn ${drillLevel === "country" ? "active" : ""}`}
                  onClick={handleBackToCountry}
                >
                  {getCountryFlagEmoji(selectedCountry.countryCode)} {selectedCountry.country}
                </button>
              </>
            )}

            {selectedRegion && (
              <>
                <span className="crumb-separator">/</span>
                <button
                  type="button"
                  className={`crumb-btn ${drillLevel === "state" ? "active" : ""}`}
                  onClick={handleBackToState}
                >
                  {selectedRegion.displayName}
                </button>
              </>
            )}

            {selectedCity && (
              <>
                <span className="crumb-separator">/</span>
                <span className="crumb-current">🏙️ {selectedCity.city}</span>
              </>
            )}
          </div>

          <h3 className="globe-level-heading">
            {drillLevel === "world" && "Global 3D Dotted Earth Globe"}
            {drillLevel === "country" && `Country Overview: ${selectedCountry?.country}`}
            {drillLevel === "state" && `State / Region: ${selectedRegion?.displayName}`}
            {drillLevel === "city" && `City Analytics: ${selectedCity?.city}`}
          </h3>
          <p className="globe-level-desc">
            {drillLevel === "world" &&
              "Drag to rotate the 3D globe. Click any country to drill down into states and cities."}
            {drillLevel === "country" &&
              "Select a state or territory below to inspect regional traffic and city clusters."}
            {drillLevel === "state" &&
              "Metropolitan cities and physical QR interactions originating in this state."}
            {drillLevel === "city" &&
              "Channel breakdown and visitor engagement for this specific city."}
          </p>
        </div>

        {/* Level Controls & Quick Back Action */}
        <div className="globe-actions-bar">
          {drillLevel !== "world" && (
            <button
              type="button"
              className="globe-back-btn"
              onClick={
                drillLevel === "city"
                  ? handleBackToState
                  : drillLevel === "state"
                  ? handleBackToCountry
                  : handleBackToWorld
              }
            >
              ← Back
            </button>
          )}

          {drillLevel === "world" && (
            <div className="globe-spin-controls">
              <button
                type="button"
                className={`globe-tool-btn ${isRotating ? "active" : ""}`}
                onClick={() => setIsRotating((prev) => !prev)}
                title={isRotating ? "Pause Auto-Rotation" : "Resume Auto-Rotation"}
                aria-label="Toggle Auto-Rotation"
              >
                {isRotating ? "⏸ Pause" : "▶ Rotate"}
              </button>
              <button
                type="button"
                className="globe-tool-btn"
                onClick={() => {
                  rotationRef.current = [-20, -15];
                  scaleRef.current = 250;
                }}
                title="Reset Orientation"
                aria-label="Reset Orientation"
              >
                ⟲ Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Active Selection Metrics Banner */}
      <div className="globe-metrics-banner">
        <div className="selection-badge">
          <span className="selection-flag">{activeMetrics.flag}</span>
          <div className="selection-titles">
            <span className="selection-main-title">{activeMetrics.title}</span>
            <span className="selection-sub-title">{activeMetrics.subtitle}</span>
          </div>
        </div>

        <div className="selection-stats-grid">
          <div className="selection-stat-box">
            <span className="stat-label">Total Visits</span>
            <span className="stat-num">{activeMetrics.totalClicks.toLocaleString()}</span>
          </div>
          <div className="selection-stat-box qr">
            <span className="stat-label">QR Physical Scans</span>
            <span className="stat-num">{activeMetrics.qrClicks.toLocaleString()}</span>
          </div>
          <div className="selection-stat-box direct">
            <span className="stat-label">Direct Clicks</span>
            <span className="stat-num">{activeMetrics.directClicks.toLocaleString()}</span>
          </div>
          <div className="selection-stat-box rate">
            <span className="stat-label">QR Scan Rate</span>
            <span className="stat-num">{activeMetrics.qrPercentage}%</span>
          </div>
        </div>
      </div>

      {/* 3. Main Visualization Area */}
      {drillLevel === "world" ? (
        <div className="globe-svg-wrapper">
          <svg
            ref={svgRef}
            viewBox="0 0 800 560"
            className="globe-svg-canvas"
            preserveAspectRatio="xMidYMid meet"
          />

          {/* Floating Hover Inspector Tooltip */}
          {hoveredCountry && (
            <div
              className="globe-floating-tooltip"
              style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
            >
              <div className="tooltip-header">
                <span className="tooltip-flag">
                  {getCountryFlagEmoji(hoveredCountry.countryCode)}
                </span>
                <span className="tooltip-name">{hoveredCountry.country}</span>
              </div>
              <div className="tooltip-body">
                <div className="tooltip-row">
                  <span>Total Visits:</span>
                  <strong>{hoveredCountry.totalClicks}</strong>
                </div>
                <div className="tooltip-row">
                  <span>QR Scans:</span>
                  <strong style={{ color: "#10B981" }}>{hoveredCountry.qrClicks}</strong>
                </div>
                <div className="tooltip-row">
                  <span>Direct Clicks:</span>
                  <strong style={{ color: "#A78BFA" }}>{hoveredCountry.directClicks}</strong>
                </div>
                {hoveredCountry.totalClicks > 0 && (
                  <div className="tooltip-hint">Click country to drill down →</div>
                )}
              </div>
            </div>
          )}

          {/* Globe Legend */}
          <div className="globe-footer-legend">
            <span className="legend-tag">
              <span className="dot-sample green-dot" /> High Traffic (QR Active)
            </span>
            <span className="legend-tag">
              <span className="dot-sample purple-dot" /> Direct Web Traffic
            </span>
            <span className="legend-tag">
              <span className="dot-sample slate-dot" /> Unvisited Land
            </span>
            <span className="legend-hint">Tip: Drag with mouse to spin in any angle</span>
          </div>
        </div>
      ) : (
        /* Drill-down Sub-level (Country / State / City) */
        <div className="globe-drilldown-panel">
          {drillLevel === "country" && (
            <div className="drilldown-country-content">
              {/* If US, render interactive State Map */}
              {selectedCountry?.countryCode?.toUpperCase() === "US" && (
                <div className="us-states-map-container">
                  <USStatesVectorMap
                    regions={countryRegions}
                    onSelectRegion={handleSelectRegion}
                  />
                </div>
              )}

              {/* State / Region Selection Grid */}
              <div className="drilldown-section-header">
                <h4>States & Administrative Regions in {selectedCountry.country}</h4>
                <p>Click any state or province below to inspect metropolitan cities</p>
              </div>

              {countryRegions.length > 0 ? (
                <div className="regions-cards-grid">
                  {countryRegions.map((r) => {
                    const displayName = getStateDisplayName(r.countryCode, r.region);
                    return (
                      <div
                        key={r.region}
                        className="region-card-btn"
                        onClick={() => handleSelectRegion({ ...r, displayName })}
                      >
                        <div className="region-card-top">
                          <span className="region-badge">{r.region}</span>
                          <span className="region-clicks">{r.totalClicks} visits</span>
                        </div>
                        <div className="region-card-name">{displayName}</div>
                        <div className="region-card-metrics">
                          <span>📱 {r.qrClicks} QR</span>
                          <span>🌐 {r.directClicks} Direct</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="drilldown-empty-box">
                  <p>
                    No specific state or regional data recorded for {selectedCountry.country}.
                    Visits from this nation are logged at the national level.
                  </p>
                </div>
              )}
            </div>
          )}

          {drillLevel === "state" && (
            <div className="drilldown-state-content">
              <div className="drilldown-section-header">
                <h4>Cities in {selectedRegion.displayName}</h4>
                <p>Metropolitan locations generating traffic in this state</p>
              </div>

              {stateCities.length > 0 ? (
                <div className="cities-cards-grid">
                  {stateCities.map((c) => (
                    <div
                      key={c.city}
                      className="city-card-btn"
                      onClick={() => handleSelectCity(c)}
                    >
                      <div className="city-card-header">
                        <strong className="city-name">{c.city}</strong>
                        <span className="city-pill">{c.totalClicks} visits</span>
                      </div>
                      <div className="city-card-breakdown">
                        <span className="city-qr">📱 {c.qrClicks} QR ({c.qrPercentage}%)</span>
                        <span className="city-direct">🌐 {c.directClicks} Direct</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="drilldown-empty-box">
                  <p>
                    No individual cities were specifically identified for this state.
                    Traffic was recorded at the state/regional IP node level.
                  </p>
                </div>
              )}
            </div>
          )}

          {drillLevel === "city" && (
            <div className="drilldown-city-content">
              <div className="city-detail-box">
                <h4>City Traffic Analytics: {selectedCity.city}</h4>
                <div className="city-channel-comparison">
                  <div className="channel-bar-wrapper">
                    <div className="channel-bar-track">
                      {selectedCity.qrClicks > 0 && (
                        <div
                          className="channel-segment qr"
                          style={{ width: `${selectedCity.qrPercentage}%` }}
                        >
                          {selectedCity.qrPercentage}% QR
                        </div>
                      )}
                      {selectedCity.directClicks > 0 && (
                        <div
                          className="channel-segment direct"
                          style={{ width: `${100 - selectedCity.qrPercentage}%` }}
                        >
                          {Number((100 - selectedCity.qrPercentage).toFixed(1))}% Direct
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="city-channel-legend">
                    <span>📱 QR Scans: {selectedCity.qrClicks}</span>
                    <span>🌐 Direct Visits: {selectedCity.directClicks}</span>
                  </div>
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
// Interactive Vector Map for US State Drill-Down using us-atlas
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

    // Use Albers USA projection tailored for US states
    const projection = d3
      .geoAlbersUsa()
      .scale(850)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const states = topojson.feature(usData, usData.objects.states);

    const g = svg.append("g");

    // FIPS to 2-letter state code reverse lookup
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
          return "rgba(16, 185, 129, 0.4)";
        }
        return "rgba(30, 41, 59, 0.7)";
      })
      .attr("stroke", (d) => {
        const code = fipsToCode[d.id];
        const data = code ? regionClicksMap.get(code) : null;
        return data && data.totalClicks > 0 ? "#10B981" : "rgba(255, 255, 255, 0.15)";
      })
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this)
          .attr("stroke", "#38BDF8")
          .attr("stroke-width", 2.2);
      })
      .on("mouseleave", function (event, d) {
        const code = fipsToCode[d.id];
        const data = code ? regionClicksMap.get(code) : null;
        d3.select(this)
          .attr("stroke", data && data.totalClicks > 0 ? "#10B981" : "rgba(255, 255, 255, 0.15)")
          .attr("stroke-width", 1);
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
            qrPercentage: 0,
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
    <div className="us-vector-wrapper">
      <svg
        ref={svgRef}
        viewBox="0 0 760 440"
        className="us-vector-svg"
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}
