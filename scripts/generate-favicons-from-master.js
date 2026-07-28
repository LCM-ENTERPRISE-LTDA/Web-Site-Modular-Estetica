/**
 * Favicon oficial — monograma K + lotus com disco de suporte discreto.
 *
 * Problema: monograma branco some em abas claras.
 * Solução: fundo circular em carvão quente da marca (não preto absoluto),
 * borda 1px óptica, monograma ~86–90% do diâmetro útil.
 *
 * Uso: node scripts/generate-favicons-from-master.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const root = path.join(__dirname, '..');
const masterPath = path.join(root, 'favicon-master.png');
const VERSION = '20260728d';

/** Disco de suporte — espresso / carvão quente (paleta do site) */
const DISC = {
  // derivado de mist-900 / copper-900 — grafite quente
  fill: { r: 42, g: 36, b: 32, alpha: 1 }, // #2a2420
  // borda óptica discreta (copper suave, baixa opacidade)
  stroke: { r: 161, g: 121, b: 69, alpha: 0.28 }, // copper-500 @ 28%
  strokeWidthRatio: 0.035 // ~1px óptico em 32px
};

/** Fração do diâmetro ocupada pelo monograma (protagonista) */
const MARK_RATIO = {
  16: 0.88,
  32: 0.88,
  48: 0.89,
  180: 0.86,
  192: 0.86,
  512: 0.85,
  256: 0.86
};

async function extractMonogram() {
  const { data, info } = await sharp(masterPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  let sumX = 0;
  let sumA = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      if (lum <= 16) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        continue;
      }

      // Preserva branco do K + cinza do lotus; alpha suave na borda
      const edge = Math.min(1, (lum - 16) / 28);
      data[i + 3] = Math.round(255 * edge);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x * data[i + 3];
      sumA += data[i + 3];
    }
  }

  if (!sumA) throw new Error('No monogram content found');

  const bbox = {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
  const massCx = sumX / sumA;
  const geomCx = minX + bbox.width / 2;
  const opticalBiasPx = massCx - geomCx;

  const cropped = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .extract(bbox)
    .png()
    .toBuffer();

  return { cropped, bbox, opticalBiasPx };
}

