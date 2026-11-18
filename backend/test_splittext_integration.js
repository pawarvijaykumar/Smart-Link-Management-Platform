// =============================================================================
// SplitText Component Integration Verification Suite
// CHANGE: Verification of React Bits SplitText integration — 2026-11-19
// =============================================================================

import fs from "fs";
import path from "path";
import assert from "assert";
import { execSync } from "child_process";

console.log("\n=======================================================");
console.log("React Bits SplitText Integration Verification Suite");
console.log("=======================================================\n");

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// File paths
const frontendDir = path.resolve("../frontend");
const splitTextJsxPath = path.join(frontendDir, "src/components/SplitText.jsx");
const splitTextCssPath = path.join(frontendDir, "src/components/SplitText.css");
const appJsxPath = path.join(frontendDir, "src/App.jsx");
const trafficJsxPath = path.join(frontendDir, "src/components/TrafficAnalyticsView.jsx");
const abTestingJsxPath = path.join(frontendDir, "src/components/ABTestingView.jsx");
const reportsJsxPath = path.join(frontendDir, "src/components/ReportsView.jsx");
const packageJsonPath = path.join(frontendDir, "package.json");

// Read file contents
const splitTextJsx = fs.readFileSync(splitTextJsxPath, "utf-8");
const splitTextCss = fs.readFileSync(splitTextCssPath, "utf-8");
const appJsx = fs.readFileSync(appJsxPath, "utf-8");
const trafficJsx = fs.readFileSync(trafficJsxPath, "utf-8");
const abTestingJsx = fs.readFileSync(abTestingJsxPath, "utf-8");
const reportsJsx = fs.readFileSync(reportsJsxPath, "utf-8");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

// -----------------------------------------------------------------------------
// GROUP 1: Dependencies & Licensing
// -----------------------------------------------------------------------------
console.log("--- TEST GROUP 1: Dependencies & Licensing ---");

test("frontend package.json includes gsap dependency", () => {
  assert(packageJson.dependencies?.gsap, "gsap must be present in dependencies");
});

test("frontend package.json includes @gsap/react dependency", () => {
  assert(packageJson.dependencies?.["@gsap/react"], "@gsap/react must be present in dependencies");
});

test("GSAP SplitText plugin is available and registers without error", () => {
  const result = execSync(
    'node -e "import { gsap } from \'gsap\'; import { SplitText } from \'gsap/SplitText\'; gsap.registerPlugin(SplitText); console.log(\'REGISTER_OK\');"',
    { cwd: frontendDir, encoding: "utf-8" }
  );
  assert(result.includes("REGISTER_OK"), "GSAP SplitText plugin must register successfully");
});

// -----------------------------------------------------------------------------
// GROUP 2: SplitText Component Implementation
// -----------------------------------------------------------------------------
console.log("\n--- TEST GROUP 2: SplitText Reusable Component Implementation ---");

test("SplitText.jsx exists and exports SplitText as default", () => {
  assert(fs.existsSync(splitTextJsxPath), "SplitText.jsx file must exist");
  assert(splitTextJsx.includes("export default SplitText;"), "Must export SplitText as default");
});

test("SplitText imports GSAP, ScrollTrigger, GSAPSplitText, and useGSAP", () => {
  assert(splitTextJsx.includes("import { gsap } from 'gsap';"), "Must import gsap");
  assert(splitTextJsx.includes("import { ScrollTrigger } from 'gsap/ScrollTrigger';"), "Must import ScrollTrigger");
  assert(splitTextJsx.includes("import { SplitText as GSAPSplitText } from 'gsap/SplitText';"), "Must import GSAPSplitText");
  assert(splitTextJsx.includes("import { useGSAP } from '@gsap/react';"), "Must import useGSAP");
  assert(splitTextJsx.includes("gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);"), "Must register plugins");
});

test("SplitText.jsx imports companion stylesheet SplitText.css", () => {
  assert(splitTextJsx.includes("import './SplitText.css';"), "Must import SplitText.css");
});

test("SplitText supports all effects (rise, fade, blur, flip, pop, skew, wave)", () => {
  assert(splitTextJsx.includes("case 'fade':"), "Must support fade effect");
  assert(splitTextJsx.includes("case 'blur':"), "Must support blur effect");
  assert(splitTextJsx.includes("case 'flip':"), "Must support flip effect");
  assert(splitTextJsx.includes("case 'pop':"), "Must support pop effect");
  assert(splitTextJsx.includes("case 'skew':"), "Must support skew effect");
  assert(splitTextJsx.includes("case 'wave':"), "Must support wave effect");
  assert(splitTextJsx.includes("DEFAULT_FROM"), "Must support rise default effect");
});

test("SplitText handles font loading with fallback timer to prevent infinite blank states", () => {
  assert(splitTextJsx.includes("fallbackTimer"), "Must include fallback timer for font loading");
  assert(splitTextJsx.includes("document.fonts"), "Must check document.fonts");
});

