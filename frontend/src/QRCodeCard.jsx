// CHANGE: QR Code Feature Stage 2 — 2026-11-05
// CHANGE: QR visit tracking — 2026-11-06
// Reusable, responsive QR code component built with qrcode.react (QRCodeCanvas)
import { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

// Default public base URL with environment override support
export const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

export const DEFAULT_API_URL = `${DEFAULT_API_BASE_URL}/api/links`;

/**
 * Builds the canonical short link redirect URL.
 * Encodes the existing short URL endpoint rather than the destination URL.
 *
 * @param {string} shortCode - Unique short code (e.g. "a1b2c3d4")
 * @param {string} [baseUrl] - Optional custom base URL
 * @returns {string} Fully qualified short link redirect URL
 */
export const buildShortUrl = (shortCode, baseUrl = DEFAULT_API_URL) => {
  if (!shortCode) return "";
  // Strip trailing slashes from baseUrl for clean concatenation
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return `${cleanBase}/${shortCode}`;
};

// CHANGE: QR visit tracking — 2026-11-06
// CHANGE: Fix QR tracking parameter in generated QR code and modal readout — 2026-11-07
/**
 * Attaches the qr=1 tracking query parameter to the short URL for QR canvas encoding and display,
 * preserving any existing query parameters and preventing duplicate qr parameters.
 *
 * @param {string} url - Target short redirect URL
 * @returns {string} Short redirect URL with qr=1 parameter attached
 */
export const buildQrCodeUrl = (url) => {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.set("qr", "1");
    return parsed.toString();
  } catch {
    try {
      const parsed = new URL(trimmed, "http://localhost");
      parsed.searchParams.set("qr", "1");
      const res = parsed.pathname + parsed.search + parsed.hash;
      return trimmed.startsWith("/") ? res : res.replace(/^\//, "");
    } catch {
      if (/[?&]qr=[^&]*/.test(trimmed)) {
        return trimmed.replace(/[?&]qr=[^&]*/, (m) => (m.startsWith("?") ? "?qr=1" : "&qr=1"));
      }
      const separator = trimmed.includes("?") ? "&" : "?";
      return `${trimmed}${separator}qr=1`;
    }
  }
};

/**
 * Validates whether a given string is a plausible HTTP/HTTPS URL
 *
 * @param {string} url - Target URL to validate
 * @returns {boolean}
 */
export const isValidShortUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Reusable QR Code Card Component
 *
 * Features:
 * - Generates clear, high-contrast, scannable QR code (Level H error correction)
 * - Encodes existing short redirect URL with ?qr=1 tracking tag for visit attribution
 * - Renders crisp canvas with clean white background and dark modules
 * - Displays and copies the exact QR URL (with qr=1) encoded in the QR code
 * - Provides graceful fallback UI for missing or invalid URLs
 * - Built-in PNG download and clipboard copy actions
 *
 * @param {Object} props
 * @param {string} [props.shortUrl] - Full short URL to encode
 * @param {string} [props.shortCode] - Short code to derive shortUrl if not provided
 * @param {number} [props.size=180] - Canvas dimension in pixels
 * @param {string} [props.title] - Optional heading
 * @param {string} [props.subtitle] - Optional subtitle
 * @param {boolean} [props.showUrl=true] - Whether to display the URL string below the QR code
 * @param {boolean} [props.showDownload=true] - Whether to render the "Download PNG" button
 * @param {boolean} [props.showCopy=true] - Whether to render the "Copy" button
 * @param {string} [props.className=""] - Additional CSS class
 */
export default function QRCodeCard({
  shortUrl,
  shortCode,
  size = 180,
  title,
  subtitle,
  showUrl = true,
  showDownload = true,
  showCopy = true,
  className = "",
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Derive target URL from prop or shortCode (canonical clean short URL)
  const targetUrl = (shortUrl || (shortCode ? buildShortUrl(shortCode) : "")).trim();
  const isValid = isValidShortUrl(targetUrl);

  // CHANGE: QR visit tracking — 2026-11-06
  // Value encoded in QR canvas always includes qr=1 to distinguish QR visits in analytics
  const qrEncodedValue = isValid ? buildQrCodeUrl(targetUrl) : "";

  // CHANGE: Copy the exact QR encoded URL (with qr=1) displayed in the QR modal — 2026-11-07
  const handleCopyUrl = async () => {
    const urlToCopy = qrEncodedValue || targetUrl;
    if (!urlToCopy) return;
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy QR short URL:", err);
    }
  };

  // Download high-resolution PNG image of the QR code
  const handleDownloadPNG = () => {
    try {
      setDownloading(true);
      const canvas =
        canvasRef.current || containerRef.current?.querySelector("canvas");

      if (!canvas) {
        console.error("Canvas element not found for QR download.");
        setDownloading(false);
        return;
      }

      const pngData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const filenameCode = shortCode || targetUrl.split("/").pop()?.split("?")[0] || "link";
      link.download = `smartlink-qr-${filenameCode}.png`;
      link.href = pngData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export QR code PNG:", err);
    } finally {
      setTimeout(() => setDownloading(false), 300);
    }
  };

  // Fallback state if URL is missing or invalid
  if (!isValid) {
    return (
      <div className={`qr-card-container qr-card-empty ${className}`}>
        {title && <h4 className="qr-card-title">{title}</h4>}
        <div className="qr-empty-box">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            width="36"
            height="36"
            className="qr-empty-icon"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
          </svg>
          <p className="qr-empty-text">No valid short URL available for QR generation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`qr-card-container ${className}`} ref={containerRef}>
      {title && <h4 className="qr-card-title">{title}</h4>}
      {subtitle && <p className="qr-card-subtitle">{subtitle}</p>}

      {/* High-contrast QR canvas frame with quiet zone */}
      <div className="qr-canvas-wrapper" title="Scan to visit short link">
        <div className="qr-canvas-frame">
          <QRCodeCanvas
            ref={canvasRef}
            value={qrEncodedValue}
            size={size}
            bgColor="#FFFFFF"
            fgColor="#0A0F1D"
            level="H"
            marginSize={2}
          />
        </div>
      </div>

      {/* CHANGE: QR Code Modal displays the exact QR encoded URL with qr=1 — 2026-11-07 */}
      {showUrl && (
        <div className="qr-url-readout">
          <span className="qr-url-text" title={qrEncodedValue || targetUrl}>
            {qrEncodedValue || targetUrl}
          </span>
        </div>
      )}

      {/* Action buttons: Download PNG & Copy Short URL */}
      {(showDownload || showCopy) && (
        <div className="qr-card-actions">
          {showCopy && (
            <button
              type="button"
              className={`qr-btn-action ${copied ? "copied" : ""}`}
              onClick={handleCopyUrl}
              title="Copy short link to clipboard"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="14"
                height="14"
              >
                {copied ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </>
                )}
              </svg>
              <span>{copied ? "Copied!" : "Copy URL"}</span>
            </button>
          )}

          {showDownload && (
            <button
              type="button"
              className="qr-btn-action qr-btn-primary"
              onClick={handleDownloadPNG}
              disabled={downloading}
              title="Download QR code as PNG image"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="14"
                height="14"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{downloading ? "Saving..." : "Download PNG"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
