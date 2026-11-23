import React, { useState } from "react";
import MarketingLayout from "./MarketingLayout";
import { Copy, Check, Terminal, ExternalLink, ShieldAlert, Cpu } from "lucide-react";

function CodeBlock({ code, language = "json" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mkt-code-block">
      <button
        type="button"
        className="mkt-copy-btn"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy code"}
      >
        {copied ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <pre style={{ margin: 0, paddingRight: "70px" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DocsPage({ token, onNavigate }) {
  const [activeSection, setActiveSection] = useState("quickstart");

  const scrollTo = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <MarketingLayout
      title="API Documentation — SmartLink Developer Reference"
      description="Complete REST API documentation, endpoint references, request headers, and response schemas for SmartLink."
      token={token}
      currentPath="/docs"
      onNavigate={onNavigate}
    >
      <div className="mkt-container">
        <div className="mkt-docs-layout">
          {/* Left Navigation Sidebar */}
          <aside className="mkt-docs-sidebar" aria-label="API Sections">
            <div className="mkt-docs-group">
              <div className="mkt-docs-heading">Overview</div>
              <a
                href="#quickstart"
                className={`mkt-docs-nav-item ${activeSection === "quickstart" ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); scrollTo("quickstart"); }}
              >
                Quick start
              </a>
              <a
                href="#authentication"
                className={`mkt-docs-nav-item ${activeSection === "authentication" ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); scrollTo("authentication"); }}
              >
                Authentication
              </a>
            </div>

            <div className="mkt-docs-group">
              <div className="mkt-docs-heading">Links API</div>
              <a
                href="#create-link"
                className={`mkt-docs-nav-item ${activeSection === "create-link" ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); scrollTo("create-link"); }}
              >
                <span>Create a link</span>
                <span className="mkt-method-badge mkt-post">POST</span>
              </a>
              <a
                href="#list-links"
                className={`mkt-docs-nav-item ${activeSection === "list-links" ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); scrollTo("list-links"); }}
              >
                <span>List links</span>
                <span className="mkt-method-badge mkt-get">GET</span>
              </a>
            </div>

            <div className="mkt-docs-group">
              <div className="mkt-docs-heading">Analytics API</div>
              <a
                href="#analytics-overview"
                className={`mkt-docs-nav-item ${activeSection === "analytics-overview" ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); scrollTo("analytics-overview"); }}
              >
                <span>Get analytics</span>
                <span className="mkt-method-badge mkt-get">GET</span>
              </a>
              <a
                href="#campaign-analytics"
                className={`mkt-docs-nav-item ${activeSection === "campaign-analytics" ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); scrollTo("campaign-analytics"); }}
              >
                <span>Campaign metrics</span>
                <span className="mkt-method-badge mkt-get">GET</span>
              </a>
            </div>

            <div className="mkt-docs-group">
              <div className="mkt-docs-heading">Reliability</div>
              <a
                href="#errors"
                className={`mkt-docs-nav-item ${activeSection === "errors" ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); scrollTo("errors"); }}
              >
                Error schemas
              </a>
              <a
                href="#ratelimits"
                className={`mkt-docs-nav-item ${activeSection === "ratelimits" ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); scrollTo("ratelimits"); }}
              >
                Rate limits
              </a>
            </div>
          </aside>

          {/* Right Main Content */}
          <article className="mkt-docs-content">
            {/* Header */}
            <div style={{ margin: "0 0 40px", textAlign: "left" }}>
              <div className="mkt-section-tag">REST API v1</div>
              <h1 className="mkt-section-title" style={{ fontSize: "36px", margin: "8px 0 12px" }}>
                SmartLink Developer Reference
              </h1>
              <p className="mkt-section-subtitle" style={{ margin: 0 }}>
                Manage short links programmatically, configure dynamic QR codes, and query real-time
                traffic analytics via standard JSON REST endpoints.
              </p>
            </div>

            {/* 1. Quickstart */}
            <section id="quickstart" style={{ marginBottom: "64px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--mkt-text)", marginBottom: "12px" }}>
                Quick start & Base URL
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                All API requests must be issued over HTTPS. The default production and local API base URLs are:
              </p>

              <CodeBlock
                code={`# Production Base URL
https://api.smartlink.io

# Local Development Base URL
http://localhost:5000`}
                language="bash"
              />
            </section>

            {/* 2. Authentication */}
            <section id="authentication" style={{ marginBottom: "64px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--mkt-text)", marginBottom: "12px" }}>
                Authentication
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                SmartLink authenticates API requests using Bearer tokens. Include your access token in the
                <code> Authorization</code> request header.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span className="mkt-method-badge mkt-post">POST</span>
                <code style={{ fontSize: "14px", fontWeight: "600", color: "var(--mkt-text)" }}>
                  /api/v1/users/login
                </code>
              </div>

              <CodeBlock
                code={`// Request: Login to retrieve JWT Access Token
curl -X POST https://api.smartlink.io/api/v1/users/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "vijay@123gmail.com",
    "password": "your_secure_password"
  }'

// Response (200 OK):
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "6b00bce9232c1c654e2e4b53",
    "username": "vijaykumar",
    "email": "vijay@123gmail.com"
  }
}`}
              />
            </section>

            {/* 3. Create a Link */}
            <section id="create-link" style={{ marginBottom: "64px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--mkt-text)", marginBottom: "12px" }}>
                Create a Short Link
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                Generates a shortened URL with optional custom alias, expiration date, max-click limit, and UTM tags.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span className="mkt-method-badge mkt-post">POST</span>
                <code style={{ fontSize: "14px", fontWeight: "600", color: "var(--mkt-text)" }}>
                  /api/links
                </code>
              </div>

              <CodeBlock
                code={`curl -X POST https://api.smartlink.io/api/links \\
  -H "Authorization: Bearer <your_jwt_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "originalUrl": "https://example.com/product-launch",
    "customCode": "launch26",
    "utmSource": "twitter",
    "utmMedium": "social",
    "utmCampaign": "spring_launch",
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "maxClicks": 1000
  }'

// Response (201 Created):
{
  "success": true,
  "message": "Link created successfully",
  "data": {
    "_id": "6afebb0c87944e6d238fcd3a",
    "shortCode": "launch26",
    "originalUrl": "https://example.com/product-launch",
    "clicks": 0,
    "user": "6b00bce9232c1c654e2e4b53",
    "createdAt": "2026-11-21T10:00:00.000Z"
  }
}`}
              />
            </section>

            {/* 4. List Links */}
            <section id="list-links" style={{ marginBottom: "64px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--mkt-text)", marginBottom: "12px" }}>
                List User Links
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                Returns a paginated list of short links owned by the authenticated account.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span className="mkt-method-badge mkt-get">GET</span>
                <code style={{ fontSize: "14px", fontWeight: "600", color: "var(--mkt-text)" }}>
                  /api/links/my-links?page=1&limit=50
                </code>
              </div>

              <CodeBlock
                code={`curl -X GET "https://api.smartlink.io/api/links/my-links?page=1&limit=50" \\
  -H "Authorization: Bearer <your_jwt_token>"

// Response (200 OK):
{
  "success": true,
  "totalLinks": 3,
  "totalClicks": 28,
  "data": [
    {
      "_id": "6afebb0c87944e6d238fcd38",
      "shortCode": "gh_smart",
      "originalUrl": "https://github.com/developer/smartlink",
      "clicks": 14,
      "createdAt": "2026-11-12T09:02:04.024Z"
    },
    {
      "_id": "6afebb0c87944e6d238fcd39",
      "shortCode": "tw_launch",
      "originalUrl": "https://twitter.com/product_launch",
      "clicks": 8,
      "createdAt": "2026-11-14T09:02:04.085Z"
    },
    {
      "_id": "6afebb0c87944e6d238fcd3a",
      "shortCode": "doc_guide",
      "originalUrl": "https://docs.smartlink.io/guide",
      "clicks": 6,
      "createdAt": "2026-11-17T09:02:04.087Z"
    }
  ]
}`}
              />
            </section>

            {/* 5. Analytics Overview */}
            <section id="analytics-overview" style={{ marginBottom: "64px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--mkt-text)", marginBottom: "12px" }}>
                Aggregated Analytics Overview
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                Retrieves high-level click counts, device distributions, and browser statistics across all links.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span className="mkt-method-badge mkt-get">GET</span>
                <code style={{ fontSize: "14px", fontWeight: "600", color: "var(--mkt-text)" }}>
                  /api/links/user/analytics/all-links
                </code>
              </div>

              <CodeBlock
                code={`curl -X GET https://api.smartlink.io/api/links/user/analytics/all-links \\
  -H "Authorization: Bearer <your_jwt_token>"

// Response (200 OK):
{
  "success": true,
  "isAllLinks": true,
  "totalLinks": 3,
  "totalClicks": 28,
  "totalRecordedClicks": 28,
  "devices": [
    { "key": "desktop", "name": "Desktop", "count": 17, "percentage": 60.7 },
    { "key": "mobile", "name": "Mobile", "count": 11, "percentage": 39.3 }
  ],
  "browsers": [
    { "name": "Chrome", "count": 16, "percentage": 57.1 },
    { "name": "Safari", "count": 7, "percentage": 25.0 },
    { "name": "Firefox", "count": 3, "percentage": 10.7 },
    { "name": "Edge", "count": 2, "percentage": 7.1 }
  ]
}`}
              />
            </section>

            {/* 6. Campaign Analytics */}
            <section id="campaign-analytics" style={{ marginBottom: "64px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--mkt-text)", marginBottom: "12px" }}>
                Campaign & UTM Metrics
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                Aggregates traffic performance by UTM source, campaign name, and referral channels.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span className="mkt-method-badge mkt-get">GET</span>
                <code style={{ fontSize: "14px", fontWeight: "600", color: "var(--mkt-text)" }}>
                  /api/links/user/analytics/campaigns?range=all
                </code>
              </div>

              <CodeBlock
                code={`curl -X GET "https://api.smartlink.io/api/links/user/analytics/campaigns?range=all" \\
  -H "Authorization: Bearer <your_jwt_token>"

// Response (200 OK):
{
  "success": true,
  "data": {
    "summary": {
      "totalRecordedClicks": 28,
      "attributedClicks": 28,
      "unattributedClicks": 0,
      "totalCampaigns": 1,
      "topSource": { "name": "twitter", "count": 10 },
      "topCampaign": { "name": "spring_launch", "count": 28 }
    },
    "campaigns": [
      { "name": "spring_launch", "count": 28 }
    ]
  }
}`}
              />
            </section>

            {/* 7. Errors */}
            <section id="errors" style={{ marginBottom: "64px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--mkt-text)", marginBottom: "12px" }}>
                Error Schemas & Status Codes
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                SmartLink uses standard HTTP response codes to indicate API success or failure.
              </p>

              <CodeBlock
                code={`// Standard Error Response Payload
{
  "success": false,
  "message": "Human-readable description of the error"
}

// HTTP Status Codes:
// 200 OK           - Request succeeded
// 201 Created      - Resource created
// 400 Bad Request  - Missing or invalid request parameters
// 401 Unauthorized - Missing or invalid Bearer token
// 404 Not Found    - Resource does not exist
// 409 Conflict     - Short code alias already taken
// 429 Rate Limit   - Exceeded rate quota
// 500 Server Error - Internal processing error`}
              />
            </section>

            {/* 8. Rate Limits */}
            <section id="ratelimits" style={{ marginBottom: "64px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--mkt-text)", marginBottom: "12px" }}>
                Rate Limits
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                Every response contains standard rate-limiting headers indicating quota consumption:
              </p>

              <CodeBlock
                code={`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 994
X-RateLimit-Reset: 1795079796`}
                language="http"
              />
            </section>
          </article>
        </div>
      </div>
    </MarketingLayout>
  );
}
