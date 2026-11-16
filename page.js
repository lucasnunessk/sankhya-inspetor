// Roda no contexto da página (world MAIN) para enxergar o AngularJS do Sankhya.
// Só lê: não altera dados nem chama serviço de gravação.
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
  if (window.__snkInspetorPage || !ehSankhya()) return;
  window.__snkInspetorPage = true;

  var cfg = { ativo: true, raiox: false, objetos: false };
  var ultimo = null; // { path: [elementos], x, y }

  document.addEventListener('snk-inspetor:config', function (e) {
    try { cfg = JSON.parse(e.detail); } catch (_) { /* mantém */ }
    if (typeof aplicarRaiox === 'function') aplicarRaiox();
  });

  // Captura o alvo do clique direito antes do Sankhya.
  // Nas células do ag-grid o Sankhya chama preventDefault() sem mostrar menu próprio,
  // o que esconde o menu do Chrome. Só ali o preventDefault é neutralizado.
  window.addEventListener('contextmenu', function (e) {
    var path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
    ultimo = { path: path.filter(function (n) { return n && n.nodeType === 1; }) };
    if (!cfg.ativo) return;
    var alvo = ultimo.path[0];
    if (alvo && alvo.closest && alvo.closest('.ag-cell, .ag-row, .ag-body-viewport')) {
      try { Object.defineProperty(e, 'preventDefault', { value: function () {}, configurable: true }); } catch (_) {}
    }
  }, true);

  document.addEventListener('snk-inspetor:resolver', function () {
    resolver().then(function (r) {
      document.dispatchEvent(new CustomEvent('snk-inspetor:resultado', { detail: JSON.stringify(r) }));
    });
  });

  // ---------- utilidades ----------
  var NOME_OK = /^[A-Za-z0-9_.]+$/;
  var ENTIDADE_OK = /^[A-Z][A-Za-z0-9_]*$/;

  function ng() { return window.angular && window.angular.element ? window.angular : null; }

  function escopos(el) {
    var a = ng(); if (!a || !el) return [];
    try {
      var j = a.element(el), out = [];
      var i = j.isolateScope && j.isolateScope(); if (i) out.push(i);
      var s = j.scope && j.scope(); if (s && s !== i) out.push(s);
      return out;
    } catch (_) { return []; }
  }

  function ehDataset(o) {
    return o && typeof o === 'object' && typeof o.getEntityName === 'function';
  }

  function datasetDoEscopo(s) {
    if (!s) return null;
    var chaves = ['skDataset', 'dataset', 'ds', 'skDs'];
    for (var k = 0; k < chaves.length; k++) if (ehDataset(s[chaves[k]])) return s[chaves[k]];
    return null;
  }

  function ancestrais(path) {
    // path do composedPath já inclui ancestrais (atravessando shadow DOM).
    return path.length ? path : [];
  }

  function datasetPerto(path) {
    var lista = ancestrais(path);
    for (var i = 0; i < lista.length && i < 60; i++) {
      var sc = escopos(lista[i]);
      for (var j = 0; j < sc.length; j++) {
        var ds = datasetDoEscopo(sc[j]);
        if (ds) return ds;
      }
    }
    return null;
  }

  function attr(el, nomes) {
    if (!el || !el.getAttribute) return null;
    for (var i = 0; i < nomes.length; i++) {
      var v = el.getAttribute(nomes[i]);
      if (v) return v;
    }
    return null;
  }

  function resourceIdDaUrl() {
    try { return new URL(location.href).searchParams.get('resourceID'); } catch (_) { return null; }
  }

  function metadata(ds, campo) {
    if (!ds || !campo || typeof ds.getFieldMetadata !== 'function') return null;
    try { return ds.getFieldMetadata(campo) || null; } catch (_) { return null; }
  }

  function entidade(ds) {
    try { return ds ? ds.getEntityName() : null; } catch (_) { return null; }
  }

  function descricaoEntidade(ds) {
    try { return ds && typeof ds.getEntityDescription === 'function' ? ds.getEntityDescription() : null; } catch (_) { return null; }
  }

  // ---------- consulta ao dicionário (fallback) ----------
  var cache = {};
  function consultar(sql) {
    if (cache[sql]) return cache[sql];
    var url = '/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
    cache[sql] = fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Accept': 'application/json' },
      body: JSON.stringify({ serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql: sql } })
    }).then(function (r) { return r.text(); }).then(function (t) {
      var j = JSON.parse(t);
      if (String(j.status) !== '1') throw new Error(j.statusMessage || 'Consulta recusada');
      var rb = j.responseBody || {}, md = rb.fieldsMetadata || [];
      return (rb.rows || []).map(function (linha) {
        var o = {}; md.forEach(function (c, i) { o[String(c.name).toUpperCase()] = linha[i]; }); return o;
      });
    }).catch(function (e) { delete cache[sql]; throw e; });
    return cache[sql];
  }

  function tabelaDaInstancia(inst) {
    if (!inst || !NOME_OK.test(inst)) return Promise.resolve(null);
    return consultar("SELECT NOMETAB, DESCRINSTANCIA FROM TDDINS WHERE NOMEINSTANCIA = '" + inst + "'")
      .then(function (r) { return r[0] || null; });
  }

  function instanciaDoResource(rid) {
    if (!rid || !NOME_OK.test(rid)) return Promise.resolve(null);
    return consultar("SELECT NOMEINSTANCIA, NOMETAB, DESCRINSTANCIA FROM TDDINS WHERE RESOURCEID = '" + rid + "' ORDER BY NUINSTANCIA")
      .then(function (r) { return r[0] || null; });
  }

  function campoDoDicionario(tab, campo) {
    if (!tab || !campo || !NOME_OK.test(tab) || !NOME_OK.test(campo)) return Promise.resolve(null);
    return consultar("SELECT DESCRCAMPO, TIPCAMPO, CALCULADO, ADICIONAL FROM TDDCAM WHERE NOMETAB = '" + tab + "' AND NOMECAMPO = '" + campo + "'")
      .then(function (r) { return r[0] || null; });
  }

  // Lista de opções do campo (TDDOPC: VALOR, OPCAO).
  function opcoesDoDicionario(tab, campo) {
    if (!tab || !campo || !NOME_OK.test(tab) || !NOME_OK.test(campo)) return Promise.resolve([]);
    return consultar("SELECT O.VALOR, O.OPCAO FROM TDDOPC O INNER JOIN TDDCAM C ON C.NUCAMPO = O.NUCAMPO WHERE C.NOMETAB = '" + tab + "' AND C.NOMECAMPO = '" + campo + "'")
      .then(function (rows) {
        return rows.map(function (o) {
          return { valor: o.VALOR != null ? String(o.VALOR) : '', opcao: o.OPCAO != null ? String(o.OPCAO) : '' };
        }).sort(function (a, b) { return a.valor.localeCompare(b.valor, 'pt-BR', { numeric: true }); });
      });
  }

  // Opções que a tela já carregou no metadata (fallback se o banco falhar).
  function opcoesDoMetadata(md) {
    if (!md || !Array.isArray(md.options) || !md.options.length) return [];
    return md.options.map(function (o) {
      if (o == null || typeof o !== 'object') return { valor: String(o), opcao: '' };
      var v = o.value != null ? o.value : (o.valor != null ? o.valor : o.key);
      var t = o.label != null ? o.label : (o.opcao != null ? o.opcao : (o.description != null ? o.description : o.text));
      return { valor: v != null ? String(v) : '', opcao: t != null ? String(t) : '' };
    }).filter(function (o) { return o.valor !== '' || o.opcao !== ''; });
  }

  // ---------- descoberta do campo ----------
  function acharCampo(path) {
    for (var i = 0; i < path.length && i < 40; i++) {
      var el = path[i];
      if (!el.tagName) continue;
      var tag = el.tagName.toLowerCase();

      // Formulário HTML5 (sk-dynaform)
      if (tag === 'sk-form-item') {
        var sc = escopos(el)[0];
        var p = sc && sc.properties;
        if (p && p.fieldName) return { campo: p.fieldName, rotulo: p.description, ds: datasetDoEscopo(sc), origem: 'formulário' };
      }

      // Grade ag-grid (sk-datagrid): célula ou cabeçalho
      var col = el.getAttribute && el.getAttribute('col-id');
      if (col && col !== 'ag-Grid-AutoColumn' && !/^(checkbox|cbx|0)$/i.test(col)) {
        return { campo: col, ds: null, origem: 'grade', elGrade: el };
      }

      // Atributos genéricos (outras telas sk-* e web components)
      var a = attr(el, ['sk-field-name', 'field-name', 'data-field-name', 'fieldname', 'data-field']);
      if (a && NOME_OK.test(a)) return { campo: a, ds: null, origem: 'atributo' };
      if (typeof el.fieldName === 'string' && NOME_OK.test(el.fieldName)) return { campo: el.fieldName, ds: null, origem: 'componente' };
    }
    return null;
  }

  function acharEntidadePorAtributo(path) {
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      var v = attr(el, ['sk-entity-name', 'entity-name', 'data-entity-name']);
      if (v && ENTIDADE_OK.test(v) && v !== 'entityName') return v;
      if (el && typeof el.entityName === 'string' && ENTIDADE_OK.test(el.entityName)) return el.entityName;
      var du = el && el.dataUnit;
      if (du && typeof du.name === 'string') {
        var m = du.name.match(/dd:\/\/([A-Za-z0-9_]+)/);
        if (m) return m[1];
      }
    }
    return null;
  }

  function entidadeDaTela() {
    var dyn = document.querySelector('sk-dynaform, [sk-dynaform]');
    if (dyn) {
      var sc = escopos(dyn);
      for (var i = 0; i < sc.length; i++) { var ds = datasetDoEscopo(sc[i]); if (ds) return { ds: ds, inst: entidade(ds) }; }
      var v = dyn.getAttribute('sk-entity-name');
      if (v && ENTIDADE_OK.test(v)) return { ds: null, inst: v };
    }
    var dsEl = document.querySelector('sk-dataset[entity-name]');
    if (dsEl) return { ds: null, inst: dsEl.getAttribute('entity-name') };
    return null;
  }

  // ---------- resolução principal ----------
  function resolver() {
    var r = {
      ok: false, campo: null, coluna: null, rotulo: null, tabela: null, instancia: null,
      descricaoInstancia: null, ligacao: null, campoLigacao: null, tabelaOrigem: null,
      tipo: null, calculado: false, adicional: false, resourceID: resourceIdDaUrl(),
      origem: null, fonte: null, avisos: [], diagnostico: null
    };
    var path = (ultimo && ultimo.path) || [];
    var achado = acharCampo(path);
    var ds = (achado && achado.ds) || datasetPerto(path);

    if (!ds && achado && achado.elGrade) {
      var grid = achado.elGrade.closest('sk-datagrid, [sk-datagrid]');
      if (grid) { var sc = escopos(grid); for (var i = 0; i < sc.length && !ds; i++) ds = datasetDoEscopo(sc[i]); }
    }

    r.instancia = entidade(ds) || acharEntidadePorAtributo(path);
    r.descricaoInstancia = descricaoEntidade(ds);
    r.origem = achado ? achado.origem : 'tela';

    var passos = Promise.resolve();

    if (achado) {
      r.campo = achado.campo;
      r.rotulo = achado.rotulo || null;
      var md = metadata(ds, achado.campo);
      if (md) {
        r.fonte = 'metadados da tela';
        r.tabela = md.tableName || null;
        r.coluna = md.id || achado.campo.split('.').pop();
        r.rotulo = md.description || r.rotulo;
        r.tipo = (md.userType && md.userType !== 'ENTITY' ? md.userType : md.dataType) || md.userType || null;
        if (md.fk && md.fk.entity) {
          var fp = md.fk.fmdPresentation || {};
          r.referencia = (fp.tableName ? fp.tableName + '.' : '') + (md.fk.targetField || '') + ' (' + md.fk.entity + ')';
        }
        r.calculado = !!md.calculated;
        r.adicional = !!md.isUserField || /^AD_/.test(r.coluna || '');
        if (achado.campo.indexOf('.') > 0) {
          r.ligacao = achado.campo.split('.')[0];
          r.campoLigacao = md.codeFieldName || null;
          var mdCod = md.codeFieldName ? metadata(ds, md.codeFieldName) : null;
          r.tabelaOrigem = (mdCod && mdCod.tableName) || null;
          if (md.relationEntityName) r.descricaoLigacao = md.relationEntityName;
        }
      } else {
        r.coluna = achado.campo.split('.').pop();
        if (achado.campo.indexOf('.') > 0) r.ligacao = achado.campo.split('.')[0];
      }
    }

    // Fallback 1: tabela pela instância (TDDINS)
    passos = passos.then(function () {
      if (r.tabela || !r.instancia || r.ligacao) return;
      return tabelaDaInstancia(r.instancia).then(function (row) {
        if (row) { r.tabela = row.NOMETAB; r.descricaoInstancia = r.descricaoInstancia || row.DESCRINSTANCIA; r.fonte = r.fonte || 'dicionário (TDDINS)'; }
      });
    });

    // Fallback 2: só a tela - instância raiz pelo resourceID ou pelo dynaform
    passos = passos.then(function () {
      if (r.instancia) return;
      var t = entidadeDaTela();
      if (t && t.inst) { r.instancia = t.inst; r.descricaoInstancia = descricaoEntidade(t.ds); return tabelaDaInstancia(t.inst).then(function (row) { if (row) r.tabela = row.NOMETAB; r.fonte = 'dicionário (TDDINS)'; }); }
      return instanciaDoResource(r.resourceID).then(function (row) {
        if (row) { r.instancia = row.NOMEINSTANCIA; r.tabela = row.NOMETAB; r.descricaoInstancia = row.DESCRINSTANCIA; r.fonte = 'dicionário (TDDINS por resourceID)'; }
      });
    });

    // Complemento: descrição/tipo do campo pelo TDDCAM quando a tela não trouxe
    passos = passos.then(function () {
      if (!r.tabela || !r.coluna || (r.rotulo && r.tipo)) return;
      return campoDoDicionario(r.tabela, r.coluna).then(function (row) {
        if (!row) { if (achado) r.avisos.push('Campo não encontrado no TDDCAM da tabela ' + r.tabela + ' (pode ser campo de tela/virtual).'); return; }
        r.rotulo = r.rotulo || row.DESCRCAMPO;
        r.tipo = r.tipo || row.TIPCAMPO;
        r.calculado = r.calculado || row.CALCULADO === 'S';
        r.adicional = r.adicional || row.ADICIONAL === 'S';
      });
    });

    passos = passos.catch(function (e) {
      r.avisos.push('Consulta ao dicionário falhou: ' + (e && e.message ? e.message : e));
    });

    // Lista de opções (TDDOPC); se o banco falhar, usa as opções do metadata da tela.
    passos = passos.then(function () {
      if (!achado || !r.tabela || !r.coluna) return;
      var doMd = opcoesDoMetadata(md);
      return opcoesDoDicionario(r.tabela, r.coluna).then(function (lista) {
        if (lista.length) { r.opcoes = lista; r.fonteOpcoes = 'TDDOPC'; }
        else if (doMd.length) { r.opcoes = doMd; r.fonteOpcoes = 'metadados da tela'; }
      }, function () {
        if (doMd.length) { r.opcoes = doMd; r.fonteOpcoes = 'metadados da tela'; }
      });
    });

    // Objetos do banco ligados à tabela (só com a chave "Objetos do banco" ligada).
    passos = passos.then(function () {
      if (!cfg.objetos || !r.tabela) return;
      return objetosDoBanco(r.tabela).then(function (o) { r.objetos = o; }, function (e) {
        r.avisos.push('Objetos do banco: ' + (e && e.message ? e.message : e));
      });
    });

    return passos.then(function () {
      r.ok = !!(r.tabela || r.instancia || r.campo);
      if (!achado) r.avisos.push('Nenhum campo sob o cursor; mostrando a tela.');
      if (achado && !ds) r.avisos.push('Dataset do campo não localizado; tabela deduzida pela instância.');
      if (r.calculado) r.avisos.push('Campo calculado: não existe como coluna física.');
      if (!r.ok || !r.tabela) r.diagnostico = diagnostico(path);
      return r;
    });
  }

  function diagnostico(path) {
    return {
      url: location.href,
      angular: !!ng(),
      caminho: path.slice(0, 15).map(function (el) {
        var at = [];
        if (el.attributes) for (var i = 0; i < el.attributes.length && at.length < 12; i++) {
          var a = el.attributes[i];
          if (a.name !== 'style') at.push(a.name + '=' + String(a.value).slice(0, 40));
        }
        return el.tagName.toLowerCase() + (at.length ? ' [' + at.join(' | ') + ']' : '');
      })
    };
  }

  // ---------- objetos do banco (triggers e dependentes) ----------
  var bancoTipo = null; // Promise<'oracle'|'sqlserver'>
  function detectarBanco() {
    if (bancoTipo) return bancoTipo;
    bancoTipo = consultar('SELECT 1 AS X FROM DUAL').then(function () { return 'oracle'; }, function () {
      return consultar('SELECT @@VERSION AS V').then(function () { return 'sqlserver'; });
    });
    bancoTipo.catch(function () { bancoTipo = null; });
    return bancoTipo;
  }

  function objetosDoBanco(tab) {
    if (!NOME_OK.test(tab)) return Promise.resolve(null);
    return detectarBanco().then(function (tipo) {
      var sqlTrg, sqlDep;
      if (tipo === 'oracle') {
        sqlTrg = "SELECT T.TRIGGER_NAME AS NOME, T.TRIGGERING_EVENT AS EVENTO, T.TRIGGER_TYPE AS MOMENTO, T.STATUS AS STATUS, O.STATUS AS VALIDO " +
          "FROM USER_TRIGGERS T LEFT JOIN USER_OBJECTS O ON O.OBJECT_NAME = T.TRIGGER_NAME AND O.OBJECT_TYPE = 'TRIGGER' " +
          "WHERE T.TABLE_NAME = '" + tab + "' ORDER BY T.TRIGGER_NAME";
        sqlDep = "SELECT D.NAME AS NOME, D.TYPE AS TIPO, O.STATUS AS VALIDO FROM USER_DEPENDENCIES D " +
          "LEFT JOIN USER_OBJECTS O ON O.OBJECT_NAME = D.NAME AND O.OBJECT_TYPE = D.TYPE " +
          "WHERE D.REFERENCED_NAME = '" + tab + "' AND D.REFERENCED_TYPE = 'TABLE' ORDER BY D.TYPE, D.NAME";
      } else {
        sqlTrg = "SELECT T.NAME AS NOME, E.TYPE_DESC AS EVENTO, CASE WHEN T.IS_INSTEAD_OF_TRIGGER = 1 THEN 'INSTEAD OF' ELSE 'AFTER' END AS MOMENTO, " +
          "CASE WHEN T.IS_DISABLED = 1 THEN 'DISABLED' ELSE 'ENABLED' END AS STATUS, 'VALID' AS VALIDO " +
          "FROM SYS.TRIGGERS T INNER JOIN SYS.TRIGGER_EVENTS E ON E.OBJECT_ID = T.OBJECT_ID " +
          "WHERE T.PARENT_ID = OBJECT_ID('" + tab + "') ORDER BY T.NAME";
        sqlDep = "SELECT DISTINCT O.NAME AS NOME, O.TYPE_DESC AS TIPO, 'VALID' AS VALIDO FROM SYS.SQL_EXPRESSION_DEPENDENCIES D " +
          "INNER JOIN SYS.OBJECTS O ON O.OBJECT_ID = D.REFERENCING_ID " +
          "WHERE D.REFERENCED_ID = OBJECT_ID('" + tab + "') ORDER BY O.TYPE_DESC, O.NAME";
      }
      return consultar(sqlTrg).then(function (trg) {
        // SQL Server devolve uma linha por evento: agrupar.
        var porNome = {}, triggers = [];
        trg.forEach(function (t) {
          var k = t.NOME;
          if (!porNome[k]) { porNome[k] = { nome: k, evento: t.EVENTO, momento: t.MOMENTO, ativo: t.STATUS === 'ENABLED', valido: t.VALIDO !== 'INVALID' }; triggers.push(porNome[k]); }
          else porNome[k].evento += ' OR ' + t.EVENTO;
        });
        return consultar(sqlDep).then(function (dep) {
          var nomesTrg = {}; triggers.forEach(function (t) { nomesTrg[t.nome] = 1; });
          var dependentes = dep.filter(function (d) { return !nomesTrg[d.NOME]; }).map(function (d) {
            return { nome: d.NOME, tipo: String(d.TIPO || '').replace(/_/g, ' '), valido: d.VALIDO !== 'INVALID' };
          });
          return { banco: tipo === 'oracle' ? 'Oracle' : 'SQL Server', tabela: tab, triggers: triggers, dependentes: dependentes };
        });
      });
    });
  }

  // ---------- raio-x: etiqueta com o nome físico sobre cada campo/coluna ----------
  var rx = { host: null, root: null, agendado: false, timer: null, obs: null, cacheMd: new WeakMap() };
  var RX_CSS = [
    ':host{all:initial}',
    '.l{position:fixed;inset:0;pointer-events:none;z-index:2147483646}',
    '.e{position:fixed;pointer-events:auto;cursor:copy;font:600 10px/14px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
    'color:#fff;background:rgba(46,125,50,.92);padding:0 4px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,.25)}',
    '.e.lig{background:rgba(21,101,192,.92)}',
    '.e.calc{background:rgba(97,97,97,.92)}',
    '.e.cp{background:#f9a825;color:#1f2933}'
  ].join('');

  function rxInfo(el, campo, ds) {
    var c = rx.cacheMd.get(el);
    if (c && c.campo === campo) return c;
    var md = metadata(ds, campo);
    c = {
      campo: campo,
      coluna: (md && md.id) || campo.split('.').pop(),
      tabela: md && md.tableName,
      descricao: md && md.description,
      ligacao: campo.indexOf('.') > 0 ? campo.split('.')[0] : null,
      calculado: !!(md && md.calculated)
    };
    rx.cacheMd.set(el, c);
    return c;
  }

  function rxDatasetGrade(el) {
    var g = el.closest && el.closest('sk-datagrid, [sk-datagrid]');
    if (!g) return null;
    var sc = escopos(g);
    for (var i = 0; i < sc.length; i++) { var ds = datasetDoEscopo(sc[i]); if (ds) return ds; }
    return null;
  }

  function rxAncoraForm(fi, desc) {
    var lb = fi.querySelector('label');
    if (lb && lb.getBoundingClientRect().width) return lb.getBoundingClientRect();
    if (desc) {
      var cand = fi.querySelectorAll('span, div');
      for (var i = 0; i < cand.length && i < 40; i++) {
        if (cand[i].children.length === 0 && cand[i].textContent.trim() === desc) {
          var r = cand[i].getBoundingClientRect(); if (r.width) return r;
        }
      }
    }
    var inp = fi.querySelector('input, textarea, select, sk-switch, [contenteditable]');
    if (inp && inp.getBoundingClientRect().width) {
      var ri = inp.getBoundingClientRect();
      return { left: ri.left, right: ri.left, top: ri.top - 14, bottom: ri.top, width: 1, height: 14 };
    }
    return null;
  }

  function rxVisivel(r) {
    return r && r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  }

  // Ponto (x,y) visível de fato: dentro de todo ancestral que corta conteúdo (overflow != visible).
  function rxNaoCortado(el, x, y, cacheClip) {
    for (var n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      var r = cacheClip.get(n);
      if (r === undefined) {
        var cs = getComputedStyle(n);
        r = (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') ? n.getBoundingClientRect() : null;
        cacheClip.set(n, r);
      }
      if (r && (x < r.left - 1 || x > r.right + 1 || y < r.top - 1 || y > r.bottom + 1)) return false;
    }
    return true;
  }

  function rxRender() {
    rx.agendado = false;
    if (!cfg.raiox || !rx.root) return;
    var clip = new Map();
    var camada = rx.root.querySelector('.l');
    camada.textContent = '';
    var itens = [], total = 0, LIMITE = 400;

    var fis = document.querySelectorAll('sk-form-item');
    for (var i = 0; i < fis.length && total < LIMITE; i++) {
      var fi = fis[i], sc = escopos(fi)[0], p = sc && sc.properties;
      if (!p || !p.fieldName) continue;
      var a = rxAncoraForm(fi, p.description);
      if (!rxVisivel(a) || !rxNaoCortado(fi, a.left + 2, a.top + a.height / 2, clip)) continue;
      itens.push({ info: rxInfo(fi, p.fieldName, datasetDoEscopo(sc)), x: a.right + 4, y: a.top + Math.max(0, (a.height - 14) / 2) });
      total++;
    }

    var hs = document.querySelectorAll('.ag-header-cell[col-id]');
    for (var j = 0; j < hs.length && total < LIMITE; j++) {
      var h = hs[j], col = h.getAttribute('col-id');
      if (!col || col === 'ag-Grid-AutoColumn') continue;
      var rh = h.getBoundingClientRect();
      if (!rxVisivel(rh) || !rxNaoCortado(h, rh.left + Math.min(10, rh.width / 2), rh.top + rh.height / 2, clip)) continue;
      var infH = rxInfo(h, col, rxDatasetGrade(h));
      var largura = infH.coluna.length * 6.2 + 10;
      var tx = h.querySelector('.ag-header-cell-text'), rt = tx && tx.getBoundingClientRect();
      if (rt && rt.width && rt.right + 4 + largura <= rh.right - 4) {
        itens.push({ info: infH, x: rt.right + 4, y: rt.top + (rt.height - 14) / 2 }); // cabe depois do texto
      } else {
        itens.push({ info: infH, x: rh.left + 2, y: rh.top - 8 }); // borda de cima
      }
      total++;
    }

    itens.forEach(function (it) {
      var inf = it.info, e = document.createElement('span');
      e.className = 'e' + (inf.ligacao ? ' lig' : '') + (inf.calculado ? ' calc' : '');
      e.textContent = inf.coluna;
      var completo = (inf.tabela ? inf.tabela + '.' : '') + inf.coluna;
      e.title = completo + (inf.descricao ? ' - ' + inf.descricao : '') + (inf.ligacao ? ' (ligação ' + inf.ligacao + ')' : '') +
        (inf.calculado ? ' (calculado)' : '') + '\nClique para copiar.';
      e.style.left = Math.max(0, Math.min(it.x, window.innerWidth - 60)) + 'px';
      e.style.top = Math.max(0, it.y) + 'px';
      e.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var ok = function () { e.classList.add('cp'); setTimeout(function () { e.classList.remove('cp'); }, 700); };
        try {
          if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(completo).then(ok, function () {});
          else {
            var t = document.createElement('textarea'); t.value = completo; t.style.position = 'fixed'; t.style.opacity = '0';
            document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); ok();
          }
        } catch (_) {}
      });
      camada.appendChild(e);
    });
  }

  function rxAgendar() {
    if (rx.agendado || !cfg.raiox) return;
    rx.agendado = true;
    requestAnimationFrame(rxRender);
  }

  function aplicarRaiox() {
    if (cfg.raiox) {
      if (!document.body) { document.addEventListener('DOMContentLoaded', aplicarRaiox, { once: true }); return; }
      if (!rx.host) {
        rx.host = document.createElement('snk-inspetor-raiox');
        rx.root = rx.host.attachShadow({ mode: 'open' });
        var st = document.createElement('style'); st.textContent = RX_CSS; rx.root.appendChild(st);
        var l = document.createElement('div'); l.className = 'l'; rx.root.appendChild(l);
        document.documentElement.appendChild(rx.host);
        window.addEventListener('scroll', rxAgendar, true);
        window.addEventListener('resize', rxAgendar);
        rx.obs = new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) if (!rx.host.contains(muts[i].target)) { rxAgendar(); return; }
        });
        rx.obs.observe(document.body, { childList: true, subtree: true });
        rx.timer = setInterval(rxAgendar, 1500); // troca de aba/visibilidade sem mutação de nós
      }
      rxAgendar();
    } else if (rx.host) {
      window.removeEventListener('scroll', rxAgendar, true);
      window.removeEventListener('resize', rxAgendar);
      if (rx.obs) rx.obs.disconnect();
      clearInterval(rx.timer);
      rx.host.remove();
      rx.host = rx.root = rx.obs = rx.timer = null;
      rx.cacheMd = new WeakMap();
    }
  }

  // Exposto para testes pelo DevTools: __snkInspetorResolver(elemento)
  window.__snkInspetorResolver = function (el) {
    var path = []; for (var n = el; n; n = n.parentElement) path.push(n);
    ultimo = { path: path };
    return resolver();
  };
})();
