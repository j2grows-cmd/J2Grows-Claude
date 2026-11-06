// Stand-in for the Supabase artwork buckets, so the game can be exercised without network access.
//   const { installArtMock } = require('./mock-art.cjs');  await installArtMock(context, 'originals');
// ART_DIR=<folder> serves real files from <folder>/<bucket>/<path> when present.
// Modes:  'all'       resized (/render/image) and original (/object/public) requests succeed
//         'originals' the image transformer is unavailable (404), originals succeed   <- the free-plan case
//         'offline'   every request fails
//         'missing'   every request is a 404 (bucket empty)
const zlib = require('zlib');
const fs = require('fs');
const nodePath = require('path');

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** A w x h PNG: a plant-like blob on a flat dark background (or transparent when `alpha`). */
function png(w, h, hue, alpha = false) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  const hsl = (H, S, L) => { const a = S * Math.min(L, 1 - L); const f = (n) => { const k = (n + H / 30) % 12; return L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)); };
  const leaf = hsl(hue, 0.55, 0.38), vein = hsl(hue, 0.5, 0.6);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / (w * 0.34), ny = (y - h * 0.5) / (h * 0.4);
      const inside = nx * nx + ny * ny < 1 && !(Math.abs(nx) < 0.04 && ny < 0.9);
      const onVein = Math.abs(nx) < 0.025 && ny > -0.9 && ny < 0.9;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      const c = onVein ? vein : inside ? leaf : [10, 22, 16];
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = alpha && !inside && !onVein ? 0 : 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

async function installArtMock(context, mode = 'originals', stats = {}) {
  stats.render = 0; stats.object = 0; stats.failed = 0; stats.urls = new Set();
  await context.route(/lwaxzivcjzpmmantryor\.supabase\.co\/storage\//, (route) => {
    const url = route.request().url();
    const isRender = url.includes('/render/image/');
    isRender ? stats.render++ : stats.object++;
    stats.urls.add(decodeURIComponent(url.split('/public/')[1].split('?')[0]));
    if (mode === 'offline') { stats.failed++; return route.abort('internetdisconnected'); }
    if (mode === 'missing' || (mode === 'originals' && isRender)) { stats.failed++; return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{"error":"not found"}' }); }
    const path = decodeURIComponent(url.split('/public/')[1].split('?')[0]);
    // ART_DIR=<folder holding <bucket>/<file>> serves real pictures where they exist (e.g. the brand artwork)
    const real = process.env.ART_DIR && nodePath.join(process.env.ART_DIR, path);
    if (real && fs.existsSync(real)) return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }, body: fs.readFileSync(real) });
    const wide = /banner/.test(path);
    const body = wide ? png(480, 160, 130) : png(160, 160, hash(path) % 360);
    return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }, body });
  });
  return stats;
}
module.exports = { installArtMock, png };
