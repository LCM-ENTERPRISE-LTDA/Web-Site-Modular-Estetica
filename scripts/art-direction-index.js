/**
 * Art-direction pass for index — CSS + light structural wrappers only.
 * Preserves content, avatar-wrap, card-img, data-img-*, scripts, SEO.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const css = `/* ═══════════════════════════════════════════════════════════
   INDEX — Art Direction Final
   Editorial cover · quiet luxury · mobile-first
═══════════════════════════════════════════════════════════ */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--mist-800);
  background: var(--mist-50);
  min-height: 100dvh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

img { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
ul { list-style: none; }

:focus-visible {
  outline: 2px solid var(--sage-600);
  outline-offset: 3px;
}

/* Quiet field — one atmosphere, not competing washes */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 90% 55% at 70% -5%, color-mix(in srgb, var(--blush-200) 40%, transparent), transparent 58%),
    radial-gradient(ellipse 70% 45% at 0% 40%, color-mix(in srgb, var(--sage-200) 18%, transparent), transparent 55%),
    linear-gradient(180deg, var(--mist-50) 0%, #faf7f4 100%);
}

.shell {
  width: 100%;
  padding-bottom: max(3rem, env(safe-area-inset-bottom));
}

.band-inner {
  width: min(100% - 1.75rem, 24.5rem);
  margin-inline: auto;
}

/* ═══════════════ HERO — magazine cover ═══════════════ */
.hero-band {
  padding:
    clamp(2.25rem, 8vw, 4rem)
    0
    clamp(3rem, 10vw, 5rem);
}

.hero {
  width: min(100% - 1.75rem, 24.5rem);
  margin-inline: auto;
  position: relative;
}

/* Asymmetric stage: portrait + soft graphic depth */
.hero-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-height: clamp(13rem, 48vw, 16rem);
  margin-bottom: -1.35rem;
}

.hero-orb {
  position: absolute;
  width: clamp(11.5rem, 52vw, 14.5rem);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--rose-400) 28%, transparent);
  transform: translate(10%, -4%);
  pointer-events: none;
}

.hero-orb--soft {
  width: clamp(13rem, 58vw, 16.5rem);
  border-color: color-mix(in srgb, var(--sage-400) 18%, transparent);
  transform: translate(-8%, 6%);
  opacity: 0.7;
}

.hero-kicker {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  max-width: 9.5rem;
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  line-height: 1.55;
  color: var(--mist-600);
  text-align: left;
}

.avatar-wrap {
  position: relative;
  z-index: 1;
  width: clamp(10.5rem, 46vw, 13rem);
  aspect-ratio: 1;
  margin: 1.5rem auto 0;
  border-radius: 50%;
  overflow: hidden;
  background: var(--mist-100);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--mist-900) 6%, transparent),
    0 24px 48px color-mix(in srgb, var(--mist-900) 10%, transparent);
  transform: translateX(6%);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 2.6rem;
  color: var(--sage-700);
  background: var(--blush-200);
}

.hero-copy {
  position: relative;
  z-index: 2;
  text-align: left;
  padding-top: 0.25rem;
}

.hero-name {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(2.55rem, 11vw, 3.55rem);
  line-height: 0.98;
  letter-spacing: -0.03em;
  color: var(--mist-900);
  margin-bottom: 0.85rem;
  max-width: 11ch;
}

.hero-name em {
  display: inline;
  font-style: italic;
  font-weight: 400;
  color: var(--sage-700);
}

.hero-credential {
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--rose-600);
  margin-bottom: 1.1rem;
}

.hero-tagline {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  font-size: clamp(1.05rem, 3.8vw, 1.2rem);
  line-height: 1.45;
  color: var(--mist-700);
  max-width: 19rem;
  margin-bottom: 1.65rem;
}

.hero-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 52px;
  padding: 0.85rem 1.55rem;
  border-radius: 999px;
  background: var(--mist-900);
  color: var(--mist-50);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  transition: background 0.35s ease, transform 0.35s var(--ease-out);
}

.hero-cta svg { width: 1.05rem; height: 1.05rem; }

.hero-cta:hover {
  background: var(--sage-800);
  transform: translateY(-1px);
}

.hero-cta:active { transform: none; }

