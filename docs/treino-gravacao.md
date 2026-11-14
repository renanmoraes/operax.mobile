# Gravação de treino no app (padrão Strava)

Quem vê: aluno com o Fitness liberado pela empresa (`capabilities.training`) e cadastrado como aluno. Sem isso, a tela Treinar explica que o recurso depende do plano de treino.

## Fluxo

1. **Treino › Treinar agora** abre o hub: primeiro o treino do plano para hoje, abaixo o treino livre (Corrida, Caminhada, Pedalada, Musculação, Natação, Outro treino).
2. **Gravação** (`src/features/fitness/Recorder.tsx`): mapa com o caminho e a posição, cronômetro grande, ritmo médio (ou velocidade), distância, ritmo atual, subida, altitude e parciais por km no tempo em movimento. Pausa → **Continuar** ou **Fim**. Botão **Travar** para guardar o celular no bolso. Ajustes: tela sempre acesa, mostrar mapa, velocidade em vez de ritmo (ficam salvos no aparelho).
3. **Salvar treino**: resumo com o caminho, nome (treino livre), "Como foi o treino?" (Ótimo, Bom, Normal, Difícil, Pesado demais), esforço de 1 a 10 e anotações para o professor. Descartar pede confirmação.
4. **Histórico**: cada treino abre o detalhe com o caminho, os números, o "como foi" e as parciais.

Esportes sem GPS (musculação, natação, outro) gravam só o tempo e o "como foi".

## Para onde vai

| Origem | Rota | Fica |
|---|---|---|
| Parte da ficha (corrida/bike) | `POST /api/public/portal/fitness/results` com `recording.track` | Resultado do treino do dia + sessão "Celular" com a trilha |
| Treino livre | `POST /api/public/portal/fitness/activities` | Atividade "Celular" no histórico, sem resultado de ficha; o `summary_json` guarda esporte real, título, sensação, esforço e anotações |

A trilha leva `t` (s desde a largada), `dist` (m) e, com GPS, `lat`, `lon` e `alt` (até 1500 pontos). O backend guarda nas amostras da atividade, e o detalhe do histórico (`history/entry/detail`) devolve o `route` para o mapa, para o aluno e para o professor.

## Sem internet e sem bateria

- Sem conexão ao salvar: vai para a fila do aparelho e sobe sozinho quando a internet volta (mesma chave, não duplica).
- O treino em andamento é salvo como rascunho no banco local a cada ~10 s e a cada pausa. Se o Android fechar o app no meio da corrida, ao reabrir a gravação aparece **Treino não salvo · Retomar**.

## Mapa no Android

No iPhone o mapa é o Apple Maps, sem configuração. No Android o Google Maps exige chave própria do app: defina `GOOGLE_MAPS_ANDROID_API_KEY` no ambiente do build (EAS: `eas env:create`), lida em `app.config.js`. **Sem a chave, o app desenha o caminho numa grade, sem o mapa por baixo** (o Google mostraria um quadro vazio). No Expo Go do Android também vale o desenho.

## Limites conhecidos

- GPS só com o app aberto (tela acesa ou travada pelo botão Travar). Gravar com a tela do celular bloqueada precisa de localização em segundo plano, que só funciona no app gerado pelo EAS.
- O painel web do professor ainda não desenha o mapa do caminho (o dado já vem no detalhe da atividade).
