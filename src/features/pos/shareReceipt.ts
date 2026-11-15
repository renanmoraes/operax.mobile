import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, copyAsync, deleteAsync } from 'expo-file-system/legacy';
import type { PosReceipt } from '@/src/shared/api/pos.api';
import { receiptFileName, receiptHtml } from './receiptHtml';

type T = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Gera o PDF do comprovante e abre a folha de compartilhar do aparelho: o operador decide se manda
 * pelo WhatsApp dele, por e-mail ou se só salva. No web, abre a impressão (dá para salvar em PDF).
 */
export async function shareReceiptPdf(receipt: PosReceipt, t: T): Promise<'shared' | 'printed'> {
  const html = receiptHtml(receipt, t);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return 'printed';
  }
  const { uri } = await Print.printToFileAsync({ html, width: 302, base64: false });
  // O nome do arquivo é o que o cliente vê no WhatsApp: "comprovante-V-1041.pdf" em vez de um código.
  const named = `${cacheDirectory}${receiptFileName(receipt, t('receipt.filePrefix'))}`;
  let target = uri;
  try {
    await deleteAsync(named, { idempotent: true });
    await copyAsync({ from: uri, to: named });
    target = named;
  } catch {
    /* fica com o nome gerado */
  }
  if (!(await Sharing.isAvailableAsync())) {
    await Print.printAsync({ uri: target });
    return 'printed';
  }
  await Sharing.shareAsync(target, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('receipt.shareTitle') });
  return 'shared';
}