@media (prefers-reduced-motion: no-preference) {
  .hero-stage,
  .hero-copy {
    animation: coverIn 0.9s var(--ease-out) both;
  }
  .hero-copy { animation-delay: 0.12s; }
}

@keyframes coverIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

/* ═══════════════ PROTOCOLS — editorial index ═══════════════ */
.protocols-band {
  padding: clamp(2.5rem, 8vw, 4.5rem) 0 clamp(1.5rem, 4vw, 2rem);
}

.section-intro {
  margin-bottom: clamp(1.75rem, 5vw, 2.5rem);
  text-align: left;
}

.section-label {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(1.85rem, 7vw, 2.35rem);
  letter-spacing: -0.025em;
  line-height: 1.05;
  color: var(--mist-900);
  margin-bottom: 0.75rem;
}

.section-lead {
  font-size: 0.95rem;
  line-height: 1.65;
  font-weight: 300;
  color: var(--mist-700);
  max-width: 22rem;
}

.protocol-grid {
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
}

/* Editorial plate — image dissolves into type */
.pcard {
  position: relative;
  display: block;
  background: transparent;
  border: 0;
  border-radius: 0;
  overflow: visible;
  isolation: isolate;
  transition: opacity 0.35s ease;
}

.pcard:hover { opacity: 0.96; }

.pcard--facial { --pcard-accent: var(--accent-facial); }
.pcard--corporal { --pcard-accent: var(--accent-corporal); }
.pcard--capilar { --pcard-accent: var(--accent-capilar); }
.pcard--desinflamacao { --pcard-accent: var(--accent-desinflamacao); }
.pcard--curriculo { --pcard-accent: var(--accent-curriculo); }

.pcard__badge {
  position: absolute;
  top: 0.85rem;
  left: 0.85rem;
  z-index: 3;
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--mist-800);
  background: color-mix(in srgb, var(--mist-50) 82%, transparent);
  backdrop-filter: blur(8px);
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
}

.pcard__media {
  position: relative;
  aspect-ratio: 5 / 4;
  overflow: hidden;
  border-radius: 1.25rem;
  background: var(--mist-100);
}

.pcard__media::after {
  content: "";
  position: absolute;
  inset: 45% 0 0;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--mist-50) 92%, transparent) 0%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
}

.pcard__media .card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.7s var(--ease-out);
}

.pcard:hover .card-img {
  transform: scale(1.035);
}

.pcard__body {
  position: relative;
  z-index: 2;
  margin-top: -2.75rem;
  padding: 0 0.35rem 0.15rem;
}

.pcard__eyebrow {
  display: inline-block;
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--pcard-accent, var(--sage-700));
  margin-bottom: 0.35rem;
}

.pcard__title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(1.7rem, 6.5vw, 2rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--mist-900);
  margin-bottom: 0.45rem;
}

.pcard__title em {
  font-style: italic;
  font-weight: 400;
}

.pcard__desc {
  font-size: 0.875rem;
  line-height: 1.55;
  font-weight: 300;
  color: var(--mist-700);
  max-width: 28ch;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pcard__cta {
  display: inline-flex;
  align-items: center;
  margin-top: 0.85rem;
  width: 1.75rem;
  height: 1.75rem;
  color: var(--mist-800);
  transition: transform 0.35s var(--ease-out), color 0.35s ease;
}

.pcard__cta svg {
  width: 1.1rem;
  height: 1.1rem;
}

.pcard:hover .pcard__cta {
  color: var(--pcard-accent, var(--sage-700));
  transform: translateX(4px);
}

/* ═══════════════ CONTACT — quiet secondary ═══════════════ */
.contact-band {
  padding: clamp(2.5rem, 7vw, 3.5rem) 0 0.5rem;
}

.contact-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  align-items: center;
}

.contact-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 48px;
  padding: 0.55rem 0.15rem;
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--mist-800);
  border-bottom: 1px solid color-mix(in srgb, var(--mist-800) 18%, transparent);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  transition: color 0.3s ease, border-color 0.3s ease;
}

.contact-link--primary {
  padding: 0.7rem 1.25rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--mist-800);
  border: 1px solid color-mix(in srgb, var(--mist-800) 18%, transparent);
}

