// Cloudflare Pages Function for every request to getjpm.sh.
//
// - /install.sh and /install.ps1 are always the install scripts, as plain text.
// - / is the install script for an installer (curl, Wget, PowerShell, or anything that does
//   not ask for HTML), so `curl -fsSL https://getjpm.sh | sh` works; a browser gets the page.
//   PowerShell gets install.ps1 there, so `irm https://getjpm.sh | iex` works too.
// - /apt/ is jpm's apt repository (serveApt).
// - Everything else is the static site.
//
// The scripts are not copied into this repository: they are fetched from jpm's own repository,
// so the site always serves what jpm's main branch has, cached at the edge for five minutes.

export const SCRIPTS_BASE = 'https://raw.githubusercontent.com/jtwebman/jpm/main/';
export const CACHE_SECONDS = 300;

const SCRIPT_PATHS = { '/install.sh': 'install.sh', '/install.ps1': 'install.ps1' };

// Link-preview and search crawlers often accept anything, but want the page, not a script.
const CRAWLER = /bot|crawl|spider|slurp|facebookexternalhit|embedly|slack|discord|telegram|whatsapp|linkedin|skype|preview|mastodon|bluesky|vkshare|pinterest|quora/i;

/**
 * Which script, if any, a request for `/` wants: 'install.ps1' for PowerShell, 'install.sh' for
 * curl, Wget and other non-browser clients, or null for a browser.
 * @param {Request} request
 * @returns {'install.sh' | 'install.ps1' | null}
 */
export function installerFor(request) {
  const ua = request.headers.get('user-agent') ?? '';
  const accept = request.headers.get('accept') ?? '';
  if (/PowerShell/i.test(ua)) return 'install.ps1';
  if (/^(curl|Wget)\//i.test(ua)) return 'install.sh';
  if (CRAWLER.test(ua)) return null;
  if (!/text\/html/i.test(accept)) return 'install.sh';
  return null;
}

/**
 * The script fetched from jpm's repository, as text/plain; a 502 in plain text when that fails,
 * never HTML, so `curl -f` stops instead of piping a page into sh.
 * @param {string} name
 * @param {Request} request
 * @param {typeof fetch} fetchImpl
 */
export async function serveScript(name, request, fetchImpl = fetch) {
  const headers = {
    'content-type': 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff',
    vary: 'User-Agent, Accept',
  };
  let upstream;
  try {
    upstream = await fetchImpl(SCRIPTS_BASE + name, {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      headers: { 'user-agent': 'getjpm.sh' },
    });
  } catch {
    upstream = null;
  }
  if (!upstream || !upstream.ok) {
    const status = upstream ? ` (GitHub answered ${upstream.status})` : '';
    return new Response(`jpm: could not fetch ${name}${status}. Try again, or get it from https://github.com/jtwebman/jpm/blob/main/${name}\n`, {
      status: 502,
      headers: { ...headers, 'cache-control': 'no-store' },
    });
  }
  const body = request.method === 'HEAD' ? null : await upstream.text();
  return new Response(body, {
    status: 200,
    headers: { ...headers, 'cache-control': `public, max-age=${CACHE_SECONDS}` },
  });
}

// jpm's apt repository (docs/install.md in jpm): its index and key from the `apt` branch, which
// jpm's release workflow writes and signs, and its packages from the releases themselves.
export const APT_BASE = 'https://raw.githubusercontent.com/jtwebman/jpm/apt/';
const RELEASES = 'https://github.com/jtwebman/jpm/releases/download/';
// The index files there, and only those: nothing else of the branch is served.
const APT_FILES = /^(jpm\.gpg|jpm\.asc|dists\/stable\/(InRelease|Release|Release\.gpg|main\/binary-(amd64|arm64|armhf)\/Packages(\.gz)?))$/;
// A package, as the index names it: jpm_<version>_<arch>.deb, a release's own file.
const APT_POOL = /^pool\/main\/j\/jpm\/jpm_([0-9][0-9A-Za-z.+-]*)_(amd64|arm64|armhf)\.deb$/;

const aptType = (file) =>
  file.endsWith('.gpg') ? 'application/pgp-keys' : file.endsWith('.gz') ? 'application/gzip' : 'text/plain; charset=utf-8';

/**
 * A request under /apt/: an index file fetched from the `apt` branch, byte for byte, cached at the
 * edge for five minutes like the scripts; a package sent to the release's .deb; anything else a
 * 404. Plain text when something fails, so apt and curl say why.
 * @param {string} pathname
 * @param {Request} request
 * @param {typeof fetch} fetchImpl
 */
export async function serveApt(pathname, request, fetchImpl = fetch) {
  const file = pathname.replace(/^\/apt\/?/, '');
  const text = (status, message) =>
    new Response(`${message}\n`, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  const pkg = APT_POOL.exec(file);
  if (pkg) {
    const [, version, arch] = pkg;
    return new Response(null, {
      status: 302,
      headers: { location: `${RELEASES}v${version}/jpm_${version}_${arch}.deb`, 'cache-control': 'public, max-age=3600' },
    });
  }
  if (!APT_FILES.test(file)) {
    return text(404, "jpm: not part of jpm's apt repository. To add it: https://github.com/jtwebman/jpm/blob/main/docs/install.md#debian-and-ubuntu");
  }
  let upstream;
  try {
    upstream = await fetchImpl(APT_BASE + file, {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      headers: { 'user-agent': 'getjpm.sh' },
    });
  } catch {
    upstream = null;
  }
  if (upstream && upstream.status === 404) return text(404, `jpm: ${file} is not in the apt repository yet`);
  if (!upstream || !upstream.ok) {
    const status = upstream ? ` (GitHub answered ${upstream.status})` : '';
    return text(502, `jpm: could not fetch ${file}${status}; try again`);
  }
  const body = request.method === 'HEAD' ? null : await upstream.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': aptType(file),
      'x-content-type-options': 'nosniff',
      'cache-control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
}

/**
 * The request handler, apart from Pages: `next` serves the static site.
 * @param {Request} request
 * @param {() => Promise<Response>} next
 * @param {typeof fetch} [fetchImpl]
 */
export async function handle(request, next, fetchImpl = fetch) {
  const { pathname } = new URL(request.url);
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  const served = (script) => serveScript(script, request, fetchImpl);

  if (isRead && pathname in SCRIPT_PATHS) return served(SCRIPT_PATHS[pathname]);

  if (isRead && (pathname === '/apt' || pathname.startsWith('/apt/'))) return serveApt(pathname, request, fetchImpl);

  if (isRead && pathname === '/') {
    const script = installerFor(request);
    if (script) return served(script);
    // The page varies by these headers too, so a shared cache never hands it to curl.
    const page = await next();
    const response = new Response(page.body, page);
    response.headers.set('vary', 'User-Agent, Accept');
    return response;
  }

  return next();
}

/** @type {PagesFunction} */
export const onRequest = (context) => handle(context.request, () => context.next(), fetch);
