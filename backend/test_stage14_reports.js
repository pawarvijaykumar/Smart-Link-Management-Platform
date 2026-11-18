// =============================================================================
// Stage 14: Automated Reports (PDF & CSV Export) Verification Suite
// CHANGE: Stage 14 Automated Reports — 2026-11-19
// =============================================================================

import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import app from "./src/app.js";
import { User } from "./src/models/user.model.js";
import Link from "./src/models/link.model.js";
import Click from "./src/models/click.model.js";
import Anomaly from "./src/models/anomaly.model.js";
import Experiment from "./src/models/experiment.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "smartlink_ab_cookie_secret_key_2026";
let server;
let baseUrl;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

async function request(urlPath, options = {}) {
  const url = `${baseUrl}${urlPath}`;
  const headers = options.headers || {};
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const disposition = res.headers.get("content-disposition") || "";

  const arrayBuffer = await res.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);
  let data;
  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(rawBuffer.toString("utf-8"));
    } catch (_) {
      data = rawBuffer.toString("utf-8");
    }
  } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    data = rawBuffer.toString("utf-8");
  } else {
    data = rawBuffer;
  }

  return {
    status: res.status,
    headers: res.headers,
    contentType,
    disposition,
    data,
    rawBuffer,
  };
}

function runTest(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  };
}

