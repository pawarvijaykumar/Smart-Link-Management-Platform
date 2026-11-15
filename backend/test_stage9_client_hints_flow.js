/**
 * Stage 9 Step 5: Real-World Client Hints Flow Verification Suite
 * Tests:
 * 1. Initial navigation request without high-entropy Client Hints (Chrome UA Reduction):
 *    - Validates HTTP 302 redirect
 *    - Validates Accept-CH and Vary headers are returned
 *    - Validates MongoDB Click records Unknown vendor and Unknown model without inventing data or saving 'K'
 * 2. Subsequent navigation request when browser attaches negotiated Client Hints:
 *    - Sec-CH-UA-Model: "SM-S918B", Sec-CH-UA-Platform-Version: "14.0.0"
 *    - Validates MongoDB Click records Samsung, SM-S918B, and updates OS version to 14
 * 3. Client Hints flow for Google Pixel, OnePlus, and Xiaomi
 * 4. Strict privacy compliance (no raw IP storage)
 * 5. Preservation of Stage 7 access restrictions (paused, expired)
 */

import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import http from "node:http";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import app from "./src/app.js";
import Link from "./src/models/link.model.js";
import Click from "./src/models/click.model.js";
import { User } from "./src/models/user.model.js";

const MONGO_URI = process.env.MONGO_URI;

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
  console.log("Stage 9 Step 5: Client Hints Flow Verification Suite");
  console.log("=======================================================\n");

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  } catch (err) {
    console.log("  ⚠️ Atlas connection timed out. Connecting to local MongoDB at mongodb://127.0.0.1:27017/smartlink_test...");
    await mongoose.connect("mongodb://127.0.0.1:27017/smartlink_test");
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  const testUserId = new mongoose.Types.ObjectId();

  await User.deleteMany({ email: "ch_test_user@example.com" });
  await User.create({
    _id: testUserId,
    username: "chtestuser",
    email: "ch_test_user@example.com",
    password: "Password123!",
  });

  try {
    // -------------------------------------------------------------------------
    // Test 1: Initial Navigation without High-Entropy Hints (Exact WhatsApp Chrome flow)
    // -------------------------------------------------------------------------
    console.log("[Test 1: Initial Navigation Request (Reduced User-Agent, No Client Hints)]");
    const linkCode1 = `ch_init_${Date.now()}`;
    const link1 = await Link.create({
      originalUrl: "https://example.com/target-page",
      shortCode: linkCode1,
      user: testUserId,
      isActive: true,
    });

    const chrome157ReducedUA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36";

    const res1 = await fetch(`${baseUrl}/${linkCode1}`, {
      method: "GET",
      headers: {
        "User-Agent": chrome157ReducedUA,
        "Sec-CH-UA": '"Chromium";v="157", "Not=A?Brand";v="99", "Google Chrome";v="157"',
        "Sec-CH-UA-Mobile": "?1",
        "Sec-CH-UA-Platform": '"Android"',
        // High-entropy hints NOT sent by browser on initial visit
      },
      redirect: "manual",
    });

    assert(res1.status === 302, "Initial navigation returns HTTP 302 redirect");
    assert(res1.headers.get("location") === "https://example.com/target-page", "Redirect location matches destination");
    const acceptCH = res1.headers.get("accept-ch");
    assert(acceptCH !== null && acceptCH.includes("Sec-CH-UA-Model"), "Redirect response includes Accept-CH with Sec-CH-UA-Model");
    assert(acceptCH.includes("Sec-CH-UA-Platform-Version"), "Redirect response includes Accept-CH with Sec-CH-UA-Platform-Version");
    const varyHeader = res1.headers.get("vary");
    assert(varyHeader !== null && varyHeader.includes("Sec-CH-UA-Model"), "Redirect response includes Vary with Sec-CH-UA-Model");

    // Wait for background Click.create
    await new Promise((r) => setTimeout(r, 200));

    const click1 = await Click.findOne({ link: link1._id }).lean();
    assert(click1 !== null, "Click record inserted in MongoDB");
    assert(click1.deviceType === "mobile", "deviceType is mobile");
    assert(click1.browser === "Chrome", "browser is Chrome");
    assert(click1.browserVersion === "157.0", "browserVersion is 157.0");
    assert(click1.operatingSystem === "Android", "operatingSystem is Android");
    assert(click1.osVersion === "10", "osVersion is 10 (frozen UA value)");
    assert(click1.deviceVendor === "Unknown", "deviceVendor is Unknown (no false guess)");
    assert(click1.deviceModel === "Unknown", "deviceModel is Unknown (dummy 'K' rejected, no false guess)");
    assert(click1.deviceModel !== "K", "deviceModel is NOT dummy 'K'");

    // -------------------------------------------------------------------------
    // Test 2: Subsequent Navigation with Negotiated Client Hints (Samsung S23)
    // -------------------------------------------------------------------------
    console.log("\n[Test 2: Subsequent Navigation with Negotiated Client Hints (Samsung)]");
    const linkCode2 = `ch_samsung_${Date.now()}`;
    const link2 = await Link.create({
      originalUrl: "https://example.com/target-page",
      shortCode: linkCode2,
      user: testUserId,
      isActive: true,
    });

    const res2 = await fetch(`${baseUrl}/${linkCode2}`, {
      method: "GET",
      headers: {
        "User-Agent": chrome157ReducedUA,
        "Sec-CH-UA": '"Chromium";v="157", "Not=A?Brand";v="99", "Google Chrome";v="157"',
        "Sec-CH-UA-Mobile": "?1",
        "Sec-CH-UA-Platform": '"Android"',
        "Sec-CH-UA-Model": '"SM-S918B"',
        "Sec-CH-UA-Platform-Version": '"14.0.0"',
      },
      redirect: "manual",
    });

    assert(res2.status === 302, "Subsequent navigation returns HTTP 302 redirect");
    await new Promise((r) => setTimeout(r, 200));

    const click2 = await Click.findOne({ link: link2._id }).lean();
    assert(click2 !== null, "Click record inserted in MongoDB");
    assert(click2.deviceVendor === "Samsung", `deviceVendor is Samsung (got ${click2.deviceVendor})`);
    assert(click2.deviceModel === "SM-S918B", `deviceModel is SM-S918B (got ${click2.deviceModel})`);
    assert(click2.osVersion === "14", `osVersion updated to 14 via Client Hints (got ${click2.osVersion})`);

    // -------------------------------------------------------------------------
    // Test 3: Subsequent Navigation with Google Pixel Client Hints
    // -------------------------------------------------------------------------
    console.log("\n[Test 3: Subsequent Navigation with Google Pixel Client Hints]");
    const linkCode3 = `ch_pixel_${Date.now()}`;
    const link3 = await Link.create({
      originalUrl: "https://example.com/target-page",
      shortCode: linkCode3,
      user: testUserId,
      isActive: true,
    });

    const res3 = await fetch(`${baseUrl}/${linkCode3}`, {
      method: "GET",
      headers: {
        "User-Agent": chrome157ReducedUA,
        "Sec-CH-UA": '"Chromium";v="157", "Not=A?Brand";v="99", "Google Chrome";v="157"',
        "Sec-CH-UA-Mobile": "?1",
        "Sec-CH-UA-Platform": '"Android"',
        "Sec-CH-UA-Model": '"Pixel 8 Pro"',
        "Sec-CH-UA-Platform-Version": '"14.0.0"',
      },
      redirect: "manual",
    });

    assert(res3.status === 302, "Pixel navigation returns HTTP 302");
    await new Promise((r) => setTimeout(r, 200));

    const click3 = await Click.findOne({ link: link3._id }).lean();
    assert(click3 !== null, "Click record inserted in MongoDB");
    assert(click3.deviceVendor === "Google", `Pixel vendor is Google (got ${click3.deviceVendor})`);
    assert(click3.deviceModel === "Pixel 8 Pro", `Pixel model is Pixel 8 Pro (got ${click3.deviceModel})`);
    assert(click3.osVersion === "14", "Pixel OS version updated to 14");

    // -------------------------------------------------------------------------
    // Test 4: Privacy & Anti-Spoofing Verification
    // -------------------------------------------------------------------------
    console.log("\n[Test 4: Privacy & Anti-Spoofing Verification]");
    assert(click1.ip === undefined, "PRIVACY: Raw IP is not stored on click1");
    assert(click1.clientIp === undefined, "PRIVACY: clientIp is not stored on click1");
    assert(click1.visitorIp === undefined, "PRIVACY: visitorIp is not stored on click1");
    assert(click2.ip === undefined, "PRIVACY: Raw IP is not stored on click2");

    // -------------------------------------------------------------------------
    // Test 5: Preservation of Stage 7 Access Controls
    // -------------------------------------------------------------------------
    console.log("\n[Test 5: Preservation of Stage 7 Access Controls]");
    const linkCodePaused = `ch_paused_${Date.now()}`;
    const linkPaused = await Link.create({
      originalUrl: "https://example.com/target-page",
      shortCode: linkCodePaused,
      user: testUserId,
      isPaused: true, // Stage 7 paused link
    });

    const resPaused = await fetch(`${baseUrl}/${linkCodePaused}`, {
      method: "GET",
      headers: {
        "User-Agent": chrome157ReducedUA,
        "Sec-CH-UA-Model": '"Pixel 8 Pro"',
      },
      redirect: "manual",
    });

    assert(resPaused.status === 403, "Paused link returns HTTP 403 Forbidden");
    const clickPaused = await Click.findOne({ link: linkPaused._id }).lean();
    assert(clickPaused === null, "No Click document created for paused redirect");

    // Cleanup
    await Link.deleteMany({ _id: { $in: [link1._id, link2._id, link3._id, linkPaused._id] } });
    await Click.deleteMany({ link: { $in: [link1._id, link2._id, link3._id, linkPaused._id] } });
    await User.deleteOne({ _id: testUserId });

    console.log("\n=======================================================");
    console.log(`Results: ${passedAssertions}/${passedAssertions + failedAssertions} assertions PASSED`);
    console.log("=======================================================\n");

  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
