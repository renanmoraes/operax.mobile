# Saúde do celular: Apple Saúde e Health Connect (Galaxy)

O app lê os treinos que o próprio celular guarda:

- **iPhone:** app Saúde (HealthKit). Entra tudo o que o Apple Watch e os apps de treino gravam lá.
- **Android:** Health Connect. Nos Galaxy, o Samsung Health envia para o Health Connect quando a pessoa liga em
  *Samsung Health › Ajustes › Health Connect*. Google Fit, Garmin Connect, Strava, Zepp e outros também gravam nele.

Assim um caminho só cobre Galaxy e os outros Android. O SDK próprio da Samsung (Samsung Health Data SDK) exige
parceria aprovada e não é necessário enquanto o Health Connect resolver.

## O que o app faz hoje

| Parte | Onde |
| --- | --- |
| Conversão dos treinos (pura, testada) | `src/features/fitness/health/mapWorkouts.ts` |
| Acesso nativo (carrega as bibliotecas só na hora) | `src/features/fitness/health/healthStore.ts` |
| Estado e ações (conectar, sincronizar, desconectar) | `src/features/fitness/health/useHealth.ts` |
| Cartão na tela *Relógios e apps* | `src/features/fitness/health/HealthCard.tsx` |

- Só **leitura**: tipo de treino, duração, distância, calorias e batimentos dos últimos 30 dias. Nada é escrito.
- A permissão é explicada no cartão antes da janela do sistema.
- Os textos de permissão ficam no `app.json` (`NSHealthShareUsageDescription` e as permissões
  `android.permission.health.READ_*`).
- No iPhone a Apple não revela se a leitura foi negada; uma leitura vazia é o sinal.

## O que ainda falta

1. **Build próprio do app.** HealthKit e Health Connect não funcionam no Expo Go. É preciso um build de
   desenvolvimento ou de teste (EAS). No iPhone isso exige a conta paga do Apple Developer Program e o
   recurso HealthKit ligado no identificador do app (o plugin já pede o entitlement).
2. **Envio ao backend.** Hoje os treinos lidos ficam só no aparelho. Proposta de rota no portal do cliente:

```http
POST /api/public/portal/fitness/health/import
Authorization: Bearer <token do cliente>
Content-Type: application/json

{
  "source": "apple_health" | "health_connect",
  "workouts": [
    {
      "external_id": "A1B2...",          // id na origem; o backend ignora repetidos (source + external_id)
      "sport": "Corrida",
      "started_at": "2026-11-14T08:00:00.000Z",
      "duration_seconds": 1860,
      "distance_meters": 5120,           // ou null
      "energy_kcal": 410,                // ou null
      "avg_hr": 152,                     // ou null
      "device": "Apple Watch",           // ou null
      "origin": "Samsung Health"         // só Health Connect, opcional
    }
  ]
}
```

Resposta esperada: `{ "imported": 3, "matched": 2 }`, no mesmo formato do `sync` dos relógios
(`/api/public/portal/fitness/connections/:provider/sync`). O backend casa cada treino com a ficha do dia,
como já faz com Garmin e Strava, e os importados aparecem em *Últimos importados* com a origem.

3. **Leitura em segundo plano** (opcional, depois): o plugin do HealthKit foi configurado com
   `background: false`. Ligar só quando houver o envio automático ao backend.

## Marca

- Apple: chamar de "app Saúde" ou "Saúde do iPhone". O selo **Works with Apple Health** só pode ser usado
  depois que a integração estiver publicada, e o logo da Apple nunca sozinho.
- Health Connect: usar o nome "Health Connect"; Samsung Health aparece só como origem do dado.
