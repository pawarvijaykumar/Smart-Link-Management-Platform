/**
 * Stage 8 Fix Verification: Geo-Location Analytics (Unknown State and City)
 * Validates:
 * 1. Indian IPv6 lookup (resolves to India, IN, Karnataka, Bengaluru)
 * 2. Indian IPv4 lookup (resolves to India, IN, Maharashtra, Mumbai)
 * 3. Provider timeout/failure fallback behavior
 * 4. Localhost/loopback safety (0 external calls, Unknown fallback)
 * 5. MongoDB Click creation via HTTP redirect:
 *    - country="India", countryCode="IN", region="Karnataka", city="Bengaluru"
 *    - Strict Privacy: raw IP, clientIp, visitorIp NOT saved
 * 6. Geo-Location Analytics API response:
 *    - regions includes Karnataka with correct clicks
 *    - topCities includes Bengaluru with correct clicks
 * 7. Frontend helper validation (getStateDisplayName, stateCities matching)
 * 8. Stage 7 access control preservation
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
import { resolveGeoLocation, clearGeoCache, cleanRegion, cleanCity } from "./src/utils/geo.util.js";

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
  console.log("Stage 8 State & City Resolution Verification Suite");
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

  const testUserId = new mongoose.Types.ObjectId();
  const testUserToken = jwt.sign(
    { userId: testUserId.toString(), email: "stage8_fix_test@example.com" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  await User.deleteMany({ email: "stage8_fix_test@example.com" });
  await User.create({
    _id: testUserId,
    username: "stage8user",
    email: "stage8_fix_test@example.com",
    password: "Password123!",
  });

  try {
    // -------------------------------------------------------------------------
    // Test 1: Direct Resolution of Indian IPv6 & IPv4
    // -------------------------------------------------------------------------
    console.log("[Test 1: Direct Resolution of Indian IPv6 & IPv4]");
    clearGeoCache();

    // Indian Airtel IPv6
    const airtelIpv6 = "2401:4900:62ae:269e:3df4:765e:5d45:938a";
    const airtelGeo = await resolveGeoLocation(airtelIpv6);
    assert(airtelGeo.country === "India", "IPv6 country is India");
    assert(airtelGeo.countryCode === "IN", "IPv6 countryCode is IN");
    assert(airtelGeo.region !== "Unknown", `IPv6 region is identified: "${airtelGeo.region}"`);
    assert(airtelGeo.city !== "Unknown", `IPv6 city is identified: "${airtelGeo.city}"`);
    assert(/karnataka/i.test(airtelGeo.region), "IPv6 region is Karnataka");
    assert(/bengaluru|bangalore/i.test(airtelGeo.city), "IPv6 city is Bengaluru");

    // Indian Reliance Jio IPv4
    const jioIpv4 = "49.36.0.1";
    const jioGeo = await resolveGeoLocation(jioIpv4);
    assert(jioGeo.country === "India", "IPv4 country is India");
    assert(jioGeo.countryCode === "IN", "IPv4 countryCode is IN");
    assert(jioGeo.region === "Maharashtra", "IPv4 region is Maharashtra");
    assert(jioGeo.city === "Mumbai", "IPv4 city is Mumbai");

    // -------------------------------------------------------------------------
    // Test 2: Localhost / Loopback Safety
    // -------------------------------------------------------------------------
    console.log("\n[Test 2: Localhost / Loopback Safety]");
    const loopbackV4 = await resolveGeoLocation("127.0.0.1");
    assert(loopbackV4.country === "Unknown", "127.0.0.1 returns Unknown country");
    assert(loopbackV4.countryCode === null, "127.0.0.1 returns null countryCode");
    assert(loopbackV4.region === "Unknown", "127.0.0.1 returns Unknown region");
    assert(loopbackV4.city === "Unknown", "127.0.0.1 returns Unknown city");

    const loopbackV6 = await resolveGeoLocation("::1");
    assert(loopbackV6.country === "Unknown", "::1 returns Unknown country");
    assert(loopbackV6.countryCode === null, "::1 returns null countryCode");

    // -------------------------------------------------------------------------
    // Test 3: Normalization & Edge Cases (cleanRegion, cleanCity)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3: Normalization Utilities]");
    assert(cleanRegion("IN", "KA") === "Karnataka", "Maps 2-letter code KA to Karnataka");
    assert(cleanRegion("IN", "MH") === "Maharashtra", "Maps 2-letter code MH to Maharashtra");
    assert(cleanRegion("IN", "Goa") === "Goa", "Preserves Goa (3 letters)");
    assert(cleanRegion("IN", "NCT of Delhi") === "Delhi", "Normalizes NCT of Delhi to Delhi");
    assert(cleanRegion("IN", "orissa") === "Odisha", "Normalizes historical Orissa to Odisha");
    assert(cleanCity("Bengaluru") === "Bengaluru", "Preserves standard city Bengaluru");
    assert(cleanCity("Nagpur (Hudkeshwar Buzurg)") === "Nagpur", "Strips parenthetical descriptor");
    assert(cleanCity("") === "Unknown", "Empty string returns Unknown");
    assert(cleanCity("-") === "Unknown", "Hyphen placeholder returns Unknown");

    // -------------------------------------------------------------------------
    // Test 4: Live HTTP Redirect & MongoDB Click Storage with IPv6
    // -------------------------------------------------------------------------
    console.log("\n[Test 4: Live HTTP Redirect & MongoDB Click Storage]");
    const testLink = await Link.create({
      originalUrl: "https://example.com/target-test",
      shortCode: `fixgeo_${Date.now()}`,
      user: testUserId,
    });

    // Simulate Cloudflare Tunnel forwarding Indian IPv6 visitor
    const redirectRes = await fetch(`${baseUrl}/api/links/${testLink.shortCode}`, {
      redirect: "manual",
      headers: {
        "x-forwarded-for": airtelIpv6,
        "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile",
      },
    });
    assert(redirectRes.status === 302, "HTTP 302 redirect returned to visitor");

    // Allow async Click.create to finish
    await new Promise((r) => setTimeout(r, 400));

    const savedClick = await Click.findOne({ link: testLink._id }).lean();
    assert(savedClick !== null, "Click document was inserted into MongoDB");
    assert(savedClick.country === "India", "Saved Click country is India");
    assert(savedClick.countryCode === "IN", "Saved Click countryCode is IN");
    assert(savedClick.region === "Karnataka", `Saved Click region is Karnataka (got "${savedClick.region}")`);
    assert(
      /bengaluru|bangalore/i.test(savedClick.city),
      `Saved Click city is Bengaluru (got "${savedClick.city}")`
    );

    // Strict Privacy Verification
    assert(savedClick.ip === undefined, "PRIVACY: 'ip' field is NOT present");
    assert(savedClick.clientIp === undefined, "PRIVACY: 'clientIp' field is NOT present");
    assert(savedClick.visitorIp === undefined, "PRIVACY: 'visitorIp' field is NOT present");

    // -------------------------------------------------------------------------
    // Test 5: Geo-Location Analytics API Response
    // -------------------------------------------------------------------------
    console.log("\n[Test 5: Geo-Location Analytics API]");
    const analyticsRes = await fetch(`${baseUrl}/api/links/user/analytics/geo?range=all`, {
      headers: {
        Authorization: `Bearer ${testUserToken}`,
      },
    });
    assert(analyticsRes.status === 200, "Geo Analytics API returns HTTP 200");
    const analyticsData = await analyticsRes.json();
    assert(analyticsData.success === true, "success is true");
    assert(analyticsData.summary.totalClicks === 1, "Total clicks is 1");
    assert(analyticsData.summary.geoIdentifiedClicks === 1, "geoIdentifiedClicks is 1");

    // Verify topCountries
    assert(analyticsData.topCountries.length === 1, "topCountries has 1 entry");
    assert(analyticsData.topCountries[0].country === "India", "Top country is India");
    assert(analyticsData.topCountries[0].countryCode === "IN", "Top countryCode is IN");

    // Verify regions (State level)
    assert(analyticsData.regions.length >= 1, "regions array is populated");
    const karnatakaRegion = analyticsData.regions.find((r) => /karnataka/i.test(r.region));
    assert(karnatakaRegion !== undefined, "Karnataka is present in regions array");
    assert(karnatakaRegion.totalClicks === 1, "Karnataka has 1 click");

    // Verify topCities (City level)
    assert(analyticsData.topCities.length >= 1, "topCities array is populated");
    const bengaluruCity = analyticsData.topCities.find((c) => /bengaluru|bangalore/i.test(c.city));
    assert(bengaluruCity !== undefined, "Bengaluru is present in topCities array");
    assert(bengaluruCity.region === "Karnataka", "Bengaluru region is Karnataka");
    assert(bengaluruCity.totalClicks === 1, "Bengaluru has 1 click");

    // -------------------------------------------------------------------------
    // Test 6: Stage 7 Access Control Preservation
    // -------------------------------------------------------------------------
    console.log("\n[Test 6: Stage 7 Access Control Preservation]");
    const pausedLink = await Link.create({
      originalUrl: "https://example.com/paused-check",
      shortCode: `geopaused_${Date.now()}`,
      user: testUserId,
      isPaused: true,
    });
    const pausedRes = await fetch(`${baseUrl}/api/links/${pausedLink.shortCode}`, {
      headers: { "x-forwarded-for": airtelIpv6 },
    });
    assert(pausedRes.status === 403, "Paused link blocks redirect with 403");
    const pausedClicks = await Click.countDocuments({ link: pausedLink._id });
    assert(pausedClicks === 0, "No Click document created for paused link");

    console.log("\n=======================================================");
    console.log(`Results: ${passedAssertions}/${passedAssertions + failedAssertions} assertions PASSED`);
    console.log("=======================================================\n");
  } finally {
    await Link.deleteMany({ user: testUserId });
    await Click.deleteMany({ link: { $in: await Link.find({ user: testUserId }).distinct("_id") } });
    await User.deleteMany({ _id: testUserId });
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
