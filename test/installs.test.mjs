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

test('installs are SHA256SUMS and .deb downloads', async () => {
  const res = await run(upstream());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=60');
  // Neither the binaries nor install.sh from the release page: running the script fetches SHA256SUMS.
  assert.deepEqual(await res.json(), { installs: 42, updated: '2026-10-01T12:00:00.000Z' });
});

test('no releases are zero installs', async () => {
  const res = await run(upstream({ github: [] }));
  assert.deepEqual(await res.json(), { installs: 0, updated: '2026-10-01T12:00:00.000Z' });
});

test('GitHub failing, with nothing saved, gives null', async () => {
  for (const github of [403, 500, 'throw', { message: 'not a list' }]) {
    const res = await run(upstream({ github }));
    assert.equal((await res.json()).installs, null, String(github));
  }
});

/** A KV namespace, in memory. */
function memoryKV() {
  const store = new Map();
  return {
    store,
    get: async (key) => (store.has(key) ? JSON.parse(store.get(key)) : null),
    put: async (key, value) => {
      store.set(key, value);
    },
  };
}

test('KV: GitHub is asked once per 10 minutes across data centers, and a failure keeps the last count', async () => {
  const INSTALLS = memoryKV();
  let github = RELEASES;
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return typeof github === 'number' ? new Response('', { status: github }) : Response.json(github);
  };
  // Each call has its own empty cache, as a request in another data center would.
  const at = (min) => async () => (await handleInstalls(req(), { INSTALLS }, { fetchImpl, cache: memoryCache(), now: () => new Date(Date.UTC(2026, 9, 1, 12, min)) })).json();

  assert.deepEqual(await at(0)(), { installs: 42, updated: '2026-10-01T12:00:00.000Z' });
  github = 403;
  assert.equal((await at(9)()).installs, 42);
  assert.equal(calls, 1);
  assert.deepEqual(await at(10)(), { installs: 42, updated: '2026-10-01T12:00:00.000Z' });
  assert.equal(calls, 2);
  assert.equal((await at(19)()).installs, 42);
  assert.equal(calls, 2);
  github = RELEASES;
  assert.deepEqual(await at(20)(), { installs: 42, updated: '2026-10-01T12:20:00.000Z' });
  assert.equal(calls, 3);
});

test('nothing from upstream reaches the response: only the two fields', async () => {
  for (const github of [500, 'throw', RELEASES]) {
    const res = await run(upstream({ github }));
    assert.deepEqual(Object.keys(await res.json()), ['installs', 'updated']);
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
  assert.deepEqual([...cache.store.keys()], ['https://getjpm.sh/api/installs?shape=installs-v4']);
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

test('sends GITHUB_TOKEN to GitHub when set, and nothing when not', async () => {
  const seen = [];
  const fetchImpl = async (_url, init) => {
    seen.push(init.headers.authorization);
    return Response.json(RELEASES);
  };
  await handleInstalls(req(), { GITHUB_TOKEN: 't0k' }, { fetchImpl, cache: undefined, now: NOW });
  await handleInstalls(req(), {}, { fetchImpl, cache: undefined, now: NOW });
  assert.deepEqual(seen, ['Bearer t0k', undefined]);
});
