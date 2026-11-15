# Conquistas com cadastro (Operax + empresa)

Data: 15/11/2026. Status: proposta, aguardando aprovação.

## O cenário

Hoje as 12 conquistas do app são fixas no código (`app/cliente/conquistas.tsx`) e calculadas no celular.
O que muda:

1. **A Operax lança conquistas** para todos os alunos de todas as empresas (catálogo da plataforma).
2. **A empresa (tenant) cadastra as dela** no portal, para os alunos dela.
3. **O app recebe as duas listas juntas** e mostra o progresso de cada uma, conforme a regra da conquista.

Toda conquista tem um **objetivo** (o que fazer para ganhar). Algumas valem **sempre**, outras só **num
período**, e outras são **anuais e se renovam** (Natal, Ano Novo): quem ganhou em 2026 pode ganhar de novo
em 2027, e o app mostra as duas.

## Cadastro (portal da empresa e painel da Operax)

| Campo | Como funciona |
| --- | --- |
| Nome | "Corrida de Natal" |
| Descrição | O texto que conta a história da conquista |
| Como ganhar | O que o aluno precisa fazer, em linguagem simples ("Corra 25 km entre 1 e 25 de dezembro") |
| Nível | Bronze, Prata, Ouro, Platina, Lendária. **O nível define a cor do pin** |
| Cor do pin | Opcional. Se preenchida, troca a cor que o nível daria |
| Ícone | Escolhe da biblioteca de ícones **ou envia um ícone próprio** (PNG/SVG, quadrado) |
| Objetivo (regra) | Tipo + meta. Ver a lista abaixo |
| Quando vale | Sempre · Período (de/até) · Todo ano (de dd/mm até dd/mm, renova sozinho) |
| Prêmio | Opcional, texto livre: "1 consultoria online", "10% na renovação". Fica pendente até a empresa marcar como entregue |
| XP | Pontos que somam no nível do aluno (padrão pelo nível: 50/100/200/400/800) |
| Situação | Rascunho · Publicada · Arquivada. Só a publicada aparece no app |

As conquistas da Operax aparecem no portal da empresa só para leitura, com uma chave "Mostrar para meus
alunos" (a empresa pode esconder uma que não combine com ela, como as bíblicas).

### Tipos de objetivo (primeira versão)

| Tipo | Meta | Exemplo |
| --- | --- | --- |
| `sessions` | N treinos no período | 10 treinos em dezembro |
| `distance` | N km no período (filtro opcional: corrida, bike, natação, caminhada) | 25 km de corrida no Natal |
| `elevation` | N metros de subida acumulada | Monte Sinai: 2.285 m |
| `minutes` | N minutos de treino | 300 min no mês |
| `streak` | N dias seguidos treinando | Jericó: 7 dias |
| `weekly_goal` | Bater a meta semanal N semanas | 4 semanas perfeitas |
| `records` | N recordes pessoais | Davi: 1 recorde |
| `on_date` | Treinar em um dia específico | Treinar no dia 1º de janeiro |
| `event_checkin` | Fazer check-in num evento da empresa, pela Operax | Corrida da academia 2026 |
| `achievements` | Ter outras medalhas (ver abaixo) | Natal 5 vezes · todas as bíblicas · 3 sazonais quaisquer |

As 12 conquistas que já existem viram registros da Operax com esses tipos (não muda nada para o aluno).

### Medalha que depende de outras medalhas

Uma conquista pode ser condicionada a outras. O objetivo `achievements` tem uma lista de condições, e o aluno ganha
quando **todas** são cumpridas. Cada condição escolhe medalhas e diz quantas vezes:

| Condição | Exemplo |
| --- | --- |
| Uma medalha N vezes | "Espírito natalino": ganhar a Corrida de Natal 5 vezes (cinco anos diferentes) |
| Todas de uma lista | "Peregrino": ter todas as 9 medalhas de Israel e eventos bíblicos |
| Quaisquer N de uma lista | "Ano inteiro": 3 medalhas quaisquer entre as sazonais |
| Combinação das anteriores | "Lenda da academia": a medalha 50 treinos **e** a medalha XYZ **e** a Corrida de Natal 2 vezes |

Regras:

- **Contagem:** uma medalha que se renova conta uma vez por ciclo (ano). Uma medalha "sempre" conta uma vez só,
  então pedir "5 vezes" só faz sentido em medalha anual ou de período que se repete; o formulário avisa.
- **Quais medalhas entram:** as da Operax e as da própria empresa. A empresa não enxerga as de outra empresa.
- **Sem ciclo:** A não pode depender de B se B depende de A (direta ou indiretamente). O backend recusa ao salvar,
  dizendo qual medalha fecha o círculo.
