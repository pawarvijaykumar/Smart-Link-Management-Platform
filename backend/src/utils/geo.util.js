import geoip from "geoip-lite";
import net from "node:net";
import crypto from "node:crypto";

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
 * Comprehensive mapping of Indian State and Union Territory 2-letter ISO / vehicle codes
 * to standard full state names.
 */
const INDIAN_STATES = {
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CG: "Chhattisgarh",
  CT: "Chhattisgarh",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  MP: "Madhya Pradesh",
  MH: "Maharashtra",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OD: "Odisha",
  OR: "Odisha",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TG: "Telangana",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UK: "Uttarakhand",
  UT: "Uttarakhand",
  WB: "West Bengal",
  AN: "Andaman and Nicobar Islands",
  CH: "Chandigarh",
  DH: "Dadra and Nagar Haveli and Daman and Diu",
  DD: "Dadra and Nagar Haveli and Daman and Diu",
  DN: "Dadra and Nagar Haveli and Daman and Diu",
  DL: "Delhi",
  JK: "Jammu and Kashmir",
  LA: "Ladakh",
  LD: "Lakshadweep",
  PY: "Puducherry",
};

/**
 * Normalizes state/region names. Maps 2-letter codes for India to full state names.
 */
export const cleanRegion = (countryCode, region) => {
  if (!region || typeof region !== "string") return "Unknown";
  const trimmed = region.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "unknown" || trimmed.toLowerCase() === "n/a") {
    return "Unknown";
  }

  if (countryCode === "IN") {
    const code = trimmed.toUpperCase();
    if (INDIAN_STATES[code]) {
      return INDIAN_STATES[code];
    }
    if (/delhi/i.test(trimmed)) {
      return "Delhi";
    }
  }

  return trimmed;
};

/**
 * Normalizes city names. Removes parenthetical sub-localities (e.g. "Nagpur (Hudkeshwar Buzurg)" -> "Nagpur")
 * and replaces empty or placeholder values with "Unknown".
 */
export const cleanCity = (city) => {
  if (!city || typeof city !== "string") return "Unknown";
  let trimmed = city.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "unknown" || trimmed.toLowerCase() === "n/a") {
    return "Unknown";
  }
  // Strip parenthetical neighborhood or sub-locality descriptors
  trimmed = trimmed.replace(/\s*\([^)]*\)\s*/g, "").trim();
  return trimmed || "Unknown";
};

/**
 * Strips IPv6-mapped IPv4 prefix (::ffff:) and trims whitespace.
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
 * Categorizes an IP address into loopback, private, or public.
 * Never stores or exposes the raw IP address.
 *
 * @param {string} rawIp
 * @returns {"loopback" | "private" | "public" | "none"}
 */
export const getIPCategory = (rawIp) => {
  const ip = cleanIP(rawIp);
  if (!ip) return "none";

  // Loopback (RFC 1122: 127.0.0.0/8, ::1)
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.") || ip.toLowerCase() === "localhost") {
    return "loopback";
  }

  // Private Subnets (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, link-local 169.254.0.0/16, IPv6 ULA/link-local)
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    ip.toLowerCase().startsWith("fc") ||
    ip.toLowerCase().startsWith("fd") ||
    ip.toLowerCase().startsWith("fe80:")
  ) {
    return "private";
  }

  return "public";
};

/**
 * Extracts the real visitor client IP address.
 *
 * Security & Anti-Spoofing:
 * - CF-Connecting-IP is trusted ONLY when the incoming socket connection is from a trusted proxy
 *   (loopback daemon such as Cloudflare Tunnel `cloudflared`) AND the `cf-ray` header is present.
 * - Direct external connections ignore proxy headers completely to prevent header spoofing.
 */
