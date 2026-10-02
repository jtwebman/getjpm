// GET /api/installs and the install counter, with D1, fetch and the Cache API mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTS_SQL, handleInstalls, RELEASES_URL } from '../functions/api/installs.js';
import { COUNT_SQL, counter, handle } from '../functions/_middleware.js';

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

/**
 * D1, in memory: the `installs` table and the two statements the site runs (COUNT_SQL to add one,
 * COUNTS_SQL to total), checked by their text so a changed statement fails here. `fail` makes
 * every statement reject.
 */
function memoryD1({ rows = [], fail = false } = {}) {
  const table = new Map(rows.map((r) => [`${r.day}|${r.script}|${r.path}`, { ...r }]));
  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    run: async () => {
      if (fail) throw new Error('D1 down');
      assert.equal(sql, COUNT_SQL);
      const [day, script, path] = args;
      const key = `${day}|${script}|${path}`;
      const row = table.get(key) ?? { day, script, path, count: 0 };
      row.count += 1;
      table.set(key, row);
      return { success: true };
    },
    first: async () => {
      if (fail) throw new Error('D1 down');
      assert.equal(sql, COUNTS_SQL);
      const [since] = args;
      let total = 0;
      let recent = 0;
      for (const r of table.values()) {
        total += r.count;
        if (r.day >= since) recent += r.count;
      }
      return { total, recent };
    },
  });
  return { table, prepare: (sql) => statement(sql) };
}

const ROWS = [
  { day: '2026-08-01', script: 'install.sh', path: '/', count: 1000 },
  { day: '2026-09-15', script: 'install.sh', path: '/', count: 200 },
  { day: '2026-09-30', script: 'install.ps1', path: '/install.ps1', count: 34 },
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
const run = (up, { env = { DB: memoryD1({ rows: ROWS }) }, cache = memoryCache(), request = req() } = {}) =>
  handleInstalls(request, env, { fetchImpl: up.fetchImpl, cache, now: NOW });

test('the script counts, all told and in the last 30 days, and the binary downloads', async () => {
  const res = await run(upstream());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=3600');
  // 30 days up to 2026-10-01 starts on 2026-09-02: the August row counts only in the total.
  assert.deepEqual(await res.json(), { scripts: 1234, scripts30d: 234, binaryDownloads: 60, updated: '2026-10-01T12:00:00.000Z' });
});

test('an empty table is zero, and no releases are zero downloads', async () => {
  const res = await run(upstream({ github: [] }), { env: { DB: memoryD1() } });
  assert.deepEqual(await res.json(), { scripts: 0, scripts30d: 0, binaryDownloads: 0, updated: '2026-10-01T12:00:00.000Z' });
});

test('no D1 binding, or D1 failing, gives null script counts and a shorter cache', async () => {
  for (const env of [{}, { DB: memoryD1({ fail: true }) }]) {
    const res = await run(upstream(), { env });
    const body = await res.json();
    assert.equal(body.scripts, null);
    assert.equal(body.scripts30d, null);
    assert.equal(body.binaryDownloads, 60);
    assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  }
});

test('GitHub failing gives binaryDownloads null, and a shorter cache', async () => {
  for (const github of [403, 500, 'throw', { message: 'not a list' }]) {
    const res = await run(upstream({ github }));
    const body = await res.json();
    assert.equal(body.binaryDownloads, null, String(github));
    assert.equal(body.scripts, 1234);
    assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  }
});

test('nothing from upstream reaches the response: only the four fields', async () => {
  for (const github of [500, 'throw', RELEASES]) {
    const res = await run(upstream({ github }));
    assert.deepEqual(Object.keys(await res.json()), ['scripts', 'scripts30d', 'binaryDownloads', 'updated']);
    assert.equal(res.headers.get('x-upstream'), null);
  }
});

test('the answer is cached: one read per source, whatever the query string', async () => {
  const up = upstream();
  const cache = memoryCache();
  let reads = 0;
  const db = memoryD1({ rows: ROWS });
  const counting = { prepare: (sql) => (reads++, db.prepare(sql)) };
  const first = await (await run(up, { cache, env: { DB: counting } })).text();
  const second = await (await run(up, { cache, env: { DB: counting } })).text();
  const busted = await (await run(up, { cache, env: { DB: counting }, request: req('/api/installs?nocache=1') })).text();
  assert.equal(second, first);
  assert.equal(busted, first);
  assert.equal(reads, 1);
  assert.equal(up.calls.length, 1);
  assert.deepEqual([...cache.store.keys()], ['https://getjpm.sh/api/installs']);
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
  assert.equal((await res.json()).scripts, 1234);
});

test('the cache write can be left to waitUntil', async () => {
  const cache = memoryCache();
  const pending = [];
  const res = await handleInstalls(req(), { DB: memoryD1({ rows: ROWS }) }, { fetchImpl: upstream().fetchImpl, cache, now: NOW, waitUntil: (p) => pending.push(p) });
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

test('the counter adds one per day, script and path, after the response', async () => {
  const db = memoryD1();
  const pending = [];
  const count = counter({ DB: db }, (p) => pending.push(p), NOW);
  count('install.sh', '/');
  count('install.sh', '/');
  count('install.ps1', '/install.ps1');
  assert.equal(pending.length, 3, 'each write is left to waitUntil');
  await Promise.all(pending);
  assert.deepEqual([...db.table.values()], [
    { day: '2026-10-01', script: 'install.sh', path: '/', count: 2 },
    { day: '2026-10-01', script: 'install.ps1', path: '/install.ps1', count: 1 },
  ]);
});

test('a failed count is dropped, and no binding writes nothing', async () => {
  const pending = [];
  counter({ DB: memoryD1({ fail: true }) }, (p) => pending.push(p), NOW)('install.sh', '/');
  await assert.doesNotReject(Promise.all(pending));
  const none = [];
  assert.doesNotThrow(() => counter({}, (p) => none.push(p), NOW)('install.sh', '/'));
  assert.equal(none.length, 0);
});

test('/api/installs is not counted as an install, and passes through the middleware', async () => {
  const points = [];
  const scriptFetches = [];
  let passed = 0;
  const next = async () => {
    passed++;
    return Response.json({ scripts: 1, scripts30d: 1, binaryDownloads: 0, updated: NOW().toISOString() });
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
