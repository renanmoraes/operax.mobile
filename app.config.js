/**
 * Config dinâmica por cima do app.json: o mapa do Google no Android.
 *
 * - Build: `GOOGLE_MAPS_ANDROID_API_KEY` entra no manifesto do app e liga o mapa (EAS: `eas env:create`).
 * - Atualização pelo ar (`eas update`): a chave é segredo no EAS e o comando não a lê, mas o app instalado já a
 *   traz dentro. O mapa continua ligado se a atualização for publicada com `OPERAX_ANDROID_MAPS=1`. Sem isso o
 *   pacote publicado perde o aviso `androidMaps` e o app Android volta a desenhar só o traço, sem mapa (parece um
 *   mapa em branco), mesmo com o instalador certo.
 * Sem a chave e sem o aviso, o app Android desenha o caminho do treino sem o mapa por baixo (o iPhone usa o Apple Maps).
 */
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const mapsReady = !!key || process.env.OPERAX_ANDROID_MAPS === '1';
  if (!mapsReady) return config;
  return {
    ...config,
    ...(key ? { android: { ...config.android, config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: key } } } } : {}),
    // A chave some da config pública (Constants); o app só precisa saber que o mapa do Google está liberado.
    extra: { ...config.extra, androidMaps: true },
  };
};
