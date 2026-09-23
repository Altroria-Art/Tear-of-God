import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

console.log('Starting Chrome headless with CDP on port', PORT);
const chrome = spawn(CHROME_PATH, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=C:\\Users\\lenovo\\AppData\\Local\\Temp\\chrome-test-profile-' + Date.now(),
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
]);

chrome.on('error', (err) => {
  console.error('Failed to start Chrome:', err);
});

// Wait for port to be ready
let targets = null;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    if (res.ok) {
      targets = await res.json();
      break;
    }
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

if (!targets || targets.length === 0) {
  chrome.kill();
  throw new Error('Chrome did not become ready');
}

const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
console.log('Connected to target:', pageTarget.id);

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 1;
const pending = new Map();
function send(method, params = {}) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const consoleErrors = [];
const pageExceptions = [];
let mockApiSuccess = false;

ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(data.error);
    else resolve(data.result);
  } else if (data.method === 'Runtime.consoleAPICalled') {
    if (data.params.type === 'error') {
      const text = data.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
      consoleErrors.push(text);
      console.log('Browser Console Error:', text);
    }
  } else if (data.method === 'Runtime.exceptionThrown') {
    const desc = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text;
    pageExceptions.push(desc);
    console.error('Page Exception Thrown:', desc);
  } else if (data.method === 'Fetch.requestPaused') {
    const { requestId, request } = data.params;
    const url = request.url;

    if (!mockApiSuccess) {
      // Simulate unreachable server for initial "Try again" test
      await send('Fetch.failRequest', {
        requestId,
        errorReason: 'Failed',
      });
      return;
    }

    let bodyJson = { success: true, data: [] };
    if (url.includes('/api/auth')) {
      bodyJson = { success: true, data: null };
    } else if (url.includes('/api/rankings')) {
      bodyJson = { success: true, data: [], page: 1, limit: 12, total: 0 };
    } else if (url.includes('/api/spotlights')) {
      bodyJson = { success: true, data: { daily: null, weekly: null, freshness: {} } };
    } else if (url.includes('/api/bookmarks')) {
      bodyJson = { success: true, data: [] };
    }

    await send('Fetch.fulfillRequest', {
      requestId,
      responseCode: 200,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: '*' },
      ],
      body: Buffer.from(JSON.stringify(bodyJson)).toString('base64'),
    });
  }
};

await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');
await send('Fetch.enable', {
  patterns: [{ urlPattern: '*/api/*' }],
});

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

