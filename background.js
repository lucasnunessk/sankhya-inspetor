// Service worker: menu de contexto + selo do ícone. As chaves ficam no popup.
const MENU_ID = 'snk-inspetor';
// Domínios do Sankhya já vistos (inclui telas de addon, que não ficam em /mge).
async function padroes() {
  const { origens } = await chrome.storage.local.get({ origens: [] });
  return ['*://*/mge*'].concat(origens.map(o => o + '/*'));
}
// Content script avisa quando está num domínio do Sankhya; o menu passa a valer para o domínio todo.
chrome.runtime.onMessage.addListener(async (msg) => {
  if (!msg || msg.tipo !== 'snk-origem' || !/^https?:$/.test(msg.protocolo) || !/^[a-z0-9.-]+$/i.test(msg.host || '')) return;
  const o = msg.protocolo + '//' + msg.host.toLowerCase(); // sem porta: o padrão vale para qualquer porta
  const { origens } = await chrome.storage.local.get({ origens: [] });
  if (origens.includes(o)) return;
  origens.push(o);
  await chrome.storage.local.set({ origens: origens.slice(-100) });
});
const PADRAO = { ativo: true, raiox: false, objetos: false };

async function lerConfig() {
  const v = await chrome.storage.local.get(PADRAO);
  return { ativo: v.ativo !== false, raiox: v.raiox === true, objetos: v.objetos === true };
}

async function montarMenu() {
  const c = await lerConfig();
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Sankhya: tabela/campo',
    contexts: ['all'],
    documentUrlPatterns: await padroes(),
    visible: c.ativo
  });
}

async function atualizarSelo() {
  const c = await lerConfig();
  let texto = '', cor = '#9e9e9e';
  if (c.raiox) { texto = 'RX'; cor = '#2e7d32'; }
  else if (!c.ativo) { texto = 'OFF'; }
  await chrome.action.setBadgeText({ text: texto });
  await chrome.action.setBadgeBackgroundColor({ color: cor });
  const partes = ['Inspetor ' + (c.ativo ? 'ligado' : 'desligado')];
  if (c.ativo && c.objetos) partes.push('objetos do banco ligado');
  if (c.raiox) partes.push('raio-x ligado');
  await chrome.action.setTitle({ title: 'Inspetor Sankhya - ' + partes.join(', ') });
}

chrome.runtime.onInstalled.addListener(() => { montarMenu(); atualizarSelo(); });
chrome.runtime.onStartup.addListener(() => { montarMenu(); atualizarSelo(); });

chrome.storage.onChanged.addListener(async (ch, area) => {
  if (area !== 'local') return;
  if (ch.ativo) chrome.contextMenus.update(MENU_ID, { visible: ch.ativo.newValue !== false }).catch(montarMenu);
  if (ch.origens) montarMenu();
  if (ch.ativo || ch.raiox || ch.objetos) atualizarSelo();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || tab.id == null) return;
  chrome.tabs.sendMessage(tab.id, { tipo: 'snk-inspecionar' }, { frameId: info.frameId || 0 })
    .catch(() => { /* frame sem o script (ex.: página fora do Sankhya) */ });
});