export const getVisitorIP = (req) => {
  if (!req) return null;

  const rawSocketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || "";
  const socketIp = cleanIP(rawSocketIp);

  // If request comes through loopback (e.g., local Cloudflare Tunnel daemon cloudflared or test harness)
  const isLoopbackSocket = socketIp ? getIPCategory(socketIp) === "loopback" : false;
  const isMockTest = !req.socket && !req.connection;

  // 1. Cloudflare Tunnel / Trusted Proxy Check:
  // ONLY trust cf-connecting-ip if incoming socket is loopback AND cf-ray is present (or in synthetic unit tests)
  const cfIp = cleanIP(req.headers?.["cf-connecting-ip"]);
  const hasCfRay = Boolean(req.headers?.["cf-ray"]);

  if (cfIp && net.isIP(cfIp)) {
    if ((isLoopbackSocket && hasCfRay) || isMockTest) {
      return cfIp;
    }
  }

  // 2. Standard proxy forwarded-for (used when behind trusted proxy or in unit tests)
  if (isLoopbackSocket || isMockTest) {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (forwarded && typeof forwarded === "string" && forwarded.trim()) {
      const parts = forwarded.split(",");
      const firstIp = cleanIP(parts[0]);
      if (firstIp && net.isIP(firstIp)) {
        return firstIp;
      }
    }

    const realIp = cleanIP(req.headers?.["x-real-ip"]);
    if (realIp && net.isIP(realIp)) {
      return realIp;
    }
  }

  // 3. Direct socket connection (prevents client header spoofing on direct external connections)
  if (socketIp && net.isIP(socketIp)) {
    return socketIp;
  }

  return null;
};

// =========================================================================
// Exact-IP In-Memory Cache (SHA-256 Hashed Keys, 3-Hour TTL, Max 5,000 entries)
// Strict exact-IP caching prevents cross-city misattribution in dynamic subnets.
// Raw IP addresses are NEVER stored in the cache.
// =========================================================================
const geoCache = new Map();
const CACHE_MAX_SIZE = 5000;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes on transient provider failures

const hashIP = (ip) => {
  return crypto.createHash("sha256").update(ip).digest("hex");
};

export const getCachedGeo = (ip) => {
  const key = hashIP(ip);
  const entry = geoCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    geoCache.delete(key);
    return null;
  }
  return {
    country: entry.country,
    countryCode: entry.countryCode,
    region: entry.region,
    city: entry.city,
  };
};

export const setCachedGeo = (ip, data, ttlMs = CACHE_TTL_MS) => {
  if (geoCache.size >= CACHE_MAX_SIZE) {
    // Evict oldest entry (FIFO)
    const oldestKey = geoCache.keys().next().value;
    if (oldestKey) geoCache.delete(oldestKey);
  }
  const key = hashIP(ip);
  geoCache.set(key, {
    country: data.country,
    countryCode: data.countryCode,
    region: data.region,
    city: data.city,
    expiresAt: Date.now() + ttlMs,
  });
};

/**
 * Clears the geo cache. Exported for testing purposes.
 */
export const clearGeoCache = () => {
  geoCache.clear();
};

/**
 * Resolves approximate geographical location from an IP address using a Tiered approach:
 * - Short-circuits loopback/private IPs safely (0 network calls).
 * - Checks exact-IP cache (SHA-256 hashed key).
 * - Tier 1: geoip-lite (instant local lookup). If full country, region, and city are present, returns immediately.
 * - Tier 2: FreeIPAPI HTTPS fallback (strict 2s timeout) when public IP has missing region/city (e.g. Indian IPv6).
 * - Graceful fallback on provider failure or rate limit.
 *
 * Raw IP address is NEVER stored, logged, or returned.
 *
 * @param {string} rawIp
 * @returns {Promise<{ country: string, countryCode: string|null, region: string, city: string }>}
 */
