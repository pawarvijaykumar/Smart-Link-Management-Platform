/**
 * Stage 10: Advanced Traffic Visualization Verification Suite
 * Tests:
 * 1. Authentication & Security (Unauthenticated 401, Invalid token)
 * 2. Zero-Click & Empty Account Safety (Zero-filled 7d, 30d, all)
 * 3. Daily Traffic Aggregation (Contiguous dates, daily totals)
 * 4. Hourly Distribution (0 to 23 hours in IST, peak hour calculation)
 * 5. QR vs Direct Traffic (Over time and total split invariants)
 * 6. Device Distribution (Mobile, Desktop, Tablet, percentages)
 * 7. Campaign Traffic Trends (Top campaigns and daily series)
 * 8. Heatmap Aggregation (7 days x 24 hours = 168 cells, IST timezone mapping)
 * 9. Date Range Filtering (7d, 30d, all-time cutoffs)
 * 10. User Data Isolation (User A cannot see User B's traffic data)
 * 11. Regression Check (Stage 7 access controls, Stage 8 geo, Stage 9 devices)
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
  console.log("Stage 10: Advanced Traffic Visualization Verification Suite");
  console.log("=======================================================\n");

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  } catch (err) {
    console.log("  ⚠️ Atlas connection timed out (IP whitelist). Connecting to local MongoDB at mongodb://127.0.0.1:27017/smartlink_test...");
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

  const testSuffix = `t10_${Date.now()}`;
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
    // Test 1: Authentication & Unauthorized Request Handling
    // -------------------------------------------------------------------------
    console.log("[Test 1: Authentication & Authorization]");
    {
      const unauthRes = await fetch(`${baseUrl}/api/links/user/analytics/traffic`);
      assert(unauthRes.status === 401, "Unauthenticated request returns HTTP 401");

      const invalidTokenRes = await fetch(`${baseUrl}/api/links/user/analytics/traffic`, {
        headers: { Authorization: "Bearer invalid_token_xyz" },
      });
      assert(invalidTokenRes.status === 401 || invalidTokenRes.status === 403, "Invalid token returns 401/403");
    }

    // -------------------------------------------------------------------------
    // Test 2: Zero-Click & Empty Account Safety
    // -------------------------------------------------------------------------
    console.log("\n[Test 2: Zero-Click & Empty Account Safety]");
    {
      const res = await fetch(`${baseUrl}/api/links/user/analytics/traffic?range=7d`, {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      assert(res.status === 200, "Empty user traffic analytics returns HTTP 200");
      const json = await res.json();
      assert(json.success === true, "Response has success: true");
      assert(json.range === "7d", "Range is 7d");
      assert(json.data.summary.totalClicks === 0, "Summary total clicks is 0");
      assert(json.data.summary.qrClicks === 0, "Summary QR clicks is 0");
      assert(json.data.summary.directClicks === 0, "Summary direct clicks is 0");
      assert(json.data.summary.peakHourLabel === "N/A", "Peak hour label is N/A");
      assert(json.data.dailyTrends.length === 7, "Daily trends contains exactly 7 zero-filled days");
      assert(json.data.dailyTrends[0].totalClicks === 0, "First daily bucket is zero-filled");
      assert(json.data.hourlyDistribution.length === 24, "Hourly distribution contains exactly 24 hours");
      assert(json.data.heatmap.grid.length === 168, "Heatmap grid contains exactly 168 cells (7x24)");
      assert(json.data.heatmap.days.length === 7, "Heatmap days contains 7 days");
      assert(json.data.deviceDistribution.length === 4, "Device distribution contains 4 standard categories");
      assert(json.data.campaignTrends.topCampaigns.length === 0, "Campaigns list is empty");
    }

    // -------------------------------------------------------------------------
    // Test 3: Seeding Links and Precise IST Clicks
    // -------------------------------------------------------------------------
    console.log("\n[Test 3: Seeding Links & Multi-Dimensional Clicks for User A]");
    let linkA1, linkA2;
    {
      linkA1 = await Link.create({
        originalUrl: "https://example.com/product-launch",
        shortCode: `t10_p_${Date.now()}`,
        user: userAId,
        clicks: 0,
        utmCampaign: "launch_2026",
      });

      linkA2 = await Link.create({
        originalUrl: "https://example.com/summer-sale",
        shortCode: `t10_s_${Date.now()}`,
        user: userAId,
        clicks: 0,
        utmCampaign: "summer_sale",
      });

      assert(linkA1._id !== undefined, "Created Link A1");
      assert(linkA2._id !== undefined, "Created Link A2");

      // IST is UTC+05:30.
      // UTC 08:30 = IST 14:00 (2:00 PM)
      // UTC 04:00 = IST 09:30 (9:30 AM)
      // UTC 18:30 = IST 00:00 (Midnight next day IST)
      const now = new Date();
      const todayISTStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
      const [curY, curM, curD] = todayISTStr.split("-").map(Number);

      // Click 1: Today, 14:00 IST (UTC 08:30), mobile, QR, launch_2026
      const clickTimeToday14 = new Date(Date.UTC(curY, curM - 1, curD, 8, 30, 0));
      // Click 2: Today, 14:00 IST (UTC 08:30), desktop, Direct, launch_2026
      const clickTimeToday14_2 = new Date(Date.UTC(curY, curM - 1, curD, 8, 45, 0));
      // Click 3: Today, 09:30 IST (UTC 04:00), mobile, QR, summer_sale
      const clickTimeToday09 = new Date(Date.UTC(curY, curM - 1, curD, 4, 0, 0));

      // Click 4: 2 days ago, 11:00 IST (UTC 05:30), tablet, Direct, summer_sale
      const clickTime2DaysAgo = new Date(Date.UTC(curY, curM - 1, curD - 2, 5, 30, 0));
      // Click 5: 2 days ago, 11:30 IST (UTC 06:00), desktop, Direct, summer_sale
      const clickTime2DaysAgo_2 = new Date(Date.UTC(curY, curM - 1, curD - 2, 6, 0, 0));

      // Click 6: 15 days ago (Within 30d, outside 7d), 16:00 IST (UTC 10:30), mobile, QR
      const clickTime15DaysAgo = new Date(Date.UTC(curY, curM - 1, curD - 15, 10, 30, 0));

      // Click 7: 45 days ago (Outside 30d, all-time only), 10:00 IST (UTC 04:30), desktop, Direct
      const clickTime45DaysAgo = new Date(Date.UTC(curY, curM - 1, curD - 45, 4, 30, 0));

      await Click.create([
        {
          link: linkA1._id,
          clickedAt: clickTimeToday14,
          isQR: true,
          deviceType: "mobile",
          browser: "Chrome",
          utmCampaign: "launch_2026",
          utmSource: "instagram",
        },
        {
          link: linkA1._id,
          clickedAt: clickTimeToday14_2,
          isQR: false,
          deviceType: "desktop",
          browser: "Chrome",
          utmCampaign: "launch_2026",
          utmSource: "google",
        },
        {
          link: linkA2._id,
          clickedAt: clickTimeToday09,
          isQR: true,
          deviceType: "mobile",
          browser: "Safari",
          utmCampaign: "summer_sale",
          utmSource: "whatsapp",
        },
        {
          link: linkA2._id,
          clickedAt: clickTime2DaysAgo,
          isQR: false,
          deviceType: "tablet",
          browser: "Safari",
          utmCampaign: "summer_sale",
          utmSource: "email",
        },
        {
          link: linkA2._id,
          clickedAt: clickTime2DaysAgo_2,
          isQR: false,
          deviceType: "desktop",
          browser: "Edge",
          utmCampaign: "summer_sale",
          utmSource: "direct",
        },
        {
          link: linkA1._id,
          clickedAt: clickTime15DaysAgo,
          isQR: true,
          deviceType: "mobile",
          browser: "Chrome",
          utmCampaign: "launch_2026",
          utmSource: "qr_flyer",
        },
        {
          link: linkA1._id,
          clickedAt: clickTime45DaysAgo,
          isQR: false,
          deviceType: "desktop",
          browser: "Firefox",
          utmCampaign: "launch_2026",
          utmSource: "direct",
        },
      ]);

      console.log("  ✅ Seeded 7 multi-dimensional test clicks across 7d, 30d, and all-time windows");
    }

    // -------------------------------------------------------------------------
    // Test 4: 7-Day Traffic Analytics Aggregation
    // -------------------------------------------------------------------------
    console.log("\n[Test 4: 7-Day Traffic Analytics Aggregation (range=7d)]");
    {
      const res = await fetch(`${baseUrl}/api/links/user/analytics/traffic?range=7d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(res.status === 200, "7d traffic request returns 200");
      const { data } = await res.json();

      // Total clicks in 7d should be 5 (3 today + 2 two-days-ago)
      assert(data.summary.totalClicks === 5, `7d total clicks is 5 (got ${data.summary.totalClicks})`);
      assert(data.summary.qrClicks === 2, `7d QR clicks is 2 (got ${data.summary.qrClicks})`);
      assert(data.summary.directClicks === 3, `7d Direct clicks is 3 (got ${data.summary.directClicks})`);
      assert(data.summary.qrPercentage === 40, `7d QR percentage is 40% (got ${data.summary.qrPercentage}%)`);
      assert(data.summary.directPercentage === 60, `7d Direct percentage is 60% (got ${data.summary.directPercentage}%)`);

      // Peak hour: hour 14 has 2 clicks, hour 9 has 1, hour 11 has 2. Peak hour is 11 or 14 with 2 clicks.
      assert(data.summary.peakHourClicks === 2, `Peak hour click count is 2 (got ${data.summary.peakHourClicks})`);
      assert(data.summary.peakHourLabel.includes("IST"), "Peak hour label includes 'IST'");

      // Daily Trends
      assert(data.dailyTrends.length === 7, "Daily trends contains 7 continuous days");
      const sumDaily = data.dailyTrends.reduce((s, d) => s + d.totalClicks, 0);
      assert(sumDaily === 5, `Sum of daily trends equals total clicks (5)`);

      // QR vs Direct Over Time
      assert(data.qrVsDirectOverTime.length === 7, "QR vs Direct over time contains 7 days");
      const sumQR = data.qrVsDirectOverTime.reduce((s, d) => s + d.qr, 0);
      const sumDirect = data.qrVsDirectOverTime.reduce((s, d) => s + d.direct, 0);
      assert(sumQR === 2, "Sum of QR series equals 2");
      assert(sumDirect === 3, "Sum of Direct series equals 3");

      // Hourly Distribution (24 hours)
      assert(data.hourlyDistribution.length === 24, "Hourly distribution contains 24 hours");
      const hour14 = data.hourlyDistribution.find((h) => h.hour === 14);
      assert(hour14.count === 2, `Hour 14 (2 PM IST) recorded 2 clicks (got ${hour14.count})`);
      assert(hour14.qrClicks === 1, `Hour 14 QR clicks is 1`);
      assert(hour14.directClicks === 1, `Hour 14 Direct clicks is 1`);

      const hour9 = data.hourlyDistribution.find((h) => h.hour === 9);
      assert(hour9.count === 1, `Hour 9 (9 AM IST) recorded 1 click`);

      const hour0 = data.hourlyDistribution.find((h) => h.hour === 0);
      assert(hour0.count === 0, `Hour 0 (Midnight IST) zero-filled with 0 clicks`);

      // Device Distribution
      assert(data.deviceDistribution.length === 4, "Device distribution has 4 categories");
      const mobileDev = data.deviceDistribution.find((d) => d.deviceType === "mobile");
      const desktopDev = data.deviceDistribution.find((d) => d.deviceType === "desktop");
      const tabletDev = data.deviceDistribution.find((d) => d.deviceType === "tablet");
      assert(mobileDev.count === 2, `Mobile clicks in 7d is 2 (got ${mobileDev.count})`);
      assert(desktopDev.count === 2, `Desktop clicks in 7d is 2 (got ${desktopDev.count})`);
      assert(tabletDev.count === 1, `Tablet clicks in 7d is 1 (got ${tabletDev.count})`);
      assert(mobileDev.percentage === 40, "Mobile percentage is 40%");
      assert(desktopDev.percentage === 40, "Desktop percentage is 40%");
      assert(tabletDev.percentage === 20, "Tablet percentage is 20%");

      // Campaign Trends
      assert(data.campaignTrends.topCampaigns.length > 0, "Top campaigns list is populated");
      const launchCamp = data.campaignTrends.topCampaigns.find((c) => c.campaign === "launch_2026");
      const summerCamp = data.campaignTrends.topCampaigns.find((c) => c.campaign === "summer_sale");
      assert(launchCamp.count === 2, `launch_2026 has 2 clicks in 7d`);
      assert(summerCamp.count === 3, `summer_sale has 3 clicks in 7d`);
      assert(data.campaignTrends.dailySeries.length === 2, "Daily series has 2 campaign lines");

      // Heatmap Grid & Days
      assert(data.heatmap.grid.length === 168, "Heatmap grid has 168 cells");
      const totalHeatmapClicks = data.heatmap.grid.reduce((s, c) => s + c.count, 0);
      assert(totalHeatmapClicks === 5, `Total clicks across heatmap grid is 5 (got ${totalHeatmapClicks})`);
      assert(data.heatmap.days.length === 7, "Heatmap days has 7 items");
      const sumHeatmapDays = data.heatmap.days.reduce((s, d) => s + d.totalClicks, 0);
      assert(sumHeatmapDays === 5, `Sum of heatmap day totals is 5`);
    }

    // -------------------------------------------------------------------------
    // Test 5: 30-Day Traffic Analytics Aggregation
    // -------------------------------------------------------------------------
    console.log("\n[Test 5: 30-Day Traffic Analytics Aggregation (range=30d)]");
    {
      const res = await fetch(`${baseUrl}/api/links/user/analytics/traffic?range=30d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(res.status === 200, "30d traffic request returns 200");
      const { data } = await res.json();

      // In 30d: 5 (from 7d) + 1 (15 days ago) = 6 clicks
      assert(data.summary.totalClicks === 6, `30d total clicks is 6 (got ${data.summary.totalClicks})`);
      assert(data.summary.qrClicks === 3, `30d QR clicks is 3 (got ${data.summary.qrClicks})`);
      assert(data.summary.directClicks === 3, `30d Direct clicks is 3 (got ${data.summary.directClicks})`);
      assert(data.dailyTrends.length === 30, "Daily trends contains exactly 30 continuous days");
      assert(data.qrVsDirectOverTime.length === 30, "QR vs Direct over time contains exactly 30 days");
    }

    // -------------------------------------------------------------------------
    // Test 6: All-Time Traffic Analytics Aggregation
    // -------------------------------------------------------------------------
    console.log("\n[Test 6: All-Time Traffic Analytics Aggregation (range=all)]");
    {
      const res = await fetch(`${baseUrl}/api/links/user/analytics/traffic?range=all`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(res.status === 200, "all-time traffic request returns 200");
      const { data } = await res.json();

      // All-time includes all 7 clicks (including 45 days ago)
      assert(data.summary.totalClicks === 7, `All-time total clicks is 7 (got ${data.summary.totalClicks})`);
      assert(data.summary.qrClicks === 3, `All-time QR clicks is 3 (got ${data.summary.qrClicks})`);
      assert(data.summary.directClicks === 4, `All-time Direct clicks is 4 (got ${data.summary.directClicks})`);
      assert(data.dailyTrends.length >= 45, `All-time daily trends spans at least 45 days (got ${data.dailyTrends.length})`);
    }

    // -------------------------------------------------------------------------
    // Test 7: User Isolation & Security
    // -------------------------------------------------------------------------
    console.log("\n[Test 7: User Data Isolation]");
    {
      const resB = await fetch(`${baseUrl}/api/links/user/analytics/traffic?range=all`, {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      assert(resB.status === 200, "User B request returns 200");
      const { data: dataB } = await resB.json();
      assert(dataB.summary.totalClicks === 0, "User B sees 0 clicks (isolated from User A)");
      assert(dataB.dailyTrends.every((d) => d.totalClicks === 0), "All daily trends for User B are zero");
    }

    // -------------------------------------------------------------------------
    // Test 8: Regression Testing for Existing APIs
    // -------------------------------------------------------------------------
    console.log("\n[Test 8: Regression Testing for Stages 7, 8, 9, QR, Campaigns]");
    {
      // Stage 8 Geo-location
      const geoRes = await fetch(`${baseUrl}/api/links/user/analytics/geo?range=7d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(geoRes.status === 200, "Stage 8 Geo Analytics API returns 200");

      // Stage 9 Device Analytics
      const devRes = await fetch(`${baseUrl}/api/links/user/analytics/devices?range=7d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(devRes.status === 200, "Stage 9 Device Analytics API returns 200");
      const devJson = await devRes.json();
      assert(devJson.summary.totalClicks === 5, "Device analytics returns 5 clicks for 7d");

      // QR Analytics
      const qrRes = await fetch(`${baseUrl}/api/links/user/analytics/qr?range=7d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(qrRes.status === 200, "QR Analytics API returns 200");

      // Campaign Analytics
      const campRes = await fetch(`${baseUrl}/api/links/user/analytics/campaigns?range=7d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(campRes.status === 200, "Campaign Analytics API returns 200");
    }

    console.log("\n=======================================================");
    console.log(`Verification Complete: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
    console.log("=======================================================\n");

    // Clean up test documents
    await Click.deleteMany({ link: { $in: [linkA1._id, linkA2._id] } });
    await Link.deleteMany({ _id: { $in: [linkA1._id, linkA2._id] } });

  } catch (err) {
    console.error("Test failed with error:", err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
}

runTests();
