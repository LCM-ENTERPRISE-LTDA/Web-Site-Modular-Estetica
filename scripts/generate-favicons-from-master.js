/**
 * Regenera assets de favicon a partir de favicon-master.png
 * Requer: npm install sharp to-ico
 * Uso: node scripts/generate-favicons-from-master.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const root = path.join(__dirname, '..');
const masterPath = path.join(root, 'favicon-master.png');

async function circleFromMaster(size, outName) {
  const out = path.join(root, outName);
  const mask = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">' +
    '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + (size / 2) + '" fill="#fff"/></svg>'
  );
  await sharp(masterPath)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('OK', outName, size + 'x' + size);
  return out;
}

(async () => {
  if (!fs.existsSync(masterPath)) throw new Error('missing ' + masterPath);

  const p16 = await circleFromMaster(16, 'favicon-16x16.png');
  const p32 = await circleFromMaster(32, 'favicon-32x32.png');
  const p48 = await circleFromMaster(48, 'favicon-48x48.png');
  await circleFromMaster(180, 'apple-touch-icon.png');
  await circleFromMaster(192, 'android-chrome-192x192.png');
  await circleFromMaster(512, 'android-chrome-512x512.png');

  const ico = await toIco([
    fs.readFileSync(p16),
    fs.readFileSync(p32),
    fs.readFileSync(p48)
  ]);
  fs.writeFileSync(path.join(root, 'favicon.ico'), ico);
  console.log('OK favicon.ico');
  fs.unlinkSync(p48);

  // favicon.svg = same mark (embedded) for browser consistency
  const buf = await sharp(path.join(root, 'android-chrome-512x512.png')).resize(256, 256).png().toBuffer();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Kelly Ferreira">\n' +
    '  <image width="256" height="256" href="data:image/png;base64,' + buf.toString('base64') + '"/>\n' +
    '</svg>\n';
  fs.writeFileSync(path.join(root, 'favicon.svg'), svg);
  console.log('OK favicon.svg');

  const manifest = {
    name: 'Kelly Regina Ferreira Correia',
    short_name: 'Kelly Ferreira',
    description: 'Estética Natural Integrativa — melasma, estrias e saúde capilar.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f4',
    theme_color: '#a05a30',
    icons: [
      { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  fs.writeFileSync(path.join(root, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('OK site.webmanifest');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