function discSvg(size) {
  const cx = size / 2;
  const cy = size / 2;
  // margem mínima do canvas → disco quase full (evita “app icon” gordo)
  const pad = Math.max(0.5, size * 0.02);
  const r = size / 2 - pad;
  const sw = Math.max(0.6, size * DISC.strokeWidthRatio);
  const { r: fr, g: fg, b: fb, alpha: fa } = DISC.fill;
  const { r: sr, g: sg, b: sb, alpha: sa } = DISC.stroke;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(${fr},${fg},${fb},${fa})"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r - sw / 2}" fill="none" stroke="rgba(${sr},${sg},${sb},${sa})" stroke-width="${sw}"/>` +
      `</svg>`
  );
}

async function buildFavicon(size) {
  const ratio = MARK_RATIO[size] != null ? MARK_RATIO[size] : 0.86;
  const { cropped, bbox, opticalBiasPx } = await extractMonogram();

  const discPad = Math.max(0.5, size * 0.02);
  const discDiameter = size - discPad * 2;
  const markMax = Math.max(1, Math.round(discDiameter * ratio));

  let mark = sharp(cropped).resize(markMax, markMax, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3
  });

  if (size <= 48) {
    mark = mark.sharpen({
      sigma: size <= 16 ? 1.1 : size <= 32 ? 0.8 : 0.45
    });
  }
  if (size <= 16) {
    // realça lotus cinza em 16px sem alterar o K
    mark = mark.linear(1.12, -3);
  }

  const markBuf = await mark.png().toBuffer();
  const markMeta = await sharp(markBuf).metadata();

  // Offset óptico (haste do K à esquerda)
  const scale = markMeta.width / bbox.width;
  let dx = -opticalBiasPx * scale;
  const maxShift = size * 0.025;
  if (dx > maxShift) dx = maxShift;
  if (dx < -maxShift) dx = -maxShift;

  const left = Math.round((size - markMeta.width) / 2 + dx);
  const top = Math.round((size - markMeta.height) / 2);

  const disc = await sharp(discSvg(size)).png().toBuffer();

  // Sombra só em tamanhos médios/grandes (some em 16–32)
  const layers = [{ input: disc, left: 0, top: 0 }];

  if (size >= 48) {
    const shadowR = size / 2 - discPad;
    const shadowSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
        `<circle cx="${size / 2}" cy="${size / 2 + size * 0.01}" r="${shadowR}" fill="rgba(20,16,12,0.18)"/>` +
        `</svg>`
    );
    const shadow = await sharp(shadowSvg).blur(Math.max(0.5, size * 0.012)).png().toBuffer();
    layers.unshift({ input: shadow, left: 0, top: 0 });
  }

  layers.push({
    input: markBuf,
    left: Math.max(0, Math.min(size - markMeta.width, left)),
    top: Math.max(0, Math.min(size - markMeta.height, top))
  });

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(layers)
    .png({ compressionLevel: 9 });
}

async function writePng(size, outName) {
  const out = path.join(root, outName);
  await (await buildFavicon(size)).toFile(out);
  const ratio = MARK_RATIO[size] != null ? MARK_RATIO[size] : 0.86;
  console.log('OK', outName, size + 'x' + size, 'mark≈' + Math.round(ratio * 100) + '%');
  return out;
}

async function buildMaskSvg() {
  // Safari pinned tab: silhueta do monograma (sem disco)
  const { cropped } = await extractMonogram();
  const { data, info } = await sharp(cropped)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 20) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    } else {
      data[i + 3] = 0;
    }
  }

  const pad = 6;
  const w = info.width + pad * 2;
  const h = info.height + pad * 2;
  const sil = await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      {
        input: await sharp(data, {
          raw: { width: info.width, height: info.height, channels: 4 }
        })
          .png()
          .toBuffer(),
        left: pad,
        top: pad
      }
    ])
    .png()
    .toBuffer();

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    w +
    ' ' +
    h +
    '" width="' +
    w +
    '" height="' +
    h +
    '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kelly Regina Ferreira">\n' +
    '  <image width="' +
    w +
    '" height="' +
    h +
    '" href="data:image/png;base64,' +
    sil.toString('base64') +
    '"/>\n' +
    '</svg>\n'
  );
}

(async () => {
  if (!fs.existsSync(masterPath)) throw new Error('missing ' + masterPath);

  console.log('mode: soft brand disc + white monogram');
  console.log('disc fill #2a2420 · stroke copper @28%');

  const p16 = await writePng(16, 'favicon-16x16.png');
  const p32 = await writePng(32, 'favicon-32x32.png');
  const p48 = await writePng(48, 'favicon-48x48.png');

  await writePng(180, 'apple-touch-icon.png');
  await writePng(192, 'android-chrome-192x192.png');
  await writePng(512, 'android-chrome-512x512.png');

  const ico = await toIco([
    fs.readFileSync(p16),
    fs.readFileSync(p32),
    fs.readFileSync(p48)
  ]);
  fs.writeFileSync(path.join(root, 'favicon.ico'), ico);
  console.log('OK favicon.ico');

  // SVG vetorial limpo: disco + monograma raster fiel
  const size = 256;
  const fav = await (await buildFavicon(size)).png().toBuffer();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    size +
    ' ' +
    size +
    '" width="' +
    size +
    '" height="' +
    size +
    '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kelly Regina Ferreira">\n' +
    '  <image width="' +
    size +
    '" height="' +
    size +
    '" href="data:image/png;base64,' +
    fav.toString('base64') +
    '" preserveAspectRatio="xMidYMid meet"/>\n' +
    '</svg>\n';
  fs.writeFileSync(path.join(root, 'favicon.svg'), svg);
  console.log('OK favicon.svg');

  fs.writeFileSync(path.join(root, 'mask-icon.svg'), await buildMaskSvg());
  console.log('OK mask-icon.svg');

  const manifest = {
    name: 'Kelly Regina Ferreira Correia',
    short_name: 'Kelly Ferreira',
    description: 'Estética Natural Integrativa — melasma, estrias e saúde capilar.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f4',
    theme_color: '#aaba7b',
    icons: [
      {
        src: 'android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
  fs.writeFileSync(path.join(root, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('OK site.webmanifest');
  console.log('Done. favicon version', VERSION);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
