/**
 * Stage 7 Backend Verification Test Suite
 * Tests smart link expiration, access control, pause/resume, max clicks,
 * concurrency safety, user isolation, and QR tracking using native fetch.
 */

import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import app from "./src/app.js";
import Link from "./src/models/link.model.js";
import Click from "./src/models/click.model.js";
import { User } from "./src/models/user.model.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

let server, baseUrl;
let userA, userB, tokenA, tokenB;

async function setup() {
  await mongoose.connect(process.env.MONGO_URI);

  // Clean old test records
  await User.deleteMany({ email: { $in: ["stage7_userA@test.com", "stage7_userB@test.com"] } });

  userA = await User.create({
    username: "stage7_userA",
    name: "Stage 7 User A",
    email: "stage7_userA@test.com",
    password: "Password123!",
  });

  userB = await User.create({
    username: "stage7_userB",
    name: "Stage 7 User B",
    email: "stage7_userB@test.com",
    password: "Password123!",
  });

  tokenA = jwt.sign({ userId: userA._id.toString() }, JWT_SECRET, { expiresIn: "1h" });
  tokenB = jwt.sign({ userId: userB._id.toString() }, JWT_SECRET, { expiresIn: "1h" });

  // Start temporary test server on random port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
}

async function teardown() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await Link.deleteMany({ user: { $in: [userA._id, userB._id] } });
  await Click.deleteMany({});
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  await mongoose.disconnect();
}

let passed = 0;
let total = 0;

