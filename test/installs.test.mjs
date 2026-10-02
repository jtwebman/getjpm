// GET /api/installs, with fetch and the Cache API mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTICS_SQL, handleInstalls, RELEASES_URL } from '../functions/api/installs.js';
import { handle } from '../functions/_middleware.js';

const ACCOUNT = '0123456789abcdef0123456789abcdef';
const TOKEN = 'secret-token-do-not-leak-4f9a';
const ENV = { CF_ACCOUNT_ID: ACCOUNT, CF_ANALYTICS_TOKEN: TOKEN };
const NOW = () => new Date('2026-10-01T12:00:00.000Z');

const RELEASES = [
  {
    tag_name: 'v0.2.0',
    assets: [
      { name: 'jpm-x86_64-unknown-linux-musl.tar.gz', download_count: 40 },
      { name: 'jpm-aarch64-apple-darwin.tar.gz', download_count: 12 },
      { name: 'SHA256SUMS', download_count: 300 },
    ],
  },
  { tag_name: 'v0.1.0', assets: [{ name: 'jpm-x86_64-pc-windows-msvc.zip', download_count: 8 }] },
];

/** fetch, answering Analytics Engine and GitHub as told: a body, a status, or 'throw'. */
function upstream({ analytics = { data: [{ fetched: '1234' }] }, github = RELEASES } = {}) {
  const calls = [];
  const answer = (spec) => {
    if (spec === 'throw') throw new TypeError('network down');
    if (typeof spec === 'number') return new Response(`upstream error, auth: Bearer ${TOKEN}`, { status: spec, headers: { 'x-upstream': TOKEN } });
    return Response.json(spec);
  };
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://api.cloudflare.com/')) return answer(analytics);
    if (String(url) === RELEASES_URL) return answer(github);
    throw new Error(`unexpected fetch ${url}`);
  };
  const analyticsCalls = () => calls.filter((c) => c.url.startsWith('https://api.cloudflare.com/'));
  const githubCalls = () => calls.filter((c) => c.url === RELEASES_URL);
  return { fetchImpl, calls, analyticsCalls, githubCalls };
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
const run = (up, { env = ENV, cache = memoryCache(), request = req() } = {}) =>
  handleInstalls(request, env, { fetchImpl: up.fetchImpl, cache, now: NOW });

test('both sources answer: the 30-day script count and the binary downloads', async () => {
  const up = upstream();
  const res = await run(up);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=3600');
  assert.deepEqual(await res.json(), { scripts30d: 1234, binaryDownloads: 60, updated: '2026-10-01T12:00:00.000Z' });

  const [a] = up.analyticsCalls();
  assert.equal(a.url, `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`);
  assert.equal(a.init.method, 'POST');
  assert.equal(a.init.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(a.init.body, ANALYTICS_SQL);
  assert.match(ANALYTICS_SQL, /SUM\(_sample_interval\)/);
  assert.match(ANALYTICS_SQL, /FROM getjpm_installs/);
  assert.match(ANALYTICS_SQL, /INTERVAL '30' DAY/);

  const [g] = up.githubCalls();
  assert.ok(g.init.headers['user-agent']);
  assert.equal(g.init.headers.authorization, undefined);
});

test('no releases and no points yet are zeros, not nulls', async () => {
  const res = await run(upstream({ analytics: { data: [] }, github: [] }));
  const body = await res.json();
  assert.equal(body.scripts30d, 0);
  assert.equal(body.binaryDownloads, 0);
  const nullSum = await run(upstream({ analytics: { data: [{ fetched: null }] } }));
  assert.equal((await nullSum.json()).scripts30d, 0);
});

test('Analytics Engine failing gives scripts30d null, and a shorter cache', async () => {
  for (const analytics of [401, 500, 'throw', { errors: ['bad'] }]) {
    const res = await run(upstream({ analytics }));
    const body = await res.json();
    assert.equal(body.scripts30d, null, String(analytics));
    assert.equal(body.binaryDownloads, 60);
    assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  }
});

test('GitHub failing gives binaryDownloads null', async () => {
  for (const github of [403, 500, 'throw', { message: 'rate limited' }]) {
    const res = await run(upstream({ github }));
    const body = await res.json();
    assert.equal(body.binaryDownloads, null, String(github));
    assert.equal(body.scripts30d, 1234);
  }
});

test('a missing token or account gives scripts30d null without asking Analytics Engine', async () => {
  for (const env of [{ CF_ACCOUNT_ID: ACCOUNT }, { CF_ANALYTICS_TOKEN: TOKEN }, {}, { CF_ACCOUNT_ID: '../x', CF_ANALYTICS_TOKEN: TOKEN }]) {
    const up = upstream();
    const body = await (await run(up, { env })).json();
    assert.equal(body.scripts30d, null);
    assert.equal(body.binaryDownloads, 60);
    assert.equal(up.analyticsCalls().length, 0);
  }
});

test('the answer is cached: one upstream query per source, whatever the query string', async () => {
  const up = upstream();
  const cache = memoryCache();
  const first = await (await run(up, { cache })).text();
  const second = await (await run(up, { cache })).text();
  const busted = await (await run(up, { cache, request: req('/api/installs?nocache=1') })).text();
  assert.equal(second, first);
  assert.equal(busted, first);
  assert.equal(up.analyticsCalls().length, 1);
  assert.equal(up.githubCalls().length, 1);
  assert.deepEqual([...cache.store.keys()], ['https://getjpm.sh/api/installs']);
  assert.equal(cache.store.get('https://getjpm.sh/api/installs').headers.get('cache-control'), 'public, max-age=3600');
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
  assert.equal((await res.json()).scripts30d, 1234);
});

test('the cache write can be left to waitUntil', async () => {
  const cache = memoryCache();
  const pending = [];
  const res = await handleInstalls(req(), ENV, { fetchImpl: upstream().fetchImpl, cache, now: NOW, waitUntil: (p) => pending.push(p) });
  assert.equal(res.status, 200);
  assert.equal(pending.length, 1);
  await Promise.all(pending);
  assert.equal(cache.store.size, 1);
});

test('the token never appears in a response, whatever upstream says', async () => {
  for (const spec of [{}, { analytics: 401 }, { analytics: 500, github: 500 }, { analytics: 'throw' }, { analytics: { data: [{ fetched: TOKEN }] } }]) {
    const res = await run(upstream(spec));
    const text = await res.text();
    assert.doesNotMatch(text, new RegExp(TOKEN), JSON.stringify(spec));
    for (const [name, value] of res.headers) {
      assert.ok(!value.includes(TOKEN), `header ${name}`);
    }
    assert.deepEqual(Object.keys(JSON.parse(text)), ['scripts30d', 'binaryDownloads', 'updated']);
  }
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

test('/api/installs is not counted as an install, and passes through the middleware', async () => {
  const points = [];
  const scriptFetches = [];
  let passed = 0;
  const next = async () => {
    passed++;
    return Response.json({ scripts30d: 1, binaryDownloads: 0, updated: NOW().toISOString() });
  };
  for (const headers of [{ 'user-agent': 'curl/8.7.1', accept: '*/*' }, { 'user-agent': 'Mozilla/5.0', accept: '*/*' }, {}]) {
    const res = await handle(new Request('https://getjpm.sh/api/installs', { headers }), next, async (url) => {
      scriptFetches.push(url);
      return new Response('#!/bin/sh\n');
    }, (script, path) => points.push([script, path]));
    assert.match(res.headers.get('content-type'), /application\/json/);
  }
  assert.equal(passed, 3);
  assert.deepEqual(points, []);
  assert.deepEqual(scriptFetches, []);
});
