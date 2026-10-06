// GET /api/installs, with fetch and the Cache API mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleInstalls, RELEASES_URL } from '../functions/api/installs.js';

const NOW = () => new Date('2026-10-01T12:00:00.000Z');

const RELEASES = [
  {
    tag_name: 'v1.0.1',
    assets: [
      { name: 'jpm-linux-x64', download_count: 40 },
      { name: 'jpm-darwin-arm64', download_count: 12 },
      { name: 'jpm_1.0.1_amd64.deb', download_count: 5 },
      { name: 'install.sh', download_count: 3 },
      { name: 'SHA256SUMS', download_count: 30 },
    ],
  },
  { tag_name: 'v1.0.0', assets: [{ name: 'jpm-windows-x64.exe', download_count: 8 }, { name: 'SHA256SUMS', download_count: 7 }] },
];

/** fetch, answering GitHub as told: a body, a status, or 'throw'. */
function upstream({ github = RELEASES } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url) !== RELEASES_URL) throw new Error(`unexpected fetch ${url}`);
    if (github === 'throw') throw new TypeError('network down');
    if (typeof github === 'number') return new Response('upstream error', { status: github });
    return Response.json(github);
  };
  return { fetchImpl, calls };
}

/** caches.default, in memory, keyed on the request URL. */
function memoryCache() {
  const store = new Map();
  return {
    store,
    match: async (req) => store.get(req.url)?.clone(),
    put: async (req, res) => {
      store.set(req.url, res);
    },
  };
}

const req = (path = '/api/installs', method = 'GET') => new Request(`https://getjpm.sh${path}`, { method });
const run = (up, { cache = memoryCache(), request = req() } = {}) =>
  handleInstalls(request, {}, { fetchImpl: up.fetchImpl, cache, now: NOW });

test('installs are SHA256SUMS and .deb downloads; binary downloads the jpm-* files', async () => {
  const res = await run(upstream());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=3600');
  // install.sh downloaded from the release page is neither: running it fetches SHA256SUMS.
  assert.deepEqual(await res.json(), { installs: 42, binaryDownloads: 60, updated: '2026-10-01T12:00:00.000Z' });
});

test('no releases are zero of each', async () => {
  const res = await run(upstream({ github: [] }));
  assert.deepEqual(await res.json(), { installs: 0, binaryDownloads: 0, updated: '2026-10-01T12:00:00.000Z' });
});

test('GitHub failing gives nulls, and a shorter cache', async () => {
  for (const github of [403, 500, 'throw', { message: 'not a list' }]) {
    const res = await run(upstream({ github }));
    const body = await res.json();
    assert.equal(body.installs, null, String(github));
    assert.equal(body.binaryDownloads, null, String(github));
    assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  }
});

test('nothing from upstream reaches the response: only the three fields', async () => {
  for (const github of [500, 'throw', RELEASES]) {
    const res = await run(upstream({ github }));
    assert.deepEqual(Object.keys(await res.json()), ['installs', 'binaryDownloads', 'updated']);
    assert.equal(res.headers.get('x-upstream'), null);
  }
});

test('the answer is cached: one read of GitHub, whatever the query string', async () => {
  const up = upstream();
  const cache = memoryCache();
  const first = await (await run(up, { cache })).text();
  const second = await (await run(up, { cache })).text();
  const busted = await (await run(up, { cache, request: req('/api/installs?nocache=1') })).text();
  assert.equal(second, first);
  assert.equal(busted, first);
  assert.equal(up.calls.length, 1);
  assert.deepEqual([...cache.store.keys()], ['https://getjpm.sh/api/installs?shape=installs-v2']);
});

test('a cache that throws is a miss, not an error', async () => {
  const cache = {
    match: async () => {
      throw new Error('cache down');
    },
    put: async () => {
      throw new Error('cache down');
    },
  };
  const res = await run(upstream(), { cache });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).installs, 42);
});

test('the cache write can be left to waitUntil', async () => {
  const cache = memoryCache();
  const pending = [];
  const res = await handleInstalls(req(), {}, { fetchImpl: upstream().fetchImpl, cache, now: NOW, waitUntil: (p) => pending.push(p) });
  assert.equal(res.status, 200);
  assert.equal(pending.length, 1);
  await Promise.all(pending);
  assert.equal(cache.store.size, 1);
});

test('HEAD has the headers and no body; other methods are refused', async () => {
  const head = await run(upstream(), { request: req('/api/installs', 'HEAD') });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(await head.text(), '');
  const up = upstream();
  const post = await run(up, { request: req('/api/installs', 'POST') });
  assert.equal(post.status, 405);
  assert.equal(up.calls.length, 0);
});
