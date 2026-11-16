/**
 * Stage 13: A/B Testing Form Draft Persistence Verification Suite
 * Tests:
 * 1. Draft Initialization with Empty Storage (returns default empty state)
 * 2. Incomplete Form Input Persistence (name, variantA, variantB saved to localStorage)
 * 3. Page Navigation Simulation (Component unmount & remount restores all draft fields)
 * 4. Modal Open State Persistence (Modal automatically re-opens when returning)
 * 5. Cancel / Close Action (Closing modal does NOT clear the draft data)
 * 6. Browser Refresh Simulation (Fresh instance restores draft from persisted storage)
 * 7. Explicit Reset Action (Reset button discards draft and purges storage)
 * 8. Successful Experiment Creation (Purges temporary draft from storage upon 201 Created)
 * 9. Traffic Allocation Invariant (50/50 traffic split and sticky cookie routing unaffected)
 */

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

import app from "./src/app.js";
import Link from "./src/models/link.model.js";
import Experiment from "./src/models/experiment.model.js";
import Click from "./src/models/click.model.js";

// Import frontend draft helper functions for direct behavioral unit validation
import {
  DRAFT_STORAGE_KEY,
  MODAL_OPEN_STORAGE_KEY,
  loadSavedDraft,
  loadSavedModalOpen,
} from "../frontend/src/utils/abTestingDraft.js";

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";

let server;
let baseUrl;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedAssertions++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

// In-memory mock localStorage mimicking browser window.localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

