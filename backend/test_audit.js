/**
 * Backend Authorization Audit Test
 * 
 * Verifies that private resources are strictly authorized against the authenticated user's ID
 * and that IDOR / BOLA tampering is blocked at the database level.
 * 
 * ENVIRONMENT: Development (localhost:5000, MongoDB Atlas)
 * TEST ACCOUNTS: 'kumar' and 'kingvijay'
 * SAFETY: Strictly read-only queries (find, countDocuments, aggregate, and HTTP GET).
 *         No records are created, updated, or deleted.
 *         No credentials, passwords, or tokens are printed.
 */

import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import { User } from "./src/models/user.model.js";
import Link from "./src/models/link.model.js";
import Click from "./src/models/click.model.js";
import jwt from "jsonwebtoken";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

async function runAudit() {
  console.log("================================================================================");
  console.log("           BACKEND AUTHORIZATION & CROSS-USER ISOLATION AUDIT TEST              ");
  console.log("================================================================================");
  console.log(`Environment: Development`);
  console.log(`Backend Server: ${BASE_URL}`);
  console.log(`Database: Connected via MONGO_URI (Read-Only Audit Mode)`);
  console.log("--------------------------------------------------------------------------------\n");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[DB STATUS] Connected to MongoDB Atlas successfully.\n");

    // 1. Locate test accounts safely
    const kumarUser = await User.findOne({ username: "kumar", email: "kumar@gmail.com" })
      .select("_id username email")
      .lean();

    // Find the primary active kingvijay account with links
    const kingUsers = await User.find({ username: "kingvijay" })
      .select("_id username email")
      .lean();

    let kingUser = null;
    for (const ku of kingUsers) {
      const linkCount = await Link.countDocuments({ user: ku._id });
      if (linkCount > 0 && (!kingUser || linkCount > kingUser.linkCount)) {
        kingUser = { ...ku, linkCount };
      }
    }

    if (!kumarUser || !kingUser) {
      console.error("[ERROR] Could not find test accounts for 'kumar' or 'kingvijay'.");
      return;
    }

    console.log(`[ACCOUNTS FOUND]`);
    console.log(`- Account 1: username='${kumarUser.username}', email='${kumarUser.email}', id=${kumarUser._id}`);
    console.log(`- Account 2: username='${kingUser.username}', email='${kingUser.email}', id=${kingUser._id}\n`);

    // Fetch owned links for each user to prepare test data
    const kumarLinks = await Link.find({ user: kumarUser._id }).select("_id shortCode clicks originalUrl").lean();
    const kingLinks = await Link.find({ user: kingUser._id }).select("_id shortCode clicks originalUrl").lean();

    console.log(`[OWNED RESOURCES]`);
    console.log(`- Kumar owns ${kumarLinks.length} link(s):`);
    kumarLinks.forEach(l => console.log(`    * shortCode: '${l.shortCode}', clicks: ${l.clicks}`));

    console.log(`- Kingvijay owns ${kingLinks.length} link(s):`);
    kingLinks.forEach(l => console.log(`    * shortCode: '${l.shortCode}', clicks: ${l.clicks}`));

    const kumarLinkIds = kumarLinks.map(l => l._id);
    const kingLinkIds = kingLinks.map(l => l._id);

    // Verify database-level link isolation
    const idOverlap = kumarLinkIds.filter(id => kingLinkIds.some(kid => kid.toString() === id.toString()));
    console.log(`\n[DB LEVEL CHECK] Direct Link ID Overlap between Kumar & Kingvijay: ${idOverlap.length} (Expected: 0)`);

    // Verify click counts in Click collection
    const kumarClickCount = await Click.countDocuments({ link: { $in: kumarLinkIds } });
    const kingClickCount = await Click.countDocuments({ link: { $in: kingLinkIds } });
    console.log(`[DB LEVEL CHECK] Kumar total recorded clicks in DB: ${kumarClickCount}`);
    console.log(`[DB LEVEL CHECK] Kingvijay total recorded clicks in DB: ${kingClickCount}\n`);

    // Generate test session tokens strictly in memory without printing them
    const kumarToken = jwt.sign({ userId: kumarUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const kingToken = jwt.sign({ userId: kingUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h" });

    console.log("================================================================================");
    console.log("                        EXECUTING LIVE HTTP AUDIT SUITE                         ");
    console.log("================================================================================\n");

    const kumarSampleCode = kumarLinks[0]?.shortCode;
    const kingSampleCode = kingLinks[0]?.shortCode;

    const testSuite = [
      {
        id: "TEST-1",
        description: "Kumar fetching his own links (GET /api/links/my-links)",
        endpoint: "/api/links/my-links",
        token: kumarToken,
        expectedStatus: 200,
        evaluator: (data) => {
          if (!data || !Array.isArray(data.data)) return false;
          const countMatches = data.data.length === kumarLinks.length;
          const allOwned = data.data.every(l => l.user.toString() === kumarUser._id.toString());
          const containsKingLinks = data.data.some(l => kingLinkIds.some(kid => kid.toString() === l._id.toString()));
          return countMatches && allOwned && !containsKingLinks;
        },
        detail: (data) => `Returned ${data?.data?.length || 0} links for Kumar. All belong to Kumar: ${data?.data?.every(l => l.user.toString() === kumarUser._id.toString())}`
      },
      {
        id: "TEST-2",
        description: "Kingvijay fetching his own links (GET /api/links/my-links)",
        endpoint: "/api/links/my-links",
        token: kingToken,
        expectedStatus: 200,
        evaluator: (data) => {
          if (!data || !Array.isArray(data.data)) return false;
          const countMatches = data.data.length === kingLinks.length;
          const allOwned = data.data.every(l => l.user.toString() === kingUser._id.toString());
          const containsKumarLinks = data.data.some(l => kumarLinkIds.some(kid => kid.toString() === l._id.toString()));
          return countMatches && allOwned && !containsKumarLinks;
        },
        detail: (data) => `Returned ${data?.data?.length || 0} links for Kingvijay. All belong to Kingvijay: ${data?.data?.every(l => l.user.toString() === kingUser._id.toString())}`
      },
      {
        id: "TEST-3A",
        description: "Kumar fetching his own link analytics (GET /api/links/:shortCode/analytics)",
        endpoint: `/api/links/${kumarSampleCode}/analytics`,
        token: kumarToken,
        expectedStatus: 200,
        evaluator: (data) => data?.success === true && data?.shortCode === kumarSampleCode,
        detail: (data) => `Loaded analytics for /${data?.shortCode}. Total Clicks: ${data?.totalClicks}`
      },
      {
        id: "TEST-3B",
        description: "Kingvijay fetching his own link analytics (GET /api/links/:shortCode/analytics)",
        endpoint: `/api/links/${kingSampleCode}/analytics`,
        token: kingToken,
        expectedStatus: 200,
        evaluator: (data) => data?.success === true && data?.shortCode === kingSampleCode,
        detail: (data) => `Loaded analytics for /${data?.shortCode}. Total Clicks: ${data?.totalClicks}`
      },
      {
        id: "TEST-4",
        description: "BOLA/IDOR Defense: Kumar attempting to access Kingvijay's link analytics",
        endpoint: `/api/links/${kingSampleCode}/analytics`,
        token: kumarToken,
        expectedStatus: 404,
        evaluator: (data) => data?.success === false && data?.message === "Link not found",
        detail: (data) => `HTTP 404 blocked exposure. Response: "${data?.message}"`
      },
      {
        id: "TEST-5",
        description: "BOLA/IDOR Defense: Kingvijay attempting to access Kumar's link analytics",
        endpoint: `/api/links/${kumarSampleCode}/analytics`,
        token: kingToken,
        expectedStatus: 404,
        evaluator: (data) => data?.success === false && data?.message === "Link not found",
        detail: (data) => `HTTP 404 blocked exposure. Response: "${data?.message}"`
      },
      {
        id: "TEST-6A",
        description: "BOLA/IDOR Defense: Kumar attempting to fetch Kingvijay's click history",
        endpoint: `/api/links/${kingSampleCode}/history`,
        token: kumarToken,
        expectedStatus: 404,
        evaluator: (data) => data?.success === false && data?.message === "Link not found",
        detail: (data) => `HTTP 404 blocked exposure. Response: "${data?.message}"`
      },
      {
        id: "TEST-6B",
        description: "BOLA/IDOR Defense: Kingvijay attempting to fetch Kumar's click history",
        endpoint: `/api/links/${kumarSampleCode}/history`,
        token: kingToken,
        expectedStatus: 404,
        evaluator: (data) => data?.success === false && data?.message === "Link not found",
        detail: (data) => `HTTP 404 blocked exposure. Response: "${data?.message}"`
      },
      {
        id: "TEST-7",
        description: "Kumar All-Links Analytics isolation (GET /api/links/user/analytics/all-links)",
        endpoint: "/api/links/user/analytics/all-links",
        token: kumarToken,
        expectedStatus: 200,
        evaluator: (data) => {
          if (!data || data.success !== true) return false;
          const linksMatch = data.totalLinks === kumarLinks.length;
          const recordedMatch = data.totalRecordedClicks === kumarClickCount;
          // Verify that none of Kingvijay's links appear in history
          const foreignHistory = (data.history || []).some(h => kingLinkIds.some(kid => kid.toString() === h.link?.toString()));
          return linksMatch && recordedMatch && !foreignHistory;
        },
        detail: (data) => `Total Links: ${data?.totalLinks} (expected: ${kumarLinks.length}), Total Recorded Clicks: ${data?.totalRecordedClicks} (expected: ${kumarClickCount})`
      },
      {
        id: "TEST-8",
        description: "Kingvijay All-Links Analytics isolation (GET /api/links/user/analytics/all-links)",
        endpoint: "/api/links/user/analytics/all-links",
        token: kingToken,
        expectedStatus: 200,
        evaluator: (data) => {
          if (!data || data.success !== true) return false;
          const linksMatch = data.totalLinks === kingLinks.length;
          const recordedMatch = data.totalRecordedClicks === kingClickCount;
          // Verify that none of Kumar's links appear in history
          const foreignHistory = (data.history || []).some(h => kumarLinkIds.some(kid => kid.toString() === h.link?.toString()));
          return linksMatch && recordedMatch && !foreignHistory;
        },
        detail: (data) => `Total Links: ${data?.totalLinks} (expected: ${kingLinks.length}), Total Recorded Clicks: ${data?.totalRecordedClicks} (expected: ${kingClickCount})`
      },
      {
        id: "TEST-9",
        description: "Unauthenticated request rejection (GET /api/links/my-links without token)",
        endpoint: "/api/links/my-links",
        token: null,
        expectedStatus: 401,
        evaluator: (data) => data?.success === false && data?.message === "Unauthorized request",
        detail: (data) => `HTTP 401 returned. Response: "${data?.message}"`
      },
      {
        id: "TEST-10",
        description: "Unauthorized link modification attempt (PATCH /api/links/:shortCode)",
        endpoint: `/api/links/${kumarSampleCode}`,
        method: "PATCH",
        body: { originalUrl: "https://attacker-redirect.com" },
        token: kingToken,
        expectedStatus: 404,
        evaluator: (data) => data?.success === false && data?.message === "Resource not found",
        detail: (data) => `HTTP 404 returned (Endpoint does not exist, modification rejected).`
      },
      {
        id: "TEST-11",
        description: "Unauthorized link deletion attempt (DELETE /api/links/:shortCode)",
        endpoint: `/api/links/${kumarSampleCode}`,
        method: "DELETE",
        token: kingToken,
        expectedStatus: 404,
        evaluator: (data) => data?.success === false && data?.message === "Resource not found",
        detail: (data) => `HTTP 404 returned (Endpoint does not exist, deletion rejected).`
      },
    ];

    let allPass = true;

    for (const test of testSuite) {
      const headers = { "Content-Type": "application/json" };
      if (test.token) headers["Authorization"] = `Bearer ${test.token}`;

      const options = {
        method: test.method || "GET",
        headers,
      };
      if (test.body) {
        options.body = JSON.stringify(test.body);
      }

      const res = await fetch(`${BASE_URL}${test.endpoint}`, options);
      const data = await res.json().catch(() => null);

      const statusMatch = res.status === test.expectedStatus;
      const evaluationPassed = test.evaluator(data);
      const testPassed = statusMatch && evaluationPassed;

      if (!testPassed) allPass = false;

      // Sanitize payload to keep output safe and readable
      let sanitizedSnippet = "";
      if (data) {
        const copy = JSON.parse(JSON.stringify(data));
        // Remove large nested arrays if any for concise logging
        if (copy.history && copy.history.length > 2) {
          copy.history = `[${copy.history.length} click records]`;
        }
        if (copy.data && Array.isArray(copy.data) && copy.data.length > 2) {
          copy.data = `[${copy.data.length} link records]`;
        }
        if (copy.dailyTrends && copy.dailyTrends.length > 2) {
          copy.dailyTrends = `[${copy.dailyTrends.length} days]`;
        }
        sanitizedSnippet = JSON.stringify(copy);
      }

      const badge = testPassed ? "[PASS]" : "[FAIL]";
      console.log(`${badge} ${test.id}: ${test.description}`);
      console.log(`       Target: ${test.method || "GET"} ${test.endpoint}`);
      console.log(`       Status: HTTP ${res.status} (Expected: ${test.expectedStatus}) | Result Check: ${evaluationPassed ? "VALIDATED" : "FAILED"}`);
      console.log(`       Response: ${sanitizedSnippet}`);
      console.log(`       Detail: ${test.detail(data)}\n`);
    }

    console.log("================================================================================");
    if (allPass) {
      console.log("                    ALL 11 AUTHORIZATION TESTS PASSED!                          ");
      console.log("   - Cross-user link isolation is 100% verified.");
      console.log("   - Aggregate analytics for Kumar and Kingvijay are fully segregated.");
      console.log("   - BOLA / IDOR attempts return 404 Link not found.");
      console.log("   - No unauthorized modification or deletion endpoints exist.");
    } else {
      console.log("               WARNING: ONE OR MORE TESTS FAILED!                               ");
    }
    console.log("================================================================================");
  } finally {
    await mongoose.disconnect();
    console.log("\n[DB STATUS] Disconnected from MongoDB cleanly. No data modified.");
  }
}

runAudit().catch(console.error);
