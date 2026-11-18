// =============================================================================
// Stage 14: Report Controller — 2026-11-19
// Authenticated endpoints for downloading presentation-ready PDF reports and
// Excel-compatible CSV datasets with parameter validation, security defenses,
// and user isolation.
// =============================================================================

import { aggregateReportData } from "../utils/reportDataAggregator.js";
import { generateCsvReport } from "../utils/csvReportGenerator.js";
import { generatePdfReport } from "../utils/pdfReportGenerator.js";

// Valid report categories
export const VALID_REPORT_TYPES = [
  "overall",
  "links",
  "qr",
  "geo",
  "devices",
  "campaigns",
  "traffic",
  "anomalies",
  "experiments",
];

// Valid range values
export const VALID_RANGES = ["7d", "30d", "all"];

/**
 * Generates and downloads a CSV report for the authenticated user.
 * GET /api/reports/csv?type=<category>&range=<7d|30d|all>&linkId=<optional>&shortCode=<optional>
 */
export async function downloadCsvReport(req, res, next) {
  try {
    const rawType = (req.query.type || "overall").toString().toLowerCase().trim();
    if (!VALID_REPORT_TYPES.includes(rawType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type: '${rawType}'. Must be one of: ${VALID_REPORT_TYPES.join(", ")}`,
      });
    }

    const rawRange = (req.query.range || "all").toString().toLowerCase().trim();
    const range = VALID_RANGES.includes(rawRange) ? rawRange : "all";

    const linkId = req.query.linkId ? req.query.linkId.toString().trim() : undefined;
    const shortCode = req.query.shortCode ? req.query.shortCode.toString().trim() : undefined;

    // Aggregate user-scoped data
    const reportData = await aggregateReportData(req.user._id, rawType, range, { linkId, shortCode });

    // Generate CSV string with UTF-8 BOM
    const csvContent = generateCsvReport(rawType, reportData);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `smartlink_${rawType}_${range}_${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error("CSV report generation error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "An error occurred while generating the CSV report.",
    });
  }
}

/**
 * Generates and downloads a PDF report for the authenticated user.
 * GET /api/reports/pdf?type=<category>&range=<7d|30d|all>&linkId=<optional>&shortCode=<optional>
 */
export async function downloadPdfReport(req, res, next) {
  try {
    const rawType = (req.query.type || "overall").toString().toLowerCase().trim();
    if (!VALID_REPORT_TYPES.includes(rawType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type: '${rawType}'. Must be one of: ${VALID_REPORT_TYPES.join(", ")}`,
      });
    }

    const rawRange = (req.query.range || "all").toString().toLowerCase().trim();
    const range = VALID_RANGES.includes(rawRange) ? rawRange : "all";

    const linkId = req.query.linkId ? req.query.linkId.toString().trim() : undefined;
    const shortCode = req.query.shortCode ? req.query.shortCode.toString().trim() : undefined;

    // Aggregate user-scoped data
    const reportData = await aggregateReportData(req.user._id, rawType, range, { linkId, shortCode });

    // Generate PDF Buffer
    const pdfBuffer = await generatePdfReport(rawType, reportData);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `smartlink_${rawType}_${range}_${timestamp}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("PDF report generation error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "An error occurred while generating the PDF report.",
    });
  }
}

/**
 * Returns available report categories and description metadata.
 * GET /api/reports/categories
 */
export async function getReportCategories(req, res) {
  const categories = [
    {
      id: "overall",
      title: "Overall Dashboard Report",
      icon: "▦",
      description: "Complete platform executive summary including total links, traffic volume, QR scans, and top geographic regions.",
    },
    {
      id: "links",
      title: "Individual Link Performance Report",
      icon: "🔗",
      description: "Detailed per-link metrics, access control policies, security status, and recent visitor audit trail logs.",
    },
    {
      id: "qr",
      title: "QR Analytics Report",
      icon: "📱",
      description: "QR code scan adoption, comparative direct vs QR ratios, and daily scan timeline.",
    },
    {
      id: "geo",
      title: "Geo-Location Analytics Report",
      icon: "🌍",
      description: "Global audience geographic reach, country-level traffic distribution, and top metropolitan cities.",
    },
    {
      id: "devices",
      title: "Device & Browser Analytics Report",
      icon: "💻",
      description: "Visitor hardware category, operating systems, web browsers, and device vendors.",
    },
    {
      id: "campaigns",
      title: "Campaign Analytics Report",
      icon: "📣",
      description: "Marketing campaign attribution, UTM parameters (source, medium, campaign), and conversion volume.",
    },
    {
      id: "traffic",
      title: "Traffic Analytics Report",
      icon: "📈",
      description: "24-hour hourly traffic heat patterns in IST and historical daily traffic trajectories.",
    },
    {
      id: "anomalies",
      title: "Anomaly Detection Report",
      icon: "⚠️",
      description: "Fleet health score, statistical baseline deviations, traffic surge spikes, and cliff drop incidents.",
    },
    {
      id: "experiments",
      title: "A/B Experiment Performance Report",
      icon: "⚖️",
      description: "Split testing results, Variant A vs Variant B click share, statistical margins, and winning variants.",
    },
  ];

  return res.status(200).json({
    success: true,
    categories,
    supportedRanges: ["7d", "30d", "all"],
    supportedFormats: ["pdf", "csv"],
  });
}
