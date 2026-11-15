/**
 * Config dinâmica por cima do app.json. Hoje só a chave do Google Maps do Android, que não fica no
 * repositório: defina GOOGLE_MAPS_ANDROID_API_KEY no ambiente do build (EAS: `eas env:create`).
 * Sem a chave, o app Android desenha o caminho do treino sem o mapa por baixo (o iPhone usa o Apple Maps).
 */
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!key) return config;
  return {
    ...config,
    android: { ...config.android, config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: key } } },
    // A chave some da config pública (Constants); o app só precisa saber que o mapa do Google está liberado.
    extra: { ...config.extra, androidMaps: true },
  };
};
