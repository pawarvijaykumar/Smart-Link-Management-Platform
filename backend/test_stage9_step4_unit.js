/**
 * Stage 9 Step 4: Device Vendor & Model Unit Verification Suite
 * Tests hardware vendor and model extraction across:
 * - Samsung Galaxy
 * - Xiaomi / Redmi / POCO
 * - Google Pixel
 * - OnePlus
 * - Motorola
 * - Oppo
 * - Vivo & iQOO
 * - Realme
 * - Apple iPhone / iPad / Mac
 * - Windows / Linux desktops
 * - Chrome User-Agent Reduction ('K' placeholder) with & without Client Hints
 * - Empty, null, malformed, bots
 */

import { parseUserAgent } from "./src/utils/userAgentParser.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("Stage 9 Step 4: Device Vendor & Model Verification");
console.log("=======================================================\n");

// ---------------------------------------------------------------------------
// 1. Samsung Galaxy Devices
// ---------------------------------------------------------------------------
console.log("[1. Samsung Galaxy Devices]");
{
  // SM-S918B (Galaxy S23 Ultra)
  const ua1 = "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "Samsung", "SM-S918B vendor is Samsung");
  assert(r1.deviceModel === "SM-S918B", "SM-S918B model is SM-S918B");

  // SM-A536B (Galaxy A53)
  const ua2 = "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "Samsung", "SM-A536B vendor is Samsung");
  assert(r2.deviceModel === "SM-A536B", "SM-A536B model is SM-A536B");

  // Named Galaxy Tab
  const ua3 = "Mozilla/5.0 (Linux; Android 13; Galaxy Tab S8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
  const r3 = parseUserAgent(ua3);
  assert(r3.deviceVendor === "Samsung", "Galaxy Tab vendor is Samsung");
  assert(r3.deviceModel === "Galaxy Tab S8", "Galaxy Tab model is Galaxy Tab S8");

  // Classic GT- series
  const ua4 = "Mozilla/5.0 (Linux; U; Android 4.2.2; en-us; GT-I9500 Build/JDQ39) AppleWebKit/534.30";
  const r4 = parseUserAgent(ua4);
  assert(r4.deviceVendor === "Samsung", "GT-I9500 vendor is Samsung");
  assert(r4.deviceModel === "GT-I9500", "GT-I9500 model is GT-I9500");
}

// ---------------------------------------------------------------------------
// 2. Xiaomi / Redmi / POCO Devices
// ---------------------------------------------------------------------------
console.log("\n[2. Xiaomi / Redmi / POCO Devices]");
{
  // Redmi Note 11
  const ua1 = "Mozilla/5.0 (Linux; Android 12; Redmi Note 11 Build/SKQ1.211103.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "Xiaomi", "Redmi Note 11 vendor is Xiaomi");
  assert(r1.deviceModel === "Redmi Note 11", "Redmi Note 11 model is Redmi Note 11");

  // POCO F5
  const ua2 = "Mozilla/5.0 (Linux; Android 13; POCO F5 Build/TKQ1.221013.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "Xiaomi", "POCO F5 vendor is Xiaomi");
  assert(r2.deviceModel === "POCO F5", "POCO F5 model is POCO F5");

  // Xiaomi OEM model code 23049PCD8G (POCO F5 Pro)
  const ua3 = "Mozilla/5.0 (Linux; Android 13; 23049PCD8G Build/TKQ1.221013.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36";
  const r3 = parseUserAgent(ua3);
  assert(r3.deviceVendor === "Xiaomi", "23049PCD8G vendor is Xiaomi");
  assert(r3.deviceModel === "23049PCD8G", "23049PCD8G model is 23049PCD8G");

  // Xiaomi 2201116PG (POCO X4 Pro)
  const ua4 = "Mozilla/5.0 (Linux; Android 12; 2201116PG Build/RKQ1.211001.001) AppleWebKit/537.36";
  const r4 = parseUserAgent(ua4);
  assert(r4.deviceVendor === "Xiaomi", "2201116PG vendor is Xiaomi");
  assert(r4.deviceModel === "2201116PG", "2201116PG model is 2201116PG");

  // Xiaomi OEM M2101K6G (Redmi Note 10 Pro)
  const ua5 = "Mozilla/5.0 (Linux; Android 11; M2101K6G Build/RKQ1.200826.002) AppleWebKit/537.36";
  const r5 = parseUserAgent(ua5);
  assert(r5.deviceVendor === "Xiaomi", "M2101K6G vendor is Xiaomi");
  assert(r5.deviceModel === "M2101K6G", "M2101K6G model is M2101K6G");

  // Xiaomi 13 Pro
  const ua6 = "Mozilla/5.0 (Linux; Android 13; Xiaomi 13 Pro Build/TKQ1.221114.001) AppleWebKit/537.36";
  const r6 = parseUserAgent(ua6);
  assert(r6.deviceVendor === "Xiaomi", "Xiaomi 13 Pro vendor is Xiaomi");
  assert(r6.deviceModel === "Xiaomi 13 Pro", "Xiaomi 13 Pro model is Xiaomi 13 Pro");
}

