import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';

// Execute the actual provider with deterministic hooks/network completion order.
const output = new URL('./.bookmark-state-audit.mjs', import.meta.url);
const requests = [];
const events = [];
globalThis.window = new EventTarget();
window.addEventListener('tog-bookmark', event => events.push(event.detail));
globalThis.__bookmarkAudit = {
  user: { id: 'a' },
  read: () => new Promise(resolve => requests.push({ type: 'read', resolve })),
  save: () => new Promise(resolve => requests.push({ type: 'save', resolve })),
  toast: { success() {}, error() {} },
};
const stubs = {
  react: `const h = () => globalThis.__bookmarkHooks;
    export const createContext = () => ({ Provider: 'provider' });
    export const useContext = () => null;
    export const useState = initial => { const hooks=h(), i=hooks.index++; if(!(i in hooks.values)) hooks.values[i]=typeof initial==='function'?initial():initial; return [hooks.values[i], value=>{hooks.values[i]=typeof value==='function'?value(hooks.values[i]):value;}]; };
    export const useRef = initial => { const hooks=h(), i=hooks.index++; return hooks.values[i] ||= {current:initial}; };
    export const useCallback = callback => callback;
    export const useEffect = callback => { const hooks=h(), i=hooks.index++; if(!(i in hooks.values)){hooks.values[i]=true;hooks.effects.push(callback);} };`,
  './UserContext': `export const useUser = () => ({currentUser:globalThis.__bookmarkAudit.user});`,
  '../lib/api': `export const fetchBookmarkedTemplateIds = (...args) => globalThis.__bookmarkAudit.read(...args); export const saveTemplate = (...args) => globalThis.__bookmarkAudit.save(...args);`,
  '../components/ui/Toast': `export const useToast = () => globalThis.__bookmarkAudit.toast;`,
  'react-i18next': `export const useTranslation = () => ({ t:key=>key });`,
};
const bundled = await build({ entryPoints: ['src/context/BookmarkContext.jsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', write: false,
  plugins: [{ name: 'controlled-hooks', setup(ctx) {
    ctx.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'audit' } : undefined);
    ctx.onLoad({ filter: /.*/, namespace: 'audit' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
await writeFile(output, bundled.outputFiles[0].text);
try {
  const { BookmarkProvider } = await import(output.href);
  const element = BookmarkProvider({ children: null });
  const hooks = { index: 0, values: [], effects: [] };
  globalThis.__bookmarkHooks = hooks;
  const render = () => { hooks.index = 0; return element.type(element.props).props.value; };
  let state = render();
  const cleanups = hooks.effects.map(effect => effect());
  const save = state.toggleBookmark('template', false);
  assert.equal((await state.toggleBookmark('template', false)).pending, true);
  assert.equal(requests.filter(request => request.type === 'save').length, 1, 'Two card buttons issue only one mutation');
  requests[1].resolve({ success: true });
  await save;
  requests[0].resolve([]); // Stale initial read arrives AFTER the successful save.
  await Promise.resolve();
  state = render();
  assert.equal(state.isSaved('template'), true, 'Initial read must not erase a more recent save');
  assert.equal(events.length, 1);
  const unsave = state.toggleBookmark('template', true);
  requests[2].resolve({ success: false, error: 'unavailable' });
  await unsave;
  state = render();
  assert.equal(state.isSaved('template'), true, 'Failed unsave restores saved state');
  assert.equal(events.length, 1, 'Failed unsave must not remove a saved-list card');
  const late = state.toggleBookmark('template', true);
  cleanups.forEach(cleanup => cleanup?.()); // Logout/key change unmounts the old identity.
  requests[3].resolve({ success: true });
  await late;
  assert.equal(events.length, 1, 'Old identity must not publish completion events into the new session');
  globalThis.__bookmarkAudit.user = { id: 'b' };
  assert.notEqual(BookmarkProvider({children:null}).key, element.key);
  console.log('Bookmark duplicate mutations, stale reads, rollback and account isolation passed.');
} finally { await unlink(output); }
