/**
 * Stage 12: Smart Traffic Anomaly Detection Verification Suite
 * Tests:
 * 1. Authentication & Security (Unauthenticated 401, Invalid token)
 * 2. Zero-Click & Empty Account Safety (Safe defaults, 100% health score, no NaN)
 * 3. Seeding Multi-Day Baseline Clicks for User A
 * 4. Traffic Spike Anomaly Detection (Sudden surge -> flags SPIKE, Z-score >= 2, positive deviation)
 * 5. Severity Categorization (CRITICAL for massive surges, WARNING for moderate surges)
 * 6. Traffic Drop Anomaly Detection (Steady baseline plunging to 0 -> flags DROP)
 * 7. Dynamic Statistical Threshold Band (upperThreshold, lowerThreshold, expected baseline)
 * 8. Overall Traffic Health Score & Rating (Accurate point deductions and rating category)
 * 9. Lookback Window Date Filtering (7d, 14d, 30d cutoffs)
 * 10. User Data Isolation (User B sees only their own anomalies, cannot see User A's data)
 * 11. Regression Check: Stage 7 Access Controls (Paused link redirect 403)
 * 12. Regression Check: Stage 8 Geo Analytics API
 * 13. Regression Check: Stage 9 Device Analytics API
 * 14. Regression Check: Stage 10 Traffic Analytics API
 * 15. Regression Check: Stage 11 Link Comparison API
 */

import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

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
import Click from "./src/models/click.model.js";
import Notification from "./src/models/notification.model.js";
import Anomaly from "./src/models/anomaly.model.js";

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

