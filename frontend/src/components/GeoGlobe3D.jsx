import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import globeDots from "../data/globeDots.json";
import { useTheme } from "../context/ThemeContext";
import {
  NUMERIC_TO_ISO2,
  COUNTRY_NAME_TO_ISO2,
  getCountryFlagEmoji,
} from "../data/geoLookup.js";

// Coordinates dictionary for major cities
const KNOWN_CITY_COORDINATES = {
  // India
  bengaluru: [77.5946, 12.9716],
  bangalore: [77.5946, 12.9716],
  mumbai: [72.8777, 19.0760],
  delhi: [77.1025, 28.7041],
  "new delhi": [77.2090, 28.6139],
  hyderabad: [78.4867, 17.3850],
  chennai: [80.2707, 13.0827],
  kolkata: [88.3639, 22.5726],
  pune: [73.8567, 18.5204],
  ahmedabad: [72.5714, 23.0225],
  jaipur: [75.7873, 26.9124],
  lucknow: [80.9462, 26.8467],
  chandigarh: [76.7794, 30.7333],
  kochi: [76.2673, 9.9312],
  coimbatore: [76.9558, 11.0168],
  indore: [75.8577, 22.7196],
  nagpur: [79.0882, 21.1458],
  noida: [77.3910, 28.5355],
  gurgaon: [77.0266, 28.4595],
  gurugram: [77.0266, 28.4595],
  // North America
  "new york": [-74.006, 40.7128],
  "san francisco": [-122.4194, 37.7749],
  "los angeles": [-118.2437, 34.0522],
  chicago: [-87.6298, 41.8781],
  seattle: [-122.3321, 47.6062],
  austin: [-97.7431, 30.2672],
  boston: [-71.0589, 42.3601],
  toronto: [-79.3832, 43.6532],
  vancouver: [-123.1207, 49.2827],
  // Europe
  london: [-0.1276, 51.5074],
  paris: [2.3522, 48.8566],
  berlin: [13.4050, 52.5200],
  amsterdam: [4.9041, 52.3676],
  dublin: [-6.2603, 53.3498],
  madrid: [-3.7038, 40.4168],
  stockholm: [18.0686, 59.3293],
  // Asia & Oceania
  tokyo: [139.6917, 35.6895],
  singapore: [103.8198, 1.3521],
  sydney: [151.2093, -33.8688],
  melbourne: [144.9631, -37.8136],
  dubai: [55.2708, 25.2048],
  seoul: [126.9780, 37.5665],
  bangkok: [100.5018, 13.7563],
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

// -----------------------------------------------------------------------------
// Component: GeoGlobe3D
// High-performance Three.js 3D Globe with Land Dots, Visited Country Highlights,
// Pulsing City Markers, Auto-Rotation & Thorough WebGL Memory Cleanup
// -----------------------------------------------------------------------------
export default function GeoGlobe3D({
  topCountries = [],
  topCities = [],
  summary = null,
  onSelectCountry = null,
  onSelectCity = null,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Hover state for cities and countries
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

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

  // Dynamic Theme state support
  const themeContext = useTheme();
  const effectiveTheme = themeContext?.effectiveTheme || "dark";
  const [domTheme, setDomTheme] = useState(() => {
    return document.documentElement.getAttribute("data-theme") || effectiveTheme;
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const active = document.documentElement.getAttribute("data-theme") || "dark";
      setDomTheme(active);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-bg", "data-accent"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Theme CSS variable colors
    const computedStyles = getComputedStyle(document.documentElement);
    const accentHex = computedStyles.getPropertyValue("--accent").trim() || "#6366F1";
    const textMutedHex = computedStyles.getPropertyValue("--text-muted").trim() || "#8B95A5";
    const bgHex = computedStyles.getPropertyValue("--bg").trim() || "#0E1116";
    const surfaceHex = computedStyles.getPropertyValue("--surface").trim() || "#161B22";
    const isLightTheme =
      domTheme === "light" ||
      effectiveTheme === "light" ||
      document.documentElement.getAttribute("data-theme") === "light";

    // Setup Dimensions
    let width = container.clientWidth || 700;
    let height = 480;

    // Three.js Scene, Camera, Renderer
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
    // Default initial tilt
    globeGroup.rotation.x = 0.25;
    globeGroup.rotation.y = -0.5;
    scene.add(globeGroup);

    const GLOBE_RADIUS = 1.35;

    // 1. Core Sphere (occludes dots on far side)
    const coreGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 0.995, 64, 64);
    const coreColor = isLightTheme ? new THREE.Color("#FFFFFF") : new THREE.Color(surfaceHex);
    const coreMat = new THREE.MeshBasicMaterial({
      color: coreColor,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    globeGroup.add(coreMesh);

    // 2. Thin Rim Light (subtle atmosphere fresnel)
    const rimGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.006, 48, 48);
    const rimMat = new THREE.ShaderMaterial({
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
        uniform vec3 rimColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
          rim = pow(rim, 3.8) * 0.28;
          gl_FragColor = vec4(rimColor, rim);
        }
      `,
      uniforms: {
        rimColor: { value: new THREE.Color(accentHex) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    globeGroup.add(rimMesh);

    // 3. Land Dots (only on land from globeDots.json)
    // Separate into visited and unvisited
    const unvisitedPositions = [];
    const visitedPositions = [];

    const dummy = new THREE.Object3D();

    for (let i = 0; i < globeDots.length; i++) {
      const [lon, lat, numId] = globeDots[i];
      const paddedId = String(numId).padStart(3, "0");
      const isVisited = visitedNumericSet.has(paddedId);
      const pos = latLonToVector3(lat, lon, GLOBE_RADIUS);

      if (isVisited) {
        visitedPositions.push(pos);
      } else {
        unvisitedPositions.push(pos);
      }
    }

    // Unvisited land dots: neutral var(--text-muted) at 35% opacity
    let unvisitedMesh = null;
    if (unvisitedPositions.length > 0) {
      const dotGeo = new THREE.SphereGeometry(0.013, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(textMutedHex),
        transparent: true,
        opacity: 0.35,
      });
      unvisitedMesh = new THREE.InstancedMesh(dotGeo, dotMat, unvisitedPositions.length);
      for (let i = 0; i < unvisitedPositions.length; i++) {
        dummy.position.copy(unvisitedPositions[i]);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        unvisitedMesh.setMatrixAt(i, dummy.matrix);
      }
      unvisitedMesh.instanceMatrix.needsUpdate = true;
      globeGroup.add(unvisitedMesh);
    }

    // Visited countries' dots: var(--accent)
    let visitedMesh = null;
    if (visitedPositions.length > 0) {
      const dotGeo = new THREE.SphereGeometry(0.016, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(accentHex),
      });
      visitedMesh = new THREE.InstancedMesh(dotGeo, dotMat, visitedPositions.length);
      for (let i = 0; i < visitedPositions.length; i++) {
        dummy.position.copy(visitedPositions[i]);
        dummy.scale.set(1.15, 1.15, 1.15);
        dummy.updateMatrix();
        visitedMesh.setMatrixAt(i, dummy.matrix);
      }
      visitedMesh.instanceMatrix.needsUpdate = true;
      globeGroup.add(visitedMesh);
    }

    // 4. Cities with Visits: Accent points with soft pulse rings
    const cityObjects = [];
    const pulseRings = [];

    // Helper: determine coordinates for a city
    const getCityCoordinates = (cityItem) => {
      const cityName = (cityItem.city || "").toLowerCase().trim();
      if (KNOWN_CITY_COORDINATES[cityName]) {
        return KNOWN_CITY_COORDINATES[cityName];
      }
      // Fallback: look for matching country dots
      const numId = String(cityItem.countryCode || "").toUpperCase();
      let fallbackDot = null;
      for (const [nId, iso] of Object.entries(NUMERIC_TO_ISO2)) {
        if (iso.toUpperCase() === numId) {
          fallbackDot = globeDots.find((d) => String(d[2]).padStart(3, "0") === nId);
          break;
        }
      }
      if (fallbackDot) {
        return [fallbackDot[0], fallbackDot[1]];
      }
      return [0, 20];
    };

    const visitedCitiesWithClicks = topCities.filter((c) => (c.totalClicks || 0) > 0);

    for (const city of visitedCitiesWithClicks) {
      const [lon, lat] = getCityCoordinates(city);
      const pos = latLonToVector3(lat, lon, GLOBE_RADIUS * 1.008);
      const normal = pos.clone().normalize();

      // City Center Marker Sphere
      const markerGeo = new THREE.SphereGeometry(0.024, 12, 12);
      const markerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(accentHex),
      });
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.copy(pos);
      markerMesh.userData = { city, type: "city" };
      globeGroup.add(markerMesh);
      cityObjects.push(markerMesh);

      // Pulse Ring Mesh
      const ringGeo = new THREE.RingGeometry(0.025, 0.045, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(accentHex),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(0.002)));
      ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      globeGroup.add(ringMesh);
      pulseRings.push(ringMesh);
    }

    // 5. Interaction State (Drag, Hover, Pause)
    let isDragging = false;
    let isPointerOver = false;
    let previousPointerPosition = { x: 0, y: 0 };
    let isRunning = true;
    let rafId = null;

    // Raycaster for hover tooltips
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    const onPointerDown = (e) => {
      isDragging = true;
      canvas.style.cursor = "grabbing";
      previousPointerPosition = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - previousPointerPosition.x;
        const deltaY = e.clientY - previousPointerPosition.y;

        globeGroup.rotation.y += deltaX * 0.005;
        globeGroup.rotation.x = Math.max(
          -0.85,
          Math.min(0.85, globeGroup.rotation.x + deltaY * 0.005)
        );

        previousPointerPosition = { x: e.clientX, y: e.clientY };
      } else {
        // Raycast against city markers
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cityObjects, false);

        if (intersects.length > 0) {
          const hit = intersects[0].object.userData.city;
          setHoveredItem(hit);
          setTooltipPos({
            x: e.clientX - rect.left + 14,
            y: e.clientY - rect.top + 14,
          });
          canvas.style.cursor = "pointer";
        } else {
          setHoveredItem(null);
          canvas.style.cursor = isDragging ? "grabbing" : "grab";
        }
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      canvas.style.cursor = "grab";
    };

    const onPointerEnter = () => {
      isPointerOver = true;
    };

    const onPointerLeave = () => {
      isPointerOver = false;
      isDragging = false;
      setHoveredItem(null);
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerenter", onPointerEnter);
    canvas.addEventListener("pointerleave", onPointerLeave);

    // 6. Animation Loop with Performance Controls
    let startTime = performance.now();

    const animate = (time) => {
      if (!isRunning) return;

      const elapsed = (time - startTime) * 0.001;

      // Slow auto-rotate that pauses on hover or drag
      if (!isDragging && !isPointerOver && !prefersReducedMotion) {
        globeGroup.rotation.y += 0.002;
      }

      // Soft Pulse animation for city rings
      if (!prefersReducedMotion && pulseRings.length > 0) {
        const pulseCycle = (elapsed * 1.2) % 1; // 0 to 1
        const scale = 1.0 + pulseCycle * 1.5;
        const opacity = (1.0 - pulseCycle) * 0.65;

        for (const ring of pulseRings) {
          ring.scale.set(scale, scale, 1);
          ring.material.opacity = opacity;
        }
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    // 7. Responsive Resize Observer
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

    // 8. Visibility & Intersection Observers (Pause rendering when off-screen or tab hidden)
    const onVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
      } else {
        if (!isRunning) {
          isRunning = true;
          startTime = performance.now();
          rafId = requestAnimationFrame(animate);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            isRunning = false;
            if (rafId) cancelAnimationFrame(rafId);
          } else {
            if (!isRunning) {
              isRunning = true;
              startTime = performance.now();
              rafId = requestAnimationFrame(animate);
            }
          }
        }
      },
      { threshold: 0.1 }
    );
    intersectionObserver.observe(container);

    // 9. Thorough Cleanup and Disposal on Unmount
    return () => {
      isRunning = false;
      if (rafId) cancelAnimationFrame(rafId);

      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerenter", onPointerEnter);
      canvas.removeEventListener("pointerleave", onPointerLeave);

      // Dispose all scene objects
      scene.traverse((obj) => {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      // Renderer disposal & force WebGL context release
      try {
        renderer.dispose();
        renderer.forceContextLoss();
        const gl = renderer.getContext();
        if (gl) {
          const loseContextExt = gl.getExtension("WEBGL_lose_context");
          if (loseContextExt) {
            loseContextExt.loseContext();
          }
        }
      } catch (e) {
        // Safe ignore
      }

      // Remove canvas from DOM
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvasRef.current = null;
    };
  }, [visitedIsoSet, visitedNumericSet, topCities, effectiveTheme, domTheme]);

  return (
    <div
      className="geo-globe-wrapper"
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "480px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      {/* Floating Hover Tooltip for Cities */}
      {hoveredItem && (
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
            zIndex: 30,
            fontSize: "12px",
            minWidth: "140px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: "600",
              marginBottom: "4px",
            }}
          >
            <span>{getCountryFlagEmoji(hoveredItem.countryCode)}</span>
            <span>{hoveredItem.city}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--text-muted)",
              gap: "12px",
            }}
          >
            <span>Visits:</span>
            <span
              style={{
                fontWeight: "600",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {hoveredItem.totalClicks || 0}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--text-muted)",
              gap: "12px",
              marginTop: "2px",
            }}
          >
            <span>Channel:</span>
            <span style={{ fontWeight: "500", color: "var(--accent)" }}>
              {hoveredItem.qrClicks || 0} QR, {hoveredItem.directClicks || 0} Direct
            </span>
          </div>
        </div>
      )}

      {/* Subtle Hint */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          right: "14px",
          fontSize: "11px",
          color: "var(--text-muted)",
          pointerEvents: "none",
          opacity: 0.8,
        }}
      >
        Drag to rotate
      </div>
    </div>
  );
}
