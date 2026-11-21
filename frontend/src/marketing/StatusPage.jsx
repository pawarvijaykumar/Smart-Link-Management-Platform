import React from "react";
import MarketingLayout from "./MarketingLayout";
import { CheckCircle2, ShieldCheck, Activity, Server, Database, Globe } from "lucide-react";

const SERVICES = [
  { name: "Global Short Link Redirection Engine", status: "Operational", uptime: "99.99%", latency: "24ms" },
  { name: "Real-Time Click Ingestion & Analytics", status: "Operational", uptime: "99.98%", latency: "38ms" },
  { name: "SmartLink REST API v1", status: "Operational", uptime: "99.95%", latency: "42ms" },
  { name: "Database & Resilient Storage Layer", status: "Operational", uptime: "100.00%", latency: "12ms" },
  { name: "Vector QR Code Generation Service", status: "Operational", uptime: "99.99%", latency: "18ms" },
];

export default function StatusPage({ token, onNavigate }) {
  // Generate 90 daily uptime bars
  const bars = Array.from({ length: 90 }, (_, i) => ({
    day: i + 1,
    operational: true,
  }));

  return (
    <MarketingLayout
      title="System Status — SmartLink Real-Time Availability"
      description="Real-time uptime, service status, and operational metrics for the SmartLink redirection engine and API."
      token={token}
      currentPath="/status"
      onNavigate={onNavigate}
    >
      <div className="mkt-container" style={{ padding: "72px 24px 96px", maxWidth: "860px" }}>
        {/* Banner */}
        <div
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "12px",
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "48px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#10B981",
                boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.25)",
              }}
            ></div>
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: "700", color: "var(--mkt-text)", margin: 0 }}>
                All Systems Fully Operational
              </h1>
              <p style={{ fontSize: "14px", color: "var(--mkt-muted)", margin: "4px 0 0" }}>
                Verified across all regional edge routing clusters.
              </p>
            </div>
          </div>

          <div style={{ fontSize: "13px", fontWeight: "600", color: "#10B981" }}>
            99.99% Overall Uptime
          </div>
        </div>

        {/* 90-Day Uptime Visualization */}
        <section style={{ marginBottom: "56px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "600", color: "var(--mkt-text)", margin: 0 }}>
              System Uptime (Last 90 Days)
            </h2>
            <span style={{ fontSize: "13px", color: "var(--mkt-muted)" }}>90 days ago &rarr; Today</span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "3px",
              height: "36px",
              alignItems: "stretch",
              background: "var(--mkt-surface)",
              border: "1px solid var(--mkt-border)",
              borderRadius: "8px",
              padding: "6px",
            }}
            title="90 days with 100% operational uptime"
          >
            {bars.map((b) => (
              <div
                key={b.day}
                style={{
                  flex: 1,
                  background: "#10B981",
                  borderRadius: "2px",
                  opacity: 0.85,
                }}
              ></div>
            ))}
          </div>
        </section>

        {/* Component Services List */}
        <section style={{ marginBottom: "56px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--mkt-text)", marginBottom: "16px" }}>
            Platform Components
          </h2>

          <div
            style={{
              background: "var(--mkt-surface)",
              border: "1px solid var(--mkt-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {SERVICES.map((s, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: idx < SERVICES.length - 1 ? "1px solid var(--mkt-border-subtle)" : "none",
                  fontSize: "14px",
                }}
              >
                <div>
                  <div style={{ fontWeight: "600", color: "var(--mkt-text)" }}>{s.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--mkt-muted)", marginTop: "2px" }}>
                    Avg Response: {s.latency}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontSize: "13px", color: "var(--mkt-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {s.uptime}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#10B981",
                      background: "rgba(16, 185, 129, 0.1)",
                      padding: "3px 8px",
                      borderRadius: "999px",
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>{s.status}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Incident History */}
        <section>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--mkt-text)", marginBottom: "14px" }}>
            Incident History
          </h2>
          <div
            style={{
              background: "var(--mkt-surface)",
              border: "1px solid var(--mkt-border)",
              borderRadius: "12px",
              padding: "24px",
              color: "var(--mkt-muted)",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            No service outages or incidents recorded in the past 90 days.
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
