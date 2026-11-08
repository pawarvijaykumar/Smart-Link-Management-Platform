// Geographic Name & Code Normalization Utilities
// Maps ISO 3166-1 alpha-2, Numeric IDs, and Regional Subdivision Codes

export const NUMERIC_TO_ISO2 = {
  "840": "US", "356": "IN", "826": "GB", "276": "DE", "124": "CA",
  "036": "AU", "250": "FR", "076": "BR", "392": "JP", "156": "CN",
  "643": "RU", "484": "MX", "724": "ES", "380": "IT", "528": "NL",
  "752": "SE", "578": "NO", "710": "ZA", "784": "AE", "702": "SG",
  "756": "CH", "554": "NZ", "616": "PL", "360": "ID", "792": "TR",
  "682": "SA", "818": "EG", "566": "NG", "404": "KE", "032": "AR",
  "152": "CL", "170": "CO", "586": "PK", "050": "BD", "608": "PH",
  "704": "VN", "764": "TH", "458": "MY", "372": "IE", "056": "BE",
  "040": "AT", "620": "PT", "300": "GR", "208": "DK", "246": "FI",
  "410": "KR", "804": "UA", "191": "HR", "203": "CZ", "348": "HU",
  "642": "RO", "703": "SK", "376": "IL", "048": "BH", "414": "KW",
  "512": "OM", "634": "QA", "788": "TN", "504": "MA", "012": "DZ"
};

export const ISO2_TO_NUMERIC = Object.entries(NUMERIC_TO_ISO2).reduce((acc, [num, iso]) => {
  acc[iso] = num;
  return acc;
}, {});

export const COUNTRY_NAME_TO_ISO2 = {
  "united states of america": "US",
  "united states": "US",
  "usa": "US",
  "india": "IN",
  "united kingdom": "GB",
  "great britain": "GB",
  "germany": "DE",
  "canada": "CA",
  "australia": "AU",
  "france": "FR",
  "brazil": "BR",
  "japan": "JP",
  "china": "CN",
  "russia": "RU",
  "russian federation": "RU",
  "mexico": "MX",
  "spain": "ES",
  "italy": "IT",
  "netherlands": "NL",
  "sweden": "SE",
  "norway": "NO",
  "south africa": "ZA",
  "united arab emirates": "AE",
  "singapore": "SG",
  "switzerland": "CH",
  "new zealand": "NZ",
  "poland": "PL",
  "indonesia": "ID",
  "turkey": "TR",
  "saudi arabia": "SA",
  "egypt": "EG",
  "nigeria": "NG",
  "kenya": "KE",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "pakistan": "PK",
  "bangladesh": "BD",
  "philippines": "PH",
  "vietnam": "VN",
  "thailand": "TH",
  "malaysia": "MY",
  "ireland": "IE",
  "belgium": "BE",
  "austria": "AT",
  "portugal": "PT",
  "greece": "GR",
  "denmark": "DK",
  "finland": "FI",
  "south korea": "KR",
  "korea": "KR",
  "ukraine": "UA",
};

// United States 50 States + DC: Postal code to Name & FIPS mapping
export const US_STATES = {
  AL: { name: "Alabama", fips: "01" },
  AK: { name: "Alaska", fips: "02" },
  AZ: { name: "Arizona", fips: "04" },
  AR: { name: "Arkansas", fips: "05" },
  CA: { name: "California", fips: "06" },
  CO: { name: "Colorado", fips: "08" },
  CT: { name: "Connecticut", fips: "09" },
  DE: { name: "Delaware", fips: "10" },
  DC: { name: "District of Columbia", fips: "11" },
  FL: { name: "Florida", fips: "12" },
  GA: { name: "Georgia", fips: "13" },
  HI: { name: "Hawaii", fips: "15" },
  ID: { name: "Idaho", fips: "16" },
  IL: { name: "Illinois", fips: "17" },
  IN: { name: "Indiana", fips: "18" },
  IA: { name: "Iowa", fips: "19" },
  KS: { name: "Kansas", fips: "20" },
  KY: { name: "Kentucky", fips: "21" },
  LA: { name: "Louisiana", fips: "22" },
  ME: { name: "Maine", fips: "23" },
  MD: { name: "Maryland", fips: "24" },
  MA: { name: "Massachusetts", fips: "25" },
  MI: { name: "Michigan", fips: "26" },
  MN: { name: "Minnesota", fips: "27" },
  MS: { name: "Mississippi", fips: "28" },
  MO: { name: "Missouri", fips: "29" },
  MT: { name: "Montana", fips: "30" },
  NE: { name: "Nebraska", fips: "31" },
  NV: { name: "Nevada", fips: "32" },
  NH: { name: "New Hampshire", fips: "33" },
  NJ: { name: "New Jersey", fips: "34" },
  NM: { name: "New Mexico", fips: "35" },
  NY: { name: "New York", fips: "36" },
  NC: { name: "North Carolina", fips: "37" },
  ND: { name: "North Dakota", fips: "38" },
  OH: { name: "Ohio", fips: "39" },
  OK: { name: "Oklahoma", fips: "40" },
  OR: { name: "Oregon", fips: "41" },
  PA: { name: "Pennsylvania", fips: "42" },
  RI: { name: "Rhode Island", fips: "44" },
  SC: { name: "South Carolina", fips: "45" },
  SD: { name: "South Dakota", fips: "46" },
  TN: { name: "Tennessee", fips: "47" },
  TX: { name: "Texas", fips: "48" },
  UT: { name: "Utah", fips: "49" },
  VT: { name: "Vermont", fips: "50" },
  VA: { name: "Virginia", fips: "51" },
  WA: { name: "Washington", fips: "53" },
  WV: { name: "West Virginia", fips: "54" },
  WI: { name: "Wisconsin", fips: "55" },
  WY: { name: "Wyoming", fips: "56" }
};

// India States and Union Territories code mapping
export const INDIA_STATES = {
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
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
  WB: "West Bengal",
  AN: "Andaman and Nicobar Islands",
  CH: "Chandigarh",
  DH: "Dadra and Nagar Haveli and Daman and Diu",
  DL: "Delhi",
  JK: "Jammu and Kashmir",
  LA: "Ladakh",
  LD: "Lakshadweep",
  PY: "Puducherry"
};

// Resolves a human-readable state / region name given countryCode and raw region code
export function getStateDisplayName(countryCode, regionCode) {
  if (!regionCode || regionCode === "Unknown" || regionCode === "") {
    return "Unknown Region";
  }

  const c = (countryCode || "").toUpperCase();
  const r = (regionCode || "").toUpperCase();

  if (c === "US" && US_STATES[r]) {
    return US_STATES[r].name;
  }
  if (c === "IN" && INDIA_STATES[r]) {
    return INDIA_STATES[r];
  }

  // If regionCode is already full name (e.g., "California" or "Bavaria"), return it
  if (regionCode.length > 3) {
    return regionCode;
  }

  return `${r} Region`;
}

// Country flag emoji from ISO-2 code
export function getCountryFlagEmoji(countryCode) {
  if (!countryCode || countryCode === "Unknown" || typeof countryCode !== "string") {
    return "🌐";
  }
  const cleanCode = countryCode.trim().toUpperCase();
  if (cleanCode.length !== 2) return "🌐";

  const codePoints = cleanCode
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
