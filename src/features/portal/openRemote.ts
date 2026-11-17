import { openDocument } from '@/src/features/media/viewer';

/** Abre um arquivo que o servidor entrega por endereço temporário: PDF no visualizador do app, o resto em "Abrir com…". */
export async function openRemotePdf(url: string, name: string): Promise<void> {
  const clean = name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
  await openDocument(url, clean);
}

/** O mesmo para documentos de qualquer tipo: o nome vem com a extensão certa quando o arquivo não é PDF. */
export async function openRemoteFile(url: string, name: string): Promise<void> {
  await openDocument(url, name);
}
