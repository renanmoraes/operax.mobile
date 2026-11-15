# Compartilhar atividade (estilo Strava) e treino concluído — Operax Mobile

**Data:** 2026-11-15
**Status:** desenho aprovado em conversa; spec aguardando revisão do dono
**Stack:** Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript
**Referência:** fluxo "Compartilhar atividade" do Strava (vídeo enviado pelo dono em 2026-11-15)

---

## 1. Problema

- O fim do treino de academia (`app/cliente/treino/concluido.tsx`) é uma rolagem longa: resumo, recordes, barras de volume,
  "Como foi o treino?" com esforço e comentário, e um cartão de compartilhar pequeno no fim.
- Compartilhar só manda **texto** pelo `Share` do sistema, e fica **travado** até a pessoa responder "Como foi".
- Ao rolar, o conteúdo passa por baixo da barra de status (cabeçalho sem área segura).
- "1 novo recorde" / "N novos recordes" está fixo em português no código (fere a regra de i18n do projeto).
- O treino com GPS (`src/features/fitness/Recorder.tsx`) e o histórico não têm compartilhar nenhum.

O Strava resolve isso com uma tela de modelos prontos (vários com **fundo transparente**, contendo o traçado da rota e os
números) e destinos diretos — com destaque para o **Story do Instagram com o adesivo por cima da foto**.

## 2. Objetivo

1. Uma tela única **"Compartilhar atividade"**, aberta de três lugares: fim do treino de academia, fim do treino com GPS e
   detalhe de um item do histórico.
2. Uma grade de modelos gerados com os dados reais da atividade; os que fazem sentido aparecem conforme o tipo
   (rota e parciais só com GPS; volume e recordes só na academia).
3. Destinos: **Story do Instagram com adesivo**, WhatsApp, **Copiar** (imagem na área de transferência, para colar onde
   quiser), Salvar na galeria e Mais (menu do sistema).
4. Treino concluído redesenhado: mais curto, compartilhar sempre disponível, sem conteúdo sob a barra de status, textos
   traduzidos.

**Fora de escopo:**
- Feed social, curtidas, comentários ou perfil público (o Strava tem; o Operax não).
- Link público da atividade ("Copiar link") — exigiria rota pública no backend.
- Vídeo/animação do percurso.
- Qualquer mudança no backend.

## 3. Modelo de dados: `ShareActivity`

A tela de compartilhar recebe só este objeto; quem abre a tela é quem o monta. A tela não sabe a origem.

```ts
type ShareActivity = {
  kind: 'strength' | 'gps';
  title: string;            // "Treino A · Peito", "Corrida"
  company: string;          // nome da academia ativa; "Operax" se não houver
  date: string;             // ISO
  seconds: number;
  strength?: {
    volumeKg: number | null;      // null quando a origem não tem volume (histórico sem gravação)
    setsDone: number | null;
    setsTotal: number | null;
    records: { name: string; kg: number }[];          // vazio quando não houver
    volumeHistory: { label: string; kg: number }[];   // últimas vezes + hoje (o último é hoje); vazio quando não houver
  };
  gps?: {
    sport: string;                // id de `src/features/fitness/sports.ts` ou `modality` do histórico
    distanceM: number;
    rateLabel: string;            // o principal do esporte: "5:19 /km" (formatPace) ou "28,4 km/h", já formatado pelo idioma
    paceLabel: string | null;     // ritmo médio "/km", sempre que houver distância
    speedLabel: string | null;    // velocidade média "km/h", sempre que houver distância
    avgHr: number | null;         // FC média (relógio/integração); null quando não houver
    maxHr: number | null;
    elevationGainM: number | null;
    route: [number, number][];    // vazio quando não houver
    splits: { index: number; seconds: number }[];     // vazio quando não houver
  };
};
```

Regra de tipo: com rota ou distância > 0 é `gps`; senão é `strength`. Listas ausentes viram `[]` e números ausentes
viram `null`, nunca `undefined`, para os `supports()` testarem só comprimento e `null`.

