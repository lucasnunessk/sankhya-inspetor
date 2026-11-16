// Painel do ícone: três chaves gravadas em chrome.storage.local.
var PADRAO = { ativo: true, raiox: false, objetos: false };
var ids = ['ativo', 'raiox', 'objetos'];

function atualizarDependencia(ativo) {
  var linha = document.getElementById('linhaObjetos');
  linha.classList.toggle('desab', !ativo);
  document.getElementById('objetos').disabled = !ativo;
}

chrome.storage.local.get(PADRAO, function (v) {
  ids.forEach(function (id) {
    var cb = document.getElementById(id);
    cb.checked = id === 'ativo' ? v.ativo !== false : v[id] === true;
    cb.addEventListener('change', function () {
      var o = {}; o[id] = cb.checked;
      chrome.storage.local.set(o);
      if (id === 'ativo') atualizarDependencia(cb.checked);
    });
  });
  atualizarDependencia(v.ativo !== false);
});

document.getElementById('versao').textContent = 'Versão ' + chrome.runtime.getManifest().version;