export const resolveGeoLocation = async (rawIp) => {
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

    const category = getIPCategory(ip);

    // Loopback and private subnets cannot be resolved to any nation; return Unknown safely
    if (category === "loopback" || category === "private") {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[GeoIP Diagnostic] IP Category: ${category} | Provider Status: unmapped (${category} address) | Lookup Result: country="Unknown", countryCode=null, region="Unknown", city="Unknown"`
        );
      }
      return defaultLocation;
    }

    // 1. Check Exact-IP In-Memory Cache
    const cached = getCachedGeo(ip);
    if (cached) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[GeoIP Diagnostic] IP Category: ${category} | Provider Status: cache-hit | Lookup Result: country="${cached.country}", countryCode=${cached.countryCode}, region="${cached.region}", city="${cached.city}"`
        );
      }
      return cached;
    }

    // 2. Tier 1: Local geoip-lite lookup
    let country = "Unknown";
    let countryCode = null;
    let region = "Unknown";
    let city = "Unknown";

    const geo = geoip.lookup(ip);
    if (geo && geo.country) {
      countryCode = geo.country.toUpperCase();
      country = getCountryName(countryCode);
      region = cleanRegion(countryCode, geo.region);
      city = cleanCity(geo.city);
    }

    // If Tier 1 has full country, region, and city, we are done
    if (country !== "Unknown" && region !== "Unknown" && city !== "Unknown") {
      const resolved = { country, countryCode, region, city };
      setCachedGeo(ip, resolved, CACHE_TTL_MS);

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[GeoIP Diagnostic] IP Category: ${category} | Provider Status: resolved (Tier 1 geoip-lite) | Lookup Result: country="${resolved.country}", countryCode=${resolved.countryCode}, region="${resolved.region}", city="${resolved.city}"`
        );
      }
      return resolved;
    }

    // 3. Tier 2: FreeIPAPI HTTPS Fallback for missing city or region (e.g. Indian mobile IPv6)
    try {
      const apiUrl = `https://freeipapi.com/api/json/${encodeURIComponent(ip)}`;
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(2000),
        headers: {
          Accept: "application/json",
          "User-Agent": "SmartLink-Platform/1.0",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === "object") {
          if (data.countryCode && (!countryCode || countryCode === "Unknown")) {
            countryCode = data.countryCode.toUpperCase();
          }
          if (data.countryName && country === "Unknown") {
            country = data.countryName.trim();
          } else if (countryCode && country === "Unknown") {
            country = getCountryName(countryCode);
          }
          if (data.regionName) {
            const parsedRegion = cleanRegion(countryCode, data.regionName);
            if (parsedRegion !== "Unknown") region = parsedRegion;
          }
          if (data.cityName) {
            const parsedCity = cleanCity(data.cityName);
            if (parsedCity !== "Unknown") city = parsedCity;
          }
        }

        const resolved = { country, countryCode, region, city };
        setCachedGeo(ip, resolved, CACHE_TTL_MS);

        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[GeoIP Diagnostic] IP Category: ${category} | Provider Status: resolved (Tier 2 freeipapi) | Lookup Result: country="${resolved.country}", countryCode=${resolved.countryCode}, region="${resolved.region}", city="${resolved.city}"`
          );
        }
        return resolved;
      } else {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[GeoIP Diagnostic] Tier 2 HTTP ${response.status} from freeipapi. Falling back to Tier 1.`);
        }
      }
    } catch (apiErr) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[GeoIP Diagnostic] Tier 2 request failed: ${apiErr.message}. Falling back to Tier 1.`);
      }
    }

    // Fallback to Tier 1 data (or Unknown)
    const fallbackResolved = { country, countryCode, region, city };
    // Cache for 5 minutes so we don't spam a failing external API
    setCachedGeo(ip, fallbackResolved, FAILURE_CACHE_TTL_MS);

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[GeoIP Diagnostic] IP Category: ${category} | Provider Status: fallback (Tier 1 geoip-lite) | Lookup Result: country="${fallbackResolved.country}", countryCode=${fallbackResolved.countryCode}, region="${fallbackResolved.region}", city="${fallbackResolved.city}"`
      );
    }
    return fallbackResolved;
  } catch (err) {
    console.warn("Non-blocking geoip lookup error:", err.message);
    return defaultLocation;
  }
};
