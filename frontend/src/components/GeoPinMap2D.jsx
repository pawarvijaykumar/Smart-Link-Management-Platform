// =============================================================================
// Component: GeoPinMap2D
// Interactive 2D World Location Pin Map with Natural Earth projection,
// controlled subtle markers, click selection, and pause controls.
// =============================================================================

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import world50mData from "world-atlas/countries-50m.json";
import {
  NUMERIC_TO_ISO2,
  COUNTRY_NAME_TO_ISO2,
  getCountryFlagEmoji,
  formatCountryDisplayName,
} from "../data/geoLookup.js";
import { Plus, Minus, RotateCcw } from "lucide-react";

// Known coordinates for top metropolitan areas across the globe [Longitude, Latitude]
const KNOWN_CITY_COORDINATES = {
  // India
  bengaluru: [77.5946, 12.9716],
  bangalore: [77.5946, 12.9716],
  mumbai: [72.8777, 19.076],
  delhi: [77.1025, 28.7041],
  "new delhi": [77.209, 28.6139],
  hyderabad: [78.4867, 17.385],
  chennai: [80.2707, 13.0827],
  pune: [73.8567, 18.5204],
  kolkata: [88.3639, 22.5726],
  ahmedabad: [72.5714, 23.0225],
  jaipur: [75.7873, 26.9124],
  surat: [72.8311, 21.1702],
  lucknow: [80.9462, 26.8467],
  chandigarh: [76.7794, 30.7333],
  kochi: [76.2673, 9.9312],
  coimbatore: [76.9558, 11.0168],
  indore: [75.8577, 22.7196],
  nagpur: [79.0882, 21.1458],
  bhopal: [77.4126, 23.2599],
  visakhapatnam: [83.2185, 17.6868],
  patna: [85.1376, 25.5941],
  vadodara: [73.1812, 22.3072],
  ghaziabad: [77.4538, 28.6692],
  ludhiana: [75.8573, 30.901],
  agra: [78.0081, 27.1767],
  nashik: [73.7898, 19.9975],
  varanasi: [82.9739, 25.3176],
  srinagar: [74.7973, 34.0837],
  amritsar: [74.8723, 31.634],
  prayagraj: [81.8463, 25.4358],
  ranchi: [85.3096, 23.3441],
  howrah: [88.2636, 22.5958],
  jabalpur: [79.9864, 23.1815],
  gwalior: [78.1828, 26.2183],
  vijayawada: [80.648, 16.5062],
  jodhpur: [73.0243, 26.2389],
  madurai: [78.1198, 9.9252],
  raipur: [81.6296, 21.2514],
  kota: [75.8648, 25.2138],
  guwahati: [91.7362, 26.1445],
  mysuru: [76.6394, 12.2958],
  mysore: [76.6394, 12.2958],
  noida: [77.391, 28.5355],
  gurgaon: [77.0266, 28.4595],
  gurugram: [77.0266, 28.4595],

  // Global Metros
  "new york": [-74.006, 40.7128],
  "san francisco": [-122.4194, 37.7749],
  "los angeles": [-118.2437, 34.0522],
  chicago: [-87.6298, 41.8781],
  houston: [-95.3698, 29.7604],
  seattle: [-122.3321, 47.6062],
  austin: [-97.7431, 30.2672],
  boston: [-71.0589, 42.3601],
  miami: [-80.1918, 25.7617],
  toronto: [-79.3832, 43.6532],
  vancouver: [-123.1207, 49.2827],
  london: [-0.1276, 51.5074],
  paris: [2.3522, 48.8566],
  berlin: [13.405, 52.52],
  amsterdam: [4.9041, 52.3676],
  dublin: [-6.2603, 53.3498],
  madrid: [-3.7038, 40.4168],
  rome: [12.4964, 41.9028],
  tokyo: [139.6917, 35.6895],
  singapore: [103.8198, 1.3521],
  sydney: [151.2093, -33.8688],
  melbourne: [144.9631, -37.8136],
  dubai: [55.2708, 25.2048],
  seoul: [126.978, 37.5665],
};

