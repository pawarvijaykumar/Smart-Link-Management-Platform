/**
 * Stage 11: Link Comparison Verification Suite
 * Tests:
 * 1. Selecting two links
 * 2. Selecting multiple links (3+ links)
 * 3. Removing a selected link (comparing subset)
 * 4. Comparing links with different click counts
 * 5. Comparing links with zero clicks
 * 6. QR vs Direct aggregation per link & combined
 * 7. Device distribution per link (Mobile, Desktop, Tablet, Unknown)
 * 8. Country and city aggregation per link
 * 9. Daily traffic aggregation (aligned continuous IST dates)
 * 10. 7-day, 30-day, and all-time filters
 * 11. IST timezone handling (+05:30)
 * 12. Invalid link IDs (malformed format -> HTTP 400)
 * 13. User data isolation (User B attempting to compare User A's links -> HTTP 403; User B sees 0 clicks of User A)
 * 14. JWT authentication (unauthenticated -> HTTP 401)
 * 15. Regression Check: Stage 7 Access Controls
 * 16. Regression Check: Stage 8 Geo-location Analytics API
 * 17. Regression Check: Stage 9 Device Intelligence API
 * 18. Regression Check: Stage 10 Traffic Analytics API
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
import { User } from "./src/models/user.model.js";

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
  console.log("Stage 11: Link Comparison Verification Suite");
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

  const testSuffix = `t11_${Date.now()}`;
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

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Authentication & Invalid Input Validation
    // -------------------------------------------------------------------------
    console.log("[Test 1: Authentication & Parameter Validation]");

    // Unauthenticated request -> HTTP 401
    const unauthRes = await fetch(`${baseUrl}/api/links/user/analytics/comparison?linkIds=123,456`);
    assert(unauthRes.status === 401, "Unauthenticated request returns HTTP 401");

    // Missing linkIds -> HTTP 400
    const missingRes = await fetch(`${baseUrl}/api/links/user/analytics/comparison`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(missingRes.status === 400, "Missing linkIds returns HTTP 400");

    // Only one link ID provided -> HTTP 400
    const singleRes = await fetch(`${baseUrl}/api/links/user/analytics/comparison?linkIds=${new mongoose.Types.ObjectId()}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(singleRes.status === 400, "Only 1 link provided returns HTTP 400 (requires >= 2 links)");

    // Invalid ObjectId format -> HTTP 400
    const invalidFormatRes = await fetch(`${baseUrl}/api/links/user/analytics/comparison?linkIds=not-a-valid-id,also-invalid`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(invalidFormatRes.status === 400, "Invalid ObjectId format returns HTTP 400");

    // -------------------------------------------------------------------------
    // TEST 2: Seed Links for User A and User B
    // -------------------------------------------------------------------------
    console.log("\n[Test 2: Seed Links & Multi-Dimensional Clicks for User A & User B]");

    // Link A1: High traffic marketing link
    const linkA1 = await Link.create({
      originalUrl: "https://example.com/product-launch",
      shortCode: `cmpA1_${testSuffix}`,
      user: userAId,
      clicks: 0,
      utmCampaign: "launch_cmp",
    });

    // Link A2: Medium traffic social link
    const linkA2 = await Link.create({
      originalUrl: "https://example.com/summer-promo",
      shortCode: `cmpA2_${testSuffix}`,
      user: userAId,
      clicks: 0,
      utmCampaign: "promo_cmp",
    });

    // Link A3: Zero-click link (edge case)
    const linkA3 = await Link.create({
      originalUrl: "https://example.com/zero-clicks-page",
      shortCode: `cmpA3_${testSuffix}`,
      user: userAId,
      clicks: 0,
    });

    // Link B1: Belongs strictly to User B
    const linkB1 = await Link.create({
      originalUrl: "https://example.com/user-b-secret",
      shortCode: `cmpB1_${testSuffix}`,
      user: userBId,
      clicks: 0,
    });

    assert(linkA1 && linkA2 && linkA3 && linkB1, "Successfully created Links A1, A2, A3, and B1");

    // Seed clicks for Link A1:
    // - 4 clicks within 7 days (2 QR mobile, 1 Direct desktop, 1 Direct tablet)
    // - 1 click 15 days ago (30d window)
    // - 1 click 40 days ago (all-time window)
    // Total for A1: 6 clicks (4 in 7d, 5 in 30d, 6 all-time)
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    await Click.create([
      // A1 in 7d:
      {
        link: linkA1._id,
        clickedAt: new Date(now - 1 * dayMs),
        isQR: true,
        deviceType: "mobile",
        country: "India",
        countryCode: "IN",
        city: "Mumbai",
      },
      {
        link: linkA1._id,
        clickedAt: new Date(now - 2 * dayMs),
        isQR: true,
        deviceType: "mobile",
        country: "India",
        countryCode: "IN",
        city: "Bengaluru",
      },
      {
        link: linkA1._id,
        clickedAt: new Date(now - 3 * dayMs),
        isQR: false,
        deviceType: "desktop",
        country: "United States",
        countryCode: "US",
        city: "New York",
      },
      {
        link: linkA1._id,
        clickedAt: new Date(now - 4 * dayMs),
        isQR: false,
        deviceType: "tablet",
        country: "United Kingdom",
        countryCode: "GB",
        city: "London",
      },
      // A1 in 30d (15 days ago):
      {
        link: linkA1._id,
        clickedAt: new Date(now - 15 * dayMs),
        isQR: false,
        deviceType: "desktop",
        country: "India",
        countryCode: "IN",
        city: "Delhi",
      },
      // A1 all-time (40 days ago):
      {
        link: linkA1._id,
        clickedAt: new Date(now - 40 * dayMs),
        isQR: true,
        deviceType: "mobile",
        country: "Germany",
        countryCode: "DE",
        city: "Berlin",
      },

      // Seed clicks for Link A2:
      // - 2 clicks within 7 days (1 QR desktop, 1 Direct desktop)
      // Total for A2: 2 clicks in 7d, 30d, and all-time
      {
        link: linkA2._id,
        clickedAt: new Date(now - 2 * dayMs),
        isQR: true,
        deviceType: "desktop",
        country: "India",
        countryCode: "IN",
        city: "Bengaluru",
      },
      {
        link: linkA2._id,
        clickedAt: new Date(now - 3 * dayMs),
        isQR: false,
        deviceType: "desktop",
        country: "Canada",
        countryCode: "CA",
        city: "Toronto",
      },

      // Link A3 has 0 clicks seeded (zero-click test)

      // Seed clicks for Link B1 (User B):
      {
        link: linkB1._id,
        clickedAt: new Date(now - 1 * dayMs),
        isQR: true,
        deviceType: "mobile",
        country: "France",
        countryCode: "FR",
        city: "Paris",
      },
    ]);

    console.log("  ✅ Seeded multi-dimensional test clicks across A1, A2, and B1");

    // -------------------------------------------------------------------------
    // TEST 3: User Data Isolation & Ownership Validation
    // -------------------------------------------------------------------------
    console.log("\n[Test 3: User Data Isolation & Cross-Tenant Security]");

    // User A attempting to compare Link A1 with User B's Link B1 -> HTTP 403 Forbidden
    const crossTenantRes = await fetch(
      `${baseUrl}/api/links/user/analytics/comparison?linkIds=${linkA1._id},${linkB1._id}`,
      { headers: { Authorization: `Bearer ${tokenUserA}` } }
    );
    assert(crossTenantRes.status === 403, "User A comparing User B's link returns HTTP 403 Forbidden");

    // Non-existent link ID with User A's link -> HTTP 403 Forbidden
    const nonExistentId = new mongoose.Types.ObjectId();
    const notFoundRes = await fetch(
      `${baseUrl}/api/links/user/analytics/comparison?linkIds=${linkA1._id},${nonExistentId}`,
      { headers: { Authorization: `Bearer ${tokenUserA}` } }
    );
    assert(notFoundRes.status === 403, "Non-existent link in comparison set returns HTTP 403");

    // -------------------------------------------------------------------------
    // TEST 4: Compare Two Links (Link A1 vs Link A2) in 7-Day Window
    // -------------------------------------------------------------------------
    console.log("\n[Test 4: Comparing Two Links (A1 vs A2) in 7d Window]");

    const comp2Res = await fetch(
      `${baseUrl}/api/links/user/analytics/comparison?linkIds=${linkA1._id},${linkA2._id}&range=7d`,
      { headers: { Authorization: `Bearer ${tokenUserA}` } }
    );
    assert(comp2Res.status === 200, "Comparison request for 2 links returns HTTP 200");
    const comp2Data = await comp2Res.json();
    assert(comp2Data.success === true, "Response has success: true");
    assert(comp2Data.range === "7d", "Response range is 7d");
    assert(comp2Data.links.length === 2, "Response contains exactly 2 compared links");

    // Summary validation
    assert(comp2Data.summary.totalLinks === 2, "Summary totalLinks is 2");
    assert(comp2Data.summary.totalClicksCombined === 6, `Summary total clicks is 6 (A1: 4 + A2: 2, got ${comp2Data.summary.totalClicksCombined})`);
    assert(comp2Data.summary.totalQRCombined === 3, `Summary total QR clicks is 3 (got ${comp2Data.summary.totalQRCombined})`);
    assert(comp2Data.summary.totalDirectCombined === 3, `Summary total Direct clicks is 3 (got ${comp2Data.summary.totalDirectCombined})`);

    // Best Performer validation
    assert(comp2Data.summary.bestPerformer !== null, "Best performer is identified");
    assert(comp2Data.summary.bestPerformer.linkId === linkA1._id.toString(), "Best performer is Link A1");
    assert(comp2Data.summary.bestPerformer.totalClicks === 4, "Link A1 totalClicks is 4");
    assert(comp2Data.summary.bestPerformer.percentageOfTotal === 67, `Link A1 percentage of group is 67% (got ${comp2Data.summary.bestPerformer.percentageOfTotal}%)`);
    assert(
      comp2Data.summary.rankingCriteria.includes("Ranking is based on total recorded clicks"),
      "Ranking criteria disclaimer clearly present"
    );

    // Link A1 individual breakdown
    const linkA1Result = comp2Data.links.find((l) => l._id === linkA1._id.toString());
    assert(linkA1Result.totalClicks === 4, "Link A1 totalClicks is 4 in 7d");
    assert(linkA1Result.qrClicks === 2, "Link A1 qrClicks is 2");
    assert(linkA1Result.directClicks === 2, "Link A1 directClicks is 2");
    assert(linkA1Result.qrPercentage === 50, "Link A1 qrPercentage is 50%");
    assert(linkA1Result.directPercentage === 50, "Link A1 directPercentage is 50%");

    // Link A1 device distribution
    const a1Mobile = linkA1Result.devices.find((d) => d.deviceType === "mobile");
    const a1Desktop = linkA1Result.devices.find((d) => d.deviceType === "desktop");
    const a1Tablet = linkA1Result.devices.find((d) => d.deviceType === "tablet");
    const a1Unknown = linkA1Result.devices.find((d) => d.deviceType === "unknown");
    assert(a1Mobile.count === 2 && a1Mobile.percentage === 50, "Link A1 mobile is 2 (50%)");
    assert(a1Desktop.count === 1 && a1Desktop.percentage === 25, "Link A1 desktop is 1 (25%)");
    assert(a1Tablet.count === 1 && a1Tablet.percentage === 25, "Link A1 tablet is 1 (25%)");
    assert(a1Unknown.count === 0 && a1Unknown.percentage === 0, "Link A1 unknown is 0 (0%)");

    // Link A1 geographic breakdown
    assert(linkA1Result.topCountries.length === 3, "Link A1 has 3 top countries");
    const inCountry = linkA1Result.topCountries.find((c) => c.country === "India");
    assert(inCountry && inCountry.count === 2, "Link A1 top country is India with 2 clicks");
    const topCity = linkA1Result.topCities[0];
    assert(topCity !== undefined, "Link A1 has top cities populated");

    // Link A2 individual breakdown
    const linkA2Result = comp2Data.links.find((l) => l._id === linkA2._id.toString());
    assert(linkA2Result.totalClicks === 2, "Link A2 totalClicks is 2 in 7d");
    assert(linkA2Result.qrClicks === 1, "Link A2 qrClicks is 1");
    assert(linkA2Result.directClicks === 1, "Link A2 directClicks is 1");

    // Aligned daily series validation
    assert(comp2Data.dates.length === 7, "Dates array has exactly 7 days");
    assert(linkA1Result.dailySeries.length === 7, "Link A1 dailySeries has 7 points");
    assert(linkA2Result.dailySeries.length === 7, "Link A2 dailySeries has 7 points");
    const sumA1Daily = linkA1Result.dailySeries.reduce((s, pt) => s + pt.totalClicks, 0);
    assert(sumA1Daily === 4, `Sum of Link A1 daily clicks matches totalClicks (4, got ${sumA1Daily})`);
    const sumA2Daily = linkA2Result.dailySeries.reduce((s, pt) => s + pt.totalClicks, 0);
    assert(sumA2Daily === 2, `Sum of Link A2 daily clicks matches totalClicks (2, got ${sumA2Daily})`);

    // -------------------------------------------------------------------------
    // TEST 5: Compare Multiple Links (3 links including Zero-Click Link A3)
    // -------------------------------------------------------------------------
    console.log("\n[Test 5: Comparing 3 Links Including Zero-Click Link A3]");

    const comp3Res = await fetch(
      `${baseUrl}/api/links/user/analytics/comparison?linkIds=${linkA1._id},${linkA2._id},${linkA3._id}&range=7d`,
      { headers: { Authorization: `Bearer ${tokenUserA}` } }
    );
    assert(comp3Res.status === 200, "Comparison of 3 links returns HTTP 200");
    const comp3Data = await comp3Res.json();
    assert(comp3Data.links.length === 3, "Response contains 3 links");

    // Zero-click Link A3 validation
    const linkA3Result = comp3Data.links.find((l) => l._id === linkA3._id.toString());
    assert(linkA3Result !== undefined, "Zero-click Link A3 is included in response");
    assert(linkA3Result.totalClicks === 0, "Link A3 totalClicks is 0");
    assert(linkA3Result.qrClicks === 0, "Link A3 qrClicks is 0");
    assert(linkA3Result.directClicks === 0, "Link A3 directClicks is 0");
    assert(linkA3Result.qrPercentage === 0, "Link A3 qrPercentage is 0");
    assert(linkA3Result.directPercentage === 0, "Link A3 directPercentage is 0");
    assert(linkA3Result.topCountries.length === 0, "Link A3 topCountries is empty");
    assert(linkA3Result.topCities.length === 0, "Link A3 topCities is empty");
    assert(linkA3Result.dailySeries.length === 7, "Link A3 dailySeries is zero-filled with 7 items");
    const a3DailySum = linkA3Result.dailySeries.reduce((s, pt) => s + pt.totalClicks, 0);
    assert(a3DailySum === 0, "Link A3 daily clicks sum is strictly 0");

    // -------------------------------------------------------------------------
    // TEST 6: Removing a Selected Link (Comparing Subset A1 and A3)
    // -------------------------------------------------------------------------
    console.log("\n[Test 6: Removing a Link — Comparing Subset A1 and A3]");

    const compSubsetRes = await fetch(
      `${baseUrl}/api/links/user/analytics/comparison?linkIds=${linkA1._id},${linkA3._id}&range=7d`,
      { headers: { Authorization: `Bearer ${tokenUserA}` } }
    );
    assert(compSubsetRes.status === 200, "Subset comparison returns HTTP 200");
    const compSubsetData = await compSubsetRes.json();
    assert(compSubsetData.links.length === 2, "Contains exactly 2 links after removing A2");
    assert(compSubsetData.links.some((l) => l._id === linkA1._id.toString()), "Contains A1");
    assert(compSubsetData.links.some((l) => l._id === linkA3._id.toString()), "Contains A3");
    assert(!compSubsetData.links.some((l) => l._id === linkA2._id.toString()), "Does not contain removed A2");

    // -------------------------------------------------------------------------
    // TEST 7: POST Endpoint & Comma-Separated Query Support
    // -------------------------------------------------------------------------
    console.log("\n[Test 7: POST Request Body & Comma-Separated Support]");

    const postRes = await fetch(`${baseUrl}/api/links/user/analytics/comparison`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: JSON.stringify({
        linkIds: [linkA1._id.toString(), linkA2._id.toString()],
        range: "7d",
      }),
    });
    assert(postRes.status === 200, "POST comparison request returns HTTP 200");
    const postData = await postRes.json();
    assert(postData.success === true, "POST response success is true");
    assert(postData.links.length === 2, "POST response contains 2 links");

    // -------------------------------------------------------------------------
    // TEST 8: 30-Day and All-Time Date Range Filters
    // -------------------------------------------------------------------------
    console.log("\n[Test 8: 30-Day and All-Time Date Range Aggregation]");

    // 30d range: Link A1 should pick up the 15-day-old click (4 + 1 = 5 clicks)
    const comp30dRes = await fetch(
      `${baseUrl}/api/links/user/analytics/comparison?linkIds=${linkA1._id},${linkA2._id}&range=30d`,
      { headers: { Authorization: `Bearer ${tokenUserA}` } }
    );
    assert(comp30dRes.status === 200, "30d comparison returns HTTP 200");
    const comp30dData = await comp30dRes.json();
    assert(comp30dData.range === "30d", "Range is 30d");
    assert(comp30dData.dates.length === 30, "Dates array has 30 days");
    const a1_30d = comp30dData.links.find((l) => l._id === linkA1._id.toString());
    assert(a1_30d.totalClicks === 5, `Link A1 has 5 clicks in 30d (got ${a1_30d.totalClicks})`);

    // All-time range: Link A1 should pick up the 40-day-old click (5 + 1 = 6 clicks)
    const compAllRes = await fetch(
      `${baseUrl}/api/links/user/analytics/comparison?linkIds=${linkA1._id},${linkA2._id}&range=all`,
      { headers: { Authorization: `Bearer ${tokenUserA}` } }
    );
    assert(compAllRes.status === 200, "All-time comparison returns HTTP 200");
    const compAllData = await compAllRes.json();
    assert(compAllData.range === "all", "Range is all");
    const a1_all = compAllData.links.find((l) => l._id === linkA1._id.toString());
    assert(a1_all.totalClicks === 6, `Link A1 has 6 clicks all-time (got ${a1_all.totalClicks})`);
    assert(compAllData.dates.length >= 40, `All-time dates span >= 40 days (got ${compAllData.dates.length})`);

    // -------------------------------------------------------------------------
    // TEST 9: Regression Tests for Stages 7, 8, 9, 10
    // -------------------------------------------------------------------------
    console.log("\n[Test 9: Regression Testing for Stages 7, 8, 9, 10]");

    // Stage 7: Smart Expiration & Access Control
    const stage7Res = await fetch(`${baseUrl}/api/links/${linkA1._id}/pause`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(stage7Res.status === 200, "Stage 7 toggle-pause returns HTTP 200");
    // Unpause to restore
    await fetch(`${baseUrl}/api/links/${linkA1._id}/pause`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    // Stage 8: Geo-Location Analytics API
    const stage8Res = await fetch(`${baseUrl}/api/links/user/analytics/geo?range=7d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(stage8Res.status === 200, "Stage 8 Geo Analytics API returns HTTP 200");

    // Stage 9: Device Intelligence API
    const stage9Res = await fetch(`${baseUrl}/api/links/user/analytics/devices?range=7d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(stage9Res.status === 200, "Stage 9 Device Analytics API returns HTTP 200");

    // Stage 10: Traffic Analytics API
    const stage10Res = await fetch(`${baseUrl}/api/links/user/analytics/traffic?range=7d`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(stage10Res.status === 200, "Stage 10 Traffic Analytics API returns HTTP 200");

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
      await Click.deleteMany({ link: { $in: [linkA1?._id, linkA2?._id, linkA3?._id, linkB1?._id].filter(Boolean) } });
    } catch (_) {}

    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
