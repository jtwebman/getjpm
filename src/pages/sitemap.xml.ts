// sitemap.xml: every page in every language, each with its translations as alternates, the way
// search engines want a multilingual site described. Built with the site; add a page's path to
// `pages` when the site grows one. Blog pages list only the languages they exist in.
import type { APIRoute } from 'astro';
import { locales, localeHref, type Locale } from '../i18n';
import { blogLocales, posts, postHref, slugOf, translations } from '../blog';

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
  // The blog: its list in each language that has posts, and each post in the languages it has.
  const entry = (path: (l: Locale) => string, langs: Locale[]) =>
    langs.map((l) => {
      const alternates = langs.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${href(path(a))}"/>`).join('\n');
      return `  <url>\n    <loc>${href(path(l))}</loc>\n${alternates}\n  </url>`;
    });
  urls.push(...entry((l) => localeHref(l, 'blog/'), await blogLocales()));
  for (const post of await posts()) {
    const slug = slugOf(post);
    urls.push(...entry((l) => postHref(l, slug), await translations(slug)));
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
