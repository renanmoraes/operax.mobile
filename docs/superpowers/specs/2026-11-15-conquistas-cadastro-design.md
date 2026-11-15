# Conquistas com cadastro (Operax + academia), objetivos, edições anuais e XP

Data: 15/11/2026. Status: aprovado com as decisões abaixo.

## Decisões do dono (15/11/2026)

- **XP**: as conquistas dão XP, e cada treino feito também dá 10 XP.
- **Check-in em evento**: valem as duas formas. O aluno lê o QR do evento pelo app, ou a equipe lê o QR do ingresso do aluno no app da equipe. A equipe também pode marcar na mão.
- **Consultoria online**: o aluno online ganha as mesmas conquistas pelos treinos que registra, e também existem conquistas próprias da consultoria (`online_checkins`).
- **Entrega**: backend, portal, app e eventos num release só.

## Hoje

- As 12 conquistas do app estão **fixas no código** (`app/cliente/conquistas.tsx`) e são calculadas no celular a partir do resumo, do histórico e dos check-ins.
- O backend não tem conquista nem XP.
- Já existe no backend o molde "catálogo da Operax + catálogo da academia": `fitness_platform_exercises` (global) e `fitness_exercises` (por tenant). As conquistas seguem o mesmo molde.
- Eventos (`src/apps/events`) têm inscrição (`event_registrations`), mas **não têm check-in**.
- O aluno tem `attendance_mode` `presencial` ou `online` (consultoria online).

## O cenário

1. **A Operax lança conquistas** para todas as academias com Fitness: as gerais (primeiro treino, 100 treinos, 30 dias seguidos), as de datas (Natal, Ano Novo, Páscoa) e as temáticas de Israel e da Bíblia.
2. **A academia cadastra as dela** no portal, por exemplo "foi na Corrida da Academia e fez check-in pela Operax".
3. **O app recebe as duas listas juntas.** Cada conquista diz o objetivo, e o aluno ganha quando cumpre esse objetivo.
4. Algumas conquistas são **anuais e se renovam**. Natal 2026 e Natal 2027 são edições diferentes, e o aluno ganha um pin por ano.
5. Cada conquista dá **XP**. O XP sobe o aluno de nível, e cada nível pede mais XP que o anterior.

## Cadastro no portal (Fitness › Conquistas)

| Campo | Detalhe |
| --- | --- |
| Nome | Até 60 caracteres. |
| Descrição | O que é a conquista, a história dela (por exemplo "Josué deu 7 voltas em Jericó…"). |
| Como ganhar | Texto curto mostrado ao aluno ("Treine 7 dias seguidos"). É preenchido sozinho a partir do objetivo e pode ser editado. |
| Objetivo | Tipo + meta (ver abaixo). É o que o sistema confere. |
| Nível | 1 a 5. Define a cor padrão do pin e o XP padrão. |
| Ícone | Da biblioteca da Operax, ou enviado pela academia (PNG ou SVG quadrado, até 512 KB, pelo `media_files`). |
| Cor do pin | Vem do nível e pode ser trocada por qualquer cor. |
| XP | "Pelo nível" (padrão) ou um valor manual. |
| Período | Sempre, de uma data a outra, ou **anual** (ver Edições). |
| Quem pode ganhar | Todos, só presencial, só consultoria online, ou planos escolhidos. |
| Secreta | Se marcada, só aparece depois de ganha. |
| Situação | Rascunho, ativa ou arquivada. Uma conquista arquivada some da lista de quem não ganhou e continua no perfil de quem ganhou. |

Uma conquista da Operax aparece no portal da academia **só para ler**. A academia pode **desligar** a conquista para os alunos dela, mas não pode editá-la.

### Níveis (cor e XP padrão)

