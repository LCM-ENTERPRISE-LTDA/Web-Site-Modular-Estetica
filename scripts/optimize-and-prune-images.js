/**
 * Compacta imagens em uso (quase sem perda) e remove órfãs.
 * Uso: node scripts/optimize-and-prune-images.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function collectUsedRefs() {
  const files = walk(root).filter((f) =>
    /\.(html|css|js|webmanifest|json|xml)$/i.test(f)
  );
  let blob = '';
  for (const f of files) blob += '\n' + fs.readFileSync(f, 'utf8');

  const used = new Set();
  const re = /images\/[A-Za-z0-9._\-]+/g;
  let m;
  while ((m = re.exec(blob))) {
    const ref = m[0];
    if (ref.includes('...')) continue;
    used.add(ref.replace(/\\/g, '/'));
  }

  // Favicons / PWA / master source
  [
    'favicon.ico',
    'favicon.svg',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon-48x48.png',
    'apple-touch-icon.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'mask-icon.svg',
    'favicon-master.png'
  ].forEach((a) => used.add(a));

  return used;
}

async function optimizeFile(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const before = fs.statSync(absPath).size;
  const tmp = absPath + '.opt-tmp';

  try {
    const img = sharp(absPath, { failOn: 'none' }).rotate();
    const meta = await img.metadata();

    if (ext === '.png') {
      // Lossless PNG recompress; keep alpha
      await sharp(absPath, { failOn: 'none' })
        .rotate()
        .png({
          compressionLevel: 9,
          effort: 10,
          adaptiveFiltering: true,
          palette: false
        })
        .toFile(tmp);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // Alta qualidade (quase sem perda perceptível)
      await sharp(absPath, { failOn: 'none' })
        .rotate()
        .jpeg({
          quality: 90,
          mozjpeg: true,
          chromaSubsampling: '4:4:4'
        })
        .toFile(tmp);
    } else if (ext === '.webp') {
      await sharp(absPath, { failOn: 'none' })
        .rotate()
        .webp({ quality: 90, alphaQuality: 100 })
        .toFile(tmp);
    } else {
      // svg/ico/etc — skip
      return { skipped: true, before, after: before };
    }

    const after = fs.statSync(tmp).size;
    if (after < before) {
      fs.renameSync(tmp, absPath);
      return { skipped: false, before, after, saved: before - after };
    }
    // não piorar
    fs.unlinkSync(tmp);
    return { skipped: false, before, after: before, saved: 0 };
  } catch (e) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    return { skipped: true, before, after: before, error: e.message };
  }
}

(async () => {
  const used = collectUsedRefs();
  const imageFiles = walk(root).filter((f) =>
    /\.(png|jpe?g|webp|gif)$/i.test(f)
  );

  const unused = [];
  const usedFiles = [];

  for (const f of imageFiles) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    const base = path.basename(f);
    const key = rel.startsWith('images/') ? rel : base;
    if (used.has(key) || used.has('images/' + base)) usedFiles.push(f);
    else unused.push(f);
  }

  console.log('Used images:', usedFiles.length);
  console.log('Unused images:', unused.length);

  let deletedBytes = 0;
  for (const f of unused) {
    const sz = fs.statSync(f).size;
    deletedBytes += sz;
    fs.unlinkSync(f);
    console.log('DELETED', path.relative(root, f).replace(/\\/g, '/'));
  }

  let beforeTotal = 0;
  let afterTotal = 0;
  for (const f of usedFiles) {
    const res = await optimizeFile(f);
    beforeTotal += res.before;
    afterTotal += res.after;
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (res.error) console.log('ERR', rel, res.error);
    else if (res.saved > 0)
      console.log(
        'OPT',
        rel,
        (res.before / 1024).toFixed(0) + 'KB → ' + (res.after / 1024).toFixed(0) + 'KB',
        '(-' + ((res.saved / res.before) * 100).toFixed(1) + '%)'
      );
    else if (!res.skipped) console.log('KEEP', rel, '(já otimizado)');
  }

  console.log('---');
  console.log(
    'Deleted unused:',
    unused.length,
    'files,',
    (deletedBytes / 1024 / 1024).toFixed(2) + ' MB'
  );
  console.log(
    'Compressed used:',
    (beforeTotal / 1024 / 1024).toFixed(2) + ' MB → ' +
      (afterTotal / 1024 / 1024).toFixed(2) + ' MB',
    '(-' +
      (((beforeTotal - afterTotal) / Math.max(beforeTotal, 1)) * 100).toFixed(1) +
      '%)'
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
