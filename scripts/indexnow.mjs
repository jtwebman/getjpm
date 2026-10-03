// Tells IndexNow (Bing, Yandex, Naver, Seznam and the others that share it) that the site's pages
// changed, so they are crawled again within hours, not days. Bing's index is also what ChatGPT
// search, Copilot and DuckDuckGo draw on. Run after a deploy (`jpm run deploy` does):
//   node scripts/indexnow.mjs
// The key is the name of the file in public/ that holds it; the search engines fetch that file
// from the site to check the request is ours. The URLs are the built sitemap's.
import { readFileSync, readdirSync } from 'node:fs';

const HOST = 'getjpm.sh';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const keyFile = readdirSync('public').find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('no IndexNow key file (32 hex digits .txt) in public/');
const key = keyFile.slice(0, -4);

const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error('no URLs in dist/sitemap.xml: run `jpm run build` first');

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList }),
});
// 200 and 202 both mean accepted; 202 while the key is still being checked.
if (res.status !== 200 && res.status !== 202) {
  throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`);
}
console.log(`IndexNow: ${res.status}, ${urlList.length} URLs submitted`);