// ---------------------------------------------------------------------------
// 3. Google Pixel Devices
// ---------------------------------------------------------------------------
console.log("\n[3. Google Pixel Devices]");
{
  const ua1 = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UD1A.230803.041) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "Google", "Pixel 8 Pro vendor is Google");
  assert(r1.deviceModel === "Pixel 8 Pro", "Pixel 8 Pro model is Pixel 8 Pro");

  const ua2 = "Mozilla/5.0 (Linux; Android 13; Pixel 7a Build/TQ3A.230805.001) AppleWebKit/537.36";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "Google", "Pixel 7a vendor is Google");
  assert(r2.deviceModel === "Pixel 7a", "Pixel 7a model is Pixel 7a");

  const ua3 = "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36";
  const r3 = parseUserAgent(ua3);
  assert(r3.deviceVendor === "Google", "Pixel 6 vendor is Google");
  assert(r3.deviceModel === "Pixel 6", "Pixel 6 model is Pixel 6");
}

// ---------------------------------------------------------------------------
// 4. OnePlus Devices
// ---------------------------------------------------------------------------
console.log("\n[4. OnePlus Devices]");
{
  // OnePlus 12 (CPH2581)
  const ua1 = "Mozilla/5.0 (Linux; Android 14; CPH2581 Build/UKQ1.230924.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "OnePlus", "CPH2581 vendor is OnePlus");
  assert(r1.deviceModel === "CPH2581", "CPH2581 model is CPH2581");

  // OnePlus 11 5G
  const ua2 = "Mozilla/5.0 (Linux; Android 13; OnePlus 11 5G Build/TP1A.220905.001) AppleWebKit/537.36";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "OnePlus", "OnePlus 11 5G vendor is OnePlus");
  assert(r2.deviceModel === "OnePlus 11 5G", "OnePlus 11 5G model is OnePlus 11 5G");

  // OnePlus 10 Pro (NE2213)
  const ua3 = "Mozilla/5.0 (Linux; Android 12; NE2213) AppleWebKit/537.36";
  const r3 = parseUserAgent(ua3);
  assert(r3.deviceVendor === "OnePlus", "NE2213 vendor is OnePlus");
  assert(r3.deviceModel === "NE2213", "NE2213 model is NE2213");

  // OnePlus 8T (KB2001)
  const ua4 = "Mozilla/5.0 (Linux; Android 11; KB2001) AppleWebKit/537.36";
  const r4 = parseUserAgent(ua4);
  assert(r4.deviceVendor === "OnePlus", "KB2001 vendor is OnePlus");
  assert(r4.deviceModel === "KB2001", "KB2001 model is KB2001");
}

// ---------------------------------------------------------------------------
// 5. Motorola Devices
// ---------------------------------------------------------------------------
console.log("\n[5. Motorola Devices]");
{
  // Motorola edge 40 neo
  const ua1 = "Mozilla/5.0 (Linux; Android 13; motorola edge 40 neo Build/T2VCS33.34-31-4) AppleWebKit/537.36";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "Motorola", "edge 40 neo vendor is Motorola");
  assert(r1.deviceModel === "motorola edge 40 neo", "edge 40 neo model is motorola edge 40 neo");

  // Moto g(60)
  const ua2 = "Mozilla/5.0 (Linux; Android 12; moto g(60) Build/S2RI32.32-20-4) AppleWebKit/537.36";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "Motorola", "moto g(60) vendor is Motorola");
  assert(r2.deviceModel === "moto g(60)", "moto g(60) model is moto g(60)");

  // XT2041-4
  const ua3 = "Mozilla/5.0 (Linux; Android 10; XT2041-4) AppleWebKit/537.36";
  const r3 = parseUserAgent(ua3);
  assert(r3.deviceVendor === "Motorola", "XT2041-4 vendor is Motorola");
  assert(r3.deviceModel === "XT2041-4", "XT2041-4 model is XT2041-4");
}