`company` vem do mesmo lugar que a tela de concluído usa hoje: `useCompanies()` + `useActiveCompanySlug()`, com
"Operax" quando não houver empresa.

Montadores puros (testáveis), em `src/features/share/fromSources.ts`:
- `fromStrengthSession(workout, session, history, loadHistory, company)` — usa `flattenWorkout`, `personalRecords`,
  `totalSets` e as barras de volume que `concluido.tsx` já calcula.
- `fromRecording(sport, run, seconds, route, company)` — usa os dados do resumo do `Recorder` (`run.distanceM`,
  `run.elevationGainM`, parciais do `runTracker`, `formatPace`/km/h como o resumo já faz).
- `fromHistoryDetail(entry: FitnessHistoryEntry, detail: ActivityDetail | null, company)`:

  | Campo | Origem |
  |---|---|
  | `title`, `date` | `entry.title`, `entry.started_at ?? entry.date` |
  | `seconds` | `detail?.seconds ?? entry.duration_seconds ?? 0` |
  | `gps.sport` | `detail?.sport ?? entry.modality ?? ''` |
  | `gps.distanceM` | `entry.distance_meters ?? 0` |
  | `gps.rateLabel` | km/h quando `detail?.rate_unit === 'kmh'` ou `entry.modality === 'bike'`; senão `formatPace(seconds / km)` — mesma regra de `app/cliente/atividade/[id].tsx` |
  | `gps.paceLabel`, `gps.speedLabel` | calculados de `distanceM` e `seconds` (null sem distância) |
  | `gps.avgHr`, `gps.maxHr` | `detail?.summary.avg_hr ?? entry.avg_hr ?? null`, `detail?.summary.max_hr ?? null` |
  | `gps.elevationGainM` | `detail?.summary.elevation_gain_m ?? null` |
  | `gps.route` | `detail?.route ?? []` |
  | `gps.splits` | `detail?.splits` mapeado para `{ index, seconds }`, `[]` sem detalhe |
  | `strength.volumeKg` | `entry.volume_kg ?? null` |
  | `strength.setsDone` | `entry.sets_done ?? entry.sets ?? null` |
  | `strength.setsTotal`, `records`, `volumeHistory` | `null`, `[]`, `[]` (o histórico não traz) |

A navegação passa o objeto por um store em memória (mesmo padrão de `setFinishedSession`/`getFinishedSession` em
`sessionStore.ts`), não por parâmetro de URL — a rota pode ter centenas de pontos.

## 4. Modelos

Pasta `src/features/share/templates/`, um arquivo por modelo. Contrato:

```ts
type ShareTemplate = {
  id: string;
  label: string;                       // via i18n
  transparent: boolean;
  supports: (a: ShareActivity) => boolean;
  Render: (p: { activity: ShareActivity; photoUri?: string }) => JSX.Element; // desenha em 1080×1920
};
```

| Modelo | Fundo | Aparece quando |
|---|---|---|
| Rota | transparente | `gps` com `route.length > 1` |
| Rota + números | transparente | idem |
| Números (empilhados) | transparente | sempre |
| Linha de números | transparente | sempre |
| Parciais por km | transparente | `gps` com `splits.length >= 2` |
| Volume das últimas vezes | transparente | `strength` com `volumeHistory.length >= 2` |
| Recordes | transparente | `strength` com `records.length > 0` |
| Cartão | cor da marca | sempre |
| Mapa | opaco | `gps` com rota; mapa real com o traçado por cima (ver "Mapa" abaixo); sem mapa disponível, `RouteSketch` |
| Mapa + números | opaco | idem, com a faixa de números (distância, ritmo/velocidade, tempo, FC quando houver) |
| Foto | foto da pessoa | sempre; abre `expo-image-picker` ao tocar |

- Traçado da rota: reaproveitar a projeção do `RouteSketch` (extrair a função que transforma lat/lng em pontos do SVG
  para um módulo puro, usada pelos dois).
