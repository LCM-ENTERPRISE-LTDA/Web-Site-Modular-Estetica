/**
 * Rebuild index.html vitrine CSS + markup composition (content preserved).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Extract preserved fragments
const avatarImg = html.match(/<img class="avatar-img"[\s\S]*?>/)[0];
const cards = [...html.matchAll(/<a class="vcard[\s\S]*?<\/a>/g)].map((m) => m[0]);
if (cards.length < 5) throw new Error('expected 5 cards');

function getImg(card) {
  const m = card.match(/<img class="card-img"[\s\S]*?>/);
  return m ? m[0] : '';
}

const meta = [
  {
    tone: 'facial',
    href: 'facial.html',
    badge: 'Em destaque',
    eyebrow: 'Protocolo Facial',
    title: '<em>Facial</em>',
    desc: 'Cuidado integrativo para o rosto — equilíbrio da pele e acolhimento clínico, com escuta individual.',
    aria: 'Protocolo Facial — cuidado integrativo para melasma e saúde da pele',
    cta: ''
  },
  {
    tone: 'corporal',
    href: 'corporal.html',
    badge: null,
    eyebrow: 'Protocolo Corporal',
    title: '<em>Corporal</em>',
    desc: 'Acolhimento ao tecido e conforto com o próprio corpo — uma abordagem orgânica e paciente.',
    aria: 'Protocolo Corporal — acolhimento e cuidado com a pele do corpo',
    cta: ''
  },
  {
    tone: 'capilar',
    href: 'capilar.html',
    badge: null,
    eyebrow: 'Protocolo Capilar',
    title: '<em>Capilar</em>',
    desc: 'Saúde do couro cabeludo com rigor e delicadeza — da leitura clínica ao cuidado do fio.',
    aria: 'Protocolo Capilar — saúde do couro cabeludo e do fio',
    cta: ''
  },
  {
    tone: 'desinflamacao',
    href: 'desinflamacao.html',
    badge: null,
    eyebrow: 'Reequilíbrio',
    title: '<em>Desinflamação</em>',
    desc: 'Um guia para compreender o organismo e cultivar leveza — de dentro para fora, com responsabilidade.',
    aria: 'Desinflamação e Reequilíbrio — guia integrativo',
    cta: ''
  },
  {
    tone: 'curriculo',
    href: 'curriculo.html',
    badge: null,
    eyebrow: 'Trajetória',
    title: '<em>Quem</em> sou eu',
    desc: 'Formação, propósito e o cuidado humanizado que orienta cada protocolo.',
    aria: 'Currículo — conheça a trajetória de Kelly Regina Ferreira',
    cta: ''
  }
];

const cardsHtml = meta.map((m, i) => {
  const img = getImg(cards[i]);
  const badge = m.badge ? `<span class="pcard__badge">${m.badge}</span>` : '';
  return `          <li>
            <a class="pcard pcard--${m.tone} reveal" href="${m.href}" aria-label="${m.aria}">
              ${badge}
              <div class="pcard__media" aria-hidden="true">${img}</div>
              <div class="pcard__body">
                <span class="pcard__eyebrow">${m.eyebrow}</span>
                <h3 class="pcard__title">${m.title}</h3>
                <p class="pcard__desc">${m.desc}</p>
                <span class="pcard__cta" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </span>
              </div>
            </a>
          </li>`;
}).join('\n\n');

const css = fs.readFileSync(path.join(__dirname, 'index-v5-styles.css'), 'utf8');

const headMatch = html.match(/^[\s\S]*?<style>/);
const afterStyle = html.match(/<\/style>\s*<\/head>[\s\S]*$/);
if (!headMatch || !afterStyle) throw new Error('style bounds not found');

// Keep head up to style, replace style+body
const head = html.slice(0, html.indexOf('<style>'));

const body = `</head>
<body>

  <div class="shell">

    <header class="hero-band">
      <section class="hero" aria-label="Apresentação de Kelly Regina Ferreira Correia">
        <p class="hero-kicker">Estética Natural Integrativa</p>
        <figure class="avatar-wrap">
          ${avatarImg}
          <div class="avatar-fallback" style="display:none;" aria-hidden="true">KF</div>
        </figure>
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
    </header>

    <main>
      <section class="protocols-band reveal" aria-labelledby="products-heading">
        <div class="band-inner">
          <p class="section-kicker" aria-hidden="true">Protocolos</p>
          <h2 class="section-label" id="products-heading">Protocolos de cuidado</h2>
          <p class="section-lead">Cada protocolo nasce de uma leitura individual do organismo — com ética, delicadeza e profundidade.</p>

          <ul class="protocol-grid" id="vitrine">
${cardsHtml}
          </ul>
        </div>
      </section>

      <nav class="contact-band reveal" aria-label="Redes sociais e contato">
        <div class="band-inner contact-row">
          <a class="contact-link contact-link--primary" href="https://wa.me/5511982899981?text=Ol%C3%A1%20Kelly%2C%20gostaria%20de%20agendar%20minha%20avalia%C3%A7%C3%A3o!" target="_blank" rel="noopener noreferrer" aria-label="Agendar avaliação com Kelly Regina pelo WhatsApp">
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
        </div>
      </nav>

      <section class="clinic-band reveal" aria-labelledby="clinic-heading">
        <div class="band-inner">
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
        </div>
      </section>
    </main>

    <footer class="reveal" aria-label="Informações legais e institucionais">
      <div class="band-inner">
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
      </div>
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
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      document.querySelectorAll('.reveal').forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i * 0.05, 0.35) + 's';
        io.observe(el);
      });
    })();
  </script>
  <script src="auth.js" defer></script>
</body></html>
`;

const out = head + '<style>\n' + css + '\n  </style>\n' + body;
fs.writeFileSync(htmlPath, out);
console.log('index rebuilt v5');
