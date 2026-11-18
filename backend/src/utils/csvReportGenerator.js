// =============================================================================
// Stage 14: CSV Report Generator Utility — 2026-11-19
// Generates RFC 4180 compliant CSV exports with UTF-8 BOM, strict cell escaping,
// formula injection prevention, and Excel-compatible IST date formatting.
// =============================================================================

/**
 * Escapes a cell value according to RFC 4180 rules and defends against CSV injection.
 * If a string begins with dangerous formula triggers (=, +, -, @, \t, \r), prepend a single quote.
 *
 * @param {any} value - Cell value
 * @returns {string} - Escaped CSV cell string
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Security: Prevent CSV Formula Injection in Excel / Calc / Google Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If cell contains double quotes, commas, newlines, or carriage returns, wrap in quotes and double internal quotes
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return `"${str}"`;
}

/**
 * Converts a 2D array of rows into a complete CSV string with UTF-8 BOM.
 *
 * @param {Array<Array<any>>} rows - Array of row arrays
 * @returns {string} - CSV file content
 */
export function buildCsv(rows) {
  const BOM = "\uFEFF"; // UTF-8 Byte Order Mark for Microsoft Excel compatibility
  const csvBody = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\r\n");
  return BOM + csvBody;
}

/**
 * Generates CSV content tailored for the specific report category.
 *
 * @param {string} type - Report category
 * @param {Object} reportData - Result of aggregateReportData
 * @returns {string} - Formatted CSV content
 */
