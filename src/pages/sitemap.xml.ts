// sitemap.xml: every page in every language, each with its translations as alternates, the way
// search engines want a multilingual site described. Built with the site; add a page's path to
// `pages` when the site grows one. The blog is English only, so its pages have no alternates.
import type { APIRoute } from 'astro';
import { locales, localeHref } from '../i18n';
import { posts, postHref } from '../blog';

const pages = [''];

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://getjpm.sh');
  const href = (path: string) => new URL(path, base).href;
  const urls = pages.flatMap((page) =>
    locales.map((locale) => {
      const alternates = locales
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${href(localeHref(l, page))}"/>`)
        .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${href(localeHref(locales[0], page))}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${href(localeHref(locale, page))}</loc>\n${alternates}\n  </url>`;
    }),
  );
  const blog = await posts();
  if (blog.length) {
    for (const path of ['/blog/', ...blog.map((p) => postHref(p.id))]) urls.push(`  <url>\n    <loc>${href(path)}</loc>\n  </url>`);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
