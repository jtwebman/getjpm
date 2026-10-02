// The Pages Function's request handling, with fetch and the static site mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counter, handle, installerFor, SCRIPTS_BASE } from '../functions/_middleware.js';

const SH = '#!/bin/sh\necho install jpm\n';
const PS1 = '# Install jpm: irm https://getjpm.sh/install.ps1 | iex\n';
const PAGE = '<!doctype html><title>jpm</title>';

function upstream(status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (status === 'throw') throw new TypeError('network down');
    const body = url.endsWith('install.ps1') ? PS1 : SH;
    return new Response(status === 200 ? body : 'Not Found', { status });
  };
  return { fetchImpl, calls };
}
const next = async () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
const req = (path, headers = {}, method = 'GET') => new Request(`https://getjpm.sh${path}`, { method, headers });

const BROWSER = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

test('curl gets install.sh at /', async () => {
  const { fetchImpl, calls } = upstream();
  const res = await handle(req('/', { 'user-agent': 'curl/8.7.1', accept: '*/*' }), next, fetchImpl);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  assert.equal(await res.text(), SH);
  assert.equal(calls[0].url, `${SCRIPTS_BASE}install.sh`);
  assert.deepEqual(calls[0].init.cf, { cacheTtl: 300, cacheEverything: true });
});

test('Wget gets install.sh at /', async () => {
  const res = await handle(req('/', { 'user-agent': 'Wget/1.21.4', accept: '*/*' }), next, upstream().fetchImpl);
  assert.equal(await res.text(), SH);
});

test('PowerShell gets install.ps1 at /', async () => {
  for (const ua of ['Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-US) WindowsPowerShell/5.1.26100.1', 'Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-US) PowerShell/7.5.0']) {
    const res = await handle(req('/', { 'user-agent': ua }), next, upstream().fetchImpl);
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(await res.text(), PS1, ua);
  }
});

test('a client that does not ask for HTML gets install.sh at /', async () => {
  const res = await handle(req('/', { 'user-agent': 'python-requests/2.32', accept: '*/*' }), next, upstream().fetchImpl);
  assert.equal(await res.text(), SH);
  const bare = await handle(req('/'), next, upstream().fetchImpl);
  assert.equal(await bare.text(), SH);
});

test('a browser gets the page at /, varying by User-Agent and Accept', async () => {
  const { fetchImpl, calls } = upstream();
  const res = await handle(req('/', BROWSER), next, fetchImpl);
  assert.equal(await res.text(), PAGE);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('vary'), 'User-Agent, Accept');
  assert.equal(calls.length, 0);
});

test('link-preview crawlers get the page at /', async () => {
  for (const ua of ['Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)', 'Twitterbot/1.0', 'facebookexternalhit/1.1']) {
    const res = await handle(req('/', { 'user-agent': ua, accept: '*/*' }), next, upstream().fetchImpl);
    assert.equal(await res.text(), PAGE, ua);
  }
});

test('/install.sh and /install.ps1 are scripts for every client, browsers too', async () => {
  for (const headers of [BROWSER, { 'user-agent': 'curl/8.7.1' }, { 'user-agent': 'WindowsPowerShell/5.1' }]) {
    const sh = await handle(req('/install.sh', headers), next, upstream().fetchImpl);
    assert.equal(sh.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(sh.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await sh.text(), SH);
    const ps1 = await handle(req('/install.ps1', headers), next, upstream().fetchImpl);
    assert.equal(ps1.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(await ps1.text(), PS1);
  }
});

test('HEAD returns the headers without a body', async () => {
  const res = await handle(req('/install.sh', {}, 'HEAD'), next, upstream().fetchImpl);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(await res.text(), '');
});

test('an upstream failure is a plain-text 502, never HTML', async () => {
  for (const status of [404, 500, 'throw']) {
    const res = await handle(req('/', { 'user-agent': 'curl/8.7.1' }), next, upstream(status).fetchImpl);
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.text();
    assert.match(body, /^jpm: could not fetch install\.sh/);
    assert.doesNotMatch(body, /</);
  }
});

test('other paths and methods pass through to the site', async () => {
  const { fetchImpl, calls } = upstream();
  for (const r of [req('/zh/', { 'user-agent': 'curl/8.7.1' }), req('/favicon.svg'), req('/', { 'user-agent': 'curl/8.7.1' }, 'POST')]) {
    assert.equal(await (await handle(r, next, fetchImpl)).text(), PAGE);
  }
  assert.equal(calls.length, 0);
});

test('installerFor', () => {
  const r = (headers) => installerFor(new Request('https://getjpm.sh/', { headers }));
  assert.equal(r({ 'user-agent': 'curl/7.81.0', accept: 'text/html' }), 'install.sh');
  assert.equal(r({ 'user-agent': 'Mozilla/5.0 WindowsPowerShell/5.1' }), 'install.ps1');
  assert.equal(r(BROWSER), null);
  assert.equal(r({ 'user-agent': 'Go-http-client/1.1' }), 'install.sh');
});

// Counting: one point per script handed out, holding only the script and the path.
function tally() {
  const points = [];
  return { points, count: (script, path) => points.push([script, path]) };
}

test('counts each script handed out, by script and path only', async () => {
  const { points, count } = tally();
  const curl = { 'user-agent': 'curl/8.7.1', accept: '*/*' };
  const ps = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26100; en-US) PowerShell/7.5.0' };
  await handle(req('/', curl), next, upstream().fetchImpl, count);
  await handle(req('/install.sh', curl), next, upstream().fetchImpl, count);
  await handle(req('/install.ps1', ps), next, upstream().fetchImpl, count);
  await handle(req('/', ps), next, upstream().fetchImpl, count);
  assert.deepEqual(points, [
    ['install.sh', '/'],
    ['install.sh', '/install.sh'],
    ['install.ps1', '/install.ps1'],
    ['install.ps1', '/'],
  ]);
});

test('does not count the page, a HEAD, or a script it could not fetch', async () => {
  const { points, count } = tally();
  await handle(req('/', BROWSER), next, upstream().fetchImpl, count);
  await handle(req('/install.sh', {}, 'HEAD'), next, upstream().fetchImpl, count);
  await handle(req('/install.sh'), next, upstream(404).fetchImpl, count);
  await handle(req('/install.sh'), next, upstream('throw').fetchImpl, count);
  await handle(req('/ja/', BROWSER), next, upstream().fetchImpl, count);
  assert.deepEqual(points, []);
});

test('a counter that throws never fails the install', async () => {
  const res = await handle(req('/install.sh'), next, upstream().fetchImpl, () => {
    throw new Error('analytics down');
  });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), SH);
});

test('the Analytics Engine point holds the script and path and nothing else', () => {
  const written = [];
  counter({ INSTALLS: { writeDataPoint: (p) => written.push(p) } })('install.sh', '/');
  assert.deepEqual(written, [{ blobs: ['install.sh', '/'], doubles: [1], indexes: ['install.sh'] }]);
  // No binding (local runs, previews): nothing to write, and no error.
  assert.doesNotThrow(() => counter({})('install.sh', '/'));
});
