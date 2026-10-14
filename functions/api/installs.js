// GET /api/installs: the public install count the home page shows, as JSON.
//
//   { "installs": 12, "updated": "2026-10-01T12:00:00.000Z" }
//
// installs is GitHub's own download count, over every release, of SHA256SUMS, which install.sh
// and install.ps1 fetch once a run to check the binary, and of jpm_*.deb, which apt fetches
// (getjpm.sh/apt redirects there). getjpm.sh counts nothing itself. Null only when GitHub has
// never answered.
//
// GitHub is asked at most once every 10 minutes across all data centers: the last count and when
// GitHub was last asked are kept in the INSTALLS KV namespace, which every data center shares.
// When GitHub fails, the last good count is served and GitHub is not asked again for 10 minutes.
// In front of KV, each data center keeps the answer for a minute (Cache API, keyed on the URL
// without its query), so visitors don't each read KV. Nothing from upstream is passed through: no
// error text, no headers.
//
// Without a token GitHub allows 60 reads an hour per IP, and Cloudflare's egress IPs are shared
// with everyone else's Workers, so that budget is usually gone. Set the GITHUB_TOKEN secret (a
// fine-grained token with no permissions is enough to read a public repo) for 5,000 an hour:
//   jpx wrangler pages secret put GITHUB_TOKEN --project-name getjpm

export const RELEASES_URL = 'https://api.github.com/repos/jtwebman/jpm/releases?per_page=100';
// How long one answer from GitHub lasts, for every data center.
export const FRESH_MS = 10 * 60 * 1000;
// How long each data center, and each browser, keeps the answer before reading KV again.
export const MAX_AGE = 60;
export const KV_KEY = 'installs';
export const CACHE_SHAPE = 'installs-v4';

const count = (n) => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
};

const isInstall = (name) => name === 'SHA256SUMS' || /^jpm_.*\.deb$/.test(name);

/**
 * Installs (SHA256SUMS and .deb downloads) over every release, or null.
 * @param {typeof fetch} fetchImpl
 * @param {string} [token] GitHub token, for its own rate limit instead of the shared IP's.
 */
export async function releaseCounts(fetchImpl = fetch, token) {
  const none = { installs: null };
  try {
    const headers = { accept: 'application/vnd.github+json', 'user-agent': 'getjpm.sh' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetchImpl(RELEASES_URL, { headers });
    if (!res.ok) {
      console.log(`GitHub releases: ${res.status}, rate limit remaining ${res.headers.get('x-ratelimit-remaining')}`);
      return none;
    }
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
 * The count from KV while it is fresh, else from GitHub, saved to KV. On a GitHub failure the last
 * good count stays, and the failure is saved too, so GitHub is not asked again for FRESH_MS.
 * @param {{ GITHUB_TOKEN?: string, INSTALLS?: KVNamespace }} env
 * @param {typeof fetch} fetchImpl
 * @param {Date} at
 */
async function current(env, fetchImpl, at) {
  const kv = env?.INSTALLS;
  let saved = null;
  try {
    saved = (await kv?.get(KV_KEY, { type: 'json' })) ?? null;
  } catch {
    // KV that fails is empty.
  }
  if (saved && at.getTime() - Date.parse(saved.asked) < FRESH_MS) return saved;
  // ponytail: KV is eventually consistent, so two data centers can both find it stale and both ask
  // GitHub in the same minute. Harmless at 5,000 reads an hour; a Durable Object would make it one.
  const { installs } = await releaseCounts(fetchImpl, env?.GITHUB_TOKEN);
  const asked = at.toISOString();
  const next = installs === null ? { installs: saved?.installs ?? null, updated: saved?.updated ?? asked, asked } : { installs, updated: asked, asked };
  try {
    await kv?.put(KV_KEY, JSON.stringify(next));
  } catch {
    // Not saved: the next miss asks GitHub again.
  }
  return next;
}

/**
 * The request handler, apart from Pages.
 * @param {Request} request
 * @param {{ GITHUB_TOKEN?: string, INSTALLS?: KVNamespace }} env
 * @param {{ fetchImpl?: typeof fetch, cache?: Cache, waitUntil?: (p: Promise<unknown>) => void, now?: () => Date }} [deps]
 */
export async function handleInstalls(request, env, deps = {}) {
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

  const { installs, updated } = await current(env, fetchImpl, now());
  const response = new Response(JSON.stringify({ installs, updated }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${MAX_AGE}`,
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
