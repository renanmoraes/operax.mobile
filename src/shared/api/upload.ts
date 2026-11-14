import { Platform } from 'react-native';

export type UploadFile = { uri: string; name: string; type: string };

/**
 * Coloca um arquivo no FormData do jeito que cada plataforma entende.
 * No celular, o React Native aceita `{ uri, name, type }`. No navegador isso viraria o texto
 * "[object Object]"; lá o arquivo (gravação de áudio, foto escolhida) é lido como Blob antes.
 */
export async function appendUpload(form: FormData, field: string, file: UploadFile): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
    return;
  }
  form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
}
