// GET /api/installs: the public install count the home page shows, as JSON.
//
//   { "scripts30d": 123, "binaryDownloads": 45, "updated": "2026-10-01T12:00:00.000Z" }
//
// - scripts30d: install scripts getjpm.sh handed out in the last 30 days, from Workers Analytics
//   Engine (the points functions/_middleware.js writes). Needs wrangler.toml's CF_ACCOUNT_ID and
//   the secret CF_ANALYTICS_TOKEN ("Account Analytics: Read"); null without them or on any error.
// - binaryDownloads: GitHub's download count for jpm's release files named jpm-*; null on error.
//
// The answer is cached at the edge for an hour (Cache API, keyed on the URL without its query),
// so visitors start at most one pair of upstream queries an hour per data center. Nothing from
// upstream is passed through: no error text, no headers, and never the token.

export const ANALYTICS_SQL = `SELECT SUM(_sample_interval) AS fetched FROM getjpm_installs WHERE timestamp > NOW() - INTERVAL '30' DAY FORMAT JSON`;
export const RELEASES_URL = 'https://api.github.com/repos/jtwebman/jpm/releases?per_page=100';
export const MAX_AGE = 3600;
// When a source failed, try again sooner than an hour, still without asking upstream per visit.
export const RETRY_AGE = 300;

const count = (n) => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
};

/**
 * Install scripts handed out in the last 30 days, all scripts together, or null.
 * @param {{ CF_ACCOUNT_ID?: string, CF_ANALYTICS_TOKEN?: string }} env
 * @param {typeof fetch} fetchImpl
 */
export async function scripts30d(env, fetchImpl = fetch) {
  const account = env.CF_ACCOUNT_ID;
  const token = env.CF_ANALYTICS_TOKEN;
  if (!account || !token || !/^[0-9a-f]{32}$/i.test(account)) return null;
  try {
    const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: ANALYTICS_SQL,
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!Array.isArray(body?.data)) return null;
    // No points in the window: no row, or a row with a null sum. Both are zero.
    return count(body.data[0]?.fetched ?? 0);
  } catch {
    return null;
  }
}

/**
 * Downloads of jpm's binaries (release files named jpm-*), over every release, or null.
 * @param {typeof fetch} fetchImpl
 */
export async function binaryDownloads(fetchImpl = fetch) {
  try {
    const res = await fetchImpl(RELEASES_URL, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'getjpm.sh' },
    });
    if (!res.ok) return null;
    const releases = await res.json();
    if (!Array.isArray(releases)) return null;
    let sum = 0;
    for (const release of releases) {
      for (const asset of release?.assets ?? []) {
        if (typeof asset?.name === 'string' && asset.name.startsWith('jpm-')) sum += count(asset.download_count) ?? 0;
      }
    }
    return sum;
  } catch {
    return null;
  }
}

/**
 * The request handler, apart from Pages.
 * @param {Request} request
 * @param {object} env
 * @param {{ fetchImpl?: typeof fetch, cache?: Cache, waitUntil?: (p: Promise<unknown>) => void, now?: () => Date }} [deps]
 */
export async function handleInstalls(request, env, deps = {}) {
  const { fetchImpl = fetch, cache = globalThis.caches?.default, waitUntil, now = () => new Date() } = deps;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed\n', { status: 405, headers: { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' } });
  }
  // One cache entry, whatever the query string: ?anything cannot force an upstream query.
  const url = new URL(request.url);
  const key = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
  const head = (res) => (request.method === 'HEAD' ? new Response(null, res) : res);

  try {
    const hit = await cache?.match(key);
    if (hit) return head(hit);
  } catch {
    // A cache that fails is a miss.
  }

  const [scripts, binaries] = await Promise.all([scripts30d(env, fetchImpl), binaryDownloads(fetchImpl)]);
  const body = JSON.stringify({ scripts30d: scripts, binaryDownloads: binaries, updated: now().toISOString() });
  const maxAge = scripts === null || binaries === null ? RETRY_AGE : MAX_AGE;
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
