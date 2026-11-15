# Material de loja — Operax (pt-BR)

Tudo aqui foi gerado com o editor em `store-assets/screenshots-editor/` (skill `app-store-screenshots`) a partir de
capturas reais do app em modo demonstração (`store-assets/raw/`). Só a interface real do app aparece nas telas.
Os selos flutuantes repetem números que estão na própria tela.

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