.contact-link:hover {
  color: var(--sage-800);
  border-bottom-color: var(--sage-700);
  transform: none;
  box-shadow: none;
}

.contact-link--primary:hover {
  border-color: var(--sage-700);
  background: color-mix(in srgb, var(--sage-100) 55%, transparent);
}

.contact-icon {
  width: 1rem;
  height: 1rem;
  display: grid;
  place-items: center;
  color: inherit;
}

.contact-icon svg { width: 100%; height: 100%; }

/* ═══════════════ CLINIC ═══════════════ */
.clinic-band {
  padding: clamp(2.25rem, 7vw, 3.5rem) 0 0;
}

.clinic-card {
  text-align: left;
  padding: clamp(1.6rem, 5vw, 2rem) clamp(1.2rem, 4vw, 1.6rem);
  border-radius: 1.5rem;
  border: 0;
  background: color-mix(in srgb, var(--blush-100) 55%, var(--mist-50));
  box-shadow: none;
}

.clinic-eyebrow {
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--rose-600);
  margin-bottom: 1rem;
}

.clinic-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 48px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--mist-900);
  font-size: 1.05rem;
  font-family: var(--font-display);
  font-weight: 500;
  letter-spacing: -0.01em;
  margin-bottom: 0.65rem;
  box-shadow: none;
  border-bottom: 1px solid color-mix(in srgb, var(--mist-900) 25%, transparent);
  transition: color 0.3s ease, border-color 0.3s ease;
}

.clinic-cta svg { width: 1rem; height: 1rem; }

.clinic-cta:hover {
  color: var(--rose-700);
  border-bottom-color: var(--rose-500);
  background: transparent;
  transform: none;
  box-shadow: none;
}

.clinic-address {
  font-style: normal;
  font-size: 0.875rem;
  font-weight: 300;
  color: var(--mist-700);
  line-height: 1.55;
}

/* ═══════════════ FOOTER ═══════════════ */
footer {
  margin-top: clamp(3rem, 9vw, 4.5rem);
  padding-top: 0;
  border-top: 0;
  text-align: left;
}

.footer-wordmark {
  display: block;
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 500;
  letter-spacing: -0.015em;
  color: var(--mist-900);
  margin-bottom: 1rem;
}

.footer-line,
.footer-name-line,
.footer-spec-line,
.footer-disclaimer,
.footer-credit {
  font-size: 0.72rem;
  font-weight: 300;
  color: var(--mist-600);
  line-height: 1.6;
  margin-bottom: 0.28rem;
}

.footer-disclaimer {
  max-width: 24rem;
  margin: 0.85rem 0;
}

.footer-credit a {
  color: var(--mist-800);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.footer-credit a:hover { color: var(--sage-800); }

/* ═══════════════ REVEAL — quieter ═══════════════ */
.reveal {
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 0.7s var(--ease-out),
    transform 0.7s var(--ease-out);
}

.reveal.visible {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .hero-stage,
  .hero-copy,
  .reveal,
  .pcard__media .card-img,
  .pcard__cta,
  .contact-link,
  .clinic-cta,
  .hero-cta {
    animation: none !important;
    transition: none !important;
  }
  .reveal { opacity: 1; transform: none; }
  .pcard:hover .card-img,
  .pcard:hover .pcard__cta,
  .hero-cta:hover { transform: none; }
}

/* ═══════════════ BREAKPOINTS ═══════════════ */
@media (min-width: 390px) {
  .band-inner,
  .hero { width: min(100% - 2rem, 25.5rem); }
}

@media (min-width: 480px) {
  .band-inner,
  .hero { width: min(100% - 2.25rem, 28rem); }
  .pcard__desc { -webkit-line-clamp: 2; max-width: 34ch; }
}

@media (min-width: 768px) {
  .band-inner,
  .hero { width: min(100% - 3rem, 44rem); }

  .hero-band {
    padding-block: 4.5rem 5.5rem;
  }

  .hero {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    gap: 1.5rem 2.5rem;
    align-items: end;
  }

  .hero-stage {
    grid-column: 2;
    grid-row: 1;
    min-height: 22rem;
    margin-bottom: 0;
  }

  .hero-copy {
    grid-column: 1;
    grid-row: 1;
    padding-bottom: 1.25rem;
  }

  .hero-kicker {
    position: static;
    max-width: none;
    margin-bottom: 1.75rem;
  }

  .avatar-wrap {
    width: 15.5rem;
    margin: 0;
    transform: translate(8%, 0);
  }

  .hero-orb { transform: translate(18%, -8%); }
  .hero-orb--soft { transform: translate(-4%, 10%); }

  .hero-name {
    font-size: clamp(3.2rem, 5.5vw, 4.1rem);
    max-width: 9ch;
  }

  .protocols-band { padding-block: 4rem 2rem; }

  .section-intro {
    max-width: 28rem;
    margin-bottom: 2.75rem;
  }

  .protocol-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2.25rem 1.75rem;
  }

  .pcard--facial {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 0 1.75rem;
    align-items: end;
  }

  .pcard--facial .pcard__media {
    aspect-ratio: 16 / 10;
    margin: 0;
  }

  .pcard--facial .pcard__media::after {
    inset: 0 35% 0 0;
    background: linear-gradient(
      to left,
      color-mix(in srgb, var(--mist-50) 88%, transparent),
      transparent 70%
    );
  }

  .pcard--facial .pcard__body {
    margin-top: 0;
    padding: 0 0 1rem;
  }

  .pcard--facial .pcard__badge {
    left: 1rem;
  }

  .contact-band,
  .clinic-band { padding-top: 3.25rem; }

  footer { margin-top: 4.5rem; }
}

