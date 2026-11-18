// =============================================================================
// Stage 14: PDF Report Generator Utility — 2026-11-19
// Generates professional, publication-quality A4 PDF reports with executive KPI
// summaries, structured analytics tables, visual distribution bars, IST timestamps,
// and automatic page number footers.
// =============================================================================

import PDFDocument from "pdfkit";

// Theme Palette
const COLORS = {
  primary: "#4C1D95",      // Deep Purple / Violet
  primaryLight: "#7C3AED", // Vivid Accent Purple
  secondary: "#0284C7",    // Cyan / Ocean Blue
  textDark: "#0F172A",     // Slate 900
  textMuted: "#64748B",    // Slate 500
  border: "#E2E8F0",       // Slate 200
  bgCard: "#F8FAFC",       // Slate 50
  bgAltRow: "#F1F5F9",     // Slate 100
  white: "#FFFFFF",
  success: "#059669",      // Emerald
  warning: "#D97706",      // Amber
  danger: "#DC2626",       // Rose / Red
};

/**
 * Truncates text cleanly with an ellipsis to fit a maximum character limit.
 */
function truncate(text, max = 40) {
  if (!text) return "";
  const s = String(text);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Checks remaining page height and triggers a page break if needed.
 * If broken, automatically returns the new Y position.
 */
function ensurePageSpace(doc, neededHeight = 60) {
  if (doc.y + neededHeight > 760) {
    doc.addPage();
    return 40;
  }
  return doc.y;
}

/**
 * Draws the document header banner.
 */
function drawHeader(doc, reportTitle, rangeLabel, generatedAtIST) {
  const startX = 40;
  const contentWidth = 515;

  // Accent bar
  doc.rect(startX, 40, contentWidth, 5).fill(COLORS.primaryLight);

  // Platform Title
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(COLORS.primary)
    .text("SMART LINK MANAGEMENT PLATFORM", startX, 55, { width: contentWidth });

  // Report Category Subtitle
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(COLORS.textDark)
    .text(reportTitle.toUpperCase(), startX, 76, { width: contentWidth });

  // Metadata Line (IST Timestamp & Range)
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.textMuted)
    .text(
      `Generated: ${generatedAtIST}   |   Evaluation Period: ${rangeLabel}   |   Classification: Confidential`,
      startX,
      95,
      { width: contentWidth }
    );

  // Separator rule
  doc.rect(startX, 110, contentWidth, 1).fill(COLORS.border);
  doc.y = 120;
}

/**
 * Draws executive KPI metric cards.
 *
 * @param {PDFDocument} doc
 * @param {Array<{label: string, value: string|number, highlight?: boolean}>} kpis
 */
function drawKpiCards(doc, kpis) {
  ensurePageSpace(doc, 70);
  const startX = 40;
  const cardGap = 8;
  const numCards = Math.min(kpis.length, 5);
  const totalWidth = 515;
  const cardWidth = (totalWidth - (numCards - 1) * cardGap) / numCards;
  const cardHeight = 48;
  const currentY = doc.y;

  kpis.slice(0, numCards).forEach((kpi, index) => {
    const x = startX + index * (cardWidth + cardGap);

    // Card background
    doc
      .roundedRect(x, currentY, cardWidth, cardHeight, 4)
      .fillAndStroke(COLORS.bgCard, COLORS.border);

    // KPI Label
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(COLORS.textMuted)
      .text(kpi.label.toUpperCase(), x + 6, currentY + 7, {
        width: cardWidth - 12,
        align: "left",
      });

    // KPI Value
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(kpi.highlight ? COLORS.primaryLight : COLORS.textDark)
      .text(String(kpi.value), x + 6, currentY + 23, {
        width: cardWidth - 12,
        align: "left",
      });
  });

  doc.y = currentY + cardHeight + 16;
}

/**
 * Draws a section heading.
 */
function drawSectionHeading(doc, title) {
  ensurePageSpace(doc, 35);
  const startX = 40;
  const contentWidth = 515;

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.primary)
    .text(title, startX, doc.y, { width: contentWidth });

  doc.rect(startX, doc.y + 2, 60, 2).fill(COLORS.primaryLight);
  doc.y = doc.y + 8;
}

/**
 * Draws a table with formatted headers and alternating row backgrounds.
 *
 * @param {PDFDocument} doc
 * @param {Array<{header: string, width: number, align?: string}>} columns
 * @param {Array<Array<any>>} rows
 */
