// =============================================================================
// Stage 13: A/B Experiment Modal Scrolling & Isolation Verification Suite
// CHANGE: Stage 13 A/B Experiment Modal Scrolling Fix — 2026-11-18
// =============================================================================

import fs from "fs";
import path from "path";
import assert from "assert";

console.log("\n=======================================================");
console.log("Stage 13: A/B Experiment Modal Scrolling Verification");
console.log("=======================================================\n");

const cssPath = path.resolve("../frontend/src/App.css");
const jsxPath = path.resolve("../frontend/src/components/ABTestingView.jsx");

const cssContent = fs.readFileSync(cssPath, "utf-8");
const jsxContent = fs.readFileSync(jsxPath, "utf-8");

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

// -----------------------------------------------------------------------------
// Group 1: Modal Viewport Height & Layout Constraints
// -----------------------------------------------------------------------------
console.log("--- TEST GROUP 1: Modal Viewport Height & Layout Constraints ---");

test("CSS restricts .ab-create-modal to max-height: 85vh", () => {
  assert(
    cssContent.includes("max-height: 85vh !important;"),
    ".ab-create-modal must have max-height: 85vh !important;"
  );
});

test("CSS sets .ab-create-modal to display: flex and flex-direction: column", () => {
  assert(
    cssContent.includes("display: flex !important;") &&
    cssContent.includes("flex-direction: column !important;"),
    ".ab-create-modal must be a flex container with column direction"
  );
});

test("CSS clips overflow on .ab-create-modal outer container", () => {
  assert(
    cssContent.includes("overflow: hidden !important;"),
    ".ab-create-modal container must have overflow: hidden"
  );
});

test("CSS sets overscroll-behavior: contain on .ab-create-modal", () => {
  assert(
    cssContent.includes("overscroll-behavior: contain;"),
    ".ab-create-modal must have overscroll-behavior: contain"
  );
});

// -----------------------------------------------------------------------------
// Group 2: Scrollable Content Area & Sticky Header/Footer
// -----------------------------------------------------------------------------
console.log("\n--- TEST GROUP 2: Scrollable Content Area & Pinned Header/Footer ---");

test("JSX wraps form fields inside modal-body ab-modal-body", () => {
  assert(
    jsxContent.includes('className="modal-body ab-modal-body"'),
    "JSX must wrap form inputs in modal-body ab-modal-body"
  );
});

test("CSS configures .ab-create-modal .ab-modal-body with overflow-y: auto", () => {
  assert(
    cssContent.includes(".ab-create-modal .ab-modal-body") &&
    cssContent.includes("overflow-y: auto;"),
    ".ab-create-modal .ab-modal-body must have overflow-y: auto"
  );
});

test("CSS configures .ab-modal-body with flex: 1 1 auto and min-height: 0", () => {
  assert(
    cssContent.includes("flex: 1 1 auto;") &&
    cssContent.includes("min-height: 0;"),
    ".ab-modal-body must have flex: 1 1 auto and min-height: 0 for proper flexbox scrolling"
  );
});

test("CSS configures .modal-header to stay pinned (flex-shrink: 0)", () => {
  assert(
    cssContent.includes(".ab-create-modal .modal-header") &&
    cssContent.includes("flex-shrink: 0;"),
    "Header must have flex-shrink: 0 to stay pinned at top while scrolling"
  );
});

test("CSS configures .ab-modal-footer to stay pinned at bottom (flex-shrink: 0)", () => {
  assert(
    cssContent.includes(".ab-create-modal .ab-modal-footer") &&
    cssContent.includes("flex-shrink: 0;"),
    "Footer actions must have flex-shrink: 0"
  );
});

test("CSS provides customized dark theme scrollbar for .ab-modal-body", () => {
  assert(
    cssContent.includes(".ab-create-modal .ab-modal-body::-webkit-scrollbar"),
    "Custom scrollbar styling must be defined for dark theme consistency"
  );
});

// -----------------------------------------------------------------------------
// Group 3: Background Page Scrolling Prevention
// -----------------------------------------------------------------------------
console.log("\n--- TEST GROUP 3: Background Page Scrolling Prevention ---");

test("JSX includes useEffect locking document.body.style.overflow = 'hidden'", () => {
  assert(
    jsxContent.includes('document.body.style.overflow = "hidden";'),
    "JSX must lock body overflow to hidden when modal is open"
  );
});

