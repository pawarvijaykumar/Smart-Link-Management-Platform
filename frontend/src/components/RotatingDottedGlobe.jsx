import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import usData from "us-atlas/states-10m.json";
import globeDots from "../data/globeDots.json";
import {
  NUMERIC_TO_ISO2,
  COUNTRY_NAME_TO_ISO2,
  US_STATES,
  getStateDisplayName,
  getCountryFlagEmoji,
} from "../data/geoLookup.js";

// -----------------------------------------------------------------------------
// Component: RotatingDottedGlobe
// Interactive 2D World Map & 3D Rotating Dotted Earth Globe with Drill-Down:
// Country Level -> State Level -> City Level
// -----------------------------------------------------------------------------
export default function RotatingDottedGlobe({
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
  const [selectedCountry, setSelectedCountry] = useState(null); // { country, countryCode, ... }
  const [selectedRegion, setSelectedRegion] = useState(null); // { region, displayName, ... }
  const [selectedCity, setSelectedCity] = useState(null); // { city, ... }

  // Map View Mode: '2d' (Flat Interactive World Map) | '3d' (Rotating Orthographic Globe)
  const [viewMode, setViewMode] = useState("2d");

  // Canvas / SVG refs
  const globeSvgRef = useRef(null);
  const containerRef = useRef(null);

  // 3D Globe rotation and interaction state
  const [isRotating, setIsRotating] = useState(true);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const rotationRef = useRef([-20, -15]); // [lambda, phi]
  const scaleRef = useRef(250);
  const animFrameIdRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef([0, 0]);

  // Extract World Atlas features
  const { countriesGeo } = useMemo(() => {
    const countries = topojson.feature(worldData, worldData.objects.countries);
    return { countriesGeo: countries };
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

  // Helper: Determine country fill color
  const getCountryFill = useCallback(
    (data) => {
      if (!data || !data.totalClicks) {
        return "#1e293b"; // Unvisited land default
      }
      const ratio = data.totalClicks / maxCountryClicks;
      if (ratio > 0.5) return "#10B981"; // Emerald for high traffic
      if (ratio > 0.2) return "#8B5CF6"; // Purple for medium traffic
      return "#6366F1"; // Indigo for lower traffic
    },
    [maxCountryClicks]
  );

  // 2D Projection and Path Generator (Natural Earth projection)
  const { pathGenerator2D, graticule2D } = useMemo(() => {
    const width = 800;
    const height = 440;
    const proj = d3
      .geoNaturalEarth1()
      .scale(150)
      .translate([width / 2, height / 2]);
    const pathGen = d3.geoPath().projection(proj);
    const grat = d3.geoGraticule().step([20, 20])();
    return { pathGenerator2D: pathGen, graticule2D: grat };
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation / Drill-Down Handlers
  // ---------------------------------------------------------------------------
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
      // Find country and region for this city
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

  // ---------------------------------------------------------------------------
  // 2D Map Hover & Click Handlers
  // ---------------------------------------------------------------------------
  const handleCountryHover = useCallback(
    (event, feature, data) => {
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
    },
    []
  );

  const handleCountryMouseMove = useCallback((event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: event.clientX - rect.left + 15,
        y: event.clientY - rect.top + 15,
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
        qrPercentage: 0,
      };
      handleSelectCountry(countryPayload);
    },
    [handleSelectCountry]
  );

  // ---------------------------------------------------------------------------
  // 3D Globe Rendering & Interactive Rotation Loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (drillLevel !== "world" || viewMode !== "3d" || !globeSvgRef.current) return;

    const svg = d3.select(globeSvgRef.current);
    const width = 800;
    const height = 540;

    const projection = d3
      .geoOrthographic()
      .scale(scaleRef.current)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .rotate(rotationRef.current);

    const path = d3.geoPath().projection(projection);

    svg.selectAll("*").remove();

    const defs = svg.append("defs");

    // Atmospheric sphere shading
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
    dotFilter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const feMerge = dotFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

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

    // 2. Graticule Lines (pointer-events: none so clicks pass through)
    const graticule = d3.geoGraticule().step([15, 15]);
    const graticulePath = rootG
      .append("path")
      .datum(graticule)
      .attr("class", "globe-graticule-lines")
      .attr("fill", "none")
      .attr("stroke", "rgba(148, 163, 184, 0.12)")
      .attr("stroke-width", 0.75)
      .attr("stroke-dasharray", "3,3")
      .style("pointer-events", "none")
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
          if (ratio > 0.5) return "rgba(16, 185, 129, 0.35)";
          return "rgba(139, 92, 246, 0.3)";
        }
        return "transparent";
      })
      .attr("stroke", (d) => {
        const data = getFeatureCountryData(d);
        if (data && data.totalClicks > 0) return "rgba(52, 211, 153, 0.7)";
        return "rgba(255, 255, 255, 0.12)";
      })
      .attr("stroke-width", (d) => {
        const data = getFeatureCountryData(d);
        return data && data.totalClicks > 0 ? 1.4 : 0.6;
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
        d3.select(event.currentTarget).attr("stroke", "#38BDF8").attr("stroke-width", 2.2);
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
          .attr("stroke", data && data.totalClicks > 0 ? "rgba(52, 211, 153, 0.7)" : "rgba(255, 255, 255, 0.12)")
          .attr("stroke-width", data && data.totalClicks > 0 ? 1.4 : 0.6);
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

    // 4. Halftone Dotted Matrix (pointer-events: none so clicks pass directly to countries)
    const dotsGroup = rootG
      .append("g")
      .attr("class", "globe-dots-layer")
      .style("pointer-events", "none");

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

    // Reprojection loop
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
          const p = projection([d[0], d[1]]);
          return p ? null : "none";
        });
    };

    renderFrame();

    // Smooth Auto-Rotation Animation
    let lastTime = performance.now();
    const animate = (time) => {
      if (isRotating && !isDraggingRef.current) {
        const dt = time - lastTime;
        if (dt < 100) {
          rotationRef.current[0] += 0.18;
          renderFrame();
        }
      }
      lastTime = time;
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Interactive Drag Controls
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
    viewMode,
    isRotating,
    countriesGeo,
    countryDataMap,
    maxCountryClicks,
    getFeatureCountryData,
    handleSelectCountry,
  ]);

  // ---------------------------------------------------------------------------
  // Data Filtering for Selected Country & State
  // ---------------------------------------------------------------------------
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

  // Active metrics depending on current drill level
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
          {/* Breadcrumb Navigation Trail */}
          <div className="globe-breadcrumbs" role="navigation" aria-label="Geographic drill-down breadcrumbs">
            <button
              type="button"
              className={`crumb-btn ${drillLevel === "world" ? "active" : ""}`}
              onClick={handleBackToWorld}
            >
              🌍 World Map
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
            {drillLevel === "world" && (viewMode === "2d" ? "Global 2D World Map" : "Global 3D Dotted Earth Globe")}
            {drillLevel === "country" && `Country Analytics: ${selectedCountry?.country}`}
            {drillLevel === "state" && `State / Region: ${selectedRegion?.displayName}`}
            {drillLevel === "city" && `City Analytics: ${selectedCity?.city}`}
          </h3>
          <p className="globe-level-desc">
            {drillLevel === "world" &&
              "Click any country on the map below to drill down into its states, administrative regions, and metropolitan cities."}
            {drillLevel === "country" &&
              "Select a state or territory below to inspect regional traffic distribution and city clusters."}
            {drillLevel === "state" &&
              "Metropolitan cities and physical QR interactions originating in this state."}
            {drillLevel === "city" &&
              "Channel breakdown and visitor engagement for this specific city."}
          </p>
        </div>

        {/* Level Controls & Quick Back Action */}
        <div className="globe-actions-bar">
          {drillLevel !== "world" ? (
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
              {drillLevel === "city"
                ? `← Back to ${selectedRegion?.displayName || "State"}`
                : drillLevel === "state"
                ? `← Back to ${selectedCountry?.country || "Country"}`
                : "← Back to World Map"}
            </button>
          ) : (
            <div className="map-view-toggle-cluster" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {/* 2D vs 3D Map View Switcher */}
              <div className="map-view-toggle">
                <button
                  type="button"
                  className={`map-toggle-btn ${viewMode === "2d" ? "active" : ""}`}
                  onClick={() => setViewMode("2d")}
                  title="Switch to 2D Flat World Map"
                >
                  🗺️ 2D Map
                </button>
                <button
                  type="button"
                  className={`map-toggle-btn ${viewMode === "3d" ? "active" : ""}`}
                  onClick={() => setViewMode("3d")}
                  title="Switch to 3D Rotating Globe"
                >
                  🌐 3D Globe
                </button>
              </div>

              {viewMode === "3d" && (
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
        viewMode === "2d" ? (
          /* ================================================================= */
          /* 2D Flat World Map (Directly Clickable Country Vector Boundaries)   */
          /* ================================================================= */
          <div className="world-2d-wrapper" style={{ position: "relative", width: "100%", overflow: "hidden" }}>
            <svg
              viewBox="0 0 800 440"
              className="world-2d-svg"
              style={{ width: "100%", height: "auto", display: "block" }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <radialGradient id="ocean2D" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(15, 23, 42, 0.6)" />
                  <stop offset="100%" stopColor="rgba(8, 12, 24, 0.95)" />
                </radialGradient>
                <filter id="countryGlow2D" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Ocean Background */}
              <rect
                width="800"
                height="440"
                rx="12"
                fill="url(#ocean2D)"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
              />

              {/* Graticule grid lines */}
              <path
                d={pathGenerator2D(graticule2D)}
                fill="none"
                stroke="rgba(148, 163, 184, 0.1)"
                strokeWidth="0.5"
                strokeDasharray="3,3"
                style={{ pointerEvents: "none" }}
              />

              {/* Countries Layer */}
              <g className="world-2d-countries">
                {countriesGeo.features.map((feature) => {
                  const data = getFeatureCountryData(feature);
                  const code = getFeatureCountryCode(feature);
                  const isSelected =
                    selectedCountry &&
                    ((code && selectedCountry.countryCode === code) ||
                      (feature.properties?.name &&
                        selectedCountry.country?.toLowerCase() === feature.properties.name.toLowerCase()));
                  const isHovered =
                    hoveredCountry &&
                    ((code && hoveredCountry.countryCode === code) ||
                      (feature.properties?.name &&
                        hoveredCountry.country?.toLowerCase() === feature.properties.name.toLowerCase()));
                  const hasData = data && data.totalClicks > 0;
                  const fill = getCountryFill(data);

                  return (
                    <path
                      key={feature.id || feature.properties?.name}
                      d={pathGenerator2D(feature)}
                      fill={fill}
                      stroke={
                        isSelected
                          ? "#38BDF8"
                          : isHovered
                          ? "#FFFFFF"
                          : hasData
                          ? "rgba(255, 255, 255, 0.45)"
                          : "rgba(255, 255, 255, 0.1)"
                      }
                      strokeWidth={isSelected ? 2.5 : isHovered ? 2 : hasData ? 1 : 0.6}
                      filter={hasData && (isHovered || isSelected) ? "url(#countryGlow2D)" : "none"}
                      className={`world-map-country-path ${hasData ? "has-data" : ""} ${isSelected ? "selected" : ""}`}
                      style={{ cursor: "pointer", transition: "fill 0.15s ease, stroke 0.15s ease" }}
                      onMouseEnter={(e) => handleCountryHover(e, feature, data)}
                      onMouseMove={handleCountryMouseMove}
                      onMouseLeave={handleCountryMouseLeave}
                      onClick={() => handleCountryClick(feature, data)}
                    >
                      <title>{`${feature.properties?.name || "Country"}: ${data?.totalClicks || 0} visits (${data?.qrClicks || 0} QR)`}</title>
                    </path>
                  );
                })}
              </g>
            </svg>

            {/* Hover Floating Tooltip */}
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
                  <div className="tooltip-hint">Click country to drill down →</div>
                </div>
              </div>
            )}

            {/* Map Legend */}
            <div className="globe-footer-legend">
              <span className="legend-tag">
                <span className="dot-sample green-dot" /> High Traffic
              </span>
              <span className="legend-tag">
                <span className="dot-sample purple-dot" /> Moderate Traffic
              </span>
              <span className="legend-tag">
                <span className="dot-sample" style={{ background: "#6366F1" }} /> Low Traffic
              </span>
              <span className="legend-tag">
                <span className="dot-sample slate-dot" /> Unvisited Land
              </span>
              <span className="legend-hint">Click any colored country to drill down</span>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* 3D Rotating Dotted Earth Globe                                    */
          /* ================================================================= */
          <div className="globe-svg-wrapper">
            <svg
              ref={globeSvgRef}
              viewBox="0 0 800 540"
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
                  <div className="tooltip-hint">Click country to drill down →</div>
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
              <span className="legend-hint">Drag with mouse to rotate | Click to drill down</span>
            </div>
          </div>
        )
      ) : (
        /* ================================================================= */
        /* Drill-down Sub-level Panels (Country -> State -> City)            */
        /* ================================================================= */
        <div className="globe-drilldown-panel">
          {/* LEVEL 1: COUNTRY LEVEL DRILL-DOWN */}
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
                <p>Click any state or province below to inspect metropolitan cities and regional traffic</p>
              </div>

              {countryRegions.length > 0 ? (
                <div className="regions-cards-grid">
                  {countryRegions.map((r, idx) => {
                    const displayName = getStateDisplayName(r.countryCode, r.region);
                    return (
                      <div
                        key={`${r.region}-${idx}`}
                        className="region-card-btn"
                        onClick={() => handleSelectRegion({ ...r, displayName })}
                        title={`Click to inspect cities in ${displayName}`}
                      >
                        <div className="region-card-top">
                          <span className="region-badge">#{r.rank || idx + 1} {r.region}</span>
                          <span className="region-clicks">{r.totalClicks} {r.totalClicks === 1 ? "visit" : "visits"}</span>
                        </div>
                        <div className="region-card-name">{displayName}</div>
                        <div className="region-card-metrics">
                          <span>📱 {r.qrClicks} QR ({r.qrPercentage}%)</span>
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
                    Visits from this nation were recorded at the national network gateway level.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* LEVEL 2: STATE LEVEL DRILL-DOWN */}
          {drillLevel === "state" && (
            <div className="drilldown-state-content">
              <div className="drilldown-section-header">
                <h4>Cities in {selectedRegion.displayName}</h4>
                <p>Metropolitan locations generating traffic in this state</p>
              </div>

              {stateCities.length > 0 ? (
                <div className="cities-cards-grid">
                  {stateCities.map((c, idx) => (
                    <div
                      key={`${c.city}-${idx}`}
                      className="city-card-btn"
                      onClick={() => handleSelectCity(c)}
                      title={`Click to view city traffic breakdown for ${c.city}`}
                    >
                      <div className="city-card-header">
                        <strong className="city-name">{c.city}</strong>
                        <span className="city-pill">{c.totalClicks} {c.totalClicks === 1 ? "visit" : "visits"}</span>
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
                    Traffic was recorded at the state/regional network node level.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* LEVEL 3: CITY LEVEL DRILL-DOWN */}
          {drillLevel === "city" && (
            <div className="drilldown-city-content">
              <div className="city-detail-box">
                <h4>City Traffic Analytics: {selectedCity.city}</h4>
                <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                  Traffic distribution for {selectedCity.city},{" "}
                  {getStateDisplayName(selectedCity.countryCode, selectedCity.region)}, {selectedCity.country}
                </p>

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
                    <span>📱 QR Scans: <strong>{selectedCity.qrClicks}</strong></span>
                    <span>🌐 Direct Visits: <strong>{selectedCity.directClicks}</strong></span>
                    <span>Total Visits: <strong>{selectedCity.totalClicks}</strong></span>
                  </div>
                </div>

                {/* Requirement 3: Clearly label city information as approximate because IP geolocation is not GPS */}
                <div className="city-geo-accuracy-notice">
                  <span className="notice-icon" style={{ fontSize: "16px" }}>ℹ️</span>
                  <div className="notice-content">
                    <strong>Approximate Location Notice:</strong>
                    <span>
                      City-level information is estimated from visitor IP network routing and carrier data gateways (CGNAT).
                      IP geolocation is network-based and is not device GPS.
                    </span>
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
      .on("mouseenter", function () {
        d3.select(this).attr("stroke", "#38BDF8").attr("stroke-width", 2.2);
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
