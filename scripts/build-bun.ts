// Offline-friendly production build with Bun (the project is Vite-compatible; this exists for
// environments where Vite cannot be installed). Usage: bun scripts/build-bun.ts
import { mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';

const out = 'dist';
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const res = await Bun.build({
  entrypoints: ['src/main.tsx'],
  outdir: out,
  target: 'browser',
  format: 'iife', // a classic script, so dist/index.html also works when opened straight from disk (file://)
  minify: true,
  sourcemap: 'none',
  naming: { entry: 'assets/[name].[ext]', chunk: 'assets/[name]-[hash].[ext]', asset: 'assets/[name]-[hash].[ext]' },
  define: { 'process.env.NODE_ENV': '"production"' },
});
if (!res.success) {
  for (const l of res.logs) console.error(l);
  process.exit(1);
}

// CSS: the bundler emits imported CSS next to the entry.
let html = await readFile('index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="./src/styles.css" />', '<link rel="stylesheet" href="./assets/main.css" />');
html = html.replace('<script type="module" src="./src/main.tsx"></script>', '<script defer src="./assets/main.js"></script>');
await writeFile(`${out}/index.html`, html);
await cp('public', out, { recursive: true }).catch(() => {});

// A single self-contained file (CSS and JS inlined) that can be e-mailed, dropped on any host or opened by double-click.
const css = await readFile(`${out}/assets/main.css`, 'utf8');
const js = (await readFile(`${out}/assets/main.js`, 'utf8')).replace(/<\/script/gi, '<\\/script');
const single = html
  .replace('<link rel="stylesheet" href="./assets/main.css" />', () => `<style>\n${css}\n</style>`)
  .replace('<script defer src="./assets/main.js"></script>', () => '')
  .replace('<link rel="icon" type="image/svg+xml" href="./favicon.svg" />', () => '')
  .replace('</body>', () => `<script>\n${js}\n</script>\n</body>`);
await writeFile(`${out}/J2Grows.html`, single);
console.log('Built', res.outputs.map((o) => `${o.path} (${(o.size / 1024).toFixed(0)} KB)`).join(', '));
