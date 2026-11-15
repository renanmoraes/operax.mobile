# Brief de screenshots — loja

> **Como gerar (desde 14/11/2026):** usar a skill **`app-store-screenshots`**
> (`~/.claude/skills/app-store-screenshots`, fonte github.com/ParthJadhav/app-store-screenshots).
> Ela cria um editor Next.js à parte (colocar em `store-assets/screenshots-editor/`, fora do app Expo),
> onde as capturas entram com moldura de aparelho, título e fundo, e exporta em lote nas resoluções
> da App Store (iPhone 6,9"/6,7", iPad) e do Google Play (celular, tablet, feature graphic 1024×500).
> As capturas cruas saem do modo demo do app (`npx expo start --web`, 430×932, ou o iPhone pelo Expo Go).

Público na loja: gestor/atendente que busca **Operax** ou “atendimento fila CRM”.  
Tempo de decisão: 3–6s → **slots 1–3 decidem**.

## Ordem final (gerada em 15/11/2026, pt-BR)

Entrega pronta em `store-assets/loja/` (ver `store-assets/loja/LEIA-ME.md`). Estilo: navy `#050a14`/`#0c1222`,
cobalto `#1e4ed8`, ciano `#4fd8ff`, Inter; uma palavra de destaque por título; selos com números reais da tela.

| # | iPhone 6,9" / 6,5" | Android (8) | Tela do app |
|---|--------------------|-------------|-------------|
| 1 | Atendimento no bolso. | 1 | Fila (na fila 1, com você 2) |
| 2 | Resumo e resposta prontos. | 2 | Conversa com sugestões e resumo da IA |
| 3 | Transfira para quem está online. | — | Folha de transferir com presença |
| 4 | Pese por valor. Venda no kg. | 3 | PDV, R$ 20 = 501,3 g |
| 5 | Receba e dê o troco. | 4 | PDV, troco R$ 8,10 e venda registrada |
| 6 | O dia todo em uma linha. (claro) | 5 | Agenda em linha do tempo |
| 7 | Avisos que chegam a tempo. | — | Avisos |
| 8 | Aceite a vaga na hora. (claro) | 7 | Cliente, aula em grupo |
| 9 | Treino com cronômetro. | 6 | Ficha e sessão |
| 10 | E muito mais. | 8 | Mosaico: GPS, evolução, conquistas, chat da equipe |

Momento entre telas: o fio de luz ciano passa do slide 4 para o 5 (PDV). Feature graphic: ícone, nome e
"Atendimento, PDV e treino no bolso." com três telas do app.

## Regras criativas

- Captions em **benefício**, não nome de feature (“Assuma a fila” ≠ “Drawer”).
- UI real do build (não inventar telas).
- Fundo navy/cobalt Operax; tipografia Inter; sem texto no ícone.
- Evitar logos WhatsApp/Meta grandes (trademark); canal pode aparecer como label na UI.
- Play: também **feature graphic** 1024×500 com mark + “Atendimento e Fila”.

## Assets internos atuais

Fonte: `screenshots/` (capturas web phone).  
Próximo passo produção: exportar em resoluções oficiais (ASC / Play) com device frame ou frameless consistente.

## Preview video (P2)

15–30s, sem áudio obrigatório, legendas:
1. Abre fila → Assumir  
2. Responde mensagem  
3. Badge de posse / avisos  
CTA final: “Operax — atendimento em campo”
