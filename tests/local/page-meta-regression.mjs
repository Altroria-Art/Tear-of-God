import assert from 'node:assert/strict';
import { serveAppWithMeta } from '../../functions/lib/page-meta.js';

const html = '<html><head><title>Original</title><meta name="description" content="Old"><link rel="canonical" href="old"></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const response = await serveAppWithMeta({
  request: new Request('https://example.test/post/1'),
  next: async () => new Response(html, { headers: { 'Content-Type': 'text/html', ETag: 'old', 'Content-Length': String(html.length) } }),
}, { title: '$& $$ $`', description: '$& $$ $` <img src=x onerror=alert(1)>', url: 'https://example.test/$&' });
const result = await response.text();
assert.ok(result.includes('<title>$&amp; $$ $` | Tear of God</title>'));
assert.ok(result.includes('content="$&amp; $$ $` &lt;img src=x onerror=alert(1)&gt;"'));
assert.ok(result.includes('href="https://example.test/$&amp;"'));
assert.equal((result.match(/<script /g) || []).length, 1, 'Replacement tokens cannot duplicate scripts/document');
assert.equal((result.match(/<head>/g) || []).length, 1);
assert.equal(response.headers.has('ETag'), false);
assert.equal(response.headers.has('Content-Length'), false);
console.log('Metadata safely preserves replacement tokens and escapes user text.');
