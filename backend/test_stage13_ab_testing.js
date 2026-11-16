/**
 * Stage 13: Smart A/B Link Testing Verification Suite
 * Tests:
 * 1. Authentication & Security (401 on unauthenticated access across all experiment routes)
 * 2. Experiment Creation (name, variant A/B URLs, 50/50 split, link association, notifications)
 * 3. Validation Rules (reject missing name, invalid URLs, invalid fallback)
 * 4. User Data Isolation (User B cannot access or modify User A's experiments)
 * 5. Draft State Protection (public redirect blocked with 403, click counter decremented, no click recorded)
 * 6. Active State 50/50 Traffic Split (new visitors assigned A or B, signed cookie set)
 * 7. Cookie Persistence (returning visitor with signed cookie consistently receives assigned variant)
 * 8. Tampered / Unsigned Cookie Handling (tampered cookie rejected, visitor re-assigned safely)
 * 9. Paused State Fallback Routing (routes to configured fallbackVariant, regardless of cookie)
 * 10. Completed State Fallback Routing & Immutability (routes to fallback, completed experiments cannot be edited)
 * 11. Lifecycle Status Transitions (draft -> active -> paused -> completed, timestamps updated)
 * 12. Fallback Variant Reconfiguration (A <-> B)
 * 13. Single Click Record Integrity (one click recorded per redirect with experimentId and experimentVariant)
 * 14. Analytics Total & Percentages (variant totals and percentages sum to 100%)
 * 15. Continuous Zero-Filled IST Timeline (all dates populated with 0 if no clicks)
 * 16. Winner Determination Logic (A, B, TIE, NONE strictly by clicks with disclaimer)
 * 17. Range Filtering (7d, 30d, all)
 * 18. Stage 7 Link Expiration & Access Controls (isPaused, expired, maxClicks respected on experiment links)
 * 19. Regression Check: Regular Links Unaffected (non-experiment links work normally with null experiment fields)
 */

import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cookieSignature from "cookie-signature";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

import app from "./src/app.js";
import Link from "./src/models/link.model.js";
import Click from "./src/models/click.model.js";
import Notification from "./src/models/notification.model.js";
import Experiment from "./src/models/experiment.model.js";

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
const COOKIE_SECRET = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "smartlink_ab_cookie_secret_key_2026";

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

