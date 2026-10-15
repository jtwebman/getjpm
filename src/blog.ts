// The blog's published posts, newest first. Drafts only show in `jpm run dev`.
// An English post is src/content/blog/<slug>.md; its translations are
// src/content/blog/<locale path>/<slug>.md, e.g. ja/building-jpm.md.
import { getCollection, type CollectionEntry } from 'astro:content';
import { defaultLocale, localeHref, locales, type Locale } from './i18n';

export type Post = CollectionEntry<'blog'>;

const localeOf = (p: Post) => (p.id.includes('/') ? p.id.slice(0, p.id.indexOf('/')) : '');
export const slugOf = (p: Post) => p.id.slice(p.id.indexOf('/') + 1);

const published = async () => getCollection('blog', (p) => !(import.meta.env.PROD && p.data.draft));

/** A language's posts, newest first. */
export const posts = async (locale: Locale = defaultLocale) =>
  (await published()).filter((p) => localeOf(p) === locale.path).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

/** The languages a post exists in. */
export const translations = async (slug: string) => {
  const paths = new Set((await published()).filter((p) => slugOf(p) === slug).map(localeOf));
  return locales.filter((l) => paths.has(l.path));
};

/** The languages that have at least one post. */
export const blogLocales = async () => {
  const paths = new Set((await published()).map(localeOf));
  return locales.filter((l) => paths.has(l.path));
};

export const postHref = (locale: Locale, slug: string) => localeHref(locale, `blog/${slug}/`);

export const formatDate = (d: Date, locale: Locale) => d.toLocaleDateString(locale.code, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