- Rodapé de marca em todos: nome da academia e "Operax" pequeno.
- Texto branco com contorno/sombra leve nos transparentes, para ler sobre foto clara ou escura.
- Números sempre formatados pelo idioma ativo (`formatKg`, `formatClock`, formatadores de distância/ritmo já existentes).
- **Mapa:** usa o `react-native-maps` que o app já tem (Apple Maps no iPhone, sem chave; Google Maps no Android, com
  `GOOGLE_MAPS_ANDROID_API_KEY` no build). A tela de compartilhar monta um `MapView` visível na miniatura do modelo,
  enquadrado na rota (`fitToCoordinates`) e com o traçado em `Polyline`; depois do `onMapLoaded`, chama
  `mapRef.takeSnapshot({ format: 'png', result: 'file', width: 1080, height: 1920 })` — a captura nativa do próprio mapa,
  que inclui o traçado, em vez de fotografar o `MapView` com `view-shot`. A imagem resultante vira o fundo do modelo
  Mapa no 1080×1920. Sem mapa disponível (Android sem chave, falha no carregamento em 10 s) o modelo usa `RouteSketch`.
- Os números nos modelos de GPS: distância, ritmo e/ou velocidade, tempo, subida e FC média/máxima quando existirem.
  Zonas de FC ficam fora da v1: o app não guarda FC por ponto hoje (só média/máxima vindas do relógio).
- Renderização: as miniaturas da grade são o próprio `Render` dentro de uma caixa escalada (`transform: scale`); para
  gerar a imagem, o modelo escolhido é montado num contêiner `position: absolute` fora da área visível, em 1080×1920
  com `collapsable={false}`, e é esse contêiner que vai para o `captureRef`.

## 5. Tela "Compartilhar atividade"

- Rota modal: `app/cliente/compartilhar.tsx`.
- Grade de 2 colunas com as miniaturas dos modelos suportados (xadrez atrás dos transparentes); toque seleciona (contorno
  na cor de destaque). Primeiro modelo suportado vem selecionado.
- Barra fixa embaixo com os destinos: Story, WhatsApp, Copiar, Salvar, Mais.
- Ao escolher um destino: renderiza o modelo selecionado fora da tela em 1080×1920 e captura em PNG com
  `react-native-view-shot` (`format: 'png'`, `result: 'tmpfile'`), mantendo a transparência.

### Destinos

| Destino | Como |
|---|---|
| Story | `react-native-share` → `Share.shareSingle({ social: INSTAGRAM_STORIES, appId, stickerImage, backgroundTopColor, backgroundBottomColor })`. Modelo opaco vai como `backgroundImage`. |
| WhatsApp | `react-native-share` → `social: WHATSAPP` com o PNG |
| Copiar | `expo-clipboard` → `setImageAsync(base64)` com o PNG; aviso "Imagem copiada" para colar no WhatsApp, no Story do Instagram ou em qualquer app que aceite colar imagem |
| Salvar | `expo-media-library` → `saveToLibraryAsync`, permissão pedida só nessa hora |
| Mais | `expo-sharing` → `shareAsync(uri, { mimeType: 'image/png' })` |

### Configuração

- `GOOGLE_MAPS_ANDROID_API_KEY` (secreta, fora do repositório): criar no Google Cloud (Maps SDK for Android, chave
  restrita ao pacote `digital.operax.mobile` + SHA-1 de assinatura), cadastrar no EAS (`eas env:create`) e no `.env`
  local para APK local. O `app.config.js` já lê essa variável.
- `EXPO_PUBLIC_META_APP_ID` (público): no `.env` local e nos perfis `preview`/`production` do `eas.json`; lido em
  `app.config.js` para `extra.metaAppId`.
- iOS: `LSApplicationQueriesSchemes` com `instagram-stories` e `whatsapp` (via `app.json` `ios.infoPlist`), e
  `NSPhotoLibraryAddUsageDescription` pelo plugin do `expo-media-library` (`savePhotosPermission`), em pt; hoje só existe
  `NSPhotoLibraryUsageDescription`.
