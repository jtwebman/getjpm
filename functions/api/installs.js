// GET /api/installs: the public install count the home page shows, as JSON.
//
//   { "scripts": 1234, "scripts30d": 123, "binaryDownloads": 45, "updated": "2026-10-01T12:00:00.000Z" }
//
// - scripts, scripts30d: install scripts getjpm.sh handed out, all told and in the last 30 days,
//   from the D1 table functions/_middleware.js counts into (wrangler.toml's DB). Read through the
//   binding: no API token. Null without the binding or on any error.
// - binaryDownloads: GitHub's download count for jpm's release files named jpm-*; null on error.
//
// The answer is cached at the edge for an hour (Cache API, keyed on the URL without its query),
// so visitors start at most one pair of reads an hour per data center. Nothing from upstream is
// passed through: no error text, no headers.

export const COUNTS_SQL = `SELECT COALESCE(SUM(count), 0) AS total,
  COALESCE(SUM(CASE WHEN day >= ?1 THEN count ELSE 0 END), 0) AS recent
  FROM installs`;
export const RELEASES_URL = 'https://api.github.com/repos/jtwebman/jpm/releases?per_page=100';
export const MAX_AGE = 3600;
// When a source failed, try again sooner than an hour, still without asking upstream per visit.
export const RETRY_AGE = 300;

const count = (n) => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
};

/**
 * Install scripts handed out, all told and in the 30 days up to `now`, or nulls.
 * @param {{ DB?: D1Database }} env
 * @param {Date} now
 */
export async function scriptCounts(env, now) {
  if (!env.DB) return { scripts: null, scripts30d: null };
  try {
    const since = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
    const row = await env.DB.prepare(COUNTS_SQL).bind(since).first();
    return { scripts: count(row?.total), scripts30d: count(row?.recent) };
  } catch {
    return { scripts: null, scripts30d: null };
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
  // One cache entry, whatever the query string: ?anything cannot force a fresh read.
  const url = new URL(request.url);
  const key = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
  const head = (res) => (request.method === 'HEAD' ? new Response(null, res) : res);

  try {
    const hit = await cache?.match(key);
    if (hit) return head(hit);
  } catch {
    // A cache that fails is a miss.
  }

  const at = now();
  const [scripts, binaries] = await Promise.all([scriptCounts(env, at), binaryDownloads(fetchImpl)]);
  const body = JSON.stringify({ ...scripts, binaryDownloads: binaries, updated: at.toISOString() });
  const maxAge = scripts.scripts === null || binaries === null ? RETRY_AGE : MAX_AGE;
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
