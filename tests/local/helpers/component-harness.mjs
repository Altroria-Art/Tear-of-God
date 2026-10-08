// Executes the actual page and effects with controlled API completion order.
// Children are shallow elements; this checks behavior/structure, not browser pixels.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';

export async function mountPage(file, api, router = {}) {
  const source = await readFile(file, 'utf8');
  router.navigate ||= () => {};
  const state = { slots: [], index: 0, effects: [], dirty: false, disposed: false,
    api, router, user: null, errors: [], language: 'en' };
  globalThis.__pageHarness = state;
  globalThis.window = new EventTarget();
  const names = pattern => [...source.matchAll(pattern)].flatMap(match => match[1].split(',').map(name => name.trim().split(/\s+as\s+/)[0]).filter(Boolean));
  const apiNames = names(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/lib\/api['"]/g);
  const icons = names(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g);
  const stubs = {
    react: `import React from 'react'; export default React;
      const h=()=>globalThis.__pageHarness;
      const same=(a,b)=>a && b && a.length===b.length && a.every((v,i)=>Object.is(v,b[i]));
      export const useState=initial=>{const s=h(),i=s.index++;if(!(i in s.slots))s.slots[i]=typeof initial==='function'?initial():initial;return [s.slots[i],value=>{if(s.disposed)return;const next=typeof value==='function'?value(s.slots[i]):value;if(!Object.is(next,s.slots[i])){s.slots[i]=next;s.dirty=true;}}];};
      export const useRef=initial=>{const s=h(),i=s.index++;return s.slots[i] ||= {current:initial};};
      export const useMemo=(fn,deps)=>{const s=h(),i=s.index++,old=s.slots[i];if(!old || !same(old.deps,deps))s.slots[i]={deps,value:fn()};return s.slots[i].value;};
      export const useEffect=(fn,deps)=>{const s=h(),i=s.index++,old=s.slots[i];if(!old || !same(old.deps,deps)){s.slots[i]={deps,cleanup:old?.cleanup};s.effects.push(()=>{s.slots[i].cleanup?.();s.slots[i].cleanup=fn();});}};`,
    'react-router-dom': `const h=()=>globalThis.__pageHarness;
      export const Link='test-link';
      export const useParams=()=>h().router.routeParams || {};
      export const useLocation=()=>h().router.location;
      export const useNavigate=()=>h().router.navigate || (()=>{});
      export const useSearchParams=()=>[h().router.params || new URLSearchParams(),(value,options)=>{const s=h();s.router.params=typeof value==='function'?value(s.router.params):value;s.dirty=true;s.router.onParams?.(s.router.params,options);}];`,
    'react-i18next': `export const useTranslation=()=>({t:key=>key,i18n:{language:globalThis.__pageHarness.language}});`,
    '../context/UserContext': `export const useUser=()=>({currentUser:globalThis.__pageHarness.user,login:()=>{}});`,
    '../context/BookmarkContext': `export const useBookmarks=()=>({addSavedIds:()=>{}});`,
    '../components/ui/Toast': `export const useToast=()=>({error:message=>globalThis.__pageHarness.errors.push(message),success:()=>{}});`,
    '../lib/api': apiNames.map(name => `export const ${name}=(...args)=>globalThis.__pageHarness.api.${name}(...args);`).join('\n'),
    '../lib/analytics': `export const trackEvent=()=>{};`,
    '../i18n': `export default {language:'en',t:key=>key};`,
    'lucide-react': [...new Set(icons)].map(name => `export const ${name}='test-icon-${name}';`).join('\n'),
  };
  const result = await build({ entryPoints: [file], bundle: true, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', write: false,
    plugins: [{ name: 'controlled-page', setup(ctx) {
      ctx.onResolve({ filter: /.*/ }, args => {
        if (args.namespace === 'page-test' && args.path === 'react') return { path: 'react', external: true };
        if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'page-test' };
        if (args.path.startsWith('../components/')) return { path: args.path, namespace: 'page-child' };
      });
      ctx.onLoad({ filter: /.*/, namespace: 'page-test' }, args => ({ contents: stubs[args.path], loader: 'js' }));
      ctx.onLoad({ filter: /.*/, namespace: 'page-child' }, args => ({ contents: `export default ${JSON.stringify('test-' + args.path.split('/').at(-1))};`, loader: 'js' }));
    } }],
  });
  const directory = new URL('../../../.wrangler/component-tests/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const output = new URL(`${file.split('/').at(-1)}-${crypto.randomUUID()}.mjs`, directory);
  await writeFile(output, result.outputFiles[0].text);
  const { default: Page } = await import(output.href);
  const render = () => {
    state.index = 0; state.dirty = false; state.tree = Page();
    state.effects.splice(0).forEach(effect => effect());
    return state.tree;
  };
  const flush = async () => {
    for (let i = 0; i < 12; i++) { await Promise.resolve(); if (state.dirty) render(); }
    return state.tree;
  };
  render();
  return { state, render, flush, async dispose() {
    state.disposed = true;
    for (const slot of state.slots) slot?.cleanup?.();
    await unlink(output);
  } };
}
export function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [tree, ...elements(tree.props.children)];
}
export function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree?.props ? text(tree.props.children) : '';
}
