// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://getjpm.sh',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // One stylesheet for every page and locale, cached once.
    inlineStylesheets: 'never',
  },
  // Scoped styles as a short class rather than a data attribute on every element.
  scopedStyleStrategy: 'class',
  // No Markdown pages yet; Shiki's inline styles would not fit the CSP anyway.
  markdown: { syntaxHighlight: false },
  vite: {
    // Every script in its own cached file, shared by all locales, never inlined in the page.
    build: { assetsInlineLimit: 0 },
  },
  i18n: {
    defaultLocale: 'en',
    locales: [
      'en',
      { path: 'zh', codes: ['zh-CN'] },
      'ja',
      'ko',
      'es',
      { path: 'pt', codes: ['pt-BR'] },
      'fr',
      'de',
      'ru',
      'uk',
    ],
    routing: { prefixDefaultLocale: false },
  },
  security: {
    // A Content-Security-Policy <meta>: scripts only from this site or with a hash Astro
    // computes. Styles allow inline style attributes, which the bar charts set their lengths with.
    csp: {
      directives: ["default-src 'self'", "img-src 'self' data:", "base-uri 'self'", "form-action 'none'", "object-src 'none'"],
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
});
