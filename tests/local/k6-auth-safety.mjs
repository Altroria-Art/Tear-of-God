import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scenarioNames = ['load.js', 'smoke.js', 'soak.js', 'spike.js', 'stress.js'];
const mutationScenarioNames = ['load.js', 'soak.js', 'spike.js', 'stress.js'];
const config = await readFile(new URL('../config.js', import.meta.url), 'utf8');
const scenarios = Object.fromEntries(await Promise.all(scenarioNames.map(async (name) => [
  name,
  await readFile(new URL(`../scenarios/${name}`, import.meta.url), 'utf8'),
])));

assert.match(config, /PRODUCTION_HOSTNAMES/);
assert.match(config, /\.endsWith\('\.tear-of-god\.pages\.dev'\)/);
assert.match(config, /mutationFlag === 'true' && isProductionHostname/);
assert.match(config, /mutationFlag === 'true' && !isLoopbackHostname/);
assert.match(config, /export const MUTATIONS_ENABLED = mutationFlag === 'true'/);
assert.match(config, /if \(MUTATIONS_ENABLED\) results\.authSessions = createLocalAuthSessions\(runId\)/);
assert.match(config, /action: 'register'/);
assert.match(config, /action: 'login'/);
assert.match(config, /login\.cookies\.tog_session/);
assert.match(config, /http\.get\(`\$\{BASE_URL\}\/api\/auth`, \{ cookies: \{ tog_session: token \} \}\)/);
assert.match(config, /export function getMutationSession\(data\)/);
assert.match(config, /Mutation tests require exported setup\(\) and authenticated local sessions/);

for (const [name, source] of Object.entries(scenarios)) {
  assert.match(source, /export \{ setup \} from '\.\.\/config\.js';/, `${name} must export the k6 setup lifecycle`);
  assert.doesNotMatch(source, /import[^\n]*\bsetup\b[^\n]*from '\.\.\/config\.js'/, `${name} must not only import setup`);
}

for (const name of mutationScenarioNames) {
  const source = scenarios[name];
  assert.match(source, /MUTATIONS_ENABLED/, `${name} must guard mutations`);
  assert.match(source, /getMutationSession\(data\)/, `${name} must use a server-issued session`);
  assert.match(source, /cookies: session\.cookies/, `${name} must send the session cookie`);
  assert.doesNotMatch(source, /\buser_id\s*:/, `${name} must not authorize with client user_id`);
}

assert.doesNotMatch(scenarios['smoke.js'], /http\.(post|put|patch|del)\(/, 'smoke.js must remain read-only');

console.log('k6 lifecycle, local-only mutation guard, and session-auth static checks passed.');
