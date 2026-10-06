// GET /api/installs: the public install count the home page shows, as JSON.
//
//   { "installs": 12, "updated": "2026-10-01T12:00:00.000Z" }
//
// installs is GitHub's own download count, over every release, of SHA256SUMS, which install.sh
// and install.ps1 fetch once a run to check the binary, and of jpm_*.deb, which apt fetches
// (getjpm.sh/apt redirects there). getjpm.sh counts nothing itself. Null on any error.
//
// The answer is cached at the edge for an hour (Cache API, keyed on the URL without its query),
// so visitors start at most one read of GitHub an hour per data center. Nothing from upstream is
// passed through: no error text, no headers.

export const RELEASES_URL = 'https://api.github.com/repos/jtwebman/jpm/releases?per_page=100';
export const MAX_AGE = 3600;
// When GitHub failed, try again sooner than an hour, still without asking it per visit.
export const RETRY_AGE = 300;
export const CACHE_SHAPE = 'installs-v3';

const count = (n) => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
};

const isInstall = (name) => name === 'SHA256SUMS' || /^jpm_.*\.deb$/.test(name);

/**
 * Installs (SHA256SUMS and .deb downloads) over every release, or null.
 * @param {typeof fetch} fetchImpl
 */
export async function releaseCounts(fetchImpl = fetch) {
  const none = { installs: null };
  try {
    const res = await fetchImpl(RELEASES_URL, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'getjpm.sh' },
    });
    if (!res.ok) return none;
    const releases = await res.json();
    if (!Array.isArray(releases)) return none;
    let installs = 0;
    for (const release of releases) {
      for (const asset of release?.assets ?? []) {
        if (typeof asset?.name === 'string' && isInstall(asset.name)) installs += count(asset.download_count) ?? 0;
      }
    }
    return { installs };
  } catch {
    return none;
  }
}

/**
 * The request handler, apart from Pages.
 * @param {Request} request
 * @param {object} _env
 * @param {{ fetchImpl?: typeof fetch, cache?: Cache, waitUntil?: (p: Promise<unknown>) => void, now?: () => Date }} [deps]
 */
export async function handleInstalls(request, _env, deps = {}) {
  const { fetchImpl = fetch, cache = globalThis.caches?.default, waitUntil, now = () => new Date() } = deps;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed\n', { status: 405, headers: { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' } });
  }
  // One cache entry, whatever the query string: ?anything cannot force a fresh read. The key
  // names the answer's shape, so a deploy that changes it never serves the old one.
  const url = new URL(request.url);
  const key = new Request(`${url.origin}${url.pathname}?shape=${CACHE_SHAPE}`, { method: 'GET' });
  const head = (res) => (request.method === 'HEAD' ? new Response(null, res) : res);

  try {
    const hit = await cache?.match(key);
    if (hit) return head(hit);
  } catch {
    // A cache that fails is a miss.
  }

  const at = now();
  const counts = await releaseCounts(fetchImpl);
  const body = JSON.stringify({ ...counts, updated: at.toISOString() });
  const maxAge = counts.installs === null ? RETRY_AGE : MAX_AGE;
  const response = new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}`,
      'x-content-type-options': 'nosniff',
    },
  });
  if (cache) {
    const put = cache.put(key, response.clone()).catch(() => {});
    if (waitUntil) waitUntil(put);
    else await put;
  }
  return head(response);
}

/** @type {PagesFunction} */
export const onRequest = (context) =>
  handleInstalls(context.request, context.env, { waitUntil: (p) => context.waitUntil(p) });