| Nível | Nome | Cor padrão | XP padrão |
| --- | --- | --- | --- |
| 1 | Bronze | `#B87333` | 50 |
| 2 | Prata | `#8E9AAB` | 100 |
| 3 | Ouro | `#D4A017` | 200 |
| 4 | Esmeralda | `#1F9D6B` | 400 |
| 5 | Diamante | `#3D6BFF` | 800 |

### Tipos de objetivo (tudo com dado que o Operax já tem)

| Tipo | Meta | Exemplo |
| --- | --- | --- |
| `sessions` | N treinos no período | 12 treinos de 1 a 25/12 |
| `streak` | N dias seguidos com treino | 7 dias (Jericó) |
| `weekly_goal` | N semanas batendo a meta semanal | 4 semanas |
| `distance_total` | km somados (corrida, caminhada, bike), opcionalmente por esporte | 40 km em 8 dias |
| `distance_single` | km numa atividade só | 11 km (Emaús) |
| `elevation_total` | metros de subida somados | 2.285 m (Sinai) |
| `duration_total` | minutos somados | 600 min |
| `early` | N treinos antes de uma hora | 5 antes das 7h |
| `records` | N recordes pessoais | 1 recorde (Davi e Golias) |
| `class_attendance` | N aulas com presença confirmada | 10 aulas |
| `event_checkin` | Check-in num evento escolhido | Corrida da Academia |
| `online_checkins` | N check-ins semanais da consultoria online | 8 semanas |
| `checkin_photo` | Mandou foto de evolução | 1 |
| `watch_connected` | Conectou relógio ou app | 1 |
| `manual` | O professor concede | Destaque do mês |

O que conta como treino é o mesmo que já conta hoje: treino da ficha salvo no app, atividade gravada pelo GPS e atividade importada do relógio. Assim o aluno da **consultoria online** ganha igual ao presencial, sem precisar estar na academia.

### Edições (conquistas anuais)

- **Data fixa**: dia e mês de início e de fim, repetidos todo ano. Exemplos: Natal de 1 a 25/12, Ano Novo de 1 a 7/1.
- **Data que muda por ano**: Páscoa, Pessach, Chanucá e Sucot. A Operax cadastra as datas de cada ano numa lista de edições (`{ano, início, fim}`), e o sistema avisa quando a edição do ano seguinte ainda não foi cadastrada.
- O pin ganho leva o ano ("Natal 2026"). Na edição seguinte o objetivo começa do zero, e o aluno pode ganhar de novo.
- Fora do período, a conquista aparece como "Volta em 1/12". Durante o período, aparece em destaque na home com a contagem regressiva.

## XP e nível do aluno

- O XP é a soma das conquistas ganhas mais **10 XP por treino feito** (treino da ficha, atividade gravada ou importada; no máximo 3 por dia contam XP, para não premiar treino picado).
- O XP total para chegar ao nível L é `100 × (L − 1)^1,6`, arredondado de 10 em 10. A distância até o próximo nível cresce a cada nível:

| Nível | XP total | Até o próximo |
| --- | --- | --- |
| 2 | 100 | 200 |
| 3 | 300 | 280 |
| 5 | 920 | 390 |
| 10 | 3.360 | 620 |
| 20 | 11.120 | 950 |

- A curva fica num lugar só, no backend (`levelFor(xp)`), e o app só mostra o que o backend devolve.

## Catálogo inicial da Operax

**Gerais** (migram as 12 de hoje): primeiro treino, semana perfeita, 10, 50 e 100 treinos, recorde, madrugador, 7 e 30 dias seguidos, foto de evolução, relógio conectado, 20 treinos no mês.

**Datas**

- Natal: "12 dias de Natal", 12 treinos de 1 a 25/12.
- Ano Novo: "Primeiro do ano", treinar em 1/1. "Largada do ano", 3 treinos na primeira semana.
- Páscoa: treinar no fim de semana da Páscoa.

**Israel e Bíblia** (descrição com a passagem, sem pregação)

