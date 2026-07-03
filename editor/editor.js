/* ============================================================
   VisualEditor — Global Inline Visual Editor  (v2.1.0)
   Vanilla JS. Single file. Loaded on every page.

   v2.1 highlights
   -------------------------------------------------------------
   • DEEP TARGETING  — hover / select / edit the EXACT element.
   • FOOTER BLACKLIST — <footer>, .footer + descendants are inert.
   • IMAGE EDITING   — every <img> is clickable (pointer-events
     neutralised in edit mode); hover shows an overlay affordance.
   • BACKGROUND IMG  — Inspector lets you upload a background-image
     for the selected container.
   • ZIP EXPORT      — "Salvar" builds a deploy-ready package with
     JSZip: web_site_official/<page>.html + web_site_official/images/.
     Changed/added images are written as real files and referenced
     as images/<name> in the clean HTML (no base64 bloat, no blob:).
   • USABILITY       — robust nested selection, no self-highlight of
     the active text node, live inspector re-render on re-select,
     Esc to deselect, graceful fallback if JSZip is offline.

   Public API: window.VisualEditor
   ============================================================ */
(function (global) {
  'use strict';

  var DEBUG = true;
  function log() {
    if (!DEBUG) return;
    try { console.info.apply(console, ['[VisualEditor]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  var JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  // ── ETAPA 4 — Backup no Drive + deploy automático ─────────────────────
  // Cole a URL do Web App do Apps Script (termina em /exec).
  // Deixe '' para desativar o backup remoto (o download local continua).
  var DEPLOY_ENDPOINT = 'https://script.google.com/macros/s/AKfycby8Yr_50x7FCGwu7hCe6wllLVTca-yf7NZi2Qd-8sPMSo9EN9yOttYe6WwOmVxJClzQ/exec';                       // ex.: 'https://script.google.com/macros/s/AKfy.../exec'
  var DEPLOY_CLIENT   = 'Kelly Regina Ferreira';  // nome da pasta em Clientes/
  var DEPLOY_TOKEN    = 'lcmenterprisedysonai';                        // token compartilhado (igual ao SHARED_TOKEN do Code.gs)

  // ============================================================
  // 0. UTILITIES
  // ============================================================
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (k === 'class') node.className = props[k];
        else if (k === 'style' && typeof props[k] === 'object') {
          for (var s in props[k]) node.style[s] = props[k][s];
        } else if (k.indexOf('on') === 0 && typeof props[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), props[k]);
        } else if (k === 'html') node.innerHTML = props[k];
        else if (k === 'text') node.textContent = props[k];
        else node.setAttribute(k, props[k]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        if (children[i] == null) continue;
        node.appendChild(typeof children[i] === 'string' ? document.createTextNode(children[i]) : children[i]);
      }
    }
    return node;
  }
  function tagOf(node) { return node && node.tagName ? node.tagName.toLowerCase() : ''; }

  function rafThrottle(fn) {
    var ticking = false, lastArgs = null;
    return function () {
      lastArgs = arguments;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; fn.apply(null, lastArgs); });
    };
  }
  function readAsDataURL(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error || new Error('read error')); };
      r.readAsDataURL(file);
    });
  }
  function extFromMime(m) {
    return ({ 'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp',
              'image/gif':'gif','image/svg+xml':'svg','image/avif':'avif','image/bmp':'bmp' })[m] || 'png';
  }

  // ============================================================
  // 1. SCOPE GUARDS — editor UI / footer blacklist / editable
  // ============================================================
  function isEditorNode(node) {
    if (!node || node.nodeType !== 1) return false;
    var n = node;
    while (n && n !== document.body) {
      if (n.classList && (n.classList.contains('editor-root') ||
          (n.className && typeof n.className === 'string' && n.className.indexOf('editor-') === 0))) return true;
      n = n.parentNode;
    }
    return false;
  }

  // BLACKLIST: <footer>, .footer and every descendant. `.footer-cta`
  // (a separate CTA block outside the real footer) is intentionally
  // NOT matched, so it stays editable.
  var RESTRICT_SELECTOR = 'footer, .footer';
  function isRestricted(node) {
    var elNode = node;
    if (elNode && elNode.nodeType !== 1) elNode = elNode.parentElement;
    if (!elNode || !elNode.closest) return false;
    return !!elNode.closest(RESTRICT_SELECTOR);
  }

  var NON_EDITABLE_TAGS = [
    'html','head','body','script','style','link','meta','title',
    'noscript','br','hr','svg','path','g','use','source','track',
    'iframe','canvas','template'
  ];
  function isEditable(node) {
    if (!node || node.nodeType !== 1) return false;
    if (isEditorNode(node)) return false;
    if (isRestricted(node)) return false;
    if (NON_EDITABLE_TAGS.indexOf(tagOf(node)) >= 0) return false;
    return true;
  }

  var TEXT_TAGS = ['h1','h2','h3','h4','h5','h6','p','span','a','strong','em','b','i',
                   'small','li','blockquote','label','figcaption','td','th','caption','dt','dd','button'];
  function canEditText(node) {
    if (!isEditable(node)) return false;
    if (tagOf(node) === 'img') return false;
    var hasText = node.textContent && node.textContent.trim().length > 0;
    if (!hasText) return false;
    if (TEXT_TAGS.indexOf(tagOf(node)) >= 0) return true;
    return node.children.length === 0;
  }
  function isButtonLike(node) {
    if (!node) return false;
    if (tagOf(node) === 'a' || tagOf(node) === 'button') return true;
    var cls = node.className || '';
    if (typeof cls !== 'string') return false;
    if (cls.indexOf('btn') >= 0) return true;
    if (node.getAttribute && node.getAttribute('role') === 'button') return true;
    return false;
  }

  // ============================================================
  // 2. ASSET REGISTRY (images destined for the /images folder)
  // ============================================================
  var Assets = {
    list: [],   // { el, kind, name, path, blob }
    _seq: 0,
    _safe: function (name) {
      var base = (name || 'image').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
      return base || 'image';
    },
    set: function (elNode, kind, file) {
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].el === elNode && this.list[i].kind === kind) {
          this.list[i].blob = file;
          return this.list[i].path;
        }
      }
      this._seq++;
      var safe = this._safe(file.name);
      if (!/\.[a-z0-9]+$/i.test(safe)) safe += '.' + extFromMime(file.type);
      var name = this._seq + '-' + safe;
      var path = 'images/' + name;
      this.list.push({ el: elNode, kind: kind, name: name, path: path, blob: file });
      return path;
    },
    clear: function () { this.list = []; this._seq = 0; }
  };

  // ============================================================
  // 3. TOAST
  // ============================================================
  var Toast = {
    node: null,
    ensure: function () {
      if (this.node) return this.node;
      this.node = el('div', { class: 'editor-toast editor-root' });
      document.body.appendChild(this.node);
      return this.node;
    },
    show: function (msg, ms) {
      var n = this.ensure();
      n.textContent = msg;
      n.classList.add('editor-show');
      clearTimeout(this._t);
      this._t = setTimeout(function () { n.classList.remove('editor-show'); }, ms || 2200);
    }
  };

  // ============================================================
  // 4. STATE
  // ============================================================
  var state = { dirty: false, selected: null, hoverEl: null, hoverImage: null, activeText: null, isPreview: false };

  function markDirty() {
    state.dirty = true;
    var s = $('.editor-bar-status');
    if (s) { s.textContent = 'Alterações não salvas'; s.classList.add('editor-dirty'); }
  }
  function clearDirty() {
    state.dirty = false;
    var s = $('.editor-bar-status');
    if (s) { s.textContent = 'Tudo salvo'; s.classList.remove('editor-dirty'); }
  }

  var SKILL_SELECTOR = '.skill-bar-track';

  // ============================================================
  // 5. UI INJECTION
  // ============================================================
  var UI = {
    bar: null, panel: null, toolbar: null, panelBody: null, panelTag: null, imgOverlay: null,

    injectGlobalBar: function () {
      if (this.bar) return;
      var bar = el('div', { class: 'editor-bar editor-root', role: 'toolbar', 'aria-label': 'Modo Edição' }, [
        el('div', { class: 'editor-bar-title', html: '<span>&#10022;</span> Modo Edição' }),
        el('div', { class: 'editor-bar-status', text: 'Tudo salvo' }),
        el('div', { class: 'editor-bar-spacer' }),
        el('div', { class: 'editor-bar-actions' }, [
          el('button', { class: 'editor-btn editor-btn--ghost', 'data-action': 'preview', text: 'Visualizar' }),
          el('button', { class: 'editor-btn',                    'data-action': 'cancel',  text: 'Cancelar' }),
          el('button', { class: 'editor-btn editor-btn--primary','data-action': 'save',    text: 'Salvar & Publicar' })
        ])
      ]);
      document.body.appendChild(bar);
      this.bar = bar;
      document.documentElement.classList.add('editor-active');
      document.body.classList.add('editor-active');

      bar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var act = btn.getAttribute('data-action');
        if (act === 'save')    VisualEditor.save();
        if (act === 'cancel')  VisualEditor.cancel();
        if (act === 'preview') VisualEditor.preview(btn);
      });
    },

    createFloatingToolbar: function () {
      if (this.toolbar) return;
      var tb = el('div', { class: 'editor-toolbar editor-root', role: 'toolbar' }, [
        el('button', { class: 'editor-tb-btn', title: 'Inspecionar',    'data-tb': 'inspect', text: '\u2699' }),
        el('div',    { class: 'editor-tb-sep' }),
        el('button', { class: 'editor-tb-btn', title: 'Fundo',          'data-tb': 'bg',     text: '\uD83C\uDFA8' }),
        el('button', { class: 'editor-tb-btn', title: 'Imagem de fundo', 'data-tb': 'bgimg',  text: '\uD83D\uDDBC' }),
        el('button', { class: 'editor-tb-btn', title: 'Texto',          'data-tb': 'color',  text: '\uD83D\uDD24' }),
        el('button', { class: 'editor-tb-btn', title: 'Fonte',          'data-tb': 'font',   text: '\u270D' }),
        el('button', { class: 'editor-tb-btn', title: 'Espaçamento',    'data-tb': 'space',  text: '\u2195' }),
        el('button', { class: 'editor-tb-btn', title: 'Alinhar',        'data-tb': 'align',  text: '\u2194' }),
        el('button', { class: 'editor-tb-btn', title: 'Bordas',         'data-tb': 'border', text: '\uD83D\uDCE6' }),
        el('button', { class: 'editor-tb-btn', title: 'Sombra',         'data-tb': 'shadow', text: '\u2600' }),
        el('div',    { class: 'editor-tb-sep' }),
        el('button', { class: 'editor-tb-btn', title: 'Abrir link em nova aba', 'data-tb': 'openlink', text: '\uD83D\uDD17' }),
        el('div',    { class: 'editor-tb-sep' }),
        el('button', { class: 'editor-tb-btn', title: 'Resetar',        'data-tb': 'reset',  text: '\uD83D\uDDD1' })
      ]);
      document.body.appendChild(tb);
      this.toolbar = tb;

      tb.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tb]');
        if (!b || !state.selected) return;
        var k = b.getAttribute('data-tb');
        if (k === 'inspect') Inspector.open(state.selected, 'style');
        else if (k === 'reset') { StyleEditor.reset(state.selected); markDirty(); Toast.show('Estilo redefinido'); }
        else if (k === 'openlink') { VisualEditor.openSelectedLink(); }
        else Inspector.open(state.selected, k);
      });
    },

    createImageOverlay: function () {
      if (this.imgOverlay) return;
      var ov = el('div', { class: 'editor-img-overlay editor-root' }, [
        el('div', { class: 'editor-img-overlay-inner' }, [
          el('span', { class: 'editor-img-overlay-ic', text: '\uD83D\uDCF7' }),
          el('span', { class: 'editor-img-overlay-label', text: 'Clique para alterar/adicionar imagem' })
        ]),
        el('button', { class: 'editor-img-overlay-gear', title: 'Ajustar imagem (bordas, recorte, alt)', text: '\u2699' })
      ]);
      document.body.appendChild(ov);
      this.imgOverlay = ov;

      ov.querySelector('.editor-img-overlay-inner').addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (state.hoverImage) ImageEditor.pick(state.hoverImage);
      });
      ov.querySelector('.editor-img-overlay-gear').addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (state.hoverImage) { selectElement(state.hoverImage); Inspector.open(state.hoverImage, 'image'); }
      });
      ov.addEventListener('mouseleave', function () { UI.hideImageOverlay(); });
    },

    createInspectorPanel: function () {
      if (this.panel) return;
      var panel = el('aside', { class: 'editor-panel editor-root', 'aria-label': 'Inspector' }, [
        el('div', { class: 'editor-panel-head' }, [
          el('div', {}, [
            el('div', { class: 'editor-panel-title', text: 'Inspector' }),
            el('div', { class: 'editor-panel-tag',   text: '' })
          ]),
          el('button', { class: 'editor-panel-close', 'aria-label': 'Fechar', text: '\u00D7' })
        ]),
        el('div', { class: 'editor-panel-body' })
      ]);
      document.body.appendChild(panel);
      this.panel = panel;
      this.panelBody = panel.querySelector('.editor-panel-body');
      this.panelTag  = panel.querySelector('.editor-panel-tag');
      panel.querySelector('.editor-panel-close').addEventListener('click', function () { Inspector.close(); });
    },

    positionToolbar: function (target) {
      if (!this.toolbar || !target) return;
      var r = target.getBoundingClientRect();
      var tb = this.toolbar;
      tb.classList.add('editor-show');
      var top = r.top - tb.offsetHeight - 10;
      if (top < 56) top = r.bottom + 10;
      var left = Math.max(8, Math.min(window.innerWidth - tb.offsetWidth - 8, r.left + r.width / 2 - tb.offsetWidth / 2));
      tb.style.top = top + 'px'; tb.style.left = left + 'px';
    },
    hideToolbar: function () { if (this.toolbar) this.toolbar.classList.remove('editor-show'); },

    positionImageOverlay: function (img) {
      if (!this.imgOverlay || !img) return;
      var r = img.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) { this.hideImageOverlay(); return; }
      var ov = this.imgOverlay;
      ov.style.top = r.top + 'px'; ov.style.left = r.left + 'px';
      ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px';
      ov.classList.add('editor-show');
    },
    hideImageOverlay: function () {
      if (this.imgOverlay) this.imgOverlay.classList.remove('editor-show');
      if (state.hoverImage) { state.hoverImage.classList.remove('editor-img-hl'); state.hoverImage = null; }
    }
  };

  // ============================================================
  // 6. STYLE EDITOR (reset helper)
  // ============================================================
  var StyleEditor = {
    reset: function (node) {
      if (!node) return;
      ['background-color','background','background-image','background-size','background-position',
       'background-repeat','color','font-family','font-size','line-height','letter-spacing',
       'text-align','padding','margin','border','border-radius','border-width','border-style',
       'border-color','box-shadow','font-weight','object-fit']
        .forEach(function (p) { node.style.removeProperty(p); });
      node.removeAttribute('data-export-bg');
      if (tagOf(node) !== 'img') node.removeAttribute('data-export-src');
    }
  };

  // ============================================================
  // 7. HOVER HIGHLIGHT + SELECTION (deep / per-element)
  // ============================================================
  function setHover(node) {
    if (state.hoverEl === node) return;
    clearHover();
    if (node && node !== state.selected && node !== state.activeText) {
      node.classList.add('editor-hl');
      state.hoverEl = node;
    }
  }
  function clearHover() {
    if (state.hoverEl) { state.hoverEl.classList.remove('editor-hl'); state.hoverEl = null; }
  }
  function selectElement(node) {
    if (state.selected && state.selected !== node) state.selected.classList.remove('editor-selected');
    state.selected = node || null;
    if (node) {
      node.classList.remove('editor-hl');
      node.classList.add('editor-selected');
      if (UI.panel && UI.panel.classList.contains('editor-open')) Inspector.render(node);
    }
  }
  function deselect() {
    if (state.selected) state.selected.classList.remove('editor-selected');
    state.selected = null;
    UI.hideToolbar();
    Inspector.close();
  }

  function bindSelectionEvents() {
    document.addEventListener('mousemove', rafThrottle(function (e) {
      if (state.isPreview) return;
      var t = e.target;
      if (tagOf(t) === 'img') { clearHover(); return; }
      if (!isEditable(t) || isEditorNode(t)) { clearHover(); return; }
      setHover(t);
    }), true);

    document.addEventListener('mouseleave', function () { clearHover(); }, true);

    document.addEventListener('click', function (e) {
      if (state.isPreview) return;
      var t = e.target;
      if (isEditorNode(t)) return;
      if (isRestricted(t)) return;
      if (tagOf(t) === 'img') return;
      if (t.isContentEditable) return;
      if (t.closest && t.closest(SKILL_SELECTOR)) return;

      var interactive = t.closest && t.closest('a, button');
      if (interactive) { e.preventDefault(); }

      if (e.detail >= 2) return;
      if (!isEditable(t)) return;

      selectElement(t);
      UI.positionToolbar(t);
    }, true);

    var reflow = rafThrottle(function () {
      if (state.selected) UI.positionToolbar(state.selected);
      if (state.hoverImage) UI.positionImageOverlay(state.hoverImage);
    });
    window.addEventListener('scroll', reflow, true);
    window.addEventListener('resize', reflow);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !state.isPreview && !(e.target && e.target.isContentEditable)) deselect();
    });
  }

  // ============================================================
  // 8. TEXT EDITOR (deep inline editing on the exact element)
  // ============================================================
  var TextEditor = {
    enable: function () {
      var self = this;
      document.addEventListener('dblclick', function (e) { self._maybeActivate(e); }, true);
    },
    _maybeActivate: function (e) {
      if (state.isPreview) return;
      var t = e.target;
      if (isEditorNode(t) || isRestricted(t) || tagOf(t) === 'img') return;
      if (!canEditText(t)) return;
      e.preventDefault(); e.stopPropagation();
      this.activate(t);
    },
    activate: function (node) {
      if (state.activeText && state.activeText !== node) this.deactivate(state.activeText);
      clearHover();
      node.setAttribute('contenteditable', 'true');
      node.classList.add('editor-text-active');
      node.focus();
      try {
        var sel = window.getSelection(), range = document.createRange();
        range.selectNodeContents(node); range.collapse(false);
        sel.removeAllRanges(); sel.addRange(range);
      } catch (err) {}
      state.activeText = node;

      var onBlur = function () {
        node.removeEventListener('blur', onBlur);
        node.removeEventListener('input', onInput);
        node.removeEventListener('keydown', onKey);
        TextEditor.deactivate(node);
      };
      var onInput = function () { markDirty(); };
      var onKey = function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey && /^h[1-6]$|^a$|^button$|^label$/.test(tagOf(node))) { ev.preventDefault(); node.blur(); }
        if (ev.key === 'Escape') { ev.preventDefault(); node.blur(); }
      };
      node.addEventListener('blur', onBlur);
      node.addEventListener('input', onInput);
      node.addEventListener('keydown', onKey);
    },
    deactivate: function (node) {
      if (!node) return;
      node.removeAttribute('contenteditable');
      node.classList.remove('editor-text-active');
      if (state.activeText === node) state.activeText = null;
    }
  };

  // ============================================================
  // 9. IMAGE EDITOR (overlay + clickable everywhere + asset track)
  // ============================================================
  var ImageEditor = {
    enable: function () {
      document.addEventListener('mouseover', function (e) {
        if (state.isPreview) return;
        var t = e.target;
        if (tagOf(t) !== 'img' || isEditorNode(t) || isRestricted(t)) return;
        if (state.hoverImage && state.hoverImage !== t) state.hoverImage.classList.remove('editor-img-hl');
        state.hoverImage = t;
        t.classList.add('editor-img-hl');
        UI.positionImageOverlay(t);
      }, true);

      // Direct click on ANY <img> → replace. pointer-events neutralised
      // in edit mode (CSS). Capture + preventDefault stops the parent
      // anchor from navigating.
      document.addEventListener('click', function (e) {
        if (state.isPreview) return;
        var t = e.target;
        if (tagOf(t) !== 'img' || isEditorNode(t) || isRestricted(t)) return;
        e.preventDefault(); e.stopPropagation();
        ImageEditor.pick(t);
      }, true);

      // [data-editable-image] empty drop-zones
      document.addEventListener('mouseover', function (e) {
        if (state.isPreview) return;
        var zone = e.target.closest && e.target.closest('[data-editable-image]');
        if (!zone || isEditorNode(zone) || isRestricted(zone)) return;
        if (zone.querySelector('img')) return;
        zone.classList.add('editor-image-hover');
      }, true);
      document.addEventListener('mouseout', function (e) {
        var zone = e.target.closest && e.target.closest('[data-editable-image]');
        if (zone && (!e.relatedTarget || !zone.contains(e.relatedTarget))) zone.classList.remove('editor-image-hover');
      }, true);
      document.addEventListener('click', function (e) {
        if (state.isPreview) return;
        var zone = e.target.closest && e.target.closest('[data-editable-image]');
        if (!zone || isEditorNode(zone) || isRestricted(zone)) return;
        if (e.target.closest('img')) return;
        e.preventDefault(); e.stopPropagation();
        ImageEditor.pickForZone(zone);
      }, true);
    },

    _filePrompt: function () {
      return new Promise(function (res) {
        var input = el('input', { type: 'file', accept: 'image/*', class: 'editor-root', style: { display: 'none' } });
        document.body.appendChild(input);
        input.addEventListener('change', function () { var f = input.files && input.files[0]; input.remove(); res(f || null); });
        input.click();
      });
    },

    pick: function (img) {
      this._filePrompt().then(function (file) {
        if (!file) return;
        var path = Assets.set(img, 'src', file);
        readAsDataURL(file).then(function (durl) {
          img.src = durl;
          img.setAttribute('data-export-src', path);
          img.style.display = '';
          img.removeAttribute('aria-hidden');
          markDirty();
          UI.positionImageOverlay(img);
          Toast.show('Imagem atualizada');
        });
      });
    },

    pickForZone: function (zone) {
      var existing = zone.querySelector('img');
      if (existing) return this.pick(existing);
      this._filePrompt().then(function (file) {
        if (!file) return;
        var img = el('img', { alt: '', style: { maxWidth: '100%', display: 'block' } });
        zone.appendChild(img);
        var path = Assets.set(img, 'src', file);
        readAsDataURL(file).then(function (durl) {
          img.src = durl;
          img.setAttribute('data-export-src', path);
          zone.classList.remove('editor-image-hover');
          markDirty();
          Toast.show('Imagem adicionada');
        });
      });
    },

    setBackground: function (node) {
      this._filePrompt().then(function (file) {
        if (!file) return;
        var path = Assets.set(node, 'bg', file);
        readAsDataURL(file).then(function (durl) {
          node.style.backgroundImage = 'url("' + durl + '")';
          if (!node.style.backgroundSize)     node.style.backgroundSize = 'cover';
          if (!node.style.backgroundPosition) node.style.backgroundPosition = 'center';
          node.style.backgroundRepeat = 'no-repeat';
          node.setAttribute('data-export-bg', path);
          markDirty();
          Toast.show('Imagem de fundo aplicada');
          if (UI.panel && UI.panel.classList.contains('editor-open')) Inspector.render(node, 'bgimg');
        });
      });
    },
    clearBackground: function (node) {
      node.style.removeProperty('background-image');
      node.removeAttribute('data-export-bg');
      markDirty();
    }
  };

  // ============================================================
  // 10. SKILL BAR EDITOR (curriculo)
  // ============================================================
  var SkillBarEditor = {
    setup: function () {
      var tracks = $$(SKILL_SELECTOR);
      if (!tracks.length) return;
      tracks.forEach(function (track) {
        if (isRestricted(track)) return;
        track.classList.add('editor-skill-editable');
        var fill = track.querySelector('.skill-bar-fill');
        if (!fill) return;
        var badge = null;
        function pctFromEvent(ev) {
          var r = track.getBoundingClientRect();
          var x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
          return Math.max(0, Math.min(100, Math.round((x / r.width) * 100)));
        }
        function showBadge(p) { if (!badge) { badge = el('div', { class: 'editor-skill-badge editor-root' }); track.appendChild(badge); } badge.textContent = p + '%'; }
        function hideBadge() { if (badge) { badge.remove(); badge = null; } }
        function apply(p) { fill.style.width = p + '%'; fill.setAttribute('data-pct', String(p)); showBadge(p); markDirty(); }

        var dragging = false;
        track.addEventListener('mousedown', function (e) {
          if (state.isPreview) return;
          dragging = true; track.classList.add('editor-skill-armed'); apply(pctFromEvent(e)); e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) { if (dragging) apply(pctFromEvent(e)); });
        document.addEventListener('mouseup', function () {
          if (!dragging) return; dragging = false; track.classList.remove('editor-skill-armed'); setTimeout(hideBadge, 700);
        });
        track.addEventListener('click', function (e) { if (state.isPreview) return; apply(pctFromEvent(e)); setTimeout(hideBadge, 700); });
      });
    }
  };

  // ============================================================
  // 11. INSPECTOR PANEL — DYNAMIC FIELDS
  // ============================================================
  var FONTS = ['Inter','Poppins','Montserrat','Roboto','Playfair Display','Lora','Oswald',
               'Cormorant Garamond','Jost','DM Sans','Open Sans','Arial','Georgia'];
  var COLORS = ['#1a1a18','#2c2420','#4a4a45','#ffffff','#faf8f5','#f7f2eb',
                '#9a7548','#b89066','#994f20','#a05a30','#c8835a','#5d7a58','#d6ca96'];

  function field(labelText, ctrlNode) { return el('div', { class: 'editor-field' }, [ el('label', { class: 'editor-label', text: labelText }), ctrlNode ]); }
  function toHexInput(v) { return (v && /^#([0-9a-f]{6})$/i.test(v)) ? v : '#000000'; }
  function makeColorRow(initial, onChange) {
    var input = el('input', { type: 'color', class: 'editor-color', value: toHexInput(initial) });
    var hex   = el('input', { type: 'text',  class: 'editor-input', value: initial || '', placeholder: '#hex / rgba(...)' });
    input.addEventListener('input', function () { hex.value = input.value; onChange(input.value); });
    hex.addEventListener('change',  function () { onChange(hex.value); });
    var presets = el('div', { class: 'editor-presets' });
    COLORS.forEach(function (c) {
      var sw = el('button', { class: 'editor-swatch', style: { background: c }, title: c });
      sw.addEventListener('click', function () { input.value = c; hex.value = c; onChange(c); });
      presets.appendChild(sw);
    });
    return el('div', {}, [ el('div', { class: 'editor-row' }, [input, hex]), presets ]);
  }
  function makeRangeRow(min, max, step, unit, initial, onChange) {
    var r = el('input', { type: 'range', class: 'editor-range', min: min, max: max, step: step, value: initial });
    var v = el('div', { class: 'editor-range-val', text: initial + (unit || '') });
    r.addEventListener('input', function () { v.textContent = r.value + (unit || ''); onChange(r.value); });
    return el('div', { class: 'editor-row' }, [r, v]);
  }
  function section(title, body, collapsed) {
    var sec = el('section', { class: 'editor-section' + (collapsed ? ' editor-collapsed' : '') }, [
      el('button', { class: 'editor-section-head', text: title }),
      el('div', { class: 'editor-section-body' }, [body])
    ]);
    sec.querySelector('.editor-section-head').addEventListener('click', function () { sec.classList.toggle('editor-collapsed'); });
    return sec;
  }
  function getInlineColor(node, prop) { return node.style[prop] || ''; }

  var Inspector = {
    open: function (target, focusSection) { if (!UI.panel || !target) return; this.render(target, focusSection); UI.panel.classList.add('editor-open'); },
    close: function () { if (UI.panel) UI.panel.classList.remove('editor-open'); },

    render: function (target, focusSection) {
      var body = UI.panelBody;
      body.innerHTML = '';
      UI.panelTag.textContent = describe(target);
      var isImg = tagOf(target) === 'img';

      if (!isImg && target.textContent != null) {
        var contentField = el('textarea', { class: 'editor-textarea', rows: 3 });
        contentField.value = target.innerText || '';
        contentField.addEventListener('input', function () { target.innerText = contentField.value; markDirty(); });
        body.appendChild(section('Conteúdo', contentField, focusSection && focusSection !== 'content'));
      }

      var bgRow = makeColorRow(getInlineColor(target, 'backgroundColor') || '', function (v) { target.style.backgroundColor = v; markDirty(); });
      var fgRow = makeColorRow(getInlineColor(target, 'color') || '', function (v) { target.style.color = v; markDirty(); });
      body.appendChild(section('Estilo', el('div', {}, [ field('Fundo', bgRow), field('Cor do texto', fgRow) ]),
        focusSection && (focusSection !== 'style' && focusSection !== 'bg' && focusSection !== 'color')));

      // BACKGROUND IMAGE (containers only)
      if (!isImg) {
        var hasBg = !!(target.getAttribute('data-export-bg') || (target.style.backgroundImage && target.style.backgroundImage !== 'none'));
        var upBtn = el('button', { class: 'editor-btn editor-btn--primary', style: { width: '100%' }, text: hasBg ? 'Trocar imagem de fundo' : 'Enviar imagem de fundo' });
        upBtn.addEventListener('click', function () { ImageEditor.setBackground(target); });
        var bgFields = el('div', {}, [ upBtn ]);
        if (hasBg) {
          var sizeSel = el('select', { class: 'editor-select' });
          ['cover','contain','auto','100% 100%'].forEach(function (sz) {
            var o = el('option', { value: sz, text: sz });
            if ((target.style.backgroundSize || '') === sz) o.selected = true;
            sizeSel.appendChild(o);
          });
          sizeSel.addEventListener('change', function () { target.style.backgroundSize = sizeSel.value; markDirty(); });
          var posSel = el('select', { class: 'editor-select' });
          ['center','top','bottom','left','right','top left','top right','bottom left','bottom right'].forEach(function (ps) {
            var o = el('option', { value: ps, text: ps });
            if ((target.style.backgroundPosition || '') === ps) o.selected = true;
            posSel.appendChild(o);
          });
          posSel.addEventListener('change', function () { target.style.backgroundPosition = posSel.value; markDirty(); });
          var rmBtn = el('button', { class: 'editor-reset-btn', text: '\u2715 Remover imagem de fundo' });
          rmBtn.addEventListener('click', function () { ImageEditor.clearBackground(target); Inspector.render(target, 'bgimg'); });
          bgFields.appendChild(field('Ajuste (size)', sizeSel));
          bgFields.appendChild(field('Posição', posSel));
          bgFields.appendChild(el('div', { style: { marginTop: '8px' } }, [ rmBtn ]));
        }
        body.appendChild(section('Imagem de fundo', bgFields, focusSection && focusSection !== 'bgimg'));
      }

      if (!isImg) {
        var fontSelect = el('select', { class: 'editor-select' });
        fontSelect.appendChild(el('option', { value: '', text: '\u2014 Fonte original \u2014' }));
        FONTS.forEach(function (f) { var opt = el('option', { value: f, text: f }); opt.style.fontFamily = f; fontSelect.appendChild(opt); });
        fontSelect.value = (target.style.fontFamily || '').replace(/['"]/g, '').split(',')[0].trim();
        fontSelect.addEventListener('change', function () { target.style.fontFamily = fontSelect.value ? '"' + fontSelect.value + '", system-ui, sans-serif' : ''; markDirty(); });
        var sizeRow = makeRangeRow(8, 96, 1, 'px', parseInt(getComputedStyle(target).fontSize, 10) || 16, function (v) { target.style.fontSize = v + 'px'; markDirty(); });
        var lineRow = makeRangeRow(1, 2.4, 0.05, '', parseFloat(getComputedStyle(target).lineHeight) / (parseInt(getComputedStyle(target).fontSize,10)||16) || 1.5, function (v) { target.style.lineHeight = v; markDirty(); });
        var lsRow = makeRangeRow(-2, 12, 0.1, 'px', parseFloat(target.style.letterSpacing) || 0, function (v) { target.style.letterSpacing = v + 'px'; markDirty(); });
        var weightSeg = el('div', { class: 'editor-seg' });
        ['300','400','500','600','700'].forEach(function (w) {
          var b = el('button', { class: 'editor-seg-btn', text: w });
          b.addEventListener('click', function () { target.style.fontWeight = w; $$('.editor-seg-btn', weightSeg).forEach(function (x){ x.classList.remove('editor-on'); }); b.classList.add('editor-on'); markDirty(); });
          weightSeg.appendChild(b);
        });
        body.appendChild(section('Tipografia', el('div', {}, [
          field('Fonte', fontSelect), field('Tamanho', sizeRow), field('Altura da linha', lineRow), field('Espaçamento de letras', lsRow), field('Peso', weightSeg)
        ]), focusSection && focusSection !== 'font'));

        var alignSeg = el('div', { class: 'editor-align-group' });
        ['left','center','right','justify'].forEach(function (a) {
          var b = el('button', { class: 'editor-seg-btn', text: a[0].toUpperCase() + a.slice(1) });
          b.addEventListener('click', function () { target.style.textAlign = a; $$('.editor-seg-btn', alignSeg).forEach(function (x){ x.classList.remove('editor-on'); }); b.classList.add('editor-on'); markDirty(); });
          if ((target.style.textAlign || getComputedStyle(target).textAlign) === a) b.classList.add('editor-on');
          alignSeg.appendChild(b);
        });
        body.appendChild(section('Alinhamento', alignSeg, focusSection && focusSection !== 'align'));
      }

      var padRow = makeRangeRow(0, 120, 1, 'px', parseInt(target.style.padding,10) || 0, function (v) { target.style.padding = v + 'px'; markDirty(); });
      var marRow = makeRangeRow(0, 120, 1, 'px', parseInt(target.style.margin,10) || 0, function (v) { target.style.margin = v + 'px'; markDirty(); });
      body.appendChild(section('Espaçamento', el('div', {}, [ field('Padding interno', padRow), field('Margem externa', marRow) ]), focusSection && focusSection !== 'space'));

      var brRow = makeRangeRow(0, 64, 1, 'px', parseInt(target.style.borderRadius,10) || 0, function (v) { target.style.borderRadius = v + 'px'; markDirty(); });
      var bwRow = makeRangeRow(0, 12, 1, 'px', parseInt(target.style.borderWidth,10) || 0, function (v) { target.style.borderWidth = v + 'px'; target.style.borderStyle = target.style.borderStyle || 'solid'; markDirty(); });
      var bcRow = makeColorRow(target.style.borderColor || '', function (v) { target.style.borderColor = v; target.style.borderStyle = target.style.borderStyle || 'solid'; markDirty(); });
      body.appendChild(section('Bordas', el('div', {}, [ field('Raio das bordas', brRow), field('Espessura', bwRow), field('Cor da borda', bcRow) ]), focusSection && focusSection !== 'border'));

      var shadows = [['Sem sombra','none'],['Suave','0 2px 10px rgba(0,0,0,0.08)'],['Média','0 8px 24px rgba(0,0,0,0.14)'],['Forte','0 16px 40px rgba(0,0,0,0.22)'],['Glow','0 0 30px rgba(184,110,62,0.45)']];
      var shadowSeg = el('div', {});
      shadows.forEach(function (s) {
        var b = el('button', { class: 'editor-seg-btn', text: s[0], style: { width: '100%', marginBottom: '6px' } });
        b.addEventListener('click', function () { target.style.boxShadow = s[1]; markDirty(); });
        shadowSeg.appendChild(b);
      });
      body.appendChild(section('Sombra', shadowSeg, focusSection && focusSection !== 'shadow'));

      if (isButtonLike(target)) {
        var hrefIn = el('input', { type: 'text', class: 'editor-input', value: target.getAttribute('href') || '' });
        hrefIn.addEventListener('change', function () { target.setAttribute('href', hrefIn.value); markDirty(); });
        var targetSel = el('select', { class: 'editor-select' });
        ['','_self','_blank','_parent','_top'].forEach(function (t) {
          var o = el('option', { value: t, text: t || '(padrão)' });
          if ((target.getAttribute('target') || '') === t) o.selected = true;
          targetSel.appendChild(o);
        });
        targetSel.addEventListener('change', function () { if (targetSel.value) target.setAttribute('target', targetSel.value); else target.removeAttribute('target'); markDirty(); });
        body.appendChild(section('Link / Botão', el('div', {}, [ field('href', hrefIn), field('target', targetSel) ]), focusSection && focusSection !== 'button'));
      }

      if (isImg) {
        var altIn = el('input', { type: 'text', class: 'editor-input', value: target.alt || '' });
        altIn.addEventListener('input', function () { target.alt = altIn.value; markDirty(); });
        var fitSel = el('select', { class: 'editor-select' });
        ['cover','contain','fill','none','scale-down'].forEach(function (f) {
          var o = el('option', { value: f, text: f });
          if ((target.style.objectFit || getComputedStyle(target).objectFit) === f) o.selected = true;
          fitSel.appendChild(o);
        });
        fitSel.addEventListener('change', function () { target.style.objectFit = fitSel.value; markDirty(); });
        var replace = el('button', { class: 'editor-btn editor-btn--primary', style: { width: '100%' }, text: 'Trocar imagem' });
        replace.addEventListener('click', function () { ImageEditor.pick(target); });
        body.appendChild(section('Imagem', el('div', {}, [ field('alt', altIn), field('object-fit', fitSel), replace ]), focusSection && focusSection !== 'image'));
      }

      body.appendChild(el('div', { class: 'editor-reset-row' }, [
        (function () {
          var b = el('button', { class: 'editor-reset-btn', text: '\u21BA Redefinir estilo' });
          b.addEventListener('click', function () { StyleEditor.reset(target); markDirty(); Toast.show('Estilo redefinido'); Inspector.render(target, focusSection); });
          return b;
        })()
      ]));
    }
  };

  function describe(node) {
    if (!node) return '';
    var tag = tagOf(node);
    var id  = node.id ? '#' + node.id : '';
    var cls = (node.className && typeof node.className === 'string')
      ? '.' + node.className.split(/\s+/).filter(function (c) { return c && c.indexOf('editor-') !== 0; }).slice(0, 2).join('.') : '';
    return (tag + id + cls).slice(0, 80);
  }

  // ============================================================
  // 12. HOME-SPECIFIC: "Quem sou eu" card
  // ============================================================
  function setupHomeVitrineCard() {
    var stack = document.querySelector('.products-stack') || document.querySelector('#vitrine');
    if (!stack) return;
    if (stack.querySelector('[data-card="quem-sou-eu"]')) return;
    var refCard = stack.querySelector('.product-card') || stack.firstElementChild;
    if (!refCard || typeof refCard.cloneNode !== 'function') return;
    var newCard = refCard.cloneNode(true);
    newCard.setAttribute('data-card', 'quem-sou-eu');
    var badge = newCard.querySelector('.card-badge'); if (badge) badge.remove();
    var img = newCard.querySelector('.card-img');     if (img) img.remove();
    newCard.className = newCard.className.replace(/card--copper|card--sage|card--sand|card--blush|card--featured/g, '').trim() + ' card--sand';
    var title = newCard.querySelector('.card-title'); if (title) title.innerHTML = '<em>Quem</em> sou eu';
    var label = newCard.querySelector('.card-label'); if (label) label.textContent = 'TRAJETÓRIA';
    var desc  = newCard.querySelector('.card-desc');  if (desc)  desc.textContent = 'Conheça minha trajetória, experiências, habilidades e formação profissional.';
    newCard.setAttribute('href', 'curriculo.html');
    newCard.removeAttribute('target');
    newCard.setAttribute('aria-label', 'Currículo — Quem sou eu');
    stack.appendChild(newCard);
  }

  // ============================================================
  // 13. CLEAN HTML EXPORT
  // ============================================================
  function buildCleanClone(rewriteToFolder) {
    if (state.activeText) TextEditor.deactivate(state.activeText);
    var clone = document.documentElement.cloneNode(true);

    if (rewriteToFolder) {
      // Point changed images / backgrounds to clean relative paths.
      $$('[data-export-src]', clone).forEach(function (n) { n.setAttribute('src', n.getAttribute('data-export-src')); });
      $$('[data-export-bg]', clone).forEach(function (n) { n.style.backgroundImage = 'url("' + n.getAttribute('data-export-bg') + '")'; });
    }
    // (When NOT rewriting, the dataURL already lives in src/background — keep it.)

    $$('.editor-root', clone).forEach(function (n) { n.remove(); });

    $$('*', clone).forEach(function (n) {
      if (n.classList && n.classList.length) {
        [].slice.call(n.classList).forEach(function (c) { if (c.indexOf('editor-') === 0) n.classList.remove(c); });
      }
      n.removeAttribute('contenteditable');
      n.removeAttribute('data-export-src');
      n.removeAttribute('data-export-bg');
      if (n.getAttribute && n.getAttribute('class') === '') n.removeAttribute('class');
      if (n.getAttribute && n.getAttribute('style') === '') n.removeAttribute('style');
    });

    $$('link[href*="editor.css"], link[href*="editor/editor.css"]', clone).forEach(function (n) { n.remove(); });
    $$('script[src*="editor.js"], script[src*="editor/editor.js"]', clone).forEach(function (n) { n.remove(); });

    clone.classList.remove('editor-active', 'editor-preview');
    if (clone.getAttribute('class') === '') clone.removeAttribute('class');
    return clone;
  }

  // Folder export: <img src="images/..."> + backgrounds → images/...
  function getCleanHTML() { return '<!DOCTYPE html>\n' + buildCleanClone(true).outerHTML; }
  // Standalone export: keeps dataURLs inline so a single file still works.
  function getStandaloneHTML() { return '<!DOCTYPE html>\n' + buildCleanClone(false).outerHTML; }

  function pageHtmlName() {
    var base = (location.pathname.split('/').pop() || 'index.html');
    if (!/\.html?$/i.test(base)) base += '.html';
    return base;
  }

  // ============================================================
  // 14. ZIP EXPORT (web_site_official/<page>.html + /images)
  // ============================================================
  function loadJSZip() {
    return new Promise(function (res, rej) {
      if (global.JSZip) return res(global.JSZip);
      var s = el('script', { src: JSZIP_CDN, class: 'editor-root' });
      s.onload = function () { global.JSZip ? res(global.JSZip) : rej(new Error('JSZip indisponível')); };
      s.onerror = function () { rej(new Error('Falha ao carregar JSZip')); };
      document.head.appendChild(s);
    });
  }

  function buildZipBlob() {
    return loadJSZip().then(function (JSZip) {
      var zip = new JSZip();
      var root = zip.folder('web_site_official');
      root.file(pageHtmlName(), getCleanHTML());
      if (Assets.list.length) {
        var imgs = root.folder('images');
        Assets.list.forEach(function (a) { imgs.file(a.name, a.blob); });
      }
      return zip.generateAsync({ type: 'blob' });
    });
  }

  function exportZip() {
    return buildZipBlob().then(function (blob) {
      triggerDownload(blob, 'web_site_official.zip');
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }

  // ETAPA 4 — envia o .zip ao Web App do Apps Script (backup Drive + dispatch GitHub).
  function pushToDrive(blob) {
    if (!DEPLOY_ENDPOINT) return Promise.resolve({ skipped: true });
    return blobToBase64(blob).then(function (b64) {
      var payload = {
        token: DEPLOY_TOKEN,
        client: DEPLOY_CLIENT,
        page: pageHtmlName(),
        filenameBase: 'web_site_official',
        zipBase64: b64
      };
      // text/plain evita preflight CORS; o GAS lê e.postData.contents.
      return fetch(DEPLOY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json().catch(function () { return {}; }); });
    });
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename, class: 'editor-root' });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function downloadStandaloneHTML() {
    var base = pageHtmlName().replace(/\.html?$/i, '');
    triggerDownload(new Blob([getStandaloneHTML()], { type: 'text/html;charset=utf-8' }), base + '_ready.html');
  }

  // ============================================================
  // 15. PUBLIC API
  // ============================================================
  // ============================================================
  // ETAPA 3 — Guarda de navegação + aviso de não salvo
  // ============================================================
  function guardNavigation() {
    // Ação 1 — em modo edição, o clique em <a> não navega (evita saída acidental).
    document.addEventListener('click', function (e) {
      if (state.isPreview) return;
      if (!document.body.classList.contains('editor-active')) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && !isEditorNode(a)) { e.preventDefault(); }
    }, true);

    // Ação 2 — avisa se houver alterações não salvas ao tentar sair.
    window.addEventListener('beforeunload', function (e) {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
      return e.returnValue;
    });
  }

  var VisualEditor = {
    version: '2.3.0',

    init: function () {
      if (this._inited) return;
      this._inited = true;
      log('initialized', location.pathname);

      UI.injectGlobalBar();
      UI.createFloatingToolbar();
      UI.createImageOverlay();
      UI.createInspectorPanel();

      TextEditor.enable();
      ImageEditor.enable();
      bindSelectionEvents();
      guardNavigation();

      if (document.querySelector(SKILL_SELECTOR)) SkillBarEditor.setup();
      setTimeout(setupHomeVitrineCard, 0);

      var images = $$('img').filter(function (n) { return !isEditorNode(n) && !isRestricted(n); });
      log('editable images:', images.length);
    },

    save: function () {
      Toast.show('Preparando pacote para publicação…', 4000);
      buildZipBlob().then(function (blob) {
        //triggerDownload(blob, 'web_site_official.zip');   // cópia local de segurança
        return pushToDrive(blob);
      }).then(function (res) {
        clearDirty();
        if (res && res.skipped) Toast.show('Pacote exportado: web_site_official.zip', 3400);
        else if (res && res.ok === false) Toast.show('Zip baixado, mas o backup remoto falhou', 4400);
        else Toast.show('Publicado: backup no Drive + deploy acionado', 4400);
      }).catch(function (e) {
        log('save failed', e);
        try { downloadStandaloneHTML(); clearDirty(); Toast.show('Sem conexão p/ JSZip — exportei HTML único', 3600); }
        catch (err) { Toast.show('Erro ao exportar'); log(err); }
      });
    },

    cancel: function () {
      if (state.dirty && !confirm('Descartar as alterações não salvas?')) return;
      location.reload();
    },

    preview: function (btn) {
      state.isPreview = !state.isPreview;
      document.body.classList.toggle('editor-preview', state.isPreview);
      if (state.isPreview) {
        clearHover();
        UI.hideImageOverlay();
        if (state.selected) state.selected.classList.remove('editor-selected');
        UI.hideToolbar();
        Inspector.close();
      }
      if (btn) btn.classList.toggle('editor-on', state.isPreview);
      Toast.show(state.isPreview ? 'Pré-visualização ativa' : 'Edição ativa');
    },

    // ETAPA 3 — abre o link do elemento selecionado em nova aba (botão 🔗 da toolbar).
    openSelectedLink: function () {
      var sel = state.selected;
      var a = sel && (tagOf(sel) === 'a' ? sel : (sel.closest && sel.closest('a[href]')));
      if (!a || !a.getAttribute('href')) { Toast.show('Selecione um link primeiro'); return; }
      window.open(a.getAttribute('href'), '_blank', 'noopener');
    },

    getCleanHTML: getCleanHTML,
    exportZip: exportZip,
    download: downloadStandaloneHTML,

    destroy: function () {
      $$('.editor-root').forEach(function (n) { n.remove(); });
      document.documentElement.classList.remove('editor-active');
      document.body.classList.remove('editor-active', 'editor-preview');
      this._inited = false;
    }
  };

  // ============================================================
  // 16. AUTO-INIT
  // ============================================================
  function boot() { VisualEditor.init(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.VisualEditor = VisualEditor;
})(window);
