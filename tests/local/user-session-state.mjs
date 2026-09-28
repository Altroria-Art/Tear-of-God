import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';

const output = new URL('./.user-session-state-audit.mjs', import.meta.url);
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalStorage = globalThis.localStorage;
const requests = [];
globalThis.window = new EventTarget();
globalThis.localStorage = { setItem() {}, removeItem() {} };
globalThis.fetch = (_url, options) => new Promise(resolve => requests.push({ resolve, method: options?.method || 'GET' }));
globalThis.__sessionAudit = { invalidations: 0, errors: 0 };
const stubs = {
  react: `const h = () => globalThis.__sessionHooks;
    export const createContext = () => ({ Provider: 'provider' });
    export const useContext = () => null;
    export const useState = initial => { const hooks=h(), i=hooks.index++; if(!(i in hooks.values)) hooks.values[i]=initial; return [hooks.values[i], value=>{hooks.values[i]=typeof value==='function'?value(hooks.values[i]):value;}]; };
    export const useRef = initial => { const hooks=h(), i=hooks.index++; return hooks.values[i] ||= {current:initial}; };
    export const useCallback = callback => callback;
    export const useMemo = factory => factory();
    export const useEffect = callback => { const hooks=h(), i=hooks.index++; if(!(i in hooks.values)){hooks.values[i]=true;hooks.effects.push(callback);} };`,
  '../lib/api': `export const invalidateSessionRequests = () => { globalThis.__sessionAudit.invalidations++; };`,
  '../components/ui/Toast': `export const useToast = () => ({error:()=>{globalThis.__sessionAudit.errors++;}});`,
  'react-i18next': `export const useTranslation = () => ({t:key=>key});`,
};
const bundled = await build({
  entryPoints: ['src/context/UserContext.jsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', write: false,
  plugins: [{ name: 'controlled-session-hooks', setup(ctx) {
    ctx.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'audit' } : undefined);
    ctx.onLoad({ filter: /.*/, namespace: 'audit' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
await writeFile(output, bundled.outputFiles[0].text);
try {
  const { UserProvider } = await import(output.href);
  const hooks = { index: 0, values: [], effects: [] };
  globalThis.__sessionHooks = hooks;
  const render = () => { hooks.index = 0; return UserProvider({ children: null }).props.value; };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const respond = async (index, user) => {
    requests[index].resolve(Response.json({ success: true, data: user }));
    await flush();
  };
  const storageEvent = () => {
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: 'tog-auth-change' });
    window.dispatchEvent(event);
  };
  let state = render();
  const cleanups = hooks.effects.map(effect => effect());
  assert.equal(requests.length, 1);
  state.login({ id: 'new-login' });
  await respond(0, { id: 'old-session' });
  assert.equal(render().currentUser.id, 'new-login', 'late initial restoration cannot overwrite login');

  storageEvent();
  assert.equal(render().currentUser, null, 'old account data hides during cross-tab restoration');
  assert.equal(render().isRestoring, true);
  storageEvent();
  await respond(2, { id: 'latest-account' });
  await respond(1, { id: 'previous-account' });
  assert.equal(render().currentUser.id, 'latest-account', 'older storage refresh cannot win');

  storageEvent();
  window.dispatchEvent(new Event('tog-session-expired'));
  await respond(3, { id: 'expired-account' });
  assert.equal(render().currentUser, null, 'expired session stays expired after old refresh completion');
  assert.equal(render().isRestoring, false);

  render().login({ id: 'logout-user' });
  storageEvent();
  const logout = render().logout();
  assert.equal(requests[5].method, 'POST');
  await respond(5, null);
  assert.equal(await logout, true);
  await respond(4, { id: 'logout-user' });
  assert.equal(render().currentUser, null, 'refresh started before logout cannot sign user back in');

  state = render();
  state.login({ id: 'still-signed-in' });
  const failedLogout = render().logout();
  requests[6].resolve(Response.json({ success: false }, { status: 503 }));
  assert.equal(await failedLogout, false);
  assert.equal(render().currentUser.id, 'still-signed-in', 'failed logout preserves current session');
  assert.equal(globalThis.__sessionAudit.errors, 1);
  assert.ok(globalThis.__sessionAudit.invalidations >= 8);
  cleanups.forEach(cleanup => cleanup?.());
  console.log('User session state passed: out-of-order restore, login/logout/expiry races, cross-tab isolation, failed logout.');
} finally {
  await unlink(output);
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.localStorage = originalStorage;
}
