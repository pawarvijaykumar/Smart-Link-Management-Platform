// =============================================================================
// Component: GeoGlobe3D
// Premium Interactive 3D Earth Globe for Geo Analytics
// Real Earth geography, country borders, continent dots, controlled markers,
// manual drag/zoom controls, subtle atmospheric glow, and complete WebGL cleanup.
// =============================================================================

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import world50mData from "world-atlas/countries-50m.json";
import globeDots from "../data/globeDots.json";
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

// Convert Lat/Lon to 3D Sphere Vector
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Convert 3D Sphere Vector back to [lon, lat]
function vector3ToLatLon(v, radius) {
  const phi = Math.acos(Math.max(-1, Math.min(1, v.y / radius)));
  const lat = 90 - (phi * 180 / Math.PI);
  let lon = (Math.atan2(v.z, -v.x) * 180 / Math.PI) - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return [lon, lat];
}

export default function GeoGlobe3D({
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
  const canvasRef = useRef(null);
  const globeGroupRef = useRef(null);

  // Extract TopoJSON country features
  const countriesGeo = useMemo(() => {
    return topojson.feature(world50mData, world50mData.objects.countries);
  }, []);

  // Precomputed indexed features with bounding boxes and line buffer Float32Arrays
  const { indexedFeatures, coordsMap } = useMemo(() => {
    const GLOBE_RADIUS = 1.45;
    const coords = new Map();
    const indexed = [];

    for (const feature of countriesGeo.features) {
      const idStr = String(feature.id).padStart(3, "0");
      const iso2 = NUMERIC_TO_ISO2[idStr] || null;
      const rawName = feature.properties?.name || "Unknown";
      const displayName = formatCountryDisplayName(rawName);

      // Bounding box for fast filtering
      const bounds = d3.geoBounds(feature);

      indexed.push({
        feature,
        bounds,
        id: feature.id,
        idStr,
        iso2,
        rawName,
        displayName,
      });

      // Extract rings for line segments
      const rings =
        feature.geometry.type === "Polygon"
          ? feature.geometry.coordinates
          : feature.geometry.type === "MultiPolygon"
          ? feature.geometry.coordinates.flat(1)
          : [];
      const linePts = [];
      for (const ring of rings) {
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = ring[i];
          const p2 = ring[i + 1];
          const v1 = latLonToVector3(p1[1], p1[0], GLOBE_RADIUS * 1.004);
          const v2 = latLonToVector3(p2[1], p2[0], GLOBE_RADIUS * 1.004);
          linePts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
        }
      }
      coords.set(idStr, new Float32Array(linePts));
    }

    return { indexedFeatures: indexed, coordsMap: coords };
  }, [countriesGeo]);

  // Fast country lookup for a given [lon, lat]
  const findCountry = useCallback(
    (lon, lat) => {
      for (let i = 0; i < indexedFeatures.length; i++) {
        const item = indexedFeatures[i];
        const [[minLon, minLat], [maxLon, maxLat]] = item.bounds;
        if (minLon <= maxLon) {
          if (lon < minLon || lon > maxLon) continue;
        } else {
          if (lon > maxLon && lon < minLon) continue;
        }
        if (lat < minLat || lat > maxLat) continue;

        if (d3.geoContains(item.feature, [lon, lat])) {
          return item;
        }
      }
      return null;
    },
    [indexedFeatures]
  );

  // Initial orientation: prioritize top visitor country (e.g. India) so pins are immediately visible on load
  const initialOrientation = useMemo(() => {
    let targetLon = 78.96; // Default to India / Asia
    let targetLat = 20.59;
    if (topCountries && topCountries.length > 0 && topCountries[0].countryCode) {
      const topCode = topCountries[0].countryCode.toUpperCase();
      const feature = countriesGeo?.features?.find(
        (f) => NUMERIC_TO_ISO2[String(f.id).padStart(3, "0")] === topCode
      );
      if (feature) {
        try {
          const [lon, lat] = d3.geoCentroid(feature);
          targetLon = lon;
          targetLat = lat;
        } catch (_) {}
      }
    }
    const rotY = (1.5 * Math.PI) - (targetLon * Math.PI) / 180;
    const rotX = Math.max(-0.6, Math.min(0.6, (targetLat * Math.PI) / 180 * 0.85));
    return { rotX, rotY };
  }, [topCountries, countriesGeo]);

  const initializedOrientationRef = useRef(false);
  const targetRotationXRef = useRef(initialOrientation.rotX);
  const targetRotationYRef = useRef(initialOrientation.rotY);
  const targetCameraZRef = useRef(3.8);

  const selectedCountryRef = useRef(selectedCountry);
  selectedCountryRef.current = selectedCountry;

  const selectedCityRef = useRef(selectedCity);
  selectedCityRef.current = selectedCity;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const topCountriesRef = useRef(topCountries);
  topCountriesRef.current = topCountries;

  const onSelectCountryRef = useRef(onSelectCountry);
  onSelectCountryRef.current = onSelectCountry;

  const onSelectCityRef = useRef(onSelectCity);
  onSelectCityRef.current = onSelectCity;

  const onClearSelectionRef = useRef(onClearSelection);
  onClearSelectionRef.current = onClearSelection;

  const updateSelectionVisualsRef = useRef(null);

  useEffect(() => {
    if (!initializedOrientationRef.current && initialOrientation) {
      targetRotationXRef.current = initialOrientation.rotX;
      targetRotationYRef.current = initialOrientation.rotY;
      if (globeGroupRef.current) {
        globeGroupRef.current.rotation.x = initialOrientation.rotX;
        globeGroupRef.current.rotation.y = initialOrientation.rotY;
      }
      initializedOrientationRef.current = true;
    }
  }, [initialOrientation]);

  // Separate hover states for country surface vs location markers
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Helper to match traffic data for hovered country
  const hoveredCountryData = useMemo(() => {
    if (!hoveredCountry) return null;
    const iso = hoveredCountry.iso2?.toUpperCase();
    if (iso) {
      const match = topCountries.find((c) => c.countryCode?.toUpperCase() === iso);
      if (match) return match;
    }
    const name = hoveredCountry.displayName?.toLowerCase();
    if (name) {
      const match = topCountries.find(
        (c) =>
          c.country?.toLowerCase() === name ||
          c.country?.toLowerCase() === hoveredCountry.rawName?.toLowerCase()
      );
      if (match) return match;
    }
    return null;
  }, [hoveredCountry, topCountries]);

  // Visited country ISO set
  const visitedIsoSet = useMemo(() => {
    const set = new Set();
    for (const c of topCountries) {
      if (c.countryCode) set.add(c.countryCode.toUpperCase());
      if (c.country) {
        const norm = COUNTRY_NAME_TO_ISO2[c.country.toLowerCase()];
        if (norm) set.add(norm.toUpperCase());
      }
    }
    return set;
  }, [topCountries]);

  // Set of country numeric codes from visited countries
  const visitedNumericSet = useMemo(() => {
    const set = new Set();
    for (const [numId, iso] of Object.entries(NUMERIC_TO_ISO2)) {
      if (visitedIsoSet.has(iso.toUpperCase())) {
        set.add(numId);
      }
    }
    return set;
  }, [visitedIsoSet]);

  // Max visits for marker scaling
  const maxCountryClicks = useMemo(() => {
    return topCountries.reduce((max, c) => Math.max(max, c.totalClicks || 0), 1);
  }, [topCountries]);

  const maxCityClicks = useMemo(() => {
    return topCities.reduce((max, c) => Math.max(max, c.totalClicks || 0), 1);
  }, [topCities]);

  // Zoom Button Controls
  const handleZoomIn = useCallback(() => {
    targetCameraZRef.current = Math.max(2.2, targetCameraZRef.current - 0.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    targetCameraZRef.current = Math.min(5.5, targetCameraZRef.current + 0.5);
  }, []);

  const handleReset = useCallback(() => {
    targetRotationXRef.current = initialOrientation.rotX;
    targetRotationYRef.current = initialOrientation.rotY;
    targetCameraZRef.current = 3.8;
  }, [initialOrientation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Dimensions
    let width = container.clientWidth || 960;
    let height = 480;

    // 1. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.8);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.className = "geo-globe-canvas";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = `${height}px`;
    canvas.style.cursor = "grab";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    // Group for all rotating objects
    const globeGroup = new THREE.Group();
    globeGroup.rotation.x = targetRotationXRef.current;
    globeGroup.rotation.y = targetRotationYRef.current;
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    if (typeof window !== "undefined") {
      window.__geoGlobeScene = {
        globeGroup,
        camera,
        canvas,
        scene,
        targetRotationXRef,
        targetRotationYRef,
        targetCameraZRef,
      };
    }

    const GLOBE_RADIUS = 1.45;

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xb4d2ff, 1.4);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 0.8, 15);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);

    // 3. Deep Navy Ocean Sphere
    const oceanGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const oceanMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color("#0A1124"),
      emissive: new THREE.Color("#030712"),
      specular: new THREE.Color("#1E3A8A"),
      shininess: 28,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    globeGroup.add(oceanMesh);

    // 4. Atmospheric Fresnel Glow Halo
    const atmGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.018, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float intensity = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.4);
          gl_FragColor = vec4(glowColor, intensity * 0.65);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color("#38BDF8") },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const atmMesh = new THREE.Mesh(atmGeo, atmMat);
    globeGroup.add(atmMesh);

    // 5. Continents (Halftone Land Dots from globeDots.json)
    const unvisitedPositions = [];
    const visitedPositions = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < globeDots.length; i++) {
      const [lon, lat, numId] = globeDots[i];
      const paddedId = String(numId).padStart(3, "0");
      const isVisited = visitedNumericSet.has(paddedId);

      const pos = latLonToVector3(lat, lon, GLOBE_RADIUS * 1.001);
      if (isVisited) visitedPositions.push(pos);
      else unvisitedPositions.push(pos);
    }

    if (unvisitedPositions.length > 0) {
      const dotGeo = new THREE.SphereGeometry(0.010, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#475569"),
        transparent: true,
        opacity: 0.38,
      });
      const unvisitedMesh = new THREE.InstancedMesh(dotGeo, dotMat, unvisitedPositions.length);
      for (let i = 0; i < unvisitedPositions.length; i++) {
        dummy.position.copy(unvisitedPositions[i]);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        unvisitedMesh.setMatrixAt(i, dummy.matrix);
      }
      unvisitedMesh.instanceMatrix.needsUpdate = true;
      globeGroup.add(unvisitedMesh);
    }

    if (visitedPositions.length > 0) {
      const dotGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#0E7490"),
        transparent: true,
        opacity: 0.85,
      });
      const visitedMesh = new THREE.InstancedMesh(dotGeo, dotMat, visitedPositions.length);
      for (let i = 0; i < visitedPositions.length; i++) {
        dummy.position.copy(visitedPositions[i]);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        visitedMesh.setMatrixAt(i, dummy.matrix);
      }
      visitedMesh.instanceMatrix.needsUpdate = true;
      globeGroup.add(visitedMesh);
    }

    // 6. Complete Country Borders (MultiLineString mesh from world-atlas)
    const countryMesh = topojson.mesh(world50mData, world50mData.objects.countries);
    const borderPoints = [];

    for (const line of countryMesh.coordinates) {
      for (let i = 0; i < line.length - 1; i++) {
        const p1 = line[i];
        const p2 = line[i + 1];
        const v1 = latLonToVector3(p1[1], p1[0], GLOBE_RADIUS * 1.002);
        const v2 = latLonToVector3(p2[1], p2[0], GLOBE_RADIUS * 1.002);
        borderPoints.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      }
    }

    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute("position", new THREE.Float32BufferAttribute(borderPoints, 3));
    const borderMat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#1E2D4A"),
      transparent: true,
      opacity: 0.65,
    });
    const borderSegments = new THREE.LineSegments(borderGeo, borderMat);
    globeGroup.add(borderSegments);

    // 7. Visited Countries' Borders (Cyan Highlighted)
    const visitedBorderPoints = [];
    for (const feature of countriesGeo.features) {
      const numId = String(feature.id).padStart(3, "0");
      if (visitedNumericSet.has(numId)) {
        const rings =
          feature.geometry.type === "Polygon"
            ? feature.geometry.coordinates
            : feature.geometry.type === "MultiPolygon"
            ? feature.geometry.coordinates.flat()
            : [];
        for (const ring of rings) {
          for (let i = 0; i < ring.length - 1; i++) {
            const p1 = ring[i];
            const p2 = ring[i + 1];
            const v1 = latLonToVector3(p1[1], p1[0], GLOBE_RADIUS * 1.003);
            const v2 = latLonToVector3(p2[1], p2[0], GLOBE_RADIUS * 1.003);
            visitedBorderPoints.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
          }
        }
      }
    }

    if (visitedBorderPoints.length > 0) {
      const visitedBorderGeo = new THREE.BufferGeometry();
      visitedBorderGeo.setAttribute("position", new THREE.Float32BufferAttribute(visitedBorderPoints, 3));
      const visitedBorderMat = new THREE.LineBasicMaterial({
        color: new THREE.Color("#06B6D4"),
        transparent: true,
        opacity: 0.9,
      });
      const visitedBorderSegments = new THREE.LineSegments(visitedBorderGeo, visitedBorderMat);
      globeGroup.add(visitedBorderSegments);
    }

    // 7.5. Dynamic Country Hover & Selection Meshes
    // Hover Border Mesh (Bright Sky Blue / Cyan)
    const hoverBorderGeo = new THREE.BufferGeometry();
    const hoverBorderMat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#38BDF8"),
      transparent: true,
      opacity: 0.95,
    });
    const hoverBorderMesh = new THREE.LineSegments(hoverBorderGeo, hoverBorderMat);
    hoverBorderMesh.scale.setScalar(1.000);
    hoverBorderMesh.visible = false;
    globeGroup.add(hoverBorderMesh);

    // Hover Glow Mesh (Purple atmospheric accent)
    const hoverGlowGeo = new THREE.BufferGeometry();
    const hoverGlowMat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#A855F7"),
      transparent: true,
      opacity: 0.65,
    });
    const hoverGlowMesh = new THREE.LineSegments(hoverGlowGeo, hoverGlowMat);
    hoverGlowMesh.scale.setScalar(1.0008);
    hoverGlowMesh.visible = false;
    globeGroup.add(hoverGlowMesh);

    // Selected Border Mesh (Electric Cyan)
    const selectedBorderGeo = new THREE.BufferGeometry();
    const selectedBorderMat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#00F2FE"),
      transparent: true,
      opacity: 1.0,
    });
    const selectedBorderMesh = new THREE.LineSegments(selectedBorderGeo, selectedBorderMat);
    selectedBorderMesh.scale.setScalar(1.0014);
    selectedBorderMesh.visible = false;
    globeGroup.add(selectedBorderMesh);

    // Selected Border Glow Mesh (Teal / Emerald accent)
    const selectedGlowGeo = new THREE.BufferGeometry();
    const selectedGlowMat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#10B981"),
      transparent: true,
      opacity: 0.75,
    });
    const selectedGlowMesh = new THREE.LineSegments(selectedGlowGeo, selectedGlowMat);
    selectedGlowMesh.scale.setScalar(1.0020);
    selectedGlowMesh.visible = false;
    globeGroup.add(selectedGlowMesh);

    // Selected Location Pin Halo Ring
    const selRingGeo = new THREE.RingGeometry(0.034, 0.046, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#00F2FE"),
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const markerSelectionRingMesh = new THREE.Mesh(selRingGeo, selRingMat);
    markerSelectionRingMesh.visible = false;
    globeGroup.add(markerSelectionRingMesh);

    // Dynamic selection visual updater (zero scene rebuild on click)
    updateSelectionVisualsRef.current = (selCountry, selCity) => {
      // 1. Update selected country borders
      if (selCountry) {
        let matchedItem = null;
        const targetCode = selCountry.countryCode?.toUpperCase();
        const targetName = selCountry.country?.toLowerCase();

        for (let i = 0; i < indexedFeatures.length; i++) {
          const item = indexedFeatures[i];
          if (targetCode && item.iso2 && item.iso2.toUpperCase() === targetCode) {
            matchedItem = item;
            break;
          }
          if (
            targetName &&
            (item.displayName.toLowerCase() === targetName ||
              item.rawName.toLowerCase() === targetName)
          ) {
            matchedItem = item;
            break;
          }
        }

        if (matchedItem) {
          const pts = coordsMap.get(matchedItem.idStr);
          if (pts && pts.length > 0) {
            selectedBorderMesh.geometry.dispose();
            const newGeo = new THREE.BufferGeometry();
            newGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
            selectedBorderMesh.geometry = newGeo;
            selectedBorderMesh.visible = true;

            selectedGlowMesh.geometry.dispose();
            const newGlowGeo = new THREE.BufferGeometry();
            newGlowGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
            selectedGlowMesh.geometry = newGlowGeo;
            selectedGlowMesh.visible = true;
          } else {
            selectedBorderMesh.visible = false;
            selectedGlowMesh.visible = false;
          }
        } else {
          selectedBorderMesh.visible = false;
          selectedGlowMesh.visible = false;
        }
      } else {
        selectedBorderMesh.visible = false;
        selectedGlowMesh.visible = false;
      }

      // 2. Update selected marker halo
      let markerFound = false;
      for (const mesh of markerClickMeshes) {
        const hit = mesh.userData;
        if (!hit || !hit.data) continue;
        const isCountryMatch =
          selCountry &&
          hit.type === "country" &&
          ((selCountry.countryCode &&
            hit.data.countryCode?.toUpperCase() === selCountry.countryCode.toUpperCase()) ||
            (selCountry.country &&
              hit.data.country?.toLowerCase() === selCountry.country.toLowerCase()));

        const isCityMatch =
          selCity &&
          hit.type === "city" &&
          selCity.city &&
          hit.data.city?.toLowerCase() === selCity.city.toLowerCase();

        if (isCountryMatch || isCityMatch) {
          const normal = mesh.position.clone().normalize();
          markerSelectionRingMesh.position.copy(
            mesh.position.clone().add(normal.multiplyScalar(0.002))
          );
          markerSelectionRingMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            normal
          );
          const r = mesh.geometry?.parameters?.radius || 0.025;
          const s = Math.max(1, r / 0.022);
          markerSelectionRingMesh.scale.set(s, s, s);
          markerSelectionRingMesh.visible = true;
          markerFound = true;
          break;
        }
      }
      if (!markerFound) {
        markerSelectionRingMesh.visible = false;
      }
    };

    // 8. Location Markers (Same real coordinates and controlled sizing as 2D Map)
    const markerClickMeshes = [];
    const auraRings = [];

    // Helper: Find country traffic data for a feature
    const getFeatureCountryData = (feature) => {
      const numId = String(feature.id).padStart(3, "0");
      const iso2 = NUMERIC_TO_ISO2[numId];
      if (iso2) {
        const match = topCountries.find((c) => c.countryCode?.toUpperCase() === iso2);
        if (match) return match;
      }
      const rawName = feature.properties?.name?.toLowerCase();
      if (rawName) {
        return topCountries.find(
          (c) => c.country?.toLowerCase() === rawName || COUNTRY_NAME_TO_ISO2[rawName] === c.countryCode
        );
      }
      return null;
    };

    // A. Country Markers (Centroid on GLOBE_RADIUS * 1.008)
    for (const feature of countriesGeo.features) {
      const countryData = getFeatureCountryData(feature);
      if (countryData && countryData.totalClicks > 0) {
        try {
          const centroid = d3.geoCentroid(feature);
          if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
            const pos = latLonToVector3(centroid[1], centroid[0], GLOBE_RADIUS * 1.008);
            const normal = pos.clone().normalize();

            const ratio = maxCountryClicks > 0 ? Math.sqrt(countryData.totalClicks / maxCountryClicks) : 0;
            // Strict small controlled radius: 0.022 to 0.036
            const radius = 0.022 + ratio * 0.014;

            // Core Pin Sphere (Cyan)
            const sphereGeo = new THREE.SphereGeometry(radius, 16, 16);
            const sphereMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color("#06B6D4"),
              emissive: new THREE.Color("#06B6D4"),
              emissiveIntensity: 0.8,
              roughness: 0.3,
            });
            const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
            sphereMesh.position.copy(pos);
            sphereMesh.userData = { type: "country", data: countryData };
            globeGroup.add(sphereMesh);

            // Invisible generous hit target for effortless hover/click
            const hitGeo = new THREE.SphereGeometry(Math.max(radius * 1.5, 0.038), 12, 12);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.copy(pos);
            hitMesh.userData = { type: "country", data: countryData };
            globeGroup.add(hitMesh);
            markerClickMeshes.push(hitMesh);

            // Subtle Aura Ring
            const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.7, 24);
            const ringMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color("#06B6D4"),
              transparent: true,
              opacity: 0.55,
              side: THREE.DoubleSide,
              depthWrite: false,
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(0.001)));
            ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            globeGroup.add(ringMesh);
            auraRings.push(ringMesh);
          }
        } catch (_) {}
      }
    }

    // B. City Markers (Real Coordinates on GLOBE_RADIUS * 1.012)
    for (const city of topCities) {
      if (!city.city || city.city.toLowerCase() === "unknown" || !city.totalClicks) continue;
      const key = city.city.toLowerCase().trim();
      let coords = KNOWN_CITY_COORDINATES[key];

      if (!coords && city.countryCode) {
        const countryFeature = countriesGeo.features.find((f) => {
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
        const pos = latLonToVector3(coords[1], coords[0], GLOBE_RADIUS * 1.012);
        const normal = pos.clone().normalize();

        const ratio = maxCityClicks > 0 ? Math.sqrt(city.totalClicks / maxCityClicks) : 0;
        // Strict small controlled radius: 0.016 to 0.026
        const radius = 0.016 + ratio * 0.010;

        // Core Pin Sphere (Amber / Purple)
        const sphereGeo = new THREE.SphereGeometry(radius, 16, 16);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#F59E0B"),
          emissive: new THREE.Color("#F59E0B"),
          emissiveIntensity: 0.8,
          roughness: 0.3,
        });
        const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
        sphereMesh.position.copy(pos);
        sphereMesh.userData = { type: "city", data: city };
        globeGroup.add(sphereMesh);

        // Invisible generous hit target for effortless hover/click
        const hitGeo = new THREE.SphereGeometry(Math.max(radius * 1.5, 0.036), 12, 12);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.position.copy(pos);
        hitMesh.userData = { type: "city", data: city };
        globeGroup.add(hitMesh);
        markerClickMeshes.push(hitMesh);

        // Subtle Aura Ring
        const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.7, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color("#F59E0B"),
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(0.001)));
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        globeGroup.add(ringMesh);
        auraRings.push(ringMesh);
      }
    }

    // Initialize selection visual state now that markerClickMeshes are registered
    updateSelectionVisualsRef.current(selectedCountryRef.current, selectedCityRef.current);

    // 9. Interaction Handlers: Drag, Zoom, Raycast Hover & Click
    let isPointerDown = false;
    let isDragging = false;
    let dragDistance = 0;
    let previousPointerPos = { x: 0, y: 0 };
    let isRunning = true;
    let rafId = null;
    let currentHoveredCountryId = null;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    const onPointerDown = (e) => {
      isPointerDown = true;
      isDragging = false;
      dragDistance = 0;
      previousPointerPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      if (isPointerDown) {
        const dx = e.clientX - previousPointerPos.x;
        const dy = e.clientY - previousPointerPos.y;
        dragDistance += Math.hypot(dx, dy);

        if (dragDistance > 4) {
          isDragging = true;
          canvas.style.cursor = "grabbing";
          targetRotationYRef.current += dx * 0.005;
          targetRotationXRef.current = Math.max(
            -1.1,
            Math.min(1.1, targetRotationXRef.current + dy * 0.005)
          );
          previousPointerPos = { x: e.clientX, y: e.clientY };

          // Hide hover tooltips and highlights while rotating
          setHoveredMarker(null);
          setHoveredCountry(null);
          if (currentHoveredCountryId !== null) {
            currentHoveredCountryId = null;
            hoverBorderMesh.visible = false;
            hoverGlowMesh.visible = false;
          }
        }
      } else {
        // Raycast against location markers first (highest priority)
        raycaster.setFromCamera(mouse, camera);
        const markerIntersects = raycaster.intersectObjects(markerClickMeshes, false);

        if (markerIntersects.length > 0) {
          const hit = markerIntersects[0].object.userData;
          setHoveredMarker({
            type: hit.type,
            name: hit.type === "city" ? hit.data.city : hit.data.country,
            country: hit.type === "city" ? (hit.data.country || "") : hit.data.country,
            countryCode: hit.data.countryCode,
            totalClicks: hit.data.totalClicks || 0,
            directClicks: hit.data.directClicks || 0,
            qrClicks: hit.data.qrClicks || 0,
            percentage: hit.data.percentage || 0,
          });
          setHoveredCountry(null);
          if (currentHoveredCountryId !== null) {
            currentHoveredCountryId = null;
            hoverBorderMesh.visible = false;
            hoverGlowMesh.visible = false;
          }
          setTooltipPos({
            x: Math.min(Math.max(12, e.clientX - rect.left + 14), width - 240),
            y: Math.min(Math.max(12, e.clientY - rect.top - 20), height - 190),
          });
          canvas.style.cursor = "pointer";
        } else {
          setHoveredMarker(null);

          // Raycast against ocean sphere to find surface coordinates
          const oceanIntersects = raycaster.intersectObject(oceanMesh, false);
          if (oceanIntersects.length > 0) {
            const hitPoint = oceanIntersects[0].point;
            const localPt = globeGroup.worldToLocal(hitPoint.clone());
            const [lon, lat] = vector3ToLatLon(localPt, GLOBE_RADIUS);
            const countryMatch = findCountry(lon, lat);

            if (countryMatch) {
              setHoveredCountry(countryMatch);
              setTooltipPos({
                x: Math.min(Math.max(12, e.clientX - rect.left + 14), width - 200),
                y: Math.min(Math.max(12, e.clientY - rect.top - 20), height - 50),
              });
              canvas.style.cursor = "pointer";

              if (countryMatch.idStr !== currentHoveredCountryId) {
                currentHoveredCountryId = countryMatch.idStr;
                const pts = coordsMap.get(countryMatch.idStr);
                if (pts && pts.length > 0) {
                  hoverBorderMesh.geometry.dispose();
                  const newGeo = new THREE.BufferGeometry();
                  newGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
                  hoverBorderMesh.geometry = newGeo;
                  hoverBorderMesh.visible = true;

                  hoverGlowMesh.geometry.dispose();
                  const newGlowGeo = new THREE.BufferGeometry();
                  newGlowGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
                  hoverGlowMesh.geometry = newGlowGeo;
                  hoverGlowMesh.visible = true;
                } else {
                  hoverBorderMesh.visible = false;
                  hoverGlowMesh.visible = false;
                }
              }
            } else {
              setHoveredCountry(null);
              if (currentHoveredCountryId !== null) {
                currentHoveredCountryId = null;
                hoverBorderMesh.visible = false;
                hoverGlowMesh.visible = false;
              }
              canvas.style.cursor = "grab";
            }
          } else {
            setHoveredCountry(null);
            if (currentHoveredCountryId !== null) {
              currentHoveredCountryId = null;
              hoverBorderMesh.visible = false;
              hoverGlowMesh.visible = false;
            }
            canvas.style.cursor = "grab";
          }
        }
      }
    };

    const onPointerUp = (e) => {
      if (isPointerDown && !isDragging && dragDistance < 6) {
        // Pure click: Raycast to select
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        // 1. Check markers first
        const markerIntersects = raycaster.intersectObjects(markerClickMeshes, false);
        if (markerIntersects.length > 0) {
          const hit = markerIntersects[0].object.userData;
          setHoveredMarker(null);
          if (hit.type === "country") {
            const cur = selectedCountryRef.current;
            if (
              cur &&
              ((cur.countryCode && cur.countryCode.toUpperCase() === hit.data.countryCode?.toUpperCase()) ||
                (cur.country && cur.country.toLowerCase() === hit.data.country?.toLowerCase()))
            ) {
              onClearSelectionRef.current?.();
            } else {
              onSelectCountryRef.current?.(hit.data);
            }
          } else if (hit.type === "city") {
            const cur = selectedCityRef.current;
            if (cur && cur.city && cur.city.toLowerCase() === hit.data.city?.toLowerCase()) {
              onClearSelectionRef.current?.();
            } else {
              onSelectCityRef.current?.(hit.data);
            }
          }
        } else {
          // 2. Check country surface on ocean sphere
          const oceanIntersects = raycaster.intersectObject(oceanMesh, false);
          if (oceanIntersects.length > 0) {
            const hitPoint = oceanIntersects[0].point;
            const localPt = globeGroup.worldToLocal(hitPoint.clone());
            const [lon, lat] = vector3ToLatLon(localPt, GLOBE_RADIUS);
            const countryMatch = findCountry(lon, lat);

            if (countryMatch) {
              const cur = selectedCountryRef.current;
              const isAlreadySelected =
                cur &&
                ((countryMatch.iso2 && cur.countryCode?.toUpperCase() === countryMatch.iso2.toUpperCase()) ||
                  (cur.country && cur.country.toLowerCase() === countryMatch.displayName.toLowerCase()));

              if (isAlreadySelected) {
                onClearSelectionRef.current?.();
              } else {
                // Find matching traffic data or fallback with 0 visits
                let foundData = null;
                const topList = topCountriesRef.current || [];
                if (countryMatch.iso2) {
                  foundData = topList.find(
                    (c) => c.countryCode?.toUpperCase() === countryMatch.iso2.toUpperCase()
                  );
                }
                if (!foundData) {
                  foundData = topList.find(
                    (c) =>
                      c.country?.toLowerCase() === countryMatch.displayName.toLowerCase() ||
                      c.country?.toLowerCase() === countryMatch.rawName.toLowerCase()
                  );
                }

                if (foundData) {
                  onSelectCountryRef.current?.(foundData);
                } else {
                  onSelectCountryRef.current?.({
                    country: countryMatch.displayName,
                    countryCode: countryMatch.iso2 || "",
                    totalClicks: 0,
                    directClicks: 0,
                    qrClicks: 0,
                    percentage: 0,
                  });
                }
              }
            } else {
              // Clicked in ocean water
              onClearSelectionRef.current?.();
            }
          } else {
            // Clicked outside globe
            onClearSelectionRef.current?.();
          }
        }
      }

      isPointerDown = false;
      isDragging = false;
      canvas.style.cursor = "grab";
    };

    const onPointerLeave = () => {
      isPointerDown = false;
      isDragging = false;
      setHoveredMarker(null);
      setHoveredCountry(null);
      if (currentHoveredCountryId !== null) {
        currentHoveredCountryId = null;
        if (hoverBorderMesh) hoverBorderMesh.visible = false;
        if (hoverGlowMesh) hoverGlowMesh.visible = false;
      }
      canvas.style.cursor = "grab";
    };

    const onWheel = (e) => {
      e.preventDefault();
      targetCameraZRef.current = Math.max(
        2.2,
        Math.min(5.5, targetCameraZRef.current + e.deltaY * 0.0025)
      );
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // 10. Animation Loop
    let startTime = performance.now();

    const animate = (time) => {
      if (!isRunning) return;

      const elapsed = (time - startTime) * 0.001;

      // Smooth camera Z lerp for zoom
      camera.position.z = THREE.MathUtils.lerp(
        camera.position.z,
        targetCameraZRef.current,
        0.1
      );

      // Auto-rotation when not paused and not actively dragging
      if (!isPaused && !isDragging && !prefersReducedMotion) {
        targetRotationYRef.current += 0.0018;
      }

      // Smooth rotation interpolation
      globeGroup.rotation.x = THREE.MathUtils.lerp(
        globeGroup.rotation.x,
        targetRotationXRef.current,
        0.12
      );
      globeGroup.rotation.y = THREE.MathUtils.lerp(
        globeGroup.rotation.y,
        targetRotationYRef.current,
        0.12
      );

      // Subtle aura breathing animation (frozen when isPaused is true)
      if (!prefersReducedMotion && auraRings.length > 0 && !isPaused) {
        const auraCycle = 0.4 + 0.3 * Math.sin(elapsed * 2.5);
        for (const ring of auraRings) {
          ring.material.opacity = auraCycle;
        }
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    // 11. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 50 && newWidth !== width) {
          width = newWidth;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    // 12. WebGL Resource Disposal on Unmount
    return () => {
      isRunning = false;
      if (rafId) cancelAnimationFrame(rafId);

      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });

      try {
        renderer.dispose();
        renderer.forceContextLoss();
        const gl = renderer.getContext();
        if (gl) {
          const loseContextExt = gl.getExtension("WEBGL_lose_context");
          if (loseContextExt) loseContextExt.loseContext();
        }
      } catch (_) {}

      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvasRef.current = null;
      try { delete window.__geoGlobeScene; } catch (_) {}
    };
  }, [
    visitedIsoSet,
    visitedNumericSet,
    countriesGeo,
    coordsMap,
    indexedFeatures,
    findCountry,
    topCountries,
    topCities,
    maxCountryClicks,
    maxCityClicks,
  ]);

  // Synchronize selection visuals dynamically without tearing down WebGL context
  useEffect(() => {
    if (updateSelectionVisualsRef.current) {
      updateSelectionVisualsRef.current(selectedCountry, selectedCity);
    }
  }, [selectedCountry, selectedCity]);

  return (
    <div
      ref={containerRef}
      className={`geo-globe-viewport ${isPaused ? "is-paused" : ""}`}
    >
      {/* Zoom Control Toolbar */}
      <div className="geo-map-zoom-toolbar" role="toolbar" aria-label="Globe navigation controls">
        <button
          type="button"
          className="geo-map-zoom-btn"
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom in on 3D globe"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          className="geo-map-zoom-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
          aria-label="Zoom out on 3D globe"
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          className="geo-map-zoom-btn"
          onClick={handleReset}
          title="Reset View"
          aria-label="Reset 3D globe view"
        >
          <RotateCcw size={13} />
        </button>
      </div>

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
            {hoveredCountryData && hoveredCountryData.totalClicks > 0 ? (
              <span className="geo-country-hover-badge">
                {hoveredCountryData.totalClicks} {hoveredCountryData.totalClicks === 1 ? "click" : "clicks"}
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

      {/* Subtle Interaction Hint */}
      <div
        className="geo-globe-hint"
        style={{
          position: "absolute",
          bottom: "10px",
          right: "12px",
          fontSize: "11px",
          color: "var(--text-muted, #8B95A5)",
          pointerEvents: "none",
          background: "rgba(14, 19, 30, 0.75)",
          padding: "3px 8px",
          borderRadius: "4px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
