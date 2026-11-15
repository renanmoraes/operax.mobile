import type { ComponentRef, RefObject } from 'react';
import { Linking, Platform, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type ShareModule from 'react-native-share';

import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import i18n from '@/src/i18n';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { CANVAS } from './types';

/**
 * `react-native-share` só existe no celular: carregar no topo derruba a versão web (inclusive a renderização no servidor,
 * que é onde os prints da loja são feitos). Aqui ela só é carregada na hora de usar.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const native = () => require('react-native-share') as { default: typeof ShareModule; Social: typeof import('react-native-share').Social };

export type CanvasRef = RefObject<ComponentRef<typeof View> | null>;

export type Destination = 'story' | 'whatsapp' | 'copy' | 'save' | 'more';

const META_APP_ID = process.env.EXPO_PUBLIC_META_APP_ID ?? '';

const opts = { format: 'png' as const, quality: 1, width: CANVAS.w, height: CANVAS.h };

export function captureFile(ref: CanvasRef): Promise<string> {
  return captureRef(ref, { ...opts, result: 'tmpfile' });
}

export function captureDataUri(ref: CanvasRef): Promise<string> {
  return captureRef(ref, { ...opts, result: 'data-uri' });
}

/** O app de destino está no aparelho? Sem ele o react-native-share não falha: abre outra coisa. */
async function hasApp(androidPackage: string, iosScheme: string): Promise<boolean> {
  try {
    if (Platform.OS === 'android') return (await native().default.isPackageInstalled(androidPackage)).isInstalled;
    return await Linking.canOpenURL(iosScheme);
  } catch {
    return false;
  }
}

/** Cancelar no Instagram/menu do sistema não é erro. */
export function isCancel(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /did not share|cancel/i.test(msg);
}

async function more(file: string) {
  await Sharing.shareAsync(file, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: i18n.t('fitness:share.title') });
}

/** Story: o PNG transparente vai como adesivo e a pessoa escolhe o fundo no Instagram; o opaco vai como fundo. */
async function story(ref: CanvasRef, transparent: boolean) {
  const file = await captureFile(ref);
  if (!META_APP_ID || !(await hasApp('com.instagram.android', 'instagram-stories://share'))) return more(file);
  const image = await captureDataUri(ref);
  try {
    const { default: Share, Social } = native();
    await Share.shareSingle({
      social: Social.InstagramStories,
      appId: META_APP_ID,
      ...(transparent ? { stickerImage: image, backgroundTopColor: '#0b1a3a', backgroundBottomColor: '#1e4ed8' } : { backgroundImage: image }),
      useInternalStorage: true,
    });
  } catch (e) {
    if (isCancel(e)) return;
    // Instagram ausente ou recusou: o mesmo PNG pelo menu do sistema.
    await more(file);
  }
}

async function whatsapp(ref: CanvasRef) {
  const file = await captureFile(ref);
  if (!(await hasApp('com.whatsapp', 'whatsapp://send'))) return more(file);
  try {
    const { default: Share, Social } = native();
    await Share.shareSingle({ social: Social.Whatsapp, url: file, type: 'image/png', useInternalStorage: true });
  } catch (e) {
    if (isCancel(e)) return;
    await more(file);
  }
}

async function copy(ref: CanvasRef) {
  const uri = await captureDataUri(ref);
  await Clipboard.setImageAsync(uri.replace(/^data:image\/png;base64,/, ''));
  await showDialog({ title: i18n.t('fitness:share.copiedTitle'), message: i18n.t('fitness:share.copiedBody'), tone: 'success' });
}

async function save(ref: CanvasRef) {
  const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!perm.granted) {
    const open = await confirmDialog({ title: i18n.t('fitness:share.galleryDeniedTitle'), message: i18n.t('fitness:share.galleryDeniedBody'), confirmLabel: i18n.t('fitness:share.openSettings'), tone: 'warn' });
    if (open) await Linking.openSettings();
    return;
  }
  await MediaLibrary.Asset.create(await captureFile(ref));
  await showDialog({ title: i18n.t('fitness:share.savedTitle'), message: i18n.t('fitness:share.savedBody'), tone: 'success' });
}

export async function sendTo(dest: Destination, ref: CanvasRef, transparent: boolean): Promise<void> {
  switch (dest) {
    case 'story':
      return story(ref, transparent);
    case 'whatsapp':
      return whatsapp(ref);
    case 'copy':
      return copy(ref);
    case 'save':
      return save(ref);
    case 'more':
      return more(await captureFile(ref));
  }
}
