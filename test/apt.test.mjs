// /apt/: jpm's apt repository, with fetch and the static site mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, APT_BASE } from '../functions/_middleware.js';

const next = async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
const req = (path, method = 'GET') => new Request(`https://getjpm.sh${path}`, { method, headers: { 'user-agent': 'Debian APT-HTTP/1.3 (2.7.14)' } });

function upstream(status = 200, body = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff])) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (status === 'throw') throw new TypeError('network down');
    return new Response(status === 200 ? body : 'Not Found', { status });
  };
  return { fetchImpl, calls };
}

test('a package is sent to the release .deb', async () => {
  const { fetchImpl, calls } = upstream();
  const res = await handle(req('/apt/pool/main/j/jpm/jpm_1.0.1_amd64.deb'), next, fetchImpl);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://github.com/jtwebman/jpm/releases/download/v1.0.1/jpm_1.0.1_amd64.deb');
  assert.equal(calls.length, 0);
  const rc = await handle(req('/apt/pool/main/j/jpm/jpm_1.1.0-rc.1_armhf.deb'), next, fetchImpl);
  assert.equal(rc.headers.get('location'), 'https://github.com/jtwebman/jpm/releases/download/v1.1.0-rc.1/jpm_1.1.0-rc.1_armhf.deb');
});

test('the index is fetched from the apt branch byte for byte', async () => {
  const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff, 0x00, 0x0a]);
  const { fetchImpl, calls } = upstream(200, bytes);
  const res = await handle(req('/apt/dists/stable/main/binary-arm64/Packages.gz'), next, fetchImpl);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/gzip');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), bytes);
  assert.equal(calls[0].url, `${APT_BASE}dists/stable/main/binary-arm64/Packages.gz`);
  for (const file of ['jpm.gpg', 'jpm.asc', 'dists/stable/InRelease', 'dists/stable/Release', 'dists/stable/Release.gpg']) {
    assert.equal((await handle(req(`/apt/${file}`), next, fetchImpl)).status, 200, file);
  }
  assert.equal((await handle(req('/apt/jpm.gpg'), next, fetchImpl)).headers.get('content-type'), 'application/pgp-keys');
});

test('nothing else of the branch is served, and nothing else is fetched', async () => {
  const { fetchImpl, calls } = upstream();
  for (const path of ['/apt', '/apt/', '/apt/README.md', '/apt/dists/stable/main/binary-amd64/Packages.xz', '/apt/..%2fmain%2finstall.sh', '/apt/pool/main/j/jpm/evil_1.0.0_amd64.deb', '/apt/pool/main/j/jpm/jpm_1.0.0_i386.deb']) {
    const res = await handle(req(path), next, fetchImpl);
    assert.equal(res.status, 404, path);
    assert.match(res.headers.get('content-type'), /^text\/plain/, path);
  }
  assert.equal(calls.length, 0);
});

test('GitHub failing is a plain-text 502, and a missing index file a 404', async () => {
  const down = await handle(req('/apt/dists/stable/InRelease'), next, upstream('throw').fetchImpl);
  assert.equal(down.status, 502);
  assert.match(await down.text(), /could not fetch dists\/stable\/InRelease/);
  const missing = await handle(req('/apt/dists/stable/InRelease'), next, upstream(404).fetchImpl);
  assert.equal(missing.status, 404);
});

test('HEAD gets the headers and no body', async () => {
  const res = await handle(req('/apt/jpm.asc', 'HEAD'), next, upstream(200, new TextEncoder().encode('-----BEGIN')).fetchImpl);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(await res.text(), '');
});
