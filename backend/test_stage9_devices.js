/**
 * Stage 9: Device & Browser Intelligence Verification Suite
 * Tests:
 * 1. Unit tests on userAgentParser.js (iPhone, Android, Windows, macOS, Linux, Edge, Chrome, Safari, Firefox, cURL, empty, null)
 * 2. Live HTTP redirect with User-Agent capture into MongoDB Click document:
 *    - browserVersion, operatingSystem, osVersion, deviceVendor, deviceModel
 *    - Privacy: raw IP, clientIp, visitorIp NOT stored
 * 3. Preservation of Stage 7 access controls (paused, expired)
 * 4. User isolation and unauthenticated 401 handling
 * 5. Date filtering (7d, 30d, all)
 * 6. QR versus direct attribution by device category
 * 7. Aggregation integrity and mathematical invariants
 */

import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import http from "node:http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

import app from "./src/app.js";
import Link from "./src/models/link.model.js";
import Click from "./src/models/click.model.js";
import { User } from "./src/models/user.model.js";
import { parseUserAgent } from "./src/utils/userAgentParser.js";

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
  console.log("Stage 9: Device & Browser Intelligence Verification Suite");
  console.log("=======================================================\n");

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  } catch (err) {
    console.log("  ⚠️ Atlas connection timed out (IP whitelist). Connecting to local MongoDB at mongodb://127.0.0.1:27017/smartlink_test...");
    await mongoose.connect("mongodb://127.0.0.1:27017/smartlink_test");
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  const tokenUserA = jwt.sign(
    { userId: userAId.toString(), email: "dev_user_a@example.com" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const tokenUserB = jwt.sign(
    { userId: userBId.toString(), email: "dev_user_b@example.com" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  await User.deleteMany({ email: { $in: ["dev_user_a@example.com", "dev_user_b@example.com"] } });
  await User.create([
    { _id: userAId, username: "devusera", email: "dev_user_a@example.com", password: "Password123!" },
    { _id: userBId, username: "devuserb", email: "dev_user_b@example.com", password: "Password123!" },
  ]);

  try {
    // -------------------------------------------------------------------------
    // Test 1: Unit tests on userAgentParser.js
    // -------------------------------------------------------------------------
    console.log("[Test 1: User-Agent Parsing Across Platforms]");
    {
      // 1. iPhone
      const iphoneUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1";
      const iphone = parseUserAgent(iphoneUA);
      assert(iphone.deviceType === "mobile", "iPhone is mobile");
      assert(iphone.operatingSystem === "iOS", "iPhone OS is iOS");
      assert(iphone.osVersion === "17.4.1", "iPhone OS version is 17.4.1");
      assert(iphone.browser === "Safari", "iPhone browser is Safari");
      assert(iphone.browserVersion === "17.4", "iPhone browser version is 17.4");
      assert(iphone.deviceVendor === "Apple", "iPhone vendor is Apple");
      assert(iphone.deviceModel === "iPhone", "iPhone model is iPhone");

      // 2. iPad
      const ipadUA = "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
      const ipad = parseUserAgent(ipadUA);
      assert(ipad.deviceType === "tablet", "iPad is tablet");
      assert(ipad.operatingSystem === "iOS", "iPad OS is iOS");
      assert(ipad.deviceVendor === "Apple", "iPad vendor is Apple");
      assert(ipad.deviceModel === "iPad", "iPad model is iPad");

      // 3. Google Pixel 8 Pro
      const pixelUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36";
      const pixel = parseUserAgent(pixelUA);
      assert(pixel.deviceType === "mobile", "Pixel is mobile");
      assert(pixel.operatingSystem === "Android", "Pixel OS is Android");
      assert(pixel.osVersion === "14", "Pixel OS version is 14");
      assert(pixel.browser === "Chrome", "Pixel browser is Chrome");
      assert(pixel.browserVersion === "123.0", "Pixel browser version is 123.0");
      assert(pixel.deviceVendor === "Google", "Pixel vendor is Google");
      assert(pixel.deviceModel === "Pixel 8 Pro", "Pixel model is Pixel 8 Pro");

      // 4. Samsung Galaxy S23 Ultra
      const samsungUA = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
      const samsung = parseUserAgent(samsungUA);
      assert(samsung.deviceType === "mobile", "Samsung is mobile");
      assert(samsung.operatingSystem === "Android", "Samsung OS is Android");
      assert(samsung.osVersion === "13", "Samsung OS version is 13");
      assert(samsung.deviceVendor === "Samsung", "Samsung vendor is Samsung");
      assert(samsung.deviceModel === "SM-S918B", "Samsung model is SM-S918B");

      // 5. Samsung Internet Browser
      const samsungBrowserUA = "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/16.0 Chrome/92.0.4515.166 Mobile Safari/537.36";
      const sBrowser = parseUserAgent(samsungBrowserUA);
      assert(sBrowser.browser === "Samsung Internet", "Disambiguates Samsung Internet from Chrome");
      assert(sBrowser.browserVersion === "16.0", "Samsung Internet version is 16.0");

      // 6. Windows Edge
      const winEdgeUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.92";
      const winEdge = parseUserAgent(winEdgeUA);
      assert(winEdge.deviceType === "desktop", "Windows Edge is desktop");
      assert(winEdge.operatingSystem === "Windows", "Windows Edge OS is Windows");
      assert(winEdge.osVersion === "10/11", "Windows 10/11 version mapped");
      assert(winEdge.browser === "Edge", "Disambiguates Edge from Chrome");
      assert(winEdge.browserVersion === "122.0", "Edge browser version is 122.0");
      assert(winEdge.deviceVendor === "Unknown", "Desktop vendor is Unknown (no invention)");

      // 7. Windows Firefox
      const winFFUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0";
      const winFF = parseUserAgent(winFFUA);
      assert(winFF.browser === "Firefox", "Windows Firefox browser is Firefox");
      assert(winFF.browserVersion === "124.0", "Firefox browser version is 124.0");

      // 8. macOS Safari
      const macUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15";
      const mac = parseUserAgent(macUA);
      assert(mac.deviceType === "desktop", "Mac is desktop");
      assert(mac.operatingSystem === "macOS", "Mac OS is macOS");
      assert(mac.osVersion === "14.4.1", "Mac OS version is 14.4.1");
      assert(mac.browser === "Safari", "Mac browser is Safari");
      assert(mac.deviceVendor === "Apple", "Mac vendor is Apple");
      assert(mac.deviceModel === "Mac", "Mac model is Mac");

      // 9. Linux Chrome
      const linuxUA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
      const linux = parseUserAgent(linuxUA);
      assert(linux.operatingSystem === "Linux", "Linux OS is Linux");
      assert(linux.browser === "Chrome", "Linux browser is Chrome");

      // 10. Unknown, Empty, Null, Bot
      const emptyResult = parseUserAgent("");
      assert(emptyResult.deviceType === "unknown", "Empty UA returns unknown deviceType");
      assert(emptyResult.browser === "Unknown", "Empty UA returns Unknown browser");
      assert(emptyResult.operatingSystem === "Unknown", "Empty UA returns Unknown OS");

      const nullResult = parseUserAgent(null);
      assert(nullResult.operatingSystem === "Unknown", "Null UA returns Unknown OS");

      const curlResult = parseUserAgent("curl/7.88.1");
      assert(curlResult.browser === "cURL", "cURL detected as cURL");
      assert(curlResult.browserVersion === "7.88", "cURL version parsed");
    }

    // -------------------------------------------------------------------------
    // Test 2: Live HTTP Redirect & MongoDB Click Storage
    // -------------------------------------------------------------------------
    console.log("\n[Test 2: Live HTTP Redirect & MongoDB Click Storage]");
    let linkA1;
    {
      linkA1 = await Link.create({
        originalUrl: "https://example.com/dest-stage9",
        shortCode: `dev_${Date.now()}`,
        user: userAId,
      });

      // 1. Visit from iPhone Safari
      const iphoneUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1";
      const res1 = await fetch(`${baseUrl}/api/links/${linkA1.shortCode}`, {
        redirect: "manual",
        headers: {
          "user-agent": iphoneUA,
        },
      });
      assert(res1.status === 302, "HTTP 302 redirect returned immediately");

      // Wait for background async Click.create
      await new Promise((r) => setTimeout(r, 200));

      const click1 = await Click.findOne({ link: linkA1._id }).lean();
      assert(click1 !== null, "Click document inserted into MongoDB");
      assert(click1.deviceType === "mobile", "Click deviceType is mobile");
      assert(click1.browser === "Safari", "Click browser is Safari");
      assert(click1.browserVersion === "17.4", `Click browserVersion is 17.4 (got "${click1.browserVersion}")`);
      assert(click1.operatingSystem === "iOS", `Click operatingSystem is iOS (got "${click1.operatingSystem}")`);
      assert(click1.osVersion === "17.4.1", `Click osVersion is 17.4.1 (got "${click1.osVersion}")`);
      assert(click1.deviceVendor === "Apple", `Click deviceVendor is Apple (got "${click1.deviceVendor}")`);
      assert(click1.deviceModel === "iPhone", `Click deviceModel is iPhone (got "${click1.deviceModel}")`);
      assert(click1.isQR === false, "isQR is false for direct click");

      // PRIVACY CHECK: Verify IP is NOT stored in Click document
      assert(click1.ip === undefined, "PRIVACY: Raw IP field is not present");
      assert(click1.clientIp === undefined, "PRIVACY: clientIp field is not present");
      assert(click1.visitorIp === undefined, "PRIVACY: visitorIp field is not present");

      // 2. Visit from Pixel 8 Pro with QR scan (?qr=1)
      const pixelUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36";
      const res2 = await fetch(`${baseUrl}/api/links/${linkA1.shortCode}?qr=1`, {
        redirect: "manual",
        headers: {
          "user-agent": pixelUA,
        },
      });
      assert(res2.status === 302, "QR visit gets HTTP 302 redirect");

      await new Promise((r) => setTimeout(r, 200));

      const click2 = await Click.findOne({ link: linkA1._id, isQR: true }).lean();
      assert(click2 !== null, "QR Click document created");
      assert(click2.isQR === true, "isQR is true for QR visit");
      assert(click2.deviceType === "mobile", "Pixel is mobile");
      assert(click2.operatingSystem === "Android", "Pixel OS is Android");
      assert(click2.osVersion === "14", "Pixel OS version is 14");
      assert(click2.browser === "Chrome", "Pixel browser is Chrome");
      assert(click2.browserVersion === "123.0", "Pixel browserVersion is 123.0");
      assert(click2.deviceVendor === "Google", "Pixel deviceVendor is Google");
      assert(click2.deviceModel === "Pixel 8 Pro", "Pixel deviceModel is Pixel 8 Pro");
    }

    // -------------------------------------------------------------------------
    // Test 3: Preservation of Stage 7 Restrictions with Device Intelligence
    // -------------------------------------------------------------------------
    console.log("\n[Test 3: Preservation of Stage 7 Restrictions]");
    {
      const pausedLink = await Link.create({
        originalUrl: "https://example.com/paused-test",
        shortCode: `devpaused_${Date.now()}`,
        user: userAId,
        isPaused: true,
      });

      const resPaused = await fetch(`${baseUrl}/api/links/${pausedLink.shortCode}`, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      assert(resPaused.status === 403, "Paused link blocks redirect with 403");
      const pausedClicks = await Click.countDocuments({ link: pausedLink._id });
      assert(pausedClicks === 0, "No Click document created for paused redirect");

      const expiredLink = await Link.create({
        originalUrl: "https://example.com/expired-test",
        shortCode: `devexp_${Date.now()}`,
        user: userAId,
        expiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
      });

      const resExp = await fetch(`${baseUrl}/api/links/${expiredLink.shortCode}`, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      assert(resExp.status === 410, "Expired link blocks redirect with 410");
      const expClicks = await Click.countDocuments({ link: expiredLink._id });
      assert(expClicks === 0, "No Click document created for expired redirect");
    }

    // -------------------------------------------------------------------------
    // Test 4: Seeding Multi-Device & Date-Filtered Clicks for User A
    // -------------------------------------------------------------------------
    console.log("\n[Test 4: Seeding Multi-Device & Date-Filtered Traffic]");
    {
      const now = Date.now();
      const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);
      const fortyDaysAgo = new Date(now - 40 * 24 * 60 * 60 * 1000);

      await Click.create([
        // Within 7 days: Windows 10/11 Edge Desktop Direct
        {
          link: linkA1._id,
          clickedAt: twoDaysAgo,
          deviceType: "desktop",
          browser: "Edge",
          browserVersion: "122.0",
          operatingSystem: "Windows",
          osVersion: "10/11",
          deviceVendor: "Unknown",
          deviceModel: "Unknown",
          isQR: false,
        },
        // Within 7 days: macOS Safari Desktop Direct
        {
          link: linkA1._id,
          clickedAt: twoDaysAgo,
          deviceType: "desktop",
          browser: "Safari",
          browserVersion: "17.4",
          operatingSystem: "macOS",
          osVersion: "14.4.1",
          deviceVendor: "Apple",
          deviceModel: "Mac",
          isQR: false,
        },
        // Within 7 days: iPad Safari Tablet QR
        {
          link: linkA1._id,
          clickedAt: twoDaysAgo,
          deviceType: "tablet",
          browser: "Safari",
          browserVersion: "16.5",
          operatingSystem: "iOS",
          osVersion: "16.5",
          deviceVendor: "Apple",
          deviceModel: "iPad",
          isQR: true,
        },
        // Within 30 days: Android Samsung S23 Mobile QR
        {
          link: linkA1._id,
          clickedAt: tenDaysAgo,
          deviceType: "mobile",
          browser: "Samsung Internet",
          browserVersion: "16.0",
          operatingSystem: "Android",
          osVersion: "13",
          deviceVendor: "Samsung",
          deviceModel: "SM-S918B",
          isQR: true,
        },
        // Older than 30 days: Linux Firefox Desktop Direct
        {
          link: linkA1._id,
          clickedAt: fortyDaysAgo,
          deviceType: "desktop",
          browser: "Firefox",
          browserVersion: "124.0",
          operatingSystem: "Linux",
          osVersion: "Unknown",
          deviceVendor: "Unknown",
          deviceModel: "Unknown",
          isQR: false,
        },
      ]);
      console.log("  ✅ Traffic seeded across Mobile, Desktop, Tablet, and date buckets");
    }

    // -------------------------------------------------------------------------
    // Test 5: Device Analytics API (range=7d)
    // -------------------------------------------------------------------------
    console.log("\n[Test 5: Device Analytics API (range=7d)]");
    {
      const res = await fetch(`${baseUrl}/api/links/user/analytics/devices?range=7d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(res.status === 200, "GET /user/analytics/devices?range=7d returns 200");
      const data = await res.json();
      assert(data.success === true, "success is true");
      assert(data.range === "7d", "range is 7d");

      // In 7d: 2 from Test 2 (iPhone + Pixel) + 3 from Test 4 (Win Edge, Mac Safari, iPad Safari) = 5 clicks
      assert(data.summary.totalClicks === 5, `7d total clicks is 5 (got ${data.summary.totalClicks})`);
      assert(data.summary.mobileClicks === 2, `7d mobile clicks is 2 (got ${data.summary.mobileClicks})`);
      assert(data.summary.desktopClicks === 2, `7d desktop clicks is 2 (got ${data.summary.desktopClicks})`);
      assert(data.summary.tabletClicks === 1, `7d tablet clicks is 1 (got ${data.summary.tabletClicks})`);
      assert(data.summary.qrClicks === 2, `7d qr clicks is 2 (got ${data.summary.qrClicks})`);
      assert(data.summary.directClicks === 3, `7d direct clicks is 3 (got ${data.summary.directClicks})`);

      // Device types array
      assert(Array.isArray(data.deviceTypes), "deviceTypes is an array");
      assert(data.deviceTypes.length >= 3, "Contains mobile, desktop, tablet");

      // Operating systems array & versions
      assert(Array.isArray(data.operatingSystems), "operatingSystems is an array");
      const iosEntry = data.operatingSystems.find((os) => os.name === "iOS");
      assert(iosEntry !== undefined, "iOS is in operatingSystems");
      assert(iosEntry.totalClicks === 2, "iOS has 2 clicks (iPhone + iPad)");
      assert(Array.isArray(iosEntry.versions), "iOS has versions array");
      assert(iosEntry.versions.some((v) => v.version === "17.4.1"), "iOS 17.4.1 recorded");

      const androidEntry = data.operatingSystems.find((os) => os.name === "Android");
      assert(androidEntry !== undefined, "Android is in operatingSystems");
      assert(androidEntry.versions.some((v) => v.version === "14"), "Android 14 recorded");

      // Browsers array & versions
      assert(Array.isArray(data.browsers), "browsers is an array");
      const safariEntry = data.browsers.find((b) => b.name === "Safari");
      assert(safariEntry !== undefined, "Safari is in browsers");
      assert(safariEntry.versions.some((v) => v.version === "17.4"), "Safari 17.4 recorded");

      // Vendors & Models
      assert(Array.isArray(data.vendors), "vendors is an array");
      assert(data.vendors.some((v) => v.vendor === "Apple"), "Apple is in vendors");
      assert(data.vendors.some((v) => v.vendor === "Google"), "Google is in vendors");

      assert(Array.isArray(data.models), "models is an array");
      assert(data.models.some((m) => m.model === "Pixel 8 Pro"), "Pixel 8 Pro in models");
      assert(data.models.some((m) => m.model === "iPhone"), "iPhone in models");

      // QR vs Direct breakdown
      assert(Array.isArray(data.qrVsDirectByDevice), "qrVsDirectByDevice is an array");
      const mobileQR = data.qrVsDirectByDevice.find((d) => d.deviceType === "mobile");
      assert(mobileQR.qrClicks === 1, "Mobile QR clicks is 1");
      assert(mobileQR.directClicks === 1, "Mobile direct clicks is 1");

      // Invariant: total === mobile + desktop + tablet + unknown
      const sumCategories = data.summary.mobileClicks + data.summary.desktopClicks + data.summary.tabletClicks + data.summary.unknownClicks;
      assert(data.summary.totalClicks === sumCategories, "Invariant: total clicks equals sum of categories");
    }

    // -------------------------------------------------------------------------
    // Test 6: Device Analytics API (range=30d & range=all)
    // -------------------------------------------------------------------------
    console.log("\n[Test 6: Device Analytics API (range=30d & range=all)]");
    {
      const res30d = await fetch(`${baseUrl}/api/links/user/analytics/devices?range=30d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const data30d = await res30d.json();
      // 5 from 7d + 1 from 10 days ago (Samsung S23) = 6 clicks
      assert(data30d.summary.totalClicks === 6, `30d total clicks is 6 (got ${data30d.summary.totalClicks})`);
      assert(data30d.vendors.some((v) => v.vendor === "Samsung"), "Samsung appears in 30d vendors");
      assert(data30d.models.some((m) => m.model === "SM-S918B"), "SM-S918B appears in 30d models");

      const resAll = await fetch(`${baseUrl}/api/links/user/analytics/devices?range=all`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const dataAll = await resAll.json();
      // 6 from 30d + 1 from 40 days ago (Linux Firefox) = 7 clicks
      assert(dataAll.summary.totalClicks === 7, `All-time total clicks is 7 (got ${dataAll.summary.totalClicks})`);
      assert(dataAll.operatingSystems.some((os) => os.name === "Linux"), "Linux appears in all-time OS");
      assert(dataAll.browsers.some((b) => b.name === "Firefox"), "Firefox appears in all-time browsers");
    }

    // -------------------------------------------------------------------------
    // Test 7: User Isolation & Unauthenticated Security
    // -------------------------------------------------------------------------
    console.log("\n[Test 7: User Isolation & Security]");
    {
      // 1. Unauthenticated request
      const unauthRes = await fetch(`${baseUrl}/api/links/user/analytics/devices`);
      assert(unauthRes.status === 401, "Unauthenticated request returns 401");

      // 2. User B has no links
      const userBRes = await fetch(`${baseUrl}/api/links/user/analytics/devices`, {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      assert(userBRes.status === 200, "User B request returns 200");
      const userBData = await userBRes.json();
      assert(userBData.summary.totalClicks === 0, "User B has 0 total clicks");
      assert(userBData.deviceTypes.length === 0, "User B receives empty deviceTypes");
      assert(userBData.operatingSystems.length === 0, "User B receives empty operatingSystems");

      // 3. User B creates a link and gets 1 click
      const linkB = await Link.create({
        originalUrl: "https://example.com/user-b-dest",
        shortCode: `userb_${Date.now()}`,
        user: userBId,
      });

      await Click.create({
        link: linkB._id,
        clickedAt: new Date(),
        deviceType: "mobile",
        browser: "Chrome",
        browserVersion: "123.0",
        operatingSystem: "Android",
        osVersion: "14",
        deviceVendor: "Xiaomi",
        deviceModel: "Redmi Note 11",
        isQR: true,
      });

      const userBRes2 = await fetch(`${baseUrl}/api/links/user/analytics/devices`, {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const userBData2 = await userBRes2.json();
      assert(userBData2.summary.totalClicks === 1, "User B sees their 1 click");
      assert(userBData2.vendors.some((v) => v.vendor === "Xiaomi"), "User B sees Xiaomi");

      // 4. Verify User A does NOT see User B's Xiaomi click
      const userAResCheck = await fetch(`${baseUrl}/api/links/user/analytics/devices?range=all`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const userADataCheck = await userAResCheck.json();
      assert(userADataCheck.summary.totalClicks === 7, "User A clicks remain 7");
      assert(!userADataCheck.vendors.some((v) => v.vendor === "Xiaomi"), "User A does NOT see User B's Xiaomi traffic");
    }

    console.log("\n=======================================================");
    console.log(`Results: ${passedAssertions}/${passedAssertions + failedAssertions} assertions PASSED`);
    console.log("=======================================================\n");
  } finally {
    await Link.deleteMany({ user: { $in: [userAId, userBId] } });
    await Click.deleteMany({
      link: { $in: await Link.find({ user: { $in: [userAId, userBId] } }).distinct("_id") },
    });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
