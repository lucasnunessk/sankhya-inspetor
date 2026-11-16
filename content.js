// Mundo isolado: recebe o clique do menu, pede a resolução ao page.js e mostra o painel.
(function () {
  'use strict';
  // Só liga em página do Sankhya (o manifest vale para todos os sites; telas de addon têm caminho próprio).
  function ehSankhya() {
    try {
      var p = location.pathname || '';
      if (/^\/mge[a-z]*\//i.test(p) || /\.xhtml5$/i.test(p)) return true;
      if (/[?&](resourceID|mgeSession)=/i.test(location.search || '')) return true;
      if (window.top !== window) { try { if (/^\/mge[a-z]*\//i.test(window.top.location.pathname)) return true; } catch (_) {} }
    } catch (_) {}
    return false;
  }
  if (window.__snkInspetorContent || !ehSankhya()) return;
  window.__snkInspetorContent = true;
  // Avisa o background deste domínio do Sankhya, para o menu do clique direito aparecer nele.
  try { chrome.runtime.sendMessage({ tipo: 'snk-origem', protocolo: location.protocol, host: location.hostname }); } catch (_) {}

  var pos = { x: 40, y: 40 };
  var host = null;

  var PADRAO = { ativo: true, raiox: false, objetos: false };
  function enviarConfig() {
    chrome.storage.local.get(PADRAO, function (v) {
      var c = { ativo: v.ativo !== false, raiox: v.raiox === true, objetos: v.objetos === true };
      document.dispatchEvent(new CustomEvent('snk-inspetor:config', { detail: JSON.stringify(c) }));
      if (!c.ativo) fechar();
    });
  }
  enviarConfig();
  // page.js (world MAIN) pode carregar depois deste script: reenviar quando o DOM estiver pronto.
  document.addEventListener('DOMContentLoaded', enviarConfig, { once: true });
  chrome.storage.onChanged.addListener(function (ch) {
    if (ch.ativo || ch.raiox || ch.objetos) enviarConfig();
  });

  window.addEventListener('contextmenu', function (e) { pos = { x: e.clientX, y: e.clientY }; }, true);

  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg || msg.tipo !== 'snk-inspecionar') return;
    var feito = false;
    function ouvir(e) {
      if (feito) return; feito = true;
      document.removeEventListener('snk-inspetor:resultado', ouvir);
      var r; try { r = JSON.parse(e.detail); } catch (_) { r = { ok: false, avisos: ['Resposta inválida.'] }; }
      mostrar(r);
    }
    document.addEventListener('snk-inspetor:resultado', ouvir);
    mostrarCarregando();
    document.dispatchEvent(new CustomEvent('snk-inspetor:resolver'));
    setTimeout(function () {
      if (!feito) { feito = true; document.removeEventListener('snk-inspetor:resultado', ouvir); mostrar({ ok: false, avisos: ['Sem resposta da página (tempo esgotado).'] }); }
    }, 15000);
  });

  // ---------- painel ----------
  var TIPOS = { I: 'Inteiro', F: 'Decimal', S: 'Texto', D: 'Data', H: 'Data e hora', T: 'Hora', C: 'Texto longo (CLOB)', B: 'Binário (BLOB)' };

  var CSS = [
    ':host{all:initial}',
    '.p{position:fixed;z-index:2147483647;min-width:300px;max-width:440px;background:#fff;color:#1f2933;',
    'font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;border:1px solid #d0d7de;border-radius:8px;',
    'box-shadow:0 8px 24px rgba(0,0,0,.18);overflow:hidden}',
    '.h{display:flex;align-items:center;justify-content:space-between;background:#2e7d32;color:#fff;padding:7px 10px;font-weight:600}',
    '.x{all:unset;cursor:pointer;font-size:16px;line-height:1;padding:0 4px;color:#fff}',
    '.b{padding:10px 12px}',
    '.big{font:600 15px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0b3d0e;word-break:break-all;margin-bottom:6px}',
    'table{border-collapse:collapse;width:100%}',
    'td{padding:2px 0;vertical-align:top}',
    'td.k{color:#57606a;white-space:nowrap;padding-right:10px}',
    'td.v{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}',
    '.av{margin-top:8px;padding:6px 8px;background:#fff8e1;border:1px solid #ffe08a;border-radius:6px;color:#6b4e00;font-size:12px}',
    '.f{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-top:1px solid #eaeef2;background:#f6f8fa}',
    '.bt{all:unset;cursor:pointer;padding:4px 9px;border:1px solid #c9d1d9;border-radius:6px;background:#fff;font-size:12px;color:#1f2933}',
    '.bt:hover{border-color:#2e7d32;color:#2e7d32}',
    '.ok{color:#2e7d32;font-size:12px;align-self:center}',
    '.opt{margin-top:10px}',
    '.opt-t{font-weight:600;color:#1f2933;margin-bottom:4px}',
    '.opt-t small{font-weight:400;color:#57606a}',
    '.opt-l{max-height:200px;overflow:auto;border:1px solid #eaeef2;border-radius:6px}',
    '.opt-l table td{padding:3px 8px;border-bottom:1px solid #f0f2f4}',
    '.opt-l tr:last-child td{border-bottom:0}',
    '.opt-l td.cv{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:nowrap;color:#0b3d0e;font-weight:600}',
    '.opt-l td.cv.off{color:#8c959f;text-decoration:line-through}',
    '.opt-l td.sec{background:#f6f8fa;font-weight:600;color:#57606a;font-size:12px}',
    '.tag{display:inline-block;margin-left:6px;padding:0 5px;border-radius:3px;background:#ffebe9;color:#a40e26;font-size:11px}'  ].join('');

  function fechar() {
    if (host) { host.remove(); host = null; }
    document.removeEventListener('keydown', esc, true);
    document.removeEventListener('mousedown', fora, true);
  }
  function esc(e) { if (e.key === 'Escape') fechar(); }
  function fora(e) { if (host && e.composedPath().indexOf(host) < 0) fechar(); }

  function abrir() {
    fechar();
    host = document.createElement('snk-inspetor-painel');
    var root = host.attachShadow({ mode: 'open' });
    var st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    var p = document.createElement('div'); p.className = 'p'; root.appendChild(p);
    (document.body || document.documentElement).appendChild(host);
    document.addEventListener('keydown', esc, true);
    setTimeout(function () { document.addEventListener('mousedown', fora, true); }, 0);
    return p;
  }

  function posicionar(p) {
    var w = p.offsetWidth, h = p.offsetHeight;
    var x = Math.min(pos.x + 8, window.innerWidth - w - 8), y = Math.min(pos.y + 8, window.innerHeight - h - 8);
    p.style.left = Math.max(8, x) + 'px'; p.style.top = Math.max(8, y) + 'px';
  }

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function cabecalho(p, titulo) {
    var h = el('div', 'h'); h.appendChild(el('span', null, titulo));
    var x = el('button', 'x', '×'); x.title = 'Fechar (Esc)'; x.onclick = fechar; h.appendChild(x);
    p.appendChild(h);
  }

  function mostrarCarregando() {
    var p = abrir(); cabecalho(p, 'Inspetor Sankhya');
    p.appendChild(el('div', 'b', 'Consultando...')); posicionar(p);
  }

  function copiar(texto, aviso) {
    function ok() { aviso.textContent = 'Copiado: ' + texto; }
    function viaTextarea() {
      var t = document.createElement('textarea'); t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (_) { aviso.textContent = 'Não foi possível copiar.'; }
      t.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(ok, viaTextarea);
    else viaTextarea();
  }

  function mostrar(r) {
    var p = abrir();
    cabecalho(p, r.campo ? 'Campo do Sankhya' : 'Tela do Sankhya');
    var b = el('div', 'b'); p.appendChild(b);

    var principal = r.tabela ? r.tabela + (r.coluna ? '.' + r.coluna : '') : (r.instancia || r.campo || 'Não identificado');
    b.appendChild(el('div', 'big', principal));

    var t = el('table'); b.appendChild(t);
    function linha(k, v) { if (v == null || v === '') return; var tr = el('tr'); tr.appendChild(el('td', 'k', k)); tr.appendChild(el('td', 'v', String(v))); t.appendChild(tr); }
    linha('Descrição', r.rotulo);
    linha('Tabela', r.tabela);
    linha('Coluna', r.coluna);
    if (r.campo && r.campo !== r.coluna) linha('Campo na tela', r.campo);
    linha('Tipo', r.tipo ? (TIPOS[r.tipo] ? r.tipo + ' - ' + TIPOS[r.tipo] : r.tipo) : null);
    linha('Referência', r.referencia);
    if (r.ligacao) linha('Ligação', r.ligacao + (r.descricaoLigacao ? ' (' + r.descricaoLigacao + ')' : ''));
    if (r.campoLigacao) linha('Pelo campo', (r.tabelaOrigem ? r.tabelaOrigem + '.' : '') + r.campoLigacao);
    linha('Instância', r.instancia ? r.instancia + (r.descricaoInstancia && r.descricaoInstancia !== r.instancia ? ' (' + r.descricaoInstancia + ')' : '') : null);
    if (r.adicional) linha('Campo adicional', 'Sim');
    linha('Tela (resourceID)', r.resourceID);
    linha('Fonte', r.fonte);

    if (r.opcoes && r.opcoes.length) {
      var box = el('div', 'opt');
      var tt = el('div', 'opt-t', 'Opções (' + r.opcoes.length + ') ');
      tt.appendChild(el('small', null, r.fonteOpcoes || ''));
      box.appendChild(tt);
      var wrap = el('div', 'opt-l'), to = el('table');
      r.opcoes.forEach(function (o) {
        var tr = el('tr');
        tr.appendChild(el('td', 'cv', o.valor));
        tr.appendChild(el('td', null, o.opcao));
        to.appendChild(tr);
      });
      wrap.appendChild(to); box.appendChild(wrap); b.appendChild(box);
    }

    if (r.objetos) {
      var ob = r.objetos, bx = el('div', 'opt');
      var t1 = el('div', 'opt-t', 'Objetos do banco - ' + ob.tabela + ' ');
      t1.appendChild(el('small', null, ob.banco));
      bx.appendChild(t1);
      var lw = el('div', 'opt-l'), tb = el('table');
      function cab(txt) { var tr = el('tr'); var td = el('td', 'sec', txt); td.colSpan = 2; tr.appendChild(td); tb.appendChild(tr); }
      function obj(nome, detalhe, inativo, invalido) {
        var tr = el('tr'); var a = el('td', 'cv' + (inativo || invalido ? ' off' : ''), nome);
        tr.appendChild(a);
        var d = el('td', null, detalhe);
        if (inativo) d.appendChild(el('span', 'tag', 'desativada'));
        if (invalido) d.appendChild(el('span', 'tag', 'inválido'));
        tr.appendChild(d); tb.appendChild(tr);
      }
      cab('Triggers (' + ob.triggers.length + ')');
      if (!ob.triggers.length) obj('-', 'nenhuma');
      ob.triggers.forEach(function (t) { obj(t.nome, (t.momento || '') + ' ' + (t.evento || ''), !t.ativo, !t.valido); });
      cab('Dependentes (' + ob.dependentes.length + ')');
      if (!ob.dependentes.length) obj('-', 'nenhum');
      ob.dependentes.forEach(function (d) { obj(d.nome, d.tipo, false, !d.valido); });
      lw.appendChild(tb); bx.appendChild(lw); b.appendChild(bx);
    }

    if (r.avisos && r.avisos.length) b.appendChild(el('div', 'av', r.avisos.join(' ')));

    var f = el('div', 'f'); p.appendChild(f);
    var aviso = el('span', 'ok');
    function botao(rotulo, valor) { if (!valor) return; var bt = el('button', 'bt', rotulo); bt.onclick = function () { copiar(valor, aviso); }; f.appendChild(bt); }
    if (r.tabela && r.coluna) botao('Copiar TABELA.CAMPO', r.tabela + '.' + r.coluna);
    botao('Copiar tabela', r.tabela);
    if (r.coluna) botao('Copiar campo', r.coluna);
    botao('Copiar instância', r.instancia);
    if (r.opcoes && r.opcoes.length) {
      botao('Copiar opções', r.opcoes.map(function (o) { return o.valor + ' = ' + o.opcao; }).join('\n'));
      var q = function (s) { return "'" + String(s).replace(/'/g, "''") + "'"; };
      var col = (r.tabela ? r.tabela + '.' : '') + r.coluna;
      botao('Copiar CASE', 'CASE ' + col + '\n' + r.opcoes.map(function (o) {
        return '  WHEN ' + q(o.valor) + ' THEN ' + q(o.opcao);
      }).join('\n') + '\nEND');
    }
    if (r.objetos) {
      var ob2 = r.objetos;
      botao('Copiar objetos', 'Triggers de ' + ob2.tabela + ' (' + ob2.banco + '):\n' +
        (ob2.triggers.map(function (t) { return '  ' + t.nome + ' - ' + (t.momento || '') + ' ' + (t.evento || '') + (t.ativo ? '' : ' [desativada]') + (t.valido ? '' : ' [inválido]'); }).join('\n') || '  (nenhuma)') +
        '\nDependentes:\n' + (ob2.dependentes.map(function (d) { return '  ' + d.tipo + ' ' + d.nome + (d.valido ? '' : ' [inválido]'); }).join('\n') || '  (nenhum)'));
    }
    if (r.diagnostico) botao('Copiar diagnóstico', JSON.stringify(r.diagnostico, null, 1));
    f.appendChild(aviso);

    posicionar(p);
  }
})();