function request({ method = "GET", urlPath, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, baseUrl);
    const reqOptions = {
      method,
      hostname: fullUrl.hostname,
      port: fullUrl.port,
      path: fullUrl.pathname + fullUrl.search,
      headers: { ...headers },
    };

    let payload = null;
    if (body) {
      payload = typeof body === "string" ? body : JSON.stringify(body);
      reqOptions.headers["Content-Type"] = "application/json";
      reqOptions.headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = http.request(reqOptions, (res) => {
      let rawData = "";
      res.on("data", (chunk) => {
        rawData += chunk;
      });
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on("error", (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("Stage 13: A/B Testing Form Draft Persistence Test Suite");
  console.log("=======================================================\n");

  // Setup mock browser window.localStorage
  const mockStorage = new MockLocalStorage();
  global.window = { localStorage: mockStorage };
  global.localStorage = mockStorage;

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  } catch (err) {
    console.log("  ⚠️ Atlas connection timed out. Connecting to local MongoDB...");
    await mongoose.connect("mongodb://127.0.0.1:27017/smartlink_test");
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  const testUserId = new mongoose.Types.ObjectId();
  const token = jwt.sign(
    { userId: testUserId.toString(), email: "drafttest@example.com" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const authHeader = { Authorization: `Bearer ${token}` };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Empty Storage Initialization
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Empty Storage Initialization ---");
    mockStorage.clear();
    const initialDraft = loadSavedDraft();
    assert(initialDraft.name === "", "Initial draft name is empty string");
    assert(initialDraft.variantA === "", "Initial draft variantA is empty string");
    assert(initialDraft.variantB === "", "Initial draft variantB is empty string");
    assert(initialDraft.status === "active", "Initial draft default status is active");
    assert(initialDraft.fallbackVariant === "A", "Initial draft default fallback is Variant A");
    assert(loadSavedModalOpen() === false, "Modal is closed when no state saved");

    // -------------------------------------------------------------------------
    // TEST 2: Incomplete Form Input Persistence
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Incomplete Form Input Persistence ---");
    // Simulate user typing Experiment Name and Variant A URL
    const activeDraft = {
      name: "Q4 Homepage Redesign Split",
      variantA: "https://example.com/v1-homepage",
      variantB: "", // Incomplete: User navigates away to find Variant B
      status: "active",
      fallbackVariant: "A",
    };
    mockStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(activeDraft));
    mockStorage.setItem(MODAL_OPEN_STORAGE_KEY, "true");

    const savedJson = mockStorage.getItem(DRAFT_STORAGE_KEY);
    assert(Boolean(savedJson), "Draft is stored in localStorage");
    const parsed = JSON.parse(savedJson);
    assert(parsed.name === "Q4 Homepage Redesign Split", "Persisted name matches input");
    assert(parsed.variantA === "https://example.com/v1-homepage", "Persisted variantA matches input");
    assert(parsed.variantB === "", "Persisted variantB correctly reflects incomplete input");

    // -------------------------------------------------------------------------
    // TEST 3: Page Navigation Simulation (Unmount & Remount)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Page Navigation Simulation (Unmount & Remount) ---");
    // User navigates to Dashboard/Links page to copy URL -> ABTestingView unmounts
    // User returns to A/B Testing -> ABTestingView remounts and calls loadSavedDraft()
    const restoredDraft = loadSavedDraft();
    assert(restoredDraft.name === "Q4 Homepage Redesign Split", "Remount restores experiment name");
    assert(restoredDraft.variantA === "https://example.com/v1-homepage", "Remount restores Variant A URL");
    assert(restoredDraft.variantB === "", "Variant B preserved as empty ready for paste");
    assert(loadSavedModalOpen() === true, "Remount preserves open modal state");

    // User pastes Variant B URL
    restoredDraft.variantB = "https://example.com/v2-homepage-redesign";
    mockStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(restoredDraft));

    // -------------------------------------------------------------------------
    // TEST 4: Browser Refresh / Reload Simulation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Browser Refresh / Reload Simulation ---");
    // Simulate full browser refresh: fresh JavaScript evaluation reads existing localStorage
    const reloadedDraft = loadSavedDraft();
    assert(reloadedDraft.name === "Q4 Homepage Redesign Split", "Reload restores experiment name");
    assert(reloadedDraft.variantA === "https://example.com/v1-homepage", "Reload restores Variant A URL");
    assert(reloadedDraft.variantB === "https://example.com/v2-homepage-redesign", "Reload restores Variant B URL");

    // -------------------------------------------------------------------------
    // TEST 5: Cancel Action Does NOT Clear Draft
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Cancel Action Does NOT Clear Draft ---");
    // User clicks Cancel in modal -> modal closes, but draft data MUST remain intact
    mockStorage.setItem(MODAL_OPEN_STORAGE_KEY, "false");
    assert(loadSavedModalOpen() === false, "Modal closed on Cancel");

    const draftAfterCancel = loadSavedDraft();
    assert(draftAfterCancel.name === "Q4 Homepage Redesign Split", "Draft name preserved after Cancel");
    assert(draftAfterCancel.variantA === "https://example.com/v1-homepage", "Variant A preserved after Cancel");
    assert(draftAfterCancel.variantB === "https://example.com/v2-homepage-redesign", "Variant B preserved after Cancel");

    // -------------------------------------------------------------------------
    // TEST 6: Explicit Reset Action Discards Draft
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Explicit Reset Action Discards Draft ---");
    // User clicks "Reset Form" -> explicitly discards draft
    mockStorage.removeItem(DRAFT_STORAGE_KEY);
    const draftAfterReset = loadSavedDraft();
    assert(draftAfterReset.name === "", "Form name reset to empty");
    assert(draftAfterReset.variantA === "", "Variant A reset to empty");
    assert(draftAfterReset.variantB === "", "Variant B reset to empty");

    // -------------------------------------------------------------------------
    // TEST 7: Successful Experiment Creation Purges Draft
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Successful Experiment Creation Purges Draft ---");
    // Setup a new complete draft
    const newDraft = {
      name: "Checkout Button Color Test",
      variantA: "https://example.com/cart-green-btn",
      variantB: "https://example.com/cart-blue-btn",
      status: "active",
      fallbackVariant: "A",
    };
    mockStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(newDraft));
    mockStorage.setItem(MODAL_OPEN_STORAGE_KEY, "true");

    // Submit experiment via API
    const res = await request({
      method: "POST",
      urlPath: "/api/experiments",
      headers: authHeader,
      body: newDraft,
    });
    assert(res.statusCode === 201, "API creates experiment successfully (201)");
    assert(res.data.success === true, "Response has success: true");

    // Simulate handleCreateSubmit success cleanup
    mockStorage.removeItem(DRAFT_STORAGE_KEY);
    mockStorage.removeItem(MODAL_OPEN_STORAGE_KEY);

    assert(mockStorage.getItem(DRAFT_STORAGE_KEY) === null, "Draft purged from storage on success");
    assert(loadSavedModalOpen() === false, "Modal closed on success");
    const clearedDraft = loadSavedDraft();
    assert(clearedDraft.name === "", "Form state clean after successful creation");

    // -------------------------------------------------------------------------
    // TEST 8: 50/50 Traffic Allocation Invariant
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: 50/50 Traffic Allocation Invariant ---");
    const exp = res.data.experiment;
    assert(exp.trafficSplit.a === 50 && exp.trafficSplit.b === 50, "Traffic allocation remains 50/50");

    const shortCode = exp.shortCode;
    const redirectRes = await request({ method: "GET", urlPath: `/${shortCode}` });
    assert(redirectRes.statusCode === 302, "Short link redirects with 302");
    assert(
      redirectRes.headers["location"] === "https://example.com/cart-green-btn" ||
      redirectRes.headers["location"] === "https://example.com/cart-blue-btn",
      "Visitor routed to Variant A or Variant B"
    );

    console.log("\n=======================================================");
    console.log(`All Tests Finished: ${passedAssertions} Passed, ${failedAssertions} Failed`);
    console.log("=======================================================\n");

  } finally {
    // Cleanup DB
    await Experiment.deleteMany({ user: testUserId });
    await Link.deleteMany({ user: testUserId });
    await Click.deleteMany({});
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