async function runAll() {
  console.log("\n=======================================================");
  console.log("Stage 14: Automated Reports (PDF & CSV) Verification Suite");
  console.log("=======================================================\n");

  // Connect to DB
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/smartlink_test";

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (_) {
    await mongoose.connect("mongodb://127.0.0.1:27017/smartlink_test");
  }

  // Start HTTP test server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  🚀 Server listening on ${baseUrl}\n`);

  // Clean test collections
  const uniqueTag = `stg14_${Date.now()}`;
  const userA = await User.create({
    username: `userA_${uniqueTag}`,
    email: `usera_${uniqueTag}@test.com`,
    password: "Password123!",
  });
  const tokenA = jwt.sign({ _id: userA._id, email: userA.email }, JWT_SECRET, { expiresIn: "1h" });

  const userB = await User.create({
    username: `userB_${uniqueTag}`,
    email: `userb_${uniqueTag}@test.com`,
    password: "Password123!",
  });
  const tokenB = jwt.sign({ _id: userB._id, email: userB.email }, JWT_SECRET, { expiresIn: "1h" });

  // ---------------------------------------------------------------------------
  // TEST 1: Authentication & Authorization
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Authentication & Authorization ---");
  await runTest("Unauthenticated GET /api/reports/csv returns 401", async () => {
    const res = await request("/api/reports/csv?type=overall");
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  })();

  await runTest("Unauthenticated GET /api/reports/pdf returns 401", async () => {
    const res = await request("/api/reports/pdf?type=overall");
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  })();

  await runTest("Invalid report type returns 400", async () => {
    const res = await request("/api/reports/csv?type=invalid_xyz", { token: tokenA });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.data.success === false, "Expected success: false");
    assert(res.data.message.includes("Invalid report type"), "Expected message about invalid report type");
  })();

  // ---------------------------------------------------------------------------
  // TEST 2: Categories Metadata Endpoint
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Categories Metadata Endpoint ---");
  await runTest("GET /api/reports/categories returns all 9 report types", async () => {
    const res = await request("/api/reports/categories", { token: tokenA });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, "Expected success: true");
    assert(Array.isArray(res.data.categories), "Expected categories array");
    assert(res.data.categories.length === 9, `Expected 9 categories, got ${res.data.categories.length}`);
    const ids = res.data.categories.map((c) => c.id);
    const expected = ["overall", "links", "qr", "geo", "devices", "campaigns", "traffic", "anomalies", "experiments"];
    expected.forEach((reqId) => {
      assert(ids.includes(reqId), `Missing category: ${reqId}`);
    });
  })();

  // ---------------------------------------------------------------------------
  // TEST 3: Empty Account Report Generation (Safety & Graceful Output)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Empty Account Report Generation ---");
  await runTest("Empty account CSV generation returns 200 with valid headers", async () => {
    const res = await request("/api/reports/csv?type=overall&range=all", { token: tokenB });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.contentType.includes("text/csv"), "Expected text/csv content type");
    assert(
      (res.rawBuffer[0] === 0xef && res.rawBuffer[1] === 0xbb && res.rawBuffer[2] === 0xbf) ||
        res.data.charCodeAt(0) === 0xfeff,
      "Expected UTF-8 BOM"
    );
    assert(res.data.includes("Smart Link Management Platform"), "Expected platform header");
    assert(res.data.includes("Total Clicks"), "Expected Total Clicks field");
    assert(res.disposition.includes(".csv"), "Expected csv attachment disposition");
  })();

  await runTest("Empty account PDF generation returns 200 with valid PDF bytes", async () => {
    const res = await request("/api/reports/pdf?type=overall&range=all", { token: tokenB });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.contentType.includes("application/pdf"), "Expected application/pdf content type");
    assert(res.disposition.includes(".pdf"), "Expected pdf attachment disposition");
    assert(res.rawBuffer && res.rawBuffer.slice(0, 4).toString() === "%PDF", "Expected %PDF signature");
  })();

  // ---------------------------------------------------------------------------
  // TEST 4: Seeding Multi-Dimensional Analytics Data for User A
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Seeding Multi-Dimensional Analytics Data ---");
  const link1 = await Link.create({
    originalUrl: "https://example.com/product-landing",
    shortCode: `p1_${Date.now().toString(36)}`,
    user: userA._id,
    clicks: 10,
    utmCampaign: "summer_sale",
    utmSource: "newsletter",
    utmMedium: "email",
  });

  const link2 = await Link.create({
    originalUrl: "https://example.com/qr-menu",
    shortCode: `q1_${Date.now().toString(36)}`,
    user: userA._id,
    clicks: 5,
  });

  // Seed clicks
  const now = new Date();
  const clicksToInsert = [
    // Link 1: 3 QR clicks, 2 direct clicks
    {
      link: link1._id,
      clickedAt: now,
      deviceType: "mobile",
      browser: "Chrome",
      operatingSystem: "Android",
      deviceVendor: "Samsung",
      country: "India",
      countryCode: "IN",
      city: "Bengaluru",
      isQR: true,
      utmCampaign: "summer_sale",
      utmSource: "newsletter",
      utmMedium: "email",
    },
    {
      link: link1._id,
      clickedAt: now,
      deviceType: "mobile",
      browser: "Safari",
      operatingSystem: "iOS",
      deviceVendor: "Apple",
      country: "India",
      countryCode: "IN",
      city: "Mumbai",
      isQR: true,
      utmCampaign: "summer_sale",
      utmSource: "newsletter",
      utmMedium: "email",
    },
    {
      link: link1._id,
      clickedAt: now,
      deviceType: "desktop",
      browser: "Chrome",
      operatingSystem: "Windows",
      deviceVendor: "Unknown",
      country: "United States",
      countryCode: "US",
      city: "San Francisco",
      isQR: false,
      utmCampaign: "summer_sale",
      utmSource: "newsletter",
      utmMedium: "email",
    },
    // Link 2: 2 QR clicks
    {
      link: link2._id,
      clickedAt: now,
      deviceType: "mobile",
      browser: "Chrome",
      operatingSystem: "Android",
      deviceVendor: "Google",
      country: "India",
      countryCode: "IN",
      city: "Bengaluru",
      isQR: true,
    },
    {
      link: link2._id,
      clickedAt: now,
      deviceType: "tablet",
      browser: "Safari",
      operatingSystem: "iOS",
      deviceVendor: "Apple",
      country: "United Kingdom",
      countryCode: "GB",
      city: "London",
      isQR: true,
    },
  ];
  await Click.insertMany(clicksToInsert);

  // Seed an anomaly
  const testAnomaly = await Anomaly.create({
    user: userA._id,
    link: link1._id,
    shortCode: link1.shortCode,
    originalUrl: link1.originalUrl,
    type: "SPIKE",
    severity: "CRITICAL",
    status: "new",
    currentClicks: 25,
    baselineAverage: 2.5,
    percentageDeviation: 900,
    absoluteDifference: 22.5,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
    title: "Traffic Spike Detected",
    description: "Clicks surged by 900% above historical baseline.",
    dedupKey: `stg14_${userA._id}_${link1._id}_${Date.now()}`,
  });

  // Seed an A/B experiment
  const expLink = await Link.create({
    originalUrl: "https://example.com/variant-control",
    shortCode: `ab_${Date.now().toString(36)}`,
    user: userA._id,
    isExperiment: true,
  });

  const testExp = await Experiment.create({
    user: userA._id,
    link: expLink._id,
    name: "Summer Landing Hero Test",
    variantA: "https://example.com/variant-control",
    variantB: "https://example.com/variant-challenger",
    status: "active",
    trafficSplit: { a: 50, b: 50 },
    fallbackVariant: "A",
  });

  // Seed experiment clicks (3 Variant A, 2 Variant B)
  await Click.insertMany([
    {
      link: expLink._id,
      clickedAt: now,
      deviceType: "desktop",
      experimentId: testExp._id,
      experimentVariant: "A",
    },
    {
      link: expLink._id,
      clickedAt: now,
      deviceType: "desktop",
      experimentId: testExp._id,
      experimentVariant: "A",
    },
    {
      link: expLink._id,
      clickedAt: now,
      deviceType: "mobile",
      experimentId: testExp._id,
      experimentVariant: "A",
    },
    {
      link: expLink._id,
      clickedAt: now,
      deviceType: "mobile",
      experimentId: testExp._id,
      experimentVariant: "B",
    },
    {
      link: expLink._id,
      clickedAt: now,
      deviceType: "tablet",
      experimentId: testExp._id,
      experimentVariant: "B",
    },
  ]);

  console.log("  ✅ Seeded multi-dimensional test records successfully.");

  // ---------------------------------------------------------------------------
  // TEST 5: CSV Export for All 9 Report Categories
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: CSV Export for All 9 Report Categories ---");

  const categories = ["overall", "links", "qr", "geo", "devices", "campaigns", "traffic", "anomalies", "experiments"];

  for (const cat of categories) {
    await runTest(`CSV export for category: '${cat}'`, async () => {
      const res = await request(`/api/reports/csv?type=${cat}&range=all`, { token: tokenA });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.contentType.includes("text/csv"), "Expected text/csv");
      assert(
        (res.rawBuffer[0] === 0xef && res.rawBuffer[1] === 0xbb && res.rawBuffer[2] === 0xbf) ||
          res.data.charCodeAt(0) === 0xfeff,
        "Expected UTF-8 BOM"
      );
      assert(res.data.includes("Smart Link Management Platform"), "Platform title in CSV");
      assert(res.data.includes(cat.toUpperCase()), "Category title in CSV");
      assert(res.disposition.includes(`smartlink_${cat}_all_`), `Expected filename with smartlink_${cat}_all_`);
    })();
  }

  // ---------------------------------------------------------------------------
  // TEST 6: PDF Export for All 9 Report Categories
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: PDF Export for All 9 Report Categories ---");

  for (const cat of categories) {
    await runTest(`PDF export for category: '${cat}'`, async () => {
      const res = await request(`/api/reports/pdf?type=${cat}&range=all`, { token: tokenA });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.contentType.includes("application/pdf"), "Expected application/pdf");
      assert(res.disposition.includes(`smartlink_${cat}_all_`), `Expected filename with smartlink_${cat}_all_`);
      assert(res.rawBuffer && res.rawBuffer.slice(0, 4).toString() === "%PDF", "Valid PDF header");
      assert(res.rawBuffer.length > 500, `Expected non-trivial PDF size, got ${res.rawBuffer.length} bytes`);
    })();
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Date Range Filtering (7d, 30d, all)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Date Range Filtering (7d, 30d, all) ---");

  await runTest("CSV export with range=7d", async () => {
    const res = await request("/api/reports/csv?type=overall&range=7d", { token: tokenA });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.includes("Last 7 Days (IST)"), "Expected 7d label in CSV");
    assert(res.disposition.includes("_7d_"), "Expected filename to include _7d_");
  })();

  await runTest("PDF export with range=30d", async () => {
    const res = await request("/api/reports/pdf?type=overall&range=30d", { token: tokenA });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.disposition.includes("_30d_"), "Expected filename to include _30d_");
  })();

  // ---------------------------------------------------------------------------
  // TEST 8: Individual Link Filter
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Individual Link Filter ---");

  await runTest("CSV export filtered for individual link by shortCode", async () => {
    const res = await request(`/api/reports/csv?type=links&shortCode=${link1.shortCode}&range=all`, { token: tokenA });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.includes(link1.shortCode), "Expected link1 shortCode in CSV");
    // Should NOT include link2
    assert(!res.data.includes(link2.shortCode), "Should not include link2 when filtered for link1");
  })();

  await runTest("PDF export filtered for individual link", async () => {
    const res = await request(`/api/reports/pdf?type=links&shortCode=${link1.shortCode}&range=all`, { token: tokenA });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.rawBuffer.slice(0, 4).toString() === "%PDF", "Valid PDF header");
  })();

  // ---------------------------------------------------------------------------
  // TEST 9: A/B Variant Separation & QR vs Direct Accuracy
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: A/B Variant Separation & QR Accuracy ---");

  await runTest("A/B Experiment CSV separates Variant A and Variant B clicks", async () => {
    const res = await request("/api/reports/csv?type=experiments&range=all", { token: tokenA });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.includes("Summer Landing Hero Test"), "Experiment name in CSV");
    assert(res.data.includes("Variant A"), "Variant A column present");
    assert(res.data.includes("Variant B"), "Variant B column present");
    assert(res.data.includes("60%"), "Variant A percent (3/5 = 60%) in CSV");
    assert(res.data.includes("40%"), "Variant B percent (2/5 = 40%) in CSV");
  })();

  await runTest("QR Analytics CSV distinguishes QR clicks from Direct clicks", async () => {
    const res = await request("/api/reports/csv?type=qr&range=all", { token: tokenA });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.includes("QR Code Scans"), "QR Code Scans header in CSV");
    assert(res.data.includes("Direct Link Clicks"), "Direct Link Clicks header in CSV");
  })();

  // ---------------------------------------------------------------------------
  // TEST 10: Multi-Tenant Data Isolation (User A vs User B)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 10: Multi-Tenant Data Isolation ---");

  await runTest("User B CSV does NOT contain User A's links, campaigns, or anomalies", async () => {
    const res = await request("/api/reports/csv?type=overall&range=all", { token: tokenB });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(!res.data.includes(link1.shortCode), "User B must not see link1");
    assert(!res.data.includes(link2.shortCode), "User B must not see link2");
    assert(!res.data.includes("summer_sale"), "User B must not see User A's campaign");
  })();

  await runTest("User B Anomaly CSV is empty of User A's anomalies", async () => {
    const res = await request("/api/reports/csv?type=anomalies&range=all", { token: tokenB });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(!res.data.includes(testAnomaly.shortCode), "User B must not see User A's anomaly");
  })();

  await runTest("User B Experiment CSV is empty of User A's experiments", async () => {
    const res = await request("/api/reports/csv?type=experiments&range=all", { token: tokenB });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(!res.data.includes("Summer Landing Hero Test"), "User B must not see User A's experiment");
  })();

  // ---------------------------------------------------------------------------
  // TEST 11: CSV Formula Injection Defense
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 11: CSV Formula Injection Defense ---");

  await runTest("CSV export neutralizes cell values starting with =, +, -, @", async () => {
    // Create a link with formula injection in utmCampaign
    const injectionLink = await Link.create({
      originalUrl: "https://example.com/test",
      shortCode: `inj_${Date.now().toString(36)}`,
      user: userA._id,
      utmCampaign: "=CMD('calc')",
      utmSource: "+EXCEL_MACRO()",
    });

    await Click.create({
      link: injectionLink._id,
      clickedAt: new Date(),
      utmCampaign: "=CMD('calc')",
      utmSource: "+EXCEL_MACRO()",
    });

    const res = await request("/api/reports/csv?type=campaigns&range=all", { token: tokenA });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    // Check that '=CMD' is escaped to "'=CMD"
    assert(res.data.includes("''=CMD") || res.data.includes("'=CMD"), "Formula '=' must be escaped with single quote");
    assert(res.data.includes("'+EXCEL") || res.data.includes("'+EXCEL"), "Formula '+' must be escaped with single quote");
  })();

  // Teardown
  server.close();
  await mongoose.disconnect();

  console.log("\n=======================================================");
  console.log(`Verification Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