- O projeto já tem `expo-dev-client` e os perfis `development`/`preview` do EAS; o APK local (`expo run:android
  --variant release`) também inclui os módulos nativos.
- Android: `<queries>` para `com.instagram.android` e `com.whatsapp` (config plugin do `react-native-share` ou plugin
  local em `plugins/`).
- Dependências novas: `react-native-view-shot`, `react-native-share`, `expo-media-library`, `expo-clipboard`. As duas
  primeiras não existem no Expo Go; a tela inteira só é testada em APK local e builds do EAS.

## 6. Treino concluído redesenhado (`app/cliente/treino/concluido.tsx`)

- Cabeçalho respeitando a área segura; título do treino, academia e horário.
- Resumo em 3 blocos (tempo, volume, séries); recordes numa faixa só (`2 recordes: Supino 62,5 kg · …`).
- Barras de volume das últimas vezes mantidas, mais baixas.
- "Como foi?" compacto: a linha de sentimentos sempre visível; esforço (0–10) e comentário num bloco recolhido
  ("Esforço e comentário"), aberto por toque.
- Rodapé fixo com dois botões: **Compartilhar** (secundário, abre a tela da seção 5 com `fromStrengthSession`) e
  **Salvar** (primário, o envio de hoje). Compartilhar não depende mais do sentimento.
- Textos de recordes passam para o i18n (pt/en/es), com plural.
- Fluxo de envio (`save()`, fila offline, chave de idempotência) **não muda**.

## 7. Outros pontos de entrada

- `Recorder.tsx`, no resumo final: botão Compartilhar ao lado de "Concluir", com `fromRecording`.
- Detalhe de uma atividade do histórico (`app/cliente/atividade/[id].tsx`, aberto pela lista em
  `app/cliente/historico.tsx`): botão Compartilhar, com `fromHistoryDetail` (seção 3). Sem gravação e sem distância vira
  `strength` com tempo, volume e séries que existirem; os modelos sem dado somem pelos `supports()`.

## 8. Erros

| Situação | Comportamento |
|---|---|
| Instagram ou WhatsApp não instalado | Abre o menu do sistema (`expo-sharing`) com o mesmo PNG |
| `EXPO_PUBLIC_META_APP_ID` ausente | Botão Story usa o menu do sistema; aviso em log de dev |
| Permissão de galeria negada | Diálogo explicando, com atalho para os ajustes do app |
| Falha na captura do PNG | Diálogo de erro (`showDialog`) + `reportError` da telemetria existente |
| Pessoa cancela no Instagram/menu | Nada acontece (não é erro) |

## 9. Testes

- Unitários (Jest):
  - `fromStrengthSession`, `fromRecording`, `fromHistoryDetail`: casos com e sem recordes, rota, parciais, histórico.
  - `supports()` de cada modelo para os tipos de atividade.
  - Projeção da rota (módulo extraído do `RouteSketch`): caixa, proporção, rota de 1 ponto.
- Manual no APK release (emulador e aparelho): os 3 pontos de entrada × 5 destinos; transparência conferida colando o
  adesivo no Story (pelo botão Story e pelo Copiar); pt, en e es.
- Gate de sempre antes do push: `npm run lint`, `npx tsc --noEmit --noUnusedLocals`, `npx jest`.

## 10. Riscos

- Sem a chave do Google no build, o Android não mostra mapa (nem na gravação nem no compartilhar), só o traçado. A chave
  é pré-requisito para a experiência completa no Android.
- `takeSnapshot` precisa do mapa carregado; se o mapa não carregar (sem internet), cai no `RouteSketch`.

- Colar imagem depende do app de destino: WhatsApp e o Story do Instagram aceitam; no Android alguns teclados/apps não
  oferecem "colar imagem". O botão Story e o Mais continuam como caminho garantido.

- A API de Stories exige que o App ID seja de um app da Meta válido; se o Instagram recusar, o fallback é o menu do
  sistema.
- Fontes personalizadas precisam estar carregadas antes da captura (a tela só libera os destinos depois do primeiro
  layout do modelo).
