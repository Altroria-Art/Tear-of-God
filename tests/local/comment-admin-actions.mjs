import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'comment-actions', 'entry.jsx');
const out = join(here, '.comment-actions-bundled.mjs');

function stubPlugin(stubPath, specifier) {
  return {
    name: `stub-${specifier}`,
    setup(ctx) {
      ctx.onResolve({ filter: new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }, () => ({ path: stubPath }));
    },
  };
}

const stubs = {
  'react-i18next': join(here, 'comment-actions', 'i18next-stub.js'),
  '../../context/UserContext': join(here, 'comment-actions', 'user-context-stub.js'),
  '../../lib/format': join(here, 'comment-actions', 'format-stub.js'),
};

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  jsx: 'automatic',
  plugins: Object.entries(stubs).map(([specifier, path]) => stubPlugin(path, specifier)),
});

writeFileSync(out, result.outputFiles[0].text);
try {
  const { run } = await import(`${pathToFileURL(out).href}?t=${Date.now()}`);
  const actions = run();

  const assertCase = (name, { report, delete: del }) => {
    assert.equal(actions[name].report, report, `${name}: report button presence`);
    assert.equal(actions[name].delete, del, `${name}: delete button presence`);
  };

  // Admin sees ONLY Delete, never Report, on any comment (own or another user's).
  assertCase('adminOnOther', { report: false, delete: true });
  assertCase('adminOnOwn', { report: false, delete: true });
  // Owner of the comment can still delete it (no Report on their own comment).
  assertCase('ownerOnOwn', { report: false, delete: true });
  // Normal user on someone else's comment keeps Report and never Delete.
  assertCase('normalOnOther', { report: true, delete: false });
  // Guest sees no actions at all.
  assertCase('guest', { report: false, delete: false });

  console.log('Comment admin actions UI checks passed (admin / owner / normal user / guest).');
} finally {
  rmSync(out, { force: true });
}