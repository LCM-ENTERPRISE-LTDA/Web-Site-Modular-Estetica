const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const avatarMatch = html.match(/<img class="avatar-img"[\s\S]*?>/);
if (!avatarMatch) throw new Error('avatar not found');
let avatarImg = avatarMatch[0]
  .replace(/object-fit:\s*fill/gi, 'object-fit: cover');

const cardBlocks = [...html.matchAll(/<a class="product-card[\s\S]*?<\/a>/g)].map((m) => m[0]);
if (cardBlocks.length < 5) throw new Error('expected 5 cards, got ' + cardBlocks.length);

function extract(card, re, fallback) {
  const m = card.match(re);
  return m ? m[1] : fallback;
}

function extractImg(card) {
  const m = card.match(/<img class="card-img"[\s\S]*?>/);
  if (!m) return '';
  return m[0].replace(/object-fit:\s*fill/gi, 'object-fit: cover');
}

const cardMeta = [
  {
    href: 'facial.html',
    tone: 'facial',
    eyebrow: 'Protocolo Facial',
    title: 'Facial',
    titleHtml: '<em>Facial</em>',
    desc: 'Cuidado integrativo para o rosto — equilíbrio da pele e acolhimento clínico, com escuta individual.',
    badge: 'Em destaque',
    aria: 'Protocolo Facial — cuidado integrativo para melasma e saúde da pele'
  },
  {
    href: 'corporal.html',
    tone: 'corporal',
    eyebrow: 'Protocolo Corporal',
    title: 'Corporal',
    titleHtml: '<em>Corporal</em>',
    desc: 'Regeneração do tecido e conforto com o próprio corpo — uma abordagem orgânica e paciente.',
    badge: null,
    aria: 'Protocolo Corporal — regeneração e cuidado com a pele do corpo'
  },
  {
    href: 'capilar.html',
    tone: 'capilar',
    eyebrow: 'Protocolo Capilar',
    title: 'Capilar',
    titleHtml: '<em>Capilar</em>',
    desc: 'Saúde do couro cabeludo com rigor científico e delicadeza — da raiz à vitalidade do fio.',
    badge: null,
    aria: 'Protocolo Capilar — saúde do couro cabeludo e do fio'
  },
  {
    href: 'desinflamacao.html',
    tone: 'desinflamacao',
    eyebrow: 'Reequilíbrio',
    title: 'Desinflamação',
    titleHtml: '<em>Desinflamação</em>',
    desc: 'Um guia para compreender o organismo e cultivar leveza — de dentro para fora, com responsabilidade.',
    badge: null,
    aria: 'Desinflamação e Reequilíbrio — guia integrativo'
  },
  {
    href: 'curriculo.html',
    tone: 'curriculo',
    eyebrow: 'Trajetória',
    title: 'Quem sou eu',
    titleHtml: '<em>Quem</em> sou eu',
    desc: 'Formação, propósito e o cuidado humanizado que orienta cada protocolo.',
    badge: null,
    aria: 'Currículo — conheça a trajetória de Kelly Regina Ferreira'
  }
];

const cardsHtml = cardMeta.map((meta, i) => {
  const srcCard = cardBlocks[i];
  const img = extractImg(srcCard);
  const badge = meta.badge
    ? `<span class="vcard__badge">${meta.badge}</span>`
    : '';
  return `          <li>
            <a class="vcard vcard--${meta.tone} reveal" href="${meta.href}" aria-label="${meta.aria}">
              ${badge}
              <div class="vcard__media" aria-hidden="true">${img}</div>
              <div class="vcard__body">
                <span class="vcard__eyebrow">${meta.eyebrow}</span>
                <h3 class="vcard__title">${meta.titleHtml}</h3>
                <p class="vcard__desc">${meta.desc}</p>
              </div>
              <span class="vcard__action" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
            </a>
          </li>`;
}).join('\n\n');

const css = fs.readFileSync(path.join(__dirname, 'index-v4-styles.css'), 'utf8');

const out = `<!DOCTYPE html>
<html lang="pt-BR"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="color-scheme" content="light only">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#aaba7b">
  <meta name="author" content="Kelly Regina Ferreira Correia">

  <title>Kelly Regina Ferreira Correia | Estética Natural Integrativa</title>
  <meta name="description" content="Kelly Regina Ferreira Correia — Terapeuta Naturalista Integrativa. Protocolos de estética natural para pele, corpo e couro cabeludo, com escuta clínica e cuidado humanizado.">
  <meta name="keywords" content="estética natural integrativa, melasma, estrias, saúde capilar, desinflamação, Kelly Regina Ferreira Correia, terapeuta naturalista">
  <link rel="canonical" href="https://kellyregina.com.br/">

  <meta property="og:title" content="Kelly Regina Ferreira Correia | Estética Natural Integrativa">
  <meta property="og:description" content="Estética natural com escuta clínica — protocolos individualizados para pele, corpo e couro cabeludo.">
  <meta property="og:image" content="https://kellyregina.com.br/images/1-46.png">
  <meta property="og:url" content="https://kellyregina.com.br/">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="Kelly Regina Ferreira Correia">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Kelly Regina Ferreira Correia | Estética Natural Integrativa">
  <meta name="twitter:description" content="Protocolos de estética natural integrativa — cuidado de dentro para fora.">
  <meta name="twitter:image" content="https://kellyregina.com.br/images/1-46.png">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "name": "Kelly Regina Ferreira Correia — Estética Natural Integrativa",
    "url": "https://kellyregina.com.br",
    "image": "https://kellyregina.com.br/images/1-46.png",
    "description": "Terapeuta Naturalista Integrativa. Protocolos naturais e individualizados para pele, corpo e couro cabeludo.",
    "priceRange": "$$",
    "telephone": "+5511982899981",
    "email": "contato@kellyregina.com.br",
    "taxID": "62.485.112/0001-37",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Avenida General Pedro Pinho, 463 - Sala 05",
      "addressCountry": "BR"
    },
    "sameAs": ["https://www.instagram.com/kellyferreira.oficial"],
    "areaServed": "Brasil"
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/design-system-v4.css">
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
  <link rel="preload" as="image" href="images/1-61.png" fetchpriority="high">

  <style>
${css}
  </style>
</head>
<body>

  <div class="page-wrap">

    <header>
      <section class="hero" aria-label="Apresentação de Kelly Regina Ferreira Correia">
        <p class="hero-kicker">Estética Natural Integrativa</p>
        <figure class="avatar-wrap">
          ${avatarImg}
          <div class="avatar-fallback" style="display:none;" aria-hidden="true">KF</div>
        </figure>

        <h1 class="hero-name">Kelly Regina <em>Ferreira</em></h1>
        <p class="hero-credential">Terapeuta Naturalista Integrativa</p>
        <p class="hero-tagline">Cuidado clínico, leveza e escuta — para a pele, o corpo e o equilíbrio que sustentam a beleza.</p>
      </section>
    </header>

    <main>
      <section class="reveal" aria-labelledby="products-heading">
        <div class="divider" aria-hidden="true"><span></span></div>
        <h2 class="section-label" id="products-heading">Protocolos de cuidado</h2>
        <p class="section-lead">Cada protocolo nasce de uma leitura individual do organismo — com ética, delicadeza e profundidade.</p>

        <ul class="products-stack" id="vitrine">
${cardsHtml}
        </ul>
      </section>

      <nav class="contact-row reveal" aria-label="Redes sociais e contato">
        <a class="contact-link" href="https://wa.me/5511982899981?text=Ol%C3%A1%20Kelly%2C%20gostaria%20de%20agendar%20minha%20avalia%C3%A7%C3%A3o!" target="_blank" rel="noopener noreferrer" aria-label="Agendar avaliação com Kelly Regina pelo WhatsApp">
          <span class="contact-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path>
            </svg>
          </span>
          <span class="contact-label">WhatsApp</span>
        </a>

        <a class="contact-link" href="https://www.instagram.com/kellyferreira.oficial" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Kelly Regina Ferreira — @kellyferreira.oficial">
          <span class="contact-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <circle cx="12" cy="12" r="4"></circle>
              <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"></circle>
            </svg>
          </span>
          <span class="contact-label">Instagram</span>
        </a>
      </nav>

      <section class="clinic-block reveal" aria-labelledby="clinic-heading">
        <div class="clinic-card">
          <h2 class="clinic-eyebrow" id="clinic-heading">Atendimento presencial</h2>
          <a class="clinic-cta" href="https://www.google.com/maps/search/?api=1&amp;query=Avenida+General+Pedro+Pinho%2C+463+-+Sala+05" target="_blank" rel="noopener noreferrer" aria-label="Como chegar — abrir localização da clínica no Google Maps">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"></path>
              <circle cx="12" cy="10" r="2.5"></circle>
            </svg>
            Como chegar
          </a>
          <address class="clinic-address">Avenida General Pedro Pinho, 463 · Sala 05</address>
        </div>
      </section>
    </main>

    <footer class="reveal" aria-label="Informações legais e institucionais">
      <span class="footer-wordmark">Kelly Regina Ferreira</span>
      <p class="footer-line">CNPJ: 62.485.112/0001-37</p>
      <p class="footer-line">© 2026 · Todos os direitos reservados.</p>
      <p class="footer-name-line">Kelly Regina Ferreira Correia · Terapeuta Naturalista Integrativa</p>
      <p class="footer-spec-line">Estética Natural Integrativa</p>
      <p class="footer-disclaimer">
        As informações nestas páginas têm caráter informativo e não substituem avaliação individualizada.
        A resposta de cada organismo é única. Reprodução proibida sem autorização.
      </p>
      <p class="footer-credit">
        Site desenvolvido por
        <a href="https://www.instagram.com/lcm.enterprise?igsh=NHVqYzVnOHphaTc3" target="_blank" rel="noopener noreferrer">LCM Enterprise LTDA</a>.
      </p>
    </footer>

  </div>

  <script>
    (function () {
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -16px 0px' });
      document.querySelectorAll('.reveal').forEach(function (el, i) {
        el.style.transitionDelay = (i * 0.06) + 's';
        io.observe(el);
      });
    })();
  </script>
  <script src="auth.js" defer></script>
</body></html>
`;

fs.writeFileSync(htmlPath, out);
console.log('index.html rewritten v4');
