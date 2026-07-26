# Mídia

| Tipo | Captação (alvo) | Entrega |
|------|-----------------|---------|
| Imagem | image-picker / camera | signed URL R2 |
| Vídeo | image-picker | signed URL |
| Áudio | expo-av | MIME Meta (ogg/opus ou conversão) |
| Documento | document-picker | pdf etc. |

WS nunca carrega bytes — só referências. Fase 1: sheet mock.
