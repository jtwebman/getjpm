// The blog's published posts, newest first. Drafts only show in `jpm run dev`.
import { getCollection } from 'astro:content';

export const posts = async () =>
  (await getCollection('blog', (p) => !(import.meta.env.PROD && p.data.draft))).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

export const postHref = (id: string) => `/blog/${id}/`;

export const formatDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
