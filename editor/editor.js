/* ============================================================
   VisualEditor — Global Inline Visual Editor  (v2.9.0-arch)
   Vanilla JS. Single file (no bundler). Loaded via auth.js.

   ARCHITECTURE MAP (single responsibility per block)
   -------------------------------------------------------------
   Core/Utils      — DOM helpers, debounce, rafThrottle, cloneDeep
   Validators      — image file + href sanitization
   Events          — register / destroy all listeners
   History         — undo/redo stack (studio)
   FramingMath     — pan math shared by Studio + Canvas
   Layout          — single scroll/resize reflow
   Assets          — upload path registry for ZIP export
   Toast           — single notification UI
   State           — editor session flags
   UI              — bar, toolbar, overlay, inspector shell
   Selection       — hover / select / deselect
   TextEditor      — contenteditable text
   ImageAutoFit    — smart focal + auto framing (single IA path)
   ImageStudio     — full framing panel (Mais opções)
   ImageCanvas     — on-page WYSIWYG chrome + mini toolbar
   ImageEditor     — pick / replace / background (single ingest)
   SkillBarEditor  — currículo bars
   Inspector       — style fields
   Publish         — clean HTML, ZIP, Drive deploy
   VisualEditor    — public façade + lifecycle

   Public API: window.VisualEditor
   ============================================================ */