// ---------------------------------------------------------------------------
// 6. Oppo Devices
// ---------------------------------------------------------------------------
console.log("\n[6. Oppo Devices]");
{
  // Oppo Find N3 Flip (CPH2525)
  const ua1 = "Mozilla/5.0 (Linux; Android 14; CPH2525 Build/UKQ1.230924.001) AppleWebKit/537.36";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "Oppo", "CPH2525 vendor is Oppo");
  assert(r1.deviceModel === "CPH2525", "CPH2525 model is CPH2525");

  // OPPO Reno8 Pro
  const ua2 = "Mozilla/5.0 (Linux; Android 13; OPPO Reno8 Pro Build/TP1A.220905.001) AppleWebKit/537.36";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "Oppo", "OPPO Reno8 Pro vendor is Oppo");
  assert(r2.deviceModel === "OPPO Reno8 Pro", "OPPO Reno8 Pro model is OPPO Reno8 Pro");
}

// ---------------------------------------------------------------------------
// 7. Vivo & iQOO Devices
// ---------------------------------------------------------------------------
console.log("\n[7. Vivo & iQOO Devices]");
{
  // Vivo X100 Pro (V2324A)
  const ua1 = "Mozilla/5.0 (Linux; Android 14; V2324A Build/UP1A.231005.007) AppleWebKit/537.36";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "Vivo", "V2324A vendor is Vivo");
  assert(r1.deviceModel === "V2324A", "V2324A model is V2324A");

  // iQOO Neo 7
  const ua2 = "Mozilla/5.0 (Linux; Android 13; iQOO Neo 7 Build/TP1A.220624.014) AppleWebKit/537.36";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "Vivo", "iQOO Neo 7 vendor is Vivo");
  assert(r2.deviceModel === "iQOO Neo 7", "iQOO Neo 7 model is iQOO Neo 7");

  // vivo 1904
  const ua3 = "Mozilla/5.0 (Linux; Android 11; vivo 1904) AppleWebKit/537.36";
  const r3 = parseUserAgent(ua3);
  assert(r3.deviceVendor === "Vivo", "vivo 1904 vendor is Vivo");
  assert(r3.deviceModel === "vivo 1904", "vivo 1904 model is vivo 1904");
}

// ---------------------------------------------------------------------------
// 8. Realme Devices
// ---------------------------------------------------------------------------
console.log("\n[8. Realme Devices]");
{
  // Realme GT 5 Pro (RMX3850)
  const ua1 = "Mozilla/5.0 (Linux; Android 14; RMX3850 Build/UKQ1.230924.001) AppleWebKit/537.36";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "Realme", "RMX3850 vendor is Realme");
  assert(r1.deviceModel === "RMX3850", "RMX3850 model is RMX3850");

  // realme 11 Pro
  const ua2 = "Mozilla/5.0 (Linux; Android 13; realme 11 Pro+ 5G) AppleWebKit/537.36";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "Realme", "realme 11 Pro vendor is Realme");
  assert(r2.deviceModel === "realme 11 Pro+ 5G", "realme 11 Pro model is realme 11 Pro+ 5G");
}

// ---------------------------------------------------------------------------
// 9. Apple Devices (Strictly no invented model numbers)
// ---------------------------------------------------------------------------
console.log("\n[9. Apple Devices]");
{
  const ua1 = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  const r1 = parseUserAgent(ua1);
  assert(r1.deviceVendor === "Apple", "iPhone vendor is Apple");
  assert(r1.deviceModel === "iPhone", "iPhone model is strictly iPhone (no invented model)");

  const ua2 = "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
  const r2 = parseUserAgent(ua2);
  assert(r2.deviceVendor === "Apple", "iPad vendor is Apple");
  assert(r2.deviceModel === "iPad", "iPad model is iPad");

  const ua3 = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
  const r3 = parseUserAgent(ua3);
  assert(r3.deviceVendor === "Apple", "Macintosh vendor is Apple");
  assert(r3.deviceModel === "Mac", "Macintosh model is Mac");
}

