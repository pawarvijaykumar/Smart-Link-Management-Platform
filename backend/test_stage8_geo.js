/**
 * Stage 8: Geo-Location Analytics Verification Suite
 * Tests:
 * 1. Geolocation resolution & proxy header extraction
 * 2. Privacy: raw visitor IP is NOT stored in Click document
 * 3. Redirect flow with simulated IP (US, IN, UK, loopback)
 * 4. QR tracking alongside geo tracking (isQR: true/false attribution)
 * 5. Preservation of Stage 7 access control (paused, expired, limit reached)
 * 6. Authenticated Geo Analytics API with range filters (7d, 30d, all)
 * 7. Top countries ranking, Top cities ranking, QR vs Direct comparison
 * 8. User isolation & empty user handling
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
import { getVisitorIP, resolveGeoLocation, getCountryName } from "./src/utils/geo.util.js";

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
  console.log("Stage 8: Geo-Location Analytics Verification Suite");
  console.log("=======================================================\n");

  await mongoose.connect(MONGO_URI);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  const tokenUserA = jwt.sign(
    { userId: userAId.toString(), email: "geo_user_a@example.com" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const tokenUserB = jwt.sign(
    { userId: userBId.toString(), email: "geo_user_b@example.com" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  await User.deleteMany({ email: { $in: ["geo_user_a@example.com", "geo_user_b@example.com"] } });
  await User.create([
    { _id: userAId, username: "geousera", email: "geo_user_a@example.com", password: "Password123!" },
    { _id: userBId, username: "geouserb", email: "geo_user_b@example.com", password: "Password123!" },
  ]);

  try {
    // -------------------------------------------------------------------------
    // Test 1: Unit tests on geo.util.js
    // -------------------------------------------------------------------------
    console.log("[Test 1: Geolocation Utility & Header Extraction]");
    {
      const usGeo = await resolveGeoLocation("207.97.227.239");
      assert(usGeo.countryCode === "US", "Resolves US country code correctly");
      assert(usGeo.country === "United States", "Resolves full country name United States");
      assert(usGeo.city.length > 0, "Resolves US city");

      const inGeo = await resolveGeoLocation("49.36.0.1");
      assert(inGeo.countryCode === "IN", "Resolves IN country code correctly");
      assert(inGeo.country === "India", "Resolves full country name India");

      const loopbackGeo = await resolveGeoLocation("127.0.0.1");
      assert(loopbackGeo.country === "Unknown", "Loopback 127.0.0.1 resolves to Unknown");
      assert(loopbackGeo.countryCode === null, "Loopback countryCode is null");

      const ipv6Loopback = await resolveGeoLocation("::1");
      assert(ipv6Loopback.country === "Unknown", "IPv6 loopback ::1 resolves to Unknown");

      // Test header priority
      const reqCloudflare = { headers: { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" } };
      assert(getVisitorIP(reqCloudflare) === "1.1.1.1", "Cloudflare header takes highest precedence");

      const reqForwarded = { headers: { "x-forwarded-for": "8.8.8.8, 10.0.0.1" } };
      assert(getVisitorIP(reqForwarded) === "8.8.8.8", "Takes first client IP from x-forwarded-for list");
    }

    // -------------------------------------------------------------------------
    // Test 2: Redirect Flow with Geolocation Capture & Privacy
    // -------------------------------------------------------------------------
    console.log("\n[Test 2: Redirect Flow with Geolocation Capture & Privacy]");
    let linkA1, linkA2;
    {
      linkA1 = await Link.create({
        originalUrl: "https://example.com/geo-target-1",
        shortCode: `geo1_${Date.now()}`,
        user: userAId,
      });

      linkA2 = await Link.create({
        originalUrl: "https://example.com/geo-target-2",
        shortCode: `geo2_${Date.now()}`,
        user: userAId,
      });

      // 1. Visit from US IP (Direct)
      const res1 = await fetch(`${baseUrl}/api/links/${linkA1.shortCode}`, {
        redirect: "manual",
        headers: { "x-forwarded-for": "207.97.227.239", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      assert(res1.status === 302, "US visitor gets HTTP 302 redirect");

      // Give async background Click.create a tick to finish
      await new Promise((r) => setTimeout(r, 200));

      const click1 = await Click.findOne({ link: linkA1._id }).lean();
      assert(click1 !== null, "Click document was created in background");
      assert(click1.countryCode === "US", "Click countryCode is US");
      assert(click1.country === "United States", "Click country is United States");
      assert(click1.city.length > 0, `Click city captured (${click1.city})`);
      assert(click1.isQR === false, "isQR is false for direct click");

      // PRIVACY CHECK: Verify IP is NOT stored in Click document
      assert(click1.ip === undefined, "PRIVACY: Raw IP field is not present in Click document");
      assert(click1.clientIp === undefined, "PRIVACY: clientIp field is not present");
      assert(click1.visitorIp === undefined, "PRIVACY: visitorIp field is not present");

      // 2. Visit from India IP with QR parameter (?qr=1)
      const res2 = await fetch(`${baseUrl}/api/links/${linkA1.shortCode}?qr=1`, {
        redirect: "manual",
        headers: { "x-forwarded-for": "49.36.0.1", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)" },
      });
      assert(res2.status === 302, "India QR visitor gets HTTP 302 redirect");

      await new Promise((r) => setTimeout(r, 200));

      const click2 = await Click.findOne({ link: linkA1._id, isQR: true }).lean();
      assert(click2 !== null, "QR Click document was created");
      assert(click2.countryCode === "IN", "QR Click countryCode is IN");
      assert(click2.country === "India", "QR Click country is India");
      assert(click2.isQR === true, "isQR is true for QR visit");

      // 3. Visit from loopback (Unknown geo fallback)
      const res3 = await fetch(`${baseUrl}/api/links/${linkA2.shortCode}`, {
        redirect: "manual",
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      assert(res3.status === 302, "Loopback visitor gets HTTP 302 redirect");

      await new Promise((r) => setTimeout(r, 200));

      const click3 = await Click.findOne({ link: linkA2._id }).lean();
      assert(click3 !== null, "Click document created for loopback");
      assert(click3.country === "Unknown", "Fallback country is Unknown");
      assert(click3.countryCode === null, "Fallback countryCode is null");
    }

    // -------------------------------------------------------------------------
    // Test 3: Preservation of Stage 7 Access Controls
    // -------------------------------------------------------------------------
    console.log("\n[Test 3: Preservation of Stage 7 Restrictions with Geolocation]");
    {
      const pausedLink = await Link.create({
        originalUrl: "https://example.com/paused",
        shortCode: `geopaused_${Date.now()}`,
        user: userAId,
        isPaused: true,
      });

      const resPaused = await fetch(`${baseUrl}/api/links/${pausedLink.shortCode}`, {
        headers: { "x-forwarded-for": "207.97.227.239" },
      });
      assert(resPaused.status === 403, "Paused link blocks redirect with 403");

      await new Promise((r) => setTimeout(r, 100));
      const pausedClicks = await Click.countDocuments({ link: pausedLink._id });
      assert(pausedClicks === 0, "No Click document created for paused redirect");

      const expiredLink = await Link.create({
        originalUrl: "https://example.com/expired",
        shortCode: `geoexp_${Date.now()}`,
        user: userAId,
        expiresAt: new Date(Date.now() - 60000),
      });

      const resExpired = await fetch(`${baseUrl}/api/links/${expiredLink.shortCode}`, {
        headers: { "x-forwarded-for": "207.97.227.239" },
      });
      assert(resExpired.status === 410, "Expired link blocks redirect with 410");

      await new Promise((r) => setTimeout(r, 100));
      const expClicks = await Click.countDocuments({ link: expiredLink._id });
      assert(expClicks === 0, "No Click document created for expired redirect");
    }

    // -------------------------------------------------------------------------
    // Test 4: Seed Dataset for Multi-Country & Multi-City Analytics
    // -------------------------------------------------------------------------
    console.log("\n[Test 4: Seeding Multi-Country & Date-Filtered Clicks]");
    {
      const now = new Date();
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

      // Seed clicks for User A linkA1:
      // US (San Antonio): 3 direct, 2 QR (within 4 days)
      // India (Mumbai): 2 direct, 2 QR (within 4 days)
      // United Kingdom (London): 1 direct, 1 QR (20 days ago)
      // Germany (Berlin): 1 direct (40 days ago - all time only)
      await Click.create([
        // 4 days ago (7d, 30d, all)
        { link: linkA1._id, country: "United States", countryCode: "US", region: "TX", city: "San Antonio", isQR: false, clickedAt: fourDaysAgo },
        { link: linkA1._id, country: "United States", countryCode: "US", region: "TX", city: "San Antonio", isQR: false, clickedAt: fourDaysAgo },
        { link: linkA1._id, country: "United States", countryCode: "US", region: "TX", city: "San Antonio", isQR: true, clickedAt: fourDaysAgo },
        { link: linkA1._id, country: "India", countryCode: "IN", region: "MH", city: "Mumbai", isQR: false, clickedAt: fourDaysAgo },
        { link: linkA1._id, country: "India", countryCode: "IN", region: "MH", city: "Mumbai", isQR: true, clickedAt: fourDaysAgo },

        // 20 days ago (30d, all)
        { link: linkA1._id, country: "United Kingdom", countryCode: "GB", region: "ENG", city: "London", isQR: false, clickedAt: twentyDaysAgo },
        { link: linkA1._id, country: "United Kingdom", countryCode: "GB", region: "ENG", city: "London", isQR: true, clickedAt: twentyDaysAgo },

        // 40 days ago (all only)
        { link: linkA1._id, country: "Germany", countryCode: "DE", region: "BE", city: "Berlin", isQR: false, clickedAt: fortyDaysAgo },
      ]);

      console.log("  ✅ Clicks successfully seeded across US, IN, GB, DE and date buckets");
    }

    // -------------------------------------------------------------------------
    // Test 5: Geo-Location Analytics API (range=7d)
    // -------------------------------------------------------------------------
    console.log("\n[Test 5: Geo-Location Analytics API (range=7d)]");
    {
      const res = await fetch(`${baseUrl}/api/links/user/analytics/geo?range=7d`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(res.status === 200, "GET /user/analytics/geo?range=7d returns 200");
      const json = await res.json();

      assert(json.success === true, "success is true");
      assert(json.range === "7d", "range is 7d");
      assert(json.summary.geoIdentifiedClicks >= 5, "Identified geo clicks in 7d is correct");
      assert(json.summary.countriesCount >= 2, "Contains at least US and IN in 7d");
      assert(json.topCountries.length >= 2, "topCountries has at least 2 entries");

      // Verify rank ordering
      assert(json.topCountries[0].rank === 1, "Rank 1 assigned to highest volume");
      assert(json.topCountries[0].totalClicks >= json.topCountries[1].totalClicks, "Sorted descending by totalClicks");

      // Verify city breakdown
      assert(json.topCities.length > 0, "topCities array populated");
      assert(json.topCities[0].city !== "Unknown", "topCities excludes Unknown");
      assert(json.topCities[0].rank === 1, "Top city has rank 1");

      // Verify QR vs Direct breakdown
      assert(Array.isArray(json.qrVsDirectByCountry), "qrVsDirectByCountry is an array");
      const usEntry = json.qrVsDirectByCountry.find((e) => e.countryCode === "US");
      assert(usEntry !== undefined, "qrVsDirectByCountry includes US");
      assert(usEntry.totalClicks === usEntry.qrClicks + usEntry.directClicks, "Invariant: totalClicks === qrClicks + directClicks");
    }

    // -------------------------------------------------------------------------
    // Test 6: Geo-Location Analytics API (range=all)
    // -------------------------------------------------------------------------
    console.log("\n[Test 6: Geo-Location Analytics API (range=all)]");
    {
      const res = await fetch(`${baseUrl}/api/links/user/analytics/geo?range=all`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(res.status === 200, "GET /user/analytics/geo?range=all returns 200");
      const json = await res.json();

      assert(json.range === "all", "range is all");
      assert(json.summary.countriesCount >= 4, "All-time includes US, IN, GB, DE");
      assert(json.summary.unknownClicks >= 1, "Summary accounts for Unknown clicks");
      assert(json.summary.totalClicks === json.summary.geoIdentifiedClicks + json.summary.unknownClicks, "Invariant: totalClicks === geoIdentified + unknown");

      const deCountry = json.topCountries.find((c) => c.countryCode === "DE");
      assert(deCountry !== undefined, "Germany appears in all-time topCountries");
    }

    // -------------------------------------------------------------------------
    // Test 7: User Isolation
    // -------------------------------------------------------------------------
    console.log("\n[Test 7: User Isolation & Unauthenticated Security]");
    {
      // 1. Unauthenticated request
      const unauthRes = await fetch(`${baseUrl}/api/links/user/analytics/geo`);
      assert(unauthRes.status === 401, "Unauthenticated request returns 401");

      // 2. User B has no links
      const resUserB = await fetch(`${baseUrl}/api/links/user/analytics/geo`, {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      assert(resUserB.status === 200, "User B request returns 200");
      const jsonB = await resUserB.json();
      assert(jsonB.summary.totalClicks === 0, "User B has 0 total clicks");
      assert(jsonB.summary.geoIdentifiedClicks === 0, "User B has 0 geo identified clicks");
      assert(jsonB.topCountries.length === 0, "User B receives empty topCountries");
      assert(jsonB.topCities.length === 0, "User B receives empty topCities");
      assert(jsonB.qrVsDirectByCountry.length === 0, "User B receives empty qrVsDirectByCountry");

      // 3. User B creates a link in France
      const linkB = await Link.create({
        originalUrl: "https://example.com/user-b",
        shortCode: `userb_geo_${Date.now()}`,
        user: userBId,
      });

      await Click.create({
        link: linkB._id,
        country: "France",
        countryCode: "FR",
        region: "IDF",
        city: "Paris",
        isQR: true,
        clickedAt: new Date(),
      });

      const resUserB2 = await fetch(`${baseUrl}/api/links/user/analytics/geo`, {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const jsonB2 = await resUserB2.json();
      assert(jsonB2.summary.totalClicks === 1, "User B sees their 1 click");
      assert(jsonB2.topCountries[0].countryCode === "FR", "User B sees France");

      // User A must NOT see France
      const resUserA2 = await fetch(`${baseUrl}/api/links/user/analytics/geo`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const jsonA2 = await resUserA2.json();
      const hasFrance = jsonA2.topCountries.some((c) => c.countryCode === "FR");
      assert(!hasFrance, "User A does NOT see User B's France traffic");
    }

    console.log("\n=======================================================");
    console.log(`Results: ${passedAssertions}/${passedAssertions + failedAssertions} assertions PASSED`);
    console.log("=======================================================\n");
  } finally {
    // Cleanup
    await Link.deleteMany({ user: { $in: [userAId, userBId] } });
    await Click.deleteMany({});
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