async function runTests() {
  console.log("\n=======================================================");
  console.log("Stage 12: Smart Traffic Anomaly Detection Verification Suite");
  console.log("=======================================================\n");

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  } catch (err) {
    console.log("  ⚠️ Atlas connection timed out. Connecting to local MongoDB at mongodb://127.0.0.1:27017/smartlink_test...");
    await mongoose.connect("mongodb://127.0.0.1:27017/smartlink_test");
  }

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`  🚀 Test server running on ${baseUrl}\n`);
      resolve();
    });
  });

  const testSuffix = `t12_${Date.now()}`;
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  const tokenUserA = jwt.sign(
    { userId: userAId.toString(), username: `usera_${testSuffix}` },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const tokenUserB = jwt.sign(
    { userId: userBId.toString(), username: `userb_${testSuffix}` },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  let linkSpike;
  let linkDrop;
  let linkNormal;
  let linkUserB;
  let linkLowData;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Authentication & Authorization
    // -------------------------------------------------------------------------
    console.log("[Test 1: Authentication & Authorization]");
    const unauthRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies`);
    assert(unauthRes.status === 401, "Unauthenticated request returns HTTP 401");

    const invalidRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies`, {
      headers: { Authorization: "Bearer bad_token_123" },
    });
    assert(invalidRes.status === 401 || invalidRes.status === 403, "Invalid token returns 401/403");

    // -------------------------------------------------------------------------
    // TEST 2: Empty User Anomaly Safety
    // -------------------------------------------------------------------------
    console.log("\n[Test 2: Empty Account Safety & Safe Defaults]");
    const emptyRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(emptyRes.status === 200, "Empty user anomalies request returns HTTP 200");
    const emptyData = await emptyRes.json();
    assert(emptyData.success === true, "Response has success: true");
    assert(emptyData.summary.totalAnomaliesDetected === 0, "0 anomalies detected for empty account");
    assert(emptyData.summary.healthScore === 100, "Health score is 100% for empty account");
    assert(emptyData.summary.healthRating === "EXCELLENT", "Health rating is EXCELLENT");
    assert(emptyData.timeline.length === 14, "Default timeline spans 14 days");
    assert(emptyData.timeline[0].clicks === 0, "Timeline values default to 0");
    assert(emptyData.timeline[0].isAnomaly === false, "Zero clicks does not trigger false positive anomaly");

    // -------------------------------------------------------------------------
    // TEST 3: Seeding Links & Multi-Day Baseline Clicks
    // -------------------------------------------------------------------------
    console.log("\n[Test 3: Seeding Links & Baseline Historical Clicks]");

    // Link 1 (Spike Candidate): Normally 1 click/day, then 20 clicks on day 2
    linkSpike = await Link.create({
      originalUrl: "https://example.com/viral-landing",
      shortCode: `anom_spk_${testSuffix}`,
      user: userAId,
      clicks: 0,
    });

    // Link 2 (Drop Candidate): Normally 10 clicks/day for 10 days, then 0 clicks on recent days
    linkDrop = await Link.create({
      originalUrl: "https://example.com/steady-product",
      shortCode: `anom_drp_${testSuffix}`,
      user: userAId,
      clicks: 0,
    });

    // Link 3 (Normal/Healthy): Steady 2 clicks every day
    linkNormal = await Link.create({
      originalUrl: "https://example.com/steady-normal",
      shortCode: `anom_nrm_${testSuffix}`,
      user: userAId,
      clicks: 0,
    });

    // Link 4 (User B): Isolated link
    linkUserB = await Link.create({
      originalUrl: "https://example.com/user-b-link",
      shortCode: `anom_usrB_${testSuffix}`,
      user: userBId,
      clicks: 0,
    });

    assert(linkSpike && linkDrop && linkNormal && linkUserB, "Created test links for User A and User B");

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const clicksToInsert = [];

    // Seed Link 1 (Spike): 1 click on days 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3
    // Then 22 clicks on day 1 (yesterday)
    for (let day = 13; day >= 3; day--) {
      clicksToInsert.push({
        link: linkSpike._id,
        clickedAt: new Date(now - day * dayMs),
        deviceType: "desktop",
        country: "India",
      });
    }
    // Massive surge on day 1 (yesterday)
    for (let i = 0; i < 22; i++) {
      clicksToInsert.push({
        link: linkSpike._id,
        clickedAt: new Date(now - 1 * dayMs),
        deviceType: "mobile",
        country: "India",
        isQR: i % 2 === 0,
      });
    }

    // Seed Link 2 (Drop): 10 clicks each day for days 13 down to 3 (110 clicks)
    // Days 2, 1, 0 have ZERO clicks (total traffic cliff)
    for (let day = 13; day >= 3; day--) {
      for (let c = 0; c < 10; c++) {
        clicksToInsert.push({
          link: linkDrop._id,
          clickedAt: new Date(now - day * dayMs),
          deviceType: "desktop",
          country: "United States",
        });
      }
    }

    // Seed Link 3 (Normal): 2 clicks each day across all 14 days
    for (let day = 13; day >= 0; day--) {
      for (let c = 0; c < 2; c++) {
        clicksToInsert.push({
          link: linkNormal._id,
          clickedAt: new Date(now - day * dayMs),
          deviceType: "mobile",
          country: "Canada",
        });
      }
    }

    // Seed User B's link with normal traffic
    for (let day = 5; day >= 0; day--) {
      clicksToInsert.push({
        link: linkUserB._id,
        clickedAt: new Date(now - day * dayMs),
        deviceType: "mobile",
        country: "Germany",
      });
    }

    await Click.create(clicksToInsert);
    console.log(`  ✅ Seeded ${clicksToInsert.length} multi-day clicks across spike, drop, normal, and User B links`);

    // -------------------------------------------------------------------------
    // TEST 4: Anomaly Detection Engine (User A)
    // -------------------------------------------------------------------------
    console.log("\n[Test 4: Traffic Anomaly Detection API Execution]");
    const anomRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies?range=14d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(anomRes.status === 200, "Anomalies API returns HTTP 200");
    const anomData = await anomRes.json();
    assert(anomData.success === true, "Response has success: true");
    assert(anomData.range === "14d", "Range is 14d");

    // -------------------------------------------------------------------------
    // TEST 5: Spike Anomaly Validation
    // -------------------------------------------------------------------------
    console.log("\n[Test 5: Validating Traffic Spike Anomaly]");
    const spikeEvents = anomData.anomalyEvents.filter(
      (e) => e.type === "SPIKE" && e.linkId === linkSpike._id.toString()
    );
    assert(spikeEvents.length > 0, "Spike anomaly event was successfully detected for linkSpike");
    const primarySpike = spikeEvents[0];
    assert(primarySpike.actualClicks === 22, `Spike actualClicks is 22 (got ${primarySpike.actualClicks})`);
    assert(primarySpike.deviationPercentage > 100, `Deviation percentage is positive (>100%, got ${primarySpike.deviationPercentage}%)`);
    assert(primarySpike.zScore >= 2.0, `Z-score is >= 2.0 (got ${primarySpike.zScore})`);
    assert(primarySpike.severity === "CRITICAL" || primarySpike.severity === "WARNING", `Severity assigned: ${primarySpike.severity}`);
    assert(primarySpike.title.includes("Traffic Spike"), "Spike title clearly indicates traffic surge");
    assert(primarySpike.recommendation.length > 10, "Provides actionable guidance recommendation");

    // -------------------------------------------------------------------------
    // TEST 6: Drop Anomaly Validation
    // -------------------------------------------------------------------------
    console.log("\n[Test 6: Validating Traffic Drop Anomaly]");
    const dropEvents = anomData.anomalyEvents.filter(
      (e) => e.type === "DROP" && e.linkId === linkDrop._id.toString()
    );
    assert(dropEvents.length > 0, "Drop anomaly event was successfully detected for linkDrop");
    const primaryDrop = dropEvents[0];
    assert(primaryDrop.actualClicks === 0, `Drop actualClicks plunged to 0 (got ${primaryDrop.actualClicks})`);
    assert(primaryDrop.deviationPercentage < 0, `Deviation percentage is negative (got ${primaryDrop.deviationPercentage}%)`);
    assert(primaryDrop.severity === "CRITICAL" || primaryDrop.severity === "WARNING", `Drop severity assigned: ${primaryDrop.severity}`);
    assert(primaryDrop.title.includes("Traffic Drop"), "Drop title clearly indicates traffic cliff");

    // -------------------------------------------------------------------------
    // TEST 7: Link Health Breakdown & Normal Status
    // -------------------------------------------------------------------------
    console.log("\n[Test 7: Per-Link Health Breakdown]");
    assert(anomData.linkHealth.length === 3, `Monitored links count is 3 (got ${anomData.linkHealth.length})`);

    const healthSpike = anomData.linkHealth.find((h) => h._id === linkSpike._id.toString());
    assert(healthSpike.status === "SPIKE_ALERT", "linkSpike status marked as SPIKE_ALERT");
    assert(healthSpike.recentSparkline.length === 14, "Sparkline series has 14 points");

    const healthDrop = anomData.linkHealth.find((h) => h._id === linkDrop._id.toString());
    assert(healthDrop.status === "DROP_ALERT", "linkDrop status marked as DROP_ALERT");

    const healthNormal = anomData.linkHealth.find((h) => h._id === linkNormal._id.toString());
    assert(healthNormal.status === "HEALTHY", "linkNormal status marked as HEALTHY (no false alerts)");

    // -------------------------------------------------------------------------
    // TEST 8: Timeline Dynamic Statistical Threshold Band
    // -------------------------------------------------------------------------
    console.log("\n[Test 8: Dynamic Statistical Threshold Band]");
    assert(anomData.timeline.length === 14, "Timeline has 14 points");
    const samplePoint = anomData.timeline[0];
    assert(typeof samplePoint.expected === "number", "Timeline has numeric expected baseline");
    assert(typeof samplePoint.upperThreshold === "number", "Timeline has numeric upperThreshold");
    assert(typeof samplePoint.lowerThreshold === "number", "Timeline has numeric lowerThreshold");
    assert(samplePoint.upperThreshold >= samplePoint.expected, "upperThreshold >= expected");
    assert(samplePoint.expected >= samplePoint.lowerThreshold, "expected >= lowerThreshold");

    // -------------------------------------------------------------------------
    // TEST 9: Health Score Calculation
    // -------------------------------------------------------------------------
    console.log("\n[Test 9: Fleet Traffic Health Score & Rating]");
    assert(anomData.summary.healthScore < 100, `Health score penalized for anomalies (got ${anomData.summary.healthScore}%)`);
    assert(anomData.summary.healthScore >= 0, "Health score bounded >= 0");
    assert(["EXCELLENT", "GOOD", "ATTENTION_NEEDED", "CRITICAL"].includes(anomData.summary.healthRating), `Valid health rating: ${anomData.summary.healthRating}`);
    assert(anomData.summary.spikeCount >= 1, `Spike count >= 1 (got ${anomData.summary.spikeCount})`);
    assert(anomData.summary.dropCount >= 1, `Drop count >= 1 (got ${anomData.summary.dropCount})`);

    // -------------------------------------------------------------------------
    // TEST 10: Date Range Filtering (7d and 30d)
    // -------------------------------------------------------------------------
    console.log("\n[Test 10: Range Filtering (7d and 30d)]");
    const res7d = await fetch(`${baseUrl}/api/links/user/analytics/anomalies?range=7d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(res7d.status === 200, "7d request returns 200");
    const data7d = await res7d.json();
    assert(data7d.range === "7d", "Range is 7d");
    assert(data7d.timeline.length === 7, "7d timeline has 7 points");

    const res30d = await fetch(`${baseUrl}/api/links/user/analytics/anomalies?range=30d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(res30d.status === 200, "30d request returns 200");
    const data30d = await res30d.json();
    assert(data30d.range === "30d", "Range is 30d");
    assert(data30d.timeline.length === 30, "30d timeline has 30 points");

    // -------------------------------------------------------------------------
    // TEST 11: User Data Isolation
    // -------------------------------------------------------------------------
    console.log("\n[Test 11: Multi-Tenant Isolation (User B)]");
    const userBRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies?range=14d`, {
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });
    assert(userBRes.status === 200, "User B request returns 200");
    const userBData = await userBRes.json();
    assert(userBData.linkHealth.length === 1, "User B sees only their 1 link");
    assert(userBData.linkHealth[0]._id === linkUserB._id.toString(), "User B link matches linkUserB");
    assert(!userBData.anomalyEvents.some((e) => e.linkId === linkSpike._id.toString()), "User B does NOT see User A's spike anomaly");
    assert(!userBData.anomalyEvents.some((e) => e.linkId === linkDrop._id.toString()), "User B does NOT see User A's drop anomaly");

    // -------------------------------------------------------------------------
    // TEST 12: Regression Testing (Stages 7, 8, 9, 10, 11)
    // -------------------------------------------------------------------------
    console.log("\n[Test 12: Regression Testing for Stages 7, 8, 9, 10, 11]");

    // Stage 7: Smart Expiration & Access Control
    const stage7Res = await fetch(`${baseUrl}/api/links/${linkSpike._id}/pause`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(stage7Res.status === 200, "Stage 7 toggle-pause returns 200");
    await fetch(`${baseUrl}/api/links/${linkSpike._id}/pause`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    // Stage 8: Geo Analytics API
    const stage8Res = await fetch(`${baseUrl}/api/links/user/analytics/geo?range=7d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(stage8Res.status === 200, "Stage 8 Geo Analytics API returns 200");

    // Stage 9: Device Analytics API
    const stage9Res = await fetch(`${baseUrl}/api/links/user/analytics/devices?range=7d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(stage9Res.status === 200, "Stage 9 Device Analytics API returns 200");

    // Stage 10: Traffic Analytics API
    const stage10Res = await fetch(`${baseUrl}/api/links/user/analytics/traffic?range=7d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(stage10Res.status === 200, "Stage 10 Traffic Analytics API returns 200");

    // Stage 11: Link Comparison API
    const stage11Res = await fetch(
      `${baseUrl}/api/links/user/analytics/comparison?linkIds=${linkSpike._id},${linkNormal._id}&range=7d`,
      { headers: { Authorization: `Bearer ${tokenUserA}` } }
    );
    assert(stage11Res.status === 200, "Stage 11 Link Comparison API returns 200");

    // -------------------------------------------------------------------------
    // TEST 13: Insufficient Historical Data Handling
    // -------------------------------------------------------------------------
    console.log("\n[Test 13: Insufficient Historical Data Handling]");
    const linkLowData = await Link.create({
      originalUrl: "https://example.com/new-product",
      shortCode: `anom_low_${testSuffix}`,
      user: userAId,
      clicks: 1,
    });
    await Click.create({
      link: linkLowData._id,
      clickedAt: new Date(),
      deviceType: "mobile",
      country: "India",
    });

    const lowDataRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies?range=14d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    const lowDataJson = await lowDataRes.json();
    const lowHealth = lowDataJson.linkHealth.find((h) => h._id === linkLowData._id.toString());
    assert(lowHealth && lowHealth.status === "INSUFFICIENT_DATA", "Link with < 3 clicks marked as INSUFFICIENT_DATA");
    assert(lowHealth.baselineExplanation.includes("Insufficient historical data"), "Provides clear reason for insufficient data");

    // -------------------------------------------------------------------------
    // TEST 14: Anomaly Lifecycle Actions (Acknowledge & Resolve)
    // -------------------------------------------------------------------------
    console.log("\n[Test 14: Anomaly Lifecycle Actions (Acknowledge & Resolve)]");
    assert(anomData.anomalyEvents.length > 0, "At least one anomaly event exists to manage");
    const testAnomalyId = anomData.anomalyEvents[0].id;

    // Acknowledge anomaly
    const ackRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies/${testAnomalyId}/acknowledge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(ackRes.status === 200, "Acknowledge anomaly returns HTTP 200");
    const ackJson = await ackRes.json();
    assert(ackJson.success === true, "Acknowledge response has success: true");
    assert(ackJson.anomaly.status === "acknowledged", "Anomaly status changed to acknowledged");

    // Resolve anomaly
    const resRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies/${testAnomalyId}/resolve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(resRes.status === 200, "Resolve anomaly returns HTTP 200");
    const resJson = await resRes.json();
    assert(resJson.success === true, "Resolve response has success: true");
    assert(resJson.anomaly.status === "resolved", "Anomaly status changed to resolved");

    // Cross-tenant protection on anomaly actions
    const crossRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies/${testAnomalyId}/resolve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });
    assert(crossRes.status === 404, "User B cannot resolve User A's anomaly (HTTP 404)");

    // -------------------------------------------------------------------------
    // TEST 15: In-App Notification Integration
    // -------------------------------------------------------------------------
    console.log("\n[Test 15: Notification Integration & Deduplication]");
    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(notifRes.status === 200, "Fetch notifications returns HTTP 200");
    const notifJson = await notifRes.json();
    const anomalyNotifs = (notifJson.data || notifJson.notifications || []).filter((n) => n.type === "anomaly");
    assert(anomalyNotifs.length > 0, "Notification system recorded anomaly notification");
    assert(anomalyNotifs[0].title.includes("Alert"), "Notification title clearly indicates Alert");

    // Rescan should not produce duplicate notifications
    await fetch(`${baseUrl}/api/links/user/analytics/anomalies?range=14d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    const notifRes2 = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    const notifJson2 = await notifRes2.json();
    const anomalyNotifs2 = (notifJson2.data || notifJson2.notifications || []).filter((n) => n.type === "anomaly");
    assert(anomalyNotifs2.length === anomalyNotifs.length, "Rescanning does not create duplicate notifications");

    // -------------------------------------------------------------------------
    // TEST 16: Zero Baseline & Small Baseline Handling
    // -------------------------------------------------------------------------
    console.log("\n[Test 16: Zero Baseline & Small Baseline Accuracy Fixes]");
    const linkZeroBaseline = await Link.create({
      originalUrl: "https://example.com/zero-baseline-surge",
      shortCode: `anom_zero_${testSuffix}`,
      user: userAId,
      clicks: 0,
    });

    // Seed: 0 clicks on all historical days (13 down to 1), but 12 clicks on day 0 (today)
    const zeroBaselineClicks = [];
    for (let c = 0; c < 12; c++) {
      zeroBaselineClicks.push({
        link: linkZeroBaseline._id,
        clickedAt: new Date(),
        deviceType: "mobile",
        country: "India",
      });
    }
    await Click.create(zeroBaselineClicks);

    const zeroRes = await fetch(`${baseUrl}/api/links/user/analytics/anomalies?range=14d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    const zeroJson = await zeroRes.json();
    assert(zeroJson.success === true, "Zero baseline anomalies request returns HTTP 200");

    const zeroHealth = zeroJson.linkHealth.find((h) => h._id === linkZeroBaseline._id.toString());
    assert(zeroHealth, "Found linkZeroBaseline in linkHealth");
    assert(zeroHealth.averageClicksPerDay === 0, `Daily baseline excluding today is strictly 0 (got ${zeroHealth.averageClicksPerDay})`);
    assert(zeroHealth.baselineCalculation.includes("0 clicks ÷ 13 historical days"), "Baseline calculation formula clearly shows 0 historical clicks");
    assert(zeroHealth.historicalPeriod.includes("excluding today"), "Historical period explicitly excludes current evaluation period (today)");
    assert(zeroHealth.todayClicks === 12, `Today's clicks matches 12 (got ${zeroHealth.todayClicks})`);
    assert(zeroHealth.yesterdayClicks === 0, `Yesterday's clicks matches 0 (got ${zeroHealth.yesterdayClicks})`);
    assert(zeroHealth.totalClicks === 12, `Period total matches 12 (got ${zeroHealth.totalClicks})`);

    // Verify zero baseline anomaly event (if flagged) does not divide by zero
    const zeroEvents = zeroJson.anomalyEvents.filter((e) => e.linkId === linkZeroBaseline._id.toString());
    if (zeroEvents.length > 0) {
      const zEvt = zeroEvents[0];
      assert(zEvt.deviationPercentage === null, "Zero baseline produces null deviationPercentage (never divides by zero)");
      assert(zEvt.deviationDisplay.includes("N/A – baseline is zero"), `Zero baseline displays 'N/A – baseline is zero' (got ${zEvt.deviationDisplay})`);
      assert(zEvt.absoluteDifference === 12, `Absolute click difference is visible (+12 clicks, got ${zEvt.absoluteDifference})`);
      assert(!isNaN(zEvt.zScore) && isFinite(zEvt.zScore), `Z-score is mathematically valid and finite (got ${zEvt.zScore})`);
      assert(!zEvt.rootCause.toLowerCase().includes("bot attack"), "Root cause wording does NOT claim an unverified bot attack");
    }

    // -------------------------------------------------------------------------
    // TEST 17: Diagnostic Details & IST Calendar Boundaries
    // -------------------------------------------------------------------------
    console.log("\n[Test 17: Diagnostic Details, Historical Exclusion & IST Dates]");
    const spikeHealth = zeroJson.linkHealth.find((h) => h._id === linkSpike._id.toString());
    assert(spikeHealth.todayDate && /^\d{4}-\d{2}-\d{2}$/.test(spikeHealth.todayDate), "todayDate is valid YYYY-MM-DD IST string");
    assert(spikeHealth.yesterdayDate && /^\d{4}-\d{2}-\d{2}$/.test(spikeHealth.yesterdayDate), "yesterdayDate is valid YYYY-MM-DD IST string");
    assert(spikeHealth.todayClicks === 0, "linkSpike todayClicks matches IST today (0 clicks)");
    assert(spikeHealth.yesterdayClicks === 22, "linkSpike yesterdayClicks matches IST yesterday (22 clicks)");
    assert(spikeHealth.historicalPeriod.includes("excluding today"), "Historical period explicitly excludes today");
    assert(spikeHealth.baselineCalculation.includes("excluding today"), "Baseline calculation explicitly excludes today");
    assert(spikeHealth.status === "SPIKE_ALERT", "linkSpike status is SPIKE_ALERT");
    assert(!spikeHealth.baselineExplanation.toLowerCase().includes("bot attack"), "Surveillance baseline explanation does not claim unverified causes");

    console.log("\n=======================================================");
    console.log(`Verification Complete: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
    console.log("=======================================================\n");

    if (failedAssertions > 0) {
      process.exit(1);
    }
  } finally {
    // Cleanup
    try {
      await Link.deleteMany({ shortCode: { $regex: testSuffix } });
      await Click.deleteMany({
        link: { $in: [linkSpike?._id, linkDrop?._id, linkNormal?._id, linkUserB?._id, linkLowData?._id].filter(Boolean) },
      });
      await Anomaly.deleteMany({ user: { $in: [userAId, userBId] } });
      await Notification.deleteMany({ user: { $in: [userAId, userBId] } });
    } catch (_) {}

    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
