# getjpm.sh

The website for [jpm](https://github.com/jtwebman/jpm), a fast, small, secure-by-default package
manager for JavaScript, served at <https://getjpm.sh>. It also serves jpm's install scripts:

```sh
curl -fsSL https://getjpm.sh | sh                  # macOS and Linux
```

```powershell
irm https://getjpm.sh/install.ps1 | iex              # Windows
```

A static [Astro](https://astro.build) site styled with [Open Props](https://open-props.style)
tokens and plain modern CSS (nesting, `@layer`, container queries), in ten languages, plus
Cloudflare Pages Functions for the scripts and the public install count. No trackers, page
analytics, web fonts or CDNs: everything is served from the site.

## Layout

| Path | What it is |
| --- | --- |
| `src/pages/index.astro`, `src/pages/[locale]/index.astro` | The home page: English at `/`, the other languages at `/zh/`, `/ja/`, … |
| `src/layouts/Base.astro` | The shell every page uses: head and meta, `hreflang` links, theme, header and footer |
| `src/components/` | The header, footer and the home page's sections (`Hero`, `SpeedChart`, `Switch`, `Lean`, `StorageDiagram`, `Security`, `Story`, `Installs`) |
| `src/data/bench.ts` | The benchmark numbers the charts draw, from jpm's [docs/benchmarks.md](https://github.com/jtwebman/jpm/blob/main/docs/benchmarks.md) |
| `src/i18n/` | One dictionary per language; `en.json` is the source |
| `src/styles/` | Open Props imports, the theme tokens and the global styles |
| `src/scripts/bars.ts` | The bar charts' rows and grow-on-scroll animation, shared by the speed and lean charts |
| `public/` | Files served as they are: favicon, Open Graph image, `_headers`, `robots.txt` |
| `functions/_middleware.js` | The Pages Function that serves the install scripts |
| `functions/api/installs.js` | `GET /api/installs`: the public install count the page shows |
| `test/` | Tests for the function and the dictionaries (`jpm test`) |
| `scripts/preview.mjs` | Writes the built English page as one self-contained HTML file |
| `scripts/og.ps1` | Renders `public/og.png` with .NET's System.Drawing on Windows |

## Working on it

Node.js 24 (`.nvmrc`) and [jpm](https://getjpm.sh) 1.0.0 or later:

```sh
jpm ci
jpm run dev        # http://localhost:4321
jpm run build      # the static site, in dist/
jpm run preview    # serve dist/ (the CSP <meta> is checked only in a build, not in dev)
jpm run check      # astro check: types and templates
jpm test           # the Pages Function and the dictionaries
node scripts/preview.mjs preview.html   # after a build: one file to share
```

Dependencies are pinned (`save-exact` in `.npmrc`, and `jpm.lock`): `astro` and
`open-props`, plus `@astrojs/check` and `typescript` for `astro check`. `jpm.lock` was
imported from npm's `package-lock.json`, with the same versions; the site builds the same
with either.

`jpm run dev` does not run the Pages Function. To try it locally, Cloudflare's
`jpx wrangler@4.145.0 pages dev dist` runs the built site with `functions/`; `jpm test` covers its
logic with `fetch` mocked.

## The install scripts

`functions/_middleware.js` runs for every request:

- `/install.sh` and `/install.ps1` are always the scripts, `text/plain; charset=utf-8`.
- `/` is a script for an installer and the page for a browser: a `User-Agent` starting with
  `curl/` or `Wget/`, or an `Accept` header without `text/html`, gets `install.sh`, and a
  `User-Agent` with `PowerShell` (Windows PowerShell 5.1 and PowerShell 7) gets `install.ps1`,
  so `curl -fsSL https://getjpm.sh | sh` and `irm https://getjpm.sh | iex` both work. Link
  preview and search crawlers (Slack, Discord, Twitter, Googlebot, …) get the page. The page's
  response carries `Vary: User-Agent, Accept`.
- `/apt/` is jpm's apt repository: its key (`jpm.gpg`, `jpm.asc`) and signed index
  (`dists/stable/…`) fetched byte for byte from the `apt` branch of jpm's repository, which
  jpm's release workflow writes, and each package (`pool/main/j/jpm/jpm_<version>_<arch>.deb`)
  a redirect to that release's `.deb`. Nothing else of the branch is served.
- Everything else is the static site.

The scripts are not copied here. They are fetched from jpm's repository,
`https://raw.githubusercontent.com/jtwebman/jpm/main/install.sh` (and `install.ps1`), cached at
Cloudflare's edge for 5 minutes (`cf.cacheTtl`) and sent with `Cache-Control: public,
max-age=300`, so a change to jpm's scripts is live within minutes. If GitHub cannot be reached,
the answer is a plain-text 502 (`Cache-Control: no-store`), never HTML, so `curl -f` stops
instead of piping a page into `sh`.

## Languages

English (`/`), 简体中文 (`/zh/`), 日本語 (`/ja/`), 한국어 (`/ko/`), Español (`/es/`),
Português do Brasil (`/pt/`), Français (`/fr/`), Deutsch (`/de/`), Русский (`/ru/`) and
Українська (`/uk/`), through Astro's i18n routing.

Every string is in `src/i18n/<locale>.json`, with English as the source. A key missing from a
language falls back to English with a warning in the build, and `jpm test` fails on it, on a key
English does not have, and on a placeholder (`{link}`) or `<code>` span that differs from the
English. The translations are AI-written, and the footer says so in each language; corrections
from native speakers are welcome as issues or pull requests. Product names, commands, file names
and every number stay as they are in English.

To add a language: add it to `locales` in `src/i18n/index.ts` and to `i18n.locales` in
`astro.config.mjs`, and add its dictionary.

## Growing it

Every page uses `src/layouts/Base.astro` and the tokens and styles in `src/styles/`, and the
header's `links` list takes more entries (Docs, Blog). When the site grows a docs section,
[Starlight](https://starlight.astro.build) can render jpm's own
[docs/*.md](https://github.com/jtwebman/jpm/tree/main/docs) into it; it is not added yet.

## Security

- A Content-Security-Policy `<meta>`, written by Astro (`security.csp`): scripts only from the
  site, plus a hash of the one inline script (the theme, set before the first paint); no
  objects, no forms, no other origins. Inline styles are allowed: the bar charts set their bars'
  lengths with them.
- `public/_headers`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and
  `frame-ancestors`, `Permissions-Policy` and `Strict-Transport-Security`, and a year's cache for
  Astro's hashed `/_astro/` files.

## Deploying on Cloudflare Pages

The site is a Cloudflare Pages project, `getjpm`, deployed from this repository with wrangler
(a Direct Upload project). The function in `functions/` at the repository root is bundled and
deployed with the site; it needs no settings or bindings. To deploy:

```sh
jpx wrangler@4.145.0 login    # once, in a browser
jpm run deploy                  # build, deploy to Cloudflare Pages, then notify IndexNow
```

`jpm run deploy` runs a pinned wrangler through `jpx` rather than keeping it (and workerd, about
60 MB) in `node_modules`. After the deploy it tells IndexNow, which Bing, Yandex, Naver, Seznam
and others share, that the sitemap's pages changed (`scripts/indexnow.mjs`; `jpm run indexnow`
runs it alone). The IndexNow key is the 32-hex-digit `.txt` file in `public/`: the search
engines fetch it from the site to check a ping is ours.

The domain: `getjpm.sh` is on Cloudflare, and the Pages project's Custom domains has
`getjpm.sh`, which made the DNS record and the certificate. The project was created with
`npx wrangler pages project create getjpm --production-branch main`.

To check a deploy:

```sh
curl -fsSL https://getjpm.sh | head -3                  # #!/bin/sh …
curl -fsSI https://getjpm.sh/install.ps1                # content-type: text/plain; charset=utf-8
curl -fsS -H 'Accept: text/html' -A 'Mozilla/5.0' https://getjpm.sh | head -c 100   # the page
```

## What the site counts

getjpm.sh counts the install scripts it hands out, and nothing else. For each `install.sh` or
`install.ps1` the Pages Function serves, it adds one to a row of a D1 table (`wrangler.toml`'s `DB`,
database `getjpm`, table `installs` from `migrations/0001_installs.sql`) kept per UTC day, script,
and path asked for (`/`, `/install.sh` or `/install.ps1`). A row holds those three and a number.
No IP address, user agent, cookie or other identifier is read or stored, the page itself is not
counted, and the write runs after the response (`waitUntil`) and is dropped if it fails, so a
count never slows or fails an install. A fetch is not an install, and nothing here tells one
person from another.

The release files' download counts on GitHub are the other number: the installers fetch the
binary from there. `jpm run installs` prints both: the script counts through `wrangler d1 execute`
with your own wrangler login, GitHub's with no login at all.

The home page shows both, in public, near the bottom: the install scripts handed out since
getjpm.sh launched, and the downloads of the jpm binary (release files named `jpm-*`) from GitHub,
with the paragraph above in plain words next to them. The page fetches them in the browser from
`GET /api/installs` (`functions/api/installs.js`), which answers
`{ "scripts": n, "scripts30d": n, "binaryDownloads": n, "updated": "<ISO time>" }`:

- `scripts` and `scripts30d` are the table's total, all told and over the last 30 days, read
  through the same D1 binding: the site holds no API token or other credential for them.
- `binaryDownloads` is the sum of `download_count` over every release's `jpm-*` files, from
  GitHub's API without a token. Zero means there is no release yet, and the page says so.
- Any of them is `null` when its source is missing or fails, and the page shows a dash for it
  (and only the explanation when the counts all are). No upstream error text or header is passed on.
- The answer is cached at the edge with the Cache API for an hour (`Cache-Control: public,
  max-age=3600`), keyed on the URL without its query string, so visitors cause at most one read of
  each source an hour per Cloudflare data center. When a source failed, the answer is cached
  for five minutes instead, so the count comes back soon after the source does.
- A request for `/api/installs` is not counted: only the install scripts are, as above. Showing
  the count reads nothing about the visitor either.

## License

MIT, Copyright (c) 2026 JT Turner. See [LICENSE](LICENSE).