export function generateCsvReport(type, reportData) {
  const { meta, summary } = reportData;
  const rows = [];

  // Metadata Header Block
  rows.push(["Smart Link Management Platform", "Analytics & Reporting Engine"]);
  rows.push(["Report Type", meta.reportType.toUpperCase()]);
  rows.push(["Date Range", meta.rangeLabel]);
  rows.push(["Generated At (IST)", meta.generatedAtIST]);
  rows.push([]); // blank separator

  switch (type) {
    // -------------------------------------------------------------------------
    // 1. Overall Dashboard CSV
    // -------------------------------------------------------------------------
    case "overall": {
      // Summary KPIs
      rows.push(["--- EXECUTIVE SUMMARY ---"]);
      rows.push(["Total Short Links", summary.totalLinks]);
      rows.push(["Total Clicks", summary.totalClicks]);
      rows.push(["QR Code Scans", summary.qrClicks]);
      rows.push(["Direct Link Clicks", summary.directClicks]);
      rows.push(["QR Adoption Rate", `${summary.qrPercent}%`]);
      rows.push(["Unique Countries", summary.uniqueCountries]);
      rows.push([]);

      // Links Breakdown Table
      rows.push(["--- LINKS PERFORMANCE BREAKDOWN ---"]);
      rows.push([
        "Short Code",
        "Original Destination URL",
        "Total Clicks",
        "QR Scans",
        "Direct Clicks",
        "Created Date (IST)",
        "Status",
      ]);
      (reportData.links || []).forEach((l) => {
        rows.push([
          l.shortCode,
          l.originalUrl,
          l.totalClicks,
          l.qrClicks,
          l.directClicks,
          l.createdAtIST,
          l.isPaused ? "Paused" : "Active",
        ]);
      });
      rows.push([]);

      // Top Countries Table
      rows.push(["--- GEOGRAPHIC DISTRIBUTION ---"]);
      rows.push(["Country", "Clicks", "Percentage"]);
      (reportData.topCountries || []).forEach((c) => {
        rows.push([c.country, c.clicks, `${c.percentage}%`]);
      });
      rows.push([]);

      // Device Distribution Table
      rows.push(["--- DEVICE TRAFFIC DISTRIBUTION ---"]);
      rows.push(["Device Category", "Clicks", "Percentage"]);
      (reportData.deviceBreakdown || []).forEach((d) => {
        rows.push([String(d.deviceType || "unknown").toUpperCase(), d.clicks ?? 0, `${d.percentage ?? 0}%`]);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 2. Individual Link Performance CSV
    // -------------------------------------------------------------------------
    case "links": {
      rows.push(["--- LINK METRICS & ACCESS POLICIES ---"]);
      rows.push([
        "Short Code",
        "Original Destination URL",
        "Total Clicks",
        "QR Scans",
        "Direct Clicks",
        "QR %",
        "Status",
        "Password Protected",
        "Expiration (IST)",
        "Max Clicks Limit",
        "UTM Campaign",
        "Created At (IST)",
      ]);
      (reportData.links || []).forEach((l) => {
        rows.push([
          l.shortCode,
          l.originalUrl,
          l.totalClicks,
          l.qrClicks,
          l.directClicks,
          `${l.qrPercentage}%`,
          l.status,
          l.hasPassword ? "Yes" : "No",
          l.expiresAtIST,
          l.maxClicks,
          l.campaign,
          l.createdAtIST,
        ]);
      });
      rows.push([]);

      // Recent Click History Log
      rows.push(["--- RECENT VISITOR CLICK LOGS (UP TO 50) ---"]);
      rows.push([
        "Timestamp (IST)",
        "Short Code",
        "Destination URL",
        "Channel",
        "Device Type",
        "Operating System",
        "Browser",
        "Country",
        "City",
      ]);
      (reportData.recentLogs || []).forEach((log) => {
        rows.push([
          log.timestampIST,
          log.shortCode,
          log.originalUrl,
          log.channel,
          log.deviceType,
          log.os,
          log.browser,
          log.country,
          log.city,
        ]);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 3. QR Analytics CSV
    // -------------------------------------------------------------------------
    case "qr": {
      rows.push(["--- QR PERFORMANCE SUMMARY ---"]);
      rows.push(["Total Recorded Clicks", summary.totalClicks]);
      rows.push(["QR Code Scans", summary.qrClicks]);
      rows.push(["Direct Link Clicks", summary.directClicks]);
      rows.push(["QR Scan Share", `${summary.qrPercentage}%`]);
      rows.push(["Active QR Links", summary.activeQRLinksCount]);
      rows.push([]);

      rows.push(["--- QR PERFORMANCE PER SHORT LINK ---"]);
      rows.push([
        "Short Code",
        "Original Destination URL",
        "Total Clicks",
        "QR Scans",
        "Direct Clicks",
        "QR Share %",
        "Created Date (IST)",
      ]);
      (reportData.qrLinks || []).forEach((l) => {
        rows.push([
          l.shortCode,
          l.originalUrl,
          l.totalClicks,
          l.qrClicks,
          l.directClicks,
          `${l.qrPercentage}%`,
          l.createdAtIST,
        ]);
      });
      rows.push([]);

      rows.push(["--- DAILY QR SCAN TIMELINE ---"]);
      rows.push(["Date (IST)", "QR Scans"]);
      (reportData.dailyTrend || []).forEach((d) => {
        rows.push([d.dateIST, d.qrScans]);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 4. Geo-Location Analytics CSV
    // -------------------------------------------------------------------------
    case "geo": {
      rows.push(["--- GEOGRAPHIC SUMMARY ---"]);
      rows.push(["Total Geo-located Clicks", summary.totalClicks]);
      rows.push(["Unique Countries", summary.totalCountries]);
      rows.push(["Unique Cities", summary.totalCities]);
      rows.push(["Top Country", summary.topCountry]);
      rows.push(["Top City", summary.topCity]);
      rows.push([]);

      rows.push(["--- COUNTRY TRAFFIC DISTRIBUTION ---"]);
      rows.push([
        "Country Name",
        "ISO Country Code",
        "Total Clicks",
        "QR Scans",
        "Direct Clicks",
        "Global Share %",
      ]);
      (reportData.countries || []).forEach((c) => {
        rows.push([
          c.country,
          c.countryCode,
          c.clicks,
          c.qrClicks,
          c.directClicks,
          `${c.percentage}%`,
        ]);
      });
      rows.push([]);

      rows.push(["--- TOP CITIES BREAKDOWN ---"]);
      rows.push(["City Name", "Country Name", "Clicks", "Share %"]);
      (reportData.cities || []).forEach((city) => {
        rows.push([city.city, city.country, city.clicks, `${city.percentage}%`]);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 5. Device & Browser Analytics CSV
    // -------------------------------------------------------------------------
    case "devices": {
      rows.push(["--- DEVICE & BROWSER SUMMARY ---"]);
      rows.push(["Total Evaluated Visits", summary.totalClicks]);
      rows.push(["Primary Device Category", summary.topDeviceType]);
      rows.push(["Primary Operating System", summary.topOS]);
      rows.push(["Primary Browser", summary.topBrowser]);
      rows.push([]);

      rows.push(["--- DEVICE CATEGORIES ---"]);
      rows.push(["Device Type", "Visits", "Share %"]);
      (reportData.devices || []).forEach((d) => {
        rows.push([String(d.name || "unknown").toUpperCase(), d.clicks ?? 0, `${d.percentage ?? 0}%`]);
      });
      rows.push([]);

      rows.push(["--- OPERATING SYSTEMS ---"]);
      rows.push(["Operating System", "Visits", "Share %"]);
      (reportData.operatingSystems || []).forEach((os) => {
        rows.push([os.name, os.clicks, `${os.percentage}%`]);
      });
      rows.push([]);

      rows.push(["--- WEB BROWSERS ---"]);
      rows.push(["Browser Name", "Visits", "Share %"]);
      (reportData.browsers || []).forEach((b) => {
        rows.push([b.name, b.clicks, `${b.percentage}%`]);
      });
      rows.push([]);

      rows.push(["--- HARDWARE VENDORS ---"]);
      rows.push(["Vendor Name", "Visits", "Share %"]);
      (reportData.vendors || []).forEach((v) => {
        rows.push([v.name, v.clicks, `${v.percentage}%`]);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 6. Campaign Analytics CSV
    // -------------------------------------------------------------------------
    case "campaigns": {
      rows.push(["--- CAMPAIGN SUMMARY ---"]);
      rows.push(["Total Visits", summary.totalClicks]);
      rows.push(["Tracked Marketing Campaigns", summary.activeCampaignsCount]);
      rows.push(["Top Performing Campaign", summary.topCampaign]);
      rows.push(["Top Referral Source", summary.topSource]);
      rows.push([]);

      rows.push(["--- CAMPAIGN PERFORMANCE BREAKDOWN ---"]);
      rows.push([
        "Campaign Name",
        "UTM Source",
        "UTM Medium",
        "Total Clicks",
        "QR Scans",
        "Direct Clicks",
        "Campaign Share %",
      ]);
      (reportData.campaigns || []).forEach((c) => {
        rows.push([
          c.campaign,
          c.source,
          c.medium,
          c.clicks,
          c.qrClicks,
          c.directClicks,
          `${c.percentage}%`,
        ]);
      });
      rows.push([]);

      rows.push(["--- TRAFFIC SOURCES (UTM SOURCE) ---"]);
      rows.push(["Source Name", "Visits", "Share %"]);
      (reportData.sources || []).forEach((s) => {
        rows.push([s.name, s.clicks, `${s.percentage}%`]);
      });
      rows.push([]);

      rows.push(["--- MARKETING MEDIUMS (UTM MEDIUM) ---"]);
      rows.push(["Medium Name", "Visits", "Share %"]);
      (reportData.mediums || []).forEach((m) => {
        rows.push([m.name, m.clicks, `${m.percentage}%`]);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 7. Traffic Analytics CSV
    // -------------------------------------------------------------------------
    case "traffic": {
      rows.push(["--- TRAFFIC PATTERN SUMMARY ---"]);
      rows.push(["Total Period Clicks", summary.totalClicks]);
      rows.push(["Peak Traffic Hour", summary.peakHour]);
      rows.push(["Peak Traffic Day", summary.peakDay]);
      rows.push([]);

      rows.push(["--- HOURLY TRAFFIC DISTRIBUTION (0-23 HOURS IST) ---"]);
      rows.push(["Hour of Day", "Total Clicks", "QR Scans", "Direct Clicks"]);
      (reportData.hourlyDistribution || []).forEach((h) => {
        rows.push([h.hourLabel, h.clicks, h.qrClicks, h.directClicks]);
      });
      rows.push([]);

      rows.push(["--- DAILY TRAFFIC TIMELINE ---"]);
      rows.push(["Date (IST)", "Total Clicks", "QR Scans", "Direct Clicks"]);
      (reportData.dailyTrends || []).forEach((d) => {
        rows.push([d.dateIST, d.clicks, d.qrClicks, d.directClicks]);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 8. Anomaly Detection CSV
    // -------------------------------------------------------------------------
    case "anomalies": {
      rows.push(["--- FLEET HEALTH SUMMARY ---"]);
      rows.push(["Fleet Health Score", summary.fleetHealthScore]);
      rows.push(["Health Rating", summary.healthRating]);
      rows.push(["Total Anomalies Detected", summary.totalAnomalies]);
      rows.push(["Traffic Surge Spikes", summary.spikeCount]);
      rows.push(["Traffic Cliff Drops", summary.dropCount]);
      rows.push([]);

      rows.push(["--- DETECTED TRAFFIC ANOMALY INCIDENTS ---"]);
      rows.push([
        "Incident ID",
        "Detected At (IST)",
        "Short Code",
        "Destination URL",
        "Anomaly Type",
        "Severity",
        "Status",
        "Actual Clicks",
        "Baseline Clicks",
        "Deviation %",
        "Absolute Difference",
      ]);
      (reportData.anomalies || []).forEach((a) => {
        rows.push([
          a.id,
          a.detectedAtIST,
          a.shortCode,
          a.originalUrl,
          a.type,
          a.severity,
          a.status,
          a.currentClicks,
          a.baselineAverage,
          a.percentageDeviation,
          a.absoluteDifference,
        ]);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 9. A/B Experiment Performance CSV
    // -------------------------------------------------------------------------
    case "experiments": {
      rows.push(["--- A/B TESTING EXPERIMENTS SUMMARY ---"]);
      rows.push(["Total Experiments", summary.totalExperiments]);
      rows.push(["Active Experiments", summary.activeExperiments]);
      rows.push(["Total Recorded Clicks", summary.totalClicksRecorded]);
      rows.push([]);

      rows.push(["--- EXPERIMENT PERFORMANCE & WINNING VARIANTS ---"]);
      rows.push([
        "Experiment Name",
        "Short Code",
        "Status",
        "Fallback Variant",
        "Variant A Destination URL",
        "Variant A Clicks",
        "Variant A Share %",
        "Variant B Destination URL",
        "Variant B Clicks",
        "Variant B Share %",
        "Total Clicks",
        "Winning Variant",
        "Margin (Clicks)",
        "Created At (IST)",
      ]);
      (reportData.experiments || []).forEach((e) => {
        rows.push([
          e.name,
          e.shortCode,
          e.status,
          e.fallbackVariant,
          e.variantAUrl,
          e.variantAClicks,
          e.variantAPercent,
          e.variantBUrl,
          e.variantBClicks,
          e.variantBPercent,
          e.totalClicks,
          e.winner,
          e.leadMargin,
          e.createdAtIST,
        ]);
      });
      break;
    }

    default:
      throw new Error(`Unsupported CSV report type: ${type}`);
  }

  return buildCsv(rows);
}
