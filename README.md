# Inspetor Sankhya

Extensão para Chrome (também funciona no Edge e no Brave) que mostra **de qual tabela e coluna é cada campo** das telas do Sankhya OM. É só clicar com o botão direito.

Feita para quem desenvolve, dá suporte ou faz consultoria no Sankhya e passa o dia perguntando "esse campo fica em qual tabela?".

![Clique direito num campo mostrando TABELA.COLUNA](docs/painel-campo.png)

## O que ela faz

### Clique direito: tabela e campo
Clique com o botão direito num campo do formulário, numa coluna da grade ou em qualquer ponto da tela e escolha **"Sankhya: tabela/campo"**. O painel mostra:

- `TABELA.COLUNA` (ex.: `TGFPAR.CODPARC`), descrição e tipo do campo
- instância (entityName) e resourceID da tela
- **referência** de chave estrangeira (ex.: `TSIUSU.CODUSU (Usuario)`)
- **campo de ligação**: a coluna "Descrição (Centro de Resultado)" da grade de Parceiros aparece como `TSICUS.DESCRCENCUS`, ligada pelo campo `TGFPAR.AD_CODCENCUS`
- se é campo adicional (`AD_`) ou calculado
- **lista de opções** do campo, quando existir (TDDOPC), por exemplo `F = Física`, `J = Jurídica`

Botões para copiar: `TABELA.CAMPO`, tabela, campo, instância, a lista de opções e um `CASE` pronto para colar no SQL:

```sql
CASE TGFPAR.TIPPESSOA
  WHEN 'F' THEN 'Física'
  WHEN 'J' THEN 'Jurídica'
END
```

![Painel com a lista de opções do campo](docs/painel-opcoes.png)

### Raio-x (opcional)
Coloca uma etiqueta com o nome físico sobre **cada campo e cada coluna** da tela aberta. Verde = campo da tabela, azul = campo de ligação, cinza = calculado. Passar o mouse mostra `TABELA.COLUNA` e a descrição; clicar na etiqueta copia.

![Raio-x num formulário](docs/raiox-formulario.png)

### Objetos do banco (opcional)
Acrescenta ao painel as **triggers** da tabela (evento, momento, desativada ou inválida) e os **objetos que dependem dela** (views, procedures, functions, packages e triggers de outras tabelas), com os inválidos marcados. Detecta sozinho se o banco é Oracle ou SQL Server.

![Objetos do banco no painel](docs/objetos-banco.png)

## Onde funciona

- Telas HTML5 nativas do Sankhya OM (formulário, grade e abas de detalhe)
- Telas de **addon** (que rodam fora de `/mge`, como `/<addon>/Tela.xhtml5`)
- Sankhya na nuvem (`*.sankhyacloud.com.br`) e servidor próprio do cliente

Não funciona em telas Flex/SWF nem em applets.

## Instalação

1. Baixe o ZIP da versão mais recente em **[Releases](../../releases)** e descompacte numa pasta fixa (ex.: `Documentos/Inspetor Sankhya`). Não apague essa pasta depois: o navegador lê a extensão dela.
2. Abra `chrome://extensions` (no Edge: `edge://extensions`).
3. Ligue o **Modo do desenvolvedor**, no canto superior direito.
4. Clique em **Carregar sem compactação** e escolha a pasta que tem o `manifest.json`.
5. Fixe o ícone pelo quebra-cabeça da barra.
6. Recarregue a aba do Sankhya (F5).

Clique no ícone para ligar e desligar o Inspetor, o Raio-x e os Objetos do banco.

![Painel do ícone com as chaves](docs/popup.png)

### Atualizar
Copie os arquivos da versão nova **para a mesma pasta** que o navegador já carrega, clique em recarregar no card da extensão em `chrome://extensions` e dê F5 no Sankhya. Usar a mesma pasta mantém as suas configurações.

## Segurança e privacidade

- **Só lê.** Não grava, não altera e não exclui nada no Sankhya.
- A identificação vem dos metadados que a própria tela já carregou. Quando falta algo, ela consulta o dicionário de dados (`TDDINS`, `TDDCAM`, `TDDOPC` e, na opção Objetos do banco, o catálogo do banco) **com a sessão e as permissões de quem está logado**, só com SELECT.
- **Nada sai do seu navegador.** A extensão não envia dados para nenhum servidor além do próprio Sankhya que você está usando.
- A extensão vale para todos os sites, porque as telas de addon não têm um caminho fixo. Por isso, na instalação, o Chrome avisa que ela pode "ler e alterar dados em todos os sites". Na prática, ela só liga em página do Sankhya (caminho `/mge...`, tela `.xhtml5` ou frame dentro do `system.jsp`) e o item do clique direito só aparece nos domínios do Sankhya.
- O código é aberto: está tudo neste repositório.

## Limitações

- Campo calculado não existe como coluna física; o painel avisa.
- Em algumas células da grade o Sankhya mostra um menu próprio (ex.: "Gráficos"); ali os dois menus aparecem juntos.
- Telas fora do padrão HTML5 (`sk-*`) podem não ser identificadas. Nesse caso use **Copiar diagnóstico** no painel e abra uma issue com o texto.
- Sem acesso ao DbExplorer, o painel mostra apenas o que a tela forneceu.

## Problemas e sugestões

Abra uma **[issue](../../issues)** informando: versão do Sankhya, tela (nome e resourceID), o que esperava e o que apareceu. Se o painel mostrar "Não identificado", cole o texto do botão **Copiar diagnóstico**. **Não poste dados de cliente** (nomes, valores, documentos).

## Histórico

- **1.2.1**: funciona em telas de addon; menu restrito aos domínios do Sankhya.
- **1.2.0**: Raio-x e Objetos do banco; painel do ícone com chaves.
- **1.1.0**: lista de opções do campo (TDDOPC), "Copiar opções" e "Copiar CASE".
- **1.0.0**: versão inicial (clique direito com tabela, coluna e instância).

---

Projeto independente, sem vínculo com a Sankhya Gestão de Negócios. "Sankhya" é marca de seus respectivos donos.
