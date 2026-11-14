import { Asset } from 'expo-asset';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type ViewerKind = 'image' | 'pdf';

/** Endereço de um arquivo embutido no app (require), para abrir no visualizador. */
export function assetUri(mod: number): string {
  return Asset.fromModule(mod).uri;
}

/** Abre foto (com zoom) ou PDF em tela cheia dentro do app. */
export function openViewer(params: { kind: ViewerKind; uri: string; title?: string }) {
  router.push({ pathname: '/visualizar', params: { kind: params.kind, uri: params.uri, title: params.title ?? '' } });
}

function safeName(title: string | undefined, kind: ViewerKind) {
  const base = (title || (kind === 'pdf' ? 'documento' : 'foto')).replace(/[^\p{L}\p{N}._ -]+/gu, '').trim() || 'arquivo';
  const ext = kind === 'pdf' ? '.pdf' : '.jpg';
  return base.toLowerCase().endsWith(ext) ? base : base + ext;
}

/** Garante uma cópia local (baixa se for link) e devolve o caminho no aparelho. */
export async function ensureLocalFile(uri: string, kind: ViewerKind, title?: string): Promise<string> {
  if (uri.startsWith('file:')) return uri;
  const target = `${cacheDirectory}${Date.now()}-${safeName(title, kind)}`;
  const { uri: local } = await downloadAsync(uri, target);
  return local;
}

/** Compartilhar / salvar o arquivo (no iPhone, inclui "Salvar em Arquivos" e "Salvar imagem"). */
export async function shareFile(uri: string, kind: ViewerKind, title?: string) {
  if (Platform.OS === 'web') {
    globalThis.open?.(uri, '_blank');
    return;
  }
  if (!(await Sharing.isAvailableAsync())) return;
  const local = await ensureLocalFile(uri, kind, title);
  await Sharing.shareAsync(local, {
    mimeType: kind === 'pdf' ? 'application/pdf' : 'image/jpeg',
    UTI: kind === 'pdf' ? 'com.adobe.pdf' : 'public.jpeg',
    dialogTitle: title,
  });
}