function drawTable(doc, columns, rows) {
  const startX = 40;
  const contentWidth = 515;
  const headerHeight = 20;
  const rowHeight = 18;

  function renderTableHeader(y) {
    doc.rect(startX, y, contentWidth, headerHeight).fill(COLORS.primary);
    let xOffset = startX;
    columns.forEach((col) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(COLORS.white)
        .text(col.header, xOffset + 4, y + 5, {
          width: col.width - 8,
          align: col.align || "left",
        });
      xOffset += col.width;
    });
    return y + headerHeight;
  }

  ensurePageSpace(doc, headerHeight + rowHeight * 2);
  let currentY = renderTableHeader(doc.y);

  if (!rows || rows.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(COLORS.textMuted)
      .text("No data recorded for this section in the selected date range.", startX + 10, currentY + 8);
    doc.y = currentY + 30;
    return;
  }

  rows.forEach((row, rowIndex) => {
    // Check if new page is needed
    if (currentY + rowHeight > 760) {
      doc.addPage();
      currentY = renderTableHeader(40);
    }

    // Alternating row background
    if (rowIndex % 2 === 1) {
      doc.rect(startX, currentY, contentWidth, rowHeight).fill(COLORS.bgAltRow);
    }

    // Bottom row border line
    doc.rect(startX, currentY + rowHeight - 0.5, contentWidth, 0.5).fill(COLORS.border);

    // Cells
    let xOffset = startX;
    columns.forEach((col, colIndex) => {
      const cellVal = row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : "";
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.textDark)
        .text(cellVal, xOffset + 4, currentY + 4, {
          width: col.width - 8,
          align: col.align || "left",
        });
      xOffset += col.width;
    });

    currentY += rowHeight;
  });

  doc.y = currentY + 12;
}

/**
 * Draws visual progress/distribution bars for comparative breakdowns.
 *
 * @param {PDFDocument} doc
 * @param {Array<{label: string, count: number, percentage: number, color?: string}>} items
 */
function drawDistributionBars(doc, items, maxItems = 6) {
  if (!items || items.length === 0) {
    ensurePageSpace(doc, 30);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(COLORS.textMuted)
      .text("No distribution data recorded for this section in the selected date range.", 40 + 10, doc.y + 4);
    doc.y += 24;
    return;
  }

  ensurePageSpace(doc, Math.min(items.length, maxItems) * 22 + 20);
  const startX = 40;
  const barStartX = 180;
  const barMaxWidth = 260;
  const barHeight = 10;
  let currentY = doc.y;

  items.slice(0, maxItems).forEach((item) => {
    if (currentY + 22 > 760) {
      doc.addPage();
      currentY = 40;
    }

    // Label
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.textDark)
      .text(truncate(item.label, 24), startX, currentY + 2, { width: 135, align: "left" });

    // Bar background
    doc.roundedRect(barStartX, currentY + 1, barMaxWidth, barHeight, 3).fill(COLORS.border);

    // Bar fill
    const fillWidth = Math.max(2, (barMaxWidth * Math.min(100, item.percentage)) / 100);
    doc.roundedRect(barStartX, currentY + 1, fillWidth, barHeight, 3).fill(item.color || COLORS.primaryLight);

    // Value text
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.textMuted)
      .text(`${item.count} (${item.percentage}%)`, barStartX + barMaxWidth + 8, currentY + 2, {
        width: 65,
        align: "right",
      });

    currentY += 18;
  });

  doc.y = currentY + 10;
}

/**
 * Adds running page numbers and confidentiality footers to all pages.
 */
function addRunningFooters(doc, generatedAtIST) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    const footerY = 785;
    const contentWidth = 515;

    // Footer divider line
    doc.rect(40, footerY - 5, contentWidth, 0.5).fill(COLORS.border);

    // Left: Platform & confidentiality notice
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLORS.textMuted)
      .text(
        `Smart Link Management Platform — Confidential Analytics Report  |  ${generatedAtIST}`,
        40,
        footerY,
        { width: 380, align: "left" }
      );

    // Right: Page number
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(COLORS.textMuted)
      .text(`Page ${i + 1} of ${totalPages}`, 420, footerY, {
        width: 135,
        align: "right",
      });
  }
}

