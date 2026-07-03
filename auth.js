/* ============================================================================
   auth.js — "Link Secreto" para o editor visual
   ----------------------------------------------------------------------------
   Coloque este arquivo na MESMA pasta das páginas .html (a raiz do site).
   Em cada página, troque as DUAS linhas do editor por apenas:

       <script src="auth.js"></script>

   COMO ATIVAR O EDITOR
     1) Acesse qualquer página com a senha na URL:
            index.html?admin=kelly2026
     2) A aba fica autorizada (sessionStorage). Navegue à vontade entre as
        páginas — o editor continua ativo nesta aba até você fechá-la.
     3) Para sair do modo de edição:  qualquer-pagina.html?admin=sair

   CLIENTE COMUM (sem a senha): nada é injetado. O site fica 100% limpo.

   ⚠️ IMPORTANTE (segurança honesta): isto ESCONDE o editor dos visitantes,
   deixando o site limpo — mas NÃO é um controle de acesso forte. O arquivo
   auth.js é público, então a senha aqui é "de obscuridade". A proteção real
   contra publicações indevidas é o SHARED_TOKEN no backend (Code.gs): sem ele,
   nenhum "Salvar & Publicar" é aceito. Trate esta senha como um atalho de
   conveniência, não como um cofre.
   ============================================================================ */
(function () {
  'use strict';

  // ---- CONFIG ---------------------------------------------------------------
  var SECRET   = 'kelly2026';          // <<< troque aqui para mudar a senha
  var PARAM    = 'admin';              // parâmetro na URL: ?admin=kelly2026
  var SS_KEY   = 'kr_editor_session';  // marca da sessão autorizada (por aba)
  var CSS_HREF = 'editor/editor.css';  // caminhos relativos às páginas .html
  var JS_SRC   = 'editor/editor.js';
  // ---------------------------------------------------------------------------

  var search = window.location.search || '';
  var reParam = new RegExp('[?&]' + PARAM + '=([^&#]*)');

  // 0) Comando de saída: ?admin=sair  → encerra a sessão e mantém o site limpo.
  var match = reParam.exec(search);
  if (match && decodeURIComponent(match[1]) === 'sair') {
    try { sessionStorage.removeItem(SS_KEY); } catch (e) {}
    cleanUrl();
    return;
  }

  // 1) Já autorizado nesta aba?
  var authorized = false;
  try { authorized = sessionStorage.getItem(SS_KEY) === '1'; } catch (e) {}

  // 2) Chegou com a senha correta na URL?
  if (!authorized && match && decodeURIComponent(match[1]) === SECRET) {
    authorized = true;
    try { sessionStorage.setItem(SS_KEY, '1'); } catch (e) {}
    cleanUrl(); // remove a senha da barra de endereço (não fica compartilhável)
  }

  // 3) Cliente comum → não injeta nada. Site permanece limpo e seguro.
  if (!authorized) return;

  // 4) Injeta o editor uma única vez (CSS no <head>, JS no <body>).
  function inject() {
    if (document.getElementById('kr-editor-css') || document.getElementById('kr-editor-js')) return;

    var link = document.createElement('link');
    link.id  = 'kr-editor-css';
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    (document.head || document.documentElement).appendChild(link);

    var script = document.createElement('script');
    script.id  = 'kr-editor-js';
    script.src = JS_SRC;
    script.defer = true;
    (document.body || document.documentElement).appendChild(script);
  }

  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);

  // ---- utilitário: limpa o parâmetro da URL sem recarregar -------------------
  function cleanUrl() {
    try {
      var clean = (window.location.search || '')
        .replace(reParam, '')       // tira ?admin=... ou &admin=...
        .replace(/^&/, '?')          // conserta separador inicial
        .replace(/[?&]$/, '');       // remove ? ou & pendurado no fim
      history.replaceState(null, '', window.location.pathname + clean + window.location.hash);
    } catch (e) {}
  }
})();
