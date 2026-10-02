// Cloudflare Pages Function for every request to getjpm.sh.
//
// - /install.sh and /install.ps1 are always the install scripts, as plain text.
// - / is the install script for an installer (curl, Wget, PowerShell, or anything that does
//   not ask for HTML), so `curl -fsSL https://getjpm.sh | sh` works; a browser gets the page.
//   PowerShell gets install.ps1 there, so `irm https://getjpm.sh | iex` works too.
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

/**
 * The request handler, apart from Pages: `next` serves the static site.
 * @param {Request} request
 * @param {() => Promise<Response>} next
 * @param {typeof fetch} [fetchImpl]
 */
export async function handle(request, next, fetchImpl = fetch, count = () => {}) {
  const { pathname } = new URL(request.url);
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  // A script handed out, counted by which one and the path asked for: nothing about who asked.
  const served = async (script) => {
    const response = await serveScript(script, request, fetchImpl);
    if (request.method === 'GET' && response.status === 200) {
      try {
        count(script, pathname);
      } catch {
        // A count is never worth a failed install.
      }
    }
    return response;
  };

  if (isRead && pathname in SCRIPT_PATHS) return served(SCRIPT_PATHS[pathname]);

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

/**
 * One data point per install script handed out, in Workers Analytics Engine (wrangler.toml's
 * INSTALLS): the script and the path, nothing else. No address, user agent, cookie or other
 * identifier is read or stored. Writing does not wait on anything and cannot fail the response.
 * @param {{ INSTALLS?: { writeDataPoint(point: object): void } }} env
 */
export function counter(env) {
  return (script, path) => env.INSTALLS?.writeDataPoint({ blobs: [script, path], doubles: [1], indexes: [script] });
}

/** @type {PagesFunction} */
export const onRequest = (context) => handle(context.request, () => context.next(), fetch, counter(context.env));