try {
  console.log('\n======================================================');
  console.log('Part A: Testing "Could not connect to server" & "Try again"');
  console.log('======================================================');
  mockApiSuccess = false;
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 2000));

  const hasRetryBtn = await evaluate(`
    !!Array.from(document.querySelectorAll('button')).find(b =>
      b.innerText.includes('Try again') || b.innerText.includes('ลองใหม่อีกครั้ง')
    )
  `);
  console.log('Server unreachable fallback rendered ("Try again" button exists):', hasRetryBtn);
  assert.equal(hasRetryBtn, true, 'Retry button should be displayed when server is unreachable');

  const initialErrorBoundary = await evaluate(`
    document.body.innerText.includes('เกิดข้อผิดพลาด') ||
    document.body.innerText.includes('Something went wrong')
  `);
  console.log('Initial ErrorBoundary present:', initialErrorBoundary);
  assert.equal(initialErrorBoundary, false, 'Initial page must not render ErrorBoundary');

  console.log('Clicking "Try again" button...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.innerText.includes('Try again') || b.innerText.includes('ลองใหม่อีกครั้ง')
    );
    if (btn) btn.click();
  `);
  await new Promise((r) => setTimeout(r, 1000));

  const retryErrorBoundary = await evaluate(`
    document.body.innerText.includes('เกิดข้อผิดพลาด') ||
    document.body.innerText.includes('Something went wrong')
  `);
  assert.equal(retryErrorBoundary, false, 'Clicking "Try again" must not throw ErrorBoundary');
  console.log('✔ Clicking "Try again" handled gracefully without ErrorBoundary!');

  console.log('\n======================================================');
  console.log('Part B: Testing Normal HomeFeed Flow (Opening "/", Tabs, Refresh, F5)');
  console.log('======================================================');
  // Enable API responses
  mockApiSuccess = true;
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 2000));

  // Verify HomeFeed mounted
  let tabButtonsExist = false;
  for (let i = 0; i < 20; i++) {
    tabButtonsExist = await evaluate('!!document.querySelector("button[aria-pressed]")');
    if (tabButtonsExist) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log('HomeFeed Tab navigation capsule exists:', tabButtonsExist);
  assert.equal(tabButtonsExist, true, 'Tab navigation capsule must be rendered on /');

  // Verify allSeen empty state rendered
  const bodyText = await evaluate('document.body.innerText');
  console.log('Checking for "ดูครบแล้ว" or "You\'re all caught up"...');
  const hasAllSeen = bodyText.includes('ดูครบแล้ว') || bodyText.includes("You're all caught up");
  console.log('Has allSeen empty state text:', hasAllSeen);
  assert.equal(hasAllSeen, true, 'Trending empty state must display allSeen');

  console.log('\n--- Step 1: Clicking "Home" navigation link ---');
  await evaluate(`
    const homeLink = Array.from(document.querySelectorAll('a')).find(a =>
      a.href.endsWith('/') || a.innerText.includes('Home') || a.innerText.includes('Tear of God')
    );
    if (homeLink) homeLink.click();
  `);
  await new Promise((r) => setTimeout(r, 1000));

  const homeClickError = await evaluate(`
    document.body.innerText.includes('เกิดข้อผิดพลาด') ||
    document.body.innerText.includes('Something went wrong')
  `);
  assert.equal(homeClickError, false, 'Clicking Home must not crash');
  console.log('✔ Clicking Home succeeded without error');

  console.log('\n--- Step 2: Clicking "Trending" tab ---');
  const trendingBtnFound = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const trendingBtn = buttons.find(b =>
      b.innerText.includes('กำลังมาแรง') || b.innerText.includes('Trending')
    );
    if (trendingBtn) {
      trendingBtn.click();
      return true;
    }
    return false;
  })()`);
  console.log('Trending tab button clicked:', trendingBtnFound);
  assert.equal(trendingBtnFound, true, 'Trending button must exist and be clicked');
  await new Promise((r) => setTimeout(r, 1000));

  const trendingClickError = await evaluate(`
    document.body.innerText.includes('เกิดข้อผิดพลาด') ||
    document.body.innerText.includes('Something went wrong')
  `);
  assert.equal(trendingClickError, false, 'Clicking Trending tab must not crash');
  console.log('✔ Clicking Trending tab succeeded without error');

  console.log('\n--- Step 3: Clicking "รีเฟรชฟีด" / "Refresh feed" on allSeen card ---');
  const refreshBtnFound = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const refBtn = buttons.find(b =>
      b.innerText.includes('รีเฟรชฟีด') || b.innerText.includes('Refresh feed')
    );
    if (refBtn) {
      refBtn.click();
      return true;
    }
    return false;
  })()`);
  console.log('Refresh button clicked:', refreshBtnFound);
  assert.equal(refreshBtnFound, true, 'Refresh feed button must exist on allSeen card');
  await new Promise((r) => setTimeout(r, 1000));

  const refreshClickError = await evaluate(`
    document.body.innerText.includes('เกิดข้อผิดพลาด') ||
    document.body.innerText.includes('Something went wrong')
  `);
  assert.equal(refreshClickError, false, 'Clicking Refresh feed must not crash');
  console.log('✔ Clicking Refresh feed succeeded without error');

  console.log('\n--- Step 4: F5 / Page Reload ---');
  await send('Page.reload');
  await new Promise((r) => setTimeout(r, 2000));

  let reloadedTabs = false;
  for (let i = 0; i < 20; i++) {
    reloadedTabs = await evaluate('!!document.querySelector("button[aria-pressed]")');
    if (reloadedTabs) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.equal(reloadedTabs, true, 'After F5 reload, HomeFeed must re-render tabs');

  const afterF5Error = await evaluate(`
    document.body.innerText.includes('เกิดข้อผิดพลาด') ||
    document.body.innerText.includes('Something went wrong')
  `);
  assert.equal(afterF5Error, false, 'After F5 reload, must not crash');
  console.log('✔ F5 / Page reload succeeded without error');

  // Check that NO TDZ or ReferenceError occurred
  const tdzErrors = pageExceptions.filter((e) =>
    e.includes('Cannot access') || e.includes('before initialization')
  );
  assert.equal(tdzErrors.length, 0, `No initialization errors permitted: ${tdzErrors.join(', ')}`);

  console.log('\n======================================================');
  console.log('ALL HOME PAGE BROWSER TESTS PASSED (0 ERRORS, 0 CRASHES)!');
  console.log('======================================================');
} finally {
  ws.close();
  chrome.kill();
}
