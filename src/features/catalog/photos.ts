import * as ImagePicker from 'expo-image-picker';
import type { UploadFile } from '@/src/shared/api/upload';

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type PickResult = { files: UploadFile[]; error: 'type' | 'tooBig' | null };

/** Tira uma foto ou escolhe da galeria (várias de uma vez, até o que ainda cabe). Só JPG, PNG ou WebP, até 5 MB. */
export async function pickPhotos(camera: boolean, remaining: number): Promise<PickResult> {
  if (remaining <= 0) return { files: [], error: null };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, ...(camera ? {} : { allowsMultipleSelection: true, selectionLimit: remaining }) };
  if (camera) {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return { files: [], error: null };
  }
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled) return { files: [], error: null };
  const files: UploadFile[] = [];
  let error: PickResult['error'] = null;
  for (const a of r.assets.slice(0, remaining)) {
    const type = a.mimeType ?? 'image/jpeg';
    if (!TYPES.includes(type)) {
      error = 'type';
      continue;
    }
    if ((a.fileSize ?? 0) > PHOTO_MAX_BYTES) {
      error = 'tooBig';
      continue;
    }
    files.push({ uri: a.uri, name: a.fileName ?? `foto-${Date.now()}-${files.length}.jpg`, type });
  }
  return { files, error };
}
