/**
 * User-Agent parser utility for detecting device type, browser, OS, and hardware details.
 * CHANGE: Stage 9 Device & Browser Intelligence — 2026-11-14
 * CHANGE: Stage 9 Step 4 Device Intelligence Improvements — 2026-11-15
 * Enhanced hardware vendor & model detection supporting:
 * - Samsung Galaxy (SM-*, GT-*, Galaxy series, SC-*, SCH-*, SGH-*)
 * - Xiaomi / Redmi / POCO (OEM model codes 210*, 22*, 23*, 24*, M2*, Redmi, POCO, Mi)
 * - Google Pixel (Pixel 4 - 8 Pro, Fold, Tablet)
 * - OnePlus (Nord, numbered series, CPH codes, GM, HD, IN, KB, NE)
 * - Motorola (moto g, moto edge, XT series)
 * - Oppo (Find, Reno, A series, CPH codes, P series)
 * - Vivo & iQOO (X series, V series, iQOO series, V/I codes)
 * - Realme (GT series, number series, RMX codes)
 * - Apple iPhone / iPad / Mac
 * - User-Agent Client Hints (Sec-CH-UA-Model, Sec-CH-UA-Platform-Version)
 * - Strict handling of Chrome User-Agent Reduction ('K' placeholder -> Unknown)
 */