- **Medalha escondida ou arquivada:** se a empresa esconde uma medalha da Operax que outra medalha exige, o portal avisa
  antes ("A medalha Peregrino depende desta"). Medalha exigida não pode ser apagada, só arquivada; as já ganhas continuam
  contando.
- **Em cascata:** ganhar uma medalha confere na hora as que dependem dela, que podem liberar outras, até parar.
- **No app:** o detalhe mostra as medalhas exigidas com o progresso de cada uma ("Corrida de Natal 2 de 5") e um toque
  abre cada uma delas.

## Evento com check-in

A empresa cria a conquista do tipo `event_checkin` e escolhe um evento do módulo **Eventos**. O aluno se
inscreve no evento e, no dia, faz o **check-in pela Operax**: lendo o QR do evento no app, ou a recepção
marca a presença no portal. Com o check-in, a conquista sai na hora, com o prêmio (por exemplo, uma
consultoria online).

No backend, a inscrição (`event_registrations`) ganha `checked_in_at` e `checked_in_by` (`qr` ou `staff`).

## Catálogo da Operax no lançamento

**Datas do ano (renovam todo ano)**

- Primeiro treino do ano: treinar em 1º de janeiro
- Janeiro em dia: 12 treinos em janeiro
- Corrida de Natal: 25 km entre 1 e 25 de dezembro
- Fecha o ano: treinar em 31 de dezembro

**Israel e eventos bíblicos**

- Muralhas de Jericó (Js 6): 7 dias seguidos treinando
- Davi e o gigante (1Sm 17): bater um recorde pessoal
- Caminho de Emaús (Lc 24): 11 km numa única atividade
- Monte Sinai (Êx 19): 2.285 m de subida acumulada
- Muralha de Neemias (Ne 6:15): 52 treinos
- 40 dias no deserto (Mt 4): treinar em 40 dias diferentes dentro de 60 dias
- Rio Jordão: 251 km no ano (o comprimento do rio)
- Pentecostes (At 2): 50 dias de treino entre a Páscoa e Pentecostes (renova todo ano, com a data da Páscoa)
- As 12 tribos: treinar ao menos 8 vezes em cada um dos 12 meses do ano

Cada uma com descrição curta contando a passagem e a referência bíblica.

## Como o progresso é calculado

- O backend calcula, no `GET /api/public/portal/fitness/achievements`, o progresso de cada conquista
  publicada e visível para o aluno, a partir dos treinos, recordes, metas semanais e check-ins. As que dependem de
  outras são calculadas por último, na ordem das dependências.
- Ao passar da meta, grava o prêmio em `fitness_achievement_awards` (aluno, conquista, **ciclo**: `once`
  ou o ano, data, situação do prêmio). O ciclo é o que permite ganhar a anual de novo no ano seguinte.
- Salvar um treino ou um check-in também confere as conquistas e manda push "Você ganhou…".

## Tabelas

- `fitness_achievements`: `tenant_id` (nulo = Operax), nome, descrição, como_ganhar, nível, cor_pin,
  ícone (`{kind: 'preset', name}` ou `{kind: 'upload', url}`), regra (`{type, target, sport?, event_id?, date?}`;
  para `achievements`: `{type: 'achievements', all: [{ids: [...], need: 'all' | número, times: número}]}`),
  janela (`{kind: 'always'|'range'|'annual', from, to}`), prêmio, xp, situação, ordem.
- `fitness_achievement_visibility`: empresa que escondeu uma conquista da Operax.
- `fitness_achievement_awards`: único por (aluno, conquista, ciclo); situação do prêmio `none|pending|delivered`.

## Telas

- **Portal (empresa):** Fitness › Conquistas: lista com filtros (minhas, da Operax, sazonais), formulário com
  prévia ao vivo do pin (nível → cor, cor própria, ícone ou upload), e a aba "Prêmios a entregar".
- **Painel da Operax:** o mesmo formulário, gravando com `tenant_id` nulo.
- **App:** a tela de conquistas passa a ler da API; pin na cor do nível ou na cor própria, ícone da
  biblioteca ou o enviado; o detalhe mostra descrição, como ganhar, progresso, prêmio e "Volta todo ano em
  1/12". Seção "Desta temporada" no topo quando há uma sazonal aberta.

## Fora desta versão

Ranking entre alunos, conquistas em equipe e regras com OU entre condições ficam para depois (as condições de medalha
já se combinam com E, e "quaisquer N de uma lista" cobre o caso mais comum de OU).
