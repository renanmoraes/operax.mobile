import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { openViewer } from '@/src/features/media/viewer';
import { getAccessToken } from '@/src/shared/api/token-store';
import { MOBILE_CLIENT_HEADER } from '@/src/shared/config';
import { portalServiceOrderPdfUrl } from '@/src/shared/api/portal.api';

/**
 * PDF do orçamento: a rota exige a sessão no cabeçalho, então baixa para o aparelho e abre no visualizador do app.
 * Na web não há pasta local: o navegador abre o arquivo por conta própria.
 */
export async function downloadServiceOrderPdf(orderId: string, code?: string): Promise<void> {
  const token = await getAccessToken('client');
  if (!token) throw new Error('no-session');
  if (Platform.OS === 'web') {
    const res = await fetch(portalServiceOrderPdfUrl(orderId), { headers: { Authorization: `Bearer ${token}`, 'X-Client': MOBILE_CLIENT_HEADER } });
    if (!res.ok) throw new Error(`pdf ${res.status}`);
    globalThis.open?.(URL.createObjectURL(await res.blob()), '_blank');
    return;
  }
  const target = `${cacheDirectory}orcamento-${Date.now()}.pdf`;
  const out = await downloadAsync(portalServiceOrderPdfUrl(orderId), target, { headers: { Authorization: `Bearer ${token}`, 'X-Client': MOBILE_CLIENT_HEADER } });
  if (out.status !== 200) throw new Error(`pdf ${out.status}`);
  openViewer({ kind: 'pdf', uri: out.uri, title: code ? `${code}.pdf` : 'orcamento.pdf' });
}
