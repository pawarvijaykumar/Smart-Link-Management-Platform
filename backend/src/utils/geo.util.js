import geoip from "geoip-lite";

// Intl display name helper for standardized English country names
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/**
 * Returns full country name from a 2-letter ISO country code.
 * E.g., "US" -> "United States", "IN" -> "India", "GB" -> "United Kingdom".
 */
export const getCountryName = (countryCode) => {
  if (!countryCode || typeof countryCode !== "string") return "Unknown";
  const trimmed = countryCode.trim().toUpperCase();
  if (trimmed.length !== 2) return trimmed || "Unknown";
  try {
    return regionNames.of(trimmed) || trimmed;
  } catch {
    return trimmed;
  }
};

/**
 * Extracts the real visitor client IP address from Express request headers or socket.
 * Inspects reverse-proxy headers in order of precedence:
 * 1. cf-connecting-ip (Cloudflare)
 * 2. x-forwarded-for (first client IP in comma-separated list)
 * 3. x-real-ip (Nginx / Apache / load balancers)
 * 4. req.ip or socket remote address
 */
export const getVisitorIP = (req) => {
  if (!req) return null;

  // Cloudflare
  const cfIp = req.headers?.["cf-connecting-ip"];
  if (cfIp && typeof cfIp === "string" && cfIp.trim()) {
    return cfIp.trim();
  }

  // Standard proxy forwarded-for (comma-separated list: client, proxy1, proxy2)
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded && typeof forwarded === "string" && forwarded.trim()) {
    const parts = forwarded.split(",");
    if (parts.length > 0 && parts[0].trim()) {
      return parts[0].trim();
    }
  }

  // Nginx / custom proxy
  const realIp = req.headers?.["x-real-ip"];
  if (realIp && typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || null;
};

/**
 * Strips IPv6-mapped IPv4 prefix (::ffff:) and trims.
 */
export const cleanIP = (rawIp) => {
  if (!rawIp || typeof rawIp !== "string") return "";
  let ip = rawIp.trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  return ip;
};

/**
 * Resolves approximate geographical location from an IP address.
 * Runs 100% in-memory (< 0.1ms) using geoip-lite.
 * Raw IP address is NOT stored or returned.
 *
 * @param {string} rawIp
 * @returns {{ country: string, countryCode: string|null, region: string, city: string }}
 */
export const resolveGeoLocation = (rawIp) => {
  const defaultLocation = {
    country: "Unknown",
    countryCode: null,
    region: "Unknown",
    city: "Unknown",
  };

  if (!rawIp) return defaultLocation;

  try {
    const ip = cleanIP(rawIp);
    if (!ip) return defaultLocation;

    // Detect loopback / local IPs
    if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
      return defaultLocation;
    }

    const geo = geoip.lookup(ip);
    if (!geo || !geo.country) {
      return defaultLocation;
    }

    const countryCode = geo.country.toUpperCase();
    const country = getCountryName(countryCode);
    const region = geo.region ? geo.region.trim() : "Unknown";
    const city = geo.city ? geo.city.trim() : "Unknown";

    return {
      country: country || "Unknown",
      countryCode: countryCode || null,
      region: region || "Unknown",
      city: city || "Unknown",
    };
  } catch (err) {
    console.warn("Non-blocking geoip lookup error:", err.message);
    return defaultLocation;
  }
};