(function (global) {
  'use strict';

  var DEBUG = false;
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
  // CORE / UTILS
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
  function cloneDeep(value) {
    if (value == null) return null;
    return JSON.parse(JSON.stringify(value));
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var ctx = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(ctx, args); }, ms);
    };
  }

  function rafThrottle(fn) {
    var ticking = false, lastArgs = null;
    return function () {
      lastArgs = arguments;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; fn.apply(null, lastArgs); });
    };
  }

  // ============================================================
  // VALIDATORS
  // ============================================================
  var ALLOWED_IMAGE_TYPES = /^(image\/(jpeg|jpg|png|webp|gif|avif))$/i;
  var MAX_IMAGE_BYTES = 8 * 1024 * 1024;

  function validateImageFile(file) {
    if (!file) return 'Nenhum arquivo selecionado';
    if (!ALLOWED_IMAGE_TYPES.test(file.type || '')) return 'Use JPG, PNG, WebP, GIF ou AVIF';
    if (file.size > MAX_IMAGE_BYTES) return 'Imagem muito grande (máx. 8 MB)';
    return null;
  }

  function sanitizeHref(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(v)) return v;
    if (/^[a-z0-9][\w./?#&=%+-]*$/i.test(v) && !/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
    return '';
  }

  function pastePlainText(e) {
    e.preventDefault();
    var text = '';
    try {
      text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    } catch (err) { text = ''; }
    text = String(text).replace(/\u0000/g, '');
    if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
      document.execCommand('insertText', false, text);
    } else if (window.getSelection) {
      var sel = window.getSelection();
      if (!sel.rangeCount) return;
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
      sel.collapseToEnd();
    }
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
  // EVENTS — single registry; destroy() removes everything
  // ============================================================
  var Events = {
    _list: [],
    on: function (target, type, handler, opts) {
      if (!target || !type || !handler) return handler;
      target.addEventListener(type, handler, opts);
      this._list.push({ target: target, type: type, handler: handler, opts: opts });
      return handler;
    },
    offAll: function () {
      var i, item;
      for (i = this._list.length - 1; i >= 0; i--) {
        item = this._list[i];
        try { item.target.removeEventListener(item.type, item.handler, item.opts); } catch (e) {}
      }
      this._list = [];
    }
  };

  // ============================================================
  // HISTORY — undo / redo stack (ImageStudio)
  // ============================================================
  function HistoryStack(limit) {
    this.past = [];
    this.future = [];
    this.limit = limit || 40;
  }
  HistoryStack.prototype.push = function (snapshot) {
    if (!snapshot) return;
    this.past.push(cloneDeep(snapshot));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  };
  HistoryStack.prototype.undo = function (current) {
    if (!this.past.length) return null;
    this.future.push(cloneDeep(current));
    return this.past.pop();
  };
  HistoryStack.prototype.redo = function (current) {
    if (!this.future.length) return null;
    this.past.push(cloneDeep(current));
    return this.future.pop();
  };
  HistoryStack.prototype.clear = function () { this.past = []; this.future = []; };
  HistoryStack.prototype.canUndo = function () { return this.past.length > 0; };
  HistoryStack.prototype.canRedo = function () { return this.future.length > 0; };

  // ============================================================
  // FRAMING MATH — shared pan for Studio + Canvas
  // ============================================================
  var FramingMath = {
    // object-view-box zooms/pans the bitmap WITHOUT transform — critical for
    // avatars whose border/radius live on the <img> (scale would grow the frame).
    _ovb: (function () {
      try {
        return typeof CSS !== 'undefined' && CSS.supports && CSS.supports('object-view-box', 'inset(10%)');
      } catch (e) { return false; }
    })(),

    pan: function (dragStart, clientX, clientY, rect) {
      var w = Math.max((rect && rect.width) || dragStart.rw || 1, 1);
      var h = Math.max((rect && rect.height) || dragStart.rh || 1, 1);
      var sens = dragStart.sens != null ? dragStart.sens : 1.35;
      var dx = ((clientX - dragStart.x) / w) * 100 * sens;
      var dy = ((clientY - dragStart.y) / h) * 100 * sens;
      return {
        x: clamp(dragStart.ox - dx, 0, 100),
        y: clamp(dragStart.oy - dy, 0, 100)
      };
    },

    bestZoomForAspect: function (img) {
      var iar = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      return iar < 0.85 ? 108 : 100;
    },

    // Layout box of the <img>. object-view-box does not change layout size, so we only
    // strip transform (legacy scale fallback) when measuring.
    layoutRect: function (el) {
      if (!el) return null;
      var prev = el.style.transform;
      var hadScale = prev && prev !== 'none' && prev.indexOf('scale') !== -1;
      if (hadScale) {
        el.style.transform = 'none';
        void el.offsetWidth;
      }
      var r = el.getBoundingClientRect();
      if (hadScale) el.style.transform = prev;
      return {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        bottom: r.bottom,
        right: r.right
      };
    },

    // Zoom/pan the PHOTO only. The <img> layout box (and its border/radius) never scale.
    // Prefer a real crop window via object-view-box (cover room + zoom + pan in one inset).
    paint: function (draft, img) {
      var z = clamp((draft && draft.zoom ? draft.zoom : 100) / 100, 0.5, 2);
      var fit = draft.lock && draft.fit === 'fill' ? 'cover' : (draft.fit || 'cover');
      var x = clamp(draft.x, 0, 100);
      var y = clamp(draft.y, 0, 100);

      var out = {
        fit: fit,
        objectPosition: x + '% ' + y + '%',
        transformOrigin: '50% 50%',
        transform: '',
        objectViewBox: '',
        z: z,
        x: x,
        y: y,
        mode: 'position'
      };

      if (FramingMath._ovb) {
        var nw = img && (img.naturalWidth || 0);
        var nh = img && (img.naturalHeight || 0);
        var ew = img && (img.clientWidth || img.offsetWidth || 0);
        var eh = img && (img.clientHeight || img.offsetHeight || 0);
        // Cached box during drag avoids layout thrash.
        if (draft && draft._lw > 0 && draft._lh > 0) {
          ew = draft._lw;
          eh = draft._lh;
        }

        if (nw > 0 && nh > 0 && ew > 0 && eh > 0 && fit !== 'none') {
          var contain = fit === 'contain' || fit === 'scale-down';
          // Cover/contain scale of the source into the box, then apply depth z.
          var base = contain
            ? Math.min(ew / nw, eh / nh)
            : Math.max(ew / nw, eh / nh);
          var scale = base * z;
          if (scale > 1e-6) {
            var visW = Math.min(nw, ew / scale);
            var visH = Math.min(nh, eh / scale);
            // Zoom-out can request a window larger than the bitmap — allow negative inset.
            if (!contain) {
              visW = ew / scale;
              visH = eh / scale;
            } else if (z < 1) {
              visW = ew / scale;
              visH = eh / scale;
            }
            var maxX = nw - visW;
            var maxY = nh - visH;
            var ox = maxX * (x / 100);
            var oy = maxY * (y / 100);
            var top = (oy / nh) * 100;
            var left = (ox / nw) * 100;
            var right = 100 - left - (visW / nw) * 100;
            var bottom = 100 - top - (visH / nh) * 100;
            out.objectViewBox = 'inset(' + top.toFixed(4) + '% ' + right.toFixed(4) + '% ' +
              bottom.toFixed(4) + '% ' + left.toFixed(4) + '%)';
            // Crop window already matches the element aspect — fill exactly.
            out.objectPosition = '50% 50%';
            out.fit = 'fill';
            out.mode = 'viewbox';
            return out;
          }
        }

        // Fallback without natural size yet: uniform inset + object-position pan.
        var visible = 100 / z;
        var gap = 100 - visible;
        if (Math.abs(gap) < 1.25) {
          out.objectViewBox = '';
          out.objectPosition = x + '% ' + y + '%';
        } else {
          var left2 = gap * (x / 100);
          var top2 = gap * (y / 100);
          out.objectViewBox = 'inset(' + top2.toFixed(4) + '% ' + (gap - left2).toFixed(4) + '% ' +
            (gap - top2).toFixed(4) + '% ' + left2.toFixed(4) + '%)';
          out.objectPosition = '50% 50%';
        }
        if (fit === 'scale-down') out.fit = 'contain';
        else if (fit === 'none') out.fit = 'none';
        else if (fit === 'contain') out.fit = 'contain';
        else out.fit = 'cover';
        return out;
      }

      // Fallback without object-view-box: continuous scale (clipped), no fit flip at 100%.
      if (Math.abs(z - 1) > 0.001) {
        out.transform = 'scale(' + z + ')';
        out.objectPosition = x + '% ' + y + '%';
      }
      return out;
    }
  };

  // ============================================================
  // LAYOUT — one scroll/resize reflow (toolbar / overlay / canvas / studio)
  // ============================================================
  var Layout = {
    _bound: false,
    enable: function () {
      if (this._bound) return;
      this._bound = true;
      var reflow = rafThrottle(function () {
        if (state.selected) UI.positionToolbar(state.selected);
        if (state.hoverImage) UI.positionImageOverlay(state.hoverImage);
        if (ImageCanvas.target) ImageCanvas.reposition();
        if (ImageStudio.isOpen) ImageStudio._sizeStage();
      });
      Events.on(window, 'scroll', reflow, true);
      Events.on(window, 'resize', reflow);
    },
    reset: function () { this._bound = false; }
  };

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
  // STATE — single session store
  // ============================================================
  var state = {
    dirty: false,
    selected: null,
    hoverEl: null,
    hoverImage: null,
    activeText: null,
    isPreview: false
  };

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
        el('button', { class: 'editor-tb-btn', title: 'Abrir link (nesta aba)', 'data-tb': 'openlink', text: '\uD83D\uDD17' }),
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
      var ov = el('div', { class: 'editor-img-overlay editor-root editor-img-inspect', role: 'status' }, [
        el('span', { class: 'editor-img-inspect-label', text: 'Esta imagem pode ser editada' })
      ]);
      document.body.appendChild(ov);
      this.imgOverlay = ov;
      ov.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (state.hoverImage) ImageCanvas.select(state.hoverImage);
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
       'border-color','box-shadow','font-weight','object-fit','object-position','transform',
       'transform-origin','clip-path']
        .forEach(function (p) { node.style.removeProperty(p); });
      node.removeAttribute('data-export-bg');
      node.removeAttribute('data-img-zoom');
      node.removeAttribute('data-img-x');
      node.removeAttribute('data-img-y');
      node.removeAttribute('data-img-fit');
      node.removeAttribute('data-img-lock');
      node.removeAttribute('data-img-auto');
      node.removeAttribute('data-img-fx');
      node.removeAttribute('data-img-fy');
      node.removeAttribute('data-img-focal');
      node.removeAttribute('data-img-focal-src');
      if (tagOf(node) === 'img' && typeof ImageStudio !== 'undefined' && ImageStudio._clearParentOverflowHack) {
        ImageStudio._clearParentOverflowHack(node);
      }
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
    Events.on(document, 'mousemove', rafThrottle(function (e) {
      if (state.isPreview) return;
      var t = e.target;
      if (tagOf(t) === 'img') { clearHover(); return; }
      if (!isEditable(t) || isEditorNode(t)) { clearHover(); return; }
      setHover(t);
    }), true);

    Events.on(document, 'mouseleave', function () { clearHover(); }, true);

    Events.on(document, 'click', function (e) {
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

    Events.on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && !state.isPreview && !(e.target && e.target.isContentEditable)) {
        if (ImageStudio.isOpen) return; // ImageStudio owns Escape while open
        if (ImageCanvas.target) { ImageCanvas.deselect(); return; }
        deselect();
      }
    });
  }

  // ============================================================
  // 8. TEXT EDITOR (deep inline editing on the exact element)
  // ============================================================
  var TextEditor = {
    enable: function () {
      var self = this;
      Events.on(document, 'dblclick', function (e) { self._maybeActivate(e); }, true);
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
        node.removeEventListener('paste', pastePlainText);
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
      node.addEventListener('paste', pastePlainText);
    },
    deactivate: function (node) {
      if (!node) return;
      node.removeAttribute('contenteditable');
      node.classList.remove('editor-text-active');
      if (state.activeText === node) state.activeText = null;
    }
  };

  // ============================================================
  // 8a. IMAGE AUTO-FIT — smart focal point + responsive reflow
  // ============================================================
  var ImageAutoFit = {
    _observers: typeof WeakMap !== 'undefined' ? new WeakMap() : null,
    _sizes: typeof WeakMap !== 'undefined' ? new WeakMap() : null,
    _focalCache: Object.create(null),
    _enabled: false,
    _faceDetector: null,
    _applying: false,

    isAuto: function (img) {
      return img && img.getAttribute('data-img-auto') === '1';
    },

    setAuto: function (img, on) {
      if (!img) return;
      img.setAttribute('data-img-auto', on ? '1' : '0');
    },

    containerSize: function (img) {
      var cw = img.clientWidth || 0;
      var ch = img.clientHeight || 0;
      if (cw >= 8 && ch >= 8) return { w: cw, h: ch };
      var p = img.parentElement;
      if (p) {
        cw = p.clientWidth || 0;
        ch = p.clientHeight || 0;
        if (cw >= 8 && ch >= 8) return { w: cw, h: ch };
      }
      var r = img.getBoundingClientRect();
      return { w: Math.max(r.width, 120), h: Math.max(r.height, 80) };
    },

    // Geometry-only fallback (sync) — used until / if focal point is ready.
    computeGeometry: function (img) {
      if (!img) return null;
      var box = this.containerSize(img);
      var cw = box.w, ch = box.h;
      var iw = img.naturalWidth || img.width || 0;
      var ih = img.naturalHeight || img.height || 0;
      if (!iw || !ih) return null;

      var car = cw / ch;
      var iar = iw / ih;
      var x = 50, y = 50;

      if (iar < 0.72) { y = car > 1.2 ? 36 : 38; }
      else if (iar < 0.92) { y = 42; }
      else if (iar > 2.4) { x = 50; y = 50; }
      else if (iar > 1.15) { y = car < 0.7 ? 48 : 50; }

      if (car > 1.75 && iar < 1) y = Math.min(y, 40);
      if (car < 0.55 && iar > 1.1) { x = 50; y = 50; }
      if (car > 0.85 && car < 1.15) {
        if (iar < 0.6) y = 38;
        if (iar > 1.8) y = 50;
      }

      return { zoom: 100, x: x, y: y, fit: 'cover', lock: true, auto: true, source: 'geometry' };
    },

    // Sync compute: geometry + cached focal point if available.
    compute: function (img) {
      var base = this.computeGeometry(img);
      if (!base) return null;
      var focal = this._cachedFocal(img);
      if (focal) {
        base.x = focal.x;
        base.y = focal.y;
        base.source = focal.source || 'focal';
      }
      return base;
    },

    _cachedFocal: function (img) {
      if (!img) return null;
      var src = img.currentSrc || img.src || '';
      if (!src) return null;
      if (img.getAttribute('data-img-focal-src') === src) {
        var fx = parseFloat(img.getAttribute('data-img-fx'));
        var fy = parseFloat(img.getAttribute('data-img-fy'));
        if (!isNaN(fx) && !isNaN(fy)) return { x: fx, y: fy, source: img.getAttribute('data-img-focal') || 'cached' };
      }
      return this._focalCache[src] || null;
    },

    _storeFocal: function (img, focal) {
      if (!img || !focal) return;
      var src = img.currentSrc || img.src || '';
      if (src) this._focalCache[src] = { x: focal.x, y: focal.y, source: focal.source };
      img.setAttribute('data-img-fx', String(Math.round(focal.x * 10) / 10));
      img.setAttribute('data-img-fy', String(Math.round(focal.y * 10) / 10));
      img.setAttribute('data-img-focal-src', src);
      img.setAttribute('data-img-focal', focal.source || 'smart');
    },

    _getFaceDetector: function () {
      if (this._faceDetector === false) return null;
      if (this._faceDetector) return this._faceDetector;
      try {
        if (typeof FaceDetector === 'undefined') { this._faceDetector = false; return null; }
        this._faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
        return this._faceDetector;
      } catch (e) {
        this._faceDetector = false;
        return null;
      }
    },

    // Canvas saliency: contrast + skin-tone bias + center weight (no ML).
    _saliencyFocal: function (img) {
      try {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        if (!iw || !ih) return null;
        var size = 48;
        var canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, size, size);
        var data = ctx.getImageData(0, 0, size, size).data;
        var best = 0, bx = size / 2, by = size / 2;
        var i, x, y, idx, r, g, b, lum, score, skin, cx, cy, dist;

        function lumAt(px, py) {
          if (px < 0 || py < 0 || px >= size || py >= size) return 0;
          var j = (py * size + px) * 4;
          return 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
        }

        for (y = 1; y < size - 1; y++) {
          for (x = 1; x < size - 1; x++) {
            idx = (y * size + x) * 4;
            r = data[idx]; g = data[idx + 1]; b = data[idx + 2];
            lum = 0.299 * r + 0.587 * g + 0.114 * b;
            // Local contrast (Sobel-ish)
            score = Math.abs(lumAt(x + 1, y) - lumAt(x - 1, y)) +
                    Math.abs(lumAt(x, y + 1) - lumAt(x, y - 1));
            // Skin-tone bias (faces / people)
            skin = (r > 95 && g > 40 && b > 20 && r > g && r > b &&
                    Math.abs(r - g) > 15 && (r - b) > 15) ? 28 : 0;
            // Slight preference for warmer / saturated subjects (products)
            score += skin + Math.min(40, Math.abs(r - b) * 0.15);
            // Center weight — soft gaussian-ish
            cx = (x + 0.5) / size - 0.5;
            cy = (y + 0.5) / size - 0.5;
            dist = cx * cx + cy * cy;
            score *= (1.35 - dist * 1.6);
            // Prefer upper-mid for portraits (faces tend to sit higher)
            if (y < size * 0.55) score *= 1.12;
            if (score > best) { best = score; bx = x + 0.5; by = y + 0.5; }
          }
        }
        if (best < 4) return null;
        return {
          x: Math.max(8, Math.min(92, (bx / size) * 100)),
          y: Math.max(8, Math.min(92, (by / size) * 100)),
          source: 'saliency'
        };
      } catch (e) {
        return null; // tainted canvas / CORS
      }
    },

    _facesFocal: function (img) {
      var self = this;
      var det = this._getFaceDetector();
      if (!det) return Promise.resolve(null);
      return det.detect(img).then(function (faces) {
        if (!faces || !faces.length) return null;
        var iw = img.naturalWidth || 1;
        var ih = img.naturalHeight || 1;
        var best = faces[0], area = 0, i, f, a;
        for (i = 0; i < faces.length; i++) {
          f = faces[i].boundingBox;
          a = f.width * f.height;
          if (a > area) { area = a; best = faces[i]; }
        }
        var box = best.boundingBox;
        // Bias toward eyes (upper third of face box)
        var fx = ((box.x + box.width / 2) / iw) * 100;
        var fy = ((box.y + box.height * 0.38) / ih) * 100;
        return {
          x: Math.max(5, Math.min(95, fx)),
          y: Math.max(5, Math.min(95, fy)),
          source: 'face'
        };
      }).catch(function () { return null; });
    },

    // Async smart focal: FaceDetector → saliency → geometry.
    detectFocal: function (img) {
      var self = this;
      var cached = this._cachedFocal(img);
      if (cached) return Promise.resolve(cached);

      return this._facesFocal(img).then(function (face) {
        if (face) { self._storeFocal(img, face); return face; }
        var sal = self._saliencyFocal(img);
        if (sal) { self._storeFocal(img, sal); return sal; }
        var geo = self.computeGeometry(img);
        if (geo) {
          var f = { x: geo.x, y: geo.y, source: 'geometry' };
          self._storeFocal(img, f);
          return f;
        }
        return null;
      });
    },

    computeAsync: function (img) {
      var self = this;
      var base = this.computeGeometry(img);
      if (!base) return Promise.resolve(null);
      return this.detectFocal(img).then(function (focal) {
        if (focal) {
          base.x = focal.x;
          base.y = focal.y;
          base.source = focal.source;
        }
        return base;
      });
    },

    // Recalculate only position (x/y) — keep zoom / fit / lock.
    recenter: function (img, draft) {
      var base = draft ? Object.assign({}, draft) : this.compute(img);
      if (!base) return Promise.resolve(null);
      return this.detectFocal(img).then(function (focal) {
        if (focal) { base.x = focal.x; base.y = focal.y; base.source = focal.source; }
        else {
          var geo = ImageAutoFit.computeGeometry(img);
          if (geo) { base.x = geo.x; base.y = geo.y; }
        }
        return base;
      });
    },

    _sameDraft: function (img, draft) {
      if (!img || !draft) return false;
      return img.getAttribute('data-img-zoom') === String(draft.zoom) &&
        img.getAttribute('data-img-x') === String(Math.round(draft.x * 10) / 10) &&
        img.getAttribute('data-img-y') === String(Math.round(draft.y * 10) / 10) &&
        img.getAttribute('data-img-fit') === draft.fit &&
        img.getAttribute('data-img-auto') === (draft.auto ? '1' : '0');
    },

    apply: function (img, dirty) {
      if (!img || !this.isAuto(img)) return null;
      if (this._applying) return null;
      var draft = this.compute(img);
      if (!draft) return null;
      if (this._sameDraft(img, draft)) return draft;
      this._applying = true;
      try {
        ImageStudio.applyFraming(img, draft, false);
        img.setAttribute('data-img-auto', '1');
        if (dirty) markDirty();
      } finally {
        this._applying = false;
      }
      return draft;
    },

    applySmart: function (img, dirty) {
      var self = this;
      if (!img || !this.isAuto(img)) return Promise.resolve(null);
      return this.computeAsync(img).then(function (draft) {
        if (!draft || !self.isAuto(img)) return null;
        if (self._sameDraft(img, draft)) return draft;
        self._applying = true;
        try {
          ImageStudio.applyFraming(img, draft, false);
          img.setAttribute('data-img-auto', '1');
          if (dirty) markDirty();
        } finally {
          self._applying = false;
        }
        return draft;
      });
    },

    // Single IA path for Canvas + Studio ("Melhor Enquadramento").
    applyBestFrame: function (img, opts) {
      opts = opts || {};
      var self = this;
      if (!img) return Promise.resolve(null);
      this.setAuto(img, true);
      img.removeAttribute('data-img-focal-src');
      var src = img.currentSrc || img.src;
      if (src && this._focalCache[src]) delete this._focalCache[src];

      return this.computeAsync(img).then(function (computed) {
        if (!computed) return null;
        var draft = Object.assign({}, computed, {
          auto: true,
          zoom: FramingMath.bestZoomForAspect(img),
          fit: 'cover',
          lock: true
        });
        self._applying = true;
        try {
          ImageStudio.applyFraming(img, draft, !!opts.live);
          img.setAttribute('data-img-auto', '1');
          if (opts.dirty !== false) markDirty();
        } finally {
          self._applying = false;
        }
        return draft;
      });
    },

    applyWhenReady: function (img, cb) {
      var self = this;
      function run() {
        self.applySmart(img, false).then(function (draft) {
          if (typeof cb === 'function') cb(draft);
        });
      }
      if (img.complete && img.naturalWidth > 0) run();
      else {
        img.addEventListener('load', run, { once: true });
        img.addEventListener('error', function () { if (typeof cb === 'function') cb(null); }, { once: true });
      }
    },

    prepareNew: function (img, cb) {
      if (!img) return;
      this.setAuto(img, true);
      this.watch(img);
      this.applyWhenReady(img, function (draft) {
        if (typeof cb === 'function') cb(draft);
      });
    },

    watch: function (img) {
      if (!img || isEditorNode(img) || isRestricted(img)) return;
      if (!this._observers) return;
      if (this._observers.has(img)) return;

      var tick = debounce(function () {
        if (state.isPreview || ImageAutoFit._applying) return;
        if (!ImageAutoFit.isAuto(img)) return;
        var box = ImageAutoFit.containerSize(img);
        var key = Math.round(box.w) + 'x' + Math.round(box.h);
        if (ImageAutoFit._sizes) {
          if (ImageAutoFit._sizes.get(img) === key) return;
          ImageAutoFit._sizes.set(img, key);
        }
        if (ImageStudio.isOpen && ImageStudio.target === img) {
          ImageStudio._runAuto(true);
          return;
        }
        ImageAutoFit.apply(img, false);
      }, 140);

      if (typeof ResizeObserver === 'undefined') {
        this._observers.set(img, { disconnect: function () {} });
        return;
      }
      var ro = new ResizeObserver(tick);
      ro.observe(img);
      if (img.parentElement) ro.observe(img.parentElement);
      this._observers.set(img, ro);
    },

    _reflowAll: function () {
      $$('img').forEach(function (img) {
        if (isEditorNode(img) || isRestricted(img)) return;
        if (ImageAutoFit.isAuto(img)) ImageAutoFit.apply(img, false);
      });
    },

    enable: function () {
      if (this._enabled) return;
      this._enabled = true;
      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', debounce(function () { ImageAutoFit._reflowAll(); }, 160));
      }
      $$('img').forEach(function (img) {
        if (isEditorNode(img) || isRestricted(img)) return;
        if (ImageAutoFit.isAuto(img)) ImageAutoFit.watch(img);
      });
    }
  };

  // ============================================================
  // 8b. IMAGE STUDIO — Canva-like framing (draft → commit)
  // ============================================================
  // Framing is stored on the <img> as:
  //   data-img-zoom / data-img-x / data-img-y / data-img-fit / data-img-lock / data-img-auto
  // and mirrored into inline styles (object-fit, object-position, transform,
  // transform-origin) so the published HTML keeps the exact crop.
  var ImageStudio = {
    isOpen: false,
    target: null,
    snapshot: null,
    draft: null,
    _manualMem: null,
    _autoMem: null,
    _stack: null,
    device: 'desktop',
    safeArea: true,
    root: null,
    stageImg: null,
    stageImgs: null,
    dragging: false,
    dragStart: null,
    _raf: 0,
    _animTimer: 0,
    _gen: 0,

    DEFAULTS: { zoom: 100, x: 50, y: 50, fit: 'cover', lock: true, auto: false },

    _cloneDraft: function (d) {
      var c = cloneDeep(d);
      if (c) { delete c._lw; delete c._lh; }
      return c;
    },

    _enableAnim: function () {
      if (!this.root) return;
      this.root.classList.add('editor-studio--anim');
      if (this._animTimer) clearTimeout(this._animTimer);
      var self = this;
      this._animTimer = setTimeout(function () {
        if (self.root) self.root.classList.remove('editor-studio--anim');
      }, 260);
    },

    readFrom: function (img) {
      var d = ImageStudio.DEFAULTS;
      var auto = img.getAttribute('data-img-auto') === '1';
      var zoom = parseFloat(img.getAttribute('data-img-zoom'));
      var x = parseFloat(img.getAttribute('data-img-x'));
      var y = parseFloat(img.getAttribute('data-img-y'));
      var fit = img.getAttribute('data-img-fit') || img.style.objectFit || '';
      if (!fit) {
        try { fit = getComputedStyle(img).objectFit; } catch (e) { fit = 'cover'; }
      }
      if (!fit || fit === 'none' || fit === 'initial') fit = 'cover';
      // 'fill' is only a paint-time CSS mode for object-view-box crops — treat as cover.
      if (fit === 'fill') fit = 'cover';
      var lock = img.getAttribute('data-img-lock');
      if (lock == null) lock = '1';
      if (isNaN(x) || isNaN(y)) {
        var pos = img.style.objectPosition || '';
        var m = pos.match(/([\d.]+)%\s+([\d.]+)%/);
        if (m) { x = parseFloat(m[1]); y = parseFloat(m[2]); }
      }
      if (isNaN(zoom)) {
        var tr = img.style.transform || '';
        var sm = tr.match(/scale\(\s*([\d.]+)\s*\)/);
        if (sm) zoom = Math.round(parseFloat(sm[1]) * 100);
      }
      return {
        zoom: isNaN(zoom) ? d.zoom : Math.max(50, Math.min(200, Math.round(zoom))),
        x: isNaN(x) ? d.x : Math.max(0, Math.min(100, x)),
        y: isNaN(y) ? d.y : Math.max(0, Math.min(100, y)),
        fit: fit,
        lock: lock !== '0',
        auto: auto
      };
    },

    captureSnapshot: function (img) {
      return {
        zoom: img.getAttribute('data-img-zoom'),
        x: img.getAttribute('data-img-x'),
        y: img.getAttribute('data-img-y'),
        fit: img.getAttribute('data-img-fit'),
        lock: img.getAttribute('data-img-lock'),
        auto: img.getAttribute('data-img-auto'),
        objectFit: img.style.objectFit,
        objectPosition: img.style.objectPosition,
        transform: img.style.transform,
        transformOrigin: img.style.transformOrigin,
        clipPath: img.style.clipPath,
        objectViewBox: img.style.objectViewBox
      };
    },

    restoreSnapshot: function (img, snap) {
      if (!img || !snap) return;
      function setAttr(k, v) { if (v == null || v === '') img.removeAttribute(k); else img.setAttribute(k, v); }
      setAttr('data-img-zoom', snap.zoom);
      setAttr('data-img-x', snap.x);
      setAttr('data-img-y', snap.y);
      setAttr('data-img-fit', snap.fit);
      setAttr('data-img-lock', snap.lock);
      setAttr('data-img-auto', snap.auto);
      img.style.objectFit = snap.objectFit || '';
      img.style.objectPosition = snap.objectPosition || '';
      img.style.transform = snap.transform || '';
      img.style.transformOrigin = snap.transformOrigin || '';
      img.style.clipPath = snap.clipPath || '';
      if (snap.objectViewBox) img.style.objectViewBox = snap.objectViewBox;
      else img.style.removeProperty('object-view-box');
      ImageStudio._clearParentOverflowHack(img);
    },

    // Circular / framed images must keep parent layout untouched (rings, masks).
    _isSelfClipped: function (img) {
      if (!img) return false;
      if (img.classList && (img.classList.contains('avatar-img') || img.classList.contains('card-img'))) return true;
      try {
        var br = (getComputedStyle(img).borderRadius || '').trim();
        if (br === '50%' || br === '9999px' || /^50%(\s+\/\s+50%)?$/.test(br)) return true;
        if (parseFloat(br) >= 999) return true;
      } catch (e) {}
      var p = img.parentElement;
      if (p && p.classList && (p.classList.contains('avatar-wrap') || p.classList.contains('media-frame'))) return true;
      return false;
    },

    _clearParentOverflowHack: function (img) {
      var parent = img && img.parentElement;
      if (!parent) return;
      // Only clear overflow we likely injected — leave intentional author CSS alone
      // by only removing the *inline* overflow when parent is a known frame.
      if (parent.classList && (parent.classList.contains('avatar-wrap') || parent.classList.contains('media-frame'))) {
        parent.style.removeProperty('overflow');
      }
    },

    applyFraming: function (img, draft, live) {
      if (!img || !draft) return;
      var paint = FramingMath.paint(draft, img);

      img.setAttribute('data-img-zoom', String(draft.zoom));
      img.setAttribute('data-img-x', String(Math.round(draft.x * 10) / 10));
      img.setAttribute('data-img-y', String(Math.round(draft.y * 10) / 10));
      img.setAttribute('data-img-fit', draft.fit || 'cover');
      img.setAttribute('data-img-lock', draft.lock ? '1' : '0');
      img.setAttribute('data-img-auto', draft.auto ? '1' : '0');

      // Only paint properties — never width/height/parent size.
      img.style.objectFit = paint.fit;
      img.style.objectPosition = paint.objectPosition;
      img.style.transformOrigin = paint.transformOrigin;
      img.style.transform = paint.transform || '';

      if (paint.objectViewBox) img.style.objectViewBox = paint.objectViewBox;
      else img.style.removeProperty('object-view-box');

      // Fallback scale path only: clip so the frame cannot appear to grow.
      if (paint.transform) {
        if (ImageStudio._isSelfClipped(img)) img.style.clipPath = 'circle(50% at 50% 50%)';
        else img.style.clipPath = 'inset(0)';
      } else {
        img.style.removeProperty('clip-path');
      }

      ImageStudio._clearParentOverflowHack(img);

      if (live) {
        ImageStudio._paintPreviews();
        if (!ImageStudio._suppressDirty) markDirty();
      }
    },

    _paintPreviews: function () {
      var draft = ImageStudio.draft;
      if (!draft) return;
      var list = ImageStudio.stageImgs;
      var apply = function (node) {
        if (!node) return;
        var paint = FramingMath.paint(draft, node);
        node.style.objectFit = paint.fit;
        node.style.objectPosition = paint.objectPosition;
        node.style.transformOrigin = paint.transformOrigin;
        node.style.transform = paint.transform || 'none';
        if (paint.objectViewBox) node.style.objectViewBox = paint.objectViewBox;
        else node.style.removeProperty('object-view-box');
      };
      if (!list || !list.length) {
        apply(ImageStudio.stageImg);
        return;
      }
      for (var i = 0; i < list.length; i++) apply(list[i]);
    },

    _runAuto: function (silent) {
      if (!this.target || !this.draft) return;
      var self = this;
      var img = this.target;
      var gen = ++this._gen;
      this._suppressDirty = true;
      ImageAutoFit.computeAsync(img).then(function (computed) {
        if (!computed || !self.isOpen || self.target !== img || self._gen !== gen || !self.draft) {
          self._suppressDirty = false;
          return;
        }
        self.draft = Object.assign({}, computed, {
          auto: true,
          zoom: 100,
          fit: 'cover',
          lock: true
        });
        self._autoMem = self._cloneDraft(self.draft);
        self._enableAnim();
        self.applyFraming(img, self.draft, true);
        self._suppressDirty = false;
        self._syncControls();
        if (!silent) Toast.show('Enquadramento automático atualizado');
      }).catch(function () { self._suppressDirty = false; });
    },

    _toggleAuto: function () {
      if (!this.draft) return;
      this.pushHistory();
      this._enableAnim();
      if (this.draft.auto) {
        this._autoMem = this._cloneDraft(this.draft);
        this._autoMem.auto = true;
        if (this._manualMem) {
          this.draft = this._cloneDraft(this._manualMem);
          this.draft.auto = false;
        } else {
          this.draft.auto = false;
        }
        Toast.show('Ajuste manual ativado');
        this.applyFraming(this.target, this.draft, true);
        this._syncControls();
      } else {
        this._manualMem = this._cloneDraft(this.draft);
        this._manualMem.auto = false;
        if (this._autoMem) {
          this.draft = this._cloneDraft(this._autoMem);
          this.draft.auto = true;
          this.applyFraming(this.target, this.draft, true);
          this._syncControls();
        } else {
          this.draft.auto = true;
          this._runAuto(true);
        }
        Toast.show('Ajuste Automático ativado');
      }
    },

    _recenter: function () {
      if (!this.target || !this.draft) return;
      var self = this;
      var img = this.target;
      var gen = ++this._gen;
      this.pushHistory();
      ImageAutoFit.recenter(img, this.draft).then(function (next) {
        if (!next || !self.isOpen || self.target !== img || self._gen !== gen || !self.draft) return;
        self.draft.x = next.x;
        self.draft.y = next.y;
        self._enableAnim();
        self.applyFraming(img, self.draft, true);
        self._syncControls();
        if (self.draft.auto) self._autoMem = self._cloneDraft(self.draft);
        else self._manualMem = self._cloneDraft(self.draft);
        Toast.show('Enquadramento recentralizado');
      });
    },

    _isManualControl: function (node) {
      if (!node || !node.getAttribute) return false;
      if (node.hasAttribute('data-zoom') || node.hasAttribute('data-nudge') ||
          node.hasAttribute('data-pos') || node.hasAttribute('data-fit')) return true;
      var act = node.getAttribute('data-studio');
      return act === 'zoom' || act === 'zoom-in' || act === 'zoom-out' || act === 'zoom-center' ||
        act === 'reset' || act === 'lock';
    },

    pushHistory: function () {
      if (!this.draft) return;
      if (!this._stack) this._stack = new HistoryStack(40);
      this._stack.push(this.draft);
      this._syncHistoryBtns();
    },

    undo: function () {
      if (!this._stack) return;
      var prev = this._stack.undo(this.draft);
      if (!prev) return;
      this.draft = prev;
      this._enableAnim();
      this._paint(false);
      this._syncHistoryBtns();
    },

    redo: function () {
      if (!this._stack) return;
      var next = this._stack.redo(this.draft);
      if (!next) return;
      this.draft = next;
      this._enableAnim();
      this._paint(false);
      this._syncHistoryBtns();
    },

    _syncHistoryBtns: function () {
      if (!this.root) return;
      var u = this.root.querySelector('[data-studio="undo"]');
      var r = this.root.querySelector('[data-studio="redo"]');
      if (u) u.disabled = !(this._stack && this._stack.canUndo());
      if (r) r.disabled = !(this._stack && this._stack.canRedo());
    },

    _paint: function (record) {
      if (record) this.pushHistory();
      if (this.target) this.applyFraming(this.target, this.draft, true);
      this._syncControls();
    },

    _syncControls: function () {
      if (!this.root || !this.draft) return;
      var d = this.draft;
      var zoom = this.root.querySelector('[data-studio="zoom"]');
      var zoomLabel = this.root.querySelector('[data-studio="zoom-label"]');
      if (zoom) { zoom.value = String(d.zoom); zoom.disabled = !!d.auto; }
      if (zoomLabel) zoomLabel.textContent = d.zoom + '%';
      $$('[data-fit]', this.root).forEach(function (b) {
        b.classList.toggle('editor-on', b.getAttribute('data-fit') === d.fit);
        b.disabled = !!d.auto;
      });
      $$('[data-device]', this.root).forEach(function (b) {
        b.classList.toggle('editor-on', b.getAttribute('data-device') === ImageStudio.device);
      });
      $$('[data-zoom]', this.root).forEach(function (b) { b.disabled = !!d.auto; });
      $$('[data-nudge]', this.root).forEach(function (b) { b.disabled = !!d.auto; });
      $$('[data-pos]', this.root).forEach(function (b) { b.disabled = !!d.auto; });
      ['zoom-in','zoom-out','zoom-center','reset','lock'].forEach(function (k) {
        var b = ImageStudio.root.querySelector('[data-studio="' + k + '"]');
        if (b) b.disabled = !!d.auto;
      });
      var lock = this.root.querySelector('[data-studio="lock"]');
      if (lock) lock.classList.toggle('editor-on', !!d.lock);
      var safe = this.root.querySelector('[data-studio="safe"]');
      if (safe) safe.classList.toggle('editor-on', !!ImageStudio.safeArea);
      var autoBtn = this.root.querySelector('[data-studio="toggle-auto"]');
      if (autoBtn) autoBtn.classList.toggle('editor-on', !!d.auto);
      var hint = this.root.querySelector('[data-studio="auto-hint"]');
      if (hint) {
        hint.textContent = d.auto
          ? 'O sistema enquadra a foto por você. Duplo clique na imagem também alterna o modo.'
          : 'Modo manual — use os controles abaixo. Duplo clique na imagem reativa o automático.';
      }
      var crop = this.root.querySelector('.editor-studio-crop--main');
      if (crop) crop.classList.toggle('editor-studio-crop--locked', !!d.auto);
      this.root.classList.toggle('editor-studio--auto', !!d.auto);
      $$('.editor-studio-device-card', this.root).forEach(function (card) {
        card.classList.toggle('editor-on', card.getAttribute('data-preview') === ImageStudio.device);
      });
      var frame = this.root.querySelector('.editor-studio-frame');
      if (frame) {
        frame.classList.toggle('editor-studio-safe', !!ImageStudio.safeArea);
        frame.setAttribute('data-device', ImageStudio.device);
      }
      $$('.editor-studio-safe-overlay', this.root).forEach(function (ov) {
        ov.parentElement && ov.parentElement.classList.toggle('editor-studio-safe-on', !!ImageStudio.safeArea);
      });
    },

    _ensureShell: function () {
      if (this.root) return this.root;
      var root = el('div', { class: 'editor-studio editor-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Editor de imagem' });
      root.innerHTML =
        '<div class="editor-studio-backdrop" data-studio="cancel"></div>' +
        '<div class="editor-studio-panel">' +
          '<header class="editor-studio-head">' +
            '<div><div class="editor-studio-title">Editor de imagem</div>' +
            '<div class="editor-studio-sub">Arraste, enquadre e ajuste — como no Canva</div></div>' +
            '<div class="editor-studio-head-actions">' +
              '<button type="button" class="editor-btn editor-btn--ghost" data-studio="undo" title="Desfazer">↶</button>' +
              '<button type="button" class="editor-btn editor-btn--ghost" data-studio="redo" title="Refazer">↷</button>' +
              '<button type="button" class="editor-studio-x" data-studio="cancel" aria-label="Fechar">×</button>' +
            '</div>' +
          '</header>' +
          '<div class="editor-studio-body">' +
            '<div class="editor-studio-stage-wrap">' +
              '<div class="editor-studio-devices" role="group" aria-label="Responsividade">' +
                '<span class="editor-studio-devices-label">Prévia em tempo real</span>' +
                '<button type="button" class="editor-seg-btn" data-device="desktop">Desktop</button>' +
                '<button type="button" class="editor-seg-btn" data-device="tablet">Tablet</button>' +
                '<button type="button" class="editor-seg-btn" data-device="mobile">Mobile</button>' +
              '</div>' +
              '<div class="editor-studio-multi">' +
                '<div class="editor-studio-device-card editor-on" data-preview="desktop">' +
                  '<span class="editor-studio-device-label">Desktop</span>' +
                  '<div class="editor-studio-frame" data-device="desktop">' +
                    '<div class="editor-studio-crop editor-studio-crop--main">' +
                      '<img class="editor-studio-preview" alt="Prévia Desktop" draggable="false" />' +
                      '<div class="editor-studio-safe-overlay" aria-hidden="true"><span>Área Segura</span></div>' +
                      '<div class="editor-studio-drag-hint">Arraste a imagem</div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="editor-studio-device-card" data-preview="tablet">' +
                  '<span class="editor-studio-device-label">Tablet</span>' +
                  '<div class="editor-studio-frame" data-device="tablet">' +
                    '<div class="editor-studio-crop editor-studio-crop--sat" data-sat="tablet">' +
                      '<img class="editor-studio-preview" alt="Prévia Tablet" draggable="false" />' +
                      '<div class="editor-studio-safe-overlay" aria-hidden="true"><span>Área Segura</span></div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="editor-studio-device-card" data-preview="mobile">' +
                  '<span class="editor-studio-device-label">Mobile</span>' +
                  '<div class="editor-studio-frame" data-device="mobile">' +
                    '<div class="editor-studio-crop editor-studio-crop--sat" data-sat="mobile">' +
                      '<img class="editor-studio-preview" alt="Prévia Mobile" draggable="false" />' +
                      '<div class="editor-studio-safe-overlay" aria-hidden="true"><span>Área Segura</span></div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<aside class="editor-studio-controls">' +
              '<section class="editor-studio-group editor-studio-group--auto">' +
                '<h3>Enquadramento</h3>' +
                '<button type="button" class="editor-studio-auto-toggle editor-btn editor-btn--primary" data-studio="toggle-auto">' +
                  '<span class="editor-studio-auto-check">✓</span> Ajuste Automático' +
                '</button>' +
                '<p class="editor-studio-auto-hint" data-studio="auto-hint">O sistema enquadra a foto por você.</p>' +
                '<button type="button" class="editor-btn" data-studio="recenter" style="width:100%;margin-top:10px">🎯 Recentralizar</button>' +
                '<button type="button" class="editor-btn editor-btn--primary" data-studio="ai" style="width:100%;margin-top:8px">✨ Melhor Enquadramento</button>' +
                '<button type="button" class="editor-btn" data-studio="safe" style="width:100%;margin-top:8px">Área segura</button>' +
                '<button type="button" class="editor-btn" data-studio="replace" style="width:100%;margin-top:8px">Trocar imagem</button>' +
              '</section>' +
              '<div class="editor-studio-manual">' +
              '<section class="editor-studio-group">' +
                '<h3>Zoom</h3>' +
                '<div class="editor-studio-zoom-presets">' +
                  '<button type="button" class="editor-seg-btn" data-zoom="50">50%</button>' +
                  '<button type="button" class="editor-seg-btn" data-zoom="75">75%</button>' +
                  '<button type="button" class="editor-seg-btn" data-zoom="100">100%</button>' +
                  '<button type="button" class="editor-seg-btn" data-zoom="125">125%</button>' +
                  '<button type="button" class="editor-seg-btn" data-zoom="150">150%</button>' +
                  '<button type="button" class="editor-seg-btn" data-zoom="200">200%</button>' +
                '</div>' +
                '<label class="editor-label" style="margin-top:10px">Profundidade <span data-studio="zoom-label">100%</span></label>' +
                '<input type="range" class="editor-range" data-studio="zoom" min="50" max="200" step="1" value="100" />' +
                '<div class="editor-row" style="margin-top:8px;gap:6px">' +
                  '<button type="button" class="editor-seg-btn" data-studio="zoom-out" title="Afastar">−</button>' +
                  '<button type="button" class="editor-seg-btn" data-studio="zoom-center" title="Centralizar zoom">◎</button>' +
                  '<button type="button" class="editor-seg-btn" data-studio="zoom-in" title="Aproximar">+</button>' +
                '</div>' +
              '</section>' +
              '<section class="editor-studio-group">' +
                '<h3>Posição</h3>' +
                '<div class="editor-studio-nudge">' +
                  '<button type="button" class="editor-seg-btn" data-nudge="0,-8" title="Subir">↑</button>' +
                  '<div class="editor-row" style="gap:6px">' +
                    '<button type="button" class="editor-seg-btn" data-nudge="-8,0" title="Esquerda">←</button>' +
                    '<button type="button" class="editor-seg-btn" data-nudge="8,0" title="Direita">→</button>' +
                  '</div>' +
                  '<button type="button" class="editor-seg-btn" data-nudge="0,8" title="Descer">↓</button>' +
                '</div>' +
                '<p class="editor-studio-hint">Ou arraste a imagem na prévia</p>' +
                '<label class="editor-label">Posições rápidas</label>' +
                '<div class="editor-studio-quick">' +
                  '<button type="button" class="editor-seg-btn" data-pos="0,0" title="Superior esquerda">↖</button>' +
                  '<button type="button" class="editor-seg-btn" data-pos="50,0" title="Superior">↑</button>' +
                  '<button type="button" class="editor-seg-btn" data-pos="100,0" title="Superior direita">↗</button>' +
                  '<button type="button" class="editor-seg-btn" data-pos="0,50" title="Esquerda">←</button>' +
                  '<button type="button" class="editor-seg-btn" data-pos="50,50" title="Centro">◎</button>' +
                  '<button type="button" class="editor-seg-btn" data-pos="100,50" title="Direita">→</button>' +
                  '<button type="button" class="editor-seg-btn" data-pos="0,100" title="Inferior esquerda">↙</button>' +
                  '<button type="button" class="editor-seg-btn" data-pos="50,100" title="Inferior">↓</button>' +
                  '<button type="button" class="editor-seg-btn" data-pos="100,100" title="Inferior direita">↘</button>' +
                '</div>' +
                '<button type="button" class="editor-reset-btn" data-studio="reset" style="margin-top:12px">Restaurar posição original</button>' +
              '</section>' +
              '<section class="editor-studio-group">' +
                '<h3>Corte</h3>' +
                '<button type="button" class="editor-btn" data-studio="lock" style="width:100%;margin-bottom:10px">Bloquear proporção</button>' +
                '<div class="editor-studio-fits">' +
                  '<button type="button" class="editor-seg-btn" data-fit="cover">Cover</button>' +
                  '<button type="button" class="editor-seg-btn" data-fit="contain">Contain</button>' +
                  '<button type="button" class="editor-seg-btn" data-fit="fill">Fill</button>' +
                  '<button type="button" class="editor-seg-btn" data-fit="scale-down">Scale Down</button>' +
                  '<button type="button" class="editor-seg-btn" data-fit="none">Original</button>' +
                '</div>' +
              '</section>' +
              '</div>' +
            '</aside>' +
          '</div>' +
          '<footer class="editor-studio-foot">' +
            '<button type="button" class="editor-btn" data-studio="cancel">Cancelar</button>' +
            '<button type="button" class="editor-btn editor-btn--primary" data-studio="save">Salvar Alterações</button>' +
          '</footer>' +
        '</div>';

      document.body.appendChild(root);
      this.root = root;
      this.stageImgs = root.querySelectorAll('.editor-studio-preview');
      this.stageImg = this.stageImgs[0] || null;
      this._bindShell();
      return root;
    },

    _bindShell: function () {
      var self = this;
      var root = this.root;
      var crop = root.querySelector('.editor-studio-crop--main');

      root.addEventListener('click', function (e) {
        var card = e.target.closest('[data-preview]');
        if (card && !e.target.closest('[data-studio],[data-zoom],[data-nudge],[data-pos],[data-fit],[data-device]')) {
          // clicking a device card focuses that device for interaction sizing
          var prev = card.getAttribute('data-preview');
          if (prev) {
            self.device = prev;
            self._syncControls();
            self._sizeStage();
          }
        }

        var t = e.target.closest('[data-studio],[data-zoom],[data-nudge],[data-pos],[data-fit],[data-device]');
        if (!t) return;
        e.preventDefault();

        if (self.draft && self.draft.auto && self._isManualControl(t)) return;

        if (t.hasAttribute('data-studio')) {
          var act = t.getAttribute('data-studio');
          if (act === 'cancel') return self.close(false);
          if (act === 'save') return self.close(true);
          if (act === 'undo') return self.undo();
          if (act === 'redo') return self.redo();
          if (act === 'replace') {
            return ImageEditor.pick(self.target, function () {
              var src = self.target.src;
              for (var i = 0; i < self.stageImgs.length; i++) self.stageImgs[i].src = src;
              self.target.removeAttribute('data-img-focal-src');
              self.target.removeAttribute('data-img-fx');
              self.target.removeAttribute('data-img-fy');
              if (self.draft.auto) {
                ImageAutoFit.setAuto(self.target, true);
                self._runAuto(true);
              }
              Toast.show('Imagem trocada');
            });
          }
          if (act === 'toggle-auto') {
            self._toggleAuto();
            return;
          }
          if (act === 'ai') {
            self.pushHistory();
            ImageAutoFit.applyBestFrame(self.target, { live: true }).then(function (draft) {
              if (!draft || !self.isOpen || !self.target) return;
              self.draft = draft;
              self._autoMem = self._cloneDraft(draft);
              self._enableAnim();
              self._syncControls();
              if (ImageCanvas.target === self.target) {
                ImageCanvas.draft = draft;
                ImageCanvas._syncUI();
              }
              Toast.show('✨ Melhor enquadramento aplicado');
            });
            return;
          }
          if (act === 'recenter') {
            self._recenter();
            return;
          }
          if (act === 'lock') {
            self.pushHistory();
            self.draft.lock = !self.draft.lock;
            if (self.draft.lock && self.draft.fit === 'fill') self.draft.fit = 'cover';
            self._paint(false);
            Toast.show(self.draft.lock ? 'Proporção bloqueada' : 'Proporção liberada');
            return;
          }
          if (act === 'safe') {
            self.safeArea = !self.safeArea;
            self._syncControls();
            return;
          }
          if (act === 'reset') {
            self.pushHistory();
            if (self.draft.auto) {
              self._runAuto(false);
            } else {
              self.draft = cloneDeep(self.DEFAULTS);
              self.draft.auto = false;
              self._enableAnim();
              self._paint(false);
              Toast.show('Posição original restaurada');
            }
            return;
          }
          if (act === 'zoom-in') {
            self.pushHistory();
            self.draft.zoom = Math.min(200, self.draft.zoom + 10);
            self._paint(false);
            return;
          }
          if (act === 'zoom-out') {
            self.pushHistory();
            self.draft.zoom = Math.max(50, self.draft.zoom - 10);
            self._paint(false);
            return;
          }
          if (act === 'zoom-center') {
            self.pushHistory();
            self.draft.x = 50; self.draft.y = 50; self.draft.zoom = 100;
            self._paint(false);
            return;
          }
        }

        if (t.hasAttribute('data-zoom')) {
          self.pushHistory();
          self.draft.zoom = parseInt(t.getAttribute('data-zoom'), 10);
          self._paint(false);
          return;
        }
        if (t.hasAttribute('data-nudge')) {
          var n = t.getAttribute('data-nudge').split(',');
          self.pushHistory();
          self.draft.x = Math.max(0, Math.min(100, self.draft.x + parseFloat(n[0])));
          self.draft.y = Math.max(0, Math.min(100, self.draft.y + parseFloat(n[1])));
          self._paint(false);
          return;
        }
        if (t.hasAttribute('data-pos')) {
          var p = t.getAttribute('data-pos').split(',');
          self.pushHistory();
          self.draft.x = parseFloat(p[0]);
          self.draft.y = parseFloat(p[1]);
          self._paint(false);
          return;
        }
        if (t.hasAttribute('data-fit')) {
          self.pushHistory();
          var fit = t.getAttribute('data-fit');
          if (self.draft.lock && fit === 'fill') {
            Toast.show('Desbloqueie a proporção para usar Fill');
            return;
          }
          self.draft.fit = fit;
          self._paint(false);
          return;
        }
        if (t.hasAttribute('data-device')) {
          self.device = t.getAttribute('data-device');
          self._syncControls();
          self._sizeStage();
          if (self.draft && self.draft.auto) self._runAuto(true);
        }
      });

      var zoom = root.querySelector('[data-studio="zoom"]');
      zoom.addEventListener('pointerdown', function () {
        if (self.draft && self.draft.auto) return;
        self.pushHistory();
      });
      zoom.addEventListener('input', function () {
        if (self.draft && self.draft.auto) return;
        self.draft.zoom = parseInt(zoom.value, 10);
        self.applyFraming(self.target, self.draft, true);
        self._syncControls();
        self._manualMem = self._cloneDraft(self.draft);
      });

      function pointerDown(ev) {
        if (!self.isOpen || (self.draft && self.draft.auto)) return;
        ev.preventDefault();
        self.pushHistory();
        self.dragging = true;
        if (self.root) self.root.classList.remove('editor-studio--anim');
        var pt = ev.touches ? ev.touches[0] : ev;
        self.dragStart = { x: pt.clientX, y: pt.clientY, ox: self.draft.x, oy: self.draft.y, sens: 1.35 };
        if (self.target) {
          self.draft._lw = self.target.clientWidth || self.target.offsetWidth || 0;
          self.draft._lh = self.target.clientHeight || self.target.offsetHeight || 0;
        }
        crop.classList.add('editor-dragging');
      }
      function pointerMove(ev) {
        if (!self.dragging || !self.isOpen || !self.draft || !self.target) return;
        var pt = ev.touches ? ev.touches[0] : ev;
        var next = FramingMath.pan(self.dragStart, pt.clientX, pt.clientY, crop.getBoundingClientRect());
        self.draft.x = next.x;
        self.draft.y = next.y;
        if (self._raf) cancelAnimationFrame(self._raf);
        self._raf = requestAnimationFrame(function () {
          if (!self.dragging || !self.draft || !self.target) return;
          self.applyFraming(self.target, self.draft, true);
          self._syncControls();
        });
      }
      function pointerUp() {
        if (!self.dragging) return;
        self.dragging = false;
        crop.classList.remove('editor-dragging');
        if (self.draft) {
          delete self.draft._lw;
          delete self.draft._lh;
          self._manualMem = self._cloneDraft(self.draft);
        }
      }

      Events.on(crop, 'mousedown', pointerDown);
      Events.on(crop, 'touchstart', pointerDown, { passive: false });
      Events.on(window, 'mousemove', pointerMove);
      Events.on(window, 'touchmove', pointerMove, { passive: false });
      Events.on(window, 'mouseup', pointerUp);
      Events.on(window, 'touchend', pointerUp);

      Events.on(document, 'keydown', function (e) {
        if (!self.isOpen) return;
        if (e.key === 'Escape') { e.preventDefault(); self.close(false); }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); self.undo(); }
        if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); self.redo(); }
      });
    },

    _sizeStage: function () {
      if (!this.root || !this.target) return;
      var r = this.target.getBoundingClientRect();
      var aspect = (r.width > 0 && r.height > 0) ? (r.width / r.height) : (4 / 3);

      function sizeCrop(crop, maxW, maxH) {
        if (!crop) return;
        var w = Math.min(maxW, window.innerWidth * 0.42);
        var h = w / aspect;
        if (h > maxH) { h = maxH; w = h * aspect; }
        crop.style.width = Math.round(w) + 'px';
        crop.style.height = Math.round(h) + 'px';
      }

      var main = this.root.querySelector('.editor-studio-crop--main');
      var mainMax = this.device === 'mobile' ? 220 : (this.device === 'tablet' ? 340 : 480);
      sizeCrop(main, mainMax, Math.min(window.innerHeight * 0.42, 380));

      sizeCrop(this.root.querySelector('[data-sat="tablet"]'), 160, 140);
      sizeCrop(this.root.querySelector('[data-sat="mobile"]'), 100, 140);

      // Promote selected device card visually; if tablet/mobile selected, swap main sizing already applied
      if (this.device === 'tablet') sizeCrop(main, 340, 300);
      if (this.device === 'mobile') sizeCrop(main, 220, 320);
    },

    open: function (img) {
      if (!img || tagOf(img) !== 'img') return;
      UI.hideImageOverlay();
      Inspector.close();
      UI.hideToolbar();
      if (ImageCanvas.chrome) ImageCanvas.chrome.classList.remove('editor-show');
      if (ImageCanvas.mini) ImageCanvas.mini.classList.remove('editor-show');
      if (ImageCanvas.zoomPop) ImageCanvas.zoomPop.classList.remove('editor-show');

      this._ensureShell();
      this.target = img;
      this.snapshot = this.captureSnapshot(img);
      this.draft = this.readFrom(img);
      this._autoMem = this.draft.auto ? this._cloneDraft(this.draft) : null;
      this._manualMem = this.draft.auto ? null : this._cloneDraft(this.draft);
      this._stack = new HistoryStack(40);
      this.device = 'desktop';
      this.safeArea = true;
      this.isOpen = true;

      ImageAutoFit.watch(img);
      var src = img.currentSrc || img.src;
      for (var i = 0; i < this.stageImgs.length; i++) this.stageImgs[i].src = src;

      if (this.draft.auto) {
        this._runAuto(true);
      } else {
        this._suppressDirty = true;
        this.applyFraming(img, this.draft, true);
        this._suppressDirty = false;
      }
      this._sizeStage();
      this._syncControls();
      this._syncHistoryBtns();

      this.root.classList.add('editor-show');
      document.body.classList.add('editor-studio-open');
      selectElement(img);
      Toast.show(this.draft.auto ? 'Ajuste Automático ativo' : 'Mais opções — painel completo', 2200);
    },

    close: function (commit) {
      if (!this.isOpen) return;
      this._gen++;
      this.dragging = false;
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
      if (commit) {
        this.applyFraming(this.target, this.draft, false);
        markDirty();
        if (this.draft.auto) {
          this._autoMem = this._cloneDraft(this.draft);
          ImageAutoFit.watch(this.target);
        } else {
          this._manualMem = this._cloneDraft(this.draft);
        }
        Toast.show('Enquadramento salvo — publique quando quiser');
      } else {
        this._suppressDirty = true;
        this.restoreSnapshot(this.target, this.snapshot);
        this._suppressDirty = false;
        Toast.show('Alterações do enquadramento descartadas');
      }
      this.isOpen = false;
      this.root.classList.remove('editor-show');
      document.body.classList.remove('editor-studio-open');
      var kept = this.target;
      this.target = null;
      this.snapshot = null;
      this.draft = null;
      if (kept && ImageCanvas.target === kept) {
        ImageCanvas.refreshFromImg();
        if (ImageCanvas.chrome) ImageCanvas.chrome.classList.add('editor-show');
        if (ImageCanvas.mini) ImageCanvas.mini.classList.add('editor-show');
        ImageCanvas.reposition();
        selectElement(kept);
      }
    }
  };

  // ============================================================
  // 8c. IMAGE CANVAS — on-page WYSIWYG (Framer / Figma style)
  // ============================================================
  var ImageCanvas = {
    target: null,
    draft: null,
    beforeSnap: null,
    chrome: null,
    mini: null,
    zoomPop: null,
    posPop: null,
    dragging: false,
    zoomDragging: false,
    posDragging: false,
    dragStart: null,
    comparing: false,
    _raf: 0,
    _bound: false,
    SNAP: [0, 33.333, 50, 66.667, 100],
    SNAP_T: 3.2,

    enable: function () {
      if (this._bound) return;
      this._bound = true;
      var self = this;
      Events.on(document, 'keydown', function (e) {
        if (!self.target || ImageStudio.isOpen) return;
        if (e.key === 'Escape') { e.preventDefault(); self.deselect(); return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && self._lastAiUndo) {
          e.preventDefault();
          ImageStudio.restoreSnapshot(self.target, self._lastAiUndo);
          self.draft = ImageStudio.readFrom(self.target);
          self._lastAiUndo = null;
          markDirty();
          self._syncUI();
          Toast.show('Enquadramento desfeito', 1600);
        }
      });
      Events.on(document, 'click', function (e) {
        if (!self.target || ImageStudio.isOpen) return;
        if (isEditorNode(e.target)) return;
        if (e.target === self.target || (self.chrome && self.chrome.contains(e.target))) return;
        if (self.mini && self.mini.contains(e.target)) return;
        if (self.zoomPop && self.zoomPop.contains(e.target)) return;
        self.deselect();
      }, true);
    },

    select: function (img) {
      if (!img || tagOf(img) !== 'img' || isRestricted(img)) return;
      if (ImageStudio.isOpen) ImageStudio.close(true);
      UI.hideImageOverlay();
      UI.hideToolbar();
      Inspector.close();

      if (this.target && this.target !== img) this.deselect(true);
      this.target = img;
      this.draft = ImageStudio.readFrom(img);
      ImageStudio._clearParentOverflowHack(img);
      // Normalize paint model (clears legacy transform:scale that grew the avatar frame).
      ImageStudio._suppressDirty = true;
      ImageStudio.applyFraming(img, this.draft, false);
      ImageStudio._suppressDirty = false;
      this.beforeSnap = ImageStudio.captureSnapshot(img);
      this._ensureUI();
      img.classList.add('editor-img-selected');
      img.classList.add('editor-img-canvas-active');
      selectElement(img);
      this.reposition();
      this._syncUI();
      this.chrome.classList.add('editor-show');
      this.mini.classList.add('editor-show');
      Toast.show(this.draft.auto ? '✓ Auto — use Mover ou as alças de zoom' : 'Arraste a foto · Mover · alças = zoom', 2400);
    },

    deselect: function (silent) {
      if (!this.target) return;
      this.target.classList.remove('editor-img-selected', 'editor-img-canvas-active');
      if (this.chrome) this.chrome.classList.remove('editor-show', 'editor-dragging', 'editor-comparing', 'editor-zooming');
      if (this.mini) this.mini.classList.remove('editor-show');
      if (this.zoomPop) this.zoomPop.classList.remove('editor-show');
      if (this.posPop) this.posPop.classList.remove('editor-show');
      this._hideGuides();
      this.target = null;
      this.draft = null;
      this.beforeSnap = null;
      this.dragging = false;
      this.zoomDragging = false;
      this.posDragging = false;
      this.comparing = false;
      if (!silent) deselect();
    },

    refreshFromImg: function () {
      if (!this.target) return;
      this.draft = ImageStudio.readFrom(this.target);
      this._syncUI();
      this.reposition();
    },

    _ensureUI: function () {
      if (this.chrome) return;
      var self = this;

      var chrome = el('div', { class: 'editor-img-chrome editor-root', 'aria-hidden': 'true' });
      chrome.innerHTML =
        '<div class="editor-img-chrome-inner" data-pan-surface="1">' +
          '<div class="editor-img-chrome-border"></div>' +
          '<div class="editor-img-pan-hint" aria-hidden="true"><span>✥</span> Arraste para mover</div>' +
          '<span class="editor-img-handle editor-img-handle--tl" data-handle="tl" title="Zoom"></span>' +
          '<span class="editor-img-handle editor-img-handle--tr" data-handle="tr" title="Zoom"></span>' +
          '<span class="editor-img-handle editor-img-handle--bl" data-handle="bl" title="Zoom"></span>' +
          '<span class="editor-img-handle editor-img-handle--br" data-handle="br" title="Zoom"></span>' +
          '<span class="editor-img-handle editor-img-handle--tm" data-handle="tm" title="Zoom"></span>' +
          '<span class="editor-img-handle editor-img-handle--bm" data-handle="bm" title="Zoom"></span>' +
          '<span class="editor-img-handle editor-img-handle--ml" data-handle="ml" title="Zoom"></span>' +
          '<span class="editor-img-handle editor-img-handle--mr" data-handle="mr" title="Zoom"></span>' +
          '<div class="editor-img-thirds" aria-hidden="true">' +
            '<i></i><i></i><i></i><i></i>' +
          '</div>' +
          '<div class="editor-img-guides" aria-hidden="true">' +
            '<span class="editor-img-guide editor-img-guide--v" data-g="v"></span>' +
            '<span class="editor-img-guide editor-img-guide--h" data-g="h"></span>' +
          '</div>' +
          '<div class="editor-img-badge-auto">✓ Auto</div>' +
          '<button type="button" class="editor-img-compare" data-cv="compare" title="Segure para ver Antes">Antes / Depois</button>' +
        '</div>';
      document.body.appendChild(chrome);
      this.chrome = chrome;

      var mini = el('div', { class: 'editor-img-minibar editor-root', role: 'toolbar', 'aria-label': 'Ferramentas da imagem' });
      mini.innerHTML =
        '<button type="button" class="editor-mb-btn" data-cv="replace" title="Alterar imagem"><span>📷</span><em>Alterar</em></button>' +
        '<button type="button" class="editor-mb-btn" data-cv="move" title="Mover posição"><span>✥</span><em>Mover</em></button>' +
        '<button type="button" class="editor-mb-btn" data-cv="recenter" title="Recentralizar"><span>🎯</span><em>Centralizar</em></button>' +
        '<button type="button" class="editor-mb-btn" data-cv="auto" title="Ajuste Automático"><span>✓</span><em>Auto</em></button>' +
        '<button type="button" class="editor-mb-btn" data-cv="ai" title="Melhor enquadramento"><span>✨</span><em>IA</em></button>' +
        '<button type="button" class="editor-mb-btn" data-cv="zoom" title="Zoom"><span>🔍</span><em>Zoom</em></button>' +
        '<button type="button" class="editor-mb-btn" data-cv="reset" title="Restaurar"><span>↺</span><em>Restaurar</em></button>' +
        '<button type="button" class="editor-mb-btn editor-mb-btn--more" data-cv="more" title="Mais opções"><span>⚙</span><em>Mais</em></button>';
      document.body.appendChild(mini);
      this.mini = mini;

      var zoomPop = el('div', { class: 'editor-img-zoom-pop editor-root' });
      zoomPop.innerHTML =
        '<button type="button" data-z="75">75%</button>' +
        '<button type="button" data-z="100">100%</button>' +
        '<button type="button" data-z="125">125%</button>' +
        '<button type="button" data-z="150">150%</button>' +
        '<button type="button" data-z="200">200%</button>' +
        '<input type="range" min="50" max="200" step="1" value="100" data-cv="zoom-range" />';
      document.body.appendChild(zoomPop);
      this.zoomPop = zoomPop;

      var posPop = el('div', { class: 'editor-img-pos-pop editor-root' });
      posPop.innerHTML =
        '<div class="editor-img-pos-title">Posição da imagem</div>' +
        '<div class="editor-img-pos-pad" data-pos-pad title="Arraste o ponto para mover">' +
          '<span class="editor-img-pos-cross editor-img-pos-cross--v"></span>' +
          '<span class="editor-img-pos-cross editor-img-pos-cross--h"></span>' +
          '<button type="button" class="editor-img-pos-knob" data-pos-knob aria-label="Arrastar posição"></button>' +
        '</div>' +
        '<div class="editor-img-pos-nudge" role="group" aria-label="Ajustes finos">' +
          '<button type="button" data-nudge="0,-8" title="Cima">↑</button>' +
          '<button type="button" data-nudge="-8,0" title="Esquerda">←</button>' +
          '<button type="button" data-nudge="0,0" title="Centro" class="editor-img-pos-center">◎</button>' +
          '<button type="button" data-nudge="8,0" title="Direita">→</button>' +
          '<button type="button" data-nudge="0,8" title="Baixo">↓</button>' +
        '</div>' +
        '<p class="editor-img-pos-hint">Arraste o ponto ou use as setas</p>';
      document.body.appendChild(posPop);
      this.posPop = posPop;

      // Surface drag = pan. Handle drag = zoom (container stays fixed).
      function ptrDown(ev) {
        if (!self.target || !self.draft) return;
        if (ev.target.closest && ev.target.closest('[data-cv]')) return;
        if (self.draft.auto) {
          self.draft.auto = false;
          ImageAutoFit.setAuto(self.target, false);
          self._syncUI();
        }
        ev.preventDefault();
        var pt = ev.touches ? ev.touches[0] : ev;
        var handle = ev.target.closest && ev.target.closest('[data-handle]');
        self.beforeSnap = self.beforeSnap || ImageStudio.captureSnapshot(self.target);

        if (handle) {
          self.zoomDragging = true;
          self.dragging = false;
          var rect = FramingMath.layoutRect(self.target) || self.target.getBoundingClientRect();
          self.dragStart = {
            x: pt.clientX,
            y: pt.clientY,
            oz: self.draft.zoom,
            kind: handle.getAttribute('data-handle'),
            cx: rect.left + rect.width / 2,
            cy: rect.top + rect.height / 2,
            rw: Math.max(rect.width, 1),
            rh: Math.max(rect.height, 1)
          };
          self.draft._lw = self.dragStart.rw;
          self.draft._lh = self.dragStart.rh;
          chrome.classList.add('editor-dragging', 'editor-zooming');
          return;
        }

        self.zoomDragging = false;
        self.dragging = true;
        var panBox = FramingMath.layoutRect(self.target) || self.target.getBoundingClientRect();
        self.dragStart = {
          x: pt.clientX,
          y: pt.clientY,
          ox: self.draft.x,
          oy: self.draft.y,
          rw: Math.max(panBox.width, 1),
          rh: Math.max(panBox.height, 1),
          sens: 1.35
        };
        self.draft._lw = self.dragStart.rw;
        self.draft._lh = self.dragStart.rh;
        chrome.classList.add('editor-dragging');
      }

      function ptrMove(ev) {
        if (!self.target || !self.draft) return;
        var pt = ev.touches ? ev.touches[0] : ev;

        if (self.zoomDragging && self.dragStart) {
          var ds = self.dragStart;
          var delta = 0;
          var kind = ds.kind;
          if (kind === 'ml') delta = ds.x - pt.clientX;
          else if (kind === 'mr') delta = pt.clientX - ds.x;
          else if (kind === 'tm') delta = ds.y - pt.clientY;
          else if (kind === 'bm') delta = pt.clientY - ds.y;
          else {
            var d0 = Math.hypot(ds.x - ds.cx, ds.y - ds.cy);
            var d1 = Math.hypot(pt.clientX - ds.cx, pt.clientY - ds.cy);
            delta = d1 - d0;
          }
          var basis = Math.max(ds.rw, ds.rh, 1);
          var nextZoom = clamp(Math.round(ds.oz + (delta / basis) * 140), 50, 200);
          if (nextZoom === self.draft.zoom) return;
          self.draft.zoom = nextZoom;
          if (self._raf) cancelAnimationFrame(self._raf);
          self._raf = requestAnimationFrame(function () {
            ImageStudio.applyFraming(self.target, self.draft, false);
            self._syncUI();
            // Layout box is fixed with OVB — no chrome resize needed while zooming.
          });
          return;
        }

        if (!self.dragging || !self.dragStart) return;
        var next = FramingMath.pan(self.dragStart, pt.clientX, pt.clientY, {
          width: self.dragStart.rw,
          height: self.dragStart.rh
        });
        // Keep raw values while dragging — snap only on pointerup (avoids sticky pan).
        self.draft.x = next.x;
        self.draft.y = next.y;
        var gx = self._snap(next.x);
        var gy = self._snap(next.y);
        self._showGuides(gx.line, gy.line);
        if (self._raf) cancelAnimationFrame(self._raf);
        self._raf = requestAnimationFrame(function () {
          ImageStudio.applyFraming(self.target, self.draft, false);
          if (self.posPop && self.posPop.classList.contains('editor-show')) self._syncUI();
        });
      }

      function ptrUp() {
        if (self.zoomDragging) {
          self.zoomDragging = false;
          chrome.classList.remove('editor-dragging', 'editor-zooming');
          if (self.draft) {
            delete self.draft._lw;
            delete self.draft._lh;
          }
          markDirty();
          Toast.show('Zoom ' + self.draft.zoom + '%', 1200);
          return;
        }
        if (!self.dragging) return;
        self.dragging = false;
        chrome.classList.remove('editor-dragging');
        if (self.draft) {
          var sx = self._snap(self.draft.x);
          var sy = self._snap(self.draft.y);
          if (sx.v !== self.draft.x || sy.v !== self.draft.y) {
            self.draft.x = sx.v;
            self.draft.y = sy.v;
            ImageStudio.applyFraming(self.target, self.draft, false);
          }
          delete self.draft._lw;
          delete self.draft._lh;
          if (self.posPop && self.posPop.classList.contains('editor-show')) self._syncUI();
        }
        self._hideGuides();
        markDirty();
        Toast.show('Enquadramento atualizado', 1400);
      }
      chrome.addEventListener('mousedown', ptrDown);
      chrome.addEventListener('touchstart', ptrDown, { passive: false });
      Events.on(window, 'mousemove', ptrMove);
      Events.on(window, 'touchmove', ptrMove, { passive: false });
      Events.on(window, 'mouseup', ptrUp);
      Events.on(window, 'touchend', ptrUp);

      // Mini toolbar
      mini.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cv]');
        if (!b || !self.target) return;
        e.preventDefault(); e.stopPropagation();
        var act = b.getAttribute('data-cv');
        if (act === 'replace') {
          ImageEditor.pick(self.target, function () {
            self.draft = ImageStudio.readFrom(self.target);
            self.beforeSnap = ImageStudio.captureSnapshot(self.target);
            self._syncUI();
            self.reposition();
          });
        } else if (act === 'recenter') {
          ImageAutoFit.recenter(self.target, self.draft).then(function (next) {
            if (!next || !self.draft) return;
            self.draft.x = next.x; self.draft.y = next.y;
            ImageStudio.applyFraming(self.target, self.draft, false);
            markDirty();
            self._syncUI();
            Toast.show('Centralizado', 1400);
          });
        } else if (act === 'auto') {
          var on = !self.draft.auto;
          self.draft.auto = on;
          ImageAutoFit.setAuto(self.target, on);
          if (on) {
            ImageAutoFit.applySmart(self.target, true).then(function () {
              self.draft = ImageStudio.readFrom(self.target);
              self._syncUI();
              Toast.show('Ajuste Automático ativado', 1600);
            });
          } else {
            ImageStudio.applyFraming(self.target, self.draft, false);
            markDirty();
            self._syncUI();
            Toast.show('Modo manual', 1400);
          }
        } else if (act === 'ai') {
          self._bestFrame();
        } else if (act === 'move') {
          if (self.zoomPop) self.zoomPop.classList.remove('editor-show');
          self.posPop.classList.toggle('editor-show');
          self._syncUI();
          self.reposition();
        } else if (act === 'zoom') {
          if (self.posPop) self.posPop.classList.remove('editor-show');
          self.zoomPop.classList.toggle('editor-show');
          self.reposition();
        } else if (act === 'reset') {
          self.draft = { zoom: 100, x: 50, y: 50, fit: 'cover', lock: true, auto: false };
          ImageStudio.applyFraming(self.target, self.draft, false);
          markDirty();
          self._syncUI();
          Toast.show('Restaurado', 1400);
        } else if (act === 'more') {
          ImageStudio.open(self.target);
        }
      });

      zoomPop.addEventListener('click', function (e) {
        var b = e.target.closest('[data-z]');
        if (!b || !self.draft) return;
        self.draft.zoom = parseInt(b.getAttribute('data-z'), 10);
        self.draft.auto = false;
        ImageAutoFit.setAuto(self.target, false);
        ImageStudio.applyFraming(self.target, self.draft, false);
        markDirty();
        self._syncUI();
      });
      zoomPop.querySelector('[data-cv="zoom-range"]').addEventListener('input', function (e) {
        if (!self.draft) return;
        self.draft.zoom = parseInt(e.target.value, 10);
        self.draft.auto = false;
        ImageAutoFit.setAuto(self.target, false);
        ImageStudio.applyFraming(self.target, self.draft, false);
        self._syncUI();
      });
      zoomPop.querySelector('[data-cv="zoom-range"]').addEventListener('change', function () { markDirty(); });

      // Interactive position pad (knob + nudge arrows)
      function applyPosFromPad(clientX, clientY) {
        if (!self.draft || !self.target || !self.posPop) return;
        var pad = self.posPop.querySelector('[data-pos-pad]');
        if (!pad) return;
        var r = pad.getBoundingClientRect();
        var x = clamp(((clientX - r.left) / Math.max(r.width, 1)) * 100, 0, 100);
        var y = clamp(((clientY - r.top) / Math.max(r.height, 1)) * 100, 0, 100);
        if (self.draft.auto) {
          self.draft.auto = false;
          ImageAutoFit.setAuto(self.target, false);
        }
        self.draft.x = Math.round(x * 10) / 10;
        self.draft.y = Math.round(y * 10) / 10;
        ImageStudio.applyFraming(self.target, self.draft, false);
        self._syncUI();
      }

      var posPad = posPop.querySelector('[data-pos-pad]');
      function posDown(ev) {
        if (!self.target || !self.draft) return;
        ev.preventDefault();
        ev.stopPropagation();
        self.posDragging = true;
        self.beforeSnap = self.beforeSnap || ImageStudio.captureSnapshot(self.target);
        var pt = ev.touches ? ev.touches[0] : ev;
        applyPosFromPad(pt.clientX, pt.clientY);
      }
      function posMove(ev) {
        if (!self.posDragging) return;
        var pt = ev.touches ? ev.touches[0] : ev;
        applyPosFromPad(pt.clientX, pt.clientY);
      }
      function posUp() {
        if (!self.posDragging) return;
        self.posDragging = false;
        markDirty();
      }
      posPad.addEventListener('mousedown', posDown);
      posPad.addEventListener('touchstart', posDown, { passive: false });
      Events.on(window, 'mousemove', posMove);
      Events.on(window, 'touchmove', posMove, { passive: false });
      Events.on(window, 'mouseup', posUp);
      Events.on(window, 'touchend', posUp);

      posPop.addEventListener('click', function (e) {
        var b = e.target.closest('[data-nudge]');
        if (!b || !self.draft || !self.target) return;
        e.preventDefault();
        e.stopPropagation();
        var parts = (b.getAttribute('data-nudge') || '0,0').split(',');
        var nx = parseFloat(parts[0]);
        var ny = parseFloat(parts[1]);
        if (self.draft.auto) {
          self.draft.auto = false;
          ImageAutoFit.setAuto(self.target, false);
        }
        if (nx === 0 && ny === 0) {
          self.draft.x = 50;
          self.draft.y = 50;
        } else {
          self.draft.x = clamp(self.draft.x + nx, 0, 100);
          self.draft.y = clamp(self.draft.y + ny, 0, 100);
        }
        ImageStudio.applyFraming(self.target, self.draft, false);
        markDirty();
        self._syncUI();
      });

      // Before / After hold
      var cmp = chrome.querySelector('[data-cv="compare"]');
      function cmpDown(ev) {
        ev.preventDefault(); ev.stopPropagation();
        if (!self.target || !self.beforeSnap) return;
        self.comparing = true;
        chrome.classList.add('editor-comparing');
        ImageStudio.restoreSnapshot(self.target, self.beforeSnap);
      }
      function cmpUp() {
        if (!self.comparing) return;
        self.comparing = false;
        chrome.classList.remove('editor-comparing');
        if (self.draft) ImageStudio.applyFraming(self.target, self.draft, false);
      }
      cmp.addEventListener('mousedown', cmpDown);
      cmp.addEventListener('touchstart', cmpDown, { passive: false });
      cmp.addEventListener('mouseup', cmpUp);
      cmp.addEventListener('mouseleave', cmpUp);
      cmp.addEventListener('touchend', cmpUp);
    },

    _bestFrame: function () {
      var self = this;
      if (!this.target) return;
      var img = this.target;
      this._lastAiUndo = ImageStudio.captureSnapshot(img);
      ImageAutoFit.applyBestFrame(img).then(function (draft) {
        if (!draft || self.target !== img) return;
        self.draft = draft;
        self._syncUI();
        Toast.show('✨ Melhor enquadramento aplicado — use Restaurar para desfazer', 2800);
      });
    },

    _snap: function (v) {
      var i, d, best = null, bestD = this.SNAP_T;
      for (i = 0; i < this.SNAP.length; i++) {
        d = Math.abs(v - this.SNAP[i]);
        if (d < bestD) { bestD = d; best = this.SNAP[i]; }
      }
      if (best == null) return { v: v, line: null };
      return { v: best, line: best };
    },

    _showGuides: function (vx, hy) {
      if (!this.chrome) return;
      var gv = this.chrome.querySelector('.editor-img-guide--v');
      var gh = this.chrome.querySelector('.editor-img-guide--h');
      if (gv) {
        if (vx != null) { gv.style.left = vx + '%'; gv.classList.add('editor-show'); }
        else gv.classList.remove('editor-show');
      }
      if (gh) {
        if (hy != null) { gh.style.top = hy + '%'; gh.classList.add('editor-show'); }
        else gh.classList.remove('editor-show');
      }
    },

    _hideGuides: function () {
      if (!this.chrome) return;
      $$('.editor-img-guide', this.chrome).forEach(function (g) { g.classList.remove('editor-show'); });
    },

    _syncUI: function () {
      if (!this.chrome || !this.draft) return;
      this.chrome.classList.toggle('editor-img-chrome--auto', !!this.draft.auto);
      var autoBtn = this.mini && this.mini.querySelector('[data-cv="auto"]');
      if (autoBtn) autoBtn.classList.toggle('editor-on', !!this.draft.auto);
      var moveBtn = this.mini && this.mini.querySelector('[data-cv="move"]');
      if (moveBtn) moveBtn.classList.toggle('editor-on', !!(this.posPop && this.posPop.classList.contains('editor-show')));
      var range = this.zoomPop && this.zoomPop.querySelector('[data-cv="zoom-range"]');
      if (range) range.value = String(this.draft.zoom);
      $$('[data-z]', this.zoomPop).forEach(function (b) {
        b.classList.toggle('editor-on', parseInt(b.getAttribute('data-z'), 10) === ImageCanvas.draft.zoom);
      });
      var knob = this.posPop && this.posPop.querySelector('[data-pos-knob]');
      if (knob) {
        knob.style.left = this.draft.x + '%';
        knob.style.top = this.draft.y + '%';
      }
    },

    reposition: function () {
      if (!this.target || !this.chrome) return;
      // Measure WITHOUT transform so zoom never enlarges the editor chrome / site frame.
      var r = FramingMath.layoutRect(this.target);
      if (!r || r.width < 4 || r.height < 4) return;
      var c = this.chrome;
      c.style.top = r.top + 'px';
      c.style.left = r.left + 'px';
      c.style.width = r.width + 'px';
      c.style.height = r.height + 'px';

      if (this.mini) {
        var mw = this.mini.offsetWidth || 320;
        var top = r.top - 52;
        if (top < 56) top = r.bottom + 10;
        var left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2));
        this.mini.style.top = top + 'px';
        this.mini.style.left = left + 'px';
      }
      if (this.zoomPop && this.zoomPop.classList.contains('editor-show') && this.mini) {
        var mr = this.mini.getBoundingClientRect();
        this.zoomPop.style.top = (mr.bottom + 8) + 'px';
        this.zoomPop.style.left = Math.max(8, mr.left + mr.width / 2 - 120) + 'px';
      }
      if (this.posPop && this.posPop.classList.contains('editor-show') && this.mini) {
        var pr = this.mini.getBoundingClientRect();
        this.posPop.style.top = (pr.bottom + 8) + 'px';
        this.posPop.style.left = Math.max(8, Math.min(window.innerWidth - 188, pr.left + pr.width / 2 - 90)) + 'px';
      }
    }
  };

  // ============================================================
  // 9. IMAGE EDITOR (overlay + clickable everywhere + asset track)
  // ============================================================
  var ImageEditor = {
    enable: function () {
      Events.on(document, 'mouseover', function (e) {
        if (state.isPreview || ImageStudio.isOpen) return;
        var t = e.target;
        if (tagOf(t) !== 'img' || isEditorNode(t) || isRestricted(t)) return;
        if (ImageCanvas.target === t) { UI.hideImageOverlay(); return; }
        if (state.hoverImage && state.hoverImage !== t) state.hoverImage.classList.remove('editor-img-hl');
        state.hoverImage = t;
        t.classList.add('editor-img-hl');
        UI.positionImageOverlay(t);
      }, true);

      // Click → seleção WYSIWYG na página (não abre o painel completo).
      Events.on(document, 'click', function (e) {
        if (state.isPreview || ImageStudio.isOpen) return;
        if (isEditorNode(e.target)) return;
        var t = e.target;
        if (tagOf(t) !== 'img' || isRestricted(t)) return;
        e.preventDefault(); e.stopPropagation();
        ImageCanvas.select(t);
      }, true);

      // Duplo clique → alterna Ajuste Automático.
      Events.on(document, 'dblclick', function (e) {
        if (state.isPreview) return;
        var t = e.target;
        if (tagOf(t) !== 'img' || isEditorNode(t) || isRestricted(t)) return;
        e.preventDefault(); e.stopPropagation();
        if (ImageStudio.isOpen && ImageStudio.target === t) {
          ImageStudio._toggleAuto();
          return;
        }
        if (ImageCanvas.target !== t) ImageCanvas.select(t);
        var btn = ImageCanvas.mini && ImageCanvas.mini.querySelector('[data-cv="auto"]');
        if (btn) btn.click();
      }, true);

      // [data-editable-image] empty drop-zones
      Events.on(document, 'mouseover', function (e) {
        if (state.isPreview) return;
        var zone = e.target.closest && e.target.closest('[data-editable-image]');
        if (!zone || isEditorNode(zone) || isRestricted(zone)) return;
        if (zone.querySelector('img')) return;
        zone.classList.add('editor-image-hover');
      }, true);
      Events.on(document, 'mouseout', function (e) {
        var zone = e.target.closest && e.target.closest('[data-editable-image]');
        if (zone && (!e.relatedTarget || !zone.contains(e.relatedTarget))) zone.classList.remove('editor-image-hover');
      }, true);
      Events.on(document, 'click', function (e) {
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
        var input = el('input', {
          type: 'file',
          accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif',
          class: 'editor-root',
          style: { display: 'none' }
        });
        document.body.appendChild(input);
        input.addEventListener('change', function () { var f = input.files && input.files[0]; input.remove(); res(f || null); });
        input.click();
      });
    },

    // Single ingest path for <img> replacements / zone inserts.
    _applyFileToImg: function (img, file, opts) {
      opts = opts || {};
      var err = validateImageFile(file);
      if (err) { Toast.show(err, 3200); return Promise.resolve(null); }
      var path = Assets.set(img, 'src', file);
      return readAsDataURL(file).then(function (durl) {
        img.src = durl;
        img.setAttribute('data-export-src', path);
        img.style.display = '';
        img.removeAttribute('aria-hidden');
        markDirty();
        return new Promise(function (resolve) {
          ImageAutoFit.prepareNew(img, function () {
            if (opts.toast) Toast.show(opts.toast);
            if (typeof opts.onDone === 'function') opts.onDone(img);
            resolve(img);
          });
        });
      });
    },

    pick: function (img, onDone) {
      this._filePrompt().then(function (file) {
        if (!file) return;
        ImageEditor._applyFileToImg(img, file, {
          toast: 'Imagem atualizada — enquadrada automaticamente',
          onDone: function (node) {
            UI.positionImageOverlay(node);
            if (typeof onDone === 'function') onDone(node);
          }
        });
      });
    },

    pickForZone: function (zone) {
      var existing = zone.querySelector('img');
      if (existing) return this.pick(existing, function (img) { ImageCanvas.select(img); });
      this._filePrompt().then(function (file) {
        if (!file) return;
        var img = el('img', { alt: '', style: { maxWidth: '100%', display: 'block', width: '100%', height: '100%', objectFit: 'cover' } });
        zone.appendChild(img);
        ImageEditor._applyFileToImg(img, file, {
          toast: 'Imagem adicionada — enquadrada automaticamente',
          onDone: function (node) {
            zone.classList.remove('editor-image-hover');
            ImageCanvas.select(node);
          }
        }).then(function (ok) {
          if (!ok && img.parentNode) img.remove();
        });
      });
    },

    setBackground: function (node) {
      this._filePrompt().then(function (file) {
        if (!file) return;
        var err = validateImageFile(file);
        if (err) { Toast.show(err, 3200); return; }
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
        Events.on(track, 'mousedown', function (e) {
          if (state.isPreview) return;
          dragging = true; track.classList.add('editor-skill-armed'); apply(pctFromEvent(e)); e.preventDefault();
        });
        Events.on(document, 'mousemove', function (e) { if (dragging) apply(pctFromEvent(e)); });
        Events.on(document, 'mouseup', function () {
          if (!dragging) return; dragging = false; track.classList.remove('editor-skill-armed'); setTimeout(hideBadge, 700);
        });
        Events.on(track, 'click', function (e) { if (state.isPreview) return; apply(pctFromEvent(e)); setTimeout(hideBadge, 700); });
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
        hrefIn.addEventListener('change', function () {
          var safe = sanitizeHref(hrefIn.value);
          if (hrefIn.value && !safe) {
            Toast.show('Link inválido — use http(s), mailto, tel ou caminho relativo');
            hrefIn.value = target.getAttribute('href') || '';
            return;
          }
          if (safe) target.setAttribute('href', safe);
          else target.removeAttribute('href');
          markDirty();
        });
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
        var openStudio = el('button', { class: 'editor-btn editor-btn--primary', style: { width: '100%' }, text: 'Editar na página' });
        openStudio.addEventListener('click', function () { ImageCanvas.select(target); Inspector.close(); });
        var moreOpts = el('button', { class: 'editor-btn', style: { width: '100%', marginTop: '8px' }, text: 'Mais opções' });
        moreOpts.addEventListener('click', function () { ImageStudio.open(target); });
        var replace = el('button', { class: 'editor-btn', style: { width: '100%', marginTop: '8px' }, text: 'Trocar arquivo' });
        replace.addEventListener('click', function () { ImageEditor.pick(target); });
        body.appendChild(section('Imagem', el('div', {}, [
          field('Texto alternativo (alt)', altIn),
          openStudio,
          moreOpts,
          replace
        ]), focusSection && focusSection !== 'image'));
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

    // Strip editor-only attrs; keep framing data-* so published pages retain crop.
    $$('*', clone).forEach(function (n) {
      if (n.classList && n.classList.length) {
        [].slice.call(n.classList).forEach(function (c) { if (c.indexOf('editor-') === 0) n.classList.remove(c); });
      }
      n.removeAttribute('contenteditable');
      n.removeAttribute('data-export-src');
      n.removeAttribute('data-export-bg');
      n.removeAttribute('data-img-fx');
      n.removeAttribute('data-img-fy');
      n.removeAttribute('data-img-focal');
      n.removeAttribute('data-img-focal-src');
      if (n.hasAttribute && n.hasAttribute('data-editor-ov')) {
        var prevOv = n.getAttribute('data-editor-ov');
        n.removeAttribute('data-editor-ov');
        if (prevOv) n.style.overflow = prevOv;
        else if (n.style) n.style.removeProperty('overflow');
      }
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
    // Em modo edição, o clique em <a> não navega (evita saída acidental).
    Events.on(document, 'click', function (e) {
      if (state.isPreview) return;
      if (!document.body.classList.contains('editor-active')) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && !isEditorNode(a)) { e.preventDefault(); }
    }, true);

    // Avisa se houver alterações não salvas ao tentar sair.
    Events.on(window, 'beforeunload', function (e) {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
      return e.returnValue;
    });
  }

  var VisualEditor = {
    version: '2.9.0-arch',

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
      ImageAutoFit.enable();
      ImageCanvas.enable();
      bindSelectionEvents();
      Layout.enable();
      guardNavigation();

      if (document.querySelector(SKILL_SELECTOR)) SkillBarEditor.setup();

      var images = $$('img').filter(function (n) { return !isEditorNode(n) && !isRestricted(n); });
      log('editable images:', images.length);
    },

    save: function () {
      if (!confirm('Tem certeza que deseja salvar e publicar as alterações no site oficial?')) return;
      if (ImageStudio.isOpen) ImageStudio.close(true);
      Toast.show('Preparando pacote para publicação…', 4000);
      buildZipBlob().then(function (blob) {
        return pushToDrive(blob).then(function (res) {
          return { blob: blob, res: res || {} };
        });
      }).then(function (pack) {
        var res = pack.res;
        if (res && res.ok === false) {
          try { triggerDownload(pack.blob, 'web_site_official.zip'); } catch (e) {}
          Toast.show('Backup remoto falhou — baixei o ZIP localmente', 4400);
          return;
        }
        clearDirty();
        if (res && res.skipped) {
          try { triggerDownload(pack.blob, 'web_site_official.zip'); } catch (e) {}
          Toast.show('Pacote exportado: web_site_official.zip', 3400);
        } else {
          Toast.show('Publicado: backup no Drive + deploy acionado', 4400);
        }
      }).catch(function (e) {
        log('save failed', e);
        try {
          downloadStandaloneHTML();
          clearDirty();
          Toast.show('Sem conexão p/ JSZip — exportei HTML único', 3600);
        } catch (err) {
          Toast.show('Erro ao exportar — alterações NÃO foram salvas', 4200);
          log(err);
        }
      });
    },

    cancel: function () {
      if ((state.dirty || ImageStudio.isOpen) && !confirm('Descartar as alterações não salvas?')) return;
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
        if (ImageStudio.isOpen) ImageStudio.close(false);
        if (ImageCanvas.target) ImageCanvas.deselect(true);
      }
      if (btn) btn.classList.toggle('editor-on', state.isPreview);
      Toast.show(state.isPreview ? 'Pré-visualização ativa' : 'Edição ativa');
    },

    openSelectedLink: function () {
      var sel = state.selected;
      var a = sel && (tagOf(sel) === 'a' ? sel : (sel.closest && sel.closest('a[href]')));
      if (!a || !a.getAttribute('href')) { Toast.show('Selecione um link primeiro'); return; }
      var href = sanitizeHref(a.getAttribute('href'));
      if (!href) { Toast.show('Link inválido'); return; }
      location.href = href;
    },

    getCleanHTML: getCleanHTML,
    exportZip: exportZip,
    download: downloadStandaloneHTML,

    destroy: function () {
      if (ImageStudio.isOpen) ImageStudio.close(false);
      if (ImageCanvas.target) ImageCanvas.deselect(true);
      Events.offAll();
      Layout.reset();
      $$('.editor-root').forEach(function (n) { n.remove(); });
      document.documentElement.classList.remove('editor-active');
      document.body.classList.remove('editor-active', 'editor-preview', 'editor-studio-open');
      UI.bar = UI.panel = UI.toolbar = UI.panelBody = UI.panelTag = UI.imgOverlay = null;
      ImageStudio.root = ImageStudio.stageImg = ImageStudio.stageImgs = null;
      ImageStudio.isOpen = false;
      ImageStudio._stack = null;
      ImageCanvas.chrome = ImageCanvas.mini = ImageCanvas.zoomPop = ImageCanvas.posPop = null;
      ImageCanvas.target = null;
      ImageCanvas._bound = false;
      ImageAutoFit._enabled = false;
      Toast.node = null;
      state.dirty = false;
      state.selected = null;
      state.hoverEl = null;
      state.hoverImage = null;
      state.activeText = null;
      state.isPreview = false;
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
