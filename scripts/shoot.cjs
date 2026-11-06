// Headless UI check: boots dist/ in Chromium (optionally from a save file), walks every view and
// takes screenshots. Fails on page errors.
//   [ART=all|originals|offline|missing|none] node scripts/shoot.cjs <outDir> [view,view,...] [saveFile]
// ART picks how the Supabase artwork is mocked (see scripts/mock-art.cjs); 'none' leaves the network alone.
const { chromium } = require('playwright');
const path = require('path');
const { installArtMock } = require('./mock-art.cjs');
const http = require('http');
const fs = require('fs');

const out = process.argv[2] || 'shots';
const ALL = 'overview,cultivation,tissue,genetics,research,lab,market,collection,automation,goals,legacy,settings';
const views = (process.argv[3] && process.argv[3] !== 'all' ? process.argv[3] : ALL).split(',');
const saveFile = process.argv[4];
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(__dirname, '..', 'dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});
const LABEL = { overview: 'Overview', cultivation: 'Cultivation', tissue: 'Tissue Culture', genetics: 'Genetics', research: 'Research', lab: 'Laboratory', market: 'Market', collection: 'Collection', automation: 'Automation', goals: 'Goals', legacy: 'Legacy', settings: 'Settings' };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  if ((process.env.ART || 'originals') !== 'none') await installArtMock(ctx, process.env.ART || 'originals');
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  // the first-run statistics question would cover the screens: answer it ahead of time
  await page.addInitScript(() => { try { localStorage.setItem('j2grows.prefs.v1', JSON.stringify({ telemetry: 'off' })); } catch (e) {} });
  if (saveFile) {
    const save = fs.readFileSync(saveFile, 'utf8');
    await page.addInitScript((s) => { try { localStorage.setItem('j2grows.save.v1', s); } catch (e) {} }, save);
  }
  await page.goto(url);
  await page.waitForSelector('.app');
  await page.waitForTimeout(400);
  const dismiss = page.locator('.modal-f .btn-primary:has-text("Back to the lab")');
  if (await dismiss.count()) { await page.screenshot({ path: path.join(out, 'welcome-back.png') }); await dismiss.click(); }
  for (const v of views) {
    await page.click(`.nav:has-text("${LABEL[v]}")`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${v}.png`), fullPage: false });
  }
  // plant detail modal
  if (views.includes('cultivation')) {
    await page.click('.nav:has-text("Cultivation")');
    const card = page.locator('.plant-card').first();
    if (await card.count()) {
      await card.click();
      await page.waitForSelector('.modal');
      await page.screenshot({ path: path.join(out, 'plant-detail.png') });
      for (const t of ['Genome', 'Propagate', 'History']) { await page.click(`.modal .tab:has-text("${t}")`); await page.waitForTimeout(120); if (t === 'Genome') await page.screenshot({ path: path.join(out, 'plant-genome.png') }); }
      await page.keyboard.press('Escape');
    }
  }
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})();
