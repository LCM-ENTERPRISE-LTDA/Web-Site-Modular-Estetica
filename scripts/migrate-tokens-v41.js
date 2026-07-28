/**
 * Migrate pages to Design System v4.1 tokens:
 * - remove duplicated v4-protocol-theme blocks
 * - point focus/selection to CSS variables
 * - set data-theme on index
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function stripThemeBlock(html) {
  return html.replace(
    /\n?<style id="v4-protocol-theme">[\s\S]*?<\/style>\n?/g,
    '\n'
  );
}

function patchFocusSelection(html) {
  return html
    .replace(/::selection\{background:[^;]+;color:[^}]+\}/g, '::selection{background:var(--page-selection-bg);color:var(--page-selection-text)}')
    .replace(/a:focus-visible,button:focus-visible\{outline:2px solid #[0-9a-fA-F]+;outline-offset:3px;border-radius:4px\}/g,
      'a:focus-visible,button:focus-visible{outline:2px solid var(--color-focus);outline-offset:3px;border-radius:4px}');
}

const pages = [
  'facial.html',
  'corporal.html',
  'capilar.html',
  'desinflamacao.html',
  'curriculo.html'
];

for (const file of pages) {
  const p = path.join(root, file);
  let html = fs.readFileSync(p, 'utf8');
  html = stripThemeBlock(html);
  html = patchFocusSelection(html);
  fs.writeFileSync(p, html);
  console.log('updated', file);
}

// Index: data-theme + atmosphere tokens
let index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!index.includes('data-theme="vitrine"')) {
  index = index.replace('<html lang="pt-BR">', '<html lang="pt-BR" data-theme="vitrine">');
}

const atmosReplacements = [
  [
    `  background:
    radial-gradient(ellipse 90% 55% at 50% -8%, rgba(170, 186, 123, 0.22), transparent 58%),
    radial-gradient(ellipse 50% 40% at 100% 30%, rgba(239, 217, 210, 0.55), transparent 50%),
    radial-gradient(ellipse 45% 35% at 0% 70%, rgba(204, 167, 157, 0.18), transparent 55%),
    linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 38%, var(--surface) 100%);`,
    `  background:
    radial-gradient(ellipse 90% 55% at 50% -8%, var(--atmosphere-1), transparent 58%),
    radial-gradient(ellipse 50% 40% at 100% 30%, var(--atmosphere-2), transparent 50%),
    radial-gradient(ellipse 45% 35% at 0% 70%, var(--atmosphere-3), transparent 55%),
    linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 38%, var(--surface) 100%);`
  ],
  [
    `  box-shadow:
    0 0 0 1px rgba(170, 186, 123, 0.35),
    0 0 0 8px rgba(244, 239, 236, 0.9),
    0 0 0 9px rgba(204, 167, 157, 0.35),
    var(--shadow-md);`,
    `  box-shadow:
    0 0 0 1px var(--ring-sage),
    0 0 0 8px var(--ring-mist),
    0 0 0 9px var(--ring-rose),
    var(--shadow-md);`
  ],
  [
    `  box-shadow:
    0 0 0 1px rgba(170, 186, 123, 0.5),
    0 0 0 10px rgba(244, 239, 236, 0.95),
    0 0 0 11px rgba(204, 167, 157, 0.45),
    var(--shadow-lg);`,
    `  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--sage-400) 50%, transparent),
    0 0 0 10px color-mix(in srgb, var(--mist-100) 95%, transparent),
    0 0 0 11px color-mix(in srgb, var(--rose-400) 45%, transparent),
    var(--shadow-lg);`
  ],
  [':focus-visible {\n  outline: 2px solid var(--primary);\n  outline-offset: 3px;\n}',
   ':focus-visible {\n  outline: 2px solid var(--color-focus);\n  outline-offset: 3px;\n}'],
  ['.vcard--facial { --accent-line: var(--primary); }',
   '.vcard--facial { --accent-line: var(--accent-facial); }'],
  ['.vcard--corporal { --accent-line: var(--rose); }',
   '.vcard--corporal { --accent-line: var(--accent-corporal); }'],
  ['.vcard--capilar { --accent-line: var(--primary-deep); }',
   '.vcard--capilar { --accent-line: var(--accent-capilar); }'],
  ['.vcard--desinflamacao { --accent-line: #8fa36a; }',
   '.vcard--desinflamacao { --accent-line: var(--accent-desinflamacao); }'],
  ['.vcard--curriculo { --accent-line: var(--rose-deep); }',
   '.vcard--curriculo { --accent-line: var(--accent-curriculo); }'],
];

for (const [from, to] of atmosReplacements) {
  if (index.includes(from)) index = index.split(from).join(to);
  else console.warn('miss:', from.slice(0, 60));
}

// Badge / action / contact soft fills → tokens
index = index
  .replace(/background: rgba\(170, 186, 123, 0\.22\);/g, 'background: color-mix(in srgb, var(--sage-400) 22%, transparent);')
  .replace(/border: 1px solid rgba\(170, 186, 123, 0\.4\);/g, 'border: 1px solid color-mix(in srgb, var(--sage-400) 40%, transparent);')
  .replace(/background: rgba\(170, 186, 123, 0\.12\);/g, 'background: color-mix(in srgb, var(--sage-400) 12%, transparent);')
  .replace(/background: var\(--primary\);\n  color: #fff;/g, 'background: var(--color-btn-primary-bg);\n  color: var(--color-btn-primary-text);')
  .replace(/background: var\(--primary-deep\);/g, 'background: var(--color-cta-bg);')
  .replace(/\.clinic-cta:hover \{\n  background: var\(--primary\);/, '.clinic-cta:hover {\n  background: var(--color-cta-bg-hover);')
  .replace(/color: var\(--primary-deep\);/g, 'color: var(--color-link);')
  .replace(/color: var\(--rose-deep\);/g, 'color: var(--color-link-hover);');

fs.writeFileSync(path.join(root, 'index.html'), index);
console.log('updated index.html');