| Conquista | Objetivo | Referência |
| --- | --- | --- |
| Muralhas de Jericó | 7 dias seguidos com treino | Josué 6 |
| Davi e Golias | Bater um recorde pessoal | 1 Samuel 17 |
| Caminho de Emaús | 11 km numa atividade (60 estádios) | Lucas 24 |
| Monte Sinai | 2.285 m de subida somados | Êxodo 19 |
| Muro de Neemias | 52 treinos em 52 dias | Neemias 6.15 |
| 40 dias no deserto | 30 treinos em 40 dias | Mateus 4 |
| Travessia do Mar Vermelho | 40 km somados durante o Pessach (anual) | Êxodo 14 |
| Luzes de Chanucá | 8 dias seguidos durante Chanucá (anual) | Chanucá |
| Sucot | 7 treinos durante Sucot (anual) | Levítico 23 |

Os ícones dessas conquistas entram na biblioteca da Operax como desenhos próprios: menorá, muralha, funda, montanha, tenda, ondas, estrada.

## Check-in em evento

O evento passa a ter "dá conquista": a academia escolhe uma conquista `event_checkin` no cadastro do evento.

Check-in, três formas (todas gravam `checked_in_at` e `checkin_method` na inscrição, e a conquista sai na hora):

1. **Aluno lê o QR do evento**: um QR assinado que muda a cada 2 minutos, mostrado no app da equipe ou num totem (página do portal em tela cheia). O aluno inscrito lê pelo app. A leitura só vale entre 1 h antes do início e o fim do evento.
2. **Equipe lê o QR do aluno**: o ingresso no app do aluno mostra um QR assinado com a inscrição, e a equipe lê no app da equipe (Eventos › Check-in).
3. **Manual**: a equipe procura o nome na lista de inscritos e marca.

## Como o backend confere

- Novas tabelas:
  - `fitness_achievements`: da academia, com `tenant_id`.
  - `fitness_platform_achievements`: global.
  - `fitness_achievement_editions`: datas por ano.
  - `fitness_achievement_settings`: academia desligando uma conquista da Operax.
  - `fitness_achievement_awards`.
- `awards` tem chave única `(tenant_id, contact_id, achievement_id, edition)`. A edição é o ano ou `0` para as que não se repetem. Conceder duas vezes não duplica.
- Quando a conquista é conferida:
  - na hora, depois de cada treino salvo, atividade importada, presença em aula, check-in em evento e check-in da consultoria;
  - num job diário, para virada de edição e conquistas de período.
- O app recebe:
  - `GET /api/public/portal/fitness/achievements`: lista unificada com progresso (`current/target`), período, edição, pin (ícone, cor, nível), XP e se foi ganha e quando.
  - `GET .../achievements/profile`: XP, nível e quanto falta para o próximo.
- O aluno que ganha recebe um push ("Você ganhou Muralhas de Jericó, +100 XP").

## No app

- A tela de Conquistas troca a lista fixa pela da API. O pin usa o ícone (da biblioteca ou a imagem enviada) com a cor do pin, e o nível aparece no anel.
- No topo ficam o nível do aluno, a barra de XP e "faltam X XP para o nível N".
- Uma faixa "Agora" mostra as conquistas de período ativo (Natal, Pessach), com contagem regressiva.
- No detalhe da conquista: descrição, como ganhar, barra de progresso, período e o ano das edições já ganhas.
- No modo demo, o mesmo formato vem de dados de exemplo, como em Relógios.

## Ordem sugerida

1. Backend: tabelas, catálogo da Operax, conferência de treino, distância, sequência e recorde, XP e nível, rota do portal do aluno.
2. App: tela nova lendo a API, nível e XP no topo.
3. Portal da academia: cadastro, biblioteca de ícones e upload, desligar as da Operax.
4. Eventos: QR de check-in, check-in manual e conquista `event_checkin`.
5. Edições móveis: Páscoa, Pessach, Chanucá e Sucot cadastradas para 2027 e 2028.
