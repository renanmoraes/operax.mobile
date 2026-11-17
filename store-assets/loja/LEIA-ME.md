# Material de loja — Operax (pt-BR)

Tudo aqui foi gerado com o editor em `store-assets/screenshots-editor/` (skill `app-store-screenshots`) a partir de
capturas reais do app em modo demonstração (`store-assets/raw/`). Só a interface real do app aparece nas telas.
Os selos flutuantes repetem números que estão na própria tela.

## Para enviar às lojas: só o essencial (17/11/2026)

Use a pasta `envio/`. São 6 imagens por tamanho, só o que mais pesa: **atendimento e PDV para a equipe, treino para o cliente**.
Ficaram de fora agenda, avisos, transferência, o mosaico "E muito mais" e os slides de cadastro de produto (continuam nas outras pastas, sem uso).

| # | Título | Público |
|---|--------|---------|
| 01 | Atendimento no bolso | Equipe |
| 02 | Resumo e resposta prontos | Equipe |
| 03 | Pese por valor. Venda no kg | Equipe (PDV) |
| 04 | Receba e dê o troco | Equipe (PDV) |
| 05 | Aceite a vaga na hora | Cliente (fitness) |
| 06 | Treino com cronômetro | Cliente (fitness) |

| Pasta | Onde sobe |
|-------|-----------|
| `envio/ios/iphone-6.9/01..06.png` | App Store, iPhone 6,9" |
| `envio/ios/iphone-6.5/01..06.png` | App Store, iPhone 6,5" |
| `envio/android/phone/01..06.png` | Google Play, celular |
| `envio/feature-graphic-1024x500.png` | Google Play, imagem de destaque |

Cada loja aceita menos imagens do que o editor gera, então sobe a ordem de 01 a 06 e apaga o resto do que já estiver lá.

## Arquivos

| Pasta | Conteúdo | Tamanho |
|-------|----------|---------|
| `ios/iphone-6.9/01..10.png` | App Store, iPhone 6,9" (obrigatório) | 1320×2868 |
| `ios/iphone-6.5/01..10.png` | App Store, iPhone 6,5" (mesmos slides) | 1284×2778 |
| `android/phone/01..08.png` | Google Play, celular (limite de 8) | 1080×1920 |
| `android/feature-graphic/feature-graphic-1024x500.png` | Google Play, imagem de destaque | 1024×500 |
| `gifs/atendimento.gif` / `.mp4` | Fila, conversa, sugestão e resumo da IA (~11 s) | 600×1150 |
| `gifs/pdv.gif` / `.mp4` | Queijo por valor (R$ para gramas), receber com troco, venda registrada (~11 s) | 600×1150 |
| `gifs/treino.gif` / `.mp4` | Ficha, sessão com séries e descanso cronometrado (~11 s) | 600×1150 |

Todos os PNG são RGB, sem transparência. Os GIFs têm menos de 3 MB; os MP4 são H.264 (yuv420p).

## Ordem de envio e títulos

### App Store (iPhone 6,9" e 6,5"), 10 imagens

| # | Título | Tela |
|---|--------|------|
| 01 | Atendimento *no bolso.* | Fila e atendimentos |
| 02 | Resumo e resposta *prontos.* | Conversa com sugestões e resumo da IA |
| 03 | Transfira para quem *está online.* | Folha de transferir com a presença da equipe |
| 04 | Pese por *valor.* Venda no kg. | PDV, teclado de pesagem |
| 05 | Receba e dê o *troco.* | PDV, receber com troco e venda registrada |
| 06 | O dia todo em *uma linha.* | Agenda em linha do tempo (slide claro) |
| 07 | Avisos que chegam *a tempo.* | Central de avisos |
| 08 | Aceite a vaga *na hora.* | Cliente, aula em grupo (slide claro) |
| 09 | Treino com *cronômetro.* | Ficha e sessão de treino |
| 10 | E muito *mais.* | Mosaico: treino livre com GPS, evolução, conquistas, chat da equipe |

### Google Play (celular), 8 imagens

01 Atendimento no bolso · 02 Resumo e resposta prontos · 03 Pese por valor · 04 Receba e dê o troco ·
05 O dia todo em uma linha · 06 Treino com cronômetro · 07 Aceite a vaga na hora · 08 E muito mais.
(Os títulos são os mesmos da tabela acima.) Depois, o feature graphic.

## Como regerar

```bash
cd store-assets/screenshots-editor
npm install
npm run dev            # abre em http://localhost:3000, deck em app-store-screenshots.json
```

No editor, escolha iOS/iPhone ou Android/Android Phone ou Feature Graphic e use **Export bundle**.
A palavra de destaque do título é marcada com `*asteriscos*` (ela aparece em ciano ou cobalto no export).
Os selos (`public/chips/`) e o mosaico são imagens geradas de HTML; as capturas ficam em `public/screenshots/`.

## Pontos fracos conhecidos

- As capturas cruas do iOS ganharam uma faixa de status (9:41, sinal, Wi-Fi e bateria, 162 px) composta no topo, porque o web não tem barra de status e a ilha do bezel cobria o cabeçalho.
- A conversa da demo tem uma foto sem imagem (placeholder cinza); ela foi escondida na captura. Não há foto real na demo.
- O treino livre com GPS foi gravado no web com posições simuladas pelo navegador (o app de verdade, mapa em grade do web). No celular o mapa aparece com ruas.
- A tela da agenda mostra a hora atual da captura; o horário "Em N min" muda conforme o relógio.
- O GIF de treino mostra um pequeno ícone de narração no topo (o aviso de voz foi escondido).

## Novidade: cadastro de produto pelo celular (17/11/2026)

Slides novos para a atualização, em `novidades-cadastro-produto/`. Gerados no mesmo editor (`screenshots-editor/`, slides 11 a 13 do deck iPhone e 09 a 11 do deck Android) a partir de capturas reais do app em modo demonstração (`raw/ios/staff-10a..10c-*.png`, `raw/android/staff-10a..10c-*.png`).

| Pasta | Conteúdo | Tamanho |
|-------|----------|---------|
| `novidades-cadastro-produto/ios/iphone-6.9/11..13.png` | App Store, iPhone 6,9" | 1320×2868 |
| `novidades-cadastro-produto/ios/iphone-6.5/11..13.png` | App Store, iPhone 6,5" | 1284×2778 |
| `novidades-cadastro-produto/android/phone/09..11.png` | Google Play, celular | 1080×1920 |

| # | Título | Tela |
|---|--------|------|
| 11 (Android 09) | Cadastre produto *pelo celular.* | Novo produto: foto de capa, nome, marca, descrição e SKU |
| 12 (Android 10) | Leia o código *com a câmera.* | Código de barras com "Ler com a câmera", preço e unidade de venda |
| 13 (Android 11) | Tamanho e cor *em segundos.* | Variações geradas com preço e saldo de cada uma |

Limites das lojas: a App Store aceita 10 imagens por tamanho e o Google Play 8 no celular, e os decks atuais já estão cheios. Para subir esta atualização é preciso trocar slides existentes (sugestão: tirar "Avisos que chegam a tempo" e o mosaico "E muito mais" no iPhone, e dois dos mais antigos no Android). A foto do produto (pacote de café) e os dados da tela são de exemplo.