export const parseUserAgent = (userAgent, clientHints = {}) => {
  const fallback = {
    deviceType: "unknown",
    browser: "Unknown",
    browserVersion: "Unknown",
    operatingSystem: "Unknown",
    osVersion: "Unknown",
    deviceVendor: "Unknown",
    deviceModel: "Unknown",
  };

  if (!userAgent || typeof userAgent !== "string") {
    return fallback;
  }

  const ua = userAgent.trim();
  if (!ua) {
    return fallback;
  }

  // 1. Detect Device Category (tablet, mobile, desktop, unknown)
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

  // 2. Detect Operating System & OS Version
  let operatingSystem = "Unknown";
  let osVersion = "Unknown";

  if (/Windows NT/i.test(ua)) {
    operatingSystem = "Windows";
    const m = ua.match(/Windows NT\s+([0-9.]+)/i);
    if (m) {
      const ver = m[1];
      if (ver === "10.0") osVersion = "10/11";
      else if (ver === "6.3") osVersion = "8.1";
      else if (ver === "6.2") osVersion = "8";
      else if (ver === "6.1") osVersion = "7";
      else if (ver === "6.0") osVersion = "Vista";
      else if (ver === "5.1") osVersion = "XP";
      else osVersion = ver;
    }
  } else if (/Android/i.test(ua)) {
    operatingSystem = "Android";
    const m = ua.match(/Android\s+([0-9.]+)/i);
    if (m) osVersion = m[1];

    // If client hints provide the true platform version beyond Chrome's frozen "10"
    const rawHintVer = clientHints?.platformVersion || clientHints?.["sec-ch-ua-platform-version"];
    if (rawHintVer && typeof rawHintVer === "string") {
      const cleanVer = rawHintVer.replace(/^["'\s]+|["'\s]+$/g, "");
      const major = cleanVer.split(".")[0];
      if (/^[0-9]+$/.test(major) && Number(major) >= 10) {
        osVersion = major;
      }
    }
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    operatingSystem = "iOS";
    const m = ua.match(/OS\s+([0-9_]+)/i);
    if (m) osVersion = m[1].replace(/_/g, ".");
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    operatingSystem = "macOS";
    const m = ua.match(/Mac OS X\s+([0-9_]+)/i);
    if (m) osVersion = m[1].replace(/_/g, ".");
  } else if (/CrOS/i.test(ua)) {
    operatingSystem = "ChromeOS";
    const m = ua.match(/CrOS\s+[a-zA-Z0-9_]+\s+([0-9.]+)/i);
    if (m) {
      const parts = m[1].split(".");
      osVersion = parts.slice(0, 2).join(".");
    }
  } else if (/Linux|X11/i.test(ua)) {
    operatingSystem = "Linux";
    osVersion = "Unknown";
  }

  // 3. Detect Browser Family & Browser Version (order is critical for disambiguation)
  let browser = "Other";
  let browserVersion = "Unknown";

  let bm;
  if ((bm = ua.match(/Edg(?:[ea]|iOS)?\/([0-9.]+)/i))) {
    browser = "Edge";
    browserVersion = bm[1];
  } else if ((bm = ua.match(/(?:OPR|Opera)\/([0-9.]+)/i))) {
    browser = "Opera";
    browserVersion = bm[1];
  } else if ((bm = ua.match(/SamsungBrowser\/([0-9.]+)/i))) {
    browser = "Samsung Internet";
    browserVersion = bm[1];
  } else if ((bm = ua.match(/UCBrowser\/([0-9.]+)/i))) {
    browser = "UC Browser";
    browserVersion = bm[1];
  } else if (/Brave/i.test(ua)) {
    browser = "Brave";
    const b = ua.match(/Chrome\/([0-9.]+)/i);
    browserVersion = b ? b[1] : "Unknown";
  } else if ((bm = ua.match(/Chrome\/([0-9.]+)/i)) && !/Chromium/i.test(ua)) {
    browser = "Chrome";
    browserVersion = bm[1];
  } else if ((bm = ua.match(/(?:Firefox|FxiOS)\/([0-9.]+)/i))) {
    browser = "Firefox";
    browserVersion = bm[1];
  } else if ((bm = ua.match(/Version\/([0-9.]+).*Safari/i))) {
    browser = "Safari";
    browserVersion = bm[1];
  } else if (
    /Safari\/[0-9.]+/i.test(ua) &&
    !/Chrome|Chromium|Android/i.test(ua)
  ) {
    browser = "Safari";
    browserVersion = "Unknown";
  } else if ((bm = ua.match(/MSIE\s+([0-9.]+)|rv:([0-9.]+)/i))) {
    browser = "Internet Explorer";
    browserVersion = bm[1] || bm[2];
  } else if ((bm = ua.match(/PostmanRuntime\/([0-9.]+)/i))) {
    browser = "Postman";
    browserVersion = bm[1];
  } else if ((bm = ua.match(/curl\/([0-9.]+)/i))) {
    browser = "cURL";
    browserVersion = bm[1];
  } else if (!ua || ua.length === 0) {
    browser = "Unknown";
    browserVersion = "Unknown";
  } else {
    browser = "Other";
    browserVersion = "Unknown";
  }

  // Normalize browser version to major.minor (e.g. 123.0.6312.80 -> 123.0)
  if (browserVersion !== "Unknown") {
    const parts = browserVersion.split(".");
    browserVersion = parts.slice(0, 2).join(".");
  }

  // 4. Detect Device Vendor & Device Model
  // CHANGE: Stage 9 Step 4 Device Intelligence Improvements — 2026-11-15
  let deviceVendor = "Unknown";
  let deviceModel = "Unknown";

  // Helper: Cleans model strings (strips quotes, builds, delimiters)
  const sanitizeModel = (raw) => {
    if (!raw || typeof raw !== "string") return "";
    let s = raw.replace(/^["'\s]+|["'\s]+$/g, "").trim();
    s = s.replace(/\s+Build\/.*$/i, "").replace(/;.*$/, "").trim();
    const openCount = (s.match(/\(/g) || []).length;
    const closeCount = (s.match(/\)/g) || []).length;
    if (closeCount > openCount) {
      s = s.replace(/\)+$/, "").trim();
    }
    // Guard against Chrome User-Agent Reduction static placeholder 'K'
    if (s === "K" || s === "k" || s.toLowerCase() === "unknown" || s.toLowerCase() === "wv") {
      return "";
    }
    return s;
  };

  // Helper: Extracts the hardware candidate string from Android platform section
  const extractAndroidDevice = (userAgentStr) => {
    const start = userAgentStr.indexOf("(");
    if (start === -1) return "";
    let end = userAgentStr.indexOf(") AppleWebKit");
    if (end === -1) end = userAgentStr.indexOf(")");
    if (end === -1) return "";
    const platform = userAgentStr.slice(start + 1, end);
    const parts = platform.split(";").map((p) => p.trim());
    const androidIdx = parts.findIndex((p) => /^Android\b/i.test(p));
    if (androidIdx === -1) return "";
    for (let i = androidIdx + 1; i < parts.length; i++) {
      let p = parts[i];
      p = p.replace(/\s+Build\/.*$/i, "").trim();
      if (!p || /^(wv|[a-z]{2}(?:[-_][a-z]{2})?)$/i.test(p)) continue;
      return p;
    }
    return "";
  };

  // Helper: Dispatches specific vendor and model from a model or candidate string
  const resolveHardwareFromToken = (candidate) => {
    if (!candidate || typeof candidate !== "string") return null;
    const str = candidate.trim();
    if (!str) return null;

    let match;

    // 1. Google Pixel
    if ((match = str.match(/Pixel(?:\s*([0-9a-zA-Z\s()_.-]+?))?(?=\s+Build|\)|\;|\/|$)/i))) {
      const sub = match[1] ? match[1].trim() : "";
      return {
        vendor: "Google",
        model: sub ? `Pixel ${sub}` : "Pixel",
      };
    }

    // 2. Samsung Galaxy
    if ((match = str.match(/(SM-[0-9a-zA-Z]+)/i))) {
      return { vendor: "Samsung", model: match[1].toUpperCase() };
    }
    if ((match = str.match(/(GT-[0-9a-zA-Z]+)/i))) {
      return { vendor: "Samsung", model: match[1].toUpperCase() };
    }
    if ((match = str.match(/(?:SCH|SGH|SHV)-[0-9a-zA-Z]+/i))) {
      return { vendor: "Samsung", model: match[0].toUpperCase() };
    }
    if ((match = str.match(/(?:SC-[0-9]{2}[A-Z]|SCV[0-9]{2})/i))) {
      return { vendor: "Samsung", model: match[0].toUpperCase() };
    }
    if ((match = str.match(/Galaxy\s*([0-9a-zA-Z\s()_.-]+?)(?=\s+Build|\)|\;|\/|$)/i))) {
      return { vendor: "Samsung", model: `Galaxy ${match[1].trim()}` };
    }
    if (/SAMSUNG/i.test(str)) {
      return { vendor: "Samsung", model: "Galaxy" };
    }

    // 3. Xiaomi / Redmi / POCO
    if ((match = str.match(/(?:Redmi|POCO)\s*([0-9a-zA-Z\s()_.-]+?)(?=\s+Build|\)|\;|\/|$)/i))) {
      return { vendor: "Xiaomi", model: match[0].trim() };
    }
    if ((match = str.match(/Xiaomi\s*([0-9a-zA-Z\s()_.-]+?)(?=\s+Build|\)|\;|\/|$)/i))) {
      return { vendor: "Xiaomi", model: match[0].trim() };
    }
    if ((match = str.match(/Mi\s+([0-9a-zA-Z\s()_.-]+?)(?=\s+Build|\)|\;|\/|$)/i))) {
      return { vendor: "Xiaomi", model: match[0].trim() };
    }
    // Xiaomi OEM number codes (e.g. 2201116PG, 23049PCD8G, 2311DRK48G, M2101K6G)
    if ((match = str.match(/\b(2[1-4][0-9]{2}[0-9A-Z]{4,6}|M2[0-1][0-9]{2}[A-Z0-9]+)\b/i))) {
      return { vendor: "Xiaomi", model: match[1].trim() };
    }

    // 4. OnePlus
    if ((match = str.match(/OnePlus(?:\s*([0-9a-zA-Z\s()_.-]+?))?(?=\s+Build|\)|\;|\/|$)/i))) {
      const sub = match[1] ? match[1].trim() : "";
      return {
        vendor: "OnePlus",
        model: sub ? `OnePlus ${sub}` : "OnePlus",
      };
    }
    if ((match = str.match(/ONEPLUS\s*([A-Z0-9]+)/i))) {
      return { vendor: "OnePlus", model: `ONEPLUS ${match[1].trim()}` };
    }
    // OnePlus specific CPH codes
    if ((match = str.match(/\b(CPH(?:2581|2573|2551|2449|2451|2415|2399|2493|2491|2569|2467|2465|2513|2515|2487))\b/i))) {
      return { vendor: "OnePlus", model: match[1].toUpperCase() };
    }
    // OnePlus known model numbering (Nord, 7, 8, 9, 10 series)
    if ((match = str.match(/\b(NE221[0-9]|KB200[0-9]|GM191[0-9]|HD190[0-9]|IN202[0-9]|IN201[0-9]|DN210[0-9]|AC200[0-9])\b/i))) {
      return { vendor: "OnePlus", model: match[1].toUpperCase() };
    }

    // 5. Motorola
    if ((match = str.match(/motorola\s*([0-9a-zA-Z\s_().+-]+)/i))) {
      return { vendor: "Motorola", model: sanitizeModel(match[0]) };
    }
    if ((match = str.match(/moto\s*([0-9a-zA-Z\s_().+-]+)/i))) {
      return { vendor: "Motorola", model: sanitizeModel(match[0]) };
    }
    if ((match = str.match(/\b(XT[0-9]{4}(?:-[0-9]+)?)\b/i))) {
      return { vendor: "Motorola", model: match[1].toUpperCase() };
    }

    // 6. Realme
    if ((match = str.match(/realme\s*([0-9a-zA-Z\s_().+-]+)/i))) {
      return { vendor: "Realme", model: sanitizeModel(match[0]) };
    }
    if ((match = str.match(/\b(RMX[0-9]{4})\b/i))) {
      return { vendor: "Realme", model: match[1].toUpperCase() };
    }

    // 7. Vivo & iQOO
    if ((match = str.match(/vivo\s*([0-9a-zA-Z\s_().+-]+)/i))) {
      return { vendor: "Vivo", model: sanitizeModel(match[0]) };
    }
    if ((match = str.match(/iQOO(?:\s*([0-9a-zA-Z\s_().+-]+?))?(?=\s+Build|\)|\;|\/|$)/i))) {
      const sub = match[1] ? match[1].trim() : "";
      return {
        vendor: "Vivo",
        model: sub ? `iQOO ${sub}` : "iQOO",
      };
    }
    if ((match = str.match(/\b(V[0-9]{4}[A-Z]?|I[0-9]{4})\b/i))) {
      return { vendor: "Vivo", model: match[1].toUpperCase() };
    }

    // 8. Oppo
    if ((match = str.match(/OPPO\s*([0-9a-zA-Z\s_().+-]+)/i))) {
      return { vendor: "Oppo", model: sanitizeModel(match[0]) };
    }
    if ((match = str.match(/\b(CPH[0-9]{4})\b/i))) {
      return { vendor: "Oppo", model: match[1].toUpperCase() };
    }
    if ((match = str.match(/\b(P[A-Z]{3}[0-9]{2})\b/i))) {
      return { vendor: "Oppo", model: match[1].toUpperCase() };
    }

    // 9. Other recognized manufacturers
    if ((match = str.match(/HUAWEI\s*([0-9a-zA-Z\s_().-]+)/i))) {
      return { vendor: "Huawei", model: sanitizeModel(match[0]) };
    }
    if ((match = str.match(/HONOR\s*([0-9a-zA-Z\s_().-]+)/i))) {
      return { vendor: "Honor", model: sanitizeModel(match[0]) };
    }
    if ((match = str.match(/Sony\s*([0-9a-zA-Z\s_().-]+)/i))) {
      return { vendor: "Sony", model: sanitizeModel(match[0]) };
    }
    if ((match = str.match(/ASUS(?:\s*|_)([0-9a-zA-Z_]+)/i))) {
      return { vendor: "ASUS", model: `ASUS ${match[1].trim()}` };
    }
    if ((match = str.match(/Nokia\s*([0-9a-zA-Z\s_().-]+)/i))) {
      return { vendor: "Nokia", model: sanitizeModel(match[0]) };
    }

    return null;
  };

  // Step 4A: Check User-Agent Client Hints first (highest fidelity for modern Chrome/Chromium)
  const hintModelRaw = clientHints?.model || clientHints?.["sec-ch-ua-model"];
  const sanitizedHint = sanitizeModel(hintModelRaw);
  if (sanitizedHint) {
    const hintResolution = resolveHardwareFromToken(sanitizedHint);
    if (hintResolution) {
      deviceVendor = hintResolution.vendor;
      deviceModel = hintResolution.model;
    } else {
      // If client hint provides an unreduced model that doesn't match above, use it directly
      deviceModel = sanitizedHint;
    }
  }

  // Step 4B: If vendor/model not yet resolved from client hints, inspect User-Agent
  if (deviceVendor === "Unknown" || deviceModel === "Unknown") {
    // 1. Apple ecosystem
    if (/iPhone/i.test(ua)) {
      deviceVendor = "Apple";
      deviceModel = "iPhone";
    } else if (/iPad/i.test(ua)) {
      deviceVendor = "Apple";
      deviceModel = "iPad";
    } else if (/iPod/i.test(ua)) {
      deviceVendor = "Apple";
      deviceModel = "iPod";
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      deviceVendor = "Apple";
      deviceModel = "Mac";
    } else if (operatingSystem === "Android") {
      // 2. Extract candidate from Android platform bracket
      const androidCandidate = extractAndroidDevice(ua);
      const sanitizedCandidate = sanitizeModel(androidCandidate);
      if (sanitizedCandidate) {
        const resolution = resolveHardwareFromToken(sanitizedCandidate);
        if (resolution) {
          deviceVendor = resolution.vendor;
          deviceModel = resolution.model;
        } else {
          deviceModel = sanitizedCandidate;
        }
      }
      // If still unresolved, search full UA
      if (deviceVendor === "Unknown" || deviceModel === "Unknown") {
        const uaResolution = resolveHardwareFromToken(ua);
        if (uaResolution) {
          deviceVendor = uaResolution.vendor;
          deviceModel = uaResolution.model;
        }
      }
    } else {
      // 3. For non-Android mobile or other devices, search full User-Agent
      const uaResolution = resolveHardwareFromToken(ua);
      if (uaResolution) {
        deviceVendor = uaResolution.vendor;
        deviceModel = uaResolution.model;
      }
    }
  }

  // Step 4C: Desktop guard (never guess or invent mobile hardware for Windows/Linux PCs)
  if (deviceType === "desktop" && deviceVendor !== "Apple") {
    deviceVendor = "Unknown";
    deviceModel = "Unknown";
  }

  return {
    deviceType,
    browser,
    browserVersion,
    operatingSystem,
    osVersion,
    deviceVendor,
    deviceModel,
  };
};
