/**
 * User-Agent parser utility for detecting device type and browser.
 * Extracts only high-level device category and browser family.
 * Avoids collecting any sensitive or personally identifiable information.
 */

export const parseUserAgent = (userAgent) => {
  if (!userAgent || typeof userAgent !== "string") {
    return {
      deviceType: "unknown",
      browser: "Unknown",
    };
  }

  const ua = userAgent.trim();

  // 1. Detect Device Type (tablet, mobile, desktop, unknown)
  let deviceType = "desktop";

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = "tablet";
  } else if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
      ua
    )
  ) {
    deviceType = "mobile";
  } else if (
    /Windows NT|Macintosh|Mac OS X|Linux(?!.*android)|CrOS|X11/i.test(ua)
  ) {
    deviceType = "desktop";
  } else {
    deviceType = "unknown";
  }

  // 2. Detect Browser Family (order is critical for disambiguation)
  let browser = "Other";

  if (/Edg([ea]|iOS)?\/[0-9.]+/i.test(ua)) {
    browser = "Edge";
  } else if (/OPR\/[0-9.]+|Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/SamsungBrowser\/[0-9.]+/i.test(ua)) {
    browser = "Samsung Internet";
  } else if (/UCBrowser\/[0-9.]+/i.test(ua)) {
    browser = "UC Browser";
  } else if (/Brave/i.test(ua)) {
    browser = "Brave";
  } else if (/Chrome\/[0-9.]+/i.test(ua) && !/Chromium/i.test(ua)) {
    browser = "Chrome";
  } else if (/Firefox\/[0-9.]+|FxiOS/i.test(ua)) {
    browser = "Firefox";
  } else if (
    /Safari\/[0-9.]+/i.test(ua) &&
    !/Chrome|Chromium|Android/i.test(ua)
  ) {
    browser = "Safari";
  } else if (/MSIE|Trident/i.test(ua)) {
    browser = "Internet Explorer";
  } else if (/PostmanRuntime/i.test(ua)) {
    browser = "Postman";
  } else if (/curl/i.test(ua)) {
    browser = "cURL";
  } else if (!ua || ua.length === 0) {
    browser = "Unknown";
  } else {
    browser = "Other";
  }

  return { deviceType, browser };
};
