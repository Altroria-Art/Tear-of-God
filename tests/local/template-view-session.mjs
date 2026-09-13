import assert from 'node:assert/strict';

import { createTemplateViewSessionGuard } from '../../src/lib/templateViewSession.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

const tabStorage = new MemoryStorage();
let requests = 0;
const record = (views) => async () => {
  requests += 1;
  return { success: true, counted: true, views };
};

const firstPageInstance = createTemplateViewSessionGuard({ getStorage: () => tabStorage });
const firstA = await firstPageInstance({ userId: 'user-1', templateId: 'template-a', record: record(10) });
assert.deepEqual(firstA, { success: true, counted: true, views: 10 });
assert.equal(requests, 1, 'first open of Template A must issue one request');

const duplicateA = await firstPageInstance({ userId: 'user-1', templateId: 'template-a', record: record(11) });
assert.deepEqual(duplicateA, { success: true, counted: false, views: 10 });
assert.equal(requests, 1, 'duplicate Template A open in the same tab must be suppressed');

await firstPageInstance({ userId: 'user-1', templateId: 'template-b', record: record(20) });
assert.equal(requests, 2, 'Template B must have an independent key');
await firstPageInstance({ userId: 'user-1', templateId: 'template-a', record: record(12) });
assert.equal(requests, 2, 'A -> B -> A must not issue a third request');

const refreshedPageInstance = createTemplateViewSessionGuard({ getStorage: () => tabStorage });
const refreshedA = await refreshedPageInstance({ userId: 'user-1', templateId: 'template-a', record: record(13) });
assert.deepEqual(refreshedA, { success: true, counted: false, views: 10 });
assert.equal(requests, 2, 'refresh in the same tab must reuse sessionStorage');

const newTabStorage = new MemoryStorage();
const newTabInstance = createTemplateViewSessionGuard({ getStorage: () => newTabStorage });
await newTabInstance({ userId: 'user-1', templateId: 'template-a', record: record(30) });
assert.equal(requests, 3, 'a new tab/session must be allowed to issue a view request');

await firstPageInstance({ userId: 'user-2', templateId: 'template-a', record: record(40) });
assert.equal(requests, 4, 'another user must have an independent key in the same tab');

let concurrentRequests = 0;
let releaseRequest;
const concurrentRecord = () => {
  concurrentRequests += 1;
  return new Promise((resolve) => {
    releaseRequest = () => resolve({ success: true, counted: true, views: 50 });
  });
};
const concurrentA = firstPageInstance({ userId: 'user-1', templateId: 'template-c', record: concurrentRecord });
const concurrentB = firstPageInstance({ userId: 'user-1', templateId: 'template-c', record: concurrentRecord });
await Promise.resolve();
assert.equal(concurrentRequests, 1, 'concurrent/Strict Mode calls must share one in-flight request');
releaseRequest();
assert.deepEqual(await Promise.all([concurrentA, concurrentB]), [
  { success: true, counted: true, views: 50 },
  { success: true, counted: true, views: 50 },
]);

let retryRequests = 0;
const failed = await firstPageInstance({
  userId: 'user-1',
  templateId: 'template-retry',
  record: async () => {
    retryRequests += 1;
    return { success: false, error: 'temporary failure' };
  },
});
assert.equal(failed.success, false);
await firstPageInstance({
  userId: 'user-1',
  templateId: 'template-retry',
  record: async () => {
    retryRequests += 1;
    return { success: true, counted: true, views: 60 };
  },
});
assert.equal(retryRequests, 2, 'failed requests must remain retryable');

let fallbackRequests = 0;
const unavailableStorageGuard = createTemplateViewSessionGuard({
  getStorage() {
    throw new Error('sessionStorage unavailable');
  },
});
await unavailableStorageGuard({
  userId: 'user-1',
  templateId: 'template-fallback',
  record: async () => {
    fallbackRequests += 1;
    return { success: true, counted: true, views: 70 };
  },
});
await unavailableStorageGuard({
  userId: 'user-1',
  templateId: 'template-fallback',
  record: async () => {
    fallbackRequests += 1;
    return { success: true, counted: false, views: 70 };
  },
});
assert.equal(fallbackRequests, 1, 'storage failure must fall back to in-memory deduplication');

console.log('Template view session deduplication checks passed.');