@media (min-width: 1024px) {
  .band-inner,
  .hero { width: min(100% - 4rem, 56rem); }

  .avatar-wrap { width: 17rem; }

  .hero-name { font-size: 4.35rem; }

  .protocol-grid { gap: 2.75rem 2rem; }
}

@media (min-width: 1280px) {
  .band-inner,
  .hero { width: min(100% - 5rem, 60rem); }
}
`;

// Replace style block
html = html.replace(/<style>[\s\S]*?<\/style>/, `<style>\n${css}\n  </style>`);

// Restructure hero for magazine composition (preserve content + avatar)
const oldHero = html.match(/<header class="hero-band">[\s\S]*?<\/header>/);
if (!oldHero) throw new Error('hero not found');

const avatar = html.match(/<figure class="avatar-wrap">[\s\S]*?<\/figure>/)[0];

const newHero = `<header class="hero-band">
      <section class="hero" aria-label="Apresentação de Kelly Regina Ferreira Correia">
        <div class="hero-stage">
          <span class="hero-orb hero-orb--soft" aria-hidden="true"></span>
          <span class="hero-orb" aria-hidden="true"></span>
          <p class="hero-kicker">Estética Natural Integrativa</p>
          ${avatar}
        </div>
        <div class="hero-copy">
          <h1 class="hero-name">Kelly Regina <em>Ferreira</em></h1>
          <p class="hero-credential">Terapeuta Naturalista Integrativa</p>
          <p class="hero-tagline">Cuidado clínico, leveza e escuta — para a pele, o corpo e o equilíbrio que sustentam a beleza.</p>
          <a class="hero-cta" href="https://wa.me/5511982899981?text=Ol%C3%A1%20Kelly%2C%20gostaria%20de%20agendar%20minha%20avalia%C3%A7%C3%A3o!" target="_blank" rel="noopener noreferrer" aria-label="Agendar avaliação com Kelly Regina pelo WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg>
            WhatsApp
          </a>
        </div>
      </section>
    </header>`;

html = html.replace(oldHero[0], newHero);

// Wrap section heading for editorial intro
html = html.replace(
  `<div class="band-inner">
          <h2 class="section-label" id="products-heading">Protocolos de cuidado</h2>
          <p class="section-lead">Cada protocolo nasce de uma leitura individual do organismo — com ética, delicadeza e profundidade.</p>`,
  `<div class="band-inner">
          <div class="section-intro">
            <h2 class="section-label" id="products-heading">Protocolos de cuidado</h2>
            <p class="section-lead">Cada protocolo nasce de uma leitura individual do organismo — com ética, delicadeza e profundidade.</p>
          </div>`
);

fs.writeFileSync(htmlPath, html);
console.log('art direction applied');