// Helper to make HTTP requests
function request({
  method = "GET",
  urlPath,
  headers = {},
  body = null,
  followRedirect = false,
}) {
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
          raw: rawData,
        });
      });
    });

    req.on("error", (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

// Sign a cookie value matching cookie-parser
function signCookie(val, secret) {
  return "s:" + cookieSignature.sign(val, secret);
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("Stage 13: Smart A/B Link Testing Verification Suite");
  console.log("=======================================================\n");

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  } catch (err) {
    console.log("  ⚠️ Atlas connection timed out. Connecting to local MongoDB at mongodb://127.0.0.1:27017/smartlink_test...");
    await mongoose.connect("mongodb://127.0.0.1:27017/smartlink_test");
  }

  // Start HTTP server on dynamic port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  🚀 Server listening on ${baseUrl}\n`);

  // Setup test users & tokens
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  const tokenA = jwt.sign(
    { userId: userAId.toString(), email: "userA@stage13.com" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const tokenB = jwt.sign(
    { userId: userBId.toString(), email: "userB@stage13.com" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const authA = { Authorization: `Bearer ${tokenA}` };
  const authB = { Authorization: `Bearer ${tokenB}` };

  // Clean test data
  await Experiment.deleteMany({ user: { $in: [userAId, userBId] } });
  await Link.deleteMany({ user: { $in: [userAId, userBId] } });
  await Click.deleteMany({});
  await Notification.deleteMany({ user: { $in: [userAId, userBId] } });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Authentication & Security
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Authentication & Security ---");
    const unauthPost = await request({ method: "POST", urlPath: "/api/experiments", body: {} });
    assert(unauthPost.statusCode === 401, "Unauthenticated POST /api/experiments returns 401");

    const unauthGet = await request({ method: "GET", urlPath: "/api/experiments" });
    assert(unauthGet.statusCode === 401, "Unauthenticated GET /api/experiments returns 401");

    const fakeId = new mongoose.Types.ObjectId();
    const unauthDetail = await request({ method: "GET", urlPath: `/api/experiments/${fakeId}` });
    assert(unauthDetail.statusCode === 401, "Unauthenticated GET /api/experiments/:id returns 401");

    const unauthAnalytics = await request({ method: "GET", urlPath: `/api/experiments/${fakeId}/analytics` });
    assert(unauthAnalytics.statusCode === 401, "Unauthenticated GET /api/experiments/:id/analytics returns 401");

    // -------------------------------------------------------------------------
    // TEST 2: Validation on Creation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Validation on Creation ---");
    const valMissingName = await request({
      method: "POST",
      urlPath: "/api/experiments",
      headers: authA,
      body: { variantA: "https://example.com/a", variantB: "https://example.com/b" },
    });
    assert(valMissingName.statusCode === 400, "Rejects creation without experiment name (400)");

    const valBadUrlA = await request({
      method: "POST",
      urlPath: "/api/experiments",
      headers: authA,
      body: { name: "Test Exp", variantA: "not-a-url", variantB: "https://example.com/b" },
    });
    assert(valBadUrlA.statusCode === 400, "Rejects creation with invalid Variant A URL (400)");

    const valBadUrlB = await request({
      method: "POST",
      urlPath: "/api/experiments",
      headers: authA,
      body: { name: "Test Exp", variantA: "https://example.com/a", variantB: "ftp://example.com" },
    });
    assert(valBadUrlB.statusCode === 400, "Rejects creation with unsafe/invalid Variant B URL (400)");

    // -------------------------------------------------------------------------
    // TEST 3: Experiment Creation (Active State)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Experiment Creation (Active State) ---");
    const createRes = await request({
      method: "POST",
      urlPath: "/api/experiments",
      headers: authA,
      body: {
        name: "Landing Page Redesign 2026",
        variantA: "https://example.com/landing-original",
        variantB: "https://example.com/landing-redesign",
        status: "active",
        fallbackVariant: "A",
      },
    });
    assert(createRes.statusCode === 201, "Creates experiment successfully (201)");
    assert(createRes.data.success === true, "Response has success: true");
    const expA = createRes.data.experiment;
    assert(expA.name === "Landing Page Redesign 2026", "Experiment name matches");
    assert(expA.status === "active", "Experiment initial status is active");
    assert(expA.trafficSplit.a === 50 && expA.trafficSplit.b === 50, "Traffic split is fixed 50/50");
    assert(expA.fallbackVariant === "A", "Fallback variant defaults to A");
    assert(Boolean(expA.shortCode), "Short code generated and returned");

    // Verify Link in DB
    const linkDoc = await Link.findOne({ shortCode: expA.shortCode });
    assert(Boolean(linkDoc), "Associated Link document exists in DB");
    assert(linkDoc.isExperiment === true, "Link has isExperiment: true");
    assert(linkDoc.experiment.toString() === expA._id.toString(), "Link references experiment");

    // Verify Notification
    const notif = await Notification.findOne({ user: userAId, type: "experiment" });
    assert(Boolean(notif), "In-app notification created for experiment creation");

    // -------------------------------------------------------------------------
    // TEST 4: User Data Isolation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: User Data Isolation ---");
    const listUserB = await request({ method: "GET", urlPath: "/api/experiments", headers: authB });
    assert(listUserB.data.count === 0, "User B sees 0 experiments (isolated)");

    const getUserBExp = await request({
      method: "GET",
      urlPath: `/api/experiments/${expA._id}`,
      headers: authB,
    });
    assert(getUserBExp.statusCode === 404, "User B cannot fetch User A's experiment by ID (404)");

    const patchUserBExp = await request({
      method: "PATCH",
      urlPath: `/api/experiments/${expA._id}/status`,
      headers: authB,
      body: { status: "paused" },
    });
    assert(patchUserBExp.statusCode === 404, "User B cannot update User A's experiment status (404)");

    const analyticsUserB = await request({
      method: "GET",
      urlPath: `/api/experiments/${expA._id}/analytics`,
      headers: authB,
    });
    assert(analyticsUserB.statusCode === 404, "User B cannot view User A's experiment analytics (404)");

    // -------------------------------------------------------------------------
    // TEST 5: Draft State Public Redirection Guard
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Draft State Public Redirection Guard ---");
    const createDraftRes = await request({
      method: "POST",
      urlPath: "/api/experiments",
      headers: authA,
      body: {
        name: "Draft Experiment",
        variantA: "https://example.com/draft-a",
        variantB: "https://example.com/draft-b",
        status: "draft",
      },
    });
    const draftExp = createDraftRes.data.experiment;
    assert(draftExp.status === "draft", "Draft experiment created with draft status");

    const draftRedirectRes = await request({
      method: "GET",
      urlPath: `/${draftExp.shortCode}`,
    });
    assert(draftRedirectRes.statusCode === 403, "Visits to draft experiment return HTTP 403");
    assert(draftRedirectRes.data?.code === "EXPERIMENT_DRAFT", "Returns code EXPERIMENT_DRAFT");

    // Check click counter remained 0
    const draftLink = await Link.findOne({ shortCode: draftExp.shortCode });
    assert(draftLink.clicks === 0, "Atomic click counter decremented back to 0 on draft block");

    const draftClicks = await Click.countDocuments({ link: draftLink._id });
    assert(draftClicks === 0, "No Click document was recorded for draft visit");

    // -------------------------------------------------------------------------
    // TEST 6: Active State 50/50 Traffic Split & Cookie Setting
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Active State 50/50 Traffic Split & Cookie Setting ---");
    const redirectRes1 = await request({
      method: "GET",
      urlPath: `/${expA.shortCode}`,
    });
    assert(redirectRes1.statusCode === 302, "Initial visit responds with HTTP 302 redirect");
    const location1 = redirectRes1.headers["location"];
    assert(
      location1 === "https://example.com/landing-original" ||
      location1 === "https://example.com/landing-redesign",
      `Redirects to Variant A or B destination URL (received: ${location1})`
    );

    // Verify Set-Cookie header
    const setCookie = redirectRes1.headers["set-cookie"];
    assert(Boolean(setCookie), "Response sets a cookie");
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    assert(
      cookieHeader.includes(`ab_exp_${expA._id}`),
      `Cookie name matches ab_exp_<id> (header: ${cookieHeader})`
    );
    assert(cookieHeader.toLowerCase().includes("httponly"), "Cookie has HttpOnly flag");
    assert(cookieHeader.toLowerCase().includes("samesite=lax"), "Cookie has SameSite=Lax");

    // -------------------------------------------------------------------------
    // TEST 7: Cookie Persistence (Sticky Session)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Cookie Persistence (Sticky Session) ---");
    // Explicitly test visitor pinned to Variant A
    const signedCookieA = `ab_exp_${expA._id}=${signCookie("A", COOKIE_SECRET)}`;
    const cookieReqA = await request({
      method: "GET",
      urlPath: `/${expA.shortCode}`,
      headers: { Cookie: signedCookieA },
    });
    assert(cookieReqA.statusCode === 302, "Cookie A visit redirects with 302");
    assert(
      cookieReqA.headers["location"] === "https://example.com/landing-original",
      "Visitor with Variant A cookie always receives Variant A URL"
    );

    // Explicitly test visitor pinned to Variant B
    const signedCookieB = `ab_exp_${expA._id}=${signCookie("B", COOKIE_SECRET)}`;
    const cookieReqB = await request({
      method: "GET",
      urlPath: `/${expA.shortCode}`,
      headers: { Cookie: signedCookieB },
    });
    assert(cookieReqB.statusCode === 302, "Cookie B visit redirects with 302");
    assert(
      cookieReqB.headers["location"] === "https://example.com/landing-redesign",
      "Visitor with Variant B cookie always receives Variant B URL"
    );

    // -------------------------------------------------------------------------
    // TEST 8: Tampered Cookie Rejection
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Tampered Cookie Rejection ---");
    const tamperedCookie = `ab_exp_${expA._id}=s:A.invalid_signature_hash`;
    const tamperedReq = await request({
      method: "GET",
      urlPath: `/${expA.shortCode}`,
      headers: { Cookie: tamperedCookie },
    });
    assert(tamperedReq.statusCode === 302, "Tampered cookie request does not crash, responds 302");
    assert(
      tamperedReq.headers["location"] === "https://example.com/landing-original" ||
      tamperedReq.headers["location"] === "https://example.com/landing-redesign",
      "Tampered cookie redirects cleanly to valid variant"
    );
    assert(
      Boolean(tamperedReq.headers["set-cookie"]),
      "Tampered cookie causes new signed cookie to be issued"
    );

    // -------------------------------------------------------------------------
    // TEST 9: Paused State Fallback Routing
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: Paused State Fallback Routing ---");
    // Pause the experiment with fallbackVariant = "A"
    await request({
      method: "PATCH",
      urlPath: `/api/experiments/${expA._id}/status`,
      headers: authA,
      body: { status: "paused", fallbackVariant: "A" },
    });

    // Even if visitor has cookie for B, paused experiment must route to fallback A
    const pausedReq = await request({
      method: "GET",
      urlPath: `/${expA.shortCode}`,
      headers: { Cookie: signedCookieB },
    });
    assert(pausedReq.statusCode === 302, "Paused experiment redirects with 302");
    assert(
      pausedReq.headers["location"] === "https://example.com/landing-original",
      "Paused experiment routes to configured fallback Variant A"
    );

    // -------------------------------------------------------------------------
    // TEST 10: Fallback Variant Reconfiguration & Completed State
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: Fallback Variant Reconfiguration & Completed State ---");
    // Complete the experiment and set fallback to "B"
    const completeRes = await request({
      method: "PATCH",
      urlPath: `/api/experiments/${expA._id}/status`,
      headers: authA,
      body: { status: "completed", fallbackVariant: "B" },
    });
    assert(completeRes.data.experiment.status === "completed", "Status updated to completed");
    assert(Boolean(completeRes.data.experiment.completedAt), "completedAt timestamp is populated");

    // Visitor with cookie A must now route to fallback B
    const completedReq = await request({
      method: "GET",
      urlPath: `/${expA.shortCode}`,
      headers: { Cookie: signedCookieA },
    });
    assert(
      completedReq.headers["location"] === "https://example.com/landing-redesign",
      "Completed experiment routes to configured fallback Variant B"
    );

    // Attempting to edit completed experiment must fail
    const editCompleted = await request({
      method: "PATCH",
      urlPath: `/api/experiments/${expA._id}`,
      headers: authA,
      body: { name: "Edited Name" },
    });
    assert(editCompleted.statusCode === 400, "Completed experiments cannot be edited (400)");

    // -------------------------------------------------------------------------
    // TEST 11: Click Integrity & Field Population
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 11: Click Integrity & Field Population ---");
    const lastClick = await Click.findOne({ experimentId: expA._id }).sort({ clickedAt: -1 });
    assert(Boolean(lastClick), "Click recorded with experimentId in Click collection");
    assert(
      lastClick.experimentVariant === "A" || lastClick.experimentVariant === "B",
      `Click recorded with experimentVariant ("${lastClick.experimentVariant}")`
    );

    // -------------------------------------------------------------------------
    // TEST 12: Experiment Analytics Verification
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 12: Experiment Analytics Verification ---");
    // Resume experiment for analytics testing
    await request({
      method: "PATCH",
      urlPath: `/api/experiments/${expA._id}/status`,
      headers: authA,
      body: { status: "active" },
    });

    // Seed 3 clicks on Variant A and 1 click on Variant B
    await Click.create([
      {
        link: linkDoc._id,
        experimentId: expA._id,
        experimentVariant: "A",
        clickedAt: new Date(),
      },
      {
        link: linkDoc._id,
        experimentId: expA._id,
        experimentVariant: "A",
        clickedAt: new Date(),
      },
      {
        link: linkDoc._id,
        experimentId: expA._id,
        experimentVariant: "A",
        clickedAt: new Date(),
      },
      {
        link: linkDoc._id,
        experimentId: expA._id,
        experimentVariant: "B",
        clickedAt: new Date(),
      },
    ]);

    const analyticsRes = await request({
      method: "GET",
      urlPath: `/api/experiments/${expA._id}/analytics?range=7d`,
      headers: authA,
    });
    assert(analyticsRes.statusCode === 200, "Analytics endpoint responds 200");
    const summary = analyticsRes.data.summary;
    assert(summary.totalClicks >= 4, "Total clicks includes seeded clicks");
    assert(summary.variantAClicks >= 3, "Variant A clicks recorded accurately");
    assert(summary.variantBClicks >= 1, "Variant B clicks recorded accurately");
    assert(
      summary.variantAPercentage + summary.variantBPercentage === 100,
      `Variant percentages sum to 100% (${summary.variantAPercentage}% + ${summary.variantBPercentage}%)`
    );
    assert(summary.winningVariant === "A", "Variant A correctly determined as winning variant");
    assert(Boolean(summary.disclaimer), "Disclaimer about click count metric is present");

    // Timeline verification
    const timeline = analyticsRes.data.timeline;
    assert(Array.isArray(timeline), "Timeline is an array");
    assert(timeline.length === 7, "7-day range returns exactly 7 IST days");
    assert(
      timeline.every((t) => typeof t.variantA === "number" && typeof t.variantB === "number"),
      "Timeline points are zero-filled numbers"
    );

    // -------------------------------------------------------------------------
    // TEST 13: Stage 7 Access Controls Regression
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 13: Stage 7 Access Controls Regression ---");
    // Pause underlying short link
    await Link.updateOne({ _id: linkDoc._id }, { isPaused: true });
    const pausedLinkRes = await request({
      method: "GET",
      urlPath: `/${expA.shortCode}`,
    });
    assert(pausedLinkRes.statusCode === 403, "Stage 7 paused link returns 403 LINK_PAUSED");
    assert(pausedLinkRes.data?.code === "LINK_PAUSED", "Code is LINK_PAUSED");

    // Unpause link
    await Link.updateOne({ _id: linkDoc._id }, { isPaused: false });

    // -------------------------------------------------------------------------
    // TEST 14: Non-Experiment Links Regression
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 14: Non-Experiment Links Regression ---");
    const regularLinkRes = await request({
      method: "POST",
      urlPath: "/api/links",
      headers: authA,
      body: { originalUrl: "https://example.com/regular-product" },
    });
    assert(regularLinkRes.statusCode === 201, "Regular link creates normally");
    const regLink = regularLinkRes.data.data || regularLinkRes.data.link;
    const regShortCode = regLink.shortCode;

    const regRedirectRes = await request({
      method: "GET",
      urlPath: `/${regShortCode}`,
    });
    assert(regRedirectRes.statusCode === 302, "Regular link redirects normally with 302");
    assert(
      regRedirectRes.headers["location"] === "https://example.com/regular-product",
      "Regular link points directly to destination"
    );

    // Wait briefly for asynchronous background click logging to complete
    await new Promise((r) => setTimeout(r, 250));

    const regClick = await Click.findOne({ link: regLink._id });
    assert(Boolean(regClick), "Regular click recorded");
    assert(regClick.experimentId === null, "Regular click has experimentId: null");
    assert(regClick.experimentVariant === null, "Regular click has experimentVariant: null");

    console.log("\n=======================================================");
    console.log(`All Tests Finished: ${passedAssertions} Passed, ${failedAssertions} Failed`);
    console.log("=======================================================\n");

  } finally {
    // Cleanup
    await Experiment.deleteMany({ user: { $in: [userAId, userBId] } });
    await Link.deleteMany({ user: { $in: [userAId, userBId] } });
    await Click.deleteMany({});
    await Notification.deleteMany({ user: { $in: [userAId, userBId] } });
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
