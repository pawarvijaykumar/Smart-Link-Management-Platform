/**
 * Stage 9: User-Agent Parser Unit Verification
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
console.log("Stage 9: User-Agent Parser Unit Verification");
console.log("=======================================================\n");

// 1. iPhone Safari
const iphoneUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1";
const iphone = parseUserAgent(iphoneUA);
assert(iphone.deviceType === "mobile", "iPhone is mobile");
assert(iphone.operatingSystem === "iOS", "iPhone OS is iOS");
assert(iphone.osVersion === "17.4.1", "iPhone OS version is 17.4.1");
assert(iphone.browser === "Safari", "iPhone browser is Safari");
assert(iphone.browserVersion === "17.4", "iPhone browser version is 17.4");
assert(iphone.deviceVendor === "Apple", "iPhone vendor is Apple");
assert(iphone.deviceModel === "iPhone", "iPhone model is iPhone");

// 2. iPad Safari
const ipadUA = "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
const ipad = parseUserAgent(ipadUA);
assert(ipad.deviceType === "tablet", "iPad is tablet");
assert(ipad.operatingSystem === "iOS", "iPad OS is iOS");
assert(ipad.osVersion === "16.5", "iPad OS version is 16.5");
assert(ipad.deviceVendor === "Apple", "iPad vendor is Apple");
assert(ipad.deviceModel === "iPad", "iPad model is iPad");

// 3. Google Pixel 8 Pro
const pixelUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36";
const pixel = parseUserAgent(pixelUA);
assert(pixel.deviceType === "mobile", "Pixel is mobile");
assert(pixel.operatingSystem === "Android", "Pixel OS is Android");
assert(pixel.osVersion === "14", "Pixel OS version is 14");
assert(pixel.browser === "Chrome", "Pixel browser is Chrome");
assert(pixel.browserVersion === "123.0", "Pixel browser version is 123.0");
assert(pixel.deviceVendor === "Google", "Pixel vendor is Google");
assert(pixel.deviceModel === "Pixel 8 Pro", "Pixel model is Pixel 8 Pro");

// 4. Samsung Galaxy S23 Ultra
const samsungUA = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const samsung = parseUserAgent(samsungUA);
assert(samsung.deviceType === "mobile", "Samsung is mobile");
assert(samsung.operatingSystem === "Android", "Samsung OS is Android");
assert(samsung.osVersion === "13", "Samsung OS version is 13");
assert(samsung.deviceVendor === "Samsung", "Samsung vendor is Samsung");
assert(samsung.deviceModel === "SM-S918B", "Samsung model is SM-S918B");

// 5. Samsung Internet Browser
const samsungBrowserUA = "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/16.0 Chrome/92.0.4515.166 Mobile Safari/537.36";
const sBrowser = parseUserAgent(samsungBrowserUA);
assert(sBrowser.browser === "Samsung Internet", "Disambiguates Samsung Internet from Chrome");
assert(sBrowser.browserVersion === "16.0", "Samsung Internet version is 16.0");

// 6. Windows 10/11 Edge
const winEdgeUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.92";
const winEdge = parseUserAgent(winEdgeUA);
assert(winEdge.deviceType === "desktop", "Windows Edge is desktop");
assert(winEdge.operatingSystem === "Windows", "Windows Edge OS is Windows");
assert(winEdge.osVersion === "10/11", "Windows 10/11 version mapped");
assert(winEdge.browser === "Edge", "Disambiguates Edge from Chrome");
assert(winEdge.browserVersion === "122.0", "Edge browser version is 122.0");
assert(winEdge.deviceVendor === "Unknown", "Desktop vendor is Unknown");

// 7. Windows Firefox
const winFFUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0";
const winFF = parseUserAgent(winFFUA);
assert(winFF.browser === "Firefox", "Windows Firefox browser is Firefox");
assert(winFF.browserVersion === "124.0", "Firefox browser version is 124.0");

// 8. macOS Safari
const macUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15";
const mac = parseUserAgent(macUA);
assert(mac.deviceType === "desktop", "Mac is desktop");
assert(mac.operatingSystem === "macOS", "Mac OS is macOS");
assert(mac.osVersion === "14.4.1", "Mac OS version is 14.4.1");
assert(mac.browser === "Safari", "Mac browser is Safari");
assert(mac.browserVersion === "17.4", "Mac browser version is 17.4");
assert(mac.deviceVendor === "Apple", "Mac vendor is Apple");
assert(mac.deviceModel === "Mac", "Mac model is Mac");

// 9. Linux Chrome
const linuxUA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const linux = parseUserAgent(linuxUA);
assert(linux.operatingSystem === "Linux", "Linux OS is Linux");
assert(linux.browser === "Chrome", "Linux browser is Chrome");
assert(linux.browserVersion === "121.0", "Linux browser version is 121.0");

// 10. Unknown, Empty, Null, Bot
const emptyResult = parseUserAgent("");
assert(emptyResult.deviceType === "unknown", "Empty UA returns unknown deviceType");
assert(emptyResult.browser === "Unknown", "Empty UA returns Unknown browser");
assert(emptyResult.operatingSystem === "Unknown", "Empty UA returns Unknown OS");

const nullResult = parseUserAgent(null);
assert(nullResult.operatingSystem === "Unknown", "Null UA returns Unknown OS");

const curlResult = parseUserAgent("curl/7.88.1");
assert(curlResult.browser === "cURL", "cURL detected as cURL");
assert(curlResult.browserVersion === "7.88", "cURL version parsed");

console.log("\n=======================================================");
console.log(`Results: ${passed}/${passed + failed} assertions PASSED`);
console.log("=======================================================\n");
