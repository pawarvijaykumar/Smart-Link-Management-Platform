import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "./src/models/user.model.js";
import Link from "./src/models/link.model.js";
import Click from "./src/models/click.model.js";

const BASE_URL = "http://localhost:5000/api/links";

async function runTests() {
  console.log("=== Stage 5C Step 2: Backend QR Analytics API Verification ===");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const testSuffix = Date.now();
  const testUserA = await User.create({
    username: `test_qr_a_${testSuffix}`,
    email: `test_qr_a_${testSuffix}@example.com`,
    password: "Password123!",
  });

  const testUserB = await User.create({
    username: `test_qr_b_${testSuffix}`,
    email: `test_qr_b_${testSuffix}@example.com`,
    password: "Password123!",
  });

  const testUserC = await User.create({
    username: `test_qr_c_${testSuffix}`,
    email: `test_qr_c_${testSuffix}@example.com`,
    password: "Password123!",
  });

  const tokenA = jwt.sign({ userId: testUserA._id }, process.env.JWT_SECRET);
  const tokenB = jwt.sign({ userId: testUserB._id }, process.env.JWT_SECRET);
  const tokenC = jwt.sign({ userId: testUserC._id }, process.env.JWT_SECRET);

  console.log("Created test users A, B, C (C has no links).");

  // User A Links
  // Link A1: active link with QR and direct clicks across different dates
  const linkA1 = await Link.create({
    user: testUserA._id,
    originalUrl: "https://example.com/product",
    shortCode: `tstA1_${testSuffix}`,
    clicks: 10,
  });

  // Link A2: link with only old legacy clicks (no isQR field)
  const linkA2 = await Link.create({
    user: testUserA._id,
    originalUrl: "https://example.com/legacy",
    shortCode: `tstA2_${testSuffix}`,
    clicks: 2,
  });

  // Link A3: link with 0 clicks
  const linkA3 = await Link.create({
    user: testUserA._id,
    originalUrl: "https://example.com/zeroclicks",
    shortCode: `tstA3_${testSuffix}`,
    clicks: 0,
  });

  // User B Link
  const linkB1 = await Link.create({
    user: testUserB._id,
    originalUrl: "https://example.com/userB_only",
    shortCode: `tstB1_${testSuffix}`,
    clicks: 5,
  });

  const now = new Date();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

  // Clicks for Link A1:
  // - 2 days ago (in 7d, 30d, all): 3 QR clicks, 2 Direct clicks
  // - 15 days ago (in 30d, all): 2 QR clicks, 1 Direct click
  // - 40 days ago (in all): 1 QR click, 1 Direct click
  const clicksToInsert = [
    // Link A1: Recent (2 days ago)
    { link: linkA1._id, isQR: true, clickedAt: twoDaysAgo },
    { link: linkA1._id, isQR: true, clickedAt: twoDaysAgo },
    { link: linkA1._id, isQR: true, clickedAt: twoDaysAgo },
    { link: linkA1._id, isQR: false, clickedAt: twoDaysAgo },
    { link: linkA1._id, isQR: false, clickedAt: twoDaysAgo },

    // Link A1: Medium (15 days ago)
    { link: linkA1._id, isQR: true, clickedAt: fifteenDaysAgo },
    { link: linkA1._id, isQR: true, clickedAt: fifteenDaysAgo },
    { link: linkA1._id, isQR: false, clickedAt: fifteenDaysAgo },

    // Link A1: Old (40 days ago)
    { link: linkA1._id, isQR: true, clickedAt: fortyDaysAgo },
    { link: linkA1._id, isQR: false, clickedAt: fortyDaysAgo },

    // Link A2: Legacy clicks without isQR field (simulate old records)
    // 1 recent (2 days ago), 1 old (40 days ago)
    { link: linkA2._id, clickedAt: twoDaysAgo }, // no isQR property
    { link: linkA2._id, clickedAt: fortyDaysAgo }, // no isQR property

    // User B Link B1 clicks: 4 QR, 1 Direct
    { link: linkB1._id, isQR: true, clickedAt: twoDaysAgo },
    { link: linkB1._id, isQR: true, clickedAt: twoDaysAgo },
    { link: linkB1._id, isQR: true, clickedAt: twoDaysAgo },
    { link: linkB1._id, isQR: true, clickedAt: twoDaysAgo },
    { link: linkB1._id, isQR: false, clickedAt: twoDaysAgo },
  ];

  await Click.collection.insertMany(clicksToInsert);
  console.log("Inserted test clicks across date ranges and users.");

  let allPassed = true;
  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${details}`);
      allPassed = false;
    }
  }

  try {
    // ----------------------------------------------------
    // Scenario 1 & 7a: Range = 7d for User A
    // Expected for User A in 7d:
    // Link A1: 3 QR, 2 Direct = 5 total (qr: 60%)
    // Link A2: 0 QR, 1 Direct = 1 total (qr: 0%)
    // Link A3: 0 QR, 0 Direct = 0 total (qr: 0%)
    // Summary: totalClicks: 6, qrClicks: 3, directClicks: 3, qrPercentage: 50.0
    // ----------------------------------------------------
    console.log("\n--- Testing Range = 7d (User A) ---");
    const res7d = await fetch(`${BASE_URL}/user/analytics/qr?range=7d`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data7d = await res7d.json();

    assert(res7d.status === 200, "HTTP status 200 for range=7d");
    assert(data7d.success === true, "success is true");
    assert(data7d.range === "7d", "range is 7d");
    assert(data7d.summary.totalClicks === 6, "Summary totalClicks is 6 in 7d", `Got ${data7d.summary.totalClicks}`);
    assert(data7d.summary.qrClicks === 3, "Summary qrClicks is 3 in 7d", `Got ${data7d.summary.qrClicks}`);
    assert(data7d.summary.directClicks === 3, "Summary directClicks is 3 in 7d (including 1 legacy)", `Got ${data7d.summary.directClicks}`);
    assert(data7d.summary.qrPercentage === 50, "Summary qrPercentage is 50.0 in 7d", `Got ${data7d.summary.qrPercentage}`);
    assert(
      data7d.summary.totalClicks === data7d.summary.qrClicks + data7d.summary.directClicks,
      "Invariant: totalClicks === qrClicks + directClicks in 7d"
    );

    // Check per-link stats in 7d
    assert(data7d.links.length === 3, "All 3 User A links returned in 7d", `Got ${data7d.links.length}`);
    const linkA3_7d = data7d.links.find((l) => l.shortCode === linkA3.shortCode);
    assert(
      linkA3_7d && linkA3_7d.totalClicks === 0 && linkA3_7d.qrClicks === 0 && linkA3_7d.directClicks === 0 && linkA3_7d.qrPercentage === 0,
      "Zero-click link A3 appears with zero counts in 7d"
    );

    // ----------------------------------------------------
    // Scenario 2 & 7b: Range = 30d for User A
    // Expected for User A in 30d:
    // Link A1: (3+2)=5 QR, (2+1)=3 Direct = 8 total (qr: 62.5%)
    // Link A2: 0 QR, 1 Direct = 1 total (qr: 0%)
    // Link A3: 0 QR, 0 Direct = 0 total (qr: 0%)
    // Summary: totalClicks: 9, qrClicks: 5, directClicks: 4, qrPercentage: 55.6%
    // ----------------------------------------------------
    console.log("\n--- Testing Range = 30d (User A) ---");
    const res30d = await fetch(`${BASE_URL}/user/analytics/qr?range=30d`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data30d = await res30d.json();

    assert(res30d.status === 200, "HTTP status 200 for range=30d");
    assert(data30d.range === "30d", "range is 30d");
    assert(data30d.summary.totalClicks === 9, "Summary totalClicks is 9 in 30d", `Got ${data30d.summary.totalClicks}`);
    assert(data30d.summary.qrClicks === 5, "Summary qrClicks is 5 in 30d", `Got ${data30d.summary.qrClicks}`);
    assert(data30d.summary.directClicks === 4, "Summary directClicks is 4 in 30d", `Got ${data30d.summary.directClicks}`);
    assert(data30d.summary.qrPercentage === 55.6, "Summary qrPercentage is 55.6 in 30d", `Got ${data30d.summary.qrPercentage}`);
    assert(
      data30d.summary.totalClicks === data30d.summary.qrClicks + data30d.summary.directClicks,
      "Invariant: totalClicks === qrClicks + directClicks in 30d"
    );

    // ----------------------------------------------------
    // Scenario 3 & 7c: Range = all for User A
    // Expected for User A in all:
    // Link A1: (3+2+1)=6 QR, (2+1+1)=4 Direct = 10 total (qr: 60%)
    // Link A2: 0 QR, 2 Direct = 2 total (qr: 0%) [Legacy clicks treated as direct]
    // Link A3: 0 QR, 0 Direct = 0 total
    // Summary: totalClicks: 12, qrClicks: 6, directClicks: 6, qrPercentage: 50.0%
    // ----------------------------------------------------
    console.log("\n--- Testing Range = all (User A) ---");
    const resAll = await fetch(`${BASE_URL}/user/analytics/qr?range=all`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataAll = await resAll.json();

    assert(resAll.status === 200, "HTTP status 200 for range=all");
    assert(dataAll.range === "all", "range is all");
    assert(dataAll.summary.totalClicks === 12, "Summary totalClicks is 12 in all", `Got ${dataAll.summary.totalClicks}`);
    assert(dataAll.summary.qrClicks === 6, "Summary qrClicks is 6 in all", `Got ${dataAll.summary.qrClicks}`);
    assert(dataAll.summary.directClicks === 6, "Summary directClicks is 6 in all", `Got ${dataAll.summary.directClicks}`);
    assert(dataAll.summary.qrPercentage === 50, "Summary qrPercentage is 50 in all", `Got ${dataAll.summary.qrPercentage}`);
    assert(
      dataAll.summary.totalClicks === dataAll.summary.qrClicks + dataAll.summary.directClicks,
      "Invariant: totalClicks === qrClicks + directClicks in all"
    );

    // Per-link validation for all-time
    const linkA1_all = dataAll.links.find((l) => l.shortCode === linkA1.shortCode);
    assert(
      linkA1_all && linkA1_all.totalClicks === 10 && linkA1_all.qrClicks === 6 && linkA1_all.directClicks === 4 && linkA1_all.qrPercentage === 60,
      "Link A1 per-link stats match exactly (total: 10, qr: 6, direct: 4, qrPercentage: 60)",
      JSON.stringify(linkA1_all)
    );

    const linkA2_all = dataAll.links.find((l) => l.shortCode === linkA2.shortCode);
    assert(
      linkA2_all && linkA2_all.totalClicks === 2 && linkA2_all.qrClicks === 0 && linkA2_all.directClicks === 2 && linkA2_all.qrPercentage === 0,
      "Link A2 legacy records correctly counted as direct clicks (total: 2, qr: 0, direct: 2, qrPercentage: 0)",
      JSON.stringify(linkA2_all)
    );

    const linkA3_all = dataAll.links.find((l) => l.shortCode === linkA3.shortCode);
    assert(
      linkA3_all && linkA3_all.totalClicks === 0 && linkA3_all.qrClicks === 0 && linkA3_all.directClicks === 0 && linkA3_all.qrPercentage === 0,
      "Link A3 zero clicks preserved in all-time",
      JSON.stringify(linkA3_all)
    );

    // Check every link satisfies totalClicks === qrClicks + directClicks
    const allLinksConsistent = dataAll.links.every((l) => l.totalClicks === l.qrClicks + l.directClicks);
    assert(allLinksConsistent, "Invariant: every individual link satisfies totalClicks === qrClicks + directClicks");

    // ----------------------------------------------------
    // Scenario 6: User Isolation (User B vs User A)
    // User B should ONLY see Link B1 (4 QR, 1 Direct = 5 total, qrPercentage: 80%)
    // User B should NEVER see User A's links
    // ----------------------------------------------------
    console.log("\n--- Testing User Isolation (User B) ---");
    const resB = await fetch(`${BASE_URL}/user/analytics/qr?range=all`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const dataB = await resB.json();

    assert(resB.status === 200, "HTTP status 200 for User B");
    assert(dataB.summary.totalClicks === 5, "User B summary totalClicks is 5", `Got ${dataB.summary.totalClicks}`);
    assert(dataB.summary.qrClicks === 4, "User B summary qrClicks is 4", `Got ${dataB.summary.qrClicks}`);
    assert(dataB.summary.directClicks === 1, "User B summary directClicks is 1", `Got ${dataB.summary.directClicks}`);
    assert(dataB.summary.qrPercentage === 80, "User B summary qrPercentage is 80", `Got ${dataB.summary.qrPercentage}`);
    assert(dataB.links.length === 1, "User B has exactly 1 link", `Got ${dataB.links.length}`);
    assert(dataB.links[0].shortCode === linkB1.shortCode, "User B link is linkB1");
    const userASeesNoB = dataAll.links.every((l) => l.shortCode !== linkB1.shortCode);
    assert(userASeesNoB, "User A does not see User B's links");

    // ----------------------------------------------------
    // Scenario 8: Empty User (User C with no links)
    // ----------------------------------------------------
    console.log("\n--- Testing Empty User (User C) ---");
    const resC = await fetch(`${BASE_URL}/user/analytics/qr?range=7d`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    const dataC = await resC.json();

    assert(resC.status === 200, "HTTP status 200 for empty User C");
    assert(dataC.success === true, "success is true for empty user");
    assert(dataC.range === "7d", "range is 7d for empty user");
    assert(
      dataC.summary.totalClicks === 0 && dataC.summary.qrClicks === 0 && dataC.summary.directClicks === 0 && dataC.summary.qrPercentage === 0,
      "Empty user receives all zeros in summary"
    );
    assert(Array.isArray(dataC.links) && dataC.links.length === 0, "Empty user receives empty links array");

    // ----------------------------------------------------
    // Scenario 9: Authentication Check (Unauthorized)
    // ----------------------------------------------------
    console.log("\n--- Testing Unauthenticated Access ---");
    const resUnauth = await fetch(`${BASE_URL}/user/analytics/qr`);
    assert(resUnauth.status === 401, "Rejects unauthenticated request with 401");

  } finally {
    // Cleanup
    console.log("\n--- Cleaning up test records ---");
    await Click.deleteMany({ link: { $in: [linkA1._id, linkA2._id, linkA3._id, linkB1._id] } });
    await Link.deleteMany({ _id: { $in: [linkA1._id, linkA2._id, linkA3._id, linkB1._id] } });
    await User.deleteMany({ _id: { $in: [testUserA._id, testUserB._id, testUserC._id] } });
    await mongoose.disconnect();
    console.log("Cleanup completed and MongoDB disconnected.");
  }

  if (allPassed) {
    console.log("\n🎉 ALL 8+ TEST SCENARIOS PASSED SUCCESSFULLY!");
  } else {
    console.error("\n❌ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
