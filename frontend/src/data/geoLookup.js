// Geographic Name & Code Normalization Utilities
// Maps ISO 3166-1 alpha-2, Numeric IDs, and Regional Subdivision Codes

export const NUMERIC_TO_ISO2 = {
  "004": "AF", "008": "AL", "010": "AQ", "012": "DZ", "016": "AS", "020": "AD", "024": "AO", "028": "AG",
  "031": "AZ", "032": "AR", "036": "AU", "040": "AT", "044": "BS", "048": "BH", "050": "BD", "051": "AM",
  "052": "BB", "056": "BE", "060": "BM", "064": "BT", "068": "BO", "070": "BA", "072": "BW", "076": "BR",
  "084": "BZ", "086": "IO", "090": "SB", "092": "VG", "096": "BN", "100": "BG", "104": "MM", "108": "BI",
  "112": "BY", "116": "KH", "120": "CM", "124": "CA", "132": "CV", "136": "KY", "140": "CF", "144": "LK",
  "148": "TD", "152": "CL", "156": "CN", "158": "TW", "170": "CO", "174": "KM", "178": "CG", "180": "CD",
  "184": "CK", "188": "CR", "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK",
  "212": "DM", "214": "DO", "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER", "233": "EE",
  "234": "FO", "238": "FK", "239": "GS", "242": "FJ", "246": "FI", "248": "AX", "250": "FR", "258": "PF",
  "260": "TF", "262": "DJ", "266": "GA", "268": "GE", "270": "GM", "275": "PS", "276": "DE", "288": "GH",
  "296": "KI", "300": "GR", "304": "GL", "308": "GD", "316": "GU", "320": "GT", "324": "GN", "328": "GY",
  "332": "HT", "334": "HM", "336": "VA", "340": "HN", "344": "HK", "348": "HU", "352": "IS", "356": "IN",
  "360": "ID", "364": "IR", "368": "IQ", "372": "IE", "376": "IL", "380": "IT", "384": "CI", "388": "JM",
  "392": "JP", "398": "KZ", "400": "JO", "404": "KE", "408": "KP", "410": "KR", "414": "KW", "417": "KG",
  "418": "LA", "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY", "438": "LI", "440": "LT",
  "442": "LU", "446": "MO", "450": "MG", "454": "MW", "458": "MY", "462": "MV", "466": "ML", "470": "MT",
  "478": "MR", "480": "MU", "484": "MX", "492": "MC", "496": "MN", "498": "MD", "499": "ME", "500": "MS",
  "504": "MA", "508": "MZ", "512": "OM", "516": "NA", "520": "NR", "524": "NP", "528": "NL", "531": "CW",
  "533": "AW", "534": "SX", "540": "NC", "548": "VU", "554": "NZ", "558": "NI", "562": "NE", "566": "NG",
  "570": "NU", "574": "NF", "578": "NO", "580": "MP", "583": "FM", "584": "MH", "585": "PW", "586": "PK",
  "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH", "612": "PN", "616": "PL", "620": "PT",
  "624": "GW", "626": "TL", "630": "PR", "634": "QA", "642": "RO", "643": "RU", "646": "RW", "652": "BL",
  "654": "SH", "659": "KN", "660": "AI", "662": "LC", "663": "MF", "666": "PM", "670": "VC", "674": "SM",
  "678": "ST", "682": "SA", "686": "SN", "688": "RS", "690": "SC", "694": "SL", "702": "SG", "703": "SK",
  "704": "VN", "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES", "728": "SS", "729": "SD",
  "740": "SR", "748": "SZ", "752": "SE", "756": "CH", "760": "SY", "762": "TJ", "764": "TH", "768": "TG",
  "776": "TO", "780": "TT", "784": "AE", "788": "TN", "792": "TR", "795": "TM", "796": "TC", "800": "UG",
  "804": "UA", "807": "MK", "818": "EG", "826": "GB", "831": "GG", "832": "JE", "833": "IM", "834": "TZ",
  "840": "US", "850": "VI", "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "876": "WF", "882": "WS",
  "887": "YE", "894": "ZM"
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

  if (c === "US") {
    if (US_STATES[r]) {
      return US_STATES[r].name;
    }
    const matchingUs = Object.values(US_STATES).find(
      (s) => s.name.toLowerCase() === regionCode.toLowerCase()
    );
    if (matchingUs) {
      return matchingUs.name;
    }
  }

  if (c === "IN") {
    if (INDIA_STATES[r]) {
      return INDIA_STATES[r];
    }
    const matchingIn = Object.values(INDIA_STATES).find(
      (name) => name.toLowerCase() === regionCode.toLowerCase()
    );
    if (matchingIn) {
      return matchingIn;
    }
    if (/delhi/i.test(regionCode)) {
      return "Delhi";
    }
    if (/orissa/i.test(regionCode)) {
      return "Odisha";
    }
    if (/pondicherry/i.test(regionCode)) {
      return "Puducherry";
    }
  }

  // If regionCode is already a recognized full name (e.g. "Goa", "California", "Bavaria"), return it
  if (regionCode.length >= 3) {
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

// User-friendly display names for global territories
export function formatCountryDisplayName(name) {
  if (!name || typeof name !== "string") return "";
  const cleaned = name.trim();
  const MAP = {
    "United States of America": "United States",
    "Russian Federation": "Russia",
    "Korea, Republic of": "South Korea",
    "Dem. Rep. Korea": "North Korea",
    "Democratic Republic of the Congo": "DR Congo",
    "Congo": "Republic of the Congo",
    "Central African Rep.": "Central African Republic",
    "Dominican Rep.": "Dominican Republic",
    "Eq. Guinea": "Equatorial Guinea",
    "eSwatini": "Eswatini",
    "Iran, Islamic Republic of": "Iran",
    "Syrian Arab Republic": "Syria",
    "Viet Nam": "Vietnam",
    "Bolivia, Plurinational State of": "Bolivia",
    "Venezuela, Bolivarian Republic of": "Venezuela",
    "Tanzania, United Republic of": "Tanzania",
    "Br. Indian Ocean Ter.": "British Indian Ocean Territory",
    "Bosnia and Herz.": "Bosnia and Herzegovina",
    "Solomon Is.": "Solomon Islands",
    "Falkland Is.": "Falkland Islands",
    "S. Sudan": "South Sudan",
    "W. Sahara": "Western Sahara",
  };
  return MAP[cleaned] || cleaned;
}