test("SplitText respects prefers-reduced-motion in JavaScript", () => {
  assert(
    splitTextJsx.includes("prefers-reduced-motion: reduce"),
    "Must check window.matchMedia for prefers-reduced-motion"
  );
});

test("SplitText cleans up timelines, listeners, and calls splitInstance.revert() on unmount", () => {
  assert(splitTextJsx.includes("splitInstance.revert();"), "Must revert SplitText instance on cleanup");
  assert(splitTextJsx.includes("cancelAnimationFrame(raf);"), "Must cancel RAF on cleanup");
  assert(splitTextJsx.includes("removeEventListener"), "Must remove event listeners on cleanup");
});

// -----------------------------------------------------------------------------
// GROUP 3: CSS Stylesheet & Accessibility
// -----------------------------------------------------------------------------
console.log("\n--- TEST GROUP 3: CSS Stylesheet & Accessibility ---");

test("SplitText.css exists with required wrapper and unit classes", () => {
  assert(fs.existsSync(splitTextCssPath), "SplitText.css must exist");
  assert(splitTextCss.includes(".split-parent"), "Must define .split-parent");
  assert(splitTextCss.includes(".split-line"), "Must define .split-line");
  assert(splitTextCss.includes(".split-word"), "Must define .split-word");
  assert(splitTextCss.includes(".split-char"), "Must define .split-char");
});

test("SplitText.css contains @media (prefers-reduced-motion: reduce) rule", () => {
  assert(
    splitTextCss.includes("@media (prefers-reduced-motion: reduce)"),
    "Must contain prefers-reduced-motion media query"
  );
  assert(
    splitTextCss.includes("animation: none !important;") && splitTextCss.includes("transform: none !important;"),
    "Must disable animations and transforms when reduced motion is preferred"
  );
});

// -----------------------------------------------------------------------------
// GROUP 4: Heading Integrations (All 4 Required Pages)
// -----------------------------------------------------------------------------
console.log("\n--- TEST GROUP 4: Heading Integrations Across 4 Pages ---");

// Helper to verify recommended animation settings
function verifySplitTextProps(content, pageName) {
  assert(content.includes('effect="rise"'), `${pageName} must set effect="rise"`);
  assert(content.includes('splitType="chars"'), `${pageName} must set splitType="chars"`);
  assert(content.includes('trigger="load"'), `${pageName} must set trigger="load"`);
  assert(content.includes("delay={35}"), `${pageName} must set delay={35}`);
  assert(content.includes("duration={0.8}"), `${pageName} must set duration={0.8}`);
  assert(content.includes('staggerFrom="start"'), `${pageName} must set staggerFrom="start"`);
  assert(content.includes("loop={false}"), `${pageName} must set loop={false}`);
  assert(content.includes('hoverEffect="none"'), `${pageName} must set hoverEffect="none"`);
  assert(content.includes("mask={false}"), `${pageName} must set mask={false}`);
}

test("Page 1 (Main Dashboard): App.jsx imports SplitText and applies to greeting heading", () => {
  assert(appJsx.includes('import SplitText from "./components/SplitText";'), "App.jsx must import SplitText");
  assert(appJsx.includes("Welcome back,"), "Must contain Welcome back text");
  verifySplitTextProps(appJsx, "Main Dashboard");
});

test("Page 2 (Analytics): TrafficAnalyticsView.jsx imports SplitText and applies to heading", () => {
  assert(trafficJsx.includes('import SplitText from "./SplitText";'), "TrafficAnalyticsView must import SplitText");
  assert(trafficJsx.includes('text="Traffic Analytics"'), "Must animate Traffic Analytics text");
  verifySplitTextProps(trafficJsx, "Traffic Analytics");
});

test("Page 3 (A/B Testing): ABTestingView.jsx imports SplitText and applies to heading", () => {
  assert(abTestingJsx.includes('import SplitText from "./SplitText";'), "ABTestingView must import SplitText");
  assert(abTestingJsx.includes('text="Smart A/B Link Testing"'), "Must animate Smart A/B Link Testing text");
  verifySplitTextProps(abTestingJsx, "A/B Testing");
});

test("Page 4 (Automated Reports): ReportsView.jsx imports SplitText and applies to heading", () => {
  assert(reportsJsx.includes('import SplitText from "./SplitText";'), "ReportsView must import SplitText");
  assert(reportsJsx.includes('text="Automated Reports & Exports"'), "Must animate Automated Reports & Exports text");
  verifySplitTextProps(reportsJsx, "Automated Reports");
});

// -----------------------------------------------------------------------------
// GROUP 5: Production Build Verification
// -----------------------------------------------------------------------------
console.log("\n--- TEST GROUP 5: Production Build Verification ---");

test("Vite production build succeeds without errors", () => {
  const buildOutput = execSync("npm run build", { cwd: frontendDir, encoding: "utf-8" });
  assert(buildOutput.includes("built in"), "Build output must indicate successful build");
  assert(fs.existsSync(path.join(frontendDir, "dist/index.html")), "dist/index.html must exist");
});

console.log("\n=======================================================");
console.log(`Verification Complete: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
