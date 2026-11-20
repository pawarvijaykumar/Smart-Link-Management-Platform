const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Vijay Kumar\\.gemini\\antigravity\\brain\\e6ae3199-dfae-41ce-95e4-a1a717a5b049';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9556;
const USER_DATA = 'C:\\Users\\Vijay Kumar\\AppData\\Local\\Temp\\chrome_spotlight_verify_' + Date.now();

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

  async captureScreenshot(outputPath, clip = null) {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const res = await this.send('Page.captureScreenshot', params);
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
    '--window-size=1440,900',
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

    console.log('2. Waiting for login form or dashboard...');
    let loggedIn = false;
    for (let i = 0; i < 40; i++) {
      const hasInputs = await client.evaluate(`!!document.querySelector('input[type="email"]')`);
      const hasDashboard = await client.evaluate(`!!document.querySelector('.metrics-grid')`);
      if (hasDashboard) {
        loggedIn = true;
        break;
      }
      if (hasInputs) {
        break;
      }
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
        const ready = await client.evaluate(`!!document.querySelector('.metrics-grid') && document.querySelectorAll('.metrics-grid .card-spotlight').length === 4`);
        if (ready) break;
        await sleep(250);
      }
    }

    console.log('4. Dashboard loaded. Waiting for stats and animations to settle...');
    await sleep(2000);

    // Scroll metrics-grid into view
    await client.evaluate(`document.querySelector('.metrics-grid').scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await sleep(500);

    // Get bounding boxes of all 4 cards
    const cardInfo = await client.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.metrics-grid .card-spotlight'));
        return cards.map((c, i) => {
          const r = c.getBoundingClientRect();
          return {
            index: i,
            label: c.querySelector('.metric-card-label')?.innerText?.trim(),
            val: c.querySelector('.metric-card-val')?.innerText?.trim(),
            x: Math.round(r.left),
            y: Math.round(r.top),
            width: Math.round(r.width),
            height: Math.round(r.height),
          };
        });
      })()
    `);
    console.log('Found 4 KPI Cards:', JSON.stringify(cardInfo, null, 2));

    const cardFilenames = [
      'kpi_card_1_total_links_active.png',
      'kpi_card_2_total_clicks_active.png',
      'kpi_card_3_avg_clicks_active.png',
      'kpi_card_4_active_links_active.png',
    ];

    // For each card, simulate hover via CDP Input.dispatchMouseEvent and capture
    for (let i = 0; i < cardInfo.length; i++) {
      const card = cardInfo[i];
      const targetX = card.x + Math.round(card.width * 0.45);
      const targetY = card.y + Math.round(card.height * 0.45);

      console.log(`\n--- Hovering Card ${i + 1}: ${card.label} at (${targetX}, ${targetY}) ---`);

      // Dispatch mouse moved via CDP native input
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: targetX,
        y: targetY,
      });

      // Also trigger mouseenter & mousemove synthetic events to guarantee React state updates
      await client.evaluate(`
        (() => {
          const card = document.querySelectorAll('.metrics-grid .card-spotlight')[${i}];
          if (card) {
            const rect = card.getBoundingClientRect();
            const clientX = ${targetX};
            const clientY = ${targetY};
            card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX, clientY }));
            card.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY }));
          }
        })()
      `);

      await sleep(350);

      // Check the state of the card's spotlight layers
      const spotlightState = await client.evaluate(`
        (() => {
          const card = document.querySelectorAll('.metrics-grid .card-spotlight')[${i}];
          const borderLayer = card.querySelector('.spotlight-border-layer');
          const surfaceLayer = card.querySelector('.spotlight-surface-layer');
          return {
            cardClasses: card.className,
            borderStyle: borderLayer?.getAttribute('style'),
            borderOpacity: borderLayer ? window.getComputedStyle(borderLayer).opacity : null,
            surfaceStyle: surfaceLayer?.getAttribute('style'),
            surfaceOpacity: surfaceLayer ? window.getComputedStyle(surfaceLayer).opacity : null,
            cssMouseX: card.style.getPropertyValue('--mouse-x'),
            cssMouseY: card.style.getPropertyValue('--mouse-y'),
          };
        })()
      `);
      console.log(`Spotlight state for ${card.label}:`, spotlightState);

      // Capture screenshot of the metrics grid with this card highlighted
      const gridRect = await client.evaluate(`
        (() => {
          const grid = document.querySelector('.metrics-grid');
          const r = grid.getBoundingClientRect();
          return { x: r.left, y: r.top, width: r.width, height: r.height };
        })()
      `);

      const screenshotFile = path.join(ARTIFACT_DIR, cardFilenames[i]);
      await client.captureScreenshot(screenshotFile, {
        x: Math.max(0, gridRect.x - 20),
        y: Math.max(0, gridRect.y - 20),
        width: gridRect.width + 40,
        height: gridRect.height + 40,
        scale: 1,
      });

      // Move mouse away to reset hover before next card
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: 10,
        y: 10,
      });
      await client.evaluate(`
        (() => {
          const card = document.querySelectorAll('.metrics-grid .card-spotlight')[${i}];
          if (card) {
            card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
          }
        })()
      `);
      await sleep(200);
    }

    // Now test Mobile Viewport (390x844)
    console.log('\n--- Switching to Mobile Viewport (390x844) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(500);

    await client.evaluate(`document.querySelector('.metrics-grid').scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await sleep(300);

    const mobileScreenshot = path.join(ARTIFACT_DIR, 'kpi_cards_mobile_view.png');
    await client.captureScreenshot(mobileScreenshot);
    console.log(`Captured mobile screenshot at ${mobileScreenshot}`);

    // Verify reduced-motion emulation
    console.log('\n--- Verifying prefers-reduced-motion media feature ---');
    await client.send('Emulation.setEmulatedMedia', {
      media: '',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await sleep(300);

    const reducedMotionState = await client.evaluate(`
      (() => {
        const borderLayers = document.querySelectorAll('.metrics-grid .spotlight-border-layer');
        const surfaceLayers = document.querySelectorAll('.metrics-grid .spotlight-surface-layer');
        return {
          borderLayerCount: borderLayers.length,
          surfaceLayerCount: surfaceLayers.length,
          allHiddenOrDisplayNone: Array.from([...borderLayers, ...surfaceLayers]).every(el => window.getComputedStyle(el).display === 'none'),
        };
      })()
    `);
    console.log('Reduced Motion Verification:', reducedMotionState);

    console.log('\nAll Visual Spotlight Verification tasks executed successfully!');
    client.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
}

run();
