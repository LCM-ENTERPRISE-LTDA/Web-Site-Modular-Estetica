/**
 * Align Tailwind CDN color configs with Design System v4.1 token HEX values.
 * Runtime theming still comes from CSS variables in design-system-v4.css;
 * these values keep opacity utilities (bg-paper/80) coherent with the scales.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const configs = {
  'facial.html': `    colors: {
      ink:'#2a2623', muted:'#5a504b', line:'#e8d8d2', paper:'#fbf7f5', wash:'#f7f0ec',
      terra:'#cca79d', terradark:'#9e766c', sand:'#efd9d2', sage:'#aaba7b', rose:'#cca79d'
    },`,
  'corporal.html': `    colors: {
      ink:'#332d29', muted:'#664e38', line:'#ead9c8', paper:'#f8f3ed', linen:'#f5ebe0',
      taupe:'#b89a7a', deep:'#4a392a', sage:'#aaba7b', rose:'#cca79d'
    },`,
  'capilar.html': `    colors: {
      ink:'#30382b', muted:'#5a663b', line:'#dce4c4', paper:'#f3f5ee', mist:'#eef1e3',
      mineral:'#8fa05e', deep:'#2f3521', sage:'#aaba7b'
    },`,
  'desinflamacao.html': `    colors: {
      ink:'#35402d', muted:'#4a5731', line:'#d5e0b8', paper:'#f5f7f0', mint:'#eaf0de', foam:'#f7f8f2',
      sage:'#95a866', deep:'#363f25'
    },`,
  'curriculo.html': `    colors: {
      ink:'#342e2b', muted:'#776d68', line:'#e6d9d5', paper:'#f4efec', wash:'#efd9d2',
      copper:'#b89086', deep:'#664a44'
    },`
};

const colorBlockRe = /colors:\s*\{[\s\S]*?\},/;

for (const [file, block] of Object.entries(configs)) {
  const p = path.join(root, file);
  let html = fs.readFileSync(p, 'utf8');
  if (!colorBlockRe.test(html)) {
    console.warn('no colors block', file);
    continue;
  }
  html = html.replace(colorBlockRe, block);
  // Ensure theme-color uses seed sage (brand chrome only)
  html = html.replace(/content="#aaba7b"/gi, 'content="#AABA7B"');
  fs.writeFileSync(p, html);
  console.log('tailwind colors synced', file);
}