test("JSX cleans up and restores document.body.style.overflow on close/unmount", () => {
  assert(
    jsxContent.includes("document.body.style.overflow = originalOverflow;"),
    "JSX must restore original body overflow on modal close or unmount"
  );
});

test("JSX compensates for scrollbar width to prevent background layout shift", () => {
  assert(
    jsxContent.includes("window.innerWidth - document.documentElement.clientWidth") &&
    jsxContent.includes("document.body.style.paddingRight"),
    "JSX must adjust body paddingRight by scrollbar width to prevent layout shift"
  );
});

test("CSS modal-backdrop has overscroll-behavior: contain", () => {
  assert(
    cssContent.includes("overscroll-behavior: contain;"),
    "modal-backdrop must contain overscroll chaining"
  );
});

// -----------------------------------------------------------------------------
// Group 4: Responsive Behavior
// -----------------------------------------------------------------------------
console.log("\n--- TEST GROUP 4: Responsive Behavior on Small Screens ---");

test("CSS adapts .ab-create-modal on mobile (max-width: 600px)", () => {
  const mobileSection = cssContent.slice(cssContent.indexOf("@media (max-width: 600px)"));
  assert(
    mobileSection.includes(".ab-create-modal") &&
    mobileSection.includes("max-height: 90vh !important;"),
    "Mobile must set max-height: 90vh for optimal viewport usage on mobile"
  );
});

test("CSS stacks radio cards vertically on mobile", () => {
  const mobileSection = cssContent.slice(cssContent.indexOf("@media (max-width: 600px)"));
  assert(
    mobileSection.includes(".ab-radio-group") &&
    mobileSection.includes("grid-template-columns: 1fr;"),
    "Radio group should stack in 1 column on small screens"
  );
});

// -----------------------------------------------------------------------------
// Group 5: Preservation of Existing Form Fields & Features
// -----------------------------------------------------------------------------
console.log("\n--- TEST GROUP 5: Preservation of Existing Form Fields & Logic ---");

test("JSX preserves Experiment Name input field", () => {
  assert(
    jsxContent.includes("createForm.name") &&
    jsxContent.includes('placeholder="e.g. Black Friday Hero Banner Test"'),
    "Experiment name field must be intact"
  );
});

test("JSX preserves Variant A URL input and Select from My Links button", () => {
  assert(
    jsxContent.includes("createForm.variantA") &&
    jsxContent.includes("🔗 Select from My Links"),
    "Variant A input and picker button must be intact"
  );
});

test("JSX preserves Variant B URL input and Select from My Links button", () => {
  assert(
    jsxContent.includes("createForm.variantB") &&
    jsxContent.includes("🔗 Select from My Links"),
    "Variant B input and picker button must be intact"
  );
});

test("JSX preserves 50/50 Traffic Allocation display", () => {
  assert(
    jsxContent.includes("50% Variant A") &&
    jsxContent.includes("50% Variant B"),
    "Traffic allocation display must be intact"
  );
});

test("JSX preserves Initial Status selection (Active & Draft)", () => {
  assert(
    jsxContent.includes('value="active"') &&
    jsxContent.includes('value="draft"'),
    "Initial status options must be intact"
  );
});

test("JSX preserves Fallback Destination select (A & B)", () => {
  assert(
    jsxContent.includes("createForm.fallbackVariant") &&
    jsxContent.includes('value="A"') &&
    jsxContent.includes('value="B"'),
    "Fallback options must be intact"
  );
});

test("JSX preserves Reset Form, Cancel, and Create buttons", () => {
  assert(
    jsxContent.includes("handleResetDraft") &&
    jsxContent.includes("handleCloseModal") &&
    jsxContent.includes("Create & Deploy Experiment"),
    "Modal action buttons must be intact"
  );
});

test("Date comments follow project convention", () => {
  assert(
    jsxContent.includes("CHANGE: Stage 13") && jsxContent.includes("2026-11-18"),
    "JSX must have date comment with 2026-11-18"
  );
  assert(
    cssContent.includes("CHANGE: Stage 13 A/B Experiment Modal Scrolling Fix — 2026-11-18"),
    "CSS must have date comment with 2026-11-18"
  );
});

console.log("\n=======================================================");
console.log(`Verification Complete: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