/**
 * Generates a complete PDF document buffer for the given report type and data.
 *
 * @param {string} type - Report category
 * @param {Object} reportData - Result of aggregateReportData
 * @returns {Promise<Buffer>} - Resolves with PDF byte buffer
 */
export function generatePdfReport(type, reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", (err) => reject(err));

      const { meta, summary } = reportData;

      // CHANGE: Stage 14 PDF & Reports Fix: Defensive summary access and safe property calls — 2026-11-19
      // -----------------------------------------------------------------------
      // 1. Overall Dashboard Report
      // -----------------------------------------------------------------------
      if (type === "overall") {
        drawHeader(doc, "Overall Dashboard Performance Report", meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Total Links", value: summary?.totalLinks ?? 0 },
          { label: "Total Clicks", value: summary?.totalClicks ?? 0, highlight: true },
          { label: "QR Scans", value: summary?.qrClicks ?? 0 },
          { label: "Direct Clicks", value: summary?.directClicks ?? 0 },
          { label: "QR Adoption", value: `${summary?.qrPercent ?? 0}%` },
        ]);

        drawSectionHeading(doc, "1. Top Performing Short Links");
        drawTable(
          doc,
          [
            { header: "Short Code", width: 80 },
            { header: "Original URL", width: 195 },
            { header: "Total Clicks", width: 75, align: "right" },
            { header: "QR Scans", width: 65, align: "right" },
            { header: "Created Date (IST)", width: 100, align: "right" },
          ],
          (reportData.links || []).slice(0, 15).map((l) => [
            `/${l.shortCode}`,
            truncate(l.originalUrl, 42),
            l.totalClicks ?? 0,
            l.qrClicks ?? 0,
            l.createdAtIST || "N/A",
          ])
        );

        drawSectionHeading(doc, "2. Geographic Distribution (Top Countries)");
        drawTable(
          doc,
          [
            { header: "Country", width: 220 },
            { header: "Clicks", width: 145, align: "right" },
            { header: "Share %", width: 150, align: "right" },
          ],
          (reportData.topCountries || []).map((c) => [c.country || "Unknown", c.clicks ?? 0, `${c.percentage ?? 0}%`])
        );

        drawSectionHeading(doc, "3. Device Category Breakdown");
        drawDistributionBars(
          doc,
          (reportData.deviceBreakdown || []).map((d) => ({
            label: String(d.deviceType || "unknown").toUpperCase(),
            count: d.clicks ?? 0,
            percentage: d.percentage ?? 0,
            color: COLORS.primaryLight,
          }))
        );
      }

      // -----------------------------------------------------------------------
      // 2. Individual Link Performance Report
      // -----------------------------------------------------------------------
      else if (type === "links") {
        const title = meta?.isSingleLink
          ? `Link Performance: /${meta?.targetShortCode}`
          : "Individual Link Performance Report";
        drawHeader(doc, title, meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Links Evaluated", value: summary?.totalLinksEvaluated ?? 0 },
          { label: "Total Clicks", value: summary?.totalClicks ?? 0, highlight: true },
          { label: "Recent Logs", value: summary?.totalLogsIncluded ?? 0 },
          { label: "Filter Mode", value: meta?.isSingleLink ? "Single Link" : "All Links" },
        ]);

        drawSectionHeading(doc, "1. Link Performance & Security Policies");
        drawTable(
          doc,
          [
            { header: "Short Code", width: 70 },
            { header: "Destination URL", width: 165 },
            { header: "Clicks", width: 50, align: "right" },
            { header: "QR %", width: 45, align: "right" },
            { header: "Status", width: 50 },
            { header: "Password", width: 55 },
            { header: "Expires (IST)", width: 80, align: "right" },
          ],
          (reportData.links || []).map((l) => [
            `/${l.shortCode}`,
            truncate(l.originalUrl, 32),
            l.totalClicks ?? 0,
            `${l.qrPercentage ?? 0}%`,
            l.status || "Active",
            l.hasPassword ? "Yes" : "No",
            l.expiresAtIST === "Never" ? "Never" : truncate(l.expiresAtIST, 16),
          ])
        );

        drawSectionHeading(doc, "2. Recent Visitor Logs (Audit Trail)");
        drawTable(
          doc,
          [
            { header: "Timestamp (IST)", width: 110 },
            { header: "Link", width: 55 },
            { header: "Channel", width: 60 },
            { header: "Device", width: 55 },
            { header: "OS", width: 65 },
            { header: "Browser", width: 70 },
            { header: "Location", width: 100 },
          ],
          (reportData.recentLogs || []).slice(0, 30).map((log) => [
            truncate(log.timestampIST, 20),
            `/${log.shortCode}`,
            log.channel || "Direct Link",
            log.deviceType || "unknown",
            truncate(log.os || "Unknown", 12),
            truncate(log.browser || "Unknown", 12),
            `${log.country || "Unknown"}, ${log.city || "Unknown"}`,
          ])
        );
      }

      // -----------------------------------------------------------------------
      // 3. QR Analytics Report
      // -----------------------------------------------------------------------
      else if (type === "qr") {
        drawHeader(doc, "QR Code Analytics & Adoption Report", meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Total Clicks", value: summary?.totalClicks ?? 0 },
          { label: "QR Scans", value: summary?.qrClicks ?? 0, highlight: true },
          { label: "Direct Clicks", value: summary?.directClicks ?? 0 },
          { label: "QR Adoption", value: `${summary?.qrPercentage ?? 0}%`, highlight: true },
          { label: "Active QR Links", value: summary?.activeQRLinksCount ?? 0 },
        ]);

        drawSectionHeading(doc, "1. QR Performance by Short Link");
        drawTable(
          doc,
          [
            { header: "Short Code", width: 80 },
            { header: "Destination URL", width: 195 },
            { header: "Total Clicks", width: 75, align: "right" },
            { header: "QR Scans", width: 75, align: "right" },
            { header: "QR Share %", width: 90, align: "right" },
          ],
          (reportData.qrLinks || []).slice(0, 15).map((l) => [
            `/${l.shortCode}`,
            truncate(l.originalUrl, 42),
            l.totalClicks ?? 0,
            l.qrClicks ?? 0,
            `${l.qrPercentage ?? 0}%`,
          ])
        );

        drawSectionHeading(doc, "2. Daily QR Scan Trend");
        drawTable(
          doc,
          [
            { header: "Date (IST)", width: 250 },
            { header: "QR Scans Recorded", width: 265, align: "right" },
          ],
          (reportData.dailyTrend || []).map((d) => [d.dateIST || "N/A", d.qrScans ?? 0])
        );
      }

      // -----------------------------------------------------------------------
      // 4. Geo-Location Analytics Report
      // -----------------------------------------------------------------------
      else if (type === "geo") {
        drawHeader(doc, "Geographic Audience & Location Report", meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Total Visits", value: summary?.totalClicks ?? 0, highlight: true },
          { label: "Unique Countries", value: summary?.totalCountries ?? 0 },
          { label: "Unique Cities", value: summary?.totalCities ?? 0 },
          { label: "Top Country", value: truncate(summary?.topCountry || "N/A", 14) },
          { label: "Top City", value: truncate(summary?.topCity || "N/A", 14) },
        ]);

        drawSectionHeading(doc, "1. Country Audience Distribution");
        drawTable(
          doc,
          [
            { header: "Country Name", width: 160 },
            { header: "ISO Code", width: 65 },
            { header: "Total Clicks", width: 90, align: "right" },
            { header: "QR Scans", width: 80, align: "right" },
            { header: "Global Share %", width: 120, align: "right" },
          ],
          (reportData.countries || []).map((c) => [
            c.country || "Unknown",
            c.countryCode || "NA",
            c.clicks ?? 0,
            c.qrClicks ?? 0,
            `${c.percentage ?? 0}%`,
          ])
        );

        drawSectionHeading(doc, "2. Top Metropolitan Cities");
        drawTable(
          doc,
          [
            { header: "City", width: 180 },
            { header: "Country", width: 155 },
            { header: "Clicks", width: 90, align: "right" },
            { header: "Share %", width: 90, align: "right" },
          ],
          (reportData.cities || []).slice(0, 15).map((city) => [
            city.city || "Unknown",
            city.country || "Unknown",
            city.clicks ?? 0,
            `${city.percentage ?? 0}%`,
          ])
        );
      }

      // -----------------------------------------------------------------------
      // 5. Device & Browser Analytics Report
      // -----------------------------------------------------------------------
      else if (type === "devices") {
        drawHeader(doc, "Device, OS & Browser Intelligence Report", meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Total Visits", value: summary?.totalClicks ?? 0, highlight: true },
          { label: "Top Device", value: String(summary?.topDeviceType || "N/A").toUpperCase() },
          { label: "Top Operating System", value: truncate(summary?.topOS || "N/A", 15) },
          { label: "Top Browser", value: truncate(summary?.topBrowser || "N/A", 15) },
        ]);

        drawSectionHeading(doc, "1. Device Category Distribution");
        drawDistributionBars(
          doc,
          (reportData.devices || []).map((d) => ({
            label: String(d.name || "unknown").toUpperCase(),
            count: d.clicks ?? 0,
            percentage: d.percentage ?? 0,
            color: COLORS.primaryLight,
          }))
        );

        drawSectionHeading(doc, "2. Operating Systems");
        drawTable(
          doc,
          [
            { header: "Operating System", width: 250 },
            { header: "Visits", width: 130, align: "right" },
            { header: "Share %", width: 135, align: "right" },
          ],
          (reportData.operatingSystems || []).map((os) => [os.name || "Unknown", os.clicks ?? 0, `${os.percentage ?? 0}%`])
        );

        drawSectionHeading(doc, "3. Web Browsers");
        drawTable(
          doc,
          [
            { header: "Browser", width: 250 },
            { header: "Visits", width: 130, align: "right" },
            { header: "Share %", width: 135, align: "right" },
          ],
          (reportData.browsers || []).map((b) => [b.name || "Unknown", b.clicks ?? 0, `${b.percentage ?? 0}%`])
        );
      }

      // -----------------------------------------------------------------------
      // 6. Campaign Analytics Report
      // -----------------------------------------------------------------------
      else if (type === "campaigns") {
        drawHeader(doc, "Marketing Campaign & UTM Attribution Report", meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Total Visits", value: summary?.totalClicks ?? 0, highlight: true },
          { label: "Active Campaigns", value: summary?.activeCampaignsCount ?? 0 },
          { label: "Top Campaign", value: truncate(summary?.topCampaign || "N/A", 15) },
          { label: "Top UTM Source", value: truncate(summary?.topSource || "N/A", 15) },
        ]);

        drawSectionHeading(doc, "1. Campaign Performance (UTM Campaigns)");
        drawTable(
          doc,
          [
            { header: "Campaign Name", width: 175 },
            { header: "UTM Source", width: 90 },
            { header: "UTM Medium", width: 90 },
            { header: "Total Clicks", width: 75, align: "right" },
            { header: "Share %", width: 85, align: "right" },
          ],
          (reportData.campaigns || []).map((c) => [
            truncate(c.campaign || "Untracked", 30),
            truncate(c.source || "None", 16),
            truncate(c.medium || "None", 16),
            c.clicks ?? 0,
            `${c.percentage ?? 0}%`,
          ])
        );

        drawSectionHeading(doc, "2. Referral Sources (UTM Sources)");
        drawTable(
          doc,
          [
            { header: "Traffic Source", width: 250 },
            { header: "Visits", width: 130, align: "right" },
            { header: "Share %", width: 135, align: "right" },
          ],
          (reportData.sources || []).map((s) => [s.name || "None", s.clicks ?? 0, `${s.percentage ?? 0}%`])
        );
      }

      // -----------------------------------------------------------------------
      // 7. Traffic Analytics Report
      // -----------------------------------------------------------------------
      else if (type === "traffic") {
        drawHeader(doc, "Hourly & Daily Traffic Analytics Report", meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Total Period Clicks", value: summary?.totalClicks ?? 0, highlight: true },
          { label: "Peak Traffic Hour", value: truncate(summary?.peakHour || "N/A", 16) },
          { label: "Peak Traffic Day", value: truncate(summary?.peakDay || "N/A", 16) },
        ]);

        drawSectionHeading(doc, "1. 24-Hour Hourly Traffic Distribution (IST)");
        drawTable(
          doc,
          [
            { header: "Hour of Day (IST)", width: 175 },
            { header: "Total Clicks", width: 110, align: "right" },
            { header: "QR Scans", width: 110, align: "right" },
            { header: "Direct Clicks", width: 120, align: "right" },
          ],
          (reportData.hourlyDistribution || []).map((h) => [
            h.hourLabel || "N/A",
            h.clicks ?? 0,
            h.qrClicks ?? 0,
            h.directClicks ?? 0,
          ])
        );

        drawSectionHeading(doc, "2. Daily Traffic Volume");
        drawTable(
          doc,
          [
            { header: "Date (IST)", width: 175 },
            { header: "Total Clicks", width: 110, align: "right" },
            { header: "QR Scans", width: 110, align: "right" },
            { header: "Direct Clicks", width: 120, align: "right" },
          ],
          (reportData.dailyTrends || []).map((d) => [
            d.dateIST || "N/A",
            d.clicks ?? 0,
            d.qrClicks ?? 0,
            d.directClicks ?? 0,
          ])
        );
      }

      // -----------------------------------------------------------------------
      // 8. Anomaly Detection Report
      // -----------------------------------------------------------------------
      else if (type === "anomalies") {
        drawHeader(doc, "Smart Traffic Anomaly & Health Report", meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Fleet Health Score", value: summary?.fleetHealthScore || "100%", highlight: true },
          { label: "Health Rating", value: summary?.healthRating || "EXCELLENT" },
          { label: "Total Anomalies", value: summary?.totalAnomalies ?? 0 },
          { label: "Traffic Spikes", value: summary?.spikeCount ?? 0 },
          { label: "Traffic Drops", value: summary?.dropCount ?? 0 },
        ]);

        drawSectionHeading(doc, "1. Detected Traffic Anomaly Incidents");
        drawTable(
          doc,
          [
            { header: "Detected At (IST)", width: 105 },
            { header: "Short Code", width: 70 },
            { header: "Type", width: 75 },
            { header: "Severity", width: 65 },
            { header: "Actual", width: 50, align: "right" },
            { header: "Baseline", width: 50, align: "right" },
            { header: "Deviation", width: 50, align: "right" },
            { header: "Status", width: 50 },
          ],
          (reportData.anomalies || []).map((a) => [
            truncate(a.detectedAtIST || "N/A", 18),
            `/${a.shortCode || "N/A"}`,
            a.type || "N/A",
            a.severity || "N/A",
            a.currentClicks ?? 0,
            a.baselineAverage || "0",
            a.percentageDeviation || "N/A",
            a.status || "N/A",
          ])
        );
      }

      // -----------------------------------------------------------------------
      // 9. A/B Experiment Performance Report
      // -----------------------------------------------------------------------
      else if (type === "experiments") {
        drawHeader(doc, "A/B Link Testing Experiment Report", meta.rangeLabel, meta.generatedAtIST);

        drawKpiCards(doc, [
          { label: "Experiments Total", value: summary?.totalExperiments ?? 0 },
          { label: "Active Tests", value: summary?.activeExperiments ?? 0 },
          { label: "Recorded Clicks", value: summary?.totalClicksRecorded ?? summary?.totalClicks ?? 0, highlight: true },
        ]);

        drawSectionHeading(doc, "1. A/B Experiment Traffic Split & Winners");
        drawTable(
          doc,
          [
            { header: "Experiment Name", width: 120 },
            { header: "Short Code", width: 65 },
            { header: "Variant A (Clicks / %)", width: 95, align: "right" },
            { header: "Variant B (Clicks / %)", width: 95, align: "right" },
            { header: "Total", width: 45, align: "right" },
            { header: "Leading Variant", width: 95 },
          ],
          (reportData.experiments || []).map((e) => [
            truncate(e.name || "Untitled", 22),
            `/${e.shortCode || "N/A"}`,
            `${e.variantAClicks ?? 0} (${e.variantAPercent || "50%"})`,
            `${e.variantBClicks ?? 0} (${e.variantBPercent || "50%"})`,
            e.totalClicks ?? 0,
            e.winner || "Tie",
          ])
        );

        drawSectionHeading(doc, "2. Destination Routing Details");
        drawTable(
          doc,
          [
            { header: "Experiment", width: 105 },
            { header: "Status", width: 55 },
            { header: "Variant A Destination", width: 135 },
            { header: "Variant B Destination", width: 135 },
            { header: "Fallback", width: 85 },
          ],
          (reportData.experiments || []).map((e) => [
            truncate(e.name || "Untitled", 18),
            String(e.status || "active").toUpperCase(),
            truncate(e.variantAUrl || "", 26),
            truncate(e.variantBUrl || "", 26),
            e.fallbackVariant || "Variant A",
          ])
        );
      }

      // Running page numbers on all pages
      addRunningFooters(doc, meta.generatedAtIST);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
