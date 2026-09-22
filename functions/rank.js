import { serveAppWithMeta } from './lib/page-meta.js';

export async function onRequestGet(context) {
  return serveAppWithMeta(context);
}