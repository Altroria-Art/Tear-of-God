// Direct Chromium/CDP: no CUA runtime or downloaded browser dependency.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function chromium({ port = 9341 } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-browser-qa-'));
  const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${directory}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
  let info;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await delay(100); }
  }
  assert(info?.webSocketDebuggerUrl, 'Chromium started');
  const connections = [];
  async function connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    connections.push(ws);
    let serial = 0;
    const waiting = new Map();
    const handlers = new Map();
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = waiting.get(message.id); waiting.delete(message.id);
        if (message.error) pending?.reject(new Error(JSON.stringify(message.error)));
        else pending?.resolve(message.result);
      } else for (const handler of handlers.get(message.method) || []) handler(message.params);
    };
    return {
      send(method, params = {}) {
        return new Promise((resolve, reject) => {
          const id = ++serial; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
        });
      },
      on(event, handler) { handlers.set(event, [...(handlers.get(event) || []), handler]); },
    };
  }
  const root = await connect(info.webSocketDebuggerUrl);
  return {
    version: info.Browser,
    async page() {
      const { browserContextId } = await root.send('Target.createBrowserContext');
      const { targetId } = await root.send('Target.createTarget', { url: 'about:blank', browserContextId });
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const cdp = await connect(targets.find(item => item.id === targetId).webSocketDebuggerUrl);
      const errors = [];
      cdp.on('Runtime.exceptionThrown', details => errors.push(details.exceptionDetails.exception?.description || details.exceptionDetails.text));
      await cdp.send('Runtime.enable'); await cdp.send('Page.enable'); await cdp.send('Network.enable');
      await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      const evaluate = async expression => {
        const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result?.value;
      };
      const until = async (expression, label, timeout = 10000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (await evaluate(expression)) return Date.now() - start;
          await delay(100);
        }
        throw new Error(`Timed out: ${label}; URL ${await evaluate('location.href')}`);
      };
      return {
        ...cdp, evaluate, until, errors,
        async goto(url) { await cdp.send('Page.navigate', { url }); },
        async viewport(width, height = 900) {
          await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 640 });
        },
        async click(expression) {
          const point = await evaluate(`(() => { const element = (${expression}); if (!element) throw new Error('Click target missing'); element.scrollIntoView({block:'center',behavior:'instant'}); const r=element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
        },
        async field(selector, value) {
          await evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); if (!element) throw new Error('Missing input'); Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event('input',{bubbles:true})); })()`);
        },
        async screenshot(file) {
          const { data } = await cdp.send('Page.captureScreenshot', { captureBeyondViewport: false });
          fs.writeFileSync(file, Buffer.from(data, 'base64'));
        },
      };
    },
    async close() {
      // Browser owns only the unique temporary profile made by this helper.
      try { await root.send('Browser.close'); } catch { chrome.kill(); }
      for (const ws of connections) ws.close();
      await delay(250);
      assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
      assert(path.basename(directory).startsWith('tog-browser-qa-'));
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    },
  };
}
