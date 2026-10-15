// The blog's posts: one Markdown file each in src/content/blog/, its name the post's URL
// (src/content/blog/why-rust.md is /blog/why-rust/), and its translations in a folder per
// language (src/content/blog/ja/why-rust.md is /ja/blog/why-rust/).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    /** One or two sentences, for search results, link previews and the blog's list. */
    description: z.string(),
    date: z.coerce.date(),
    /** A 1200x630 image in public/ (e.g. '/blog/why-rust.png') for link previews; og.png if none. */
    image: z.string().optional(),
    /** Shown by `jpm run dev`, left out of the built site. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