function assertTest(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAllTests() {
  console.log("\n=======================================================");
  console.log("Stage 7: Smart Link Expiration & Access Control Suite");
  console.log("=======================================================\n");

  await setup();

  try {
    // -------------------------------------------------------------
    // Test 1: Normal Link without Expiry or Click Limit
    // -------------------------------------------------------------
    console.log("[Test 1: Normal Link without Expiry/Limits]");
    const createRes1 = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ originalUrl: "https://example.com/normal" }),
    });

    assertTest(createRes1.status === 201, "Normal link created with 201");
    const json1 = await createRes1.json();
    const linkNormal = json1.data;
    assertTest(linkNormal.expiresAt === null, "expiresAt is null");
    assertTest(linkNormal.maxClicks === null, "maxClicks is null");
    assertTest(linkNormal.isPaused === false, "isPaused is false");

    // Redirect (do not follow redirect automatically)
    const redRes1 = await fetch(`${baseUrl}/api/links/${linkNormal.shortCode}`, {
      redirect: "manual",
    });
    assertTest(redRes1.status === 302, "Normal link redirects with 302");
    assertTest(
      redRes1.headers.get("location")?.startsWith("https://example.com/normal"),
      "Redirect location is correct"
    );

    // Click count
    const updatedNormal = await Link.findById(linkNormal._id);
    assertTest(updatedNormal.clicks === 1, "Click count incremented to 1");

    // -------------------------------------------------------------
    // Test 2: Link with Future Expiry Date
    // -------------------------------------------------------------
    console.log("\n[Test 2: Link with Future Expiry Date]");
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // +1 day
    const createRes2 = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        originalUrl: "https://example.com/future-exp",
        expiresAt: futureDate.toISOString(),
      }),
    });

    assertTest(createRes2.status === 201, "Future-expiring link created with 201");
    const json2 = await createRes2.json();
    const linkFuture = json2.data;

    const redRes2 = await fetch(`${baseUrl}/api/links/${linkFuture.shortCode}`, {
      redirect: "manual",
    });
    assertTest(redRes2.status === 302, "Link before expiry redirects with 302");

    // -------------------------------------------------------------
    // Test 3: Expired Link (Past Expiry Date)
    // -------------------------------------------------------------
    console.log("\n[Test 3: Expired Link]");
    const pastDate = new Date(Date.now() - 60 * 1000); // -1 minute
    const expiredLink = await Link.create({
      originalUrl: "https://example.com/expired",
      shortCode: "exp" + Math.random().toString(36).substring(2, 7),
      user: userA._id,
      expiresAt: pastDate,
      clicks: 5,
    });

    const redRes3 = await fetch(`${baseUrl}/api/links/${expiredLink.shortCode}`, {
      redirect: "manual",
    });
    assertTest(redRes3.status === 410, "Expired link returns HTTP 410");
    const json3 = await redRes3.json();
    assertTest(json3.code === "LINK_EXPIRED", "Error code is LINK_EXPIRED");

    // Verify clicks NOT incremented and no click recorded
    const checkExp = await Link.findById(expiredLink._id);
    assertTest(checkExp.clicks === 5, "Expired link clicks NOT incremented");
    const expClicks = await Click.countDocuments({ link: expiredLink._id });
    assertTest(expClicks === 0, "No Click document created for expired visit");

    // -------------------------------------------------------------
    // Test 4: Paused Link & Resume Action
    // -------------------------------------------------------------
    console.log("\n[Test 4: Paused Link and Resume Action]");
    const pausedLink = await Link.create({
      originalUrl: "https://example.com/paused",
      shortCode: "pau" + Math.random().toString(36).substring(2, 7),
      user: userA._id,
      isPaused: true,
      clicks: 2,
    });

    const redRes4 = await fetch(`${baseUrl}/api/links/${pausedLink.shortCode}`, {
      redirect: "manual",
    });
    assertTest(redRes4.status === 403, "Paused link returns HTTP 403");
    const json4 = await redRes4.json();
    assertTest(json4.code === "LINK_PAUSED", "Error code is LINK_PAUSED");

    const checkPaused = await Link.findById(pausedLink._id);
    assertTest(checkPaused.clicks === 2, "Paused link clicks NOT incremented");
    const pausedClicks = await Click.countDocuments({ link: pausedLink._id });
    assertTest(pausedClicks === 0, "No Click document created for paused visit");

    // Resume the link via toggle-pause endpoint
    const resumeRes = await fetch(`${baseUrl}/api/links/${pausedLink._id}/toggle-pause`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assertTest(resumeRes.status === 200, "Resume toggle returns 200");
    const resumeJson = await resumeRes.json();
    assertTest(resumeJson.isPaused === false, "isPaused is now false");

    // Verify redirect now works
    const redRes4B = await fetch(`${baseUrl}/api/links/${pausedLink.shortCode}`, {
      redirect: "manual",
    });
    assertTest(redRes4B.status === 302, "Resumed link redirects with 302");
    const checkResumed = await Link.findById(pausedLink._id);
    assertTest(checkResumed.clicks === 3, "Resumed link clicks incremented to 3");

    // -------------------------------------------------------------
    // Test 5: Maximum Click Limit
    // -------------------------------------------------------------
    console.log("\n[Test 5: Maximum Click Limit]");
    const limitLink = await Link.create({
      originalUrl: "https://example.com/limit",
      shortCode: "lim" + Math.random().toString(36).substring(2, 7),
      user: userA._id,
      maxClicks: 3,
      clicks: 2,
    });

    // Click 3 (hits limit)
    const redRes5A = await fetch(`${baseUrl}/api/links/${limitLink.shortCode}`, {
      redirect: "manual",
    });
    assertTest(redRes5A.status === 302, "Click 3 succeeds with 302");
    const checkLim1 = await Link.findById(limitLink._id);
    assertTest(checkLim1.clicks === 3, "Clicks reached maxClicks (3)");

    // Click 4 (exceeds limit)
    const redRes5B = await fetch(`${baseUrl}/api/links/${limitLink.shortCode}`, {
      redirect: "manual",
    });
    assertTest(redRes5B.status === 410, "Click 4 blocked with HTTP 410");
    const json5B = await redRes5B.json();
    assertTest(json5B.code === "CLICK_LIMIT_REACHED", "Error code is CLICK_LIMIT_REACHED");

    const checkLim2 = await Link.findById(limitLink._id);
    assertTest(checkLim2.clicks === 3, "Clicks remain capped at 3 (not incremented)");

    // -------------------------------------------------------------
    // Test 6: Concurrency Safety at Click Limit
    // -------------------------------------------------------------
    console.log("\n[Test 6: Concurrency Safety at Click Limit]");
    const concLink = await Link.create({
      originalUrl: "https://example.com/concurrent",
      shortCode: "cnc" + Math.random().toString(36).substring(2, 7),
      user: userA._id,
      maxClicks: 5,
      clicks: 4, // 1 click left before limit
    });

    // Fire 20 parallel requests simultaneously
    const requests = Array.from({ length: 20 }, () =>
      fetch(`${baseUrl}/api/links/${concLink.shortCode}`, { redirect: "manual" })
    );

    const responses = await Promise.all(requests);
    const redirectCount = responses.filter((r) => r.status === 302).length;
    const limitBlockedCount = responses.filter((r) => r.status === 410).length;

    assertTest(redirectCount === 1, `Exactly 1 parallel request succeeded (actual: ${redirectCount})`);
    assertTest(limitBlockedCount === 19, `Exactly 19 parallel requests blocked (actual: ${limitBlockedCount})`);

    const finalConc = await Link.findById(concLink._id);
    assertTest(finalConc.clicks === 5, `Final click count is strictly 5 (actual: ${finalConc.clicks})`);

    // -------------------------------------------------------------
    // Test 7: Update Access Settings & User Isolation
    // -------------------------------------------------------------
    console.log("\n[Test 7: Update Access Settings & User Isolation]");
    // User B tries to update User A's link
    const attackRes = await fetch(`${baseUrl}/api/links/${limitLink._id}/access`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ maxClicks: 100 }),
    });

    assertTest(attackRes.status === 404, "User B blocked from modifying User A link (404)");

    // User A updates own link
    const newFutureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const updateRes = await fetch(`${baseUrl}/api/links/${limitLink._id}/access`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        maxClicks: 10,
        expiresAt: newFutureDate.toISOString(),
        isPaused: false,
      }),
    });

    assertTest(updateRes.status === 200, "User A successfully updates access settings (200)");
    const updateJson = await updateRes.json();
    assertTest(updateJson.data.maxClicks === 10, "maxClicks updated to 10");

    // Now link can receive more clicks
    const unblockedRes = await fetch(`${baseUrl}/api/links/${limitLink.shortCode}`, {
      redirect: "manual",
    });
    assertTest(unblockedRes.status === 302, "Link with raised limit redirects again (302)");

    // -------------------------------------------------------------
    // Test 8: QR Tracking on Active Links
    // -------------------------------------------------------------
    console.log("\n[Test 8: QR Tracking on Active Links]");
    const qrTestRes = await fetch(`${baseUrl}/api/links/${limitLink.shortCode}?qr=1`, {
      redirect: "manual",
    });
    assertTest(qrTestRes.status === 302, "QR visit redirects with 302");

    // Wait a brief tick for async click logging
    await new Promise((r) => setTimeout(r, 150));
    const lastClick = await Click.findOne({ link: limitLink._id }).sort({ clickedAt: -1 });
    assertTest(lastClick && lastClick.isQR === true, "Click snapshot correctly attributed with isQR: true");

    // -------------------------------------------------------------
    // Test 9: getMyLinks returns access fields
    // -------------------------------------------------------------
    console.log("\n[Test 9: getMyLinks includes Stage 7 fields]");
    const myLinksRes = await fetch(`${baseUrl}/api/links/my-links`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assertTest(myLinksRes.status === 200, "getMyLinks returns 200");
    const myLinksJson = await myLinksRes.json();
    const retrievedLink = myLinksJson.data.find((l) => l.shortCode === limitLink.shortCode);
    assertTest(retrievedLink !== undefined, "Retrieved link in list");
    assertTest(retrievedLink.maxClicks === 10, "maxClicks returned in getMyLinks");
    assertTest(retrievedLink.expiresAt !== undefined, "expiresAt returned in getMyLinks");
    assertTest(retrievedLink.isPaused !== undefined, "isPaused returned in getMyLinks");

    console.log("\n=======================================================");
    console.log(`Results: ${passed}/${total} assertions PASSED`);
    console.log("=======================================================\n");
  } finally {
    await teardown();
  }
}

runAllTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