export default function GeoPinMap2D({
  topCountries = [],
  topCities = [],
  summary = null,
  isPaused = false,
  selectedCountry = null,
  onSelectCountry = null,
  selectedCity = null,
  onSelectCity = null,
  onClearSelection = null,
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomBehaviorRef = useRef(null);

  const [currentZoom, setCurrentZoom] = useState(1);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Map dimensions
  const width = 960;
  const height = 480;

  // Extract TopoJSON country features
  const countriesGeo = useMemo(() => {
    return topojson.feature(world50mData, world50mData.objects.countries);
  }, []);

  // Country Code -> Country Analytics Map
  const countryMetricsMap = useMemo(() => {
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

  // Max visits for marker scaling
  const maxCountryClicks = useMemo(() => {
    return topCountries.reduce((max, c) => Math.max(max, c.totalClicks || 0), 1);
  }, [topCountries]);

  const maxCityClicks = useMemo(() => {
    return topCities.reduce((max, c) => Math.max(max, c.totalClicks || 0), 1);
  }, [topCities]);

  // D3 Projection & Path Generator (Natural Earth 1)
  const { projection, pathGenerator, graticulePath } = useMemo(() => {
    const proj = d3
      .geoNaturalEarth1()
      .scale(168)
      .translate([width / 2, height / 2 + 10]);
    const pathGen = d3.geoPath().projection(proj);
    const grat = d3.geoGraticule().step([20, 20])();
    return { projection: proj, pathGenerator: pathGen, graticulePath: pathGen(grat) };
  }, [width, height]);

  // Attach D3 Zoom and Pan (Double-click zoom disabled so clicks never cause movement)
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .filter((event) => {
        // Disallow double-click from triggering zoom
        if (event.type === "dblclick") return false;
        return !event.ctrlKey && !event.button;
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setCurrentZoom(event.transform.k);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    return () => {
      svg.on(".zoom", null);
      svg.on("dblclick.zoom", null);
    };
  }, []);

  // Zoom Button Controls
  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 1.4);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 1 / 1.4);
    }
  }, []);

  const handleResetZoom = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(450)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  }, []);

  // Helper: Find country traffic data for a feature
  const getFeatureCountryData = useCallback(
    (feature) => {
      if (!feature) return null;
      const numId = String(feature.id).padStart(3, "0");
      const iso2 = NUMERIC_TO_ISO2[numId];
      if (iso2 && countryMetricsMap.has(iso2)) {
        return countryMetricsMap.get(iso2);
      }
      const rawName = feature.properties?.name;
      if (rawName) {
        const normIso = COUNTRY_NAME_TO_ISO2[rawName.toLowerCase()];
        if (normIso && countryMetricsMap.has(normIso)) {
          return countryMetricsMap.get(normIso);
        }
        if (countryMetricsMap.has(rawName.toLowerCase())) {
          return countryMetricsMap.get(rawName.toLowerCase());
        }
      }
      return null;
    },
    [countryMetricsMap]
  );

  // Helper: Calculate centroid of feature and project to coordinates
  const getFeatureCentroidPos = useCallback(
    (feature) => {
      try {
        const centroid = d3.geoCentroid(feature);
        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          return projection(centroid);
        }
      } catch (_) {}
      return null;
    },
    [projection]
  );

  // Precomputed Country Features List with geometry paths and display names
  const countryFeaturesList = useMemo(() => {
    if (!countriesGeo?.features) return [];
    return countriesGeo.features.map((feature, idx) => {
      const numId = String(feature.id).padStart(3, "0");
      const iso2 = NUMERIC_TO_ISO2[numId] || null;
      const rawName = feature.properties?.name || "Unknown";
      const displayName = formatCountryDisplayName(rawName);
      const data = getFeatureCountryData(feature);
      const isVisited = !!(data && data.totalClicks > 0);
      const pathD = pathGenerator(feature) || "";
      return {
        feature,
        idx,
        numId,
        iso2,
        rawName,
        displayName,
        data,
        isVisited,
        pathD,
      };
    });
  }, [countriesGeo, getFeatureCountryData, pathGenerator]);

  // Find currently selected country feature for persistent highlight
  const selectedCountryFeature = useMemo(() => {
    if (!selectedCountry || !countryFeaturesList) return null;
    const targetCode = selectedCountry.countryCode?.toUpperCase();
    const targetName = selectedCountry.country?.toLowerCase();
    return countryFeaturesList.find(
      (item) =>
        (targetCode && item.iso2 && item.iso2.toUpperCase() === targetCode) ||
        (targetName &&
          (item.displayName.toLowerCase() === targetName ||
            item.rawName.toLowerCase() === targetName))
    );
  }, [selectedCountry, countryFeaturesList]);

  // Compute Country Pin Beacons with controlled small size (3.5px - 5.5px)
  const countryPins = useMemo(() => {
    const pins = [];
    if (!countriesGeo?.features) return pins;

    for (const feature of countriesGeo.features) {
      const data = getFeatureCountryData(feature);
      if (data && data.totalClicks > 0) {
        const pos = getFeatureCentroidPos(feature);
        if (pos) {
          const ratio = maxCountryClicks > 0 ? Math.sqrt(data.totalClicks / maxCountryClicks) : 0;
          // Strict small controlled range: 3.5px to 5.5px
          const radius = Number((3.5 + ratio * 2.0).toFixed(1));
          pins.push({
            id: `country-pin-${data.countryCode || feature.id}`,
            type: "country",
            name: data.country,
            countryCode: data.countryCode,
            totalClicks: data.totalClicks,
            qrClicks: data.qrClicks || 0,
            directClicks: data.directClicks || 0,
            percentage: data.percentage || 0,
            x: pos[0],
            y: pos[1],
            radius,
            rawFeature: feature,
            rawData: data,
          });
        }
      }
    }
    return pins;
  }, [countriesGeo, getFeatureCountryData, getFeatureCentroidPos, maxCountryClicks]);

  // Compute City Pin Beacons with controlled small size (2.5px - 4.0px)
  const cityPins = useMemo(() => {
    const pins = [];
    for (const city of topCities) {
      if (!city.city || city.city.toLowerCase() === "unknown") continue;
      const key = city.city.toLowerCase().trim();
      let coords = KNOWN_CITY_COORDINATES[key];

      // If city coordinates are not explicitly listed, approximate near country centroid
      if (!coords && city.countryCode) {
        const countryFeature = countriesGeo?.features?.find((f) => {
          const numId = String(f.id).padStart(3, "0");
          return NUMERIC_TO_ISO2[numId] === city.countryCode.toUpperCase();
        });
        if (countryFeature) {
          try {
            coords = d3.geoCentroid(countryFeature);
          } catch (_) {}
        }
      }

      if (coords) {
        const pos = projection(coords);
        if (pos) {
          const ratio = maxCityClicks > 0 ? Math.sqrt(city.totalClicks / maxCityClicks) : 0;
          // Strict small controlled range: 2.5px to 4.0px
          const radius = Number((2.5 + ratio * 1.5).toFixed(1));
          pins.push({
            id: `city-pin-${city.city}-${city.countryCode || ""}`,
            type: "city",
            name: city.city,
            region: city.region,
            country: city.country,
            countryCode: city.countryCode,
            totalClicks: city.totalClicks,
            qrClicks: city.qrClicks || 0,
            directClicks: city.directClicks || 0,
            percentage: city.percentage || 0,
            x: pos[0],
            y: pos[1],
            radius,
            rawData: city,
          });
        }
      }
    }
    return pins;
  }, [topCities, countriesGeo, projection, maxCityClicks]);

  // Expose test hooks for automated verification
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__geoMap2D = {
        projection,
        svgRef,
        gRef,
        countryFeaturesList,
        countryPins,
        cityPins,
      };
    }
    return () => {
      try {
        delete window.__geoMap2D;
      } catch (_) {}
    };
  }, [projection, countryFeaturesList, countryPins, cityPins]);

  // Tooltip positioning helper
  const updateTooltipPosition = useCallback((clientX, clientY, isMarker = false) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const maxX = isMarker ? rect.width - 240 : rect.width - 200;
    const maxY = isMarker ? rect.height - 180 : rect.height - 50;
    const x = Math.min(Math.max(12, clientX - rect.left + 14), maxX);
    const y = Math.min(Math.max(12, clientY - rect.top - 20), maxY);
    setTooltipPos({ x, y });
  }, []);

  // Country hover handlers
  const handleCountryMouseEnter = useCallback(
    (item, e) => {
      setHoveredMarker(null);
      setHoveredCountry(item);
      updateTooltipPosition(e.clientX, e.clientY, false);
    },
    [updateTooltipPosition]
  );

  const handleCountryMouseMove = useCallback(
    (e) => {
      updateTooltipPosition(e.clientX, e.clientY, false);
    },
    [updateTooltipPosition]
  );

  const handleCountryMouseLeave = useCallback(() => {
    setHoveredCountry(null);
  }, []);

  // Country click handler (works for any country, visited or zero clicks)
  const handleCountryPathClick = useCallback(
    (item) => {
      setHoveredCountry(null);
      setHoveredMarker(null);
      const cur = selectedCountry;
      const isAlreadySelected =
        cur &&
        ((item.iso2 && cur.countryCode?.toUpperCase() === item.iso2.toUpperCase()) ||
          (cur.country && cur.country.toLowerCase() === item.displayName.toLowerCase()));

      if (isAlreadySelected) {
        onClearSelection?.();
      } else if (item.data && item.data.totalClicks > 0) {
        onSelectCountry?.(item.data);
      } else {
        onSelectCountry?.({
          country: item.displayName,
          countryCode: item.iso2 || "",
          totalClicks: 0,
          directClicks: 0,
          qrClicks: 0,
          percentage: 0,
        });
      }
    },
    [selectedCountry, onSelectCountry, onClearSelection]
  );

  // Marker hover & click handlers
  const handleMarkerMouseEnter = useCallback(
    (pin, e) => {
      e.stopPropagation();
      setHoveredCountry(null);
      setHoveredMarker(pin);
      updateTooltipPosition(e.clientX, e.clientY, true);
    },
    [updateTooltipPosition]
  );

  const handleMarkerMouseMove = useCallback(
    (e) => {
      e.stopPropagation();
      updateTooltipPosition(e.clientX, e.clientY, true);
    },
    [updateTooltipPosition]
  );

  const handleMarkerMouseLeave = useCallback(() => {
    setHoveredMarker(null);
  }, []);

  const handlePinClick = useCallback(
    (pin) => {
      setHoveredCountry(null);
      setHoveredMarker(null);
      if (pin.type === "country") {
        const cur = selectedCountry;
        if (
          cur &&
          ((cur.countryCode && cur.countryCode.toUpperCase() === pin.countryCode?.toUpperCase()) ||
            (cur.country && cur.country.toLowerCase() === pin.name?.toLowerCase()))
        ) {
          onClearSelection?.();
        } else {
          onSelectCountry?.(pin.rawData);
        }
      } else if (pin.type === "city") {
        const cur = selectedCity;
        if (cur && cur.city && cur.city.toLowerCase() === pin.name?.toLowerCase()) {
          onClearSelection?.();
        } else {
          onSelectCity?.(pin.rawData);
        }
      }
    },
    [selectedCountry, selectedCity, onSelectCountry, onSelectCity, onClearSelection]
  );

  // Canvas background click clears selection
  const handleCanvasClick = useCallback(
    (e) => {
      if (
        e.target === svgRef.current ||
        e.target.classList.contains("geo-graticule-path") ||
        e.target.tagName === "svg"
      ) {
        setHoveredCountry(null);
        setHoveredMarker(null);
        onClearSelection?.();
      }
    },
    [onClearSelection]
  );

  return (
    <div
      ref={containerRef}
      className={`geo-map-viewport ${isPaused ? "is-paused" : ""}`}
      onMouseLeave={() => {
        setHoveredCountry(null);
        setHoveredMarker(null);
      }}
      style={{ position: "relative" }}
    >
      {/* Zoom Control Toolbar */}
      <div className="geo-map-zoom-toolbar" role="toolbar" aria-label="Map navigation controls">
        <button
          type="button"
          className="geo-map-zoom-btn"
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom in on map"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          className="geo-map-zoom-btn"
          onClick={handleZoomOut}
          disabled={currentZoom <= 1}
          title="Zoom Out"
          aria-label="Zoom out on map"
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          className="geo-map-zoom-btn"
          onClick={handleResetZoom}
          disabled={currentZoom === 1}
          title="Reset View"
          aria-label="Reset map view"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Interactive SVG World Map Canvas */}
      <svg
        ref={svgRef}
        className="geo-map-svg"
        viewBox={`0 0 ${width} ${height}`}
        style={{ cursor: "grab" }}
        onClick={handleCanvasClick}
      >
        <defs>
          {/* Subtle Glow Filter for small markers */}
          <filter id="geo-beacon-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.0" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g ref={gRef}>
          {/* Graticule Grid */}
          {graticulePath && (
            <path
              className="geo-graticule-path"
              d={graticulePath}
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="0.5"
            />
          )}

          {/* World Countries Layer */}
          <g className="geo-countries-layer">
            {countryFeaturesList.map((item) => {
              const isSelected =
                selectedCountry &&
                ((item.iso2 && selectedCountry.countryCode?.toUpperCase() === item.iso2.toUpperCase()) ||
                  (selectedCountry.country &&
                    selectedCountry.country.toLowerCase() === item.displayName.toLowerCase()));

              return (
                <path
                  key={`country-path-${item.numId || item.idx}`}
                  data-country-code={item.iso2 || ""}
                  data-country-name={item.displayName}
                  data-num-id={item.numId}
                  d={item.pathD}
                  className={`geo-country-vector ${item.isVisited ? "visited" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                  fill={item.isVisited ? (isSelected ? "#223147" : "#1A2230") : "#10151F"}
                  stroke={isSelected ? "#00F2FE" : item.isVisited ? "rgba(6, 182, 212, 0.45)" : "#222938"}
                  strokeWidth={isSelected ? 1.3 / currentZoom : item.isVisited ? 0.75 / currentZoom : 0.5 / currentZoom}
                  style={{
                    cursor: "pointer",
                    transition: "fill 0.18s ease, stroke 0.18s ease",
                  }}
                  onMouseEnter={(e) => handleCountryMouseEnter(item, e)}
                  onPointerEnter={(e) => handleCountryMouseEnter(item, e)}
                  onMouseMove={handleCountryMouseMove}
                  onPointerMove={handleCountryMouseMove}
                  onMouseLeave={handleCountryMouseLeave}
                  onPointerLeave={handleCountryMouseLeave}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCountryPathClick(item);
                  }}
                />
              );
            })}
          </g>

          {/* Persistent Selection Overlay Layer */}
          {selectedCountryFeature?.pathD && (
            <g className="geo-selection-highlight-layer" pointerEvents="none">
              <path
                d={selectedCountryFeature.pathD}
                fill="rgba(0, 242, 254, 0.06)"
                stroke="#10B981"
                strokeWidth={2.8 / currentZoom}
                strokeOpacity={0.75}
              />
              <path
                d={selectedCountryFeature.pathD}
                fill="none"
                stroke="#00F2FE"
                strokeWidth={1.8 / currentZoom}
                strokeOpacity={1.0}
              />
            </g>
          )}

          {/* Hover Highlight Overlay Layer */}
          {hoveredCountry?.pathD && (
            <g className="geo-hover-highlight-layer" pointerEvents="none">
              <path
                d={hoveredCountry.pathD}
                fill="rgba(56, 189, 248, 0.08)"
                stroke="#A855F7"
                strokeWidth={2.4 / currentZoom}
                strokeOpacity={0.65}
              />
              <path
                d={hoveredCountry.pathD}
                fill="none"
                stroke="#38BDF8"
                strokeWidth={1.4 / currentZoom}
                strokeOpacity={0.95}
              />
            </g>
          )}

          {/* Country Location Pin Beacons (Controlled Small Size) */}
          <g className="geo-country-pins-layer">
            {countryPins.map((pin) => {
              const isSelected =
                selectedCountry &&
                (selectedCountry.countryCode === pin.countryCode ||
                  selectedCountry.country === pin.name);

              return (
                <g
                  key={pin.id}
                  data-pin-type="country"
                  data-pin-code={pin.countryCode}
                  data-pin-name={pin.name}
                  className={`geo-pin-beacon ${isSelected ? "is-selected" : ""}`}
                  transform={`translate(${pin.x}, ${pin.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePinClick(pin);
                  }}
                  onMouseEnter={(e) => handleMarkerMouseEnter(pin, e)}
                  onPointerEnter={(e) => handleMarkerMouseEnter(pin, e)}
                  onMouseMove={handleMarkerMouseMove}
                  onPointerMove={handleMarkerMouseMove}
                  onMouseLeave={handleMarkerMouseLeave}
                  onPointerLeave={handleMarkerMouseLeave}
                  style={{ cursor: "pointer" }}
                >
                  {/* Subtle Aura Ring */}
                  <circle
                    className="geo-pin-aura"
                    r={pin.radius + 1.8}
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="0.8"
                  />

                  {/* Subtle Selection Halo Ring */}
                  {isSelected && (
                    <circle
                      className="geo-pin-selected-ring"
                      r={pin.radius + 2.8}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="1.2"
                    />
                  )}

                  {/* Clean Location Pin Core */}
                  <circle
                    className="geo-pin-core"
                    r={pin.radius}
                    fill="#06B6D4"
                    stroke="#FFFFFF"
                    strokeWidth="0.75"
                    filter="url(#geo-beacon-glow)"
                  />
                  {/* Inner Crisp Dot */}
                  <circle r={Math.max(1, pin.radius * 0.35)} fill="#FFFFFF" />
                </g>
              );
            })}
          </g>

          {/* City Location Pin Beacons (Controlled Small Size) */}
          <g className="geo-city-pins-layer">
            {cityPins.map((pin) => {
              const isSelected =
                selectedCity && selectedCity.city === pin.name;

              return (
                <g
                  key={pin.id}
                  data-pin-type="city"
                  data-pin-name={pin.name}
                  className={`geo-pin-beacon city-beacon ${isSelected ? "is-selected" : ""}`}
                  transform={`translate(${pin.x}, ${pin.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePinClick(pin);
                  }}
                  onMouseEnter={(e) => handleMarkerMouseEnter(pin, e)}
                  onPointerEnter={(e) => handleMarkerMouseEnter(pin, e)}
                  onMouseMove={handleMarkerMouseMove}
                  onPointerMove={handleMarkerMouseMove}
                  onMouseLeave={handleMarkerMouseLeave}
                  onPointerLeave={handleMarkerMouseLeave}
                  style={{ cursor: "pointer" }}
                >
                  {/* Subtle Aura Ring */}
                  <circle
                    className="geo-city-aura"
                    r={pin.radius + 1.5}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="0.7"
                  />

                  {/* Subtle Selection Halo Ring */}
                  {isSelected && (
                    <circle
                      className="geo-city-selected-ring"
                      r={pin.radius + 2.4}
                      fill="none"
                      stroke="#FDE68A"
                      strokeWidth="1.1"
                    />
                  )}

                  {/* Clean City Pin Core */}
                  <circle
                    className="geo-city-core"
                    r={pin.radius}
                    fill="#F59E0B"
                    stroke="#FFFFFF"
                    strokeWidth="0.6"
                    filter="url(#geo-beacon-glow)"
                  />
                  {/* Inner Crisp Dot */}
                  <circle r={Math.max(0.8, pin.radius * 0.35)} fill="#090B10" />
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* 1. Country Surface Hover Tooltip (Compact floating badge near cursor) */}
      {hoveredCountry && !hoveredMarker && (
        <div
          className="geo-country-hover-tooltip"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ fontSize: "14px" }}>
              {getCountryFlagEmoji(hoveredCountry.iso2)}
            </span>
            <span style={{ fontWeight: 600 }}>
              {hoveredCountry.displayName}
            </span>
            {hoveredCountry.data && hoveredCountry.data.totalClicks > 0 ? (
              <span className="geo-country-hover-badge">
                {hoveredCountry.data.totalClicks} {hoveredCountry.data.totalClicks === 1 ? "click" : "clicks"}
              </span>
            ) : (
              <span className="geo-country-hover-hint">
                (0 visits)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2. Marker Hover Tooltip Card (Rich metrics card for pins) */}
      {hoveredMarker && (
        <div
          className="geo-tooltip-card"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          <div className="geo-tooltip-header">
            <span>{getCountryFlagEmoji(hoveredMarker.countryCode)}</span>
            <span>{hoveredMarker.name}</span>
            {hoveredMarker.type === "city" && (
              <span style={{ fontSize: "10.5px", color: "#F59E0B", marginLeft: "auto", fontWeight: 600 }}>
                {hoveredMarker.country ? `${hoveredMarker.country}` : "City"}
              </span>
            )}
            {hoveredMarker.type === "country" && (
              <span style={{ fontSize: "10.5px", color: "#06B6D4", marginLeft: "auto", fontWeight: 600 }}>
                Country
              </span>
            )}
          </div>

          {hoveredMarker.type === "city" && hoveredMarker.country && (
            <div className="geo-tooltip-row">
              <span>Country</span>
              <strong>{hoveredMarker.country}</strong>
            </div>
          )}

          <div className="geo-tooltip-row">
            <span>Total Visits</span>
            <strong>{hoveredMarker.totalClicks}</strong>
          </div>

          <div className="geo-tooltip-row">
            <span>Direct Visits</span>
            <strong>{hoveredMarker.directClicks}</strong>
          </div>

          <div className="geo-tooltip-row">
            <span>QR Code Scans</span>
            <strong>{hoveredMarker.qrClicks}</strong>
          </div>

          {hoveredMarker.percentage > 0 && (
            <div className="geo-tooltip-row">
              <span>Traffic Share</span>
              <strong>{hoveredMarker.percentage}%</strong>
            </div>
          )}

          <div className="geo-tooltip-hint">Click marker to inspect details</div>
        </div>
      )}
    </div>
  );
}
