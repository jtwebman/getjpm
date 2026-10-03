// Writes one self-contained HTML file from the built English page (dist/index.html), with its
// stylesheet, scripts and favicon inlined, for sharing a preview without a server:
//   jpm run build && node scripts/preview.mjs out.html
// The CSP <meta> is left out (its hashes do not cover inlined scripts), and links to other pages
// and the install scripts only work on the real site.
import { readFileSync, writeFileSync } from 'node:fs';
// esbuild comes with Astro (through Vite); it is not a dependency of its own.
import { build } from 'esbuild';

const out = process.argv[2] ?? 'preview.html';
const dist = new URL('../dist/', import.meta.url);
let html = readFileSync(new URL('index.html', dist), 'utf8');

html = html.replace(/<meta http-equiv="content-security-policy"[^>]*>/, '');

html = html.replace(/<link rel="stylesheet" href="\/([^"]+)">/g, (_, path) => `<style>${readFileSync(new URL(path, dist), 'utf8')}</style>`);

const scripts = [...html.matchAll(/<script type="module" src="\/([^"]+)"><\/script>/g)];
for (const [tag, path] of scripts) {
  // Each module and the chunks it imports, bundled into one inline script.
  const result = await build({ entryPoints: [new URL(path, dist).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, format: 'esm', minify: true, write: false });
  const code = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  html = html.replace(tag, () => `<script type="module">${code}</script>`);
}

const favicon = readFileSync(new URL('favicon.svg', dist));
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`);

writeFileSync(out, html);
console.log(`${out}: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
