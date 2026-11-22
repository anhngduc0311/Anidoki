import test from 'node:test';
import assert from 'node:assert/strict';
import { AniDokiAPI, fetchPublicCatalog } from './api.js';

test('public catalog uses an anonymous Worker request when the site API is unreachable', async t => {
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin: 'https://anidoki.com' },
  });
  t.after(() => {
    if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
    else delete globalThis.location;
  });

  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) throw new TypeError('Failed to fetch');
    return Response.json({ success: true, data: [{ id: 'example' }] });
  });

  const response = await fetchPublicCatalog('/api/anime/spotlight');
  assert.equal((await response.json()).data[0].id, 'example');
  assert.equal(calls[0].url, '/api/anime/spotlight');
  assert.equal(calls[1].url, 'https://anidoki-web.akzan0311.workers.dev/api/anime/spotlight');
  assert.equal(calls[1].options.credentials, 'omit');
});

test('browse reuses identical filters but refetches after expiry or filter changes', async t => {
  let now = 0;
  const calls = [];
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ success: true, data: [{ id: 'example' }] }) };
  });
  const controller = new AbortController();
  await AniDokiAPI.getBrowse({ sort: 'updated', page: 1 }, { signal: controller.signal });
  await AniDokiAPI.getBrowse({ page: 1, sort: 'updated' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.signal, controller.signal);
  await AniDokiAPI.getBrowse({ page: 2, sort: 'updated' });
  assert.equal(calls.length, 2);
  now = 60001;
  await AniDokiAPI.getBrowse({ page: 1, sort: 'updated' });
  assert.equal(calls.length, 3);
});

test('aborted browse requests are not cached', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 1) throw new DOMException('Cancelled', 'AbortError');
    return { ok: true, json: async () => ({ success: true, data: [] }) };
  });
  await assert.rejects(AniDokiAPI.getBrowse({ q: 'cancelled' }), { name: 'AbortError' });
  await AniDokiAPI.getBrowse({ q: 'cancelled' });
  assert.equal(calls, 2);
});