// ---------------------------------------------------------------------------
// 10. Desktop PCs (Must return Unknown vendor & model)
// ---------------------------------------------------------------------------
console.log("\n[10. Desktop PCs]");
{
  const winUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  const rWin = parseUserAgent(winUA);
  assert(rWin.deviceVendor === "Unknown", "Windows PC vendor is Unknown");
  assert(rWin.deviceModel === "Unknown", "Windows PC model is Unknown");

  const linuxUA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
  const rLinux = parseUserAgent(linuxUA);
  assert(rLinux.deviceVendor === "Unknown", "Linux PC vendor is Unknown");
  assert(rLinux.deviceModel === "Unknown", "Linux PC model is Unknown");
}

// ---------------------------------------------------------------------------
// 11. Chrome User-Agent Reduction ('K' placeholder) & Client Hints
// ---------------------------------------------------------------------------
console.log("\n[11. Chrome User-Agent Reduction & Client Hints]");
{
  // User test case: Reduced User-Agent WITHOUT Client Hints
  const reducedUA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
  const rReducedNoHints = parseUserAgent(reducedUA);
  assert(rReducedNoHints.deviceVendor === "Unknown", "Reduced UA without hints has Unknown vendor");
  assert(rReducedNoHints.deviceModel === "Unknown", "Reduced UA without hints has Unknown model (never 'K')");

  // Reduced User-Agent WITH Client Hints for Samsung
  const rReducedWithSamsung = parseUserAgent(reducedUA, { model: '"SM-S918B"', platformVersion: '"14.0.0"' });
  assert(rReducedWithSamsung.deviceVendor === "Samsung", "Client Hint resolves vendor to Samsung");
  assert(rReducedWithSamsung.deviceModel === "SM-S918B", "Client Hint resolves model to SM-S918B");
  assert(rReducedWithSamsung.osVersion === "14", "Client Hint updates osVersion to 14 from frozen 10");

  // Reduced User-Agent WITH Client Hints for Pixel
  const rReducedWithPixel = parseUserAgent(reducedUA, { model: '"Pixel 8 Pro"' });
  assert(rReducedWithPixel.deviceVendor === "Google", "Client Hint resolves vendor to Google");
  assert(rReducedWithPixel.deviceModel === "Pixel 8 Pro", "Client Hint resolves model to Pixel 8 Pro");

  // Reduced User-Agent WITH Client Hints for OnePlus
  const rReducedWithOP = parseUserAgent(reducedUA, { model: '"CPH2581"' });
  assert(rReducedWithOP.deviceVendor === "OnePlus", "Client Hint resolves vendor to OnePlus");
  assert(rReducedWithOP.deviceModel === "CPH2581", "Client Hint resolves model to CPH2581");
}

// ---------------------------------------------------------------------------
// 12. Empty, Null, Malformed, Bots
// ---------------------------------------------------------------------------
console.log("\n[12. Empty, Null, Malformed, Bots]");
{
  const rEmpty = parseUserAgent("");
  assert(rEmpty.deviceVendor === "Unknown", "Empty UA vendor is Unknown");
  assert(rEmpty.deviceModel === "Unknown", "Empty UA model is Unknown");

  const rNull = parseUserAgent(null);
  assert(rNull.deviceVendor === "Unknown", "Null UA vendor is Unknown");
  assert(rNull.deviceModel === "Unknown", "Null UA model is Unknown");

  const rCurl = parseUserAgent("curl/7.88.1");
  assert(rCurl.deviceVendor === "Unknown", "cURL vendor is Unknown");
  assert(rCurl.deviceModel === "Unknown", "cURL model is Unknown");

  const rBot = parseUserAgent("WhatsApp/2.24.1.78 A");
  assert(rBot.deviceVendor === "Unknown", "WhatsApp crawler vendor is Unknown");
  assert(rBot.deviceModel === "Unknown", "WhatsApp crawler model is Unknown");
}

console.log("\n=======================================================");
console.log(`Results: ${passed}/${passed + failed} assertions PASSED`);
console.log("=======================================================\n");
