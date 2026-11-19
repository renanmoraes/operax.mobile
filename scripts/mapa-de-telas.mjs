#!/usr/bin/env node
/**
 * Mapa de telas do app, tirado do próprio código, e conferência com a wiki do Operax.
 *
 * Por quê: a Lia (assistente do Operax) só sabe o que a wiki escreve. Em 19/11/2026 ela mandou a pessoa
 * abrir "Mais → Pedidos" no app, e esse item não existe. O caminho no celular tem de estar escrito na
 * wiki com o nome exato da aba e do item, e mudar junto com o app.
 *
 * Fontes (o que a pessoa vê, em português):
 *   - abas da equipe: app/(app)/_layout.tsx + src/i18n/locales/pt/nav.ts
 *   - abas do cliente: app/(client)/_layout.tsx + nav.ts
 *   - itens do Mais: app/(app)/more.tsx + src/i18n/locales/pt/staff.ts
 *
 * Uso:
 *   node scripts/mapa-de-telas.mjs                 confere o guia app-celular.md do repositório operax
 *   node scripts/mapa-de-telas.mjs --imprimir      mostra a seção "## Mapa do app" pronta para colar
 *   node scripts/mapa-de-telas.mjs --guia <arq>    confere outro arquivo
 *   --estrito                                      falha também quando o guia não é encontrado
 *   OPERAX_REPO=<pasta>                            onde está o repositório operax (padrão: ../operax)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};

async function textos(arquivo) {
  return (await import(pathToFileURL(join(raiz, 'src/i18n/locales/pt', arquivo)).href)).default;
}

/** Abas visíveis de um _layout do expo-router: título traduzido e se depende de condição. */
function abas(layout, nav) {
  const codigo = readFileSync(join(raiz, layout), 'utf8');
  return codigo
    .split('<Tabs.Screen')
    .slice(1)
    .map((trecho) => {
      const m = /title: t\('(\w+)\.(\w+)'\)/.exec(trecho);
      if (!m || /HIDDEN_ITEM/.test(trecho)) return null;
      const titulo = nav[m[1]]?.[m[2]];
      if (!titulo) throw new Error(`Sem texto em nav.ts para ${m[1]}.${m[2]} (${layout})`);
      return { titulo, condicional: /href:\s*[^,}]*\?\s*undefined\s*:\s*null/.test(trecho) };
    })
    .filter(Boolean);
}

/** Itens do Mais por grupo, na ordem do código. */
function itensDoMais(staff) {
  const codigo = readFileSync(join(raiz, 'app/(app)/more.tsx'), 'utf8');
  const grupo = (nome) => {
    const bloco = new RegExp(`const ${nome}[^=]*=\\s*\\[([\\s\\S]*?)\\];`).exec(codigo)?.[1] ?? '';
    return [...bloco.matchAll(/\{\s*id:\s*'(\w+)'[^}]*\}/g)].map((m) => {
      const item = staff.more.items[m[1]];
      if (!item) throw new Error(`Sem texto em staff.ts para more.items.${m[1]}`);
      return { titulo: item.title, dica: item.hint, porApp: /app:\s*'(\w+)'/.exec(m[0])?.[1] ?? null };
    });
  };
  return { trabalho: grupo('WORK'), conta: grupo('ACCOUNT') };
}

const nav = await textos('nav.ts');
const staff = await textos('staff.ts');
const mapa = {
  equipe: abas('app/(app)/_layout.tsx', nav),
  cliente: abas('app/(client)/_layout.tsx', nav),
  mais: itensDoMais(staff),
  grupos: staff.more,
};

const negrito = (t) => `**${t}**`;
const nomesObrigatorios = [
  ...mapa.equipe.map((a) => a.titulo),
  ...mapa.cliente.map((a) => a.titulo),
  mapa.grupos.team,
  mapa.grupos.work,
  mapa.grupos.account,
  ...mapa.mais.trabalho.map((i) => i.titulo),
  ...mapa.mais.conta.map((i) => i.titulo),
];

if (args.includes('--imprimir')) {
  const linhas = [
    '## Mapa do app',
    '',
    `É o que aparece no app, com os nomes exatos. Item que não está aqui não existe no app: a pessoa faz pelo site, no navegador do celular ou do computador.`,
    '',
    `**Equipe da empresa.** Abas embaixo: ${mapa.equipe.map((a) => negrito(a.titulo)).join(', ')}.`,
    '',
    `Em ${negrito(mapa.grupos.title)}, os itens vêm em grupos (o nome do grupo é só um título, não se toca nele):`,
    '',
    `- grupo ${negrito(mapa.grupos.team)}: o chat da equipe.`,
    `- grupo ${negrito(mapa.grupos.work)}: ${mapa.mais.trabalho.map((i) => `${negrito(i.titulo)} (${i.dica.toLowerCase()}${i.porApp ? ', aparece com o app contratado' : ''})`).join(', ')}. Cada item aparece para quem tem a permissão dele.`,
    `- grupo ${negrito(mapa.grupos.account)}: ${mapa.mais.conta.map((i) => negrito(i.titulo)).join(', ')}.`,
    '',
    `Caminho certo é ${negrito(`${mapa.grupos.title} → ${mapa.mais.trabalho.find((i) => /kanban/i.test(i.titulo))?.titulo ?? mapa.mais.trabalho[0]?.titulo}`)}, sem o nome do grupo no meio.`,
    '',
    `**Cliente da empresa.** Abas embaixo: ${mapa.cliente.map((a) => `${negrito(a.titulo)}${a.condicional ? ' (quando a empresa usa)' : ''}`).join(', ')}.`,
  ];
  console.log(linhas.join('\n'));
  process.exit(0);
}

const repoOperax = process.env.OPERAX_REPO ?? join(raiz, '../operax');
const guia = resolve(opcao('--guia') ?? join(repoOperax, 'operax-backend/src/wiki-content/guides/app-celular.md'));
if (!existsSync(guia)) {
  const msg = `Guia da wiki não encontrado em ${guia}. Use --guia <arquivo> apontando para operax-backend/src/wiki-content/guides/app-celular.md.`;
  if (args.includes('--estrito')) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`aviso: ${msg} Conferência pulada.`);
  process.exit(0);
}

const texto = readFileSync(guia, 'utf8');
const secao = /^## Mapa do app\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(texto)?.[1];
if (!secao) {
  console.error(`O guia ${guia} não tem a seção "## Mapa do app". Gere com --imprimir e cole no guia.`);
  process.exit(1);
}
const faltando = [...new Set(nomesObrigatorios)].filter((nome) => !secao.includes(negrito(nome)));
if (faltando.length) {
  console.error(`O "Mapa do app" da wiki não cita, com o nome exato, ${faltando.map((n) => `"${n}"`).join(', ')}.`);
  console.error('Atualize a seção (node scripts/mapa-de-telas.mjs --imprimir) no repositório operax e suba o guia junto.');
  process.exit(1);
}
console.log(`Mapa do app confere com a wiki (${nomesObrigatorios.length} nomes).`);
