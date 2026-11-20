const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Vijay Kumar\\.gemini\\antigravity\\brain\\e6ae3199-dfae-41ce-95e4-a1a717a5b049';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9558;
const USER_DATA = 'C:\\Users\\Vijay Kumar\\AppData\\Local\\Temp\\chrome_spotlight_ext2_' + Date.now();

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await sleep(300);
  }
  throw new Error('Could not connect to Chrome debugging endpoint');
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.msgId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch (err) {
        console.error('Error handling CDP message:', err);
      }
    };
  }

  send(method, params = {}) {
    const id = this.msgId++;
    const message = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(message);
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(outputPath, buf);
    console.log(`Saved screenshot to ${outputPath}`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('1. Launching Chrome headless on port ' + DEBUG_PORT);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA}`,
    '--window-size=1440,960',
    'about:blank',
  ]);

  try {
    const browserWsUrl = await getWsUrl();
    const pageRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?http://localhost:5173/`, { method: 'PUT' });
    const pageData = await pageRes.json();
    const client = new CDPClient(pageData.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    console.log('2. Waiting for login or dashboard...');
    let loggedIn = false;
    for (let i = 0; i < 40; i++) {
      const hasInputs = await client.evaluate(`!!document.querySelector('input[type="email"]')`);
      const hasDashboard = await client.evaluate(`!!document.querySelector('.metrics-grid')`);
      if (hasDashboard) {
        loggedIn = true;
        break;
      }
      if (hasInputs) break;
      await sleep(250);
    }

    if (!loggedIn) {
      console.log('3. Filling login credentials...');
      await client.evaluate(`
        (() => {
          const email = document.querySelector('input[type="email"]');
          const pass = document.querySelector('input[type="password"]');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(email, 'dashboard_tester@demo.com');
          email.dispatchEvent(new Event('input', { bubbles: true }));
          setter.call(pass, 'Password123!');
          pass.dispatchEvent(new Event('input', { bubbles: true }));
          const btn = document.querySelector('button[type="submit"]') || document.querySelector('button.login-btn');
          if (btn) btn.click();
        })()
      `);

      for (let i = 0; i < 50; i++) {
        const ready = await client.evaluate(`
          !!document.querySelector('.metrics-grid') &&
          !!document.querySelector('.three-analytics-row') &&
          !!document.querySelector('.yearly-main-layout') &&
          !!document.querySelector('.intel-cards-grid')
        `);
        if (ready) break;
        await sleep(250);
      }
    }

    console.log('4. Dashboard loaded. Waiting for stats and animations...');
    await sleep(2000);

    // =========================================================================
    // SECTION 4: DEVICE BREAKDOWN, BROWSER BREAKDOWN, TRAFFIC SOURCE PERFORMANCE
    // =========================================================================
    console.log('\n--- Capturing Section 4 (Device Breakdown Hover) ---');
    await client.evaluate(`document.querySelector('.three-analytics-row').scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await sleep(350);

    const devRect = await client.evaluate(`
      (() => {
        const c = document.querySelector('.three-analytics-row .card-spotlight.donut-card');
        const r = c.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      })()
    `);

    const devHoverX = devRect.x + Math.round(devRect.width * 0.45);
    const devHoverY = devRect.y + Math.round(devRect.height * 0.45);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: devHoverX, y: devHoverY });
    await client.evaluate(`
      (() => {
        const c = document.querySelector('.three-analytics-row .card-spotlight.donut-card');
        c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: ${devHoverX}, clientY: ${devHoverY} }));
        c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${devHoverX}, clientY: ${devHoverY} }));
      })()
    `);
    await sleep(300);
    await client.captureScreenshot(path.join(ARTIFACT_DIR, 'desktop_section4_device_hover.png'));

    console.log('\n--- Capturing Section 4 (Traffic Source Performance Hover) ---');
    const tfRect = await client.evaluate(`
      (() => {
        const c = document.querySelector('.three-analytics-row .card-spotlight.traffic-sources-card');
        const r = c.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      })()
    `);
    const tfHoverX = tfRect.x + Math.round(tfRect.width * 0.45);
    const tfHoverY = tfRect.y + Math.round(tfRect.height * 0.45);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: tfHoverX, y: tfHoverY });
    await client.evaluate(`
      (() => {
        const c = document.querySelector('.three-analytics-row .card-spotlight.traffic-sources-card');
        c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: ${tfHoverX}, clientY: ${tfHoverY} }));
        c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${tfHoverX}, clientY: ${tfHoverY} }));
      })()
    `);
    await sleep(300);
    await client.captureScreenshot(path.join(ARTIFACT_DIR, 'desktop_section4_traffic_hover.png'));

    // =========================================================================
    // SECTION 5: CLICK ACTIVITY GRAPH (WEEKLY CHART & SUMMARY)
    // =========================================================================
    console.log('\n--- Capturing Section 5 (Weekly Click Activity Hover) ---');
    await client.evaluate(`document.querySelector('.yearly-panel-block.weekly-chart-block').scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await sleep(350);

    const wkRect = await client.evaluate(`
      (() => {
        const c = document.querySelector('.yearly-panel-block.weekly-chart-block');
        const r = c.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      })()
    `);
    const wkHoverX = wkRect.x + Math.round(wkRect.width * 0.45);
    const wkHoverY = wkRect.y + Math.round(wkRect.height * 0.45);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: wkHoverX, y: wkHoverY });
    await client.evaluate(`
      (() => {
        const c = document.querySelector('.yearly-panel-block.weekly-chart-block');
        c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: ${wkHoverX}, clientY: ${wkHoverY} }));
        c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${wkHoverX}, clientY: ${wkHoverY} }));
      })()
    `);
    await sleep(300);
    await client.captureScreenshot(path.join(ARTIFACT_DIR, 'desktop_section5_weekly_hover.png'));

    console.log('\n--- Capturing Section 5 (Yearly Activity Summary Metric Hover) ---');
    await client.evaluate(`document.querySelector('.yearly-summary-panel').scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await sleep(350);

    const smRect = await client.evaluate(`
      (() => {
        const c = document.querySelector('.yearly-summary-metrics-grid .card-spotlight.summary-metric-card');
        const r = c.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      })()
    `);
    const smHoverX = smRect.x + Math.round(smRect.width * 0.5);
    const smHoverY = smRect.y + Math.round(smRect.height * 0.5);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: smHoverX, y: smHoverY });
    await client.evaluate(`
      (() => {
        const c = document.querySelector('.yearly-summary-metrics-grid .card-spotlight.summary-metric-card');
        c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: ${smHoverX}, clientY: ${smHoverY} }));
        c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${smHoverX}, clientY: ${smHoverY} }));
      })()
    `);
    await sleep(300);
    await client.captureScreenshot(path.join(ARTIFACT_DIR, 'desktop_section5_summary_hover.png'));

    // =========================================================================
    // SECTION 6: SMART TRAFFIC INTELLIGENCE (4 CARDS)
    // =========================================================================
    console.log('\n--- Capturing Section 6 (Smart Traffic Intelligence Hover) ---');
    await client.evaluate(`document.querySelector('.intelligence-section').scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await sleep(350);

    const intRect = await client.evaluate(`
      (() => {
        const cards = document.querySelectorAll('.intel-cards-grid .card-spotlight');
        const c = cards[1]; // Audience platform (Cyan)
        const r = c.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      })()
    `);
    const intHoverX = intRect.x + Math.round(intRect.width * 0.45);
    const intHoverY = intRect.y + Math.round(intRect.height * 0.45);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: intHoverX, y: intHoverY });
    await client.evaluate(`
      (() => {
        const cards = document.querySelectorAll('.intel-cards-grid .card-spotlight');
        const c = cards[1];
        c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: ${intHoverX}, clientY: ${intHoverY} }));
        c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${intHoverX}, clientY: ${intHoverY} }));
      })()
    `);
    await sleep(300);
    await client.captureScreenshot(path.join(ARTIFACT_DIR, 'desktop_section6_intel_hover.png'));

    // =========================================================================
    // MOBILE VIEWPORT
    // =========================================================================
    console.log('\n--- Capturing Mobile Viewport (Section 5) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(400);

    await client.evaluate(`document.querySelector('.yearly-main-layout').scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await sleep(300);
    await client.captureScreenshot(path.join(ARTIFACT_DIR, 'mobile_section5_view.png'));

    console.log('\nAll targeted visual screenshots captured successfully!');
    client.close();
  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
}

run();
