// The blog's RSS feed, English posts only, for feed readers and aggregators such as daily.dev.
import type { APIRoute } from 'astro';
import { defaultLocale } from '../../i18n';
import { posts, postHref, slugOf } from '../../blog';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://getjpm.sh');
  const items = (await posts()).map((p) => {
    const url = new URL(postHref(defaultLocale, slugOf(p)), base).href;
    return `    <item>
      <title>${esc(p.data.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <description>${esc(p.data.description)}</description>
      <pubDate>${p.data.date.toUTCString()}</pubDate>
    </item>`;
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>jpm blog</title>
    <link>${new URL('/blog/', base).href}</link>
    <atom:link href="${new URL('/blog/rss.xml', base).href}" rel="self" type="application/rss+xml"/>
    <description>Posts about jpm, a fast, small package manager for JavaScript written in Rust.</description>
    <language>en</language>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
