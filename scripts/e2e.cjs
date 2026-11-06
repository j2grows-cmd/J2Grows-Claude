// End-to-end click-through of the built game (dist/) in headless Chromium.
//   bun scripts/build-bun.ts && node scripts/e2e.cjs [outDir]
// Starts from an empty browser profile, plays the first minutes by hand through the UI, then checks
// save export/import, the welcome-back report, a new game, and a phone-sized viewport.
// Exits 1 on any failed expectation or page error.
const { chromium } = require('playwright');
const path = require('path');
const { installArtMock } = require('./mock-art.cjs');
const http = require('http');
const fs = require('fs');

const out = process.argv[2] || path.join(require('os').tmpdir(), 'j2grows-e2e');
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(__dirname, '..', 'dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

const failures = [];
const step = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name); } catch (e) { failures.push(name + ': ' + e.message.split('\n')[0]); console.log('  FAIL ' + name + ' — ' + e.message.split('\n')[0]); }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Stand-in for the Supabase artwork buckets: the image transformer is "unavailable" (the free-plan case), originals work.
  const artStats = await installArtMock(ctx, 'originals');
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

  console.log('Fresh start');
  await page.goto(url);
  await page.waitForSelector('.app');
  await step('overview renders with the stage card', async () => {
    expect(await page.locator('h1:has-text("Overview")').count() > 0, 'no Overview heading');
    expect((await page.textContent('.app')).includes('Personal Growing Room'), 'stage 1 name missing');
  });

  const nav = (label) => page.click(`.nav:has-text("${label}")`);
  const bodyText = () => page.textContent('.app');

  console.log('Artwork');
  await step('logo, banner and favicon come from the Artwork bucket', async () => {
    await page.waitForSelector('.brand-logo.ready', { timeout: 4000 });
    await page.waitForSelector('.banner-top.on img', { timeout: 4000 });
    expect(await page.evaluate(() => (document.querySelector('.brand-logo')).naturalWidth > 0), 'logo did not decode');
    expect((await page.getAttribute('link[rel~="icon"]', 'href')).includes('supabase.co'), 'favicon was not switched to the logo');
    for (const f of ['Artwork/logo.png', 'Artwork/banner.png', 'Artwork/banner with logo.png']) expect(artStats.urls.has(f), f + ' was never requested');
  });
  await step('image transformer failure falls back to originals, and is remembered', async () => {
    expect(artStats.render > 0 && artStats.object > 0, 'expected both a resized attempt and an original request');
    const before = artStats.render;
    await page.click('.nav:has-text("Collection")');
    await page.waitForSelector('.pic img', { timeout: 4000 });
    await page.waitForTimeout(500);
    expect(artStats.render - before <= 1, 'kept asking the transformer after it failed (' + (artStats.render - before) + ' extra requests)');
    await page.click('.nav:has-text("Overview")');
  });

  await step('locked departments are marked, not hidden', async () => {
    const t = await page.locator('.nav:has-text("Genetics")').getAttribute('class');
    expect(/lock|dim|disabled/.test(t || '') || (await page.locator('.nav:has-text("Genetics") svg').count()) > 0, 'Genetics nav has no lock state');
  });

  console.log('First plant');
  await nav('Market');
  await step('buy a young plant', async () => {
    const before = (await page.locator('.nav:has-text("Cultivation")').count());
    expect(before === 1, 'no cultivation nav');
    await page.locator('button:has-text("Young plant")').first().click();
    await page.waitForTimeout(200);
  });
  await step('shop cards show the species hero picture', async () => {
    await page.waitForSelector('.pic img', { timeout: 4000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const imgs = [...document.querySelectorAll('.pic img.pic-img')]; return { n: imgs.length, ok: imgs.filter((i) => i.naturalWidth > 0).length, hero: imgs.every((i) => /plant-images\/(species|Species)\/[a-z-]+\/hero\.png/.test(i.src)) }; });
    expect(r.n >= 6 && r.ok === r.n, `expected loaded pictures, got ${r.ok}/${r.n}`);
    expect(r.hero, 'a picture was not the species hero.png');
  });
  await nav('Cultivation');
  await step('plant it in the first empty slot', async () => {
    await page.locator('.slot-empty').first().click();
    await page.waitForSelector('.modal');
    await page.locator('.modal-f .btn-primary:has-text("Plant it")').click();
    await page.waitForSelector('.plant-card');
    expect((await page.locator('.plant-card').count()) === 1, 'expected exactly one plant card');
  });
  await step('open the plant, water it, see the toast', async () => {
    await page.locator('.plant-card').first().click();
    await page.waitForSelector('.modal');
    await page.locator('.modal .btn:has-text("Water")').first().click();
    await page.waitForTimeout(150);
    for (const t of ['Genome', 'Propagate', 'History']) await page.click(`.modal .tab:has-text("${t}")`);
    await page.screenshot({ path: path.join(out, 'e2e-plant-history.png') });
  });
  await step('sell the plant from its detail panel', async () => {
    await page.locator('.modal-f .btn:has-text("Sell")').click();
    await page.waitForTimeout(200);
    expect((await page.locator('.plant-card').count()) === 0, 'plant card still present after selling');
    expect((await page.locator('.modal').count()) === 0, 'modal still open after selling');
  });

  console.log('Research and laboratory');
  await nav('Research');
  await step('research page lists techs and a category switcher', async () => {
    expect((await page.locator('.tech').count()) > 0, 'no tech cards');
    const tabs = await page.locator('.tabs .tab').count();
    expect(tabs >= 6, 'expected at least six research categories, got ' + tabs);
    await page.locator('.tabs .tab').nth(2).click();
    expect((await page.locator('.tech').count()) > 0, 'second category empty');
  });
  await nav('Laboratory');
  await step('laboratory tabs switch', async () => {
    for (const t of ['Departments', 'Staff', 'Facility']) { await page.click(`.tabs .tab:has-text("${t}")`); await page.waitForTimeout(80); }
  });
  for (const v of ['Tissue Culture', 'Genetics', 'Collection', 'Automation', 'Goals', 'Legacy', 'Overview']) {
    await step(`view "${v}" opens without errors`, async () => {
      await nav(v);
      await page.waitForTimeout(120);
      const locked = (await page.locator('.nav.locked:has-text("' + v + '")').count()) > 0;
      if (locked) expect((await bodyText()).includes('unlocks at'), 'locked view shows no unlock hint');
      else expect((await page.locator('h1').count()) > 0, 'no page heading');
    });
  }
  await step('goals: achievements and shows tabs, and the next-step advice', async () => {
    await nav('Goals');
    expect((await bodyText()).includes('What to do now'), 'no advice panel');
    await page.click('.tabs .tab:has-text("Achievements")');
    expect((await page.locator('.ach').count()) > 30, 'achievements missing');
    await page.click('.tabs .tab:has-text("Shows")');
    expect((await bodyText()).includes('Shows begin once you reach Stage 2'), 'shows tab should explain it is locked at Stage 1');
  });
  await step('the manual opens, is searchable, traps focus and closes on Escape', async () => {
    await page.click('button[aria-label="How to play"]');
    await page.waitForSelector('.modal');
    await page.fill('.help-nav input[type="search"]', 'allele');
    expect((await page.locator('.help-link').count()) >= 1, 'search found nothing for "allele"');
    for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.modal')), 'focus escaped the dialog');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect((await page.locator('.modal').count()) === 0, 'dialog did not close');
  });
  await step('feedback report is generated without personal data', async () => {
    await page.click('.side-feedback');
    await page.waitForSelector('.modal');
    await page.locator('.modal details summary').click();
    const rep = await page.locator('.modal pre').innerText();
    expect(/J2Grows playtest report/.test(rep) && /Summary/.test(rep), 'report missing sections');
    expect(!/@/.test(rep), 'report must not contain an email address');
    await page.keyboard.press('Escape');
  });
  await step('a corrupted save is repaired on load and the game still starts', async () => {
    const bad = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('j2grows.save.v1') || '{}');
      if (raw.plants && raw.plants[0]) { raw.plants[0].health = null; raw.plants[0].sp = 'not-a-plant'; }
      raw.money = null;
      localStorage.setItem('j2grows.save.v1', JSON.stringify(raw));
      return true;
    });
    expect(bad, 'could not corrupt the save');
    await page.reload();
    await page.waitForSelector('.app');
    expect((await page.locator('.nav').count()) > 5, 'game did not start from a damaged save');
    expect((await page.locator('.crash').count()) === 0, 'crash screen shown');
  });
  await step('collection species modal opens and closes', async () => {
    await nav('Collection');
    await page.locator('.sp-card, .species-card, .page button:has-text("new")').first().click();
    await page.waitForSelector('.modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect((await page.locator('.modal').count()) === 0, 'modal did not close with Escape');
  });

  console.log('Artwork settings and fallbacks');
  await step('switching to drawn plants shows no pictures and keeps the game working', async () => {
    await nav('Settings');
    await page.selectOption('#art', 'drawn');
    await nav('Market');
    await page.waitForTimeout(200);
    expect((await page.locator('.pic').count()) === 0, 'pictures still shown in drawn mode');
    expect((await page.locator('svg[role="img"]').count()) > 3, 'no drawn plants in drawn mode');
    await nav('Settings');
    await page.selectOption('#art', 'hero');
    await nav('Market');
    await page.waitForSelector('.pic img', { timeout: 4000 });
  });
  for (const mode of ['offline', 'missing']) {
    await step(`artwork ${mode}: every plant is drawn instead, no errors`, async () => {
      const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await installArtMock(c2, mode);
      const p3 = await c2.newPage();
      p3.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      await p3.goto(url);
      await p3.waitForSelector('.app');
      await p3.click('.nav:has-text("Market")');
      await p3.waitForTimeout(900);
      const r = await p3.evaluate(() => ({ pics: document.querySelectorAll('.pic img').length, svgs: document.querySelectorAll('svg[role="img"]').length, broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.offsetParent).length }));
      expect(r.pics === 0 && r.svgs > 3 && r.broken === 0, `pics ${r.pics}, drawn ${r.svgs}, broken ${r.broken}`);
      expect((await p3.locator('.banner').count()) === 0, 'banner placeholder left behind');
      await c2.close();
    });
  }

  console.log('Save, import, export');
  await nav('Settings');
  let exported = '';
  await step('export save produces JSON', async () => {
    await page.click('button:has-text("Export save")');
    exported = await page.inputValue('textarea[aria-label="Exported save"]');
    expect(/^[A-Za-z0-9+/=]+$/.test(exported) && exported.length > 500, 'exported save is not a base64 blob');
    expect(JSON.parse(Buffer.from(exported, 'base64').toString('utf8')).rooms.length >= 1, 'exported save does not decode to a game');
  });
  await step('import the exported save back', async () => {
    await page.fill('textarea[aria-label="Import save"]', exported);
    await page.click('button:has-text("Import save")');
    await page.waitForSelector('.toast.good, .toast');
  });
  await step('importing garbage is rejected', async () => {
    await page.fill('textarea[aria-label="Import save"]', 'not a save');
    await page.click('button:has-text("Import save")');
    await page.waitForTimeout(150);
    expect((await page.locator('.toast.bad').count()) > 0, 'no error toast for garbage import');
  });
  await step('reload keeps the game (autosave/save now)', async () => {
    await page.click('button:has-text("Save now")');
    await page.reload();
    await page.waitForSelector('.app');
    await nav('Settings');
    expect((await bodyText()).includes('Stage'), 'settings did not render after reload');
  });

  console.log('Welcome back');
  const saveJson = JSON.parse(await page.evaluate(() => localStorage.getItem('j2grows.save.v1')));
  saveJson.savedAt = Date.now() - 3 * 3600 * 1000;
  await step('a save three hours old shows the offline report', async () => {
    const p2 = await ctx.newPage();
    await p2.addInitScript((s) => { try { localStorage.setItem('j2grows.save.v1', s); } catch (e) {} }, JSON.stringify(saveJson));
    p2.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await p2.goto(url);
    await p2.waitForSelector('.app');
    await p2.waitForSelector('.modal-f .btn-primary:has-text("Back to the lab")', { timeout: 4000 });
    await p2.screenshot({ path: path.join(out, 'e2e-welcome-back.png') });
    await p2.click('.modal-f .btn-primary:has-text("Back to the lab")');
    await p2.close();
  });

  console.log('New game');
  await step('delete save and start over', async () => {
    await nav('Settings');
    await page.click('button:has-text("Delete save and start over")');
    await page.waitForSelector('.modal-f button:has-text("Delete everything")');
    await page.click('.modal-f button:has-text("Delete everything")');
    await page.waitForTimeout(300);
    await nav('Overview');
    expect((await bodyText()).includes('Personal Growing Room'), 'new game did not return to stage 1');
  });

  console.log('Phone viewport');
  await step('no horizontal overflow at 390px wide', async () => {
    const m = await ctx.newPage();
    m.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await m.setViewportSize({ width: 390, height: 844 });
    await m.goto(url);
    await m.waitForSelector('.app');
    const bad = [];
    for (const v of ['Overview', 'Cultivation', 'Market', 'Research', 'Laboratory', 'Collection', 'Settings']) {
      const n = m.locator(`.nav:has-text("${v}")`).first();
      if (!(await n.isVisible())) {
        const burger = m.locator('.menu-btn, .burger, [aria-label="Menu"], [aria-label="Open menu"]').first();
        if (await burger.count()) await burger.click();
      }
      await n.click({ timeout: 2000 }).catch(() => {});
      await m.waitForTimeout(150);
      const w = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if (w.sw > w.cw + 2) bad.push(`${v} (${w.sw}>${w.cw})`);
      await m.screenshot({ path: path.join(out, `e2e-mobile-${v.toLowerCase()}.png`) });
    }
    await m.close();
    expect(bad.length === 0, 'horizontal overflow on: ' + bad.join(', '));
  });

  await browser.close();
  server.close();
  if (errors.length) { failures.push(...errors); }
  if (failures.length) { console.log('\nFAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
  console.log('\nAll end-to-end checks passed. Screenshots in ' + out);
})().catch((e) => { console.error(e); process.exit(1); });
